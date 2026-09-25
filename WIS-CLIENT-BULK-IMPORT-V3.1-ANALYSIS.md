# WIS-CLIENT-BULK-IMPORT-V3.1: Security and Retry Audit

## Critical Issues Found

### 1. RPC Authorization Vulnerability (CRITICAL)

**Location:** `supabase/migrations/20260924000000_atomic_client_imports.sql:35-38`

```sql
CREATE OR REPLACE FUNCTION commit_client_import(
  p_import_id text,
  p_user_id uuid  -- ❌ ACCEPTS USER_ID AS PARAMETER
)
```

**Attack Vector:**
1. Attacker authenticates as regular user
2. Obtains SUPER_ADMIN UUID from `profiles` table (if readable)
3. Calls RPC directly: `supabase.rpc('commit_client_import', { p_import_id: 'x', p_user_id: '<super_admin_uuid>' })`
4. Function checks role of provided UUID → SUPER_ADMIN → grants access

**Root Cause:** Function trusts caller-provided user ID instead of deriving it from `auth.uid()`.

**Fix:** Remove `p_user_id` parameter, use `auth.uid()` internally.

---

### 2. Duplicate Staging Records on Retry (DATA INTEGRITY)

**Location:** `apps/admin/src/app/api/clients/import/route.ts:629-634`

```typescript
if (existingJob?.status === 'committed') {
  return idempotent success; // ✅
}
// If failed or staging, allow retry by continuing
console.log(`Retrying import ${importId}`); // ❌ NO CLEANUP
```

**Scenario:**
1. First attempt stages 5,000 records, then commit fails
2. Retry with same `import_id` stages another 5,000 records
3. Staging table now has 10,000 records for same `import_id`
4. Commit attempts to insert 10,000 records → violates uniqueness constraints or creates duplicates

**Root Cause:** No cleanup of existing staging records before retry.

**Fix:** Clear staging records for `import_id` before restarting.

---

### 3. Transaction Rollback Overwrites Committed Status (RACE CONDITION)

**Location:** `supabase/migrations/20260924000000_atomic_client_imports.sql:158-169`

```sql
EXCEPTION
  WHEN OTHERS THEN
    UPDATE client_import_jobs SET status = 'failed' ...;
    RAISE;  -- ❌ ROLLS BACK THE UPDATE
END;
```

**Scenario A - Rollback:**
- Function fails during commit
- EXCEPTION block updates status to 'failed'
- RAISE rolls back entire transaction, including the UPDATE
- Job status remains in previous state ('staging')
- API catches error, updates status to 'failed' ✅

**Scenario B - Timeout (CRITICAL):**
1. RPC commits successfully (status → 'committed')
2. Network timeout before response reaches API
3. API catches timeout error
4. API updates status to 'failed' (line 693-700)
5. Successfully committed job now marked as failed
6. Retry would be prevented (status is 'failed' not 'committed')
7. **Data integrity violated: records committed but reported as failed**

**Root Cause:** API blindly overwrites job status on error without checking current state.

**Fix:** API should only update to 'failed' if current status is NOT 'committed'.

---

### 4. Geocoding Timeout (OPERATIONAL)

**Location:** `apps/admin/src/app/api/clients/import/route.ts:27`

```typescript
const GEOCODE_LIMIT = 500;  // ❌ 16+ MINUTES
```

**Math:**
- 500 addresses × 2 seconds = 1,000 seconds = 16.67 minutes
- Next.js default timeout: 60 seconds (Vercel), 120 seconds (self-hosted)
- **Result:** Every large import without coordinates will timeout

**Root Cause:** GEOCODE_LIMIT exceeds any reasonable HTTP timeout.

**Fix:** Reduce to 50 addresses (conservatively fits in 60s timeout).

---

### 5. No Concurrency Protection (RACE CONDITION)

**Location:** RPC function lacks row locking

**Scenario:**
1. Two API requests with same `import_id` arrive concurrently
2. Both check job status → 'staging'
3. Both call commit simultaneously
4. No lock prevents concurrent execution
5. Possible outcomes:
   - Both try to insert same records → second fails with uniqueness violation
   - First commits, second sees 'committed' → idempotent success (wasteful but safe)

**Root Cause:** No `SELECT FOR UPDATE` lock on job row.

**Fix:** Lock job row at start of RPC to serialize concurrent attempts.

---

### 6. No Detection of Import ID Reuse with Different Data (DATA INTEGRITY)

**Scenario:**
1. Import 1,000 clients with `import_id = 'abc123'`
2. Import commits successfully
3. User imports DIFFERENT 1,000 clients with same `import_id = 'abc123'` (frontend bug, cached state, etc.)
4. RPC sees status 'committed' → returns idempotent success
5. Second dataset never imported, user believes it succeeded

**Root Cause:** No content hash to detect different data.

**Fix:** Store hash of validated rows in job record, compare on retry.

---

## Summary

| Issue | Severity | Impact |
|-------|----------|--------|
| RPC accepts user_id parameter | **CRITICAL** | Privilege escalation |
| Duplicate staging on retry | **HIGH** | Data duplication or constraint violations |
| Timeout overwrites committed status | **CRITICAL** | Reports success as failure |
| Geocoding timeout | **HIGH** | Operational failure for valid use case |
| No concurrency lock | **MEDIUM** | Wasted resources, potential race |
| No data integrity check on reuse | **MEDIUM** | Silent data loss |

---

## Next Steps

1. Implement fixes in new migration
2. Update API route with retry logic
3. Add comprehensive tests
4. Verify authorization with non-admin user
5. Measure actual geocoding performance
