'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedLayout from '@/components/ProtectedLayout';
import PageHeader from '@/components/ui/PageHeader';
import MetricCard from '@/components/ui/MetricCard';
import AnimatedMetric from '@/components/ui/AnimatedMetric';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import SlidePanel from '@/components/ui/SlidePanel';
import AttentionPanel from '@/components/AttentionPanel';
import OperationalInsights from '@/components/OperationalInsights';
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
  getTicketSlaLabel,
} from '@wisper/shared';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Activity,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Users,
  MapPin
} from 'lucide-react';

interface TicketWithRelations extends Ticket {
  client: Client;
  technician: (Technician & { profile: Profile }) | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [slaPanelOpen, setSlaPanelOpen] = useState(false);
  const [selectedSla, setSelectedSla] = useState<TicketSlaState | null>(null);
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
    const interval = setInterval(loadData, 60000);
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

  // Calculate alerts
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
          action: () => router.push('/tickets?sla=overdue'),
        }]
      : []),
    ...(redTickets.length > 0
      ? [{
          type: 'warning' as const,
          key: 'red',
          message: `${redTickets.length} ticket${redTickets.length > 1 ? 's' : ''} próximo${redTickets.length > 1 ? 's' : ''} a vencer`,
          action: () => router.push('/tickets?sla=red'),
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
        <PageHeader title="Panel operativo" description="Resumen en tiempo real de la operación de soporte" />
        <LoadingSkeleton variant="metric" />
      </ProtectedLayout>
    );
  }

  const currentDate = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <ProtectedLayout>
      <PageHeader
        title="Panel operativo"
        description={currentDate}
        actions={
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        }
      />

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((alert) => (
            <button
              key={alert.key}
              onClick={alert.action}
              className={`w-full text-left px-5 py-4 rounded-xl border-l-4 transition-all flex items-center gap-3 ${
                alert.type === 'critical'
                  ? 'bg-red-50 border-red-500 hover:bg-red-100 hover:shadow-md'
                  : alert.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-500 hover:bg-yellow-100 hover:shadow-md'
                  : 'bg-blue-50 border-blue-500 hover:bg-blue-100 hover:shadow-md'
              }`}
            >
              {alert.type === 'critical' ? (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              ) : alert.type === 'warning' ? (
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              ) : (
                <Activity className="h-5 w-5 text-blue-600 flex-shrink-0" />
              )}
              <p
                className={`text-sm font-medium ${
                  alert.type === 'critical'
                    ? 'text-red-900'
                    : alert.type === 'warning'
                    ? 'text-yellow-900'
                    : 'text-blue-900'
                }`}
              >
                {alert.message}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Tickets hoy"
          value={stats.createdToday}
          subtitle="Reportados"
          icon={Activity}
          onClick={() => router.push('/tickets?filter=today')}
        />
        <MetricCard
          title="Resueltos hoy"
          value={stats.resolvedToday}
          subtitle="Cerrados"
          variant="success"
          icon={CheckCircle2}
          onClick={() => router.push('/tickets?status=RESOLVED&period=today')}
        />
        <MetricCard
          title="Activos"
          value={stats.pending}
          subtitle="En proceso"
          variant="primary"
          icon={Clock}
          onClick={() => router.push('/tickets?status=PENDING,ASSIGNED,IN_REVIEW,PAUSED')}
        />
        <MetricCard
          title="Vencidos"
          value={stats.overdue}
          subtitle="Urgentes"
          variant="danger"
          icon={AlertCircle}
          onClick={() => router.push('/tickets?sla=overdue')}
        />
      </div>

      {/* SLA Indicators */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Estado SLA - Tickets activos</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div
              className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
              onClick={() => {
                setSelectedSla(TicketSlaState.GREEN);
                setSlaPanelOpen(true);
              }}
            >
              <AnimatedMetric
                value={stats.green}
                max={stats.pending || 1}
                label="Verdes"
                subtitle="0-24 horas"
                variant="success"
                size="md"
              />
            </div>
            <div
              className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
              onClick={() => {
                setSelectedSla(TicketSlaState.YELLOW);
                setSlaPanelOpen(true);
              }}
            >
              <AnimatedMetric
                value={stats.yellow}
                max={stats.pending || 1}
                label="Amarillos"
                subtitle="24-48 horas"
                variant="warning"
                size="md"
              />
            </div>
            <div
              className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
              onClick={() => {
                setSelectedSla(TicketSlaState.RED);
                setSlaPanelOpen(true);
              }}
            >
              <AnimatedMetric
                value={stats.red}
                max={stats.pending || 1}
                label="Rojos"
                subtitle="48-72 horas"
                variant="danger"
                size="md"
              />
            </div>
            <div
              className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
              onClick={() => {
                setSelectedSla(TicketSlaState.OVERDUE);
                setSlaPanelOpen(true);
              }}
            >
              <AnimatedMetric
                value={stats.overdue}
                max={stats.pending || 1}
                label="Vencidos"
                subtitle="+72 horas"
                variant="danger"
                size="md"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attention Panel */}
      <div className="mb-8">
        <AttentionPanel
          tickets={tickets}
          onTicketClick={(id) => router.push(`/tickets/${id}`)}
        />
      </div>

      {/* Operational Insights */}
      <div className="mb-8">
        <OperationalInsights
          tickets={tickets}
          onNavigate={(path) => router.push(path)}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div
          className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => router.push('/tickets?status=RESOLVED&period=month')}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-600">Resueltos este mes</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.resolvedMonth}</p>
        </div>

        <div
          className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => router.push('/tickets?status=RESOLVED&period=year')}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-600">Resueltos este año</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.resolvedYear}</p>
        </div>

        <div
          className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => router.push('/technicians')}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-600">Técnicos</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Activos:</span>
              <span className="font-semibold text-gray-900">{stats.activeTechs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Con ubicación:</span>
              <span className="font-semibold text-gray-900">{stats.techsWithLocation}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">En revisión:</span>
              <span className="font-semibold text-gray-900">{stats.inReview}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Últimos resueltos</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentResolved.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No hay tickets resueltos"
                description="Los tickets resueltos recientemente aparecerán aquí"
              />
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

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Próximos a atender</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {nextToAttend.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No hay tickets pendientes"
                description="Los tickets pendientes de atención aparecerán aquí"
              />
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
                        <StatusBadge
                          status={getSlaLabel(slaState)}
                          variant={getSlaVariant(slaState)}
                          size="sm"
                          dot
                        />
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

      {/* SLA Panel */}
      <SlidePanel
        isOpen={slaPanelOpen}
        onClose={() => setSlaPanelOpen(false)}
        title={`Tickets ${selectedSla ? getTicketSlaLabel(selectedSla).toLowerCase() + 's' : ''}`}
        width="lg"
      >
        {selectedSla && (
          <div className="space-y-3">
            {tickets
              .filter(t => t.status !== 'RESOLVED' && t.status !== 'CANCELLED')
              .filter(t => getTicketSlaState(t.created_at) === selectedSla)
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map(ticket => (
                <div
                  key={ticket.id}
                  onClick={() => {
                    setSlaPanelOpen(false);
                    router.push(`/tickets/${ticket.id}`);
                  }}
                  className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-mono text-sm font-semibold text-gray-900 mb-1">
                        {formatTicketFolio(ticket.folio)}
                      </p>
                      <p className="text-sm text-gray-900 font-medium">{ticket.client?.name}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {ticket.technician?.profile?.full_name || 'Sin asignar'}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge
                        status={getTicketSlaLabel(selectedSla)}
                        variant={getSlaVariant(selectedSla)}
                        size="sm"
                        dot
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTicketAge(ticket.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            {tickets.filter(t =>
              t.status !== 'RESOLVED' &&
              t.status !== 'CANCELLED' &&
              getTicketSlaState(t.created_at) === selectedSla
            ).length === 0 && (
              <EmptyState
                icon={Clock}
                title="No hay tickets en esta categoría"
                description="Todos los tickets han sido resueltos o se encuentran en otra categoría SLA"
              />
            )}
          </div>
        )}
      </SlidePanel>
    </ProtectedLayout>
  );
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
