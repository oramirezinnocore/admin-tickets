/**
 * Server-side helper for sending push notifications to technicians
 * Uses Expo Push Notification Service
 */

import { getSupabaseAdmin } from './supabase-admin';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushNotificationData {
  type: 'ticket_assigned' | 'ticket_reassigned' | 'ticket_updated';
  ticketId: string;
  folio: number;
}

interface SendPushOptions {
  technicianId: string;
  title: string;
  body: string;
  data: PushNotificationData;
  priority?: 'default' | 'normal' | 'high';
}

/**
 * Send push notification to a technician
 */
export async function sendTechnicianPush({
  technicianId,
  title,
  body,
  data,
  priority = 'high',
}: SendPushOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // Get Supabase admin client (lazy initialization at runtime)
    const supabaseAdmin = getSupabaseAdmin();

    // Get active push tokens for technician
    const { data: tokens, error: tokensError } = await supabaseAdmin
      .from('technician_push_tokens')
      .select('expo_push_token')
      .eq('technician_id', technicianId)
      .eq('is_active', true);

    if (tokensError) {
      console.error('[Push] Error fetching tokens:', tokensError);
      return { success: false, error: 'Failed to fetch push tokens' };
    }

    if (!tokens || tokens.length === 0) {
      console.warn('[Push] No active tokens found for technician:', technicianId);
      return { success: false, error: 'No active push tokens' };
    }

    // Prepare push messages
    const messages = tokens.map((token) => ({
      to: token.expo_push_token,
      sound: 'default',
      title,
      body,
      data,
      priority,
      channelId: 'tickets', // Android notification channel
    }));

    // Send to Expo Push Service
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Push] Expo API error:', response.status, errorText);
      return { success: false, error: `Expo API error: ${response.status}` };
    }

    const result = await response.json();
    console.log('[Push] Sent successfully:', result);

    // Check for errors in individual receipts
    if (result.data) {
      const hasErrors = result.data.some(
        (receipt: any) => receipt.status === 'error'
      );
      if (hasErrors) {
        console.warn('[Push] Some receipts had errors:', result.data);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[Push] Unexpected error:', error);
    return { success: false, error: 'Unexpected error sending push' };
  }
}

/**
 * Send "ticket assigned" notification
 */
export async function sendTicketAssignedPush(
  technicianId: string,
  ticketFolio: number,
  ticketId: string,
  clientName: string,
  isHighPriority: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const title = 'Nuevo ticket asignado';
  const body = isHighPriority
    ? `#${ticketFolio} · ${clientName} · Prioridad alta`
    : `#${ticketFolio} · ${clientName}`;

  return sendTechnicianPush({
    technicianId,
    title,
    body,
    data: {
      type: 'ticket_assigned',
      ticketId,
      folio: ticketFolio,
    },
    priority: isHighPriority ? 'high' : 'default',
  });
}

/**
 * Send "ticket reassigned" notification (optional for MVP)
 */
export async function sendTicketReassignedPush(
  technicianId: string,
  ticketFolio: number,
  ticketId: string
): Promise<{ success: boolean; error?: string }> {
  return sendTechnicianPush({
    technicianId,
    title: 'Ticket reasignado',
    body: `El ticket #${ticketFolio} ya no está asignado a ti`,
    data: {
      type: 'ticket_reassigned',
      ticketId,
      folio: ticketFolio,
    },
  });
}
