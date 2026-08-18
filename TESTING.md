# Testing Guide - Wisper Logística

## Setup

1. **Configure environment variables**

Copy `.env.e2e.example` to `.env.e2e.local`:

```bash
cp .env.e2e.example .env.e2e.local
```

Edit `.env.e2e.local` with your real Supabase credentials.

2. **Apply database migrations**

```bash
npx supabase db push
```

Or apply migrations manually from `supabase/migrations/` in chronological order.

3. **Create admin user**

```bash
npm run create-admin
```

## Health Check

Verify that all components are working:

```bash
npm run health-check
```

Expected output:
- ✅ SUPABASE: CONNECTED
- ✅ All tables exist
- ✅ Views exist
- ✅ Storage buckets exist

## Seed Test Data

Create E2E test data:

```bash
npm run seed:e2e
```

This creates:
- 2 test clients with `[E2E]` prefix
- 1 test technician (email from E2E_TECH_EMAIL)
- 4 test tickets with different SLA states

Seed is idempotent - safe to run multiple times.

## Run Tests

### SLA Validation

```bash
npm run test:sla
```

Verifies:
- GREEN ticket (0-24h)
- YELLOW ticket (24-48h)
- RED ticket (48-72h)
- OVERDUE ticket (>72h)
- Correct ordering

### RLS Validation

```bash
npm run test:rls
```

Verifies:
- Anonymous users cannot access tickets
- Technicians can read their own tickets
- Technicians cannot read other technicians' tickets
- Technicians can update their own tickets

### Storage Validation

```bash
npm run test:storage
```

Verifies:
- Technicians can upload files
- Technicians can download their files
- Signed URLs work correctly
- Storage policies are enforced

### Run All Tests

```bash
npm run test:e2e
```

## Manual Testing

### Admin Panel

1. Start admin: `npm run dev:admin`
2. Open http://localhost:3000
3. Login with admin credentials
4. Verify:
   - Dashboard loads with metrics
   - Clients page shows E2E clients
   - Technicians page shows E2E technician
   - Tickets page shows E2E tickets sorted by SLA
   - Map page loads (if Google Maps API configured)
   - Route optimization works (if Google Routes API configured)

### Technician App

1. Start app: `npm run dev:technician`
2. Scan QR with Expo Go
3. Login with E2E technician credentials
4. Verify:
   - Home screen shows correct stats
   - Tickets screen shows assigned tickets
   - Can open ticket detail
   - Can start/pause/resume ticket
   - Location tracking indicator shows status

## Troubleshooting

### Connection Issues

```bash
npm run health-check
```

If fails:
- Verify Supabase credentials in `.env.e2e.local`
- Check Supabase project is not paused
- Verify network connectivity

### Missing Tables

Run migrations:
```bash
npx supabase db push
```

### RLS Errors

Check RLS policies in Supabase dashboard or migrations files.

### Storage Errors

Verify buckets exist and are configured as private:
- `ticket-evidences`
- `ticket-signatures`

## Cleanup

To remove E2E test data:

```sql
-- In Supabase SQL Editor
DELETE FROM tickets WHERE reported_issue LIKE '%[E2E]%';
DELETE FROM clients WHERE name LIKE '%[E2E]%';
-- Technician and profile will need manual deletion
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run health check
  run: npm run health-check
  
- name: Run E2E tests
  run: npm run test:e2e
```
