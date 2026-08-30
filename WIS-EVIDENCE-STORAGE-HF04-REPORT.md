# WIS-EVIDENCE-STORAGE-HF04 — STORAGE PATH MISMATCH DIAGNOSIS

## SYMPTOM

Admin successfully resolves `ticket_activity.evidence` (RLS fix worked), but signed URL generation fails:

**Request:**
```
POST /storage/v1/object/sign/ticket-evidences/
     4e8278ac-b368-48a7-8ca6-5475dd7715bb/1788017486622-d2lndn.jpg
```

**Response:**
```
400 Bad Request
StorageApiError: Object not found
```

**This means:**
- RLS is working ✅
- Query returns evidence data ✅
- File physically missing from Storage ❌

---

## CODE AUDIT

### Mobile Upload Flow

**File:** `apps/technician/src/services/storage-helper.ts:uploadEvidence()`

**Path construction:**
```typescript
// Line 18
const fileName = `${ticketId}/${timestamp}-${random}.${extension}`;

// Line 29
const { error: uploadError } = await supabase.storage
  .from('ticket-evidences')
  .upload(fileName, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });

// Line 48
const { data, error: dbError } = await supabase
  .from('ticket_evidences')
  .insert({
    ticket_id: ticketId,
    type: 'SOLUTION',
    file_url: fileName, // ✅ Uses same path
    created_by: userId,
    latitude,
    longitude,
  })
```

**✅ Path construction is CORRECT:**
- Upload path: `${ticketId}/${timestamp}-${random}.${extension}`
- DB storage path: Same value (`fileName`)
- No reconstruction, no double prefix

**Rollback mechanism:**
```typescript
if (dbError) {
  console.error('[Evidence] DB INSERT FAILED:', dbError);
  
  // Rollback: delete uploaded file
  console.log('[Evidence] Rolling back Storage upload');
  try {
    await supabase.storage.from('ticket-evidences').remove([fileName]);
    console.log('[Evidence] Rollback SUCCESS');
  } catch (rollbackError) {
    console.error('[Evidence] Rollback FAILED:', rollbackError);
  }
  
  throw dbError;
}
```

**✅ Rollback is implemented:**
- If DB insert fails → removes Storage file
- Prevents orphaned files in Storage

---

### Admin Signed URL Generation

**File:** `apps/admin/src/components/ActivityMediaPreview.tsx:EvidencePreview`

**Signed URL generation:**
```typescript
// Line 27-29
const { data, error: urlError } = await supabase.storage
  .from('ticket-evidences')
  .createSignedUrl(fileUrl, 3600); // 1 hour expiry
```

**✅ Signed URL generation is CORRECT:**
- Uses `fileUrl` prop directly from query
- No path reconstruction
- No concatenation
- No double prefix

**Query source (TicketActivity.tsx):**
```typescript
evidence:ticket_evidences!evidence_id(file_url)
```

**✅ Query is CORRECT:**
- Fetches `file_url` directly from `ticket_evidences`
- No manipulation

---

## ROOT CAUSE POSSIBILITIES

### A. File Never Uploaded

**Scenario:**
1. Mobile calls `.upload(fileName, blob)`
2. Upload fails (network, timeout, RLS)
3. Error not caught properly
4. DB insert proceeds anyway
5. Result: DB record exists, Storage file doesn't

**Evidence needed:**
- Mobile console logs showing upload error
- DB record created_at vs expected upload time

### B. Upload Failed but DB Created (Rollback Bug)

**Scenario:**
1. Upload succeeds
2. DB insert fails
3. Rollback `.remove()` fails silently
4. No wait, code throws error → DB wouldn't be created

**Unlikely** because code throws after rollback attempt.

### C. File Deleted After Upload

**Scenario:**
1. Upload succeeds
2. DB insert succeeds
3. File manually deleted from Storage
4. Or Storage retention policy deleted it

**Evidence needed:**
- Storage.objects history (if available)
- Manual deletion logs

### D. Path Stored Incorrectly

**Scenario:**
1. Upload uses path A
2. DB stores path B (different)
3. Admin requests path B
4. Storage doesn't have path B

**Unlikely** because code uses same `fileName` variable.

### E. Legacy Records

**Scenario:**
1. Evidence was created BEFORE current code
2. Old code had different path format
3. File no longer exists

**Possible** for old records.

---

## DIAGNOSTIC SCRIPT

**Created:** `scripts/diagnose-storage-path-mismatch.sql`

**10 diagnostic steps:**

1. **Find evidence record** in `ticket_evidences`
2. **Search Storage in ALL buckets** for filename
3. **Search by ticket_id prefix** in correct bucket
4. **Compare DB vs Storage paths** (JOIN)
5. **Check for double prefix bug** (4e8278ac/.../4e8278ac/...)
6. **Check recent uploads** (last 24h)
7. **Find orphaned Storage files** (Storage but not DB)
8. **Find orphaned DB records** (DB but not Storage) ← **KEY**
9. **Analyze path patterns** for all evidences
10. **Search filename without prefix**

---

## EXPECTED RESULTS

### ✅ Correct State

```sql
-- Step 1: ticket_evidences
file_url: '4e8278ac-b368-48a7-8ca6-5475dd7715bb/1788017486622-d2lndn.jpg'

-- Step 2: storage.objects
bucket_id: 'ticket-evidences'
name: '4e8278ac-b368-48a7-8ca6-5475dd7715bb/1788017486622-d2lndn.jpg'

-- Step 4: Comparison
db_path = storage_path → MATCH ✅
```

### ❌ Current (Broken) State

**Most likely:**
```sql
-- Step 1: ticket_evidences
file_url: '4e8278ac-b368-48a7-8ca6-5475dd7715bb/1788017486622-d2lndn.jpg'

-- Step 2: storage.objects
(0 rows) ← File not found in ANY bucket

-- Step 8: Orphaned DB records
1 record found ← DB exists but Storage doesn't
```

---

## ROOT CAUSE DETERMINATION

### If Step 2 = 0 rows (file not found):

**Possible causes:**
1. Upload failed (network error)
2. Upload succeeded but file deleted
3. Wrong bucket used

**Check:**
- Mobile console logs for upload error
- Storage.objects search in other buckets

### If Step 4 = MISMATCH:

**Possible causes:**
1. Path reconstruction bug (unlikely from code audit)
2. DB updated manually
3. Different code version used at upload time

**Check:**
- Compare exact paths
- Check git history for path format changes

### If Step 5 = DOUBLE PREFIX:

**Possible causes:**
1. Admin concatenating ticket_id again
2. Mobile uploading with wrong path

**Current code audit:** ✅ No double prefix in current code

### If Step 8 has records (orphaned DB):

**Confirmed cause:**
Upload failed but DB record created.

**Root cause options:**
1. Network timeout during upload
2. RLS blocked upload (but shouldn't, policy allows)
3. Upload error not properly caught
4. Race condition in error handling

---

## FIXING STRATEGY

### For NEW Uploads (Prevention)

**Option 1: Atomic transaction (NOT POSSIBLE)**
- Supabase Storage + DB are not in same transaction
- Can't rollback both atomically

**Option 2: Upload-first, then DB (CURRENT)**
```typescript
// ✅ Already implemented
1. Upload to Storage
2. If upload fails → throw, skip DB
3. Insert to DB
4. If DB fails → rollback Storage
```

**This is correct approach.**

**Improvement: Better error logging**
```typescript
if (uploadError) {
  console.error('[Evidence] Storage upload FAILED:', uploadError);
  console.error('[Evidence] Error code:', uploadError.statusCode);
  console.error('[Evidence] Error name:', uploadError.name);
  throw uploadError;
}
```

### For EXISTING Broken Records (Cleanup)

**Option 1: Delete orphaned DB records**
```sql
DELETE FROM ticket_evidences te
WHERE NOT EXISTS (
  SELECT 1 FROM storage.objects so
  WHERE so.name = te.file_url
    AND so.bucket_id = 'ticket-evidences'
);
```

**⚠️ Caution:** This deletes evidence metadata permanently.

**Option 2: Mark as unavailable**
```sql
-- Add column (migration)
ALTER TABLE ticket_evidences ADD COLUMN file_available boolean DEFAULT true;

-- Mark orphaned records
UPDATE ticket_evidences te
SET file_available = false
WHERE NOT EXISTS (
  SELECT 1 FROM storage.objects so
  WHERE so.name = te.file_url
    AND so.bucket_id = 'ticket-evidences'
);
```

**Then in UI:**
```typescript
if (!activity.evidence.file_available) {
  return <div>Archivo no disponible (registro histórico)</div>;
}
```

**Option 3: Keep as-is, handle in UI** ✅ **RECOMMENDED**
- Current UI already shows "Archivo no disponible"
- No data loss
- Historical records preserved
- Only affects display

---

## TESTING NEW UPLOADS

### E2E Test Required

1. **Clear state:**
   ```sql
   DELETE FROM ticket_evidences WHERE ticket_id = '<test_ticket>';
   DELETE FROM storage.objects WHERE name LIKE '<test_ticket>/%';
   ```

2. **Mobile: Take photo**
   - Check console: `[Evidence] Storage upload SUCCESS`
   - Check console: `[Evidence] DB INSERT SUCCESS`

3. **Verify Storage:**
   ```sql
   SELECT * FROM storage.objects
   WHERE name LIKE '<test_ticket>/%'
   ORDER BY created_at DESC;
   ```

4. **Verify DB:**
   ```sql
   SELECT file_url FROM ticket_evidences
   WHERE ticket_id = '<test_ticket>'
   ORDER BY created_at DESC;
   ```

5. **Compare:**
   ```sql
   SELECT
     te.file_url as db_path,
     so.name as storage_path,
     te.file_url = so.name as match
   FROM ticket_evidences te
   LEFT JOIN storage.objects so ON so.name = te.file_url
   WHERE te.ticket_id = '<test_ticket>';
   ```

6. **Admin: Refresh ticket**
   - Check console: `[EvidencePreview] Loading signed URL`
   - Check console: `[EvidencePreview] Signed URL loaded successfully`
   - Verify thumbnail visible

7. **Click thumbnail**
   - Lightbox opens with full image

---

## DELIVERABLE

### Mobile bucket:
✅ **`ticket-evidences`** (Line 29)

### Mobile upload path:
✅ **`${ticketId}/${timestamp}-${random}.${extension}`** (Line 18)

### DB stored path:
✅ **Same as upload path** (`file_url: fileName`, Line 48)

### Storage actual path:
⏳ **PENDING** - Run diagnostic SQL Step 2

### Match:
⏳ **PENDING** - Run diagnostic SQL Step 4

### Root cause:
⏳ **PENDING** - Likely "Upload failed but DB created" OR "File deleted after upload"

### Fix:
✅ **Current code is CORRECT**
- Upload-first pattern implemented
- Rollback mechanism exists
- No path reconstruction
- No double prefix

**For legacy records:**
✅ **UI already handles gracefully** ("Archivo no disponible")

### New evidence E2E:
⏳ **REQUIRES PHYSICAL TEST**

**Test steps:**
1. Take NEW photo from mobile
2. Verify console logs show SUCCESS
3. Run diagnostic SQL
4. Verify Admin thumbnail appears
5. Verify click opens image

---

## INVESTIGATION PRIORITIES

### Priority 1: Run Diagnostic SQL ⚠️ CRITICAL

```bash
ssh root@167.88.174.154
psql -U postgres -d postgres -f scripts/diagnose-storage-path-mismatch.sql
```

**This will reveal:**
- Does file exist in Storage?
- Does path match?
- Is this orphaned DB record?

### Priority 2: Check Mobile Logs

For the specific evidence:
- Did upload succeed?
- Was there an error?
- Was rollback triggered?

### Priority 3: E2E Test with NEW Photo

- Controlled environment
- Fresh data
- Validate entire flow

---

## RECOMMENDED ACTIONS

### Immediate (No Code Changes)

1. ✅ Run diagnostic SQL
2. ✅ Check if this is legacy record
3. ✅ If file missing: Accept as unavailable
4. ✅ Test with NEW photo

### If Pattern Continues (NEW uploads fail)

1. Add more detailed logging:
```typescript
console.log('[Evidence] Upload attempt:', {
  bucket: 'ticket-evidences',
  path: fileName,
  size: blob.size,
  type: blob.type
});

const { data: uploadData, error: uploadError } = await supabase.storage
  .from('ticket-evidences')
  .upload(fileName, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });

if (uploadError) {
  console.error('[Evidence] Upload failed:', {
    message: uploadError.message,
    statusCode: uploadError.statusCode,
    name: uploadError.name
  });
  throw uploadError;
}

console.log('[Evidence] Upload response:', uploadData);
```

2. Add health check:
```typescript
// Before upload, test bucket accessibility
const { data: testList, error: listError } = await supabase.storage
  .from('ticket-evidences')
  .list(ticketId, { limit: 1 });

if (listError) {
  console.error('[Evidence] Bucket not accessible:', listError);
  throw new Error('Storage bucket not accessible');
}
```

### If Orphaned Records Are Common

Create cleanup migration:
```sql
-- Mark unavailable
ALTER TABLE ticket_evidences ADD COLUMN IF NOT EXISTS file_available boolean DEFAULT true;

UPDATE ticket_evidences te
SET file_available = false
WHERE NOT EXISTS (
  SELECT 1 FROM storage.objects so
  WHERE so.name = te.file_url
    AND so.bucket_id = 'ticket-evidences'
)
AND file_available = true;
```

Update UI to check flag:
```typescript
if (activity.evidence && !activity.evidence.file_available) {
  return <div className="text-xs text-gray-500">
    Archivo no disponible (registro histórico)
  </div>;
}
```

---

## CONFIDENCE

**Code correctness:** ✅ **HIGH**
- Upload path construction: correct
- DB storage: correct  
- Admin retrieval: correct
- No reconstruction bugs
- No double prefix bugs

**Issue location:** ⚠️ **Storage or Network**
- Not a code bug in current version
- Either upload failure or file deletion

**Next step:** ⚠️ **RUN DIAGNOSTIC SQL**
- Will reveal exact state
- Will confirm root cause

---

## STATUS

🔍 **CODE AUDIT COMPLETE - AWAITING SQL DIAGNOSTIC**

**Code:** ✅ CORRECT (no bugs found)  
**SQL diagnostic:** ⏳ PENDING  
**E2E test:** ⏳ PENDING

**NOT DIAGNOSED** until:
- [ ] Run diagnostic SQL on VPS
- [ ] Determine if file exists in Storage
- [ ] Verify path match/mismatch
- [ ] Identify if orphaned DB record
- [ ] Test NEW photo upload E2E
