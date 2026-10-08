-- WIS-REGRESSION-CLIENT-IMPORT-05: Add missing SELECT and DELETE policies for client_import_staging
--
-- ROOT CAUSE:
-- The client_import_staging table has RLS enabled with only an INSERT policy.
-- When the API inserts staging rows, the INSERT succeeds (SUPER_ADMIN allowed).
-- However, the subsequent verification count query uses SELECT, which is BLOCKED by RLS
-- because NO SELECT policy exists. The query returns 0 rows even though rows were inserted.
--
-- ISSUE SEQUENCE (Production Evidence):
-- 1. API validates 1 row successfully
-- 2. API creates job with status = 'pending'
-- 3. API inserts 1 staging row → INSERT succeeds (RLS allows SUPER_ADMIN)
-- 4. API verifies staging count with SELECT → returns 0 (RLS blocks SELECT)
-- 5. Verification fails: expected 1, found 0
-- 6. Import stops before state transition (correct behavior)
--
-- SECONDARY ISSUE:
-- Retry cleanup also requires DELETE permission to clear old staging records,
-- but no DELETE policy exists either.
--
-- SOLUTION:
-- Add SELECT policy: allows SUPER_ADMIN to read staging rows for verification
-- Add DELETE policy: allows SUPER_ADMIN to delete staging rows for retry cleanup
--
-- Date: 2026-10-08
-- Related:
--   - 20260924000000_atomic_client_imports.sql (created table with INSERT policy only)
--   - 20261007100000_add_client_import_jobs_update_policy.sql (added UPDATE policy for jobs)

-- ============================================================================
-- Add SELECT policy for client_import_staging
-- ============================================================================

-- Allow SUPER_ADMIN to SELECT staging rows
-- Required for verification count before commit
CREATE POLICY client_import_staging_select_policy ON client_import_staging
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- ============================================================================
-- Add DELETE policy for client_import_staging
-- ============================================================================

-- Allow SUPER_ADMIN to DELETE staging rows
-- Required for retry cleanup when import fails or needs to be retried
CREATE POLICY client_import_staging_delete_policy ON client_import_staging
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON POLICY client_import_staging_select_policy ON client_import_staging IS
  'Allows SUPER_ADMIN to SELECT staging rows. Required for verification count before calling commit_client_import(). Without this policy, the API cannot verify that staging rows were actually inserted.';

COMMENT ON POLICY client_import_staging_delete_policy ON client_import_staging IS
  'Allows SUPER_ADMIN to DELETE staging rows. Required for retry cleanup when an import fails or needs to be retried with corrected data. Without this policy, old staging rows cannot be cleaned up.';

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify both policies were created
DO $$
DECLARE
  v_select_policy_exists boolean;
  v_delete_policy_exists boolean;
BEGIN
  -- Check SELECT policy
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_import_staging'
      AND policyname = 'client_import_staging_select_policy'
  ) INTO v_select_policy_exists;

  -- Check DELETE policy
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_import_staging'
      AND policyname = 'client_import_staging_delete_policy'
  ) INTO v_delete_policy_exists;

  IF NOT v_select_policy_exists THEN
    RAISE EXCEPTION 'Migration failed: SELECT policy not created';
  END IF;

  IF NOT v_delete_policy_exists THEN
    RAISE EXCEPTION 'Migration failed: DELETE policy not created';
  END IF;

  RAISE NOTICE 'Migration verification passed: SELECT and DELETE policies exist';
END $$;

-- ============================================================================
-- Complete RLS Policy Set for client_import_staging
-- ============================================================================

-- After this migration, client_import_staging has:
--
-- 1. INSERT policy ✅ (from 20260924000000_atomic_client_imports.sql)
--    - Allows SUPER_ADMIN to insert staging rows
--
-- 2. SELECT policy ✅ (NEW - this migration)
--    - Allows SUPER_ADMIN to read staging rows for verification
--
-- 3. DELETE policy ✅ (NEW - this migration)
--    - Allows SUPER_ADMIN to delete staging rows for retry cleanup
--
-- 4. UPDATE policy ❌ (not needed)
--    - Staging rows are never updated, only inserted and deleted
--
-- State machine flow with complete RLS:
--
--   API (SUPER_ADMIN):
--     INSERT staging rows ✅ RLS allows
--     ↓
--     SELECT count(staging rows) ✅ RLS NOW allows
--     ↓
--     Verify count matches expected ✅ Now works
--     ↓
--     UPDATE job (status = 'staging') ✅ RLS allows
--     ↓
--     CALL commit_client_import() ✅ RPC proceeds
--     ↓
--   RPC (SECURITY DEFINER):
--     DELETE staging rows ✅ Bypasses RLS via SECURITY DEFINER
--
--   Retry flow (on failure):
--     DELETE old staging rows ✅ RLS NOW allows
--     ↓
--     Start fresh import
