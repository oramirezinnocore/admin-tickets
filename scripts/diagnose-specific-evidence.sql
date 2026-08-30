-- Diagnostic for specific evidence: d845bf64-1d75-48cb-b670-86725bb1cdc4
-- Run this as Admin user to test RLS

-- 1. Check if evidence exists
SELECT
  'EVIDENCE ROW' as check_type,
  id,
  ticket_id,
  type,
  file_url,
  created_by,
  created_at
FROM ticket_evidences
WHERE id = 'd845bf64-1d75-48cb-b670-86725bb1cdc4';

-- 2. Check ticket_activity with this evidence_id
SELECT
  'ACTIVITY ROW' as check_type,
  id,
  ticket_id,
  activity_type,
  evidence_id,
  actor_profile_id,
  created_at
FROM ticket_activity
WHERE evidence_id = 'd845bf64-1d75-48cb-b670-86725bb1cdc4';

-- 3. Check if IDs match
SELECT
  'ID MATCH CHECK' as check_type,
  te.id as evidence_id_from_evidences,
  ta.evidence_id as evidence_id_from_activity,
  CASE
    WHEN te.id = ta.evidence_id THEN 'MATCH'
    ELSE 'MISMATCH'
  END as match_status
FROM ticket_evidences te
LEFT JOIN ticket_activity ta ON ta.evidence_id = te.id
WHERE te.id = 'd845bf64-1d75-48cb-b670-86725bb1cdc4';

-- 4. Test Admin RLS - simulate what PostgREST does
-- This shows if current user can see the evidence
SELECT
  'ADMIN RLS TEST' as check_type,
  COUNT(*) as visible_count,
  CASE
    WHEN COUNT(*) > 0 THEN 'PASS - Admin can see evidence'
    ELSE 'FAIL - RLS blocking Admin'
  END as rls_status
FROM ticket_evidences
WHERE id = 'd845bf64-1d75-48cb-b670-86725bb1cdc4';

-- 5. Check current user role
SELECT
  'CURRENT USER' as check_type,
  auth.uid() as user_id,
  p.role,
  p.full_name,
  p.email
FROM profiles p
WHERE p.id = auth.uid();

-- 6. Verify Storage object exists
-- Note: This checks metadata only, not the actual file
SELECT
  'STORAGE OBJECT' as check_type,
  name as storage_path,
  bucket_id,
  created_at
FROM storage.objects
WHERE bucket_id = 'ticket-evidences'
  AND name LIKE (
    SELECT ticket_id::text || '/%'
    FROM ticket_evidences
    WHERE id = 'd845bf64-1d75-48cb-b670-86725bb1cdc4'
  )
ORDER BY created_at DESC
LIMIT 5;

-- 7. Test PostgREST-style join (what Admin Web query does)
-- This simulates: evidence:ticket_evidences!evidence_id(file_url)
SELECT
  'POSTGREST JOIN SIMULATION' as check_type,
  ta.id as activity_id,
  ta.evidence_id,
  te.file_url as evidence_file_url,
  CASE
    WHEN te.file_url IS NOT NULL THEN 'SUCCESS - Join worked'
    WHEN ta.evidence_id IS NOT NULL AND te.file_url IS NULL THEN 'FAIL - RLS blocking join'
    ELSE 'N/A - No evidence_id'
  END as join_status
FROM ticket_activity ta
LEFT JOIN ticket_evidences te ON te.id = ta.evidence_id
WHERE ta.evidence_id = 'd845bf64-1d75-48cb-b670-86725bb1cdc4';
