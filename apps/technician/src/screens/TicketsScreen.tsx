import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/auth-context';
import { supabase } from '../services/supabase';
import {
  Ticket,
  Client,
  TicketStatus,
  getTicketSlaState,
  getTicketSlaLabel,
  formatTicketAge,
  formatTicketFolio,
  getSlaOrderPriority,
  TicketSlaState,
} from '@wisper/shared';

interface TicketWithClient extends Ticket {
  client: Client;
}

type FilterType = 'pending' | 'in_review' | 'paused' | 'all';

export default function TicketsScreen() {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<TicketWithClient[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('pending');
  const [technician, setTechnician] = useState<any>(null);

  useEffect(() => {
    loadTickets();
  }, [profile]);

  useEffect(() => {
    filterTickets();
  }, [tickets, filter]);

  async function loadTickets() {
    if (!profile) return;

    try {
      // Get technician record
      const { data: techData } = await supabase
        .from('technicians')
        .select('*')
        .eq('profile_id', profile.id)
        .single();

      setTechnician(techData);

      if (!techData) return;

      // Get assigned tickets with client data
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          client:clients(*)
        `)
        .eq('technician_id', techData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data as any) || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function filterTickets() {
    let filtered = tickets;

    switch (filter) {
      case 'pending':
        filtered = tickets.filter(
          t => t.status !== 'RESOLVED' && t.status !== 'CANCELLED'
        );
        break;
      case 'in_review':
        filtered = tickets.filter(t => t.status === 'IN_REVIEW');
        break;
      case 'paused':
        filtered = tickets.filter(t => t.status === 'PAUSED');
        break;
      case 'all':
        break;
    }

    // Sort by SLA priority
    filtered.sort((a, b) => {
      const slaA = getTicketSlaState(a.created_at);
      const slaB = getTicketSlaState(b.created_at);
      const priorityA = getSlaOrderPriority(slaA);
      const priorityB = getSlaOrderPriority(slaB);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Within same priority, older first
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    setFilteredTickets(filtered);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadTickets();
  }

  function getSlaColor(slaState: TicketSlaState): string {
    switch (slaState) {
      case TicketSlaState.GREEN:
        return '#10B981';
      case TicketSlaState.YELLOW:
        return '#F59E0B';
      case TicketSlaState.RED:
      case TicketSlaState.OVERDUE:
        return '#DC2626';
      default:
        return '#6B7280';
    }
  }

  function getStatusColor(status: TicketStatus): string {
    switch (status) {
      case 'PENDING':
      case 'ASSIGNED':
        return '#3B82F6';
      case 'IN_REVIEW':
        return '#8B5CF6';
      case 'PAUSED':
        return '#F59E0B';
      case 'RESOLVED':
        return '#10B981';
      case 'CANCELLED':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  }

  function getStatusLabel(status: TicketStatus): string {
    const labels: Record<TicketStatus, string> = {
      PENDING: 'Pendiente',
      ASSIGNED: 'Asignado',
      IN_REVIEW: 'En revisión',
      PAUSED: 'Pausado',
      RESOLVED: 'Resuelto',
      CANCELLED: 'Cancelado',
    };
    return labels[status] || status;
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filtersContainer}>
        {(['pending', 'in_review', 'paused', 'all'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[styles.filterText, filter === f && styles.filterTextActive]}
            >
              {f === 'pending' && 'Pendientes'}
              {f === 'in_review' && 'En revisión'}
              {f === 'paused' && 'Pausados'}
              {f === 'all' && 'Todos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredTickets}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        renderItem={({ item: ticket }) => {
          const slaState = getTicketSlaState(ticket.created_at);
          return (
            <TouchableOpacity
              style={styles.ticketCard}
              onPress={() =>
                (navigation as any).navigate('TicketDetail', { ticketId: ticket.id })
              }
            >
              <View style={styles.ticketHeader}>
                <Text style={styles.folio}>{formatTicketFolio(ticket.folio)}</Text>
                <View
                  style={[styles.slaBadge, { backgroundColor: getSlaColor(slaState) }]}
                >
                  <Text style={styles.slaBadgeText}>
                    {getTicketSlaLabel(slaState)}
                  </Text>
                </View>
              </View>

              <Text style={styles.clientName}>{ticket.client?.name}</Text>
              <Text style={styles.failureType}>{ticket.failure_type}</Text>
              <Text style={styles.address} numberOfLines={1}>
                {ticket.client?.address}
              </Text>

              <View style={styles.ticketFooter}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(ticket.status) },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {getStatusLabel(ticket.status)}
                  </Text>
                </View>
                <Text style={styles.age}>{formatTicketAge(ticket.created_at)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay tickets</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    color: '#6b7280',
  },
  filterTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  ticketCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  folio: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    fontFamily: 'monospace',
  },
  slaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  slaBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  failureType: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  age: {
    fontSize: 13,
    color: '#6b7280',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
});
