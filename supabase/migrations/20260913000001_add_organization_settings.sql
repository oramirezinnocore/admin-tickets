-- Add organization settings table for office location
-- WIS-CLIENT-FEEDBACK-CLOSEOUT-01 - Office location for map default center

CREATE TABLE organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_address text,
  office_latitude double precision,
  office_longitude double precision,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_latitude CHECK (office_latitude IS NULL OR (office_latitude >= -90 AND office_latitude <= 90)),
  CONSTRAINT valid_longitude CHECK (office_longitude IS NULL OR (office_longitude >= -180 AND office_longitude <= 180))
);

-- Ensure only one row exists (singleton pattern)
CREATE UNIQUE INDEX organization_settings_singleton ON organization_settings ((true));

-- Insert default row (coordinates can be updated by admin)
INSERT INTO organization_settings (office_address, office_latitude, office_longitude)
VALUES (NULL, NULL, NULL);

-- RLS policies
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- Admins and Super Admins can read
CREATE POLICY "Admins can read organization settings"
ON organization_settings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- Only Super Admins can update
CREATE POLICY "Super Admins can update organization settings"
ON organization_settings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'SUPER_ADMIN'
  )
);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_organization_settings
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE organization_settings IS 'Singleton table for organization-wide settings including office location for map default center';
