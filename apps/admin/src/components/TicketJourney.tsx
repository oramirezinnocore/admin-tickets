'use client';

import { CheckCircle, Circle, Clock, FileText, Image, PenTool, XCircle } from 'lucide-react';
import { Ticket } from '@wisper/shared';

interface JourneyStep {
  id: string;
  label: string;
  icon: React.ElementType;
  status: 'completed' | 'current' | 'pending' | 'cancelled';
  timestamp?: string;
  description?: string;
}

interface TicketJourneyProps {
  ticket: Ticket;
  compact?: boolean;
  hasEvidence?: boolean;
  hasSignature?: boolean;
}

export default function TicketJourney({ ticket, compact = false, hasEvidence = false, hasSignature = false }: TicketJourneyProps) {
  const steps: JourneyStep[] = [
    {
      id: 'created',
      label: 'Creado',
      icon: FileText,
      status: 'completed',
      timestamp: ticket.created_at,
      description: 'Ticket reportado'
    },
    {
      id: 'assigned',
      label: 'Asignado',
      icon: Clock,
      status: ticket.technician_id ? 'completed' : 'pending',
      timestamp: ticket.created_at, // Note: No explicit assignment timestamp in schema
      description: ticket.technician_id ? 'Técnico asignado' : 'Pendiente de asignación'
    },
    {
      id: 'started',
      label: 'En atención',
      icon: Clock,
      status: ticket.started_at ? 'completed' : ticket.status === 'CANCELLED' ? 'cancelled' : 'pending',
      timestamp: ticket.started_at || undefined,
      description: ticket.started_at ? 'Atención iniciada' : 'Pendiente de inicio'
    },
    {
      id: 'evidence',
      label: 'Evidencia',
      icon: Image,
      status: hasEvidence ? 'completed' : ticket.status === 'CANCELLED' ? 'cancelled' : 'pending',
      description: hasEvidence ? 'Fotografías adjuntas' : 'Sin fotografías'
    },
    {
      id: 'signature',
      label: 'Firma',
      icon: PenTool,
      status: hasSignature ? 'completed' : ticket.status === 'CANCELLED' ? 'cancelled' : 'pending',
      description: hasSignature ? 'Firmado por cliente' : 'Sin firma'
    },
    {
      id: 'closed',
      label: ticket.status === 'CANCELLED' ? 'Cancelado' : 'Cerrado',
      icon: ticket.status === 'CANCELLED' ? XCircle : CheckCircle,
      status: ticket.status === 'RESOLVED' ? 'completed' : ticket.status === 'CANCELLED' ? 'cancelled' : 'pending',
      timestamp: ticket.closed_at || undefined,
      description: ticket.status === 'RESOLVED' ? 'Ticket completado' : ticket.status === 'CANCELLED' ? 'Ticket cancelado' : 'Pendiente de cierre'
    }
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className="flex items-center">
              <div
                className={`p-1.5 rounded-full ${
                  step.status === 'completed'
                    ? 'bg-green-100 text-green-600'
                    : step.status === 'cancelled'
                    ? 'bg-red-100 text-red-600'
                    : step.status === 'current'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
                title={step.label}
              >
                <Icon className="h-3 w-3" />
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-4 h-0.5 ${
                    step.status === 'completed' ? 'bg-green-200' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Progreso del Ticket</h3>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gray-200" />

        {/* Steps */}
        <div className="space-y-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="relative flex items-start gap-4">
                {/* Icon */}
                <div
                  className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-4 border-white transition-all ${
                    step.status === 'completed'
                      ? 'bg-green-100 text-green-600 shadow-sm'
                      : step.status === 'cancelled'
                      ? 'bg-red-100 text-red-600 shadow-sm'
                      : step.status === 'current'
                      ? 'bg-blue-100 text-blue-600 shadow-sm ring-4 ring-blue-50'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={`text-sm font-semibold ${
                      step.status === 'completed'
                        ? 'text-gray-900'
                        : step.status === 'cancelled'
                        ? 'text-red-700'
                        : step.status === 'current'
                        ? 'text-blue-700'
                        : 'text-gray-500'
                    }`}>
                      {step.label}
                    </h4>
                    {step.timestamp && (
                      <span className="text-xs text-gray-500">
                        {new Date(step.timestamp).toLocaleString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p className="text-sm text-gray-600">{step.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
