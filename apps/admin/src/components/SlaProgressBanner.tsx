'use client';

import { useMemo } from 'react';
import { TicketSlaState, getTicketSlaState, getTicketAgeHours, formatTicketAge } from '@wisper/shared';
import { Clock, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';

interface SlaProgressBannerProps {
  createdAt: string;
  isClosed?: boolean;
}

interface SlaInfo {
  state: TicketSlaState;
  ageHours: number;
  ageFormatted: string;
  nextThreshold: number | null; // hours
  timeToNextThreshold: number | null; // hours remaining
  progressPercent: number; // 0-100
  label: string;
  color: {
    bg: string;
    text: string;
    icon: string;
    bar: string;
    barBg: string;
  };
  icon: React.ElementType;
}

function calculateSlaInfo(createdAt: string): SlaInfo {
  const state = getTicketSlaState(createdAt);
  const ageHours = getTicketAgeHours(createdAt);
  const ageFormatted = formatTicketAge(createdAt);

  let nextThreshold: number | null = null;
  let timeToNextThreshold: number | null = null;
  let progressPercent: number = 0;
  let label: string = '';
  let color = {
    bg: '',
    text: '',
    icon: '',
    bar: '',
    barBg: '',
  };
  let icon: React.ElementType = Clock;

  switch (state) {
    case TicketSlaState.GREEN:
      nextThreshold = 24;
      timeToNextThreshold = 24 - ageHours;
      progressPercent = (ageHours / 24) * 100;
      label = 'Dentro del SLA';
      color = {
        bg: 'bg-green-50',
        text: 'text-green-900',
        icon: 'text-green-600',
        bar: 'bg-green-500',
        barBg: 'bg-green-200',
      };
      icon = CheckCircle;
      break;

    case TicketSlaState.YELLOW:
      nextThreshold = 48;
      timeToNextThreshold = 48 - ageHours;
      progressPercent = ((ageHours - 24) / 24) * 100;
      label = 'Atención requerida';
      color = {
        bg: 'bg-yellow-50',
        text: 'text-yellow-900',
        icon: 'text-yellow-600',
        bar: 'bg-yellow-500',
        barBg: 'bg-yellow-200',
      };
      icon = AlertCircle;
      break;

    case TicketSlaState.RED:
      nextThreshold = 72;
      timeToNextThreshold = 72 - ageHours;
      progressPercent = ((ageHours - 48) / 24) * 100;
      label = 'Urgente';
      color = {
        bg: 'bg-red-50',
        text: 'text-red-900',
        icon: 'text-red-600',
        bar: 'bg-red-500',
        barBg: 'bg-red-200',
      };
      icon = AlertTriangle;
      break;

    case TicketSlaState.OVERDUE:
      nextThreshold = null; // No hay siguiente umbral
      timeToNextThreshold = null;
      progressPercent = 100;
      label = 'SLA vencido';
      color = {
        bg: 'bg-red-100',
        text: 'text-red-900',
        icon: 'text-red-700',
        bar: 'bg-red-700',
        barBg: 'bg-red-300',
      };
      icon = AlertTriangle;
      break;
  }

  return {
    state,
    ageHours,
    ageFormatted,
    nextThreshold,
    timeToNextThreshold,
    progressPercent: Math.min(progressPercent, 100),
    label,
    color,
    icon,
  };
}

function formatTimeRemaining(hours: number | null): string {
  if (hours === null || hours <= 0) {
    return 'N/A';
  }

  if (hours < 1) {
    return `${Math.floor(hours * 60)} min`;
  } else if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return remainingHours > 0 ? `${days} d ${remainingHours} h` : `${days} d`;
  }
}

export default function SlaProgressBanner({ createdAt, isClosed = false }: SlaProgressBannerProps) {
  const slaInfo = useMemo(() => calculateSlaInfo(createdAt), [createdAt]);

  // Si el ticket está cerrado, mostrar versión simplificada
  if (isClosed) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Ticket cerrado</p>
            <p className="text-xs text-gray-600">Antigüedad al cierre: {slaInfo.ageFormatted}</p>
          </div>
        </div>
      </div>
    );
  }

  const Icon = slaInfo.icon;
  const timeRemaining = formatTimeRemaining(slaInfo.timeToNextThreshold);

  return (
    <div className={`rounded-lg border ${slaInfo.color.bg} ${slaInfo.color.text} p-4 md:p-5 transition-colors duration-200`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 md:w-6 md:h-6 ${slaInfo.color.icon} flex-shrink-0`} />
          <div>
            <h3 className="text-sm md:text-base font-semibold">{slaInfo.label}</h3>
            <p className="text-xs md:text-sm opacity-80 mt-0.5">
              Antigüedad: <span className="font-medium">{slaInfo.ageFormatted}</span>
            </p>
          </div>
        </div>

        {/* Time remaining badge */}
        {slaInfo.state !== TicketSlaState.OVERDUE && slaInfo.nextThreshold && (
          <div className="text-right flex-shrink-0">
            <p className="text-xs opacity-70">Tiempo restante</p>
            <p className="text-sm md:text-base font-bold">{timeRemaining}</p>
          </div>
        )}

        {slaInfo.state === TicketSlaState.OVERDUE && (
          <div className="text-right flex-shrink-0">
            <p className="text-xs opacity-70">Excedido por</p>
            <p className="text-sm md:text-base font-bold">
              {formatTimeRemaining(slaInfo.ageHours - 72)}
            </p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="opacity-75">Progreso en el umbral actual</span>
          <span className="font-medium">{Math.round(slaInfo.progressPercent)}%</span>
        </div>
        <div className={`h-2.5 md:h-3 ${slaInfo.color.barBg} rounded-full overflow-hidden`}>
          <div
            className={`h-full ${slaInfo.color.bar} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${slaInfo.progressPercent}%` }}
          />
        </div>

        {/* Threshold labels */}
        {slaInfo.state !== TicketSlaState.OVERDUE && (
          <div className="flex justify-between text-xs opacity-60 mt-1">
            <span>0h</span>
            {slaInfo.nextThreshold && <span>{slaInfo.nextThreshold}h</span>}
          </div>
        )}
      </div>

      {/* Next threshold info */}
      {slaInfo.state !== TicketSlaState.OVERDUE && slaInfo.nextThreshold && (
        <div className="mt-3 pt-3 border-t border-current opacity-30">
          <p className="text-xs">
            {slaInfo.state === TicketSlaState.GREEN && 'Siguiente umbral: Atención requerida (24h)'}
            {slaInfo.state === TicketSlaState.YELLOW && 'Siguiente umbral: Urgente (48h)'}
            {slaInfo.state === TicketSlaState.RED && 'Siguiente umbral: SLA vencido (72h)'}
          </p>
        </div>
      )}
    </div>
  );
}
