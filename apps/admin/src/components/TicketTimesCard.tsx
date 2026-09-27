'use client';

import { Clock, Timer, Calendar, CheckCircle, Circle } from 'lucide-react';
import {
  Ticket,
  formatTicketAge,
  formatTimeToAttention,
  formatAttentionTime,
  formatTotalTicketTime,
} from '@wisper/shared';

interface TicketTimesCardProps {
  ticket: Ticket;
}

export default function TicketTimesCard({ ticket }: TicketTimesCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Tiempos</h2>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Métrica Principal: Antigüedad Total */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-200 p-6 transition-all duration-200 hover:shadow-sm motion-reduce:transition-none">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-blue-700 uppercase tracking-wide">
              <Timer className="w-4 h-4" />
              <span>Antigüedad Total</span>
            </div>
            <div className="text-4xl font-bold text-blue-900 tabular-nums">
              {formatTicketAge(ticket.created_at)}
            </div>
            <div className="text-sm text-blue-700">
              Desde {new Date(ticket.created_at).toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
        </div>

        {/* Tres Métricas Secundarias */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tiempo hasta atención */}
          <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg border border-purple-200 p-4 transition-all duration-200 hover:border-purple-300 hover:shadow-sm motion-reduce:transition-none">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-purple-700 uppercase tracking-wide">
                <Circle className="w-3 h-3" />
                <span>Tiempo hasta atención</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">
                {formatTimeToAttention(ticket.created_at, ticket.started_at)}
              </div>
              <div className="text-xs text-gray-600">
                Creación → Inicio
              </div>
            </div>
          </div>

          {/* Tiempo de atención */}
          <div className="bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-200 p-4 transition-all duration-200 hover:border-green-300 hover:shadow-sm motion-reduce:transition-none">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-green-700 uppercase tracking-wide">
                <Timer className="w-3 h-3" />
                <span>Tiempo de atención</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">
                {formatAttentionTime(ticket.started_at, ticket.closed_at)}
              </div>
              <div className="text-xs text-gray-600">
                Inicio → Cierre
              </div>
            </div>
          </div>

          {/* Tiempo total del ticket */}
          <div className="bg-gradient-to-br from-amber-50 to-white rounded-lg border border-amber-200 p-4 transition-all duration-200 hover:border-amber-300 hover:shadow-sm motion-reduce:transition-none">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-700 uppercase tracking-wide">
                <Calendar className="w-3 h-3" />
                <span>Tiempo total</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">
                {formatTotalTicketTime(ticket.created_at, ticket.closed_at)}
              </div>
              <div className="text-xs text-gray-600">
                Creación → Cierre
              </div>
            </div>
          </div>
        </div>

        {/* Timeline de Hitos Importantes */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
            Hitos Importantes
          </h3>
          <div className="relative">
            {/* Línea vertical */}
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-300 to-gray-200"></div>

            {/* Hitos */}
            <div className="relative space-y-4">
              {/* Creado (siempre presente) */}
              <div className="flex items-start gap-4 relative">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 border-4 border-white shadow-md z-10 ring-2 ring-blue-100"></div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">Creado</span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {new Date(ticket.created_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <span className="text-xs text-gray-600">
                    {new Date(ticket.created_at).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {/* Asignado (condicional) */}
              {ticket.assigned_at && (
                <div className="flex items-start gap-4 relative">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500 border-4 border-white shadow-md z-10 ring-2 ring-purple-100"></div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">Asignado</span>
                      <span className="text-xs text-gray-500 tabular-nums">
                        {new Date(ticket.assigned_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <span className="text-xs text-gray-600">
                      {new Date(ticket.assigned_at).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              )}

              {/* Inicio de atención (condicional) */}
              {ticket.started_at && (
                <div className="flex items-start gap-4 relative">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 border-4 border-white shadow-md z-10 ring-2 ring-green-100"></div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">Inicio de atención</span>
                      <span className="text-xs text-gray-500 tabular-nums">
                        {new Date(ticket.started_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <span className="text-xs text-gray-600">
                      {new Date(ticket.started_at).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              )}

              {/* Cerrado (condicional) */}
              {ticket.closed_at && (
                <div className="flex items-start gap-4 relative">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-4 border-white shadow-md z-10 flex items-center justify-center ${
                    ticket.status === 'RESOLVED'
                      ? 'bg-emerald-600 ring-2 ring-emerald-100'
                      : 'bg-red-600 ring-2 ring-red-100'
                  }`}>
                    {ticket.status === 'RESOLVED' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        {ticket.status === 'RESOLVED' ? 'Cerrado' : 'Cancelado'}
                      </span>
                      <span className="text-xs text-gray-500 tabular-nums">
                        {new Date(ticket.closed_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <span className="text-xs text-gray-600">
                      {new Date(ticket.closed_at).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
