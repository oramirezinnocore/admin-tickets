import { supabase } from './supabase';

export type ActivityType =
  | 'TICKET_CREATED'
  | 'TECHNICIAN_ASSIGNED'
  | 'TECHNICIAN_REASSIGNED'
  | 'TECHNICIAN_UNASSIGNED'
  | 'WORK_STARTED'
  | 'STATUS_CHANGED'
  | 'PAUSED'
  | 'RESUMED'
  | 'TECHNICIAN_NOTE_ADDED'
  | 'ADMIN_NOTE_ADDED'
  | 'EVIDENCE_ADDED'
  | 'EVIDENCE_DELETED'
  | 'SIGNATURE_ADDED'
  | 'CLOSED'
  | 'CANCELLED';

export interface TicketActivity {
  id: string;
  ticket_id: string;
  activity_type: ActivityType;
  actor_profile_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  note: string | null;
  evidence_id: string | null;
  signature_id: string | null;
  assigned_technician_id: string | null;
  previous_technician_id: string | null;
  metadata: any;
  created_at: string;
}

export interface ActivitySummary {
  lastActivity: TicketActivity | null;
  lastNote: TicketActivity | null;
  pauseCount: number;
  evidenceCount: number;
  hasStarted: boolean;
}

/**
 * Get activity summary for ticket (for Activity Summary Card)
 */
export async function getActivitySummary(ticketId: string): Promise<ActivitySummary> {
  try {
    // Get all activities for this ticket
    const { data: activities, error } = await supabase
      .from('ticket_activity')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!activities || activities.length === 0) {
      return {
        lastActivity: null,
        lastNote: null,
        pauseCount: 0,
        evidenceCount: 0,
        hasStarted: false,
      };
    }

    // Find last activity
    const lastActivity = activities[0] || null;

    // Find last technician note
    const lastNote =
      activities.find((a) => a.activity_type === 'TECHNICIAN_NOTE_ADDED') || null;

    // Count pauses
    const pauseCount = activities.filter((a) => a.activity_type === 'PAUSED').length;

    // Count evidences (added - deleted)
    const evidenceAdded = activities.filter((a) => a.activity_type === 'EVIDENCE_ADDED').length;
    const evidenceDeleted = activities.filter((a) => a.activity_type === 'EVIDENCE_DELETED').length;
    const evidenceCount = Math.max(0, evidenceAdded - evidenceDeleted);

    // Check if work has started
    const hasStarted = activities.some((a) => a.activity_type === 'WORK_STARTED');

    return {
      lastActivity,
      lastNote,
      pauseCount,
      evidenceCount,
      hasStarted,
    };
  } catch (error: any) {
    console.error('[Activity] Error getting summary:', error);
    return {
      lastActivity: null,
      lastNote: null,
      pauseCount: 0,
      evidenceCount: 0,
      hasStarted: false,
    };
  }
}

/**
 * Get full activity timeline for ticket (for Bottom Sheet)
 */
export async function getActivityTimeline(
  ticketId: string,
  limit: number = 50
): Promise<TicketActivity[]> {
  try {
    const { data, error } = await supabase
      .from('ticket_activity')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('[Activity] Error getting timeline:', error);
    return [];
  }
}

/**
 * Add technician note to activity
 */
export async function addTechnicianNote(
  ticketId: string,
  note: string,
  technicianProfileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!note.trim()) {
      return { success: false, error: 'La observación no puede estar vacía' };
    }

    const { error } = await supabase.from('ticket_activity').insert({
      ticket_id: ticketId,
      activity_type: 'TECHNICIAN_NOTE_ADDED',
      actor_profile_id: technicianProfileId,
      note: note.trim(),
    });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('[Activity] Error adding note:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Subscribe to activity changes for a ticket
 * @param ticketId - The ticket ID to subscribe to
 * @param callback - Callback function when new activity is inserted
 * @param channelSuffix - Optional suffix to create unique channel names (prevents collision)
 */
export function subscribeToActivity(
  ticketId: string,
  callback: (activity: TicketActivity) => void,
  channelSuffix: string = 'default'
) {
  const channelName = `ticket-activity:${ticketId}:${channelSuffix}`;

  console.log(`[ActivityRealtime] Creating channel: ${channelName}`);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_activity',
        filter: `ticket_id=eq.${ticketId}`,
      },
      (payload) => {
        console.log(`[ActivityRealtime] INSERT received on ${channelName}`);
        callback(payload.new as TicketActivity);
      }
    )
    .subscribe((status) => {
      console.log(`[ActivityRealtime] Status for ${channelName}:`, status);
    });

  return () => {
    console.log(`[ActivityRealtime] Removing channel: ${channelName}`);
    supabase.removeChannel(channel);
  };
}

/**
 * Group activities by date
 */
export function groupActivitiesByDate(activities: TicketActivity[]): Record<string, TicketActivity[]> {
  const groups: Record<string, TicketActivity[]> = {};

  activities.forEach((activity) => {
    const date = new Date(activity.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;

    if (date.toDateString() === today.toDateString()) {
      label = 'HOY';
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = 'AYER';
    } else {
      label = date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).toUpperCase();
    }

    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(activity);
  });

  return groups;
}
