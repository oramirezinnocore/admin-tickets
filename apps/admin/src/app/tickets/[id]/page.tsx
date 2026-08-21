'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  TicketStatusHistory,
  getTicketSlaState,
  getTicketSlaLabel,
  formatTicketAge,
  formatTicketFolio,
} from '@wisper/shared';

interface TicketWithRelations extends Ticket {
  client: Client;
  technician: (Technician & { profile: Profile }) | null;
}

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<TicketWithRelations | null>(null);
  const [history, setHistory] = useState<TicketStatusHistory[]>([]);
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
    }, 60000);

    return () => clearInterval(interval);
  }, [ticketId]);

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
        .order('created_at', { ascending: false });

      setHistory(data || []);
    } catch (err: any) {
      console.error('Error loading history:', err);
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
        return 'bg-green-100 text-green-800';
      case 'YELLOW':
        return 'bg-yellow-100 text-yellow-800';
      case 'RED':
      case 'OVERDUE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  function openInMaps(lat: number, lng: number) {
    window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`, '_blank');
  }

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="text-center py-12">Cargando...</div>
      </ProtectedLayout>
    );
  }

  if (error || !ticket) {
    return (
      <ProtectedLayout>
        <div className="p-4 bg-red-50 text-red-600 rounded-md">
          {error || 'Ticket no encontrado'}
        </div>
      </ProtectedLayout>
    );
  }

  const slaState = getTicketSlaState(ticket.created_at);

  return (
    <ProtectedLayout>
      <div className="mb-6">
        <button
          onClick={() => router.push('/tickets')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Volver a tickets
        </button>

        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl font-bold">{formatTicketFolio(ticket.folio)}</h1>
          <span className={`px-3 py-1 rounded-full text-sm ${getSlaColor(slaState)}`}>
            {getTicketSlaLabel(slaState)}
          </span>
        </div>

        <div className="flex gap-2 mb-6">
          {canAssign() && (
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              {ticket.technician_id ? 'Reasignar técnico' : 'Asignar técnico'}
            </button>
          )}
          {canUnassign() && (
            <button
              onClick={() => setIsUnassignDialogOpen(true)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition"
            >
              Quitar asignación
            </button>
          )}
          {canCancel() && (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
            >
              Cancelar ticket
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Información del ticket</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Estado</dt>
                <dd className="mt-1">
                  <span className="px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    {getStatusLabel(ticket.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Tipo de falla</dt>
                <dd className="mt-1">{ticket.failure_type}</dd>
              </div>
              {ticket.admin_notes && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Observaciones</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{ticket.admin_notes}</dd>
                </div>
              )}
              {ticket.technician_notes && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Notas del técnico
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap">{ticket.technician_notes}</dd>
                </div>
              )}
              {ticket.solution_text && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Solución</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{ticket.solution_text}</dd>
                </div>
              )}
              {ticket.close_reason && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Razón de cierre
                  </dt>
                  <dd className="mt-1">{ticket.close_reason}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Cliente</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Nombre</dt>
                <dd className="mt-1">{ticket.client?.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Dirección</dt>
                <dd className="mt-1">{ticket.client?.address}</dd>
              </div>
              {ticket.client?.reference && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Referencia</dt>
                  <dd className="mt-1">{ticket.client.reference}</dd>
                </div>
              )}
              {ticket.client?.phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Teléfono</dt>
                  <dd className="mt-1">{ticket.client.phone}</dd>
                </div>
              )}
              {ticket.client?.latitude && ticket.client?.longitude && (
                <div>
                  <button
                    onClick={() =>
                      openInMaps(ticket.client!.latitude!, ticket.client!.longitude!)
                    }
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Ver ubicación en mapa →
                  </button>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Historial</h2>
            {history.length === 0 ? (
              <p className="text-gray-500">Sin historial</p>
            ) : (
              <div className="space-y-3">
                {history.map(entry => (
                  <div key={entry.id} className="border-l-2 border-gray-300 pl-4 pb-2">
                    <div className="flex items-center gap-2 text-sm">
                      {entry.previous_status && (
                        <>
                          <span className="text-gray-600">
                            {getStatusLabel(entry.previous_status)}
                          </span>
                          <span>→</span>
                        </>
                      )}
                      <span className="font-medium">
                        {getStatusLabel(entry.new_status)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(entry.created_at).toLocaleString('es-MX')}
                    </div>
                    {entry.notes && (
                      <div className="text-sm text-gray-600 mt-1">{entry.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Técnico asignado</h2>
            {ticket.technician ? (
              <div className="space-y-2">
                <p className="font-medium">{ticket.technician.profile?.full_name}</p>
                <p className="text-sm text-gray-600">
                  {ticket.technician.profile?.email}
                </p>
                {ticket.technician.profile?.phone && (
                  <p className="text-sm text-gray-600">
                    {ticket.technician.profile.phone}
                  </p>
                )}
                {ticket.technician.zone && (
                  <p className="text-sm text-gray-600">Zona: {ticket.technician.zone}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Sin asignar</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Tiempos</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Antigüedad</dt>
                <dd className="font-medium">{formatTicketAge(ticket.created_at)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Creado</dt>
                <dd>{new Date(ticket.created_at).toLocaleString('es-MX')}</dd>
              </div>
              {ticket.assigned_at && (
                <div>
                  <dt className="text-gray-500">Asignado</dt>
                  <dd>{new Date(ticket.assigned_at).toLocaleString('es-MX')}</dd>
                </div>
              )}
              {ticket.started_at && (
                <div>
                  <dt className="text-gray-500">Iniciado</dt>
                  <dd>{new Date(ticket.started_at).toLocaleString('es-MX')}</dd>
                </div>
              )}
              {ticket.closed_at && (
                <div>
                  <dt className="text-gray-500">Cerrado</dt>
                  <dd>{new Date(ticket.closed_at).toLocaleString('es-MX')}</dd>
                </div>
              )}
            </dl>
          </div>
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
        title="Quitar asignación"
        message={`¿Quitar la asignación del ticket ${formatTicketFolio(ticket.folio)}? El ticket volverá a estado PENDIENTE.`}
        confirmText="Quitar asignación"
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

  // Prepare technician options
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
      // Call server-side endpoint to assign and send push notification
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
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>
        )}

        {ticket.technician && (
          <div className="p-3 bg-blue-50 text-blue-900 rounded-md text-sm">
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
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition"
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
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>
        )}

        <div className="p-3 bg-yellow-50 text-yellow-900 rounded-md text-sm">
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
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
              required
            />
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition"
          >
            Volver
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 transition"
          >
            {submitting ? 'Cancelando...' : 'Cancelar ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
