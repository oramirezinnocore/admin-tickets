'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { EvidencePreview, SignaturePreview } from './ActivityMediaPreview';
import { groupByDate, truncateText, isLongText } from '@/utils/dateGrouping';

export interface TicketActivity {
  id: string;
  ticket_id: string;
  activity_type: string;
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
  actor?: {
    full_name: string;
    email: string | null;
  };
  assigned_technician?: {
    profile: {
      full_name: string;
    };
  };
  previous_technician?: {
    profile: {
      full_name: string;
    };
  };
  evidence?: {
    file_url: string;
  };
  signature?: {
    signature_url: string;
  };
}

interface TicketActivityTimelineProps {
  ticketId: string;
}

export default function TicketActivityTimeline({ ticketId }: TicketActivityTimelineProps) {
  const [activities, setActivities] = useState<TicketActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [totalCount, setTotalCount] = useState<number>(0);
  const [visibleCount, setVisibleCount] = useState<number>(5);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadActivities();

    // Subscribe to realtime changes
    const channel: RealtimeChannel = supabase
      .channel(`ticket-activity-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_activity',
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          console.log('[TicketActivity] New activity received via Realtime');
          loadActivities(); // Reload to get full relations
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [ticketId]);

  async function loadActivities() {
    try {
      setLoading(true);

      console.log('[TicketActivity] Loading activities for ticket:', ticketId);

      // Get total count first
      const { count } = await supabase
        .from('ticket_activity')
        .select('*', { count: 'exact', head: true })
        .eq('ticket_id', ticketId);

      setTotalCount(count || 0);

      // Load all activities (we'll paginate in UI)
      const { data, error } = await supabase
        .from('ticket_activity')
        .select(`
          *,
          actor:profiles!actor_profile_id(full_name, email),
          assigned_technician:technicians!assigned_technician_id(
            profile:profiles(full_name)
          ),
          previous_technician:technicians!previous_technician_id(
            profile:profiles(full_name)
          ),
          evidence:ticket_evidences!evidence_id(file_url),
          signature:ticket_signatures!signature_id(signature_url)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[TicketActivity] Query error:', error);
        throw error;
      }

      console.log('[TicketActivity] Activities loaded:', data?.length || 0);
      console.log('[TicketActivity] First activity sample:', data?.[0]);

      setActivities(data || []);
    } catch (err: any) {
      console.error('Error loading activity:', err);
    } finally {
      setLoading(false);
    }
  }

  function getActivityIcon(type: string): string {
    switch (type) {
      case 'TICKET_CREATED':
        return '📝';
      case 'TECHNICIAN_ASSIGNED':
      case 'TECHNICIAN_REASSIGNED':
        return '👤';
      case 'TECHNICIAN_UNASSIGNED':
        return '👤❌';
      case 'WORK_STARTED':
        return '▶️';
      case 'PAUSED':
        return '⏸';
      case 'RESUMED':
        return '▶️';
      case 'STATUS_CHANGED':
        return '🔄';
      case 'TECHNICIAN_NOTE_ADDED':
      case 'ADMIN_NOTE_ADDED':
        return '📝';
      case 'EVIDENCE_ADDED':
        return '📷';
      case 'EVIDENCE_DELETED':
        return '🗑️';
      case 'SIGNATURE_ADDED':
        return '✍️';
      case 'CLOSED':
        return '✅';
      case 'CANCELLED':
        return '❌';
      default:
        return '•';
    }
  }

  function getActivityTitle(activity: TicketActivity): string {
    switch (activity.activity_type) {
      case 'TICKET_CREATED':
        return 'Ticket creado';
      case 'TECHNICIAN_ASSIGNED':
        return `Asignado a ${activity.assigned_technician?.profile?.full_name || 'técnico'}`;
      case 'TECHNICIAN_REASSIGNED':
        return `Reasignado: ${activity.previous_technician?.profile?.full_name || 'técnico'} → ${activity.assigned_technician?.profile?.full_name || 'técnico'}`;
      case 'TECHNICIAN_UNASSIGNED':
        return `Desasignado de ${activity.previous_technician?.profile?.full_name || 'técnico'}`;
      case 'WORK_STARTED':
        return 'Atención iniciada';
      case 'PAUSED':
        return 'Ticket pausado';
      case 'RESUMED':
        return 'Ticket reanudado';
      case 'STATUS_CHANGED':
        return `Estado: ${getStatusLabel(activity.previous_status)} → ${getStatusLabel(activity.new_status)}`;
      case 'TECHNICIAN_NOTE_ADDED':
        return 'Observación del técnico';
      case 'ADMIN_NOTE_ADDED':
        return 'Nota administrativa';
      case 'EVIDENCE_ADDED':
        return 'Evidencia agregada';
      case 'EVIDENCE_DELETED':
        return 'Evidencia eliminada';
      case 'SIGNATURE_ADDED':
        return 'Firma capturada';
      case 'CLOSED':
        return 'Ticket cerrado';
      case 'CANCELLED':
        return 'Ticket cancelado';
      default:
        return activity.activity_type;
    }
  }

  function getStatusLabel(status: string | null): string {
    if (!status) return '';
    const labels: Record<string, string> = {
      PENDING: 'Pendiente',
      ASSIGNED: 'Asignado',
      IN_REVIEW: 'En revisión',
      PAUSED: 'Pausado',
      RESOLVED: 'Resuelto',
      CANCELLED: 'Cancelado',
    };
    return labels[status] || status;
  }

  function getActivityColor(type: string): string {
    switch (type) {
      case 'TICKET_CREATED':
      case 'WORK_STARTED':
        return 'bg-blue-500';
      case 'PAUSED':
        return 'bg-yellow-500';
      case 'RESUMED':
        return 'bg-blue-500';
      case 'EVIDENCE_ADDED':
        return 'bg-purple-500';
      case 'EVIDENCE_DELETED':
        return 'bg-red-400';
      case 'SIGNATURE_ADDED':
        return 'bg-indigo-500';
      case 'CLOSED':
        return 'bg-green-500';
      case 'CANCELLED':
        return 'bg-red-500';
      case 'TECHNICIAN_NOTE_ADDED':
      case 'ADMIN_NOTE_ADDED':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  }

  function shouldShowActivity(activity: TicketActivity): boolean {
    if (filter === 'all') return true;
    if (filter === 'status') {
      return ['STATUS_CHANGED', 'PAUSED', 'RESUMED', 'WORK_STARTED', 'CLOSED', 'CANCELLED'].includes(
        activity.activity_type
      );
    }
    if (filter === 'notes') {
      return ['TECHNICIAN_NOTE_ADDED', 'ADMIN_NOTE_ADDED'].includes(activity.activity_type);
    }
    if (filter === 'evidences') {
      return ['EVIDENCE_ADDED', 'EVIDENCE_DELETED', 'SIGNATURE_ADDED'].includes(activity.activity_type);
    }
    return true;
  }

  const filteredActivities = activities.filter(shouldShowActivity);

  // Group filtered activities by date
  const groupedActivities = useMemo(
    () => groupByDate(filteredActivities),
    [filteredActivities]
  );

  // Apply visible count limit
  let visibleActivitiesCount = 0;
  const visibleGroups = groupedActivities.map((group) => {
    const remainingSlots = visibleCount - visibleActivitiesCount;
    if (remainingSlots <= 0) {
      return { ...group, items: [] };
    }

    const visibleItems = group.items.slice(0, remainingSlots);
    visibleActivitiesCount += visibleItems.length;

    return { ...group, items: visibleItems };
  }).filter(group => group.items.length > 0);

  const hasMore = filteredActivities.length > visibleCount;
  const remainingCount = filteredActivities.length - visibleCount;

  // Calculate summary stats
  const stats = useMemo(() => {
    const evidenceCount = activities.filter(a => a.activity_type === 'EVIDENCE_ADDED').length;
    const noteCount = activities.filter(a =>
      a.activity_type === 'TECHNICIAN_NOTE_ADDED' || a.activity_type === 'ADMIN_NOTE_ADDED'
    ).length;
    const signatureCount = activities.filter(a => a.activity_type === 'SIGNATURE_ADDED').length;

    return { evidenceCount, noteCount, signatureCount };
  }, [activities]);

  const toggleExpanded = (activityId: string) => {
    setExpandedActivities(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  };

  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + 10, filteredActivities.length));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
          {/* Skeleton loader */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
                <div className="h-3 bg-gray-200 rounded w-1/4 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (filteredActivities.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Bitácora del ticket</h2>
        </div>
        <div className="text-center py-8 text-gray-500">
          {filter === 'all'
            ? 'Este ticket aún no tiene actividad.'
            : filter === 'evidences'
            ? 'No hay evidencias registradas.'
            : filter === 'notes'
            ? 'No hay observaciones registradas.'
            : 'No hay eventos de este tipo.'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Bitácora del ticket</h2>
            <span className="text-sm text-gray-500">{totalCount} {totalCount === 1 ? 'actividad' : 'actividades'}</span>
          </div>

          {/* Optional summary */}
          {filter === 'all' && (stats.evidenceCount > 0 || stats.noteCount > 0 || stats.signatureCount > 0) && (
            <div className="flex gap-3 mt-2 text-xs text-gray-600">
              {stats.evidenceCount > 0 && <span>📷 {stats.evidenceCount}</span>}
              {stats.noteCount > 0 && <span>📝 {stats.noteCount}</span>}
              {stats.signatureCount > 0 && <span>✍️ {stats.signatureCount}</span>}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('status')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              filter === 'status'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Estados
          </button>
          <button
            onClick={() => setFilter('notes')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              filter === 'notes'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Notas
          </button>
          <button
            onClick={() => setFilter('evidences')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              filter === 'evidences'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Evidencias
          </button>
        </div>
      </div>

      {/* Timeline grouped by date */}
      <div className="space-y-6">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            {/* Date header */}
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {group.label}
              </h3>
            </div>

            {/* Activities in this date group */}
            <div className="space-y-3">
              {group.items.map((activity, activityIndex) => {
                const isExpanded = expandedActivities.has(activity.id);
                const hasLongNote = activity.note && isLongText(activity.note);
                const shouldTruncate = hasLongNote && !isExpanded;

                return (
                  <div key={activity.id} className="flex gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div
                        className={`w-7 h-7 rounded-full ${getActivityColor(
                          activity.activity_type
                        )} flex items-center justify-center text-white text-xs`}
                      >
                        {getActivityIcon(activity.activity_type)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title and timestamp */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {getActivityTitle(activity)}
                        </p>
                      </div>

                      {/* Author and time */}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {activity.actor?.full_name || 'Sistema'} ·{' '}
                        {new Date(activity.created_at).toLocaleTimeString('es-MX', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </p>

                      {/* Note/Detail */}
                      {activity.note && (
                        <div className="mt-2">
                          <div className="text-sm text-gray-700 bg-gray-50 rounded px-3 py-2 border border-gray-100">
                            <p className="whitespace-pre-wrap">
                              {shouldTruncate ? truncateText(activity.note, 150) : activity.note}
                            </p>
                            {hasLongNote && (
                              <button
                                onClick={() => toggleExpanded(activity.id)}
                                className="text-xs text-blue-600 hover:text-blue-700 mt-1 font-medium"
                              >
                                {isExpanded ? 'Ver menos' : 'Ver más'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Evidence thumbnail */}
                      {activity.activity_type === 'EVIDENCE_ADDED' && (
                        <div className="mt-2">
                          {activity.evidence_id && activity.evidence ? (
                            <EvidencePreview
                              evidenceId={activity.evidence_id}
                              fileUrl={activity.evidence.file_url}
                            />
                          ) : (
                            <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 border border-gray-200">
                              Archivo no disponible
                            </div>
                          )}
                        </div>
                      )}

                      {/* Signature preview */}
                      {activity.activity_type === 'SIGNATURE_ADDED' && (
                        <div className="mt-2">
                          {activity.signature_id && activity.signature ? (
                            <SignaturePreview
                              signatureId={activity.signature_id}
                              signatureUrl={activity.signature.signature_url}
                            />
                          ) : (
                            <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 border border-gray-200">
                              Firma no disponible
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={loadMore}
            className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium py-2 hover:bg-blue-50 rounded-md transition"
          >
            Ver {remainingCount} {remainingCount === 1 ? 'actividad anterior' : 'actividades anteriores'}
          </button>
        </div>
      )}
    </div>
  );
}
