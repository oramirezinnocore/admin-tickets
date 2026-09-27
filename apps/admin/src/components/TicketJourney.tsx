'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Circle, Clock, FileText, Image, PenTool, XCircle, AlertCircle } from 'lucide-react';
import { Ticket } from '@wisper/shared';

interface JourneyStep {
  id: string;
  label: string;
  icon: React.ElementType;
  status: 'completed' | 'current' | 'pending' | 'cancelled';
  timestamp?: string;
  description?: string;
  details?: string[];
}

interface TicketJourneyProps {
  ticket: Ticket;
  compact?: boolean;
  hasEvidence?: boolean;
  hasSignature?: boolean;
  evidenceLoading?: boolean;
  signatureLoading?: boolean;
  evidenceError?: boolean;
  signatureError?: boolean;
}

export default function TicketJourney({
  ticket,
  compact = false,
  hasEvidence = false,
  hasSignature = false,
  evidenceLoading = false,
  signatureLoading = false,
  evidenceError = false,
  signatureError = false
}: TicketJourneyProps) {
  const [selectedStepId, setSelectedStepId] = useState<string>('created');

  const steps: JourneyStep[] = [
    {
      id: 'created',
      label: 'Creado',
      icon: FileText,
      status: 'completed',
      timestamp: ticket.created_at,
      description: 'Ticket reportado',
      details: [
        `Fecha: ${new Date(ticket.created_at).toLocaleString('es-MX', {
          dateStyle: 'medium',
          timeStyle: 'short'
        })}`,
        ticket.failure_type ? `Tipo de falla: ${ticket.failure_type}` : undefined,
      ].filter(Boolean) as string[]
    },
    {
      id: 'assigned',
      label: 'Asignado',
      icon: Clock,
      status: ticket.technician_id ? 'completed' : 'pending',
      timestamp: ticket.assigned_at || undefined,
      description: ticket.technician_id ? 'Técnico asignado' : 'Pendiente de asignación',
      details: ticket.technician_id ? [
        ticket.assigned_at
          ? `Fecha: ${new Date(ticket.assigned_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`
          : 'Fecha de asignación no disponible',
      ] : ['El ticket aún no ha sido asignado a un técnico']
    },
    {
      id: 'started',
      label: 'En atención',
      icon: Clock,
      status: ticket.started_at ? 'completed' : ticket.status === 'CANCELLED' ? 'cancelled' : 'pending',
      timestamp: ticket.started_at || undefined,
      description: ticket.started_at ? 'Atención iniciada' : 'Pendiente de inicio',
      details: ticket.started_at ? [
        `Fecha: ${new Date(ticket.started_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`
      ] : ['El técnico aún no ha iniciado la atención']
    },
    {
      id: 'evidence',
      label: 'Evidencia',
      icon: Image,
      status: hasEvidence ? 'completed' : ticket.status === 'CANCELLED' ? 'cancelled' : 'pending',
      description: evidenceError
        ? 'No se pudo verificar'
        : evidenceLoading
        ? 'Verificando...'
        : hasEvidence
        ? 'Fotografías adjuntas'
        : 'Sin fotografías',
      details: evidenceError
        ? ['Ocurrió un error al consultar las evidencias', 'Intenta recargar la página']
        : evidenceLoading
        ? ['Consultando evidencias en la base de datos...']
        : hasEvidence
        ? ['El técnico adjuntó fotografías del trabajo', 'Visible en la bitácora del ticket']
        : ['No se han adjuntado fotografías todavía']
    },
    {
      id: 'signature',
      label: 'Firma',
      icon: PenTool,
      status: hasSignature ? 'completed' : ticket.status === 'CANCELLED' ? 'cancelled' : 'pending',
      description: signatureError
        ? 'No se pudo verificar'
        : signatureLoading
        ? 'Verificando...'
        : hasSignature
        ? 'Firmado por cliente'
        : 'Sin firma',
      details: signatureError
        ? ['Ocurrió un error al consultar la firma', 'Intenta recargar la página']
        : signatureLoading
        ? ['Consultando firma en la base de datos...']
        : hasSignature
        ? ['El cliente firmó la orden de servicio', 'Visible en la bitácora del ticket']
        : ['El cliente aún no ha firmado la orden']
    },
    {
      id: 'closed',
      label: ticket.status === 'CANCELLED' ? 'Cancelado' : 'Cerrado',
      icon: ticket.status === 'CANCELLED' ? XCircle : CheckCircle,
      status: ticket.status === 'RESOLVED' ? 'completed' : ticket.status === 'CANCELLED' ? 'cancelled' : 'pending',
      timestamp: ticket.closed_at || undefined,
      description: ticket.status === 'RESOLVED'
        ? 'Ticket completado'
        : ticket.status === 'CANCELLED'
        ? 'Ticket cancelado'
        : 'Pendiente de cierre',
      details: ticket.status === 'RESOLVED' || ticket.status === 'CANCELLED' ? [
        ticket.closed_at
          ? `Fecha: ${new Date(ticket.closed_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`
          : 'Fecha de cierre no disponible',
        ticket.close_reason ? `Razón: ${ticket.close_reason}` : undefined,
        ticket.solution_text ? `Solución: ${ticket.solution_text}` : undefined
      ].filter(Boolean) as string[] : ['El ticket aún no ha sido cerrado']
    }
  ];

  // Auto-select first non-pending step or 'created' on mount
  useEffect(() => {
    const firstActiveStep = steps.find(s => s.status === 'current') ||
                            steps.find(s => s.status === 'completed') ||
                            steps[0];
    setSelectedStepId(firstActiveStep.id);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, stepId: string) => {
    const currentIndex = steps.findIndex(s => s.id === stepId);

    if (e.key === 'ArrowLeft' && currentIndex > 0) {
      e.preventDefault();
      const prevStep = steps[currentIndex - 1];
      setSelectedStepId(prevStep.id);
      // Focus the previous button
      const prevButton = document.querySelector(`[data-step-id="${prevStep.id}"]`) as HTMLButtonElement;
      prevButton?.focus();
    } else if (e.key === 'ArrowRight' && currentIndex < steps.length - 1) {
      e.preventDefault();
      const nextStep = steps[currentIndex + 1];
      setSelectedStepId(nextStep.id);
      // Focus the next button
      const nextButton = document.querySelector(`[data-step-id="${nextStep.id}"]`) as HTMLButtonElement;
      nextButton?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedStepId(stepId);
    }
  };

  const selectedStep = steps.find(s => s.id === selectedStepId) || steps[0];

  // Compact mode: horizontal icons only (preserved for backward compatibility)
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

  // Full interactive horizontal journey
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Progreso del Ticket</h3>
      </div>

      {/* Horizontal Steps */}
      <div className="px-4 py-6">
        <div
          className="flex items-center justify-start gap-1 md:gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          role="tablist"
          aria-label="Etapas del ticket"
        >
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isSelected = selectedStepId === step.id;
            const isCompleted = step.status === 'completed';
            const isCancelled = step.status === 'cancelled';
            const isPending = step.status === 'pending';
            const isLast = index === steps.length - 1;

            // Status icon for evidence and signature loading/error states
            let StatusIcon: React.ElementType | null = null;
            if (step.id === 'evidence' || step.id === 'signature') {
              if (step.id === 'evidence' && evidenceLoading) {
                StatusIcon = Clock;
              } else if (step.id === 'evidence' && evidenceError) {
                StatusIcon = AlertCircle;
              } else if (step.id === 'signature' && signatureLoading) {
                StatusIcon = Clock;
              } else if (step.id === 'signature' && signatureError) {
                StatusIcon = AlertCircle;
              }
            }

            return (
              <div key={step.id} className="flex items-center">
                {/* Step Button */}
                <button
                  data-step-id={step.id}
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`panel-${step.id}`}
                  onClick={() => setSelectedStepId(step.id)}
                  onKeyDown={(e) => handleKeyDown(e, step.id)}
                  className={`
                    group flex flex-col items-center gap-1.5 px-1 py-1.5 md:px-1.5 md:py-2 rounded-lg transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    motion-reduce:transition-none
                    ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  `}
                >
                  {/* Icon Circle */}
                  <div className="relative">
                    <div
                      className={`
                        relative z-10 flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full transition-all duration-200
                        motion-reduce:transition-none
                        ${isCompleted
                          ? 'bg-green-100 text-green-600 border-2 border-green-400'
                          : isCancelled
                          ? 'bg-red-100 text-red-600 border-2 border-red-400'
                          : isPending
                          ? 'bg-gray-100 text-gray-400 border-2 border-gray-300'
                          : 'bg-blue-100 text-blue-600 border-2 border-blue-400'
                        }
                        ${isSelected ? 'border-blue-500 shadow-sm' : ''}
                      `}
                    >
                      <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </div>

                    {/* Loading/Error Badge */}
                    {StatusIcon && (
                      <div className={`
                        absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full border border-white
                        ${(evidenceLoading || signatureLoading) ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}
                      `}>
                        <StatusIcon className="h-2.5 w-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <span className={`
                    text-xs md:text-sm font-medium whitespace-nowrap transition-colors duration-200
                    ${isCompleted ? 'text-gray-900' : isCancelled ? 'text-red-700' : isPending ? 'text-gray-500' : 'text-blue-700'}
                    ${isSelected ? 'font-semibold' : ''}
                  `}>
                    {step.label}
                  </span>

                  {/* Timestamp (optional, only if completed) */}
                  {step.timestamp && !isPending && (
                    <span className="text-xs text-gray-500 whitespace-nowrap hidden md:block">
                      {new Date(step.timestamp).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </span>
                  )}
                </button>

                {/* Connector Line */}
                {!isLast && (
                  <div
                    className={`
                      h-0.5 w-3 md:w-4 transition-colors duration-200
                      motion-reduce:transition-none
                      ${isCompleted ? 'bg-green-300' : 'bg-gray-300'}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Context Panel */}
      <div
        id={`panel-${selectedStep.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${selectedStep.id}`}
        className="px-4 pb-4"
      >
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 transition-all duration-200 motion-reduce:transition-none">
          {/* Panel Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`
              flex-shrink-0 p-2 rounded-lg
              ${selectedStep.status === 'completed'
                ? 'bg-green-100 text-green-600'
                : selectedStep.status === 'cancelled'
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-200 text-gray-600'
              }
            `}>
              {(() => {
                const StepIcon = selectedStep.icon;
                return <StepIcon className="h-5 w-5" />;
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                {selectedStep.label}
              </h4>
              <p className="text-sm text-gray-600">
                {selectedStep.description}
              </p>
            </div>
          </div>

          {/* Panel Details */}
          {selectedStep.details && selectedStep.details.length > 0 && (
            <div className="space-y-1.5">
              {selectedStep.details.map((detail, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <Circle className="h-1.5 w-1.5 mt-1.5 flex-shrink-0 fill-current text-gray-400" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
