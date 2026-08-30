-- Diagnostic script for ticket_activity media linking
-- Run this to see current state before backfill

-- 1. Check if ticket_activity has evidence_id populated
SELECT
  'EVIDENCE_ADDED events' as event_type,
  COUNT(*) as total_events,
  COUNT(evidence_id) as events_with_id,
  COUNT(*) - COUNT(evidence_id) as events_missing_id
FROM ticket_activity
WHERE activity_type = 'EVIDENCE_ADDED';

-- 2. Check if ticket_activity has signature_id populated
SELECT
  'SIGNATURE_ADDED events' as event_type,
  COUNT(*) as total_events,
  COUNT(signature_id) as events_with_id,
  COUNT(*) - COUNT(signature_id) as events_missing_id
FROM ticket_activity
WHERE activity_type = 'SIGNATURE_ADDED';

-- 3. Show specific ticket #001026 evidence events
SELECT
  ta.id,
  ta.ticket_id,
  ta.activity_type,
  ta.evidence_id,
  ta.signature_id,
  ta.created_at,
  CASE
    WHEN ta.evidence_id IS NOT NULL THEN 'HAS evidence_id'
    WHEN ta.signature_id IS NOT NULL THEN 'HAS signature_id'
    ELSE 'MISSING ID'
  END as status
FROM ticket_activity ta
JOIN tickets t ON t.id = ta.ticket_id
WHERE t.folio = '001026'
  AND ta.activity_type IN ('EVIDENCE_ADDED', 'SIGNATURE_ADDED')
ORDER BY ta.created_at DESC;

-- 4. Check if evidences exist for ticket #001026
SELECT
  'ticket_evidences' as table_name,
  COUNT(*) as count
FROM ticket_evidences te
JOIN tickets t ON t.id = te.ticket_id
WHERE t.folio = '001026';

-- 5. Check if signatures exist for ticket #001026
SELECT
  'ticket_signatures' as table_name,
  COUNT(*) as count
FROM ticket_signatures ts
JOIN tickets t ON t.id = ts.ticket_id
WHERE t.folio = '001026';

-- 6. Show matchable evidences with their timestamps
SELECT
  te.id as evidence_id,
  te.ticket_id,
  te.file_url,
  te.created_at,
  ta.id as activity_id,
  ta.created_at as activity_created_at,
  EXTRACT(EPOCH FROM (te.created_at - ta.created_at)) as time_diff_seconds
FROM ticket_evidences te
JOIN tickets t ON t.id = te.ticket_id
LEFT JOIN ticket_activity ta ON ta.ticket_id = te.ticket_id
  AND ta.activity_type = 'EVIDENCE_ADDED'
  AND ta.created_at >= te.created_at - interval '5 seconds'
  AND ta.created_at <= te.created_at + interval '5 seconds'
WHERE t.folio = '001026'
ORDER BY te.created_at DESC;

-- 7. Show matchable signatures with their timestamps
SELECT
  ts.id as signature_id,
  ts.ticket_id,
  ts.signature_url,
  ts.signed_at,
  ta.id as activity_id,
  ta.created_at as activity_created_at,
  EXTRACT(EPOCH FROM (ts.signed_at - ta.created_at)) as time_diff_seconds
FROM ticket_signatures ts
JOIN tickets t ON t.id = ts.ticket_id
LEFT JOIN ticket_activity ta ON ta.ticket_id = ts.ticket_id
  AND ta.activity_type = 'SIGNATURE_ADDED'
  AND ta.created_at >= ts.signed_at - interval '30 seconds'
  AND ta.created_at <= ts.signed_at + interval '30 seconds'
WHERE t.folio = '001026'
ORDER BY ts.signed_at DESC;
