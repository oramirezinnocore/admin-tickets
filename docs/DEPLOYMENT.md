# Production Deployment Guide

## Prerequisites

1. **Database migrations applied**
   ```bash
   # Apply all Supabase migrations
   supabase db push
   ```

2. **Environment variables configured**
   
   Required for bootstrap:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   BOOTSTRAP_SUPER_ADMIN_EMAIL=admin@yourcompany.com
   BOOTSTRAP_SUPER_ADMIN_PASSWORD=SecurePassword123!
   BOOTSTRAP_SUPER_ADMIN_NAME="Admin Full Name"
   ```

   **IMPORTANT SECURITY NOTES:**
   - Never commit these values to git
   - Use your platform's secret management (e.g., Vercel Secrets, AWS Secrets Manager)
   - Rotate the SUPER_ADMIN password after first login
   - Use a strong password (min 8 chars, uppercase, lowercase, number)

## Deployment Steps

### 1. Database Migrations

```bash
# Connect to production database
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

Verify the following migrations are applied:
- `20260814223000_auth_profile_trigger.sql` - Auto-creates profiles for new users
- `20260823000000_add_super_admin_role.sql` - Adds SUPER_ADMIN role and RLS policies

### 2. Bootstrap Initial SUPER_ADMIN

```bash
# Set environment variables (method depends on your platform)
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export BOOTSTRAP_SUPER_ADMIN_EMAIL="admin@yourcompany.com"
export BOOTSTRAP_SUPER_ADMIN_PASSWORD="SecurePassword123!"
export BOOTSTRAP_SUPER_ADMIN_NAME="Admin Full Name"

# Run bootstrap (safe to run multiple times)
npm run bootstrap:super-admin
```

**Expected output on first run:**
```
[bootstrap] Checking SUPER_ADMIN...
[bootstrap] Creating initial SUPER_ADMIN...
[bootstrap] ✅ Auth user created
[bootstrap] ✅ Profile updated to SUPER_ADMIN role
[bootstrap]
[bootstrap] 🎉 SUPER_ADMIN created successfully
[bootstrap]    Email: admin@yourcompany.com
[bootstrap]    Name: Admin Full Name
[bootstrap]    Role: SUPER_ADMIN
[bootstrap]    Status: Active
[bootstrap]
[bootstrap] Deployment can proceed.
```

**Expected output on subsequent runs:**
```
[bootstrap] Checking SUPER_ADMIN...
[bootstrap] ✅ SUPER_ADMIN already exists
[bootstrap]    Email: admin@yourcompany.com
[bootstrap]    Status: Active
[bootstrap] Deployment can proceed safely.
```

**Exit codes:**
- `0` - Success (created or already exists)
- `1` - Error (check logs for details)

### 3. Build and Deploy Application

```bash
# Build shared package
npm run build:shared

# Build admin application
npm run build:admin

# Deploy (method depends on your platform)
# Vercel: vercel --prod
# Custom: pm2 start ecosystem.config.js
```

### 4. Health Check

```bash
npm run health-check
```

Verify:
- ✅ Database connection
- ✅ Authentication service
- ✅ SUPER_ADMIN can login
- ✅ API endpoints responding

### 5. Post-Deployment

1. **Login as SUPER_ADMIN**
   - Navigate to: `https://your-domain.com/login`
   - Use bootstrap credentials

2. **Change password** (recommended)
   - Go to user profile
   - Update to a new secure password
   - Document the new password in your password manager

3. **Create additional admins** (optional)
   - Navigate to: Administradores
   - Create ADMIN users as needed
   - ADMIN users will receive temporary passwords via the UI

## Platform-Specific Instructions

### Vercel

Add environment variables in Project Settings → Environment Variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BOOTSTRAP_SUPER_ADMIN_EMAIL=admin@yourcompany.com
BOOTSTRAP_SUPER_ADMIN_PASSWORD=SecurePassword123!
BOOTSTRAP_SUPER_ADMIN_NAME=Admin Full Name
```

In your `vercel.json` or build settings, add a postbuild script:

```json
{
  "buildCommand": "npm run build:shared && npm run build:admin && npm run bootstrap:super-admin"
}
```

Or use Vercel's Build Command:
```
npm install && npm run bootstrap:super-admin && npm run build:shared && npm run build:admin
```

### Docker

Add to your `Dockerfile`:

```dockerfile
# Install dependencies
RUN npm install

# Run migrations (if using Supabase CLI in container)
RUN supabase db push

# Bootstrap SUPER_ADMIN
RUN npm run bootstrap:super-admin

# Build application
RUN npm run build:shared
RUN npm run build:admin

# Start application
CMD ["npm", "start"]
```

Environment variables should be passed via Docker secrets or environment files (never in Dockerfile).

### AWS / Custom Server

Create a deployment script:

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Run migrations
supabase db push

# Bootstrap SUPER_ADMIN (idempotent)
npm run bootstrap:super-admin

# Build application
npm run build:shared
npm run build:admin

# Restart application
pm2 restart wisper-admin

# Health check
npm run health-check

echo "✅ Deployment complete!"
```

## Rollback Procedure

If bootstrap fails during deployment:

1. **Check logs** for specific error
   ```bash
   # Common issues:
   # - Missing environment variables
   # - Database connection failure
   # - Trigger not created (check migrations)
   ```

2. **Manual verification**
   ```bash
   # Check if user was partially created
   psql $DATABASE_URL -c "SELECT id, email, role FROM profiles WHERE email = 'admin@yourcompany.com';"
   ```

3. **Manual cleanup** (if needed)
   ```bash
   # Delete partially created user
   # Use Supabase dashboard or SQL:
   DELETE FROM auth.users WHERE email = 'admin@yourcompany.com';
   ```

4. **Fix issue and re-run**
   ```bash
   npm run bootstrap:super-admin
   ```

## Testing Bootstrap Script

Before deploying to production, test the bootstrap script in staging:

```bash
# Run full test suite
npm run test:bootstrap
```

Tests verify:
- ✅ Missing env vars fail correctly
- ✅ Invalid email fails correctly
- ✅ Weak password fails correctly
- ✅ First run creates SUPER_ADMIN
- ✅ Second run is idempotent (doesn't modify existing)
- ✅ Existing non-SUPER_ADMIN gets promoted

## Security Checklist

- [ ] Bootstrap credentials stored in secure secret manager
- [ ] SERVICE_ROLE_KEY never exposed to client
- [ ] Bootstrap password meets strength requirements
- [ ] SUPER_ADMIN password changed after first login
- [ ] Database migrations applied before bootstrap
- [ ] Health check passes after deployment
- [ ] Backup taken before deployment
- [ ] Rollback plan documented
- [ ] Team notified of deployment

## Troubleshooting

### "Missing Supabase configuration"
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Check variable names (exact match required)

### "Error querying users"
- Verify SERVICE_ROLE_KEY has admin privileges
- Check database connection
- Verify Supabase project is accessible

### "Profile not created by trigger"
- Verify migration `20260814223000_auth_profile_trigger.sql` is applied
- Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
- Check trigger function exists: `\df handle_new_user`

### "User promoted to SUPER_ADMIN" (warning)
- This means a user with the bootstrap email existed but wasn't SUPER_ADMIN
- Script automatically promotes them
- Verify this is expected; if not, investigate why user existed

### Bootstrap succeeds but can't login
- Verify password meets Supabase Auth requirements
- Check user's `is_active` status in profiles table
- Verify role is set to 'SUPER_ADMIN'
- Check browser console for auth errors

## Support

For deployment issues:
1. Check logs: `[bootstrap]` prefix
2. Run health check: `npm run health-check`
3. Review this documentation
4. Contact DevOps team
