import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/auth-context';
import { useTicketRealtime } from '../services/ticket-realtime-provider';
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

type PrimaryFilterType = 'pending' | 'in_review' | 'paused';

interface AdvancedFilters {
  status: TicketStatus | 'ALL';
  sla: TicketSlaState | 'ALL';
}

export default function TicketsScreen() {
  const navigation = useNavigation();
  const { profile, technicianId } = useAuth();
  const { refreshVersion } = useTicketRealtime();
  const [tickets, setTickets] = useState<TicketWithClient[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [primaryFilter, setPrimaryFilter] = useState<PrimaryFilterType>('pending');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    status: 'ALL',
    sla: 'ALL',
  });
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [technician, setTechnician] = useState<any>(null);

  useEffect(() => {
    loadTickets();
  }, [profile]);

  // Refresh tickets when Realtime detects changes
  useEffect(() => {
    if (refreshVersion > 0) {
      console.log('[TicketsScreen] Realtime refresh triggered, version:', refreshVersion);
      loadTickets();
    }
  }, [refreshVersion]);

  useEffect(() => {
    filterTickets();
  }, [tickets, primaryFilter, advancedFilters]);

  const loadTickets = useCallback(async () => {
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
  }, [profile]);

  function filterTickets() {
    let filtered = tickets;

    // Apply primary filter
    switch (primaryFilter) {
      case 'pending':
        filtered = filtered.filter(
          t => t.status !== 'RESOLVED' && t.status !== 'CANCELLED'
        );
        break;
      case 'in_review':
        filtered = filtered.filter(t => t.status === 'IN_REVIEW');
        break;
      case 'paused':
        filtered = filtered.filter(t => t.status === 'PAUSED');
        break;
    }

    // Apply advanced status filter
    if (advancedFilters.status !== 'ALL') {
      filtered = filtered.filter(t => t.status === advancedFilters.status);
    }

    // Apply advanced SLA filter
    if (advancedFilters.sla !== 'ALL') {
      filtered = filtered.filter(t => {
        const sla = getTicketSlaState(t.created_at);
        return sla === advancedFilters.sla;
      });
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

  function handleApplyAdvancedFilters(filters: AdvancedFilters) {
    setAdvancedFilters(filters);
    setShowFiltersModal(false);
  }

  function handleClearAdvancedFilters() {
    setAdvancedFilters({ status: 'ALL', sla: 'ALL' });
  }

  const hasActiveAdvancedFilters = advancedFilters.status !== 'ALL' || advancedFilters.sla !== 'ALL';

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
      {/* Header with title and filter button */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Tickets</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFiltersModal(true)}
        >
          <Text style={styles.filterButtonText}>
            {hasActiveAdvancedFilters ? '● ' : ''}Filtros
          </Text>
        </TouchableOpacity>
      </View>

      {/* Primary segmented control */}
      <View style={styles.segmentedContainer}>
        {(['pending', 'in_review', 'paused'] as PrimaryFilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[
              styles.segmentButton,
              primaryFilter === f && styles.segmentButtonActive,
            ]}
            onPress={() => setPrimaryFilter(f)}
          >
            <Text
              style={[
                styles.segmentText,
                primaryFilter === f && styles.segmentTextActive,
              ]}
            >
              {f === 'pending' && 'Pendientes'}
              {f === 'in_review' && 'En revisión'}
              {f === 'paused' && 'Pausados'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Result counter */}
      <View style={styles.counterContainer}>
        <Text style={styles.counterText}>
          {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} encontrado{filteredTickets.length !== 1 ? 's' : ''}
        </Text>
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

      {/* Advanced Filters Modal */}
      <FiltersModal
        visible={showFiltersModal}
        currentFilters={advancedFilters}
        onApply={handleApplyAdvancedFilters}
        onClear={handleClearAdvancedFilters}
        onClose={() => setShowFiltersModal(false)}
      />
    </View>
  );
}

// Advanced Filters Modal Component
function FiltersModal({
  visible,
  currentFilters,
  onApply,
  onClear,
  onClose,
}: {
  visible: boolean;
  currentFilters: AdvancedFilters;
  onApply: (filters: AdvancedFilters) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [tempFilters, setTempFilters] = useState<AdvancedFilters>(currentFilters);

  useEffect(() => {
    setTempFilters(currentFilters);
  }, [currentFilters, visible]);

  const statusOptions: { value: TicketStatus | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: TicketStatus.ASSIGNED, label: 'Asignados' },
    { value: TicketStatus.IN_REVIEW, label: 'En revisión' },
    { value: TicketStatus.PAUSED, label: 'Pausados' },
    { value: TicketStatus.RESOLVED, label: 'Resueltos' },
  ];

  const slaOptions: { value: TicketSlaState | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: TicketSlaState.GREEN, label: 'Verde (0-24 h)' },
    { value: TicketSlaState.YELLOW, label: 'Amarillo (24-48 h)' },
    { value: TicketSlaState.RED, label: 'Rojo (48-72 h)' },
    { value: TicketSlaState.OVERDUE, label: 'Vencido (+72 h)' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtros</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Status Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Estado</Text>
              <View style={styles.optionsGrid}>
                {statusOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      tempFilters.status === option.value && styles.optionButtonActive,
                    ]}
                    onPress={() =>
                      setTempFilters({ ...tempFilters, status: option.value })
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        tempFilters.status === option.value && styles.optionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* SLA Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>SLA</Text>
              <View style={styles.optionsGrid}>
                {slaOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      tempFilters.sla === option.value && styles.optionButtonActive,
                    ]}
                    onPress={() =>
                      setTempFilters({ ...tempFilters, sla: option.value })
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        tempFilters.sla === option.value && styles.optionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setTempFilters({ status: 'ALL', sla: 'ALL' });
                onClear();
                onClose();
              }}
            >
              <Text style={styles.clearButtonText}>Limpiar filtros</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => onApply(tempFilters)}
            >
              <Text style={styles.applyButtonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  segmentedContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#007AFF',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  segmentTextActive: {
    color: 'white',
  },
  counterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
  },
  counterText: {
    fontSize: 13,
    color: '#6b7280',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    fontFamily: 'monospace',
  },
  slaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  slaBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  clientName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
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
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
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
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalCloseText: {
    fontSize: 28,
    color: '#6b7280',
    fontWeight: '300',
  },
  modalBody: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  optionsGrid: {
    gap: 8,
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  optionTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
});
