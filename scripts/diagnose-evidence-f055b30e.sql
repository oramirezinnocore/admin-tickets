-- Diagnostic for evidence_id: f055b30e-2564-4b24-9055-c09258e9c071
-- Run as Admin/Super Admin user to test RLS

-- ============================================================================
-- STEP 1: Does the evidence row exist?
-- ============================================================================
SELECT
  '1. EVIDENCE ROW EXISTS' as step,
  id,
  ticket_id,
  type,
  file_url,
  created_by,
  created_at
FROM ticket_evidences
WHERE id = 'f055b30e-2564-4b24-9055-c09258e9c071';

-- Expected: 1 row
-- If 0 rows: Evidence was deleted or never inserted properly


-- ============================================================================
-- STEP 2: Check ticket_activity with this evidence_id
-- ============================================================================
SELECT
  '2. ACTIVITY ROW' as step,
  id,
  ticket_id,
  activity_type,
  evidence_id,
  actor_profile_id,
  created_at
FROM ticket_activity
WHERE evidence_id = 'f055b30e-2564-4b24-9055-c09258e9c071';

-- Expected: 1 row with activity_type = 'EVIDENCE_ADDED'


-- ============================================================================
-- STEP 3: Do ticket_id values match?
-- ============================================================================
SELECT
  '3. TICKET_ID MATCH' as step,
  te.ticket_id as evidence_ticket_id,
  ta.ticket_id as activity_ticket_id,
  CASE
    WHEN te.ticket_id = ta.ticket_id THEN 'MATCH ✅'
    ELSE 'MISMATCH ❌'
  END as status
FROM ticket_evidences te
LEFT JOIN ticket_activity ta ON ta.evidence_id = te.id
WHERE te.id = 'f055b30e-2564-4b24-9055-c09258e9c071';

-- Expected: MATCH


-- ============================================================================
-- STEP 4: Verify FK constraint exists
-- ============================================================================
SELECT
  '4. FK CONSTRAINT' as step,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'ticket_activity'
  AND kcu.column_name = 'evidence_id';

-- Expected: FK pointing to ticket_evidences(id)


-- ============================================================================
-- STEP 5: Test Admin RLS - Can current user see the evidence?
-- ============================================================================
SELECT
  '5. ADMIN RLS TEST' as step,
  COUNT(*) as visible_count,
  CASE
    WHEN COUNT(*) > 0 THEN 'PASS ✅ - Admin can see evidence'
    ELSE 'FAIL ❌ - RLS blocking Admin'
  END as rls_status
FROM ticket_evidences
WHERE id = 'f055b30e-2564-4b24-9055-c09258e9c071';

-- Expected: visible_count = 1
-- If 0: RLS is blocking Admin user


-- ============================================================================
-- STEP 6: Check current user role
-- ============================================================================
SELECT
  '6. CURRENT USER ROLE' as step,
  auth.uid() as user_id,
  p.role,
  p.full_name,
  p.email,
  CASE
    WHEN p.role IN ('ADMIN', 'SUPER_ADMIN') THEN 'Should have access ✅'
    ELSE 'No admin privileges ❌'
  END as access_status
FROM profiles p
WHERE p.id = auth.uid();

-- Expected: role = ADMIN or SUPER_ADMIN


-- ============================================================================
-- STEP 7: Check RLS policies on ticket_evidences
-- ============================================================================
SELECT
  '7. RLS POLICIES' as step,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'ticket_evidences'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- Expected to see:
-- "Admins and super admins can view all evidences" OR
-- Two separate policies for ADMIN and SUPER_ADMIN


-- ============================================================================
-- STEP 8: Simulate PostgREST JOIN
-- ============================================================================
SELECT
  '8. POSTGREST JOIN SIMULATION' as step,
  ta.id as activity_id,
  ta.evidence_id,
  te.file_url as evidence_file_url,
  te.id as evidence_id_from_join,
  CASE
    WHEN te.file_url IS NOT NULL THEN 'SUCCESS ✅ - Join worked'
    WHEN ta.evidence_id IS NOT NULL AND te.file_url IS NULL THEN 'FAIL ❌ - RLS blocking join'
    ELSE 'N/A - No evidence_id'
  END as join_status
FROM ticket_activity ta
LEFT JOIN ticket_evidences te ON te.id = ta.evidence_id
WHERE ta.evidence_id = 'f055b30e-2564-4b24-9055-c09258e9c071';

-- Expected: join_status = SUCCESS
-- If FAIL: RLS is preventing the LEFT JOIN from returning data


-- ============================================================================
-- STEP 9: Check Storage object exists
-- ============================================================================
SELECT
  '9. STORAGE OBJECT' as step,
  so.name as storage_path,
  so.bucket_id,
  so.created_at,
  CASE
    WHEN so.name IS NOT NULL THEN 'EXISTS ✅'
    ELSE 'MISSING ❌'
  END as status
FROM ticket_evidences te
LEFT JOIN storage.objects so ON so.name = te.file_url AND so.bucket_id = 'ticket-evidences'
WHERE te.id = 'f055b30e-2564-4b24-9055-c09258e9c071';

-- Expected: status = EXISTS


-- ============================================================================
-- STEP 10: Test if policy allows WITH CHECK (for completeness)
-- ============================================================================
SELECT
  '10. POLICY DEFINITION' as step,
  p.polname as policy_name,
  pg_get_expr(p.polqual, p.polrelid) as using_expression,
  CASE
    WHEN pg_get_expr(p.polqual, p.polrelid) LIKE '%SUPER_ADMIN%' THEN 'Includes SUPER_ADMIN ✅'
    WHEN pg_get_expr(p.polqual, p.polrelid) LIKE '%role = ''ADMIN''%' THEN 'Only ADMIN ⚠️'
    ELSE 'Other condition'
  END as analysis
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'ticket_evidences'
  AND p.polcmd = 'r' -- SELECT policies
  AND p.polname LIKE '%admin%'
ORDER BY p.polname;

-- Expected: Policy includes SUPER_ADMIN or uses IN ('ADMIN', 'SUPER_ADMIN')


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- If Step 1 = 0 rows → Evidence doesn't exist (Mobile insertion failed)
-- If Step 5 = 0 count → RLS is blocking (need to apply migration)
-- If Step 6 = ADMIN and Step 5 = 0 → Old policy missing SUPER_ADMIN check
-- If Step 8 = FAIL → PostgREST can't JOIN due to RLS
-- If Step 10 = Only ADMIN → Need to apply 20260829050000 migration
