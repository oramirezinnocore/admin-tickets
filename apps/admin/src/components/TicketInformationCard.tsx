'use client';

import { useState } from 'react';
import { FileText, Copy, Check, AlertCircle } from 'lucide-react';
import { Ticket, formatTicketFolio } from '@wisper/shared';

interface TicketInformationCardProps {
  ticket: Ticket;
}

export default function TicketInformationCard({ ticket }: TicketInformationCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyFolio = async () => {
    try {
      await navigator.clipboard.writeText(formatTicketFolio(ticket.folio));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  const hasAnyContent = ticket.failure_type || ticket.admin_notes || ticket.technician_notes || ticket.solution_text || ticket.close_reason;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Información del ticket</h2>
          </div>

          {/* Folio Chip con botón de copiar */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold tabular-nums">
              {formatTicketFolio(ticket.folio)}
            </span>
            <button
              onClick={handleCopyFolio}
              className="p-2 rounded-lg hover:bg-indigo-100 text-indigo-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 motion-reduce:transition-none"
              title={copied ? 'Copiado' : 'Copiar folio'}
              aria-label={copied ? 'Folio copiado' : 'Copiar folio'}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {hasAnyContent ? (
          <div className="space-y-5">
            {/* Tipo de falla */}
            {ticket.failure_type && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <dt className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-1">
                    Tipo de falla
                  </dt>
                  <dd className="text-sm text-amber-900 font-medium">
                    {ticket.failure_type}
                  </dd>
                </div>
              </div>
            )}

            {/* Grid de campos */}
            <div className="grid grid-cols-1 gap-4">
              {/* Observaciones administrativas */}
              {ticket.admin_notes && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <dt className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-2">
                    Observaciones
                  </dt>
                  <dd className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {ticket.admin_notes}
                  </dd>
                </div>
              )}

              {/* Notas del técnico */}
              {ticket.technician_notes && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <dt className="text-xs font-semibold text-purple-900 uppercase tracking-wide mb-2">
                    Notas del técnico
                  </dt>
                  <dd className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {ticket.technician_notes}
                  </dd>
                </div>
              )}

              {/* Solución */}
              {ticket.solution_text && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <dt className="text-xs font-semibold text-green-900 uppercase tracking-wide mb-2">
                    Solución
                  </dt>
                  <dd className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {ticket.solution_text}
                  </dd>
                </div>
              )}

              {/* Razón de cierre */}
              {ticket.close_reason && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <dt className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Razón de cierre
                  </dt>
                  <dd className="text-sm text-gray-900 font-medium">
                    {ticket.close_reason}
                  </dd>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium">
              Sin información adicional
            </p>
            <p className="text-xs text-gray-400 mt-1">
              No hay observaciones, notas o detalles registrados
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
