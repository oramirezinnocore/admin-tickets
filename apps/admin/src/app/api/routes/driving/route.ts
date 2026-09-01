import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { optimizeRouteNearestNeighbor, hasValidCoordinates } from '@wisper/shared';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const ROUTING_BASE_URL = process.env.ROUTING_BASE_URL || 'https://router.project-osrm.org';

interface OSRMRoute {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  legs: Array<{
    distance: number;
    duration: number;
    steps: Array<{
      distance: number;
      duration: number;
      geometry: any;
      name: string;
      mode: string;
    }>;
  }>;
}

interface OSRMResponse {
  code: string;
  routes?: OSRMRoute[];
  message?: string;
}

interface DrivingRouteResult {
  orderedTicketIds: string[];
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  distanceMeters: number;
  durationSeconds: number;
  legs: Array<{
    distanceMeters: number;
    durationSeconds: number;
  }>;
  ticketsWithoutLocation: any[];
}

export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN') || !profile.is_active) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { technicianId, ticketIds } = body;

    if (!technicianId || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json(
        { error: 'technicianId y ticketIds[] requeridos' },
        { status: 400 }
      );
    }

    if (ticketIds.length < 1) {
      return NextResponse.json(
        { error: 'Se requiere al menos 1 ticket' },
        { status: 400 }
      );
    }

    if (ticketIds.length > 20) {
      return NextResponse.json(
        { error: 'Máximo 20 tickets para ruteo' },
        { status: 400 }
      );
    }

    // Validate technician
    const { data: technician } = await supabase
      .from('technicians')
      .select('id, is_active')
      .eq('id', technicianId)
      .single();

    if (!technician) {
      return NextResponse.json({ error: 'Técnico no encontrado' }, { status: 404 });
    }

    if (!technician.is_active) {
      return NextResponse.json({ error: 'Técnico inactivo' }, { status: 400 });
    }

    // Get technician's latest location as origin
    const { data: techLocation } = await supabase
      .from('technician_latest_locations')
      .select('latitude, longitude')
      .eq('technician_id', technicianId)
      .single();

    if (!techLocation) {
      return NextResponse.json(
        { error: 'No hay una ubicación reciente del técnico para calcular la ruta.' },
        { status: 400 }
      );
    }

    if (!hasValidCoordinates(techLocation.latitude, techLocation.longitude)) {
      return NextResponse.json(
        { error: 'La ubicación del técnico no es válida.' },
        { status: 400 }
      );
    }

    const origin = {
      latitude: techLocation.latitude,
      longitude: techLocation.longitude,
    };

    // Get tickets with client locations
    const { data: tickets } = await supabase
      .from('tickets')
      .select(`
        id,
        folio,
        status,
        created_at,
        client:clients(
          id,
          name,
          address,
          latitude,
          longitude
        )
      `)
      .in('id', ticketIds)
      .eq('technician_id', technicianId)
      .in('status', ['PENDING', 'ASSIGNED', 'IN_REVIEW', 'PAUSED']);

    if (!tickets || tickets.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron tickets activos para este técnico' },
        { status: 404 }
      );
    }

    // Separate tickets with and without location
    const ticketsWithLocation = tickets.filter(
      (t: any) =>
        t.client?.latitude &&
        t.client?.longitude &&
        hasValidCoordinates(t.client.latitude, t.client.longitude)
    );

    const ticketsWithoutLocation = tickets.filter(
      (t: any) =>
        !t.client?.latitude ||
        !t.client?.longitude ||
        !hasValidCoordinates(t.client.latitude, t.client.longitude)
    );

    if (ticketsWithLocation.length === 0) {
      return NextResponse.json({
        orderedTicketIds: [],
        geometry: { type: 'LineString', coordinates: [] },
        distanceMeters: 0,
        durationSeconds: 0,
        legs: [],
        ticketsWithoutLocation,
        warning: 'Ningún ticket tiene coordenadas válidas',
      });
    }

    // Prepare destinations for optimization
    const destinations = ticketsWithLocation.map((t: any) => ({
      id: t.id,
      latitude: t.client.latitude,
      longitude: t.client.longitude,
    }));

    // STEP 1: Optimize order using nearest-neighbor algorithm
    const optimizationResult = optimizeRouteNearestNeighbor(origin, destinations);

    console.log('[DrivingRoute] Order optimized:', {
      orderedCount: optimizationResult.orderedPoints.length,
      haversineDistance: optimizationResult.totalDistanceKm,
    });

    // STEP 2: Build coordinates array for OSRM
    // Format: lon,lat;lon,lat;...
    const coordinates: Array<[number, number]> = [
      [origin.longitude, origin.latitude],
    ];

    optimizationResult.orderedPoints.forEach(point => {
      coordinates.push([point.longitude, point.latitude]);
    });

    // Build OSRM request
    const coordinatesString = coordinates
      .map(coord => `${coord[0]},${coord[1]}`)
      .join(';');

    const osrmUrl = new URL(
      `/route/v1/driving/${coordinatesString}`,
      ROUTING_BASE_URL
    );

    osrmUrl.searchParams.set('overview', 'full');
    osrmUrl.searchParams.set('geometries', 'geojson');
    osrmUrl.searchParams.set('steps', 'true');

    console.log('[DrivingRoute] OSRM URL:', osrmUrl.toString());

    // STEP 3: Call OSRM with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let osrmData: OSRMResponse;

    try {
      const osrmResponse = await fetch(osrmUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Wisper-Admin/1.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('[DrivingRoute] OSRM status:', osrmResponse.status);

      if (!osrmResponse.ok) {
        console.error('[DrivingRoute] OSRM HTTP error:', osrmResponse.status);
        return NextResponse.json(
          {
            error: 'El servicio de cálculo de rutas no está disponible temporalmente.',
            providerStatus: osrmResponse.status,
          },
          { status: 502 }
        );
      }

      osrmData = await osrmResponse.json();
      console.log('[DrivingRoute] OSRM code:', osrmData.code);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error('[DrivingRoute] OSRM timeout');
        return NextResponse.json(
          { error: 'El servicio de cálculo de rutas tardó demasiado en responder.' },
          { status: 504 }
        );
      }

      console.error('[DrivingRoute] OSRM fetch error:', fetchError.message);
      return NextResponse.json(
        { error: 'El servicio de cálculo de rutas no está disponible temporalmente.' },
        { status: 502 }
      );
    }

    // STEP 4: Handle OSRM response
    if (osrmData.code !== 'Ok') {
      console.error('[DrivingRoute] OSRM returned non-Ok code:', osrmData.code);

      if (osrmData.code === 'NoRoute') {
        return NextResponse.json(
          {
            error:
              'No fue posible encontrar una ruta vehicular para todos los destinos seleccionados.',
            osrmCode: osrmData.code,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: 'Error al calcular la ruta.',
          osrmCode: osrmData.code,
          osrmMessage: osrmData.message,
        },
        { status: 502 }
      );
    }

    if (!osrmData.routes || osrmData.routes.length === 0) {
      console.error('[DrivingRoute] OSRM returned no routes');
      return NextResponse.json(
        { error: 'No fue posible encontrar una ruta vehicular.' },
        { status: 502 }
      );
    }

    const route = osrmData.routes[0];

    // STEP 5: Normalize response
    const result: DrivingRouteResult = {
      orderedTicketIds: optimizationResult.orderedPoints.map(p => p.id),
      geometry: route.geometry,
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      legs: route.legs.map(leg => ({
        distanceMeters: Math.round(leg.distance),
        durationSeconds: Math.round(leg.duration),
      })),
      ticketsWithoutLocation,
    };

    console.log('[DrivingRoute] Success:', {
      distanceMeters: result.distanceMeters,
      durationSeconds: result.durationSeconds,
      coordinatesCount: result.geometry.coordinates.length,
    });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[DrivingRoute] Error:', error.name, error.message);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
