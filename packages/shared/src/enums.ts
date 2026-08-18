export enum UserRole {
  ADMIN = 'ADMIN',
  TECHNICIAN = 'TECHNICIAN'
}

export enum TicketStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_REVIEW = 'IN_REVIEW',
  PAUSED = 'PAUSED',
  RESOLVED = 'RESOLVED',
  CANCELLED = 'CANCELLED'
}

export enum TicketSlaState {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
  OVERDUE = 'OVERDUE'
}
