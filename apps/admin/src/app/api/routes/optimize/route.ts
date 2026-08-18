import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const googleRoutesKey = process.env.GOOGLE_ROUTES_API_KEY || '';

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

    if (!profile || profile.role !== 'ADMIN' || !profile.is_active) {
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

    if (ticketIds.length > 20) {
      return NextResponse.json(
        { error: 'Máximo 20 tickets para optimizar' },
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

    // Get tickets with client locations
    const { data: tickets } = await supabase
      .from('tickets')
      .select(`
        id,
        folio,
        status,
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
      (t: any) => t.client?.latitude && t.client?.longitude
    );

    const ticketsWithoutLocation = tickets
      .filter((t: any) => !t.client?.latitude || !t.client?.longitude)
      .map((t: any) => ({
        id: t.id,
        folio: t.folio,
        clientName: t.client?.name,
        reason: 'Sin coordenadas',
      }));

    if (ticketsWithLocation.length === 0) {
      return NextResponse.json({
        orderedTicketIds: [],
        distanceMeters: 0,
        durationSeconds: 0,
        polyline: null,
        ticketsWithoutLocation,
        warning: 'Ningún ticket tiene coordenadas válidas',
      });
    }

    // Get technician's latest location as origin
    const { data: techLocation } = await supabase
      .from('technician_latest_locations')
      .select('latitude, longitude')
      .eq('technician_id', technicianId)
      .single();

    let origin: { latitude: number; longitude: number };

    if (techLocation) {
      origin = {
        latitude: techLocation.latitude,
        longitude: techLocation.longitude,
      };
    } else {
      // Fallback to first ticket location
      const firstTicket = ticketsWithLocation[0] as any;
      origin = {
        latitude: firstTicket.client.latitude,
        longitude: firstTicket.client.longitude,
      };
    }

    // Call Google Routes API
    if (!googleRoutesKey) {
      // Fallback: return tickets in original order
      return NextResponse.json({
        orderedTicketIds: ticketsWithLocation.map((t: any) => t.id),
        distanceMeters: 0,
        durationSeconds: 0,
        polyline: null,
        ticketsWithoutLocation,
        warning: 'GOOGLE_ROUTES_API_KEY no configurada. Orden sin optimizar.',
      });
    }

    const waypoints = ticketsWithLocation.map((t: any) => ({
      location: {
        latLng: {
          latitude: t.client.latitude,
          longitude: t.client.longitude,
        },
      },
    }));

    const routesResponse = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleRoutesKey,
          'X-Goog-FieldMask':
            'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex',
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: origin.latitude,
                longitude: origin.longitude,
              },
            },
          },
          destination: waypoints[waypoints.length - 1].location,
          intermediates: waypoints.slice(0, -1),
          travelMode: 'DRIVE',
          optimizeWaypointOrder: true,
        }),
      }
    );

    if (!routesResponse.ok) {
      console.error('Google Routes API error:', await routesResponse.text());
      // Fallback
      return NextResponse.json({
        orderedTicketIds: ticketsWithLocation.map((t: any) => t.id),
        distanceMeters: 0,
        durationSeconds: 0,
        polyline: null,
        ticketsWithoutLocation,
        warning: 'Error al optimizar ruta. Orden sin optimizar.',
      });
    }

    const routesData = await routesResponse.json();
    const route = routesData.routes?.[0];

    if (!route) {
      return NextResponse.json({
        orderedTicketIds: ticketsWithLocation.map((t: any) => t.id),
        distanceMeters: 0,
        durationSeconds: 0,
        polyline: null,
        ticketsWithoutLocation,
        warning: 'No se pudo calcular ruta',
      });
    }

    // Build ordered ticket IDs based on optimized waypoint order
    const optimizedIndices = route.optimizedIntermediateWaypointIndex || [];
    const orderedTicketIds = optimizedIndices.map(
      (index: number) => (ticketsWithLocation[index] as any).id
    );

    // Add last destination
    orderedTicketIds.push(
      (ticketsWithLocation[ticketsWithLocation.length - 1] as any).id
    );

    const distanceMeters = route.distanceMeters || 0;
    const durationSeconds = parseInt(route.duration?.replace('s', '') || '0', 10);
    const polyline = route.polyline?.encodedPolyline || null;

    return NextResponse.json({
      orderedTicketIds,
      distanceMeters,
      durationSeconds,
      polyline,
      ticketsWithoutLocation,
      originUsed: techLocation ? 'technician' : 'firstTicket',
    });
  } catch (error: any) {
    console.error('Route optimization error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
