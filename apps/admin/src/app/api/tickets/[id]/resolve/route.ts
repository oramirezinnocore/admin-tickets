import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get user token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = getSupabaseAdmin();

    // Validate user token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verify admin role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 });
    }

    if (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No tienes permisos para resolver tickets' }, { status: 403 });
    }

    if (!profile.is_active) {
      return NextResponse.json({ error: 'Usuario desactivado' }, { status: 403 });
    }

    // Get request body
    const { reason } = await request.json();

    if (!reason?.trim()) {
      return NextResponse.json({ error: 'El motivo es obligatorio' }, { status: 400 });
    }

    const { id: ticketId } = await params;

    // Update ticket to RESOLVED
    const { error: ticketError } = await supabaseAdmin
      .from('tickets')
      .update({
        status: 'RESOLVED',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);

    if (ticketError) {
      console.error('[API] Ticket update error:', ticketError);
      return NextResponse.json({ error: 'Error al actualizar ticket' }, { status: 500 });
    }

    // Create activity log entry
    const { error: activityError } = await supabaseAdmin.from('ticket_activity').insert({
      ticket_id: ticketId,
      activity_type: 'ADMIN_RESOLVED',
      actor_profile_id: user.id,
      note: reason.trim(),
      new_status: 'RESOLVED',
      created_at: new Date().toISOString(),
    });

    if (activityError) {
      console.error('[API] Activity log error:', activityError);
      // Don't fail - ticket is already resolved
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error in resolve route:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
