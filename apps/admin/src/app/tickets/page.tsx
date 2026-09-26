'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import Modal from '@/components/ui/Modal';
import Combobox from '@/components/ui/Combobox';
import type { ComboboxOption } from '@/components/ui/Combobox';
import { supabase } from '@/lib/supabase';
import {
  Ticket,
  Client,
  Technician,
  Profile,
  TicketStatus,
  TicketSlaState,
  getTicketSlaState,
  getTicketSlaLabel,
  formatTicketAge,
  formatTicketFolio,
  getSlaOrderPriority,
} from '@wisper/shared';
import { Search, Plus, Ticket as TicketIcon, Filter, X } from 'lucide-react';

interface TicketWithRelations extends Ticket {
  client: Client;
  technician: (Technician & { profile: Profile }) | null;
}

type StatusFilter = 'all' | TicketStatus;
type SlaFilter = 'all' | TicketSlaState;

function TicketsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [statusMultiFilter, setStatusMultiFilter] = useState<TicketStatus[]>([]);
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('all');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'resolved-today' | 'month' | 'year'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [error, setError] = useState('');
  const [, setRefreshCounter] = useState(0);

  // Get unique technicians from tickets
  const uniqueTechnicians = useMemo(() => {
    const techMap = new Map<string, Technician & { profile: Profile }>();
    tickets.forEach(ticket => {
      if (ticket.technician) {
        techMap.set(ticket.technician.id, ticket.technician);
      }
    });
    return Array.from(techMap.values());
  }, [tickets]);

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    // Apply query params
    const statusParam = searchParams.get('status');
    const slaParam = searchParams.get('sla');
    const filterParam = searchParams.get('filter');
    const periodParam = searchParams.get('period');

    if (statusParam) {
      const statuses = statusParam.split(',').map(s => s.trim()) as TicketStatus[];
      if (statuses.length === 1) {
        setStatusFilter(statuses[0] as StatusFilter);
        setStatusMultiFilter([]);
      } else {
        setStatusFilter('all');
        setStatusMultiFilter(statuses);
      }
    } else {
      setStatusFilter('all');
      setStatusMultiFilter([]);
    }

    if (slaParam) {
      const slaMap: Record<string, TicketSlaState> = {
        'green': TicketSlaState.GREEN,
        'yellow': TicketSlaState.YELLOW,
        'red': TicketSlaState.RED,
        'overdue': TicketSlaState.OVERDUE,
      };
      setSlaFilter(slaMap[slaParam.toLowerCase()] || 'all');
    } else {
      setSlaFilter('all');
    }

    if (filterParam === 'today') {
      setDateFilter('today');
    } else if (periodParam === 'today') {
      setDateFilter('resolved-today');
    } else if (periodParam === 'month') {
      setDateFilter('month');
    } else if (periodParam === 'year') {
      setDateFilter('year');
    } else {
      setDateFilter('all');
    }
  }, [searchParams]);

  useEffect(() => {
    // Auto refresh SLA every 60 seconds
    const interval = setInterval(() => {
      setRefreshCounter(c => c + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchQuery, statusFilter, statusMultiFilter, slaFilter, technicianFilter, dateFilter]);

  async function loadTickets() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          client:clients(*),
          technician:technicians(
            *,
            profile:profiles(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data as any) || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function filterTickets() {
    let filtered = tickets;

    // Date filter
    if (dateFilter === 'today') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(t => new Date(t.created_at) >= today);
    } else if (dateFilter === 'resolved-today') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(t => {
        const closedAt = t.closed_at ? new Date(t.closed_at) : null;
        return closedAt && closedAt >= today;
      });
    } else if (dateFilter === 'month') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter(t => {
        const closedAt = t.closed_at ? new Date(t.closed_at) : null;
        return closedAt && closedAt >= monthStart;
      });
    } else if (dateFilter === 'year') {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      filtered = filtered.filter(t => {
        const closedAt = t.closed_at ? new Date(t.closed_at) : null;
        return closedAt && closedAt >= yearStart;
      });
    }

    // Status filter
    if (statusMultiFilter.length > 0) {
      filtered = filtered.filter(t => statusMultiFilter.includes(t.status));
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    // SLA filter
    if (slaFilter !== 'all') {
      filtered = filtered.filter(t => getTicketSlaState(t.created_at) === slaFilter);
    }

    // Technician filter
    if (technicianFilter !== 'all') {
      if (technicianFilter === 'unassigned') {
        filtered = filtered.filter(t => !t.technician_id);
      } else {
        filtered = filtered.filter(t => t.technician_id === technicianFilter);
      }
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        t =>
          t.folio.toString().includes(query) ||
          t.client?.name.toLowerCase().includes(query) ||
          t.failure_type.toLowerCase().includes(query) ||
          t.technician?.profile?.full_name.toLowerCase().includes(query)
      );
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

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    setFilteredTickets(filtered);
  }

  function getStatusVariant(status: TicketStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' {
    switch (status) {
      case 'PENDING':
        return 'default';
      case 'ASSIGNED':
        return 'primary';
      case 'IN_REVIEW':
        return 'info';
      case 'PAUSED':
        return 'warning';
      case 'RESOLVED':
        return 'success';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'default';
    }
  }

  function getSlaVariant(slaState: TicketSlaState): 'success' | 'warning' | 'danger' {
    switch (slaState) {
      case TicketSlaState.GREEN:
        return 'success';
      case TicketSlaState.YELLOW:
        return 'warning';
      case TicketSlaState.RED:
      case TicketSlaState.OVERDUE:
        return 'danger';
      default:
        return 'success';
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

  const hasActiveFilters = statusFilter !== 'all' || slaFilter !== 'all' || technicianFilter !== 'all' || dateFilter !== 'all';

  function clearFilters() {
    setStatusFilter('all');
    setStatusMultiFilter([]);
    setSlaFilter('all');
    setTechnicianFilter('all');
    setDateFilter('all');
    setSearchQuery('');
  }

  if (loading) {
    return (
      <ProtectedLayout>
        <PageHeader title="Tickets" description="Gestión de tickets de soporte" />
        <LoadingSkeleton variant="table" rows={10} />
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <PageHeader
        title="Tickets"
        description="Gestión de tickets de soporte"
        stats={[
          { label: 'tickets', value: filteredTickets.length }
        ]}
        actions={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--wisper-blue)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--wisper-blue-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--wisper-blue)'}
          >
            <Plus className="h-4 w-4" />
            Nuevo ticket
          </button>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Search & Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por folio, cliente, falla o técnico..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ '--tw-ring-color': 'var(--wisper-blue)' } as any}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
              showFilters ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {[statusFilter !== 'all', slaFilter !== 'all', technicianFilter !== 'all', dateFilter !== 'all'].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': 'var(--wisper-blue)' } as any}
                >
                  <option value="all">Todos</option>
                  <option value="PENDING">Pendiente</option>
                  <option value="ASSIGNED">Asignado</option>
                  <option value="IN_REVIEW">En revisión</option>
                  <option value="PAUSED">Pausado</option>
                  <option value="RESOLVED">Resuelto</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SLA</label>
                <select
                  value={slaFilter}
                  onChange={e => setSlaFilter(e.target.value as SlaFilter)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': 'var(--wisper-blue)' } as any}
                >
                  <option value="all">Todos</option>
                  <option value={TicketSlaState.GREEN}>Verde (0-24h)</option>
                  <option value={TicketSlaState.YELLOW}>Amarillo (24-48h)</option>
                  <option value={TicketSlaState.RED}>Rojo (48-72h)</option>
                  <option value={TicketSlaState.OVERDUE}>Vencido (+72h)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Técnico</label>
                <select
                  value={technicianFilter}
                  onChange={e => setTechnicianFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': 'var(--wisper-blue)' } as any}
                >
                  <option value="all">Todos</option>
                  <option value="unassigned">Sin asignar</option>
                  {uniqueTechnicians.map(tech => (
                    <option key={tech.id} value={tech.id}>
                      {tech.profile?.full_name || 'Sin nombre'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                <select
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': 'var(--wisper-blue)' } as any}
                >
                  <option value="all">Todos</option>
                  <option value="today">Hoy</option>
                  <option value="resolved-today">Resueltos hoy</option>
                  <option value="month">Este mes</option>
                  <option value="year">Este año</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {filteredTickets.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title="No se encontraron tickets"
          description="Intenta ajustar los filtros o crear un nuevo ticket"
          action={{
            label: 'Nuevo ticket',
            onClick: () => setIsCreateModalOpen(true)
          }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Folio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Falla
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Técnico
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SLA
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Antigüedad
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredTickets.map(ticket => {
                  const slaState = getTicketSlaState(ticket.created_at);
                  return (
                    <tr
                      key={ticket.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          {formatTicketFolio(ticket.folio)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">{ticket.client?.name || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{ticket.failure_type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {ticket.technician?.profile?.full_name ? (
                          <span className="text-sm text-gray-900">{ticket.technician.profile.full_name}</span>
                        ) : (
                          <span className="text-sm text-gray-400">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge
                          status={getStatusLabel(ticket.status)}
                          variant={getStatusVariant(ticket.status)}
                          size="sm"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge
                          status={getTicketSlaLabel(slaState)}
                          variant={getSlaVariant(slaState)}
                          size="sm"
                          dot
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatTicketAge(ticket.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/tickets/${ticket.id}`);
                          }}
                          className="font-medium hover:underline"
                          style={{ color: 'var(--wisper-blue)' }}
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateTicketModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          loadTickets();
        }}
      />
    </ProtectedLayout>
  );
}

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateTicketModal({ isOpen, onClose, onSuccess }: CreateTicketModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [technicians, setTechnicians] = useState<(Technician & { profile: Profile })[]>([]);
  const [formData, setFormData] = useState({
    client_id: '',
    failure_type: '',
    admin_notes: '',
    technician_id: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadClients();
      loadTechnicians();
      setFormData({
        client_id: '',
        failure_type: '',
        admin_notes: '',
        technician_id: '',
      });
      setError('');
    }
  }, [isOpen]);

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('is_active', true)
      .order('name');
    setClients(data || []);
  }

  async function loadTechnicians() {
    const { data } = await supabase
      .from('technicians')
      .select('*, profile:profiles(*)')
      .eq('is_active', true)
      .order('created_at');
    setTechnicians((data as any) || []);
  }

  const clientOptions: ComboboxOption[] = useMemo(
    () =>
      clients.map(client => ({
        value: client.id,
        label: client.name,
        searchText: `${client.name} ${client.phone || ''} ${client.address || ''}`,
        secondaryText: [client.phone, client.address].filter(Boolean).join(' · '),
      })),
    [clients]
  );

  const technicianOptions: ComboboxOption[] = useMemo(() => {
    const opts: ComboboxOption[] = [
      {
        value: '',
        label: 'Sin asignar',
        secondaryText: 'El ticket quedará pendiente',
      },
    ];

    technicians.forEach(tech => {
      opts.push({
        value: tech.id,
        label: tech.profile?.full_name || 'Sin nombre',
        searchText: `${tech.profile?.full_name || ''} ${tech.profile?.email || ''} ${tech.zone || ''}`,
        secondaryText: [tech.zone, tech.profile?.email].filter(Boolean).join(' · '),
      });
    });

    return opts;
  }, [technicians]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!formData.client_id || !formData.failure_type.trim()) {
      setError('Cliente y tipo de falla son obligatorios');
      return;
    }

    setSubmitting(true);

    try {
      const payload: any = {
        client_id: formData.client_id,
        failure_type: formData.failure_type.trim(),
        admin_notes: formData.admin_notes.trim() || null,
        status: 'PENDING',
      };

      const { data: newTicket, error: insertError } = await supabase
        .from('tickets')
        .insert(payload)
        .select('id')
        .single();

      if (insertError) throw insertError;
      if (!newTicket) throw new Error('No se pudo crear el ticket');

      // If technician was selected, assign it and send push notification
      if (formData.technician_id) {
        const response = await fetch(`/api/tickets/${newTicket.id}/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            technicianId: formData.technician_id,
          }),
        });

        if (!response.ok) {
          console.warn('Error sending push notification, but ticket was created');
        }
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuevo ticket">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>
        )}

        <Combobox
          label="Cliente"
          required
          placeholder="Seleccionar cliente"
          searchPlaceholder="Buscar por nombre, teléfono o dirección..."
          value={formData.client_id}
          options={clientOptions}
          onChange={value => setFormData({ ...formData, client_id: value })}
          emptyMessage="No se encontraron clientes"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de falla <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={formData.failure_type}
            onChange={e => setFormData({ ...formData, failure_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
            style={{ '--tw-ring-color': 'var(--wisper-blue)' } as any}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observaciones iniciales
          </label>
          <textarea
            value={formData.admin_notes}
            onChange={e => setFormData({ ...formData, admin_notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
            style={{ '--tw-ring-color': 'var(--wisper-blue)' } as any}
            rows={3}
          />
        </div>

        <Combobox
          label="Técnico (opcional)"
          placeholder="Sin asignar"
          searchPlaceholder="Buscar por nombre, correo o zona..."
          value={formData.technician_id}
          options={technicianOptions}
          onChange={value => setFormData({ ...formData, technician_id: value })}
          emptyMessage="No se encontraron técnicos"
        />

        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--wisper-blue)' }}
            onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = 'var(--wisper-blue-hover)')}
            onMouseLeave={(e) => !submitting && (e.currentTarget.style.backgroundColor = 'var(--wisper-blue)')}
          >
            {submitting ? 'Creando...' : 'Crear ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={
      <ProtectedLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Cargando tickets...</div>
        </div>
      </ProtectedLayout>
    }>
      <TicketsPageContent />
    </Suspense>
  );
}
