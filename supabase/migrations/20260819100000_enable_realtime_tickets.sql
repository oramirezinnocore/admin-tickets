-- Enable Realtime for tickets table
-- This allows clients to subscribe to real-time changes

-- Check if tickets table is already in the publication, add if not
DO $$
BEGIN
  -- Add tickets table to supabase_realtime publication
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
  END IF;
END $$;

-- Grant necessary permissions for realtime
GRANT SELECT ON tickets TO authenticated;

COMMENT ON TABLE tickets IS 'Realtime enabled for ticket assignment notifications';
