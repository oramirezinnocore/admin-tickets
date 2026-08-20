-- Create table for storing Expo Push Tokens
CREATE TABLE IF NOT EXISTS technician_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT,
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure one token per technician per device
  UNIQUE(technician_id, expo_push_token)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_technician_push_tokens_technician_id
  ON technician_push_tokens(technician_id);

CREATE INDEX IF NOT EXISTS idx_technician_push_tokens_active
  ON technician_push_tokens(technician_id, is_active)
  WHERE is_active = true;

-- RLS Policies
ALTER TABLE technician_push_tokens ENABLE ROW LEVEL SECURITY;

-- Helper function to get current technician_id
CREATE OR REPLACE FUNCTION auth.current_technician_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT technician_id
  FROM technicians
  WHERE profile_id = auth.uid()
  LIMIT 1;
$$;

-- Technicians can only manage their own tokens
CREATE POLICY "Technicians can view their own push tokens"
  ON technician_push_tokens
  FOR SELECT
  TO authenticated
  USING (technician_id = auth.current_technician_id());

CREATE POLICY "Technicians can insert their own push tokens"
  ON technician_push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (technician_id = auth.current_technician_id());

CREATE POLICY "Technicians can update their own push tokens"
  ON technician_push_tokens
  FOR UPDATE
  TO authenticated
  USING (technician_id = auth.current_technician_id())
  WITH CHECK (technician_id = auth.current_technician_id());

CREATE POLICY "Technicians can delete their own push tokens"
  ON technician_push_tokens
  FOR DELETE
  TO authenticated
  USING (technician_id = auth.current_technician_id());

-- Admins can read all tokens (for server-side push sending)
CREATE POLICY "Admins can view all push tokens"
  ON technician_push_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_technician_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_technician_push_tokens_updated_at
  BEFORE UPDATE ON technician_push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_technician_push_tokens_updated_at();

COMMENT ON TABLE technician_push_tokens IS 'Stores Expo Push Tokens for sending notifications to technicians';
