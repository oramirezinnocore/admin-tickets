-- Diagnostic for Storage path mismatch
-- Find evidence with file not found: 1788017486622-d2lndn.jpg
-- Ticket ID: 4e8278ac-b368-48a7-8ca6-5475dd7715bb

-- ============================================================================
-- STEP 1: Find the evidence record in ticket_evidences
-- ============================================================================
SELECT
  '1. EVIDENCE RECORD' as step,
  id,
  ticket_id,
  type,
  file_url,
  created_at
FROM ticket_evidences
WHERE ticket_id = '4e8278ac-b368-48a7-8ca6-5475dd7715bb'
ORDER BY created_at DESC;

-- Expected: file_url should be the storage path
-- Check if it includes ticket_id prefix or just filename


-- ============================================================================
-- STEP 2: Search storage.objects for this file in ALL buckets
-- ============================================================================
SELECT
  '2. STORAGE OBJECTS - ALL BUCKETS' as step,
  bucket_id,
  name,
  created_at,
  metadata
FROM storage.objects
WHERE name LIKE '%1788017486622-d2lndn.jpg%'
ORDER BY created_at DESC;

-- Expected: Should find the file in one bucket
-- If not found: Upload failed or file was deleted


-- ============================================================================
-- STEP 3: Search by ticket_id prefix in ticket-evidences bucket
-- ============================================================================
SELECT
  '3. STORAGE OBJECTS - BY TICKET PREFIX' as step,
  bucket_id,
  name,
  created_at
FROM storage.objects
WHERE bucket_id = 'ticket-evidences'
  AND name LIKE '4e8278ac-b368-48a7-8ca6-5475dd7715bb/%'
ORDER BY created_at DESC;

-- Expected: All files uploaded for this ticket
-- Check if filename matches what's in DB


-- ============================================================================
-- STEP 4: Compare DB vs Storage paths
-- ============================================================================
SELECT
  '4. PATH COMPARISON' as step,
  te.id as evidence_id,
  te.file_url as db_path,
  so.name as storage_path,
  CASE
    WHEN te.file_url = so.name THEN 'MATCH ✅'
    WHEN so.name IS NULL THEN 'STORAGE MISSING ❌'
    WHEN te.file_url != so.name THEN 'MISMATCH ❌'
    ELSE 'UNKNOWN'
  END as status,
  CASE
    WHEN te.file_url LIKE '4e8278ac%/%' THEN 'Has ticket prefix ✅'
    ELSE 'Missing ticket prefix ⚠️'
  END as path_format
FROM ticket_evidences te
LEFT JOIN storage.objects so ON so.name = te.file_url AND so.bucket_id = 'ticket-evidences'
WHERE te.ticket_id = '4e8278ac-b368-48a7-8ca6-5475dd7715bb'
ORDER BY te.created_at DESC;

-- Expected: MATCH
-- If MISMATCH: Path stored in DB is different from Storage
-- If STORAGE MISSING: File was never uploaded or was deleted


-- ============================================================================
-- STEP 5: Check for duplicate ticket_id in path (double prefix bug)
-- ============================================================================
SELECT
  '5. DOUBLE PREFIX CHECK' as step,
  name,
  CASE
    WHEN name LIKE '%4e8278ac%4e8278ac%' THEN 'DOUBLE PREFIX ❌'
    WHEN name LIKE '4e8278ac-b368-48a7-8ca6-5475dd7715bb/%' THEN 'CORRECT PREFIX ✅'
    ELSE 'NO PREFIX ⚠️'
  END as prefix_status
FROM storage.objects
WHERE bucket_id = 'ticket-evidences'
  AND (name LIKE '%4e8278ac%' OR name LIKE '%1788017486622%')
ORDER BY created_at DESC;


-- ============================================================================
-- STEP 6: Check recent uploads for this ticket (last 24h)
-- ============================================================================
SELECT
  '6. RECENT UPLOADS (24H)' as step,
  name,
  created_at,
  (metadata->>'size')::bigint as size_bytes
FROM storage.objects
WHERE bucket_id = 'ticket-evidences'
  AND name LIKE '4e8278ac-b368-48a7-8ca6-5475dd7715bb/%'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Check if any recent uploads exist


-- ============================================================================
-- STEP 7: Find orphaned files (in Storage but not in DB)
-- ============================================================================
SELECT
  '7. ORPHANED STORAGE FILES' as step,
  so.name,
  so.created_at
FROM storage.objects so
LEFT JOIN ticket_evidences te ON te.file_url = so.name
WHERE so.bucket_id = 'ticket-evidences'
  AND so.name LIKE '4e8278ac-b368-48a7-8ca6-5475dd7715bb/%'
  AND te.id IS NULL
ORDER BY so.created_at DESC;

-- Files uploaded but no DB record (rollback didn't work)


-- ============================================================================
-- STEP 8: Find orphaned DB records (in DB but not in Storage)
-- ============================================================================
SELECT
  '8. ORPHANED DB RECORDS' as step,
  te.id,
  te.file_url,
  te.created_at
FROM ticket_evidences te
LEFT JOIN storage.objects so ON so.name = te.file_url AND so.bucket_id = 'ticket-evidences'
WHERE te.ticket_id = '4e8278ac-b368-48a7-8ca6-5475dd7715bb'
  AND so.name IS NULL
ORDER BY te.created_at DESC;

-- DB records exist but files are missing (upload failed or deleted)


-- ============================================================================
-- STEP 9: Check all evidences for pattern analysis
-- ============================================================================
SELECT
  '9. PATH PATTERN ANALYSIS' as step,
  te.file_url,
  CASE
    WHEN te.file_url LIKE '%/%' THEN 'Has slash ✅'
    ELSE 'No slash ❌'
  END as has_separator,
  CASE
    WHEN te.file_url LIKE concat(te.ticket_id::text, '/%') THEN 'Correct prefix ✅'
    ELSE 'Wrong prefix ❌'
  END as prefix_check,
  te.created_at
FROM ticket_evidences te
WHERE te.ticket_id = '4e8278ac-b368-48a7-8ca6-5475dd7715bb'
ORDER BY te.created_at DESC;


-- ============================================================================
-- STEP 10: Search for the specific filename without prefix
-- ============================================================================
SELECT
  '10. FILENAME SEARCH (NO PREFIX)' as step,
  bucket_id,
  name,
  created_at
FROM storage.objects
WHERE name = '1788017486622-d2lndn.jpg'
   OR name LIKE '%/1788017486622-d2lndn.jpg';

-- Check if file was uploaded without ticket_id prefix


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- If Step 1 shows file_url without ticket_id prefix → Mobile bug
-- If Step 2 finds file in different bucket → Wrong bucket used
-- If Step 3 is empty → No files uploaded for this ticket
-- If Step 4 shows MISMATCH → Path construction bug
-- If Step 5 shows DOUBLE PREFIX → Admin concatenating twice
-- If Step 8 has records → Upload failed but DB was created (rollback bug)
-- If Step 10 finds file → Uploaded without ticket_id prefix
