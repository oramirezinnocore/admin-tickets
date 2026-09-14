-- Allow SUPER_ADMIN to upload ticket evidences
-- WIS-HF-ADMIN-RESOLVE-EVIDENCE-02

-- Drop existing admin policy and recreate with SUPER_ADMIN support
DROP POLICY IF EXISTS "Admins can upload evidences" ON storage.objects;

CREATE POLICY "Admins and Super Admins can upload evidences"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-evidences' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- Update read policy to include SUPER_ADMIN
DROP POLICY IF EXISTS "Admins and technicians can read evidences" ON storage.objects;

CREATE POLICY "Admins, Super Admins and technicians can read evidences"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-evidences' AND
  (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('ADMIN', 'SUPER_ADMIN')
    ) OR
    EXISTS (SELECT 1 FROM technicians WHERE profile_id = auth.uid())
  )
);

COMMENT ON POLICY "Admins and Super Admins can upload evidences" ON storage.objects IS
'Updated 2026-09-12: Allow both ADMIN and SUPER_ADMIN to upload ticket evidences for administrative resolution';
