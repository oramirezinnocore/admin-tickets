-- Add ADMIN_RESOLVED to ticket_activity_type enum
-- WIS-CLIENT-FEEDBACK-01

ALTER TYPE ticket_activity_type ADD VALUE IF NOT EXISTS 'ADMIN_RESOLVED';

COMMENT ON TYPE ticket_activity_type IS 'Updated 2026-09-11: Added ADMIN_RESOLVED for administrative ticket resolution';
