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

      const { data: locationsData } = await supabase
        .from('technician_latest_locations')
        .select('technician_id');

      const activeTechs = techsData?.length || 0;

      // Check recent locations (last 10 minutes)
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const { data: recentLocs } = await supabase
        .from('technician_locations')
        .select('technician_id')
        .gte('recorded_at', tenMinutesAgo.toISOString());

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

  // Calculate alerts
  const now = new Date();
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

  const activeTickets = tickets.filter(t => t.status !== 'RESOLVED' && t.status !== 'CANCELLED');

  const overdueTickets = activeTickets.filter(
    t => getTicketSlaState(t.created_at) === TicketSlaState.OVERDUE
  );

  const redTickets = activeTickets.filter(
    t => getTicketSlaState(t.created_at) === TicketSlaState.RED
  );

  const unassignedTickets = activeTickets.filter(t => !t.technician_id);

  const techsWithoutLocation = stats.activeTechs - stats.techsWithLocation;

  const longInReviewTickets = tickets.filter(
    t =>
      t.status === 'IN_REVIEW' &&
      t.started_at &&
      new Date(t.started_at) < fourHoursAgo
  );

  const alerts = [
    ...(overdueTickets.length > 0
      ? [{
          type: 'critical' as const,
          message: `${overdueTickets.length} ticket${overdueTickets.length > 1 ? 's' : ''} vencido${overdueTickets.length > 1 ? 's' : ''}`,
          action: () => router.push('/tickets'),
        }]
      : []),
    ...(redTickets.length > 0
      ? [{
          type: 'warning' as const,
          message: `${redTickets.length} ticket${redTickets.length > 1 ? 's' : ''} en estado rojo (48-72h)`,
          action: () => router.push('/tickets'),
        }]
      : []),
    ...(unassignedTickets.length > 0
      ? [{
          type: 'info' as const,
          message: `${unassignedTickets.length} ticket${unassignedTickets.length > 1 ? 's' : ''} sin asignar`,
          action: () => router.push('/tickets'),
        }]
      : []),
    ...(techsWithoutLocation > 0
      ? [{
          type: 'info' as const,
          message: `${techsWithoutLocation} técnico${techsWithoutLocation > 1 ? 's' : ''} sin ubicación reciente`,
          action: () => router.push('/map'),
        }]
      : []),
    ...(longInReviewTickets.length > 0
      ? [{
          type: 'warning' as const,
          message: `${longInReviewTickets.length} ticket${longInReviewTickets.length > 1 ? 's' : ''} en revisión por más de 4 horas`,
          action: () => router.push('/tickets'),
        }]
      : []),
  ];

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Cargando dashboard...</div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard Operativo</h1>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          Actualizar
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              onClick={alert.action}
              className={`p-4 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition ${
                alert.type === 'critical'
                  ? 'bg-red-50 border-red-500'
                  : alert.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-500'
                  : 'bg-blue-50 border-blue-500'
              }`}
            >
              <p
                className={`font-medium ${
                  alert.type === 'critical'
                    ? 'text-red-800'
                    : alert.type === 'warning'
                    ? 'text-yellow-800'
                    : 'text-blue-800'
                }`}
              >
                {alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}{' '}
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Main metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Tickets hoy" value={stats.createdToday} />
        <StatCard label="Resueltos hoy" value={stats.resolvedToday} color="green" />
        <StatCard label="Pendientes" value={stats.pending} color="blue" />
        <StatCard label="Vencidos" value={stats.overdue} color="red" />
      </div>

      {/* SLA cards */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Estado SLA (Activos)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SlaCard label="Verdes" sublabel="0-24 h" value={stats.green} color="green" />
          <SlaCard label="Amarillos" sublabel="24-48 h" value={stats.yellow} color="yellow" />
          <SlaCard label="Rojos" sublabel="48-72 h" value={stats.red} color="red" />
          <SlaCard label="Vencidos" sublabel="+72 h" value={stats.overdue} color="dark-red" />
        </div>
      </div>

      {/* Resolved stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Resueltos este mes" value={stats.resolvedMonth} color="green" />
        <StatCard label="Resueltos este año" value={stats.resolvedYear} color="green" />
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Técnicos</h3>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-semibold">{stats.activeTechs}</span> activos
            </p>
            <p className="text-sm">
              <span className="font-semibold">{stats.techsWithLocation}</span> con ubicación reciente
            </p>
            <p className="text-sm">
              <span className="font-semibold">{stats.inReview}</span> tickets en revisión
            </p>
          </div>
        </div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Últimos tickets resueltos</h2>
          </div>
          <div className="divide-y">
            {recentResolved.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No hay tickets resueltos
              </div>
            ) : (
              recentResolved.map(ticket => (
                <div
                  key={ticket.id}
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm font-semibold">
                        {formatTicketFolio(ticket.folio)}
                      </p>
                      <p className="text-sm text-gray-600">{ticket.client?.name}</p>
                      <p className="text-xs text-gray-500">
                        {ticket.technician?.profile?.full_name || 'Sin técnico'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {ticket.closed_at &&
                          new Date(ticket.closed_at).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Próximos a atender</h2>
          </div>
          <div className="divide-y">
            {nextToAttend.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No hay tickets pendientes
              </div>
            ) : (
              nextToAttend.map(ticket => {
                const slaState = getTicketSlaState(ticket.created_at);
                return (
                  <div
                    key={ticket.id}
                    onClick={() => router.push(`/tickets/${ticket.id}`)}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-sm font-semibold">
                          {formatTicketFolio(ticket.folio)}
                        </p>
                        <p className="text-sm text-gray-600">{ticket.client?.name}</p>
                        <p className="text-xs text-gray-500">
                          {ticket.technician?.profile?.full_name || 'Sin asignar'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded-full ${getSlaColor(
                            slaState
                          )}`}
                        >
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
  color = 'gray',
}: {
  label: string;
  value: number;
  color?: 'gray' | 'green' | 'blue' | 'red';
}) {
  const colors = {
    gray: 'text-gray-600',
    green: 'text-green-600',
    blue: 'text-blue-600',
    red: 'text-red-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{label}</h3>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
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
  color: 'green' | 'yellow' | 'red' | 'dark-red';
}) {
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    'dark-red': 'bg-red-100 border-red-300 text-red-900',
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colors[color]}`}>
      <h3 className="text-sm font-medium mb-1">{label}</h3>
      <p className="text-xs mb-2">{sublabel}</p>
      <p className="text-4xl font-bold">{value}</p>
    </div>
  );
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
