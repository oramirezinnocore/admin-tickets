-- WIS-REGRESSION-FINAL-HF01-C: Add SUPPORT role INSERT permission for ticket_status_history
--
-- ISSUE: TEST 28 / TC-10 FAIL
-- SUPPORT role can create tickets but the automatic trigger that inserts into
-- ticket_status_history fails with RLS violation because the INSERT policy only
-- allows is_admin_or_super(), excluding SUPPORT.
--
-- SOLUTION: Update INSERT policy to include SUPPORT role
--
-- Date: 2026-10-05
-- Related:
--   - 20260926050000_add_support_permissions.sql (added SUPPORT SELECT permission)
--   - 20260828000000_fix_ticket_status_history_super_admin_rls.sql (original policy)

-- ============================================================================
-- Update INSERT policy for ticket_status_history to include SUPPORT
-- ============================================================================

-- Drop existing policy that only allows ADMIN and SUPER_ADMIN
DROP POLICY IF EXISTS "Admins and Super Admins can insert status history" ON ticket_status_history;

-- Create new policy that allows ADMIN, SUPER_ADMIN, and SUPPORT
-- SUPPORT needs INSERT permission because:
-- 1. SUPPORT can create tickets (requirement confirmed)
-- 2. Creating a ticket triggers automatic INSERT into ticket_status_history
-- 3. Without INSERT permission, the trigger fails with RLS violation
CREATE POLICY "Admins, Super Admins, and Support can insert status history"
  ON ticket_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'SUPPORT')
  );

-- ============================================================================
-- Verify RLS is still enabled
-- ============================================================================

-- Safety check to ensure RLS remains enabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'ticket_status_history') THEN
    RAISE EXCEPTION 'RLS is not enabled on ticket_status_history! This is a security issue.';
  END IF;
END $$;

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON POLICY "Admins, Super Admins, and Support can insert status history" ON ticket_status_history
IS 'Allows ADMIN, SUPER_ADMIN, and SUPPORT roles to insert status history. Called by trigger when ticket status changes. SUPPORT needs this permission to create tickets.';

-- ============================================================================
-- Permission verification
-- ============================================================================

-- No GRANT needed - RLS policies handle access control
-- SUPPORT role can now:
--   - SELECT: ticket_status_history (from 20260926050000_add_support_permissions.sql)
--   - INSERT: ticket_status_history (this migration)
--
-- SUPPORT role CANNOT:
--   - UPDATE/DELETE: ticket_status_history (restricted to ADMIN/SUPER_ADMIN)
--   - Modify Personnel table (not granted)
--   - Access /administrators page (handled by application logic)
