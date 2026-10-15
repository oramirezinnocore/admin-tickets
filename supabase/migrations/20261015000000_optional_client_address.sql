-- WIS-REGRESSION-CLIENT-IMPORT-08: Make client address optional
--
-- BUSINESS RULE CHANGE:
-- Address is now optional for client import. Client data is primary,
-- location data is optional/best-effort.
--
-- "Esos formatos raros que no los tome en cuenta, que quede el campo en blanco."
-- - Wisper business clarification
--
-- RATIONALE:
-- - Name is the only required field for a client
-- - Address is optional - if blank, no geocoding is attempted
-- - Invalid/unknown/partial coordinates should not block import
-- - Clients can be imported with NULL address and NULL coordinates
--
-- Date: 2026-10-15
-- Related:
--   - 20260814222344_initial_schema.sql (created clients table with address NOT NULL)
--   - 20260924000000_atomic_client_imports.sql (created staging with address NOT NULL)
--   - 20261007000000_allow_null_coordinates_staging.sql (made coordinates nullable)

-- ============================================================================
-- Make address optional in clients table
-- ============================================================================

ALTER TABLE clients
ALTER COLUMN address DROP NOT NULL;

COMMENT ON COLUMN clients.address IS
  'Client address. Optional field - can be NULL if address is not available. If NULL, no geocoding can be performed and location remains NULL.';

-- ============================================================================
-- Make address optional in client_import_staging table
-- ============================================================================

ALTER TABLE client_import_staging
ALTER COLUMN address DROP NOT NULL;

COMMENT ON COLUMN client_import_staging.address IS
  'Client address for staging. Optional field - can be NULL if address is not available in CSV.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  v_clients_address_nullable boolean;
  v_staging_address_nullable boolean;
BEGIN
  -- Check if clients.address is now nullable
  SELECT NOT attnotnull INTO v_clients_address_nullable
  FROM pg_attribute
  WHERE attrelid = 'clients'::regclass
    AND attname = 'address';

  -- Check if client_import_staging.address is now nullable
  SELECT NOT attnotnull INTO v_staging_address_nullable
  FROM pg_attribute
  WHERE attrelid = 'client_import_staging'::regclass
    AND attname = 'address';

  -- Verify changes applied
  IF NOT v_clients_address_nullable THEN
    RAISE EXCEPTION 'Migration failed: clients.address is still NOT NULL';
  END IF;

  IF NOT v_staging_address_nullable THEN
    RAISE EXCEPTION 'Migration failed: client_import_staging.address is still NOT NULL';
  END IF;

  RAISE NOTICE 'Migration verification passed: address columns are now nullable';
END $$;

-- ============================================================================
-- Business Rules Summary
-- ============================================================================

-- After this migration:
--
-- REQUIRED:
--   - name (text NOT NULL)
--
-- OPTIONAL:
--   - address (text) - can be NULL
--   - phone (text) - can be NULL
--   - reference (text) - can be NULL
--   - latitude (double precision) - can be NULL
--   - longitude (double precision) - can be NULL
--
-- VALIDATION BEHAVIOR:
--   - Missing name → ERROR (blocks import)
--   - Blank address → WARNING or no warning (acceptable)
--   - Invalid coordinates → WARNING (client imported with NULL coordinates)
--   - Partial coordinates → WARNING (client imported with NULL coordinates)
--   - Out-of-range coordinates → WARNING (client imported with NULL coordinates)
--   - Geocoding failure → WARNING (client imported with NULL coordinates)
--
-- IMPORT BEHAVIOR:
--   - Clients can be imported with only name and no other data
--   - Location data is optional/best-effort
--   - Invalid location data does not block client import
