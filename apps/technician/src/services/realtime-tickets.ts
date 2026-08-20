import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface UseRealtimeTicketsOptions {
  technicianId: string | null;
  onTicketChange: () => void;
}

/**
 * Hook to subscribe to real-time ticket changes for a specific technician
 * Automatically refreshes data when tickets are assigned, updated, or removed
 */
export function useRealtimeTickets({ technicianId, onTicketChange }: UseRealtimeTicketsOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!technicianId) return;

    // Create channel for ticket changes
    const channel = supabase
      .channel('technician-tickets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `technician_id=eq.${technicianId}`,
        },
        (payload) => {
          console.log('[Realtime] Ticket change detected:', payload.eventType, payload.new);
          onTicketChange();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `old_record.technician_id=eq.${technicianId}`,
        },
        (payload) => {
          // Handle case where ticket was reassigned away from this technician
          const oldRecord = payload.old as any;
          const newRecord = payload.new as any;

          if (oldRecord?.technician_id === technicianId && newRecord?.technician_id !== technicianId) {
            console.log('[Realtime] Ticket reassigned away from this technician');
            onTicketChange();
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      console.log('[Realtime] Unsubscribing from tickets');
      channel.unsubscribe();
    };
  }, [technicianId, onTicketChange]);

  return {
    isSubscribed: channelRef.current?.state === 'joined',
  };
}
