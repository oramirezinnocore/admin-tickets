'use client';

import { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { supabase } from '@/lib/supabase';
import {
  Ticket,
  Client,
  Technician,
  Profile,
  TicketStatus,
  TicketSlaState,
  getTicketSlaState,
  formatDuration,
  formatTicketFolio,
} from '@wisper/shared';
import Papa from 'papaparse';

interface TicketWithRelations extends Ticket {
  client: Client | null;
  technician: (Technician & { profile: Profile }) | null;
}

type DatePreset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
}

interface TechnicianMetrics {
  id: string;
  name: string;
  assigned: number;
  closed: number;
  open: number;
  avgTimeToAttention: number | null;
  avgAttentionTime: number | null;
  avgTotalTime: number | null;
}

interface ClientMetrics {
  id: string;
  name: string;
  created: number;
  open: number;
  closed: number;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>('last30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('last30'));

  useEffect(() => {
    loadTickets();
  }, [dateRange]);

  useEffect(() => {
    if (datePreset !== 'custom') {
      setDateRange(getDateRange(datePreset));
    }
  }, [datePreset]);

  function getDateRange(preset: DatePreset): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case 'today':
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      case 'last7':
        return {
          start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      case 'last30':
        return {
          start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      case 'thisMonth':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      default:
        return {
          start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: today
        };
    }
  }

  function handleCustomDateApply() {
    if (!customStart || !customEnd) return;

    const start = new Date(customStart);
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);

    setDateRange({ start, end });
  }

  async function loadTickets() {
    try {
      setLoading(true);

      const { data: ticketsData, error } = await supabase
        .from('tickets')
        .select(`
          *,
          client:clients(*),
          technician:technicians(
            *,
            profile:profiles(*)
          )
        `)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTickets((ticketsData as any) || []);
    } catch (error: any) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate KPIs
  const kpis = calculateKPIs(tickets);
  const statusBreakdown = calculateStatusBreakdown(tickets);
  const technicianMetrics = calculateTechnicianMetrics(tickets);
  const clientMetrics = calculateClientMetrics(tickets);
  const slaMetrics = calculateSLAMetrics(tickets);

  function handleExportCSV() {
    const csvData = tickets.map(ticket => {
      const timeToAttention = ticket.created_at && ticket.started_at
        ? calculateDurationSeconds(ticket.created_at, ticket.started_at)
        : null;

      const attentionTime = ticket.started_at && ticket.closed_at
        ? calculateDurationSeconds(ticket.started_at, ticket.closed_at)
        : null;

      const totalTime = ticket.created_at && ticket.closed_at
        ? calculateDurationSeconds(ticket.created_at, ticket.closed_at)
        : null;

      return {
        Folio: formatTicketFolio(ticket.folio),
        Cliente: ticket.client?.name || 'N/A',
        Técnico: ticket.technician?.profile?.full_name || 'Sin asignar',
        Estado: getStatusLabel(ticket.status),
        Creado: new Date(ticket.created_at).toLocaleString('es-MX'),
        Iniciado: ticket.started_at ? new Date(ticket.started_at).toLocaleString('es-MX') : 'N/A',
        Cerrado: ticket.closed_at ? new Date(ticket.closed_at).toLocaleString('es-MX') : 'N/A',
        'Tiempo hasta atención (seg)': timeToAttention !== null ? timeToAttention : 'N/A',
        'Tiempo de atención (seg)': attentionTime !== null ? attentionTime : 'N/A',
        'Tiempo total (seg)': totalTime !== null ? totalTime : 'N/A',
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_tickets_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="text-center py-12">Cargando reportes...</div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Reportes</h1>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
          >
            Exportar CSV
          </button>
        </div>

        {/* Date Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-3">Período</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { value: 'today' as DatePreset, label: 'Hoy' },
              { value: 'last7' as DatePreset, label: 'Últimos 7 días' },
              { value: 'last30' as DatePreset, label: 'Últimos 30 días' },
              { value: 'thisMonth' as DatePreset, label: 'Este mes' },
              { value: 'custom' as DatePreset, label: 'Personalizado' },
            ].map(preset => (
              <button
                key={preset.value}
                onClick={() => setDatePreset(preset.value)}
                className={`px-4 py-2 rounded-md transition ${
                  datePreset === preset.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {datePreset === 'custom' && (
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Fecha inicial</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Fecha final</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <button
                onClick={handleCustomDateApply}
                disabled={!customStart || !customEnd}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                Aplicar
              </button>
            </div>
          )}

          <p className="text-sm text-gray-600 mt-2">
            Mostrando tickets creados entre {dateRange.start.toLocaleDateString('es-MX')} y{' '}
            {dateRange.end.toLocaleDateString('es-MX')}
          </p>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard title="Tickets creados" value={kpis.created} />
          <KPICard title="Tickets cerrados" value={kpis.closed} />
          <KPICard title="Tickets abiertos" value={kpis.open} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            title="Tiempo promedio hasta atención"
            value={kpis.avgTimeToAttention}
            subtitle={kpis.timeToAttentionCount > 0 ? `(${kpis.timeToAttentionCount} tickets)` : undefined}
          />
          <KPICard
            title="Tiempo promedio de atención"
            value={kpis.avgAttentionTime}
            subtitle={kpis.attentionTimeCount > 0 ? `(${kpis.attentionTimeCount} tickets)` : undefined}
          />
          <KPICard
            title="Tiempo promedio total"
            value={kpis.avgTotalTime}
            subtitle={kpis.totalTimeCount > 0 ? `(${kpis.totalTimeCount} tickets)` : undefined}
          />
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Distribución por Estado</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(statusBreakdown).map(([status, count]) => (
              <div key={status} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-xs text-gray-600 mt-1">{getStatusLabel(status as TicketStatus)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SLA Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Cumplimiento SLA (Tickets Activos)</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-800">{slaMetrics.green}</div>
              <div className="text-xs text-gray-600 mt-1">0-24h (Verde)</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-800">{slaMetrics.yellow}</div>
              <div className="text-xs text-gray-600 mt-1">24-48h (Amarillo)</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-800">{slaMetrics.red}</div>
              <div className="text-xs text-gray-600 mt-1">48-72h (Rojo)</div>
            </div>
            <div className="text-center p-3 bg-gray-100 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{slaMetrics.overdue}</div>
              <div className="text-xs text-gray-600 mt-1">+72h (Vencido)</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">{slaMetrics.compliance}%</div>
              <div className="text-xs text-gray-600 mt-1">Dentro de 72h</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            * SLA calculado sobre tickets activos (no cerrados ni cancelados) basado en tiempo transcurrido desde creación
          </p>
        </div>

        {/* Technician Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Métricas por Técnico</h2>
          {technicianMetrics.length === 0 ? (
            <p className="text-gray-500">No hay datos de técnicos en este período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Técnico
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Asignados
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Cerrados
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Abiertos
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Prom. hasta atención
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Prom. de atención
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Prom. total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {technicianMetrics.map(tech => (
                    <tr key={tech.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {tech.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                        {tech.assigned}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                        {tech.closed}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                        {tech.open}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                        {tech.avgTimeToAttention !== null
                          ? formatDurationFromSeconds(tech.avgTimeToAttention)
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                        {tech.avgAttentionTime !== null
                          ? formatDurationFromSeconds(tech.avgAttentionTime)
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                        {tech.avgTotalTime !== null
                          ? formatDurationFromSeconds(tech.avgTotalTime)
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Client Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Métricas por Cliente</h2>
          {clientMetrics.length === 0 ? (
            <p className="text-gray-500">No hay datos de clientes en este período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Creados
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Abiertos
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Cerrados
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clientMetrics.map(client => (
                    <tr key={client.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {client.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                        {client.created}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                        {client.open}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                        {client.closed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}

function KPICard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function calculateKPIs(tickets: TicketWithRelations[]) {
  const created = tickets.length;
  const closed = tickets.filter(t => t.status === TicketStatus.RESOLVED).length;
  const open = tickets.filter(
    t => t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CANCELLED
  ).length;

  // Calculate average times from raw durations
  const timeToAttentionTickets = tickets.filter(t => t.created_at && t.started_at);
  const attentionTimeTickets = tickets.filter(t => t.started_at && t.closed_at);
  const totalTimeTickets = tickets.filter(t => t.created_at && t.closed_at);

  const avgTimeToAttention =
    timeToAttentionTickets.length > 0
      ? formatDurationFromSeconds(
          timeToAttentionTickets.reduce((sum, t) => {
            return sum + calculateDurationSeconds(t.created_at, t.started_at!);
          }, 0) / timeToAttentionTickets.length
        )
      : 'No disponible';

  const avgAttentionTime =
    attentionTimeTickets.length > 0
      ? formatDurationFromSeconds(
          attentionTimeTickets.reduce((sum, t) => {
            return sum + calculateDurationSeconds(t.started_at!, t.closed_at!);
          }, 0) / attentionTimeTickets.length
        )
      : 'No disponible';

  const avgTotalTime =
    totalTimeTickets.length > 0
      ? formatDurationFromSeconds(
          totalTimeTickets.reduce((sum, t) => {
            return sum + calculateDurationSeconds(t.created_at, t.closed_at!);
          }, 0) / totalTimeTickets.length
        )
      : 'No disponible';

  return {
    created,
    closed,
    open,
    avgTimeToAttention,
    avgAttentionTime,
    avgTotalTime,
    timeToAttentionCount: timeToAttentionTickets.length,
    attentionTimeCount: attentionTimeTickets.length,
    totalTimeCount: totalTimeTickets.length,
  };
}

function calculateStatusBreakdown(tickets: TicketWithRelations[]) {
  const breakdown: Record<string, number> = {
    PENDING: 0,
    ASSIGNED: 0,
    IN_REVIEW: 0,
    PAUSED: 0,
    RESOLVED: 0,
    CANCELLED: 0,
  };

  tickets.forEach(ticket => {
    breakdown[ticket.status] = (breakdown[ticket.status] || 0) + 1;
  });

  return breakdown;
}

function calculateTechnicianMetrics(tickets: TicketWithRelations[]): TechnicianMetrics[] {
  const techMap = new Map<string, TechnicianMetrics>();

  tickets.forEach(ticket => {
    if (!ticket.technician) return;

    const techId = ticket.technician.id;
    const techName = ticket.technician.profile?.full_name || 'Desconocido';

    if (!techMap.has(techId)) {
      techMap.set(techId, {
        id: techId,
        name: techName,
        assigned: 0,
        closed: 0,
        open: 0,
        avgTimeToAttention: null,
        avgAttentionTime: null,
        avgTotalTime: null,
      });
    }

    const tech = techMap.get(techId)!;
    tech.assigned++;

    if (ticket.status === TicketStatus.RESOLVED) {
      tech.closed++;
    } else if (ticket.status !== TicketStatus.CANCELLED) {
      tech.open++;
    }
  });

  // Calculate averages for each technician
  techMap.forEach((tech, techId) => {
    const techTickets = tickets.filter(t => t.technician?.id === techId);

    const timeToAttentionTickets = techTickets.filter(t => t.created_at && t.started_at);
    if (timeToAttentionTickets.length > 0) {
      tech.avgTimeToAttention =
        timeToAttentionTickets.reduce((sum, t) => {
          return sum + calculateDurationSeconds(t.created_at, t.started_at!);
        }, 0) / timeToAttentionTickets.length;
    }

    const attentionTimeTickets = techTickets.filter(t => t.started_at && t.closed_at);
    if (attentionTimeTickets.length > 0) {
      tech.avgAttentionTime =
        attentionTimeTickets.reduce((sum, t) => {
          return sum + calculateDurationSeconds(t.started_at!, t.closed_at!);
        }, 0) / attentionTimeTickets.length;
    }

    const totalTimeTickets = techTickets.filter(t => t.created_at && t.closed_at);
    if (totalTimeTickets.length > 0) {
      tech.avgTotalTime =
        totalTimeTickets.reduce((sum, t) => {
          return sum + calculateDurationSeconds(t.created_at, t.closed_at!);
        }, 0) / totalTimeTickets.length;
    }
  });

  return Array.from(techMap.values()).sort((a, b) => b.assigned - a.assigned);
}

function calculateClientMetrics(tickets: TicketWithRelations[]): ClientMetrics[] {
  const clientMap = new Map<string, ClientMetrics>();

  tickets.forEach(ticket => {
    if (!ticket.client) return;

    const clientId = ticket.client.id;
    const clientName = ticket.client.name;

    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        id: clientId,
        name: clientName,
        created: 0,
        open: 0,
        closed: 0,
      });
    }

    const client = clientMap.get(clientId)!;
    client.created++;

    if (ticket.status === TicketStatus.RESOLVED) {
      client.closed++;
    } else if (ticket.status !== TicketStatus.CANCELLED) {
      client.open++;
    }
  });

  return Array.from(clientMap.values()).sort((a, b) => b.created - a.created);
}

function calculateSLAMetrics(tickets: TicketWithRelations[]) {
  const activeTickets = tickets.filter(
    t => t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CANCELLED
  );

  const slaBreakdown = {
    green: 0,
    yellow: 0,
    red: 0,
    overdue: 0,
  };

  activeTickets.forEach(ticket => {
    const slaState = getTicketSlaState(ticket.created_at);

    switch (slaState) {
      case TicketSlaState.GREEN:
        slaBreakdown.green++;
        break;
      case TicketSlaState.YELLOW:
        slaBreakdown.yellow++;
        break;
      case TicketSlaState.RED:
        slaBreakdown.red++;
        break;
      case TicketSlaState.OVERDUE:
        slaBreakdown.overdue++;
        break;
    }
  });

  const total = activeTickets.length;
  const within72h = slaBreakdown.green + slaBreakdown.yellow + slaBreakdown.red;
  const compliance = total > 0 ? Math.round((within72h / total) * 100) : 0;

  return {
    ...slaBreakdown,
    compliance,
  };
}

function calculateDurationSeconds(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return (endDate.getTime() - startDate.getTime()) / 1000;
}

function formatDurationFromSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getStatusLabel(status: TicketStatus | string): string {
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
