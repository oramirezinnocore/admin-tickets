-- Fix ticket_status_history RLS policies to support SUPER_ADMIN role
--
-- ISSUE: WIS-022-HF01
-- When SUPER_ADMIN creates a ticket, the automatic trigger inserts into
-- ticket_status_history but the INSERT policy only allows is_admin(),
-- excluding SUPER_ADMIN and causing RLS violation.
--
-- SOLUTION: Update policies to use is_admin_or_super() instead of is_admin()
--
-- Date: 2026-08-28
-- Related: 20260823000000_add_super_admin_role.sql

-- ============================================================================
-- Fix INSERT policy for ticket_status_history
-- ============================================================================

-- Drop old policy that only checks is_admin()
DROP POLICY IF EXISTS "Admins can insert status history" ON ticket_status_history;

-- Create new policy that checks is_admin_or_super()
CREATE POLICY "Admins and Super Admins can insert status history"
  ON ticket_status_history FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_super());

-- ============================================================================
-- Fix UPDATE policy for ticket_status_history
-- ============================================================================

-- Drop old policy that only checks is_admin()
DROP POLICY IF EXISTS "Admins can update status history" ON ticket_status_history;

-- Create new policy that checks is_admin_or_super()
CREATE POLICY "Admins and Super Admins can update status history"
  ON ticket_status_history FOR UPDATE
  TO authenticated
  USING (is_admin_or_super());

-- ============================================================================
-- Fix DELETE policy for ticket_status_history
-- ============================================================================

-- Drop old policy that only checks is_admin()
DROP POLICY IF EXISTS "Admins can delete status history" ON ticket_status_history;

-- Create new policy that checks is_admin_or_super()
CREATE POLICY "Admins and Super Admins can delete status history"
  ON ticket_status_history FOR DELETE
  TO authenticated
  USING (is_admin_or_super());

-- ============================================================================
-- Verify RLS is still enabled
-- ============================================================================

-- This is a safety check - RLS should already be enabled
-- But we verify it explicitly to ensure security is not compromised
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'ticket_status_history') THEN
    RAISE EXCEPTION 'RLS is not enabled on ticket_status_history! This is a security issue.';
  END IF;
END $$;

-- Add comment documenting the fix
COMMENT ON POLICY "Admins and Super Admins can insert status history" ON ticket_status_history
IS 'Allows ADMIN and SUPER_ADMIN roles to insert status history. Called by trigger when ticket status changes.';

COMMENT ON POLICY "Admins and Super Admins can update status history" ON ticket_status_history
IS 'Allows ADMIN and SUPER_ADMIN roles to update status history for corrections.';

COMMENT ON POLICY "Admins and Super Admins can delete status history" ON ticket_status_history
IS 'Allows ADMIN and SUPER_ADMIN roles to delete status history for audit trail corrections.';

-- ============================================================================
-- Fix technician_push_tokens policy for SUPER_ADMIN
-- ============================================================================

-- The push_tokens table also has a policy that only checks role = 'ADMIN'
-- Update it to use is_admin_or_super() for consistency
DROP POLICY IF EXISTS "Admins can view all push tokens" ON technician_push_tokens;

CREATE POLICY "Admins and Super Admins can view all push tokens"
  ON technician_push_tokens FOR SELECT
  TO authenticated
  USING (is_admin_or_super());

COMMENT ON POLICY "Admins and Super Admins can view all push tokens" ON technician_push_tokens
IS 'Allows ADMIN and SUPER_ADMIN roles to view all push tokens for server-side notification sending.';
