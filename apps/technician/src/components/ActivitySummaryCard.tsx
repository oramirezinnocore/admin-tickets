import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  getActivitySummary,
  subscribeToActivity,
  type ActivitySummary,
} from '../services/ticket-activity';

interface ActivitySummaryCardProps {
  ticketId: string;
  onPressViewAll: () => void;
}

export default function ActivitySummaryCard({ ticketId, onPressViewAll }: ActivitySummaryCardProps) {
  const [summary, setSummary] = useState<ActivitySummary>({
    lastActivity: null,
    lastNote: null,
    pauseCount: 0,
    evidenceCount: 0,
    hasStarted: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();

    // Subscribe to realtime updates (unique channel for summary card)
    const unsubscribe = subscribeToActivity(
      ticketId,
      () => {
        loadSummary();
      },
      'summary'
    );

    return () => {
      unsubscribe();
    };
  }, [ticketId]);

  async function loadSummary() {
    try {
      setLoading(true);
      const data = await getActivitySummary(ticketId);
      setSummary(data);
    } catch (error) {
      console.error('[ActivitySummaryCard] Error loading summary:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `Hace ${hours}h`;
    }

    const today = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today) {
      return `Hoy · ${date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Ayer · ${date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
    }

    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function truncateText(text: string, maxLength: number = 80): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  if (loading) {
    return null; // Don't show card while loading
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPressViewAll}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🕘</Text>
          <Text style={styles.headerTitle}>Actividad</Text>
        </View>
        <Text style={styles.viewAllButton}>Ver todo ›</Text>
      </View>

      {/* Last Note */}
      {summary.lastNote ? (
        <View style={styles.lastNoteContainer}>
          <Text style={styles.lastNoteLabel}>💬 Última observación</Text>
          <Text style={styles.lastNoteText} numberOfLines={3}>
            {truncateText(summary.lastNote.note || '', 120)}
          </Text>
          <Text style={styles.lastNoteTime}>{formatTime(summary.lastNote.created_at)}</Text>
        </View>
      ) : (
        <View style={styles.emptyNoteContainer}>
          <Text style={styles.emptyNoteText}>No hay observaciones todavía</Text>
        </View>
      )}

      {/* Visual Indicators */}
      <View style={styles.indicators}>
        {summary.hasStarted && (
          <View style={styles.indicator}>
            <Text style={styles.indicatorIcon}>▶️</Text>
            <Text style={styles.indicatorText}>Iniciado</Text>
          </View>
        )}

        {summary.pauseCount > 0 && (
          <View style={styles.indicator}>
            <Text style={styles.indicatorIcon}>⏸</Text>
            <Text style={styles.indicatorText}>
              {summary.pauseCount} {summary.pauseCount === 1 ? 'pausa' : 'pausas'}
            </Text>
          </View>
        )}

        {summary.evidenceCount > 0 && (
          <View style={styles.indicator}>
            <Text style={styles.indicatorIcon}>📷</Text>
            <Text style={styles.indicatorText}>
              {summary.evidenceCount} {summary.evidenceCount === 1 ? 'evidencia' : 'evidencias'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    padding: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  viewAllButton: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  lastNoteContainer: {
    marginBottom: 12,
  },
  lastNoteLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  lastNoteText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 4,
  },
  lastNoteTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyNoteContainer: {
    paddingVertical: 8,
    marginBottom: 12,
  },
  emptyNoteText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  indicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  indicatorIcon: {
    fontSize: 14,
  },
  indicatorText: {
    fontSize: 13,
    color: '#6b7280',
  },
});
