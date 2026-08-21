-- Set REPLICA IDENTITY FULL for tickets table
-- This allows Realtime to access old values in UPDATE events
-- Required for detecting when tickets are reassigned away from a technician

ALTER TABLE public.tickets REPLICA IDENTITY FULL;

COMMENT ON TABLE public.tickets IS 'REPLICA IDENTITY FULL enabled for Realtime old record access';
