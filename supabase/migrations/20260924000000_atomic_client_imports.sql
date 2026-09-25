-- WIS-CLIENT-BULK-IMPORT-V3: Atomic client imports with staging table

-- Staging table for bulk client imports
CREATE TABLE IF NOT EXISTS client_import_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id text NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  phone text,
  reference text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_client_import_staging_import_id ON client_import_staging(import_id);

-- Import jobs table for tracking and idempotency
CREATE TABLE IF NOT EXISTS client_import_jobs (
  import_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL CHECK (status IN ('pending', 'staging', 'committed', 'failed')),
  total_records integer NOT NULL,
  imported_records integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz
);

CREATE INDEX idx_client_import_jobs_user_id ON client_import_jobs(user_id);
CREATE INDEX idx_client_import_jobs_status ON client_import_jobs(status);

-- Function to commit staged import atomically
CREATE OR REPLACE FUNCTION commit_client_import(
  p_import_id text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_role text;
  v_job_status text;
  v_staged_count integer;
  v_inserted_count integer;
  v_result jsonb;
BEGIN
  -- Verify caller is SUPER_ADMIN
  SELECT role INTO v_profile_role
  FROM profiles
  WHERE id = p_user_id;

  IF v_profile_role IS NULL OR v_profile_role != 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Unauthorized: Only SUPER_ADMIN can perform bulk imports'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Check if import job exists and verify ownership
  SELECT status INTO v_job_status
  FROM client_import_jobs
  WHERE import_id = p_import_id AND user_id = p_user_id;

  IF v_job_status IS NULL THEN
    RAISE EXCEPTION 'Import job not found or unauthorized'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- If already committed, return success (idempotency)
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

  -- If failed previously, allow retry
  IF v_job_status != 'staging' AND v_job_status != 'pending' AND v_job_status != 'failed' THEN
    RAISE EXCEPTION 'Import job in invalid state: %', v_job_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Count staged records
  SELECT COUNT(*) INTO v_staged_count
  FROM client_import_staging
  WHERE import_id = p_import_id;

  IF v_staged_count = 0 THEN
    RAISE EXCEPTION 'No staged records found for import %', p_import_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- BEGIN ATOMIC TRANSACTION
  -- Insert all staged records into clients table in one transaction
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

  -- Verify all records were inserted
  IF v_inserted_count != v_staged_count THEN
    RAISE EXCEPTION 'Insert count mismatch: expected %, got %', v_staged_count, v_inserted_count
      USING ERRCODE = 'data_exception';
  END IF;

  -- Update job status to committed
  UPDATE client_import_jobs
  SET
    status = 'committed',
    imported_records = v_inserted_count,
    completed_at = now()
  WHERE import_id = p_import_id;

  -- Clean up staging records
  DELETE FROM client_import_staging
  WHERE import_id = p_import_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'imported', v_inserted_count,
    'message', 'All clients imported successfully',
    'idempotent', false
  );

EXCEPTION
  WHEN OTHERS THEN
    -- On any error, update job status to failed
    UPDATE client_import_jobs
    SET
      status = 'failed',
      error_message = SQLERRM,
      completed_at = now()
    WHERE import_id = p_import_id;

    -- Re-raise the exception (transaction will rollback)
    RAISE;
END;
$$;

-- Grant EXECUTE only to authenticated users (API will check SUPER_ADMIN)
GRANT EXECUTE ON FUNCTION commit_client_import(text, uuid) TO authenticated;

-- RLS policies for staging table
ALTER TABLE client_import_staging ENABLE ROW LEVEL SECURITY;

-- Only service can insert (API uses service role for staging)
CREATE POLICY client_import_staging_insert_policy ON client_import_staging
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- RLS policies for jobs table
ALTER TABLE client_import_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY client_import_jobs_select_policy ON client_import_jobs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only SUPER_ADMIN can insert jobs
CREATE POLICY client_import_jobs_insert_policy ON client_import_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- Comment for documentation
COMMENT ON FUNCTION commit_client_import IS
  'Atomically commits a staged client import. All records inserted in a single transaction or none on failure. SUPER_ADMIN only.';

COMMENT ON TABLE client_import_staging IS
  'Staging table for bulk client imports. Records are temporarily stored here before atomic commit.';

COMMENT ON TABLE client_import_jobs IS
  'Tracks import jobs for idempotency and status monitoring. Prevents duplicate imports with same import_id.';
