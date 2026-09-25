import { TicketSlaState } from './enums';

export function getTicketSlaState(createdAt: string | Date): TicketSlaState {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const hours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

  if (hours <= 24) {
    return TicketSlaState.GREEN;
  } else if (hours <= 48) {
    return TicketSlaState.YELLOW;
  } else if (hours <= 72) {
    return TicketSlaState.RED;
  } else {
    return TicketSlaState.OVERDUE;
  }
}

export function getTicketAgeHours(createdAt: string | Date): number {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  return (now.getTime() - created.getTime()) / (1000 * 60 * 60);
}

export function getTicketSlaLabel(slaState: TicketSlaState): string {
  switch (slaState) {
    case TicketSlaState.GREEN:
      return '0-24 h';
    case TicketSlaState.YELLOW:
      return '24-48 h';
    case TicketSlaState.RED:
      return '48-72 h';
    case TicketSlaState.OVERDUE:
      return 'Vencido +72 h';
    default:
      return '';
  }
}

export function formatTicketAge(createdAt: string | Date): string {
  const hours = getTicketAgeHours(createdAt);

  if (hours < 1) {
    return `${Math.floor(hours * 60)} min`;
  } else if (hours < 24) {
    return `${Math.floor(hours)} h`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days} d ${remainingHours} h`;
  }
}

export function formatTicketFolio(folio: number): string {
  return `#${folio.toString().padStart(6, '0')}`;
}

export function getSlaOrderPriority(slaState: TicketSlaState): number {
  switch (slaState) {
    case TicketSlaState.OVERDUE:
      return 1;
    case TicketSlaState.RED:
      return 2;
    case TicketSlaState.YELLOW:
      return 3;
    case TicketSlaState.GREEN:
      return 4;
    default:
      return 999;
  }
}

/**
 * Format duration in HH:mm:ss format
 * Correctly handles durations > 24 hours (no wrapping)
 * @param startTime - Start timestamp (string or Date)
 * @param endTime - End timestamp (string or Date)
 * @returns Formatted duration string (e.g., "02:30:45", "49:15:22")
 */
export function formatDuration(
  startTime: string | Date | null | undefined,
  endTime: string | Date | null | undefined
): string {
  if (!startTime || !endTime) {
    return 'No disponible';
  }

  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;

  // Calculate total elapsed milliseconds
  const diffMs = end.getTime() - start.getTime();

  if (diffMs < 0) {
    return 'No disponible';
  }

  // Calculate hours, minutes, seconds
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Format as HH:mm:ss (no 24-hour wrapping)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate time from ticket creation to attention start
 * @param createdAt - Ticket creation timestamp
 * @param startedAt - Attention start timestamp
 * @returns Formatted duration or status message
 */
export function formatTimeToAttention(
  createdAt: string | Date | null | undefined,
  startedAt: string | Date | null | undefined
): string {
  if (!createdAt) {
    return 'No disponible';
  }

  if (!startedAt) {
    return 'Pendiente';
  }

  return formatDuration(createdAt, startedAt);
}

/**
 * Calculate time from attention start to ticket closure
 * @param startedAt - Attention start timestamp
 * @param closedAt - Ticket closure timestamp
 * @returns Formatted duration or status message
 */
export function formatAttentionTime(
  startedAt: string | Date | null | undefined,
  closedAt: string | Date | null | undefined
): string {
  if (!startedAt) {
    return 'Pendiente';
  }

  if (!closedAt) {
    return 'En curso';
  }

  return formatDuration(startedAt, closedAt);
}

/**
 * Calculate total ticket lifecycle time
 * @param createdAt - Ticket creation timestamp
 * @param closedAt - Ticket closure timestamp (if null, calculates to current time)
 * @returns Formatted duration or status message
 */
export function formatTotalTicketTime(
  createdAt: string | Date | null | undefined,
  closedAt: string | Date | null | undefined
): string {
  if (!createdAt) {
    return 'No disponible';
  }

  if (!closedAt) {
    return 'En curso';
  }

  return formatDuration(createdAt, closedAt);
}
