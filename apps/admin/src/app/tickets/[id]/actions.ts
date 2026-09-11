'use server';

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function resolveTicketAdminAction(
  ticketId: string,
  reason: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  // 1. Get authenticated user from session cookies
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  // Find Supabase auth token in cookies
  const authCookie = allCookies.find(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  );

  if (!authCookie) {
    return { error: 'No autorizado' };
  }

  let sessionData;
  try {
    sessionData = JSON.parse(authCookie.value);
  } catch {
    return { error: 'No autorizado' };
  }

  const accessToken = sessionData?.access_token;
  if (!accessToken) {
    return { error: 'No autorizado' };
  }

  // 2. Validate the token and get user
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return { error: 'No autorizado' };
  }

  // 3. Verify admin role
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
