-- WIS-REGRESSION-CLIENT-IMPORT-03: Allow optional coordinates in staging table
--
-- ISSUE:
-- client_import_staging requires NOT NULL coordinates, but business rules now
-- allow clients without coordinates. Geocoding may fail or coordinates may not
-- be provided in CSV. API code was updated to stage records with NULL coordinates,
-- but the schema still enforces NOT NULL, causing staging INSERT to fail.
--
-- BUSINESS RULE:
-- - Client coordinates are OPTIONAL
-- - If coordinates are absent, geocoding is attempted
-- - If geocoding fails, client may be imported with NULL coordinates
-- - Partial coordinates (only lat OR only lng) remain INVALID
--
-- SOLUTION:
-- ALTER client_import_staging to allow NULL coordinates, matching the clients
-- table schema and current business rules. Add CHECK constraint to prevent
-- partial coordinates.
--
-- Date: 2026-10-07
-- Related:
--   - 20260924000000_atomic_client_imports.sql (created staging table)
--   - 20260814222344_initial_schema.sql (clients table allows NULL)
--   - WIS-REGRESSION-CLIENT-IMPORT-02 (business rule change)

-- ============================================================================
-- Remove NOT NULL constraints on coordinates
-- ============================================================================

-- Allow NULL latitude (coordinates are optional)
ALTER TABLE client_import_staging
ALTER COLUMN latitude DROP NOT NULL;

-- Allow NULL longitude (coordinates are optional)
ALTER TABLE client_import_staging
ALTER COLUMN longitude DROP NOT NULL;

-- ============================================================================
-- Add CHECK constraint to prevent partial coordinates
-- ============================================================================

-- Ensure both coordinates are NULL or both are NOT NULL
-- This prevents invalid states like (lat=19.42, lng=NULL)
ALTER TABLE client_import_staging
ADD CONSTRAINT client_import_staging_coordinates_check
CHECK (
  (latitude IS NULL AND longitude IS NULL) OR
  (latitude IS NOT NULL AND longitude IS NOT NULL)
);

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON COLUMN client_import_staging.latitude IS
  'Latitude in decimal degrees. Can be NULL if coordinates are not available or geocoding failed. When provided, both latitude and longitude must be present (enforced by client_import_staging_coordinates_check).';

COMMENT ON COLUMN client_import_staging.longitude IS
  'Longitude in decimal degrees. Can be NULL if coordinates are not available or geocoding failed. When provided, both latitude and longitude must be present (enforced by client_import_staging_coordinates_check).';

COMMENT ON CONSTRAINT client_import_staging_coordinates_check ON client_import_staging IS
  'Ensures coordinates are either both NULL (no location data) or both NOT NULL (complete location data). Prevents partial coordinates like (lat, NULL) or (NULL, lng).';

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify the ALTER worked correctly
DO $$
DECLARE
  v_lat_nullable boolean;
  v_lng_nullable boolean;
  v_constraint_exists boolean;
BEGIN
  -- Check if latitude is now nullable
  SELECT NOT attnotnull INTO v_lat_nullable
  FROM pg_attribute
  WHERE attrelid = 'client_import_staging'::regclass
    AND attname = 'latitude';

  -- Check if longitude is now nullable
  SELECT NOT attnotnull INTO v_lng_nullable
  FROM pg_attribute
  WHERE attrelid = 'client_import_staging'::regclass
    AND attname = 'longitude';

  -- Check if CHECK constraint exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'client_import_staging'::regclass
      AND conname = 'client_import_staging_coordinates_check'
      AND contype = 'c'
  ) INTO v_constraint_exists;

  -- Verify all changes applied
  IF NOT v_lat_nullable THEN
    RAISE EXCEPTION 'Migration failed: latitude is still NOT NULL';
  END IF;

  IF NOT v_lng_nullable THEN
    RAISE EXCEPTION 'Migration failed: longitude is still NOT NULL';
  END IF;

  IF NOT v_constraint_exists THEN
    RAISE EXCEPTION 'Migration failed: CHECK constraint not created';
  END IF;

  RAISE NOTICE 'Migration verification passed: latitude and longitude are now nullable, CHECK constraint exists';
END $$;

-- ============================================================================
-- No changes needed to:
-- ============================================================================
--
-- ✅ client_import_staging RLS policies (unchanged)
-- ✅ client_import_jobs table (unchanged)
-- ✅ commit_client_import() RPC (unchanged - handles NULL coordinates)
-- ✅ clients table (already allows NULL coordinates)
-- ✅ SUPER_ADMIN authorization (unchanged)
-- ✅ Atomic import behavior (unchanged)
-- ✅ Content hash / idempotency (unchanged)
-- ✅ Staging cleanup (unchanged)
