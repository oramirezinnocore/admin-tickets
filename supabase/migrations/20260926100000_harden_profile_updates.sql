-- WIS-PERSONNEL-RBAC-01 COMPLETION: Harden profile UPDATE policies
-- CRITICAL FIX: Prevent ADMIN from escalating to SUPER_ADMIN
-- CRITICAL FIX: Prevent SUPPORT from modifying profiles
-- CRITICAL FIX: Limit what TECHNICIAN can update in own profile

-- Drop existing overly permissive UPDATE policy
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Replace with hardened policy that prevents role changes
CREATE POLICY "Admins can update profiles with restrictions"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    -- Caller must be ADMIN or SUPER_ADMIN
    (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('ADMIN', 'SUPER_ADMIN')
  )
  WITH CHECK (
    -- Cannot change role field
    role = (SELECT role FROM public.profiles WHERE id = profiles.id)
    -- Enforce through application API which has proper authorization
  );

-- Technician can update own profile (limited fields)
-- Drop and recreate to be explicit about what can change
DROP POLICY IF EXISTS "Technicians can update own profile" ON profiles;

CREATE POLICY "Technicians can update own profile limited"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'TECHNICIAN'
  )
  WITH CHECK (
    id = auth.uid()
    -- Cannot change role
    AND role = (SELECT role FROM public.profiles WHERE id = profiles.id)
    -- Cannot change email
    AND email = (SELECT email FROM public.profiles WHERE id = profiles.id)
    -- Cannot change is_active
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = profiles.id)
    -- Can only update: full_name, phone
  );

-- SUPER_ADMIN policy for updates (unrestricted, for system management)
CREATE POLICY "SUPER_ADMIN can update profiles unrestricted"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  )
  WITH CHECK (
    -- SUPER_ADMIN can update everything
    true
  );

-- Ensure SUPPORT has NO UPDATE access to profiles
-- SUPPORT only has SELECT policy (already exists)
-- No UPDATE policy = no update capability

-- Comment
COMMENT ON POLICY "Admins can update profiles with restrictions" ON profiles IS
  'ADMIN can update profile data but CANNOT change role field. Role changes must go through authorized API endpoints.';

COMMENT ON POLICY "Technicians can update own profile limited" ON profiles IS
  'TECHNICIAN can update only full_name and phone in own profile. Cannot change role, email, or is_active.';

COMMENT ON POLICY "SUPER_ADMIN can update profiles unrestricted" ON profiles IS
  'SUPER_ADMIN has full update access for system management. This is intentionally unrestricted.';
