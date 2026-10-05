export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  SUPPORT = 'SUPPORT',
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

export enum TechnicianMarkerIcon {
  CAR = 'CAR',
  VAN = 'VAN',
  MOTORCYCLE = 'MOTORCYCLE',
  PERSON = 'PERSON'
}

export enum TechnicianMarkerColor {
  BLUE = 'BLUE',
  GREEN = 'GREEN',
  ORANGE = 'ORANGE',
  PURPLE = 'PURPLE',
  RED = 'RED',
  CYAN = 'CYAN',
  AMBER = 'AMBER',
  PINK = 'PINK'
}
