'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function resolveTicketAdminAction(
  ticketId: string,
  reason: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  // 1. Verify auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autorizado' };
  }

  // 2. Verify admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')) {
    return { error: 'No tienes permisos para resolver tickets' };
  }

  // 3. Validate reason
  if (!reason?.trim()) {
    return { error: 'El motivo es obligatorio' };
  }

  // 4. Update ticket
  const { error: ticketError } = await supabase
    .from('tickets')
    .update({
      status: 'RESOLVED',
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);

  if (ticketError) {
    console.error('[resolveTicketAdminAction] Ticket update error:', ticketError);
    return { error: 'Error al actualizar ticket' };
  }

  // 5. Create activity log entry
  const { error: activityError } = await supabase.from('ticket_activity').insert({
    ticket_id: ticketId,
    activity_type: 'ADMIN_RESOLVED',
    actor_profile_id: user.id,
    note: reason.trim(),
    new_status: 'RESOLVED',
    created_at: new Date().toISOString(),
  });

  if (activityError) {
    console.error('[resolveTicketAdminAction] Activity log error:', activityError);
    // Don't fail - ticket is already resolved
  }

  // 6. Revalidate paths
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
  revalidatePath('/dashboard');

  return { success: true };
}
