-- Add SUPER_ADMIN role to user_role enum
-- This migration is idempotent and safe to run multiple times

DO $$
BEGIN
  -- Check if SUPER_ADMIN already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'SUPER_ADMIN'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    -- Add SUPER_ADMIN to the enum
    ALTER TYPE user_role ADD VALUE 'SUPER_ADMIN';
    RAISE NOTICE 'Added SUPER_ADMIN to user_role enum';
  ELSE
    RAISE NOTICE 'SUPER_ADMIN already exists in user_role enum';
  END IF;
END$$;

-- Create helper functions for role checks
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role_value user_role;
BEGIN
  SELECT role INTO user_role_value
  FROM profiles
  WHERE id = auth.uid();

  RETURN user_role_value;
END;
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN current_user_role() = 'SUPER_ADMIN';
END;
$$;

CREATE OR REPLACE FUNCTION is_admin_or_super()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  role_value user_role;
BEGIN
  role_value := current_user_role();
  RETURN role_value = 'ADMIN' OR role_value = 'SUPER_ADMIN';
END;
$$;

-- Update RLS policies to allow SUPER_ADMIN same access as ADMIN for operational tables

-- Profiles: SUPER_ADMIN can read all profiles (needed for administrators module)
DROP POLICY IF EXISTS "SUPER_ADMIN can view all profiles" ON profiles;
CREATE POLICY "SUPER_ADMIN can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Clients: SUPER_ADMIN has same access as ADMIN
DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
CREATE POLICY "Admins and Super Admins can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (is_admin_or_super());

DROP POLICY IF EXISTS "Admins can insert clients" ON clients;
CREATE POLICY "Admins and Super Admins can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_super());

DROP POLICY IF EXISTS "Admins can update clients" ON clients;
CREATE POLICY "Admins and Super Admins can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (is_admin_or_super());

-- Technicians: SUPER_ADMIN has same access as ADMIN
DROP POLICY IF EXISTS "Admins can view all technicians" ON technicians;
CREATE POLICY "Admins and Super Admins can view all technicians"
  ON technicians FOR SELECT
  TO authenticated
  USING (is_admin_or_super());

DROP POLICY IF EXISTS "Admins can insert technicians" ON technicians;
CREATE POLICY "Admins and Super Admins can insert technicians"
  ON technicians FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_super());

DROP POLICY IF EXISTS "Admins can update technicians" ON technicians;
CREATE POLICY "Admins and Super Admins can update technicians"
  ON technicians FOR UPDATE
  TO authenticated
  USING (is_admin_or_super());

-- Tickets: SUPER_ADMIN has same access as ADMIN
DROP POLICY IF EXISTS "Admins can view all tickets" ON tickets;
CREATE POLICY "Admins and Super Admins can view all tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (is_admin_or_super());

DROP POLICY IF EXISTS "Admins can update tickets" ON tickets;
CREATE POLICY "Admins and Super Admins can update tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (is_admin_or_super());

DROP POLICY IF EXISTS "Admins can insert tickets" ON tickets;
CREATE POLICY "Admins and Super Admins can insert tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_super());

COMMENT ON FUNCTION current_user_role() IS 'Returns the role of the current authenticated user';
COMMENT ON FUNCTION is_super_admin() IS 'Returns true if current user is SUPER_ADMIN';
COMMENT ON FUNCTION is_admin_or_super() IS 'Returns true if current user is ADMIN or SUPER_ADMIN';
