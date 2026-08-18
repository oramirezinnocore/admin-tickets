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
