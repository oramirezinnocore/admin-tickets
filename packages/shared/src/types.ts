import { UserRole, TicketStatus } from './enums';

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  address: string;
  reference: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Technician {
  id: string;
  profile_id: string;
  zone: string | null;
  vehicle: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  folio: number;
  client_id: string;
  technician_id: string | null;
  failure_type: string;
  solution_text: string | null;
  technician_notes: string | null;
  admin_notes: string | null;
  priority: number;
  status: TicketStatus;
  created_at: string;
  assigned_at: string | null;
  started_at: string | null;
  closed_at: string | null;
  updated_at: string;
  close_reason: string | null;
}

export interface TicketEvidence {
  id: string;
  ticket_id: string;
  type: string;
  file_url: string;
  created_by: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface TicketStatusHistory {
  id: string;
  ticket_id: string;
  previous_status: TicketStatus | null;
  new_status: TicketStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface TicketSignature {
  id: string;
  ticket_id: string;
  signature_url: string;
  signed_by_name: string | null;
  latitude: number | null;
  longitude: number | null;
  signed_at: string;
}

export interface TechnicianLocation {
  id: number;
  technician_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
}

export type EvidenceType = 'SOLUTION' | 'OBSERVATION';
