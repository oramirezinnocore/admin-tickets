# WIS-REPORTING-01

## Status
**CODE COMPLETE** ✅

## Preflight
**Personnel completion changes:** Already committed in **02c47da**  
Working tree was clean before starting this ticket.

## Architecture

**Location:** `/apps/admin/src/app/reports/page.tsx` (710 lines)

**Data Query:**
- Single Supabase query with joins: `tickets` + `clients` + `technicians` + `profiles`
- Filtered by `created_at >= dateRange.start AND created_at <= dateRange.end`
- Client-side aggregation for KPIs, status, technician, and client metrics
- No N+1 queries

**Aggregation:**
- KPIs calculated from filtered tickets array
- Average times computed from raw millisecond differences (not formatted strings)
- Duration formatting uses seconds → HH:mm:ss with >24h support

**Dependencies:**
- PapaParse (already installed) for CSV export
- No new charting library added (clean tables/cards implementation)

## Access

| Role | Reporting Access | Enforcement |
|------|------------------|-------------|
| SUPER_ADMIN | ✅ Full access | canAccessBackOffice() + ProtectedLayout |
| ADMIN | ✅ Full access | canAccessBackOffice() + ProtectedLayout |
| SUPPORT | ✅ Full access (operational monitoring) | canAccessBackOffice() + ProtectedLayout |
| TECHNICIAN | ❌ No access | canAccessBackOffice() returns false → blocked by ProtectedLayout |

**RLS:** Tickets query uses authenticated user's RLS policies (SUPPORT already has SELECT access to tickets, clients, technicians via 20260926000000_add_support_role.sql)

**No service-role bypass:** All queries use authenticated Supabase client

## Date Filtering

**Population Basis:** `tickets.created_at`  
All tickets are filtered by creation date within the selected range.

**Presets:**
1. **Hoy:** Today 00:00:00 to 23:59:59
2. **Últimos 7 días:** 7 days ago to today
3. **Últimos 30 días:** 30 days ago to today  
4. **Este mes:** 1st of current month to today
5. **Personalizado:** User-selected start date and end date

**Custom Range:**
- Fecha inicial (date picker)
- Fecha final (date picker)
- End date adjusted to 23:59:59 for inclusive filtering
- "Aplicar" button triggers query reload

**Display:** Shows selected range in Spanish: "Mostrando tickets creados entre DD/MM/YYYY y DD/MM/YYYY"

## KPI Definitions

### 1. Tickets creados
**Formula:** `COUNT(tickets WHERE created_at IN dateRange)`  
**Population:** All tickets in selected period

### 2. Tickets cerrados
**Formula:** `COUNT(tickets WHERE status = 'RESOLVED' AND created_at IN dateRange)`  
**Population:** Tickets created in period that are now resolved

### 3. Tickets abiertos
**Formula:** `COUNT(tickets WHERE status NOT IN ('RESOLVED', 'CANCELLED') AND created_at IN dateRange)`  
**Population:** Tickets created in period that are still active

### 4. Tiempo promedio hasta atención
**Formula:**
```
AVG(
  (started_at - created_at) IN MILLISECONDS
  FOR tickets WHERE created_at IS NOT NULL AND started_at IS NOT NULL
) / 1000 seconds → HH:mm:ss
```
**Population:** Only tickets with both `created_at` and `started_at`  
**Display:** HH:mm:ss format (e.g., "02:30:45", "49:15:22" for >24h)  
**Fallback:** "No disponible" if no eligible tickets  
**Sample count displayed:** "(N tickets)" in subtitle

### 5. Tiempo promedio de atención
**Formula:**
```
AVG(
  (closed_at - started_at) IN MILLISECONDS
  FOR tickets WHERE started_at IS NOT NULL AND closed_at IS NOT NULL
) / 1000 seconds → HH:mm:ss
```
**Population:** Only tickets with both `started_at` and `closed_at`  
**Display:** HH:mm:ss format  
**Fallback:** "No disponible" if no eligible tickets  
**Sample count displayed:** "(N tickets)"

### 6. Tiempo promedio total del ticket
**Formula:**
```
AVG(
  (closed_at - created_at) IN MILLISECONDS
  FOR tickets WHERE created_at IS NOT NULL AND closed_at IS NOT NULL
) / 1000 seconds → HH:mm:ss
```
**Population:** Only tickets with both `created_at` and `closed_at`  
**Display:** HH:mm:ss format  
**Fallback:** "No disponible" if no eligible tickets  
**Sample count displayed:** "(N tickets)"

**IMPORTANT:** All averages calculated from raw timestamp arithmetic, NOT from formatted duration strings. This ensures correct >24 hour handling.

**Consistency:** Definitions match WIS-TICKET-METRICS-01 individual ticket timing metrics (reuses same conceptual approach)

## Ticket Status Reporting

**Implementation:** Status breakdown grid

**Statuses Tracked:**
- PENDING (Pendiente)
- ASSIGNED (Asignado)
- IN_REVIEW (En revisión)
- PAUSED (Pausado)
- RESOLVED (Resuelto)
- CANCELLED (Cancelado)

**Display:** 6-column responsive grid showing count per status with Spanish labels

**Source:** Real `ticket_status` enum from database (not invented)

## Technician Reporting

**Implementation:** Operational table

**Columns:**
1. Técnico (name from `technician.profile.full_name`)
2. Asignados (count of tickets with `technician_id = technician.id`)
3. Cerrados (count where status = RESOLVED)
4. Abiertos (count where status NOT IN (RESOLVED, CANCELLED))
5. Prom. hasta atención (avg `created_at → started_at` for this technician)
6. Prom. de atención (avg `started_at → closed_at` for this technician)
7. Prom. total (avg `created_at → closed_at` for this technician)

**Historical Technician Handling:**
- Uses actual `tickets.technician_id` foreign key
- Historical technicians appear if they have tickets in the period
- Inactive/role-changed technicians still show their historical data
- Does NOT filter by current profile.role = TECHNICIAN
- Preserves operational history correctly

**Presentation:**
- **No ranking, scoring, or leaderboard**
- **No "best" or "worst" labels**
- Simple operational data table
- Sorted by assigned tickets count (descending) for practicality

**Empty State:** "No hay datos de técnicos en este período"

**Averages:** Calculated per-technician from tickets assigned to that technician, same formula as global KPIs

## Client Reporting

**Implementation:** Client breakdown table

**Columns:**
1. Cliente (name from `clients.name`)
2. Creados (count of tickets for this client)
3. Abiertos (count where status NOT IN (RESOLVED, CANCELLED))
4. Cerrados (count where status = RESOLVED)

**Sorting:** By ticket count descending (most active clients first)

**Empty State:** "No hay datos de clientes en este período"

**Handling:** Uses `tickets.client` join, handles null clients gracefully (skipped in aggregation)

## SLA Reporting

**Implementation:** ✅ **IMPLEMENTED**

**Basis:** Authoritative SLA thresholds exist in `packages/shared/src/sla.ts`:
- **GREEN:** 0-24 hours
- **YELLOW:** 24-48 hours
- **RED:** 48-72 hours
- **OVERDUE:** >72 hours

**Metrics Displayed:**
1. Count of active tickets (not RESOLVED/CANCELLED) in each SLA state
2. Compliance percentage: `(GREEN + YELLOW + RED) / TOTAL * 100`

**Calculation:**
- Uses existing `getTicketSlaState(created_at)` function
- Applied only to **active tickets** (not closed/cancelled)
- Based on elapsed time from `created_at` to now

**Display:** 5-column grid showing:
- Green tickets (0-24h)
- Yellow tickets (24-48h)
- Red tickets (48-72h)
- Overdue tickets (>72h)
- Compliance % (within 72h target)

**Note:** Disclaimer shown: "SLA calculado sobre tickets activos (no cerrados ni cancelados) basado en tiempo transcurrido desde creación"

**WHY IMPLEMENTED:** Existing SLA rules are authoritative and well-defined. The 72-hour threshold is the operational target. Compliance metric helps identify whether active tickets are within acceptable response time.

## Export

### CSV Export ✅ **IMPLEMENTED**

**Library:** PapaParse (already in dependencies)

**Trigger:** "Exportar CSV" button (green, top-right)

**Content:** All tickets in current filtered date range

**Fields Exported:**
1. Folio (formatted: #000001)
2. Cliente (name or "N/A")
3. Técnico (name or "Sin asignar")
4. Estado (Spanish label)
5. Creado (localized datetime)
6. Iniciado (localized datetime or "N/A")
7. Cerrado (localized datetime or "N/A")
8. Tiempo hasta atención (seg) (raw seconds or "N/A")
9. Tiempo de atención (seg) (raw seconds or "N/A")
10. Tiempo total (seg) (raw seconds or "N/A")

**CSV Escaping:** PapaParse handles escaping automatically

**Security:** No internal secrets, service keys, or unrelated PII exposed

**Filename:** `reporte_tickets_YYYY-MM-DD.csv` (current date)

**Download:** Browser download via blob URL

### PDF Export ❌ **NOT IMPLEMENTED**

**Reason:** No existing PDF infrastructure found in codebase

**Dependencies checked:**
- No `jsPDF`, `pdfmake`, `react-pdf`, or similar libraries
- No existing PDF generation routes/utilities

**Decision:** CSV is sufficient for operational data export. PDF would require adding heavy dependencies solely for this feature.

**Recommendation:** Defer PDF to future enhancement when broader reporting/document generation infrastructure is established.

## Performance

**Query Strategy:**
- Single query with explicit date range bounds (`WHERE created_at >= X AND created_at <= Y`)
- Joins executed by Supabase (efficient database-side join)
- Result set size limited by date range

**Aggregation:**
- Client-side aggregation over already-filtered dataset
- Map-based aggregation for technicians and clients (O(n) passes)
- No nested loops or N+1 patterns

**Typical Load:**
- 30-day window: Reasonable dataset size for most operational scenarios
- Today/7-day windows: Very small datasets
- Custom ranges: User controls scope

**Data Fetched:**
- Tickets with necessary relations (client, technician+profile)
- Does NOT fetch:
  - ticket_evidences (images)
  - ticket_signatures (images)
  - ticket_status_history (not needed for KPIs)

**RLS Performance:** Standard RLS policies apply (existing indexes on `created_at`, `status`, `technician_id`)

**No Unbounded Queries:** Always date-filtered, never `SELECT * FROM tickets` without bounds

## Timezone

**Duration Calculations:**
- Absolute elapsed time in milliseconds
- `new Date(timestamp).getTime()` for UTC millisecond values
- No timezone conversion for duration arithmetic

**Date Filtering:**
- Date pickers use browser local timezone
- Range boundaries adjusted to 00:00:00 and 23:59:59 local time
- Supabase queries use ISO 8601 timestamps

**Display:**
- KPI durations: HH:mm:ss (timezone-independent elapsed time)
- CSV timestamps: `toLocaleString('es-MX')` (user's local time)
- Date range display: `toLocaleDateString('es-MX')`

**No String Arithmetic:** Never subtracts formatted date strings

## Empty / Partial Data Handling

**No Tickets in Period:**
- KPIs show 0 counts
- Average times show "No disponible"
- Tables show empty state messages
- No crashes

**No Closed Tickets:**
- "Tickets cerrados" = 0
- "Tiempo promedio de atención" = "No disponible"
- Technician/client metrics show 0 closed

**Tickets Without started_at:**
- Excluded from "Tiempo hasta atención" average
- Sample count reflects actual eligible tickets
- No fabricated 00:00:00

**Tickets Without closed_at:**
- Excluded from averages requiring closure
- Counted as "Abiertos" if not cancelled
- Duration metrics show "N/A" in CSV

**Inactive Historical Technicians:**
- Appear in technician table if they have tickets in period
- Name from historical profile record
- Metrics calculated normally

**Unassigned Tickets:**
- Not included in technician metrics
- Counted in overall KPIs normally

**Deleted/Deactivated Clients:**
- Client join may return null
- Handled gracefully (skipped in client metrics aggregation)
- Shows in ticket list as "N/A"

## UI

**Layout:** ProtectedLayout (standard admin layout)

**Structure:**
1. Header (title + export button)
2. Date filter section (presets + custom range)
3. Summary KPI cards (3 columns: created/closed/open)
4. Timing KPI cards (3 columns: avg times with sample counts)
5. Status breakdown grid (6 statuses)
6. SLA metrics grid (4 SLA states + compliance)
7. Technician metrics table (scrollable, 7 columns)
8. Client metrics table (scrollable, 4 columns)

**Responsiveness:**
- Grid layouts collapse on mobile (single column)
- Tables horizontal scroll on narrow screens
- Date filter inputs stack vertically on mobile

**Colors:**
- KPI cards: white bg, gray text, blue accents
- Export button: green
- Active preset: blue
- Inactive preset: gray
- SLA colors: green/yellow/red/gray backgrounds matching state

**Typography:** Consistent with existing Wisper admin (same font sizes, weights)

## Files Changed

**NEW:**
1. `apps/admin/src/app/reports/page.tsx` (710 lines) - Complete reporting module

**MODIFIED:**
2. `apps/admin/src/components/ProtectedLayout.tsx` (+1 line) - Added "Reportes" to navigation

## Database Changes

**Migration required:** **NO**

All data queried from existing schema:
- `tickets` (created_at, started_at, closed_at, status, technician_id, client_id)
- `clients` (id, name)
- `technicians` (id, profile_id)
- `profiles` (id, full_name)

No new tables, columns, or functions required.

Existing RLS policies grant appropriate access:
- SUPER_ADMIN, ADMIN: already have full ticket access
- SUPPORT: granted SELECT on tickets, clients, technicians in 20260926000000_add_support_role.sql

## Automated Validation

| Command | Actual Result |
|---------|---------------|
| `cd packages/shared && npm run build` | ✅ **PASS** - No errors |
| `cd apps/admin && npx tsc --noEmit` | ✅ **PASS** - No errors |

**No new shared code:** All reporting logic in admin app, uses existing shared types/utilities

## Master Regression Cases

### TR-REPORT-01: Role Access Control
**Prerequisites:** Test users with different roles  
**Steps:**
1. Login as SUPER_ADMIN → navigate to Reportes
2. Login as ADMIN → navigate to Reportes
3. Login as SUPPORT → navigate to Reportes
4. Login as TECHNICIAN → attempt to access /reports route

**Expected:**
- SUPER_ADMIN: ✅ Access granted, full visibility
- ADMIN: ✅ Access granted, full visibility
- SUPPORT: ✅ Access granted, full visibility
- TECHNICIAN: ❌ Redirected by ProtectedLayout (canAccessBackOffice fails)

---

### TR-REPORT-02: Default Period (Últimos 30 días)
**Steps:**
1. Navigate to Reportes
2. Verify "Últimos 30 días" is selected by default
3. Verify date range shows 30 days ago to today

**Expected:** Default preset active, date range correct

---

### TR-REPORT-03: Custom Date Range
**Steps:**
1. Click "Personalizado"
2. Set Fecha inicial: 2026-08-01
3. Set Fecha final: 2026-08-31
4. Click "Aplicar"
5. Verify date range updates
6. Verify tickets are filtered to August 2026 only

**Expected:** Custom range applied, KPIs recalculated for August tickets

---

### TR-REPORT-04: KPI Counts Accuracy
**Prerequisites:** Known test dataset with specific counts  
**Steps:**
1. Query tickets directly: `SELECT COUNT(*) FROM tickets WHERE created_at BETWEEN X AND Y`
2. Compare with "Tickets creados" KPI
3. Query RESOLVED tickets, compare with "Tickets cerrados"
4. Query active tickets, compare with "Tickets abiertos"

**Expected:** KPI counts match database queries exactly

---

### TR-REPORT-05: Average Time to Attention Calculation
**Prerequisites:** Tickets with known `created_at` and `started_at` timestamps  
**Steps:**
1. Manually calculate average: `AVG((started_at - created_at) IN SECONDS)`
2. Compare with "Tiempo promedio hasta atención" display
3. Verify HH:mm:ss format
4. Verify sample count matches tickets with both timestamps

**Expected:** Average matches manual calculation, format correct

---

### TR-REPORT-06: Average Attention Time Calculation
**Prerequisites:** Tickets with known `started_at` and `closed_at`  
**Steps:**
1. Manually calculate average: `AVG((closed_at - started_at) IN SECONDS)`
2. Compare with "Tiempo promedio de atención"
3. Verify sample count

**Expected:** Average correct, sample count accurate

---

### TR-REPORT-07: Average Total Time Calculation
**Prerequisites:** Tickets with known `created_at` and `closed_at`  
**Steps:**
1. Manually calculate average: `AVG((closed_at - created_at) IN SECONDS)`
2. Compare with "Tiempo promedio total"

**Expected:** Average matches, >24h durations display correctly (e.g., 49:15:22)

---

### TR-REPORT-08: >24 Hour Duration Display
**Prerequisites:** Ticket with 49 hours 15 minutes elapsed time  
**Steps:**
1. View timing KPIs
2. Verify format shows "49:15:XX" (not "01:15:XX")

**Expected:** No 24-hour wrapping, hours accumulate beyond 24

---

### TR-REPORT-09: Status Breakdown Accuracy
**Steps:**
1. Count tickets by status in database
2. Compare with status breakdown grid counts

**Expected:** All 6 statuses show correct counts, Spanish labels correct

---

### TR-REPORT-10: Historical Technician Data Preservation
**Prerequisites:** Technician who changed role to SUPPORT but has historical tickets  
**Steps:**
1. Select date range covering historical tickets
2. Verify technician appears in "Métricas por Técnico" table
3. Verify assigned tickets count is correct

**Expected:** Historical technician data appears, counts accurate despite role change

---

### TR-REPORT-11: Technician Metrics Calculation
**Prerequisites:** Known technician with calculable metrics  
**Steps:**
1. Manually calculate assigned/closed/open for technician
2. Manually calculate avg times for technician's tickets
3. Compare with table row for that technician

**Expected:** All metrics match manual calculations

---

### TR-REPORT-12: Client Breakdown Accuracy
**Steps:**
1. Count tickets by client in database
2. Compare with "Métricas por Cliente" table

**Expected:** All clients with tickets appear, counts correct

---

### TR-REPORT-13: Empty Period Handling
**Steps:**
1. Select custom date range with no tickets (e.g., future date)
2. Verify page doesn't crash
3. Verify KPIs show 0 or "No disponible"
4. Verify tables show empty state messages

**Expected:** Graceful handling, no errors, appropriate messages

---

### TR-REPORT-14: Incomplete Timestamps Handling
**Prerequisites:** Tickets without `started_at` or `closed_at`  
**Steps:**
1. View KPIs
2. Verify "No disponible" shown if no eligible tickets
3. Verify sample counts exclude tickets with missing timestamps
4. Export CSV, verify "N/A" for missing timestamps

**Expected:** Missing data handled gracefully, no fabricated durations

---

### TR-REPORT-15: CSV Export Content
**Steps:**
1. Apply date filter
2. Click "Exportar CSV"
3. Open downloaded file
4. Verify columns: Folio, Cliente, Técnico, Estado, timestamps, durations
5. Verify row count matches filtered tickets
6. Verify special characters escaped correctly

**Expected:** Valid CSV file, all data present, proper escaping

---

### TR-REPORT-16: SUPPORT Access to All Data
**Prerequisites:** Login as SUPPORT user  
**Steps:**
1. Navigate to Reportes
2. Verify KPIs visible
3. Verify technician table visible
4. Verify client table visible
5. Verify can export CSV

**Expected:** SUPPORT has full read access to operational reports

---

### TR-REPORT-17: TECHNICIAN Denied Access
**Prerequisites:** Login as TECHNICIAN  
**Steps:**
1. Verify "Reportes" link NOT in navigation
2. Attempt direct navigation to /reports
3. Verify redirected/blocked

**Expected:** TECHNICIAN cannot access reports module

---

### TR-REPORT-18: SLA Calculations Accuracy
**Prerequisites:** Active tickets in different SLA states  
**Steps:**
1. Identify tickets by age: <24h, 24-48h, 48-72h, >72h
2. Compare with SLA breakdown counts
3. Calculate compliance: (green + yellow + red) / total * 100
4. Compare with displayed compliance %

**Expected:** SLA state counts correct, compliance % matches calculation

---

**Total Test Cases:** 18  
**Estimated Testing Time:** ~90 minutes (comprehensive coverage)

## Remaining Risks

**1. Large Dataset Performance (LOW)**
- **Risk:** Very long custom date ranges (e.g., 1 year) may load many tickets
- **Likelihood:** Low - operational reporting typically uses recent windows
- **Mitigation:** Date filtering bounds query, user controls scope
- **Recommended:** If becomes issue, add warning for ranges >90 days

**2. Technician Name Display After Account Deletion (LOW)**
- **Risk:** If technician profile/account deleted, name may not display
- **Current:** Uses LEFT JOIN, will show null
- **Impact:** Technician row would show blank name or cause aggregation skip
- **Mitigation:** Soft deletes (is_active) already used, not hard deletes
- **Recommended:** If hard deletes implemented, denormalize technician name

**3. CSV Special Character Handling (VERY LOW)**
- **Risk:** Client/technician names with quotes/commas might break CSV
- **Mitigation:** PapaParse handles standard CSV escaping
- **Likelihood:** Very low - library is mature
- **Testing:** Manual verification with special characters recommended

**NO CRITICAL RISKS**

All core functionality implemented with appropriate error handling and graceful degradation.

## Git

**Personnel completion commit:** 02c47da  
**Reporting commit:** 2860048 ✅  
**Branch:** main  
**Working tree:** Clean

**Changes:**
```
apps/admin/src/app/reports/page.tsx           | 710 ++++++++++++++++++++++++
apps/admin/src/components/ProtectedLayout.tsx |   1 +
2 files changed, 711 insertions(+)
```

## Deployment Later

**Supabase migrations pending:**
1. 20260925200000_harden_ticket_close_authorization.sql (WIS-TICKET-METRICS-01)
2. 20260926000000_add_support_role.sql (WIS-PERSONNEL-RBAC-01)
3. 20260926100000_harden_profile_updates.sql (WIS-PERSONNEL-RBAC-01 completion)

**Order:** Apply in sequence (1 → 2 → 3)

**Admin VPS update required:** **YES** ✅
- New /reports route
- Updated navigation
- New /api/personnel endpoint (from Personnel ticket)
- Rebuild: `npm run build` in apps/admin
- Deploy updated build to VPS

**Technician APK rebuild required:** **NO** ❌
- No mobile app changes in any ticket
- Technician workflow unchanged

## Backlog Recommendation

**WIS-REPORTING-01:** **CODE COMPLETE** ✅

All requirements implemented:
- ✅ Date filtering (5 presets + custom)
- ✅ Summary KPIs (6 metrics with correct formulas)
- ✅ Status breakdown (6 statuses)
- ✅ SLA metrics (existing thresholds applied)
- ✅ Technician operational table (historical preservation)
- ✅ Client breakdown
- ✅ CSV export
- ✅ Authorization (SUPER_ADMIN/ADMIN/SUPPORT: YES, TECHNICIAN: NO)
- ✅ No charting library added (clean implementation)
- ✅ >24 hour duration support
- ✅ Graceful empty/partial data handling

---

**DEVELOPMENT BACKLOG STATUS:** **CODE COMPLETE** ✅

All planned tickets completed:
1. ✅ WIS-CLIENT-BULK-IMPORT-V3.1 (migration syntax fix)
2. ✅ WIS-TICKET-WORKFLOW-01 + WIS-BUG-SOLUTION-STATE-01 (workflow + solution persistence)
3. ✅ WIS-TICKET-METRICS-01 (timing metrics + close authorization hardening)
4. ✅ WIS-PERSONNEL-RBAC-01 (SUPPORT role + personnel management)
5. ✅ WIS-PERSONNEL-RBAC-01 COMPLETION (role transitions + RLS hardening)
6. ✅ **WIS-REPORTING-01** (operational reporting dashboard)

## Final Next Action

**"Development backlog code-complete. Prepare consolidated deployment and master regression."**

**Next Steps:**
1. **Consolidated Migration Deployment** (3 pending migrations in order)
2. **Admin VPS Deployment** (full rebuild with all tickets)
3. **Master Regression Suite** (integrate all TR-* test cases from all tickets)
4. **Production Validation** (~2-3 hours comprehensive testing)
5. **Git Push** (all commits to origin/main)

**Estimated Total Deployment + Regression Time:** 4-5 hours

**All code changes are LOCAL ONLY.** No remote changes have been made. Ready for coordinated production deployment.
