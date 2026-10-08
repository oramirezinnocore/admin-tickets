-- WIS-REGRESSION-CLIENT-IMPORT-04: Add missing UPDATE policy for client_import_jobs
--
-- ROOT CAUSE:
-- The client_import_jobs table has RLS enabled with SELECT and INSERT policies,
-- but NO UPDATE policy. When the API attempts to transition job status from
-- 'pending' to 'staging' before calling commit_client_import(), the UPDATE fails
-- silently due to RLS blocking it. The code did not verify the update result,
-- so it continued and invoked the RPC, which then rejected with:
-- "Invalid job state: pending. Expected staging"
--
-- ISSUE SEQUENCE:
-- 1. API creates job with status = 'pending' (INSERT allowed by RLS)
-- 2. API inserts all staging records successfully
-- 3. API attempts: UPDATE client_import_jobs SET status = 'staging' WHERE import_id = ?
-- 4. UPDATE is BLOCKED by RLS (no UPDATE policy exists)
-- 5. Update fails silently (error not captured)
-- 6. Code continues to invoke commit_client_import()
-- 7. RPC verifies status and finds 'pending', rejects with error
--
-- SOLUTION:
-- Add UPDATE policy allowing SUPER_ADMIN to update their own import jobs.
-- This enables the critical state transition: pending → staging → committed
--
-- Date: 2026-10-07
-- Related:
--   - 20260924000000_atomic_client_imports.sql (created table with SELECT/INSERT policies)
--   - 20260925000000_harden_atomic_imports.sql (hardened RPC security)

-- ============================================================================
-- Add UPDATE policy for client_import_jobs
-- ============================================================================

-- Allow SUPER_ADMIN to update their own import jobs
-- Required for state transitions: pending → staging, and error recovery
CREATE POLICY client_import_jobs_update_policy ON client_import_jobs
  FOR UPDATE
  TO authenticated
  USING (
    -- User can only update their own jobs
    user_id = auth.uid()
  )
  WITH CHECK (
    -- Only SUPER_ADMIN can update import jobs
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
    -- Additional safety: user cannot change ownership
    AND user_id = auth.uid()
  );

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON POLICY client_import_jobs_update_policy ON client_import_jobs IS
  'Allows SUPER_ADMIN to update their own import jobs. Required for state transitions (pending → staging) before calling commit_client_import(). Users cannot change job ownership via UPDATE.';

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify the policy was created
DO $$
DECLARE
  v_policy_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_import_jobs'
      AND policyname = 'client_import_jobs_update_policy'
  ) INTO v_policy_exists;

  IF NOT v_policy_exists THEN
    RAISE EXCEPTION 'Migration failed: UPDATE policy not created';
  END IF;

  RAISE NOTICE 'Migration verification passed: UPDATE policy exists';
END $$;

-- ============================================================================
-- State Transition Validation
-- ============================================================================

-- The complete RLS policy set for client_import_jobs now ensures:
--
-- 1. SELECT: Users can see their own jobs
-- 2. INSERT: Only SUPER_ADMIN can create jobs
-- 3. UPDATE: Only SUPER_ADMIN can update their own jobs (NEW)
-- 4. DELETE: No policy (not needed, jobs are kept for audit)
--
-- State machine flow with RLS:
--
--   API (SUPER_ADMIN):
--     INSERT job (status = 'pending') ✅ RLS allows
--     ↓
--     INSERT staging records ✅ RLS allows
--     ↓
--     UPDATE job (status = 'staging') ✅ RLS NOW allows
--     ↓
--     CALL commit_client_import() ✅ RPC verifies status = 'staging'
--     ↓
--   RPC (SECURITY DEFINER):
--     UPDATE job (status = 'committed') ✅ Bypasses RLS via SECURITY DEFINER
--
-- Without this policy, the API UPDATE fails and the RPC rejects the import.
