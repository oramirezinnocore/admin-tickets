# WIS-022-HF01 Test Cases - ticket_status_history RLS Fix

## Test Environment Setup

Before running tests:
1. Apply migration: `20260828000000_fix_ticket_status_history_super_admin_rls.sql`
2. Ensure SUPER_ADMIN user exists
3. Ensure regular ADMIN user exists
4. Ensure TECHNICIAN user exists

## TC-RLS-01: SUPER_ADMIN can create ticket

**Preconditions:**
- User authenticated as SUPER_ADMIN
- Client exists for the ticket

**Steps:**
1. Navigate to Admin UI → Nuevo Ticket
2. Fill ticket form (client, description, etc.)
3. Click "Crear Ticket"

**Expected:**
- ✅ Ticket created successfully
- ✅ No RLS error
- ✅ Ticket appears in tickets list
- ✅ Initial status history record created

**SQL Verification:**
```sql
SELECT * FROM tickets WHERE id = '<new_ticket_id>';
SELECT * FROM ticket_status_history WHERE ticket_id = '<new_ticket_id>';
```

## TC-RLS-02: ADMIN can create ticket

**Preconditions:**
- User authenticated as ADMIN (not SUPER_ADMIN)
- Client exists for the ticket

**Steps:**
1. Navigate to Admin UI → Nuevo Ticket
2. Fill ticket form
3. Click "Crear Ticket"

**Expected:**
- ✅ Ticket created successfully
- ✅ No RLS error
- ✅ Initial status history record created

## TC-RLS-03: ticket_status_history contains initial status

**Preconditions:**
- Ticket created by ADMIN or SUPER_ADMIN

**Steps:**
1. Query ticket_status_history for new ticket

**SQL:**
```sql
SELECT 
  id,
  ticket_id,
  previous_status,
  new_status,
  created_at
FROM ticket_status_history
WHERE ticket_id = '<ticket_id>'
ORDER BY created_at ASC;
```

**Expected:**
- ✅ One record exists
- ✅ `previous_status` is NULL
- ✅ `new_status` is 'PENDING' (or initial status)
- ✅ `created_at` matches ticket creation time

## TC-RLS-04: History has correct ticket_id

**Preconditions:**
- Multiple tickets exist

**Steps:**
1. Create ticket A
2. Create ticket B
3. Query history for ticket A

**Expected:**
- ✅ History records only show ticket A's ID
- ✅ No cross-contamination with ticket B

## TC-RLS-05: History has correct changed_by (if applicable)

**Preconditions:**
- Ticket status updated by user

**Steps:**
1. Update ticket status via Admin UI
2. Query ticket_status_history

**Expected:**
- ✅ `changed_by` field populated (may be NULL for trigger-only changes)
- ✅ If populated, matches updating user's ID

## TC-RLS-06: TECHNICIAN does not gain admin privileges

**Preconditions:**
- User authenticated as TECHNICIAN

**Steps:**
1. Attempt to insert into ticket_status_history directly (via SQL client or API)

**SQL:**
```sql
INSERT INTO ticket_status_history (ticket_id, new_status)
VALUES ('<ticket_id>', 'COMPLETED');
```

**Expected:**
- ❌ RLS policy blocks insert
- ✅ Only allowed if ticket is assigned to that technician

## TC-RLS-07: Unauthenticated user cannot insert history

**Preconditions:**
- No authenticated session (anon key)

**Steps:**
1. Attempt to insert into ticket_status_history via anon client

**Expected:**
- ❌ RLS policy blocks insert
- ✅ Error: "new row violates row-level security policy"

## TC-RLS-08: RLS remains enabled

**Preconditions:**
- Migration applied

**Steps:**
1. Check RLS status

**SQL:**
```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'ticket_status_history';
```

**Expected:**
- ✅ `rowsecurity` = true
- ✅ RLS is enabled

## TC-RLS-09: Policies exist and are correct

**SQL:**
```sql
SELECT 
  polname,
  polcmd,
  polroles::regrole[],
  pg_get_expr(polqual, polrelid) as using_clause,
  pg_get_expr(polwithcheck, polrelid) as with_check_clause
FROM pg_policy
WHERE polrelid = 'ticket_status_history'::regclass
ORDER BY polname;
```

**Expected Policies:**
- ✅ "Admins and Super Admins can insert status history" (INSERT)
- ✅ "Admins and Super Admins can update status history" (UPDATE)
- ✅ "Admins and Super Admins can delete status history" (DELETE)
- ✅ "Technicians can insert status history for their tickets" (INSERT)
- ✅ "Admins can view all status history" (SELECT)
- ✅ "Technicians can view history for their tickets" (SELECT)

## TC-RLS-10: Push tokens policy updated

**SQL:**
```sql
SELECT 
  polname,
  pg_get_expr(polqual, polrelid) as using_clause
FROM pg_policy
WHERE polrelid = 'technician_push_tokens'::regclass
  AND polname LIKE '%Admin%';
```

**Expected:**
- ✅ Policy name includes "Super Admins"
- ✅ Using clause calls `is_admin_or_super()`

## TC-RLS-11: Trigger continues to work

**Preconditions:**
- Ticket exists
- User is SUPER_ADMIN or ADMIN

**Steps:**
1. Update ticket status from PENDING → ASSIGNED
2. Query ticket_status_history

**Expected:**
- ✅ New history record created
- ✅ `previous_status` = 'PENDING'
- ✅ `new_status` = 'ASSIGNED'
- ✅ No RLS error

## TC-RLS-12: Multiple status changes tracked

**Steps:**
1. Create ticket (PENDING)
2. Assign to technician (ASSIGNED)
3. Technician starts work (IN_PROGRESS)
4. Technician completes (COMPLETED)
5. Query history

**Expected:**
- ✅ 4 records in history
- ✅ Chronological order maintained
- ✅ Each transition recorded correctly

## Regression Tests

### R1: Admin module not affected
- ✅ Admin can still create administrators
- ✅ SUPER_ADMIN can access /administrators

### R2: Technician app not affected
- ✅ Technicians can still update ticket status
- ✅ Push notifications work
- ✅ GPS tracking works

### R3: Realtime continues working
- ✅ Ticket updates propagate via Realtime
- ✅ No subscription errors

### R4: Storage policies not affected
- ✅ Can upload ticket evidences
- ✅ Can upload signatures
