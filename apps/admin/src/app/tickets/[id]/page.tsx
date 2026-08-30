'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Combobox from '@/components/ui/Combobox';
import ClientMapPreview from '@/components/ClientMapPreview';
import type { ComboboxOption } from '@/components/ui/Combobox';
import { supabase } from '@/lib/supabase';
import {
  Ticket,
  Client,
  Technician,
  Profile,
  TicketStatusHistory,
  getTicketSlaState,
  getTicketSlaLabel,
  formatTicketAge,
  formatTicketFolio,
  hasValidCoordinates,
} from '@wisper/shared';
import TicketActivityTimeline from '@/components/TicketActivity';

interface TicketWithRelations extends Ticket {
  client: Client;
  technician: (Technician & { profile: Profile }) | null;
}

interface TechnicianLocation {
  technician_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

type LocationStatus = 'online' | 'recent' | 'stale';

function getLocationStatus(recordedAt: string): LocationStatus {
  const now = new Date();
  const recorded = new Date(recordedAt);
  const diffMinutes = (now.getTime() - recorded.getTime()) / (1000 * 60);

  if (diffMinutes <= 2) return 'online';
  if (diffMinutes <= 10) return 'recent';
  return 'stale';
}

function getLocationStatusLabel(status: LocationStatus): string {
  switch (status) {
    case 'online':
      return 'En línea';
    case 'recent':
      return 'Ubicación reciente';
    case 'stale':
      return 'Sin actualización reciente';
  }
}

function getLocationStatusColor(status: LocationStatus): string {
  switch (status) {
    case 'online':
      return 'bg-green-100 text-green-800';
    case 'recent':
      return 'bg-yellow-100 text-yellow-800';
    case 'stale':
      return 'bg-gray-100 text-gray-800';
  }
}

function formatTimeAgo(recordedAt: string): string {
  const now = new Date();
  const recorded = new Date(recordedAt);
  const diffMinutes = Math.floor((now.getTime() - recorded.getTime()) / (1000 * 60));

  if (diffMinutes < 1) return 'Ahora';
  if (diffMinutes === 1) return 'Hace 1 min';
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return 'Hace 1 hora';
  if (diffHours < 24) return `Hace ${diffHours} horas`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hace 1 día';
  return `Hace ${diffDays} días`;
}

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<TicketWithRelations | null>(null);
  const [history, setHistory] = useState<TicketStatusHistory[]>([]);
  const [techLocation, setTechLocation] = useState<TechnicianLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isUnassignDialogOpen, setIsUnassignDialogOpen] = useState(false);
  const [, setRefreshCounter] = useState(0);

  useEffect(() => {
    loadTicket();
    loadHistory();

    // Auto refresh SLA every 60 seconds
    const interval = setInterval(() => {
      setRefreshCounter(c => c + 1);
      if (ticket?.technician_id) {
        loadTechnicianLocation(ticket.technician_id);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [ticketId]);

  useEffect(() => {
    if (ticket?.technician_id) {
      loadTechnicianLocation(ticket.technician_id);
    }
  }, [ticket?.technician_id]);

  async function loadTicket() {
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
        .eq('id', ticketId)
        .single();

      if (error) throw error;
      setTicket(data as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const { data } = await supabase
        .from('ticket_status_history')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      setHistory(data || []);
    } catch (err: any) {
      console.error('Error loading history:', err);
    }
  }

  async function loadTechnicianLocation(technicianId: string) {
    try {
      const { data } = await supabase
        .from('technician_latest_locations')
        .select('*')
        .eq('technician_id', technicianId)
        .single();

      setTechLocation(data || null);
    } catch (err: any) {
      console.error('Error loading technician location:', err);
    }
  }

  async function handleUnassign() {
    if (!ticket) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          technician_id: null,
          status: 'PENDING',
          assigned_at: null,
        })
        .eq('id', ticket.id);

      if (error) throw error;
      await loadTicket();
      await loadHistory();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  function canUnassign(): boolean {
    if (!ticket) return false;
    return (
      !!ticket.technician_id &&
      ticket.status !== 'RESOLVED' &&
      ticket.status !== 'CANCELLED'
    );
  }

  function canAssign(): boolean {
    if (!ticket) return false;
    return ticket.status !== 'RESOLVED' && ticket.status !== 'CANCELLED';
  }

  function canCancel(): boolean {
    if (!ticket) return false;
    return ticket.status !== 'RESOLVED' && ticket.status !== 'CANCELLED';
  }

  function getSlaColor(slaState: string): string {
    switch (slaState) {
      case 'GREEN':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'YELLOW':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'RED':
      case 'OVERDUE':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getStatusLabel(status: string): string {
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

  function getStatusColor(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'ASSIGNED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'IN_REVIEW':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function openInMaps(lat: number, lng: number) {
    window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`, '_blank');
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ProtectedLayout>
    );
  }

  if (error || !ticket) {
    return (
      <ProtectedLayout>
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
          {error || 'Ticket no encontrado'}
        </div>
      </ProtectedLayout>
    );
  }

  const slaState = getTicketSlaState(ticket.created_at);

  return (
    <ProtectedLayout>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/tickets')}
          className="text-blue-600 hover:text-blue-800 mb-4 text-sm font-medium"
        >
          ← Volver a tickets
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-2xl lg:text-3xl font-bold">{formatTicketFolio(ticket.folio)}</h1>
              <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getSlaColor(slaState)}`}>
                {getTicketSlaLabel(slaState)}
              </span>
              <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                {getStatusLabel(ticket.status)}
              </span>
            </div>
            {ticket.failure_type && (
              <p className="text-sm text-gray-600">{ticket.failure_type}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {canAssign() && (
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition"
              >
                {ticket.technician_id ? 'Reasignar' : 'Asignar'}
              </button>
            )}
            {canUnassign() && (
              <button
                onClick={() => setIsUnassignDialogOpen(true)}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 rounded-md transition"
              >
                Desasignar
              </button>
            )}
            {canCancel() && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bitácora del ticket */}
          <TicketActivityTimeline ticketId={ticketId} />

          {/* Ticket Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Información del ticket</h2>

            {(ticket.admin_notes || ticket.technician_notes || ticket.solution_text || ticket.close_reason) && (
              <div className="space-y-4">
                {ticket.admin_notes && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase mb-1">Observaciones</dt>
                    <dd className="text-sm text-gray-900 whitespace-pre-wrap">{ticket.admin_notes}</dd>
                  </div>
                )}
                {ticket.technician_notes && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase mb-1">Notas del técnico</dt>
                    <dd className="text-sm text-gray-900 whitespace-pre-wrap">{ticket.technician_notes}</dd>
                  </div>
                )}
                {ticket.solution_text && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase mb-1">Solución</dt>
                    <dd className="text-sm text-gray-900 whitespace-pre-wrap">{ticket.solution_text}</dd>
                  </div>
                )}
                {ticket.close_reason && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase mb-1">Razón de cierre</dt>
                    <dd className="text-sm text-gray-900">{ticket.close_reason}</dd>
                  </div>
                )}
              </div>
            )}

            {!ticket.admin_notes && !ticket.technician_notes && !ticket.solution_text && !ticket.close_reason && (
              <p className="text-sm text-gray-500">Sin información adicional</p>
            )}
          </div>

          {/* Cliente */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Cliente</h2>

            <div className="space-y-3">
              <div>
                <p className="font-medium text-gray-900">{ticket.client?.name}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {ticket.client?.phone && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase mb-1">Teléfono</dt>
                    <dd className="text-gray-900">
                      <a href={`tel:${ticket.client.phone}`} className="hover:text-blue-600">
                        {ticket.client.phone}
                      </a>
                    </dd>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-gray-500 uppercase mb-1">Dirección</dt>
                  <dd className="text-gray-900">{ticket.client?.address}</dd>
                </div>
              </div>

              {ticket.client?.reference && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase mb-1">Referencia</dt>
                  <dd className="text-sm text-gray-900">{ticket.client.reference}</dd>
                </div>
              )}

              {hasValidCoordinates(ticket.client?.latitude, ticket.client?.longitude) ? (
                <div className="space-y-2">
                  <ClientMapPreview
                    latitude={ticket.client!.latitude!}
                    longitude={ticket.client!.longitude!}
                    clientName={ticket.client?.name}
                  />
                  <button
                    onClick={() => openInMaps(ticket.client!.latitude!, ticket.client!.longitude!)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Abrir en el mapa →
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">Ubicación no configurada</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Técnico asignado */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Técnico asignado</h2>
            {ticket.technician ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                    {getInitials(ticket.technician.profile?.full_name || 'T')}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{ticket.technician.profile?.full_name}</p>
                    {ticket.technician.zone && (
                      <p className="text-xs text-gray-500">Zona: {ticket.technician.zone}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {ticket.technician.profile?.email && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500 uppercase mb-1">Email</dt>
                      <dd className="text-gray-900 break-all">
                        <a href={`mailto:${ticket.technician.profile.email}`} className="hover:text-blue-600">
                          {ticket.technician.profile.email}
                        </a>
                      </dd>
                    </div>
                  )}
                  {ticket.technician.profile?.phone && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500 uppercase mb-1">Teléfono</dt>
                      <dd className="text-gray-900">
                        <a href={`tel:${ticket.technician.profile.phone}`} className="hover:text-blue-600">
                          {ticket.technician.profile.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                </div>

                {techLocation && (
                  <div className="pt-3 border-t border-gray-200">
                    <dt className="text-xs font-medium text-gray-500 uppercase mb-2">Estado de ubicación</dt>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getLocationStatusColor(getLocationStatus(techLocation.recorded_at))}`}>
                        {getLocationStatusLabel(getLocationStatus(techLocation.recorded_at))}
                      </span>
                      <span className="text-xs text-gray-500">{formatTimeAgo(techLocation.recorded_at)}</span>
                    </div>
                    <button
                      onClick={() => router.push('/map')}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Ver en mapa →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Sin asignar</p>
            )}
          </div>

          {/* Tiempos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Tiempos</h2>

            <div className="space-y-4">
              <div className="text-center">
                <dt className="text-xs font-medium text-gray-500 uppercase mb-1">Antigüedad total</dt>
                <dd className="text-2xl font-bold text-gray-900">{formatTicketAge(ticket.created_at)}</dd>
              </div>

              <div className="relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-200 -translate-x-1/2"></div>

                <div className="relative space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-right">
                      <dt className="text-xs font-medium text-gray-500">Creado</dt>
                      <dd className="text-xs text-gray-900">{new Date(ticket.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</dd>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-blue-600 border-4 border-white shadow z-10"></div>
                    <div className="flex-1"></div>
                  </div>

                  {ticket.assigned_at && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 text-right">
                        <dt className="text-xs font-medium text-gray-500">Asignado</dt>
                        <dd className="text-xs text-gray-900">{new Date(ticket.assigned_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</dd>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-gray-400 border-2 border-white shadow z-10"></div>
                      <div className="flex-1"></div>
                    </div>
                  )}

                  {ticket.started_at && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 text-right">
                        <dt className="text-xs font-medium text-gray-500">Iniciado</dt>
                        <dd className="text-xs text-gray-900">{new Date(ticket.started_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</dd>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-gray-400 border-2 border-white shadow z-10"></div>
                      <div className="flex-1"></div>
                    </div>
                  )}

                  {ticket.closed_at && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 text-right">
                        <dt className="text-xs font-medium text-gray-500">Cerrado</dt>
                        <dd className="text-xs text-gray-900">{new Date(ticket.closed_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</dd>
                      </div>
                      <div className={`w-3 h-3 rounded-full border-4 border-white shadow z-10 ${ticket.status === 'RESOLVED' ? 'bg-green-600' : 'bg-red-600'}`}></div>
                      <div className="flex-1"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Línea de tiempo */}
          {history.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Línea de tiempo</h2>
              <div className="space-y-3">
                {history.map((entry, index) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-blue-600' : 'bg-gray-400'}`}></div>
                      {index < history.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-1"></div>}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-center gap-2 text-sm">
                        {entry.previous_status && (
                          <>
                            <span className="text-gray-600">
                              {getStatusLabel(entry.previous_status)}
                            </span>
                            <span className="text-gray-400">→</span>
                          </>
                        )}
                        <span className="font-medium text-gray-900">
                          {getStatusLabel(entry.new_status)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(entry.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                      {entry.notes && (
                        <div className="text-xs text-gray-600 mt-1">{entry.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <AssignTechnicianModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onSuccess={() => {
          setIsAssignModalOpen(false);
          loadTicket();
          loadHistory();
        }}
        ticket={ticket}
      />

      <CancelTicketModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onSuccess={() => {
          setIsCancelModalOpen(false);
          loadTicket();
          loadHistory();
        }}
        ticket={ticket}
      />

      <ConfirmDialog
        isOpen={isUnassignDialogOpen}
        onClose={() => setIsUnassignDialogOpen(false)}
        onConfirm={handleUnassign}
        title="Desasignar técnico"
        message={`¿Quitar la asignación del ticket ${formatTicketFolio(ticket.folio)}? El ticket volverá a estado PENDIENTE.`}
        confirmText="Desasignar"
        isDestructive
      />
    </ProtectedLayout>
  );
}

interface AssignTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ticket: TicketWithRelations;
}

function AssignTechnicianModal({
  isOpen,
  onClose,
  onSuccess,
  ticket,
}: AssignTechnicianModalProps) {
  const [technicians, setTechnicians] = useState<(Technician & { profile: Profile })[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTechnicians();
      setSelectedTechnicianId(ticket.technician_id || '');
      setError('');
    }
  }, [isOpen, ticket]);

  async function loadTechnicians() {
    const { data } = await supabase
      .from('technicians')
      .select('*, profile:profiles(*)')
      .eq('is_active', true)
      .order('created_at');
    setTechnicians((data as any) || []);
  }

  const technicianOptions: ComboboxOption[] = useMemo(
    () =>
      technicians.map(tech => ({
        value: tech.id,
        label: tech.profile?.full_name || 'Sin nombre',
        searchText: `${tech.profile?.full_name || ''} ${tech.profile?.email || ''} ${tech.zone || ''}`,
        secondaryText: [tech.zone, tech.profile?.email].filter(Boolean).join(' · '),
      })),
    [technicians]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedTechnicianId) {
      setError('Selecciona un técnico');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/tickets/${ticket.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          technicianId: selectedTechnicianId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al asignar técnico');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ticket.technician_id ? 'Reasignar técnico' : 'Asignar técnico'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-200">{error}</div>
        )}

        {ticket.technician && (
          <div className="p-3 bg-blue-50 text-blue-900 rounded-md text-sm border border-blue-200">
            Técnico actual: <strong>{ticket.technician.profile?.full_name}</strong>
          </div>
        )}

        <Combobox
          label="Técnico"
          required
          placeholder="Seleccionar técnico"
          searchPlaceholder="Buscar por nombre, correo o zona..."
          value={selectedTechnicianId}
          options={technicianOptions}
          onChange={setSelectedTechnicianId}
          emptyMessage="No se encontraron técnicos"
        />

        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition text-sm font-medium"
          >
            {submitting ? 'Asignando...' : 'Asignar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface CancelTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ticket: TicketWithRelations;
}

function CancelTicketModal({
  isOpen,
  onClose,
  onSuccess,
  ticket,
}: CancelTicketModalProps) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const predefinedReasons = [
    'Cliente ausente',
    'Dirección incorrecta',
    'Equipo no disponible',
    'Ticket duplicado',
    'Cancelado por cliente',
    'Otro',
  ];

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setCustomReason('');
      setError('');
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    let finalReason = reason;
    if (reason === 'Otro') {
      if (!customReason.trim()) {
        setError('Especifica la razón de cancelación');
        return;
      }
      finalReason = customReason.trim();
    }

    if (!finalReason) {
      setError('Selecciona una razón de cancelación');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'CANCELLED',
          close_reason: finalReason,
          closed_at: new Date().toISOString(),
        })
        .eq('id', ticket.id);

      if (error) throw error;

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancelar ticket">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-200">{error}</div>
        )}

        <div className="p-3 bg-yellow-50 text-yellow-900 rounded-md text-sm border border-yellow-200">
          ¿Cancelar el ticket {formatTicketFolio(ticket.folio)}? Esta acción no se puede
          deshacer.
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Razón de cancelación <span className="text-red-600">*</span>
          </label>
          <div className="space-y-2">
            {predefinedReasons.map(r => (
              <label key={r} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={e => setReason(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{r}</span>
              </label>
            ))}
          </div>
        </div>

        {reason === 'Otro' && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Especificar razón <span className="text-red-600">*</span>
            </label>
            <textarea
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
              rows={3}
              required
            />
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition text-sm font-medium"
          >
            Volver
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 transition text-sm font-medium"
          >
            {submitting ? 'Cancelando...' : 'Cancelar ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
