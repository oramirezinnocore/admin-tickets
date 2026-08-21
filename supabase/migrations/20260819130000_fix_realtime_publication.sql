-- Force enable Realtime for tickets table
-- This migration ensures tickets is properly added to supabase_realtime publication

-- Ensure tickets table is in supabase_realtime publication
DO $$
BEGIN
  -- Try to drop first (will silently fail if not present)
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.tickets;
  EXCEPTION
    WHEN undefined_object THEN
      NULL; -- Table was not in publication, that's OK
  END;

  -- Now add it
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
END $$;

-- Verify REPLICA IDENTITY is FULL (required for old record access)
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

-- Grant SELECT permission to authenticated role (required for Realtime)
GRANT SELECT ON public.tickets TO authenticated;

-- Verify current_technician_id function exists and is accessible
GRANT EXECUTE ON FUNCTION public.current_technician_id() TO authenticated;

COMMENT ON TABLE public.tickets IS 'Realtime enabled with REPLICA IDENTITY FULL';
