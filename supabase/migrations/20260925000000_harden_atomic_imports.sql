-- WIS-CLIENT-BULK-IMPORT-V3.1: Security and retry hardening

-- Add content_hash column for detecting import_id reuse with different data
ALTER TABLE client_import_jobs
ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS idx_client_import_jobs_content_hash
ON client_import_jobs(content_hash);

-- Drop old function
DROP FUNCTION IF EXISTS commit_client_import(text, uuid);

-- Recreate with security hardening
CREATE OR REPLACE FUNCTION commit_client_import(
  p_import_id text
  -- ✅ No p_user_id parameter - derive from auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_profile_role text;
  v_job_status text;
  v_job_user_id uuid;
  v_staged_count integer;
  v_inserted_count integer;
  v_result jsonb;
BEGIN
  -- 1. Get actual caller from auth context (cannot be spoofed)
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify caller has SUPER_ADMIN role
  SELECT role INTO v_profile_role
  FROM profiles
  WHERE id = v_caller_id;

  IF v_profile_role IS NULL OR v_profile_role != 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Unauthorized: Only SUPER_ADMIN can perform bulk imports'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Lock job row to prevent concurrent commits (serializes retries)
  SELECT status, user_id INTO v_job_status, v_job_user_id
  FROM client_import_jobs
  WHERE import_id = p_import_id
  FOR UPDATE;  -- ✅ Row-level lock

  IF v_job_status IS NULL THEN
    RAISE EXCEPTION 'Import job not found'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 4. Verify job ownership (caller must own the job)
  IF v_job_user_id != v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: Import job belongs to different user'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 5. Return idempotent success if already committed
  IF v_job_status = 'committed' THEN
    SELECT
      jsonb_build_object(
        'success', true,
        'imported', imported_records,
        'message', 'Import already completed',
        'idempotent', true
      ) INTO v_result
    FROM client_import_jobs
    WHERE import_id = p_import_id;

    RETURN v_result;
  END IF;

  -- 6. Only allow commit from 'staging' state
  -- (API is responsible for transitioning to staging)
  IF v_job_status != 'staging' THEN
    RAISE EXCEPTION 'Invalid job state: %. Expected staging', v_job_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 7. Count and validate staged records
  SELECT COUNT(*) INTO v_staged_count
  FROM client_import_staging
  WHERE import_id = p_import_id;

  IF v_staged_count = 0 THEN
    RAISE EXCEPTION 'No staged records found for import %', p_import_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Verify staged count matches job total_records
  IF v_staged_count != (SELECT total_records FROM client_import_jobs WHERE import_id = p_import_id) THEN
    RAISE EXCEPTION 'Staged record count (%) does not match job total_records', v_staged_count
      USING ERRCODE = 'data_exception';
  END IF;

  -- 8. ATOMIC INSERT: All staged records → clients table
  WITH inserted AS (
    INSERT INTO clients (
      name,
      address,
      phone,
      reference,
      latitude,
      longitude,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      name,
      address,
      phone,
      reference,
      latitude,
      longitude,
      is_active,
      created_at,
      now()
    FROM client_import_staging
    WHERE import_id = p_import_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted_count FROM inserted;

  -- 9. Verify insert count matches staged count
  IF v_inserted_count != v_staged_count THEN
    RAISE EXCEPTION 'Insert count mismatch: expected %, got %',
      v_staged_count, v_inserted_count
      USING ERRCODE = 'data_exception';
  END IF;

  -- 10. Update job status to committed
  UPDATE client_import_jobs
  SET
    status = 'committed',
    imported_records = v_inserted_count,
    completed_at = now()
  WHERE import_id = p_import_id;

  -- 11. Clean up staging records
  DELETE FROM client_import_staging
  WHERE import_id = p_import_id;

  -- 12. Return success
  RETURN jsonb_build_object(
    'success', true,
    'imported', v_inserted_count,
    'message', 'All clients imported successfully',
    'idempotent', false
  );

  -- ✅ NO EXCEPTION BLOCK - let errors propagate to API
  -- API will handle failure recording in separate transaction
END;
$$;

-- Grant execute to authenticated users (role check happens inside function)
GRANT EXECUTE ON FUNCTION commit_client_import(text) TO authenticated;

-- Update comments
COMMENT ON FUNCTION commit_client_import IS
  'Atomically commits a staged client import. Uses auth.uid() for caller identity. ' ||
  'Locks job row to prevent concurrent commits. SUPER_ADMIN only.';

COMMENT ON COLUMN client_import_jobs.content_hash IS
  'SHA-256 hash of validated CSV content. Used to detect import_id reuse with different data.';
