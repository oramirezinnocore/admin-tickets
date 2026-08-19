'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import { supabase } from '@/lib/supabase';
import {
  Ticket,
  Client,
  Technician,
  Profile,
  getTicketSlaState,
  formatTicketFolio,
  formatTicketAge,
  getSlaOrderPriority,
  TicketSlaState,
} from '@wisper/shared';

interface TicketWithRelations extends Ticket {
  client: Client;
  technician: (Technician & { profile: Profile }) | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [stats, setStats] = useState({
    createdToday: 0,
    resolvedToday: 0,
    pending: 0,
    overdue: 0,
    green: 0,
    yellow: 0,
    red: 0,
    resolvedMonth: 0,
    resolvedYear: 0,
    activeTechs: 0,
    techsWithLocation: 0,
    inReview: 0,
  });

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // Load all tickets
      const { data: ticketsData } = await supabase
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

      if (!ticketsData) return;

      setTickets(ticketsData as any);

      // Calculate stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const createdToday = ticketsData.filter(
        t => new Date(t.created_at) >= today
      ).length;

      const resolvedToday = ticketsData.filter(
        t =>
          t.status === 'RESOLVED' &&
          t.closed_at &&
          new Date(t.closed_at) >= today
      ).length;

      const activeTickets = ticketsData.filter(
        t => t.status !== 'RESOLVED' && t.status !== 'CANCELLED'
      );

      const pending = activeTickets.length;

      const overdue = activeTickets.filter(
        t => getTicketSlaState(t.created_at) === TicketSlaState.OVERDUE
      ).length;

      const green = activeTickets.filter(
        t => getTicketSlaState(t.created_at) === TicketSlaState.GREEN
      ).length;

      const yellow = activeTickets.filter(
        t => getTicketSlaState(t.created_at) === TicketSlaState.YELLOW
      ).length;

      const red = activeTickets.filter(
        t => getTicketSlaState(t.created_at) === TicketSlaState.RED
      ).length;

      const resolvedMonth = ticketsData.filter(
        t =>
          t.status === 'RESOLVED' &&
          t.closed_at &&
          new Date(t.closed_at) >= monthStart
      ).length;

      const resolvedYear = ticketsData.filter(
        t =>
          t.status === 'RESOLVED' &&
          t.closed_at &&
          new Date(t.closed_at) >= yearStart
      ).length;

      const inReview = ticketsData.filter(t => t.status === 'IN_REVIEW').length;

      // Load technician stats
      const { data: techsData } = await supabase
        .from('technicians')
        .select('id')
        .eq('is_active', true);

      // Check recent locations (last 10 minutes)
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const { data: recentLocs } = await supabase
        .from('technician_locations')
        .select('technician_id')
        .gte('recorded_at', tenMinutesAgo.toISOString());

      const activeTechs = techsData?.length || 0;
      const techsWithLocation =
        new Set(recentLocs?.map(l => l.technician_id)).size || 0;

      setStats({
        createdToday,
        resolvedToday,
        pending,
        overdue,
        green,
        yellow,
        red,
        resolvedMonth,
        resolvedYear,
        activeTechs,
        techsWithLocation,
        inReview,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const recentResolved = tickets
    .filter(t => t.status === 'RESOLVED')
    .slice(0, 10);

  const nextToAttend = tickets
    .filter(t => t.status !== 'RESOLVED' && t.status !== 'CANCELLED')
    .sort((a, b) => {
      const slaA = getTicketSlaState(a.created_at);
      const slaB = getTicketSlaState(b.created_at);
      const priorityA = getSlaOrderPriority(slaA);
      const priorityB = getSlaOrderPriority(slaB);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    .slice(0, 10);

  // Calculate alerts - FIXED: unique keys
  const activeTickets = tickets.filter(t => t.status !== 'RESOLVED' && t.status !== 'CANCELLED');

  const overdueTickets = activeTickets.filter(
    t => getTicketSlaState(t.created_at) === TicketSlaState.OVERDUE
  );

  const redTickets = activeTickets.filter(
    t => getTicketSlaState(t.created_at) === TicketSlaState.RED
  );

  const unassignedTickets = activeTickets.filter(t => !t.technician_id);

  const techsWithoutLocation = stats.activeTechs - stats.techsWithLocation;

  const alerts = [
    ...(overdueTickets.length > 0
      ? [{
          type: 'critical' as const,
          key: 'overdue',
          message: `${overdueTickets.length} ticket${overdueTickets.length > 1 ? 's' : ''} vencido${overdueTickets.length > 1 ? 's' : ''}`,
          action: () => router.push('/tickets'),
        }]
      : []),
    ...(redTickets.length > 0
      ? [{
          type: 'warning' as const,
          key: 'red',
          message: `${redTickets.length} ticket${redTickets.length > 1 ? 's' : ''} próximo${redTickets.length > 1 ? 's' : ''} a vencer`,
          action: () => router.push('/tickets'),
        }]
      : []),
    ...(unassignedTickets.length > 0
      ? [{
          type: 'info' as const,
          key: 'unassigned',
          message: `${unassignedTickets.length} ticket${unassignedTickets.length > 1 ? 's' : ''} sin asignar`,
          action: () => router.push('/tickets'),
        }]
      : []),
    ...(techsWithoutLocation > 0
      ? [{
          type: 'info' as const,
          key: 'location',
          message: `${techsWithoutLocation} técnico${techsWithoutLocation > 1 ? 's' : ''} sin ubicación reciente`,
          action: () => router.push('/map'),
        }]
      : []),
  ];

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Cargando...</div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Panel operativo</h1>
          <button
            onClick={loadData}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            title="Actualizar datos"
          >
            ↻ Actualizar
          </button>
        </div>
        <p className="text-sm text-gray-600">Resumen en tiempo real de la operación de soporte</p>
      </div>

      {/* Alerts - FIXED: using unique keys */}
      {alerts.length > 0 && (
        <div className="card mb-8">
          <div className="card-body">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Alertas operativas</h2>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <button
                  key={alert.key}
                  onClick={alert.action}
                  className={`w-full text-left px-4 py-3 rounded-lg border-l-4 hover:shadow-sm transition-all ${
                    alert.type === 'critical'
                      ? 'bg-red-50 border-red-500 hover:bg-red-100'
                      : alert.type === 'warning'
                      ? 'bg-yellow-50 border-yellow-500 hover:bg-yellow-100'
                      : 'bg-blue-50 border-blue-500 hover:bg-blue-100'
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      alert.type === 'critical'
                        ? 'text-red-900'
                        : alert.type === 'warning'
                        ? 'text-yellow-900'
                        : 'text-blue-900'
                    }`}
                  >
                    {alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟠' : '🔵'}{' '}
                    {alert.message}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tickets hoy" value={stats.createdToday} sublabel="Reportados" />
        <StatCard label="Resueltos hoy" value={stats.resolvedToday} sublabel="Cerrados" color="green" />
        <StatCard label="Activos" value={stats.pending} sublabel="En proceso" color="blue" />
        <StatCard label="Vencidos" value={stats.overdue} sublabel="Urgentes" color="red" />
      </div>

      {/* SLA cards */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Estado SLA - Tickets activos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SlaCard label="Verdes" sublabel="0-24 horas" value={stats.green} color="green" />
          <SlaCard label="Amarillos" sublabel="24-48 horas" value={stats.yellow} color="yellow" />
          <SlaCard label="Rojos" sublabel="48-72 horas" value={stats.red} color="red" />
          <SlaCard label="Vencidos" sublabel="+72 horas" value={stats.overdue} color="overdue" />
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Resueltos este mes</h3>
            <p className="text-3xl font-bold text-green-600">{stats.resolvedMonth}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Resueltos este año</h3>
            <p className="text-3xl font-bold text-green-600">{stats.resolvedYear}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Técnicos</h3>
            <div className="space-y-1.5 text-sm">
              <p><span className="font-semibold text-gray-900">{stats.activeTechs}</span> <span className="text-gray-600">activos</span></p>
              <p><span className="font-semibold text-gray-900">{stats.techsWithLocation}</span> <span className="text-gray-600">con ubicación</span></p>
              <p><span className="font-semibold text-gray-900">{stats.inReview}</span> <span className="text-gray-600">en revisión</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Últimos resueltos</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentResolved.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No hay tickets resueltos recientemente
              </div>
            ) : (
              recentResolved.map(ticket => (
                <div
                  key={ticket.id}
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-mono text-sm font-semibold text-gray-900">
                        {formatTicketFolio(ticket.folio)}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">{ticket.client?.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ticket.technician?.profile?.full_name || 'Sin técnico'}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {ticket.closed_at &&
                        new Date(ticket.closed_at).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short'
                        })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Próximos a atender</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {nextToAttend.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No hay tickets pendientes
              </div>
            ) : (
              nextToAttend.map(ticket => {
                const slaState = getTicketSlaState(ticket.created_at);
                return (
                  <div
                    key={ticket.id}
                    onClick={() => router.push(`/tickets/${ticket.id}`)}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-semibold text-gray-900">
                          {formatTicketFolio(ticket.folio)}
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5 truncate">{ticket.client?.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {ticket.technician?.profile?.full_name || 'Sin asignar'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getSlaColor(slaState)}`}>
                          {getSlaLabel(slaState)}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTicketAge(ticket.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  color = 'gray',
}: {
  label: string;
  value: number;
  sublabel?: string;
  color?: 'gray' | 'green' | 'blue' | 'red';
}) {
  const colors = {
    gray: 'text-gray-900',
    green: 'text-green-600',
    blue: 'text-blue-600',
    red: 'text-red-600',
  };

  return (
    <div className="card">
      <div className="card-body">
        <h3 className="text-sm font-medium text-gray-500 mb-1">{label}</h3>
        <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
        {sublabel && <p className="text-xs text-gray-500 mt-1">{sublabel}</p>}
      </div>
    </div>
  );
}

function SlaCard({
  label,
  sublabel,
  value,
  color,
}: {
  label: string;
  sublabel: string;
  value: number;
  color: 'green' | 'yellow' | 'red' | 'overdue';
}) {
  const colors = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    yellow: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-orange-50 border-orange-200 text-orange-900',
    overdue: 'bg-red-50 border-red-300 text-red-900',
  };

  return (
    <div className={`rounded-xl border-2 p-6 ${colors[color]}`}>
      <h3 className="text-sm font-semibold mb-1">{label}</h3>
      <p className="text-xs opacity-75 mb-3">{sublabel}</p>
      <p className="text-4xl font-bold">{value}</p>
    </div>
  );
}

function getSlaColor(slaState: TicketSlaState): string {
  switch (slaState) {
    case TicketSlaState.GREEN:
      return 'bg-emerald-100 text-emerald-800';
    case TicketSlaState.YELLOW:
      return 'bg-amber-100 text-amber-800';
    case TicketSlaState.RED:
      return 'bg-orange-100 text-orange-800';
    case TicketSlaState.OVERDUE:
      return 'bg-red-100 text-red-900 font-semibold';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getSlaLabel(slaState: TicketSlaState): string {
  switch (slaState) {
    case TicketSlaState.GREEN:
      return 'Verde';
    case TicketSlaState.YELLOW:
      return 'Amarillo';
    case TicketSlaState.RED:
      return 'Rojo';
    case TicketSlaState.OVERDUE:
      return 'Vencido';
    default:
      return '';
  }
}
