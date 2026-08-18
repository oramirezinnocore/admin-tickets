# Deployment Guide - Wisper Logística

## Prerequisites

### Required Services

1. **Supabase Project**
   - Create project at https://supabase.com
   - Note your project URL and keys

2. **Google Cloud Project** (for Maps/Routes)
   - Create project at https://console.cloud.google.com
   - Enable Maps JavaScript API
   - Enable Routes API
   - Create API keys

## Configuration Steps

### 1. Supabase Setup

#### Create Project

1. Go to https://supabase.com
2. Create new project
3. Choose region (prefer closest to users)
4. Wait for project provisioning

#### Get Credentials

From Supabase Dashboard → Settings → API:
- `Project URL` → NEXT_PUBLIC_SUPABASE_URL
- `anon public` key → NEXT_PUBLIC_SUPABASE_ANON_KEY
- `service_role` key → SUPABASE_SERVICE_ROLE_KEY (⚠️ NEVER expose to frontend)

#### Apply Migrations

```bash
# Link project
npx supabase link --project-ref your-project-ref

# Push all migrations
npx supabase db push
```

Verify in Supabase Dashboard → Database → Tables that all tables exist.

#### Configure Storage

In Supabase Dashboard → Storage:

1. Verify buckets exist (created by migrations):
   - `ticket-evidences` (private)
   - `ticket-signatures` (private)

2. If not created automatically, create manually:
   - Name: `ticket-evidences`
   - Public: OFF
   - File size limit: 5MB
   - Allowed MIME types: `image/*`

3. Same for `ticket-signatures`

### 2. Admin Environment

Create `apps/admin/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
GOOGLE_ROUTES_API_KEY=AIzaSy...
```

### 3. Technician Environment

Create `apps/technician/.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. E2E Testing Environment

Create `.env.e2e.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

ADMIN_EMAIL=admin@wisper.com
ADMIN_PASSWORD=YourSecurePassword123!
ADMIN_FULL_NAME=Admin Wisper

E2E_TECH_EMAIL=tecnico.e2e@wisper.com
E2E_TECH_PASSWORD=test-password-123
E2E_TECH_NAME=Técnico E2E

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
GOOGLE_ROUTES_API_KEY=AIzaSy...
```

### 5. Google Maps Setup

#### Create API Keys

1. Go to https://console.cloud.google.com
2. Select/Create project
3. Enable APIs:
   - Maps JavaScript API
   - Routes API
4. Create credentials → API key
5. Restrict keys:
   - **Maps API Key** (frontend): HTTP referrers (your domains)
   - **Routes API Key** (backend): IP addresses (your server)

#### Key Restrictions

**NEXT_PUBLIC_GOOGLE_MAPS_API_KEY** (frontend, maps display):
- Application restrictions: HTTP referrers
- Add: `localhost:3000/*`, `yourdomain.com/*`
- API restrictions: Maps JavaScript API

**GOOGLE_ROUTES_API_KEY** (backend, route optimization):
- Application restrictions: None or IP addresses
- API restrictions: Routes API
- ⚠️ NEVER expose this key to frontend

### 6. Create Admin User

```bash
npm run create-admin
```

Or manually in Supabase:

1. Dashboard → Authentication → Users → Add user
2. Email: admin@wisper.com
3. Auto-confirm: YES
4. Then in SQL Editor:

```sql
UPDATE profiles 
SET role = 'ADMIN', is_active = true 
WHERE email = 'admin@wisper.com';
```

### 7. Verify Installation

```bash
npm run health-check
```

Should show all ✅ checks passing.

## Production Deployment

### Admin (Vercel)

1. Push to GitHub
2. Import to Vercel
3. Set root directory: `apps/admin`
4. Add environment variables (from step 2)
5. Deploy

### Technician (EAS Build)

1. Install EAS CLI: `npm install -g eas-cli`
2. Configure `apps/technician/eas.json`
3. Build:
   ```bash
   cd apps/technician
   eas build --platform android
   eas build --platform ios
   ```

## Security Checklist

- [ ] Service role key NEVER in frontend
- [ ] Google Routes API key NEVER in frontend
- [ ] RLS enabled on all tables
- [ ] Storage buckets are private
- [ ] Admin accounts have strong passwords
- [ ] API keys have proper restrictions
- [ ] HTTPS enforced in production
- [ ] Supabase project has backup enabled

## Monitoring

### Health Check

Run periodically:
```bash
npm run health-check
```

### Supabase Dashboard

Monitor:
- Auth → User growth
- Database → Performance
- Storage → Usage
- Logs → Errors

### Application Logs

Check:
- Next.js logs (Vercel)
- Expo logs (EAS)
- Supabase logs

## Backup & Recovery

### Database Backup

Supabase Pro plan includes:
- Daily automatic backups
- Point-in-time recovery

Manual backup:
```bash
npx supabase db dump -f backup.sql
```

### Storage Backup

Configure Supabase storage replication in dashboard.

## Troubleshooting

### "Failed to fetch" errors

- Check Supabase URL is correct
- Verify project is not paused
- Check network/CORS settings

### RLS errors

- Verify migrations applied correctly
- Check policies in Supabase dashboard
- Test with `npm run test:rls`

### Storage upload fails

- Verify buckets exist and are private
- Check file size limits
- Verify MIME types allowed

### Maps not loading

- Check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set
- Verify API key restrictions allow your domain
- Check browser console for errors

## Support

- Supabase: https://supabase.com/docs
- Google Maps: https://developers.google.com/maps
- Next.js: https://nextjs.org/docs
- Expo: https://docs.expo.dev
