'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
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

interface TicketWithRelations extends Ticket {
  client: Client;
  technician: (Technician & { profile: Profile }) | null;
}

type StatusFilter = 'all' | TicketStatus;
type SlaFilter = 'all' | TicketSlaState;

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('all');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [, setRefreshCounter] = useState(0);

  // Get unique technicians from tickets (deduplicated by ID)
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

    // Auto refresh SLA every 60 seconds
    const interval = setInterval(() => {
      setRefreshCounter(c => c + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchQuery, statusFilter, slaFilter, technicianFilter]);

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

    // Status filter
    if (statusFilter !== 'all') {
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

      // Within same priority, older first
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    setFilteredTickets(filtered);
  }

  function getSlaColor(slaState: TicketSlaState): string {
    switch (slaState) {
      case TicketSlaState.GREEN:
        return 'bg-green-100 text-green-800';
      case TicketSlaState.YELLOW:
        return 'bg-yellow-100 text-yellow-800';
      case TicketSlaState.RED:
      case TicketSlaState.OVERDUE:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusColor(status: TicketStatus): string {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-100 text-gray-800';
      case 'ASSIGNED':
        return 'bg-blue-100 text-blue-800';
      case 'IN_REVIEW':
        return 'bg-purple-100 text-purple-800';
      case 'PAUSED':
        return 'bg-orange-100 text-orange-800';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      <ProtectedLayout>
        <div className="text-center py-12">Cargando...</div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Tickets</h1>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Buscar por folio, cliente, falla o técnico..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-md"
          />
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Nuevo ticket
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">Todos los estados</option>
            <option value="PENDING">Pendiente</option>
            <option value="ASSIGNED">Asignado</option>
            <option value="IN_REVIEW">En revisión</option>
            <option value="PAUSED">Pausado</option>
            <option value="RESOLVED">Resuelto</option>
            <option value="CANCELLED">Cancelado</option>
          </select>

          <select
            value={slaFilter}
            onChange={e => setSlaFilter(e.target.value as SlaFilter)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">Todos los SLA</option>
            <option value={TicketSlaState.GREEN}>Verde (0-24h)</option>
            <option value={TicketSlaState.YELLOW}>Amarillo (24-48h)</option>
            <option value={TicketSlaState.RED}>Rojo (48-72h)</option>
            <option value={TicketSlaState.OVERDUE}>Vencido (+72h)</option>
          </select>

          <select
            value={technicianFilter}
            onChange={e => setTechnicianFilter(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">Todos los técnicos</option>
            <option value="unassigned">Sin asignar</option>
            {uniqueTechnicians.map(tech => (
              <option key={tech.id} value={tech.id}>
                {tech.profile?.full_name || 'Sin nombre'}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-gray-600">
          Mostrando {filteredTickets.length} de {tickets.length} tickets
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">{error}</div>
      )}

      {filteredTickets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No se encontraron tickets</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Folio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Falla
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Técnico
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  SLA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Antigüedad
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTickets.map(ticket => {
                const slaState = getTicketSlaState(ticket.created_at);
                return (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                      {formatTicketFolio(ticket.folio)}
                    </td>
                    <td className="px-6 py-4">{ticket.client?.name || '-'}</td>
                    <td className="px-6 py-4">{ticket.failure_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {ticket.technician?.profile?.full_name || (
                        <span className="text-gray-400">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(ticket.status)}`}>
                        {getStatusLabel(ticket.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs ${getSlaColor(slaState)}`}>
                        {getTicketSlaLabel(slaState)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatTicketAge(ticket.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => router.push(`/tickets/${ticket.id}`)}
                        className="text-blue-600 hover:text-blue-900"
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

  // Prepare client options
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

  // Prepare technician options
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
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>
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
          <label className="block text-sm font-medium mb-1">
            Tipo de falla <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={formData.failure_type}
            onChange={e => setFormData({ ...formData, failure_type: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Observaciones iniciales
          </label>
          <textarea
            value={formData.admin_notes}
            onChange={e => setFormData({ ...formData, admin_notes: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
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

        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {submitting ? 'Creando...' : 'Crear ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
