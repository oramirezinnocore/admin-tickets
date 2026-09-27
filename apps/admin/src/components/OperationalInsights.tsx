'use client';

import { AlertTriangle, TrendingUp, Users, Clock } from 'lucide-react';
import { Ticket, Technician, Profile, getTicketSlaState, TicketSlaState } from '@wisper/shared';

interface TicketWithTechnician extends Ticket {
  technician: (Technician & { profile: Profile }) | null;
}

interface Insight {
  id: string;
  type: 'warning' | 'info' | 'success';
  icon: React.ElementType;
  message: string;
  count: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface OperationalInsightsProps {
  tickets: TicketWithTechnician[];
  onNavigate?: (path: string) => void;
}

export default function OperationalInsights({ tickets, onNavigate }: OperationalInsightsProps) {
  const activeTickets = tickets.filter(t => t.status !== 'RESOLVED' && t.status !== 'CANCELLED');

  const insights: Insight[] = [];

  // SLA Analysis
  const redTickets = activeTickets.filter(t => getTicketSlaState(t.created_at) === TicketSlaState.RED);
  const overdueTickets = activeTickets.filter(t => getTicketSlaState(t.created_at) === TicketSlaState.OVERDUE);

  if (redTickets.length >= 3) {
    insights.push({
      id: 'red-sla',
      type: 'warning',
      icon: AlertTriangle,
      message: `${redTickets.length} de ${activeTickets.length} tickets activos están entre 48 y 72 horas`,
      count: redTickets.length,
      action: {
        label: 'Ver tickets',
        onClick: () => onNavigate?.('/tickets?sla=red')
      }
    });
  }

  if (overdueTickets.length > 0) {
    insights.push({
      id: 'overdue',
      type: 'warning',
      icon: Clock,
      message: `${overdueTickets.length} ticket${overdueTickets.length > 1 ? 's' : ''} superaron las 72 horas`,
      count: overdueTickets.length,
      action: {
        label: 'Atender ahora',
        onClick: () => onNavigate?.('/tickets?sla=overdue')
      }
    });
  }

  // Technician workload analysis
  const technicianWorkload = new Map<string, { name: string; count: number }>();
  activeTickets.forEach(ticket => {
    if (ticket.technician) {
      const techId = ticket.technician.id;
      const existing = technicianWorkload.get(techId);
      if (existing) {
        existing.count++;
      } else {
        technicianWorkload.set(techId, {
          name: ticket.technician.profile?.full_name || 'Desconocido',
          count: 1
        });
      }
    }
  });

  const overloadedTechnicians = Array.from(technicianWorkload.entries())
    .filter(([_, data]) => data.count >= 5)
    .sort((a, b) => b[1].count - a[1].count);

  if (overloadedTechnicians.length > 0) {
    const [_, data] = overloadedTechnicians[0];
    insights.push({
      id: 'tech-workload',
      type: 'info',
      icon: Users,
      message: `Un técnico tiene ${data.count} tickets abiertos`,
      count: data.count,
      action: {
        label: 'Ver personal',
        onClick: () => onNavigate?.('/technicians')
      }
    });
  }

  // Positive insights
  const greenTickets = activeTickets.filter(t => getTicketSlaState(t.created_at) === TicketSlaState.GREEN);
  if (activeTickets.length > 0 && greenTickets.length / activeTickets.length >= 0.7) {
    insights.push({
      id: 'sla-good',
      type: 'success',
      icon: TrendingUp,
      message: `${Math.round((greenTickets.length / activeTickets.length) * 100)}% de tickets activos dentro de 24 horas`,
      count: greenTickets.length
    });
  }

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Hallazgos Operativos</h3>
      <div className="space-y-3">
        {insights.map(insight => {
          const Icon = insight.icon;
          return (
            <div
              key={insight.id}
              className={`flex items-start gap-3 p-4 rounded-lg border ${
                insight.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-200'
                  : insight.type === 'info'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-green-50 border-green-200'
              }`}
            >
              <Icon
                className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                  insight.type === 'warning'
                    ? 'text-yellow-600'
                    : insight.type === 'info'
                    ? 'text-blue-600'
                    : 'text-green-600'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{insight.message}</p>
                {insight.action && (
                  <button
                    onClick={insight.action.onClick}
                    className="text-sm font-medium mt-2 hover:underline"
                    style={{ color: 'var(--wisper-blue)' }}
                  >
                    {insight.action.label} →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
