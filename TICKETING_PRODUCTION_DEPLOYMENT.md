# Ticketing Admin - Production Deployment Guide

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Initial Deployment](#initial-deployment)
- [Updating Production](#updating-production)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Troubleshooting](#troubleshooting)
- [MapLibre Validation](#maplibre-validation)
- [Rollback Procedures](#rollback-procedures)
- [Supabase Considerations](#supabase-considerations)

---

## Architecture Overview

### Production Stack

```
Internet
   ↓
ticketing.intuspath.com:443 (HTTPS)
   ↓
Nginx (VPS)
   ↓
127.0.0.1:3004
   ↓
Docker Container (ticketing-admin)
   ↓
Next.js 16.3.1 (Standalone) :3000
   ↓
External Supabase
```

### Key Components

- **Domain**: `https://ticketing.intuspath.com`
- **Container**: `ticketing-admin`
- **Port Binding**: `127.0.0.1:3004:3000` (localhost only, not exposed publicly)
- **Next.js**: Standalone output mode for optimized production bundle
- **Database**: External Supabase (not containerized)
- **Mobile App**: Technician app is mobile-only, NOT deployed in this container

---

## Prerequisites

### On the VPS

1. **Docker** (with Docker Compose V2)
   ```bash
   docker --version
   docker compose version  # Note: NOT docker-compose
   ```

2. **Git**
   ```bash
   git --version
   ```

3. **System Tools**
   ```bash
   curl --version
   jq --version  # For health check JSON parsing
   ```

4. **Nginx** (already configured)
   - Reverse proxy from `ticketing.intuspath.com` → `127.0.0.1:3004`
   - SSL/TLS certificate via Certbot
   - Configuration file: (check existing Nginx setup)

### On Local Machine (for validation)

- Node.js 22.19.0
- npm (for local testing)

---

## Environment Variables

### Required Variables

Create `.env.production` on the VPS based on `.env.production.example`:

```bash
# On VPS
cd /path/to/admin-tickets
cp .env.production.example .env.production
nano .env.production  # Or use vim, vi, etc.
```

#### Build-Time Variables (NEXT_PUBLIC_*)

These are baked into the client-side JavaScript during Docker build:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Important**: If you change these, you MUST rebuild the Docker image.

#### Runtime Server Variables

These can be changed without rebuilding (just restart container):

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # SECRET
ROUTING_BASE_URL=https://router.project-osrm.org  # Optional
GEOCODING_BASE_URL=https://photon.komoot.io  # Optional
```

### Variable Security

| Variable | Type | Exposed to Client? | Rebuild Required? |
|----------|------|-------------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Build-time | ✅ Yes | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build-time | ✅ Yes | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime | ❌ No (SECRET) | ❌ No |
| `ROUTING_BASE_URL` | Runtime | ❌ No | ❌ No |
| `GEOCODING_BASE_URL` | Runtime | ❌ No | ❌ No |

⚠️ **CRITICAL**: `SUPABASE_SERVICE_ROLE_KEY` is a SECRET. It has full database access and bypasses RLS. NEVER:
- Expose it in client-side code
- Log it in console/files
- Commit it to git
- Convert it to `NEXT_PUBLIC_*`

---

## Initial Deployment

### Step 1: Clone Repository on VPS

```bash
# SSH into VPS
ssh user@your-vps-ip

# Clone repository
cd /opt  # Or your preferred location
git clone <repository-url> admin-tickets
cd admin-tickets

# Checkout production branch (if different from main)
git checkout main  # Or production branch
```

### Step 2: Configure Environment

```bash
# Create production environment file
cp .env.production.example .env.production

# Edit with your actual values
nano .env.production
```

Fill in all required variables from Supabase Dashboard.

### Step 3: Run Deployment Script

```bash
# Make script executable (if not already)
chmod +x deploy-production.sh

# Run deployment
./deploy-production.sh
```

The script will:
1. ✅ Validate `.env.production` exists
2. ✅ Check Docker/Docker Compose V2 availability
3. ✅ Validate environment variables are set
4. ✅ Validate Docker Compose configuration
5. ✅ Build Docker image (this takes several minutes)
6. ✅ Stop existing container (if running)
7. ✅ Start new container
8. ✅ Wait for health check to pass
9. ✅ Display success message

### Step 4: Verify Deployment

```bash
# Check container status
docker compose -f docker-compose.production.yml ps

# Check health endpoint
curl http://localhost:3004/api/health

# Check logs
docker compose -f docker-compose.production.yml logs -f

# Access via domain (from external browser)
# https://ticketing.intuspath.com
```

---

## Updating Production

When you have new code changes to deploy:

### Option A: Automated Update Script (Recommended)

```bash
cd /opt/admin-tickets  # Or your repo location

# Run update script
./update-production.sh
```

The script will:
1. ✅ Check for uncommitted changes (prevents data loss)
2. ✅ Pull latest code from git
3. ✅ Rebuild Docker image
4. ✅ Recreate container with new image
5. ✅ Wait for health check
6. ✅ Clean up old images

### Option B: Manual Update

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose --env-file .env.production -f docker-compose.production.yml build --no-cache
docker compose --env-file .env.production -f docker-compose.production.yml up -d

# Check health
curl http://localhost:3004/api/health
```

---

## Monitoring & Health Checks

### Health Endpoint

```bash
# Check application health
curl http://localhost:3004/api/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-08-27T12:00:00.000Z",
  "service": "ticketing-admin"
}
```

### Docker Health Check

The container has a built-in health check that runs every 30 seconds:

```bash
# View health status
docker inspect ticketing-admin | grep -A 10 Health

# Or use docker compose
docker compose -f docker-compose.production.yml ps
```

### Logs

```bash
# View real-time logs
docker compose -f docker-compose.production.yml logs -f

# View last 100 lines
docker compose -f docker-compose.production.yml logs --tail=100

# View logs for specific time range
docker compose -f docker-compose.production.yml logs --since 30m
```

### Container Stats

```bash
# View resource usage
docker stats ticketing-admin

# View all containers
docker ps -a
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose -f docker-compose.production.yml logs

# Check if port is already in use
sudo lsof -i :3004

# Verify environment variables
docker compose --env-file .env.production -f docker-compose.production.yml config
```

### Health Check Failing

```bash
# Check if Next.js is running
docker exec ticketing-admin ps aux | grep node

# Check internal health (from inside container)
docker exec ticketing-admin wget -O- http://localhost:3000/api/health

# Check if port 3000 is listening inside container
docker exec ticketing-admin netstat -tlnp
```

### MapLibre Not Loading

See [MapLibre Validation](#maplibre-validation) section below.

### 502 Bad Gateway from Nginx

```bash
# Verify container is running
docker ps | grep ticketing-admin

# Verify port binding
docker port ticketing-admin

# Expected: 3000/tcp -> 127.0.0.1:3004

# Test direct access to container
curl http://localhost:3004/

# Check Nginx configuration
sudo nginx -t
sudo systemctl status nginx
```

### Database Connection Issues

```bash
# Verify Supabase credentials in .env.production
cat .env.production | grep SUPABASE

# Test connection from container
docker exec ticketing-admin node -e "
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  client.from('tickets').select('count').then(console.log).catch(console.error);
"
```

### Out of Memory / Disk Space

```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Clean up old images (CAREFUL: only removes unused images)
docker image prune -a

# Check container memory limits
docker stats ticketing-admin
```

---

## MapLibre Validation

### Why This Is Critical

MapLibre GL requires special handling in Next.js production builds. The worker files MUST be accessible at `/maplibre/maplibre-gl-worker.mjs` for maps to load correctly.

### Validation Steps

#### 1. Verify Worker Files Exist in Image

```bash
# Check if MapLibre worker files are in the built image
docker exec ticketing-admin ls -la /app/apps/admin/public/maplibre/

# Expected files:
# - maplibre-gl-worker.mjs
# - maplibre-gl-shared.mjs
```

#### 2. Verify Files Are Accessible via HTTP

```bash
# Test worker file accessibility
curl http://localhost:3004/maplibre/maplibre-gl-worker.mjs

# Expected: JavaScript code (NOT 404, NOT text/html)
# First line should be: import * as e from"./maplibre-gl-shared.mjs";
```

#### 3. Verify in Browser

1. Open `https://ticketing.intuspath.com`
2. Open Developer Tools (F12)
3. Go to Network tab
4. Navigate to a page with a map
5. Filter by "maplibre"
6. Verify:
   - ✅ `/maplibre/maplibre-gl-worker.mjs` loads (200 OK)
   - ✅ Content-Type is `application/javascript` or `text/javascript`
   - ❌ NOT 404 Not Found
   - ❌ NOT text/html (which indicates Nginx error page)

#### 4. Check Console for Errors

In browser console, look for:
- ❌ `Failed to load worker` → Worker file not accessible
- ❌ `MIME type ('text/html') is not executable` → Nginx serving error page instead of worker
- ✅ No MapLibre-related errors → Maps working correctly

### If MapLibre Is Broken

```bash
# 1. Verify prebuild script ran during Docker build
docker compose -f docker-compose.production.yml logs | grep "MapLibre worker"

# Expected output during build:
# ✓ Created directory: /app/apps/admin/public/maplibre
# ✓ Copied maplibre-gl-worker.mjs
# ✓ Copied maplibre-gl-shared.mjs

# 2. Rebuild with verbose output
docker compose --env-file .env.production -f docker-compose.production.yml build --progress=plain --no-cache 2>&1 | tee build.log

# Search build log for MapLibre
grep -i maplibre build.log

# 3. Check Next.js public assets
docker exec ticketing-admin find /app -name "maplibre-gl-worker.mjs" -type f

# 4. Check MapLibre configuration in code
docker exec ticketing-admin cat /app/apps/admin/.next/server/app/lib/maplibre.js
# Should contain: setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')
```

### MapLibre Configuration Files

DO NOT modify these files unless absolutely necessary:

- [`apps/admin/scripts/copy-maplibre-worker.mjs`](apps/admin/scripts/copy-maplibre-worker.mjs) - Copies worker from node_modules
- [`apps/admin/src/lib/maplibre.ts`](apps/admin/src/lib/maplibre.ts) - Sets worker URL
- [`apps/admin/package.json`](apps/admin/package.json) - Defines `prebuild` hook

---

## Rollback Procedures

### Rollback to Previous Git Commit

```bash
# View recent commits
git log --oneline -10

# Rollback to specific commit
git reset --hard <commit-hash>

# Redeploy
./deploy-production.sh
```

### Rollback Using Docker Image Tag

```bash
# List available images
docker images | grep admin-tickets

# Tag current working version
docker tag admin-tickets-admin:latest admin-tickets-admin:stable

# Later, if new version fails, rollback:
docker tag admin-tickets-admin:stable admin-tickets-admin:latest
docker compose -f docker-compose.production.yml up -d
```

### Emergency Stop

```bash
# Stop container immediately
docker compose -f docker-compose.production.yml down

# Or force stop
docker stop ticketing-admin
docker rm ticketing-admin
```

---

## Supabase Considerations

### Database Migrations

⚠️ **IMPORTANT**: Database migrations are NOT run automatically during deployment.

To apply Supabase migrations:

```bash
# Install Supabase CLI (if not installed)
# https://supabase.com/docs/guides/cli

# Link to remote project
supabase link --project-ref <your-project-ref>

# Push migrations
supabase db push
```

**Best Practice**: Run migrations BEFORE deploying new app version that depends on schema changes.

### Row Level Security (RLS)

All database access from the client uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` which is protected by RLS policies.

Only server-side API routes (`/api/*`) use `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS.

### Supabase Realtime

The app uses Supabase Realtime for:
- Live ticket updates
- Technician GPS location tracking
- Push notification token synchronization

Ensure your Supabase project has Realtime enabled:
- Supabase Dashboard → Database → Replication
- Enable replication for: `tickets`, `technicians`, `technician_locations`

### Push Notifications

Push notifications to mobile technician app work via:
1. Admin sends push via `/api/tickets/[id]/assign` (server-side)
2. Uses `expo-server-sdk` with tokens from `technician_push_tokens` table
3. Expo handles delivery to APNs/FCM

No changes needed in Docker deployment - push functionality is server-side only.

---

## Additional Resources

- [Next.js Standalone Output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Docker Compose V2](https://docs.docker.com/compose/)
- [Supabase Documentation](https://supabase.com/docs)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js-docs/)

---

## Support

For issues specific to this deployment:
1. Check [Troubleshooting](#troubleshooting) section above
2. Review Docker logs: `docker compose -f docker-compose.production.yml logs`
3. Verify Nginx configuration
4. Check Supabase Dashboard for service status

---

**Last Updated**: 2026-08-27  
**Version**: 1.0.0  
**Deployment Target**: Ubuntu VPS with Docker
