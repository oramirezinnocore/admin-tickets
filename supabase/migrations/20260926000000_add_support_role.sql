-- WIS-PERSONNEL-RBAC-01: Add SUPPORT role to user_role enum
-- TRANSACTION SAFETY: Only adds enum value, does NOT use it
-- All SUPPORT policies and function updates are in 20260926050000_add_support_permissions.sql

-- Add SUPPORT to user_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'SUPPORT'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'SUPPORT';
    RAISE NOTICE 'Added SUPPORT to user_role enum';
  ELSE
    RAISE NOTICE 'SUPPORT already exists in user_role enum';
  END IF;
END$$;

-- NOTE: is_admin_or_super() remains unchanged (ADMIN OR SUPER_ADMIN only)
-- SUPPORT receives explicit limited policies in the next migration
-- DO NOT add SUPPORT to is_admin_or_super() - many policies depend on it for admin privileges

COMMENT ON TYPE user_role IS
  'User roles: SUPER_ADMIN (system admin), ADMIN (operational admin), SUPPORT (back-office support), TECHNICIAN (field tech)';
