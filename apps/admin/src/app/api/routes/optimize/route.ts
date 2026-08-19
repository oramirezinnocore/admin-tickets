import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { optimizeRouteNearestNeighbor } from '@wisper/shared';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

    // Get technician's latest location as origin
    const { data: techLocation } = await supabase
      .from('technician_latest_locations')
      .select('latitude, longitude')
      .eq('technician_id', technicianId)
      .single();

    if (!techLocation) {
      return NextResponse.json(
        { error: 'No hay una ubicación reciente del técnico para calcular la ruta sugerida.' },
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
      (t: any) => t.client?.latitude && t.client?.longitude
    );

    const ticketsWithoutLocation = tickets.filter(
      (t: any) => !t.client?.latitude || !t.client?.longitude
    );

    if (ticketsWithLocation.length === 0) {
      return NextResponse.json({
        orderedTicketIds: [],
        distanceMeters: 0,
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

    // Optimize route using nearest-neighbor algorithm
    const result = optimizeRouteNearestNeighbor(origin, destinations);

    return NextResponse.json({
      orderedTicketIds: result.orderedPoints.map(p => p.id),
      distanceMeters: Math.round(result.totalDistanceKm * 1000),
      ticketsWithoutLocation,
    });
  } catch (error: any) {
    console.error('Route optimization error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
