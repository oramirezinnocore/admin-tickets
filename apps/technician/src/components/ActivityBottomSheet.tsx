import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  getActivityTimeline,
  subscribeToActivity,
  groupActivitiesByDate,
  type TicketActivity,
  type ActivityType,
} from '../services/ticket-activity';

interface ActivityBottomSheetProps {
  visible: boolean;
  ticketId: string;
  onClose: () => void;
}

type FilterType = 'all' | 'notes' | 'evidences' | 'status';

export default function ActivityBottomSheet({
  visible,
  ticketId,
  onClose,
}: ActivityBottomSheetProps) {
  const [activities, setActivities] = useState<TicketActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (visible) {
      loadActivities();

      // Subscribe to realtime updates (unique channel for bottom sheet)
      const unsubscribe = subscribeToActivity(
        ticketId,
        () => {
          loadActivities();
        },
        'sheet'
      );

      return () => {
        unsubscribe();
      };
    }
  }, [visible, ticketId]);

  async function loadActivities() {
    try {
      setLoading(true);
      const data = await getActivityTimeline(ticketId);
      setActivities(data);
    } catch (error) {
      console.error('[ActivityBottomSheet] Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  }

  function shouldShowActivity(activity: TicketActivity): boolean {
    if (filter === 'all') return true;

    if (filter === 'notes') {
      return ['TECHNICIAN_NOTE_ADDED', 'ADMIN_NOTE_ADDED'].includes(activity.activity_type);
    }

    if (filter === 'evidences') {
      return ['EVIDENCE_ADDED', 'EVIDENCE_DELETED', 'SIGNATURE_ADDED'].includes(
        activity.activity_type
      );
    }

    if (filter === 'status') {
      return [
        'STATUS_CHANGED',
        'PAUSED',
        'RESUMED',
        'WORK_STARTED',
        'CLOSED',
        'CANCELLED',
      ].includes(activity.activity_type);
    }

    return true;
  }

  function getActivityIcon(type: ActivityType): string {
    switch (type) {
      case 'TICKET_CREATED':
        return '📝';
      case 'TECHNICIAN_ASSIGNED':
      case 'TECHNICIAN_REASSIGNED':
        return '👤';
      case 'WORK_STARTED':
        return '▶️';
      case 'PAUSED':
        return '⏸';
      case 'RESUMED':
        return '▶️';
      case 'TECHNICIAN_NOTE_ADDED':
      case 'ADMIN_NOTE_ADDED':
        return '💬';
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
        return 'Asignado';
      case 'WORK_STARTED':
        return 'Trabajo iniciado';
      case 'PAUSED':
        return 'Trabajo pausado';
      case 'RESUMED':
        return 'Trabajo reanudado';
      case 'TECHNICIAN_NOTE_ADDED':
        return 'Observación';
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

  function formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  const filteredActivities = activities.filter(shouldShowActivity);
  const groupedActivities = groupActivitiesByDate(filteredActivities);
  const dateGroups = Object.keys(groupedActivities);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Actividad del ticket</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
                Todo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filter === 'notes' && styles.filterChipActive]}
              onPress={() => setFilter('notes')}
            >
              <Text
                style={[styles.filterChipText, filter === 'notes' && styles.filterChipTextActive]}
              >
                Notas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filter === 'evidences' && styles.filterChipActive]}
              onPress={() => setFilter('evidences')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === 'evidences' && styles.filterChipTextActive,
                ]}
              >
                Evidencias
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filter === 'status' && styles.filterChipActive]}
              onPress={() => setFilter('status')}
            >
              <Text
                style={[styles.filterChipText, filter === 'status' && styles.filterChipTextActive]}
              >
                Estados
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Timeline */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : filteredActivities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Sin actividad registrada</Text>
          </View>
        ) : (
          <ScrollView style={styles.timeline} showsVerticalScrollIndicator={false}>
            {dateGroups.map((dateGroup, groupIndex) => (
              <View key={dateGroup}>
                {/* Date Header */}
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>{dateGroup}</Text>
                </View>

                {/* Activities in this date group */}
                {groupedActivities[dateGroup].map((activity, activityIndex) => {
                  const isLast =
                    groupIndex === dateGroups.length - 1 &&
                    activityIndex === groupedActivities[dateGroup].length - 1;

                  return (
                    <View key={activity.id} style={styles.activityItem}>
                      {/* Timeline */}
                      <View style={styles.timelineColumn}>
                        <View style={styles.timelineDot}>
                          <Text style={styles.timelineDotIcon}>{getActivityIcon(activity.activity_type)}</Text>
                        </View>
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>

                      {/* Content */}
                      <View style={styles.activityContent}>
                        <View style={styles.activityHeader}>
                          <Text style={styles.activityTitle}>{getActivityTitle(activity)}</Text>
                          <Text style={styles.activityTime}>{formatTime(activity.created_at)}</Text>
                        </View>

                        {activity.note && (
                          <View style={styles.activityNoteContainer}>
                            <Text style={styles.activityNoteText}>{activity.note}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}

            <View style={styles.bottomPadding} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6b7280',
  },
  filters: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
  },
  timeline: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  dateHeader: {
    paddingVertical: 12,
  },
  dateHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  activityItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineColumn: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotIcon: {
    fontSize: 16,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
  },
  activityContent: {
    flex: 1,
    paddingBottom: 4,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  activityTime: {
    fontSize: 13,
    color: '#9ca3af',
    marginLeft: 8,
  },
  activityNoteContainer: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
  },
  activityNoteText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 32,
  },
});
