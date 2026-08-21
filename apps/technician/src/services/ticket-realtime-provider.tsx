import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useAuth } from './auth-context';

interface TicketRealtimeContextType {
  refreshVersion: number;
  isSubscribed: boolean;
}

const TicketRealtimeContext = createContext<TicketRealtimeContextType | undefined>(undefined);

export function TicketRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { technicianId } = useAuth();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  const incrementVersion = useCallback(() => {
    setRefreshVersion(prev => prev + 1);
    console.log('[Realtime] refreshVersion incremented to', refreshVersion + 1);
  }, [refreshVersion]);

  useEffect(() => {
    if (!technicianId) {
      console.log('[Realtime] No technician ID, skipping subscription');
      return;
    }

    console.log('[Realtime] ========================================');
    console.log('[Realtime] Setting up subscription');
    console.log('[Realtime] Technician ID:', technicianId);
    console.log('[Realtime] ========================================');

    // Create single channel for all ticket changes
    // NOTE: No filter applied during debugging to see ALL events
    const ticketChannel = supabase
      .channel(`tickets-${technicianId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        (payload) => {
          console.log('[Realtime] ========================================');
          console.log('[Realtime] EVENT RECEIVED');
          console.log('[Realtime] Type:', payload.eventType);

          const oldRecord = payload.old as any;
          const newRecord = payload.new as any;

          console.log('[Realtime] Old technician_id:', oldRecord?.technician_id || 'none');
          console.log('[Realtime] New technician_id:', newRecord?.technician_id || 'none');
          console.log('[Realtime] My technician_id:', technicianId);

          let isRelevant = false;

          switch (payload.eventType) {
            case 'INSERT':
              // New ticket assigned to this technician
              if (newRecord?.technician_id === technicianId) {
                console.log('[Realtime] INSERT: Ticket assigned to ME');
                isRelevant = true;
              } else {
                console.log('[Realtime] INSERT: Ticket assigned to someone else');
              }
              break;

            case 'UPDATE':
              // Ticket was assigned to me
              if (newRecord?.technician_id === technicianId) {
                console.log('[Realtime] UPDATE: Ticket NOW assigned to ME');
                isRelevant = true;
              }
              // Ticket was unassigned from me
              else if (oldRecord?.technician_id === technicianId) {
                console.log('[Realtime] UPDATE: Ticket UNASSIGNED from me');
                isRelevant = true;
              } else {
                console.log('[Realtime] UPDATE: Not related to me');
              }
              break;

            case 'DELETE':
              // Ticket deleted that was assigned to me
              if (oldRecord?.technician_id === technicianId) {
                console.log('[Realtime] DELETE: My ticket was deleted');
                isRelevant = true;
              } else {
                console.log('[Realtime] DELETE: Not my ticket');
              }
              break;
          }

          console.log('[Realtime] Relevant:', isRelevant);

          if (isRelevant) {
            console.log('[Realtime] ✓ Triggering refresh, new version:', refreshVersion + 1);
            incrementVersion();
          }

          console.log('[Realtime] ========================================');
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);

        switch (status) {
          case 'SUBSCRIBED':
            setIsSubscribed(true);
            console.log('[Realtime] Successfully subscribed');
            break;
          case 'CHANNEL_ERROR':
            console.warn('[Realtime] Channel error');
            setIsSubscribed(false);
            break;
          case 'TIMED_OUT':
            console.warn('[Realtime] Subscription timed out');
            setIsSubscribed(false);
            break;
          case 'CLOSED':
            console.warn('[Realtime] Channel closed');
            setIsSubscribed(false);
            break;
        }
      });

    setChannel(ticketChannel);

    // Cleanup
    return () => {
      console.log('[Realtime] Cleaning up subscription');
      ticketChannel.unsubscribe();
      setIsSubscribed(false);
    };
  }, [technicianId, incrementVersion]);

  return (
    <TicketRealtimeContext.Provider value={{ refreshVersion, isSubscribed }}>
      {children}
    </TicketRealtimeContext.Provider>
  );
}

export function useTicketRealtime() {
  const context = useContext(TicketRealtimeContext);
  if (context === undefined) {
    throw new Error('useTicketRealtime must be used within TicketRealtimeProvider');
  }
  return context;
}
