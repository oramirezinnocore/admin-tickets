'use client';

import { AlertTriangle, Clock } from 'lucide-react';
import { Ticket, Client, Technician, Profile, formatTicketFolio, formatTicketAge, getTicketSlaState, TicketSlaState } from '@wisper/shared';
import StatusBadge from './ui/StatusBadge';

interface TicketWithRelations extends Ticket {
  client: Client;
  technician: (Technician & { profile: Profile }) | null;
}

interface AttentionPanelProps {
  tickets: TicketWithRelations[];
  onTicketClick: (ticketId: string) => void;
}

export default function AttentionPanel({ tickets, onTicketClick }: AttentionPanelProps) {
  // Filter active tickets that are red or overdue
  const urgentTickets = tickets
    .filter(t => t.status !== 'RESOLVED' && t.status !== 'CANCELLED')
    .filter(t => {
      const sla = getTicketSlaState(t.created_at);
      return sla === TicketSlaState.RED || sla === TicketSlaState.OVERDUE;
    })
    .sort((a, b) => {
      // Sort by oldest first
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    .slice(0, 10); // Show top 10

  if (urgentTickets.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Clock className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Requieren tu atención</h2>
            <p className="text-sm text-gray-600">Tickets próximos a vencer o vencidos</p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">
            ✓ Todos los tickets están dentro del SLA esperado
          </p>
        </div>
      </div>
    );
  }

  const overdueCount = urgentTickets.filter(t => getTicketSlaState(t.created_at) === TicketSlaState.OVERDUE).length;
  const redCount = urgentTickets.filter(t => getTicketSlaState(t.created_at) === TicketSlaState.RED).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200" style={{ backgroundColor: '#fff5f5' }}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Requieren tu atención</h2>
            <p className="text-sm text-gray-600">
              {overdueCount > 0 && `${overdueCount} vencido${overdueCount > 1 ? 's' : ''}`}
              {overdueCount > 0 && redCount > 0 && ', '}
              {redCount > 0 && `${redCount} próximo${redCount > 1 ? 's' : ''} a vencer`}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {urgentTickets.map(ticket => {
          const slaState = getTicketSlaState(ticket.created_at);
          const isOverdue = slaState === TicketSlaState.OVERDUE;
          const createdDate = new Date(ticket.created_at);
          const now = new Date();
          const hoursElapsed = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
          const hoursRemaining = 72 - hoursElapsed;

          return (
            <div
              key={ticket.id}
              onClick={() => onTicketClick(ticket.id)}
              className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                isOverdue ? 'bg-red-50/30' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-mono text-sm font-semibold text-gray-900">
                      {formatTicketFolio(ticket.folio)}
                    </p>
                    <StatusBadge
                      status={isOverdue ? 'Vencido' : 'Rojo'}
                      variant="danger"
                      size="sm"
                      dot
                    />
                  </div>
                  <p className="text-sm text-gray-900 font-medium truncate">{ticket.client?.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {ticket.technician?.profile?.full_name || 'Sin asignar'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${isOverdue ? 'text-red-700' : 'text-orange-700'}`}>
                    {formatTicketAge(ticket.created_at)}
                  </p>
                  {!isOverdue && hoursRemaining > 0 && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {Math.floor(hoursRemaining)}h restantes
                    </p>
                  )}
                  {isOverdue && (
                    <p className="text-xs text-red-600 mt-0.5">
                      +{Math.floor(hoursElapsed - 72)}h vencido
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
