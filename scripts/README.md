# Scripts Documentation

## Bootstrap Scripts

### bootstrap-super-admin.mjs

**Purpose:** Creates the initial SUPER_ADMIN user for production deployment.

**Idempotent:** Safe to run multiple times. If the SUPER_ADMIN already exists, the script exits successfully without modifications.

**Required Environment Variables:**
```bash
SUPABASE_URL                    # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY       # Service role key (server-side only)
BOOTSTRAP_SUPER_ADMIN_EMAIL     # Email for initial SUPER_ADMIN
BOOTSTRAP_SUPER_ADMIN_PASSWORD  # Password (min 8 chars)
BOOTSTRAP_SUPER_ADMIN_NAME      # Full name for display
```

**Usage:**
```bash
# Set environment variables (platform-specific)
export BOOTSTRAP_SUPER_ADMIN_EMAIL="admin@company.com"
export BOOTSTRAP_SUPER_ADMIN_PASSWORD="SecurePass123!"
export BOOTSTRAP_SUPER_ADMIN_NAME="Administrator"

# Run bootstrap
npm run bootstrap:super-admin
```

**Exit Codes:**
- `0` - Success (created or already exists)
- `1` - Error (missing vars, validation failure, connection error)

**Validations:**
- Email format (RFC 5322)
- Password length (minimum 8 characters)
- All required variables present
- Database connectivity

**What it does:**
1. Checks if user with bootstrap email already exists
2. If exists and is SUPER_ADMIN: exits successfully (idempotent)
3. If exists but not SUPER_ADMIN: promotes to SUPER_ADMIN
4. If doesn't exist: creates auth user, waits for trigger, sets SUPER_ADMIN role

**Security:**
- Uses Supabase Auth's secure password hashing (bcrypt)
- Never logs passwords
- Requires SERVICE_ROLE_KEY (server-side only)
- Sets `must_change_password: false` (bootstrap account)
- Sets `is_active: true` by default

**Production Deployment:**
```bash
# 1. Apply database migrations
supabase db push

# 2. Bootstrap SUPER_ADMIN (idempotent)
npm run bootstrap:super-admin

# 3. Build and deploy application
npm run build:shared && npm run build:admin

# 4. Health check
npm run health-check
```

See [DEPLOYMENT.md](../docs/DEPLOYMENT.md) for full deployment guide.

---

### create-admin.mjs

**Purpose:** Manually create or update admin users (development/maintenance).

**Use Cases:**
- Development environment setup
- Manually creating additional SUPER_ADMIN users
- Updating existing admin metadata

**Required Environment Variables:**
```bash
SUPABASE_URL          # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY  # Service role key
ADMIN_EMAIL           # Admin email
ADMIN_PASSWORD        # Admin password
ADMIN_FULL_NAME       # Full name (optional, defaults to "Administrator")
```

**Usage:**
```bash
npm run create-admin
```

**Difference from bootstrap-super-admin.mjs:**
- `create-admin.mjs`: Development tool, updates existing users, flexible
- `bootstrap-super-admin.mjs`: Production tool, strictly idempotent, never modifies existing

---

## Test Scripts

### test-bootstrap-super-admin.mjs

**Purpose:** Comprehensive test suite for bootstrap script.

**Tests:**
1. Missing environment variables fail correctly
2. Invalid email format fails correctly
3. Weak password fails correctly
4. First run creates SUPER_ADMIN successfully
5. Second run is idempotent (doesn't modify existing)
6. Existing non-SUPER_ADMIN user gets promoted

**Usage:**
```bash
npm run test:bootstrap
```

**What it validates:**
- Environment variable validation
- Email format validation
- Password strength validation
- User creation with correct role
- Profile creation by trigger
- Idempotency (password unchanged on second run)
- Promotion of existing users
- Exit codes

**Output:**
- Individual test results (✅/❌)
- Summary with pass/fail counts
- Exit code 0 if all pass, 1 if any fail

**CI/CD Integration:**
```yaml
# Example GitHub Actions
- name: Test Bootstrap Script
  run: npm run test:bootstrap
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SERVICE_ROLE_KEY }}
```

---

### cleanup-test-bootstrap.mjs

**Purpose:** Clean up test users created during bootstrap tests.

**Usage:**
```bash
node scripts/cleanup-test-bootstrap.mjs
```

Removes the user: `test-bootstrap-super-admin@example.com`

---

## Health Check Scripts

### health-check.mjs

Verifies system health:
- Database connectivity
- Authentication service
- API endpoints
- Basic functionality

```bash
npm run health-check
```

---

## E2E Test Scripts

### seed-e2e.mjs

Seeds database with test data for E2E tests.

### test-sla.mjs

Tests SLA calculation logic.

### test-rls.mjs

Tests Row Level Security policies.

### test-storage.mjs

Tests file storage functionality.

**Run all E2E tests:**
```bash
npm run test:e2e
```

---

## Script Development Guidelines

### Creating New Scripts

1. **Use `.mjs` extension** for ES modules
2. **Make executable:** `chmod +x scripts/your-script.mjs`
3. **Add shebang:** `#!/usr/bin/env node`
4. **Load environment:** Use `dotenv` for .env files
5. **Handle errors:** Always exit with appropriate code
6. **Log clearly:** Use prefixes like `[script-name]`
7. **Never log secrets:** Mask passwords, tokens, keys
8. **Document:** Add to this README and/or inline docs

### Script Best Practices

**Exit Codes:**
- `0` - Success
- `1` - General error
- `2` - Misuse (invalid arguments)

**Logging:**
```javascript
console.log('[script] ℹ️  Info message');
console.log('[script] ✅ Success message');
console.error('[script] ❌ Error message');
console.warn('[script] ⚠️  Warning message');
```

**Environment Variables:**
```javascript
import { config } from 'dotenv';

// Load .env files
config({ path: 'apps/admin/.env.local' });

// Validate required vars
const requiredVars = ['VAR1', 'VAR2'];
const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error(`❌ Missing required: ${missing.join(', ')}`);
  process.exit(1);
}
```

**Idempotency:**
```javascript
// Always check if resource exists first
const existing = await checkExists();

if (existing) {
  console.log('[script] ✅ Resource already exists');
  process.exit(0);  // Success, not error
}

// Create only if doesn't exist
await create();
```

**Error Handling:**
```javascript
try {
  await operation();
  console.log('[script] ✅ Success');
  process.exit(0);
} catch (error) {
  console.error('[script] ❌ Failed:', error.message);
  
  // Provide helpful context
  if (error.code === 'ECONNREFUSED') {
    console.error('[script] Check database connection');
  }
  
  process.exit(1);
}
```

### Testing Scripts

1. **Write test suite** (see test-bootstrap-super-admin.mjs)
2. **Test error cases** (missing vars, invalid input)
3. **Test success cases** (first run, idempotency)
4. **Test edge cases** (existing data, race conditions)
5. **Add to CI/CD** pipeline

### Security Considerations

**Never:**
- ❌ Commit credentials to git
- ❌ Log passwords or tokens
- ❌ Use SERVICE_ROLE_KEY client-side
- ❌ Hardcode secrets in scripts

**Always:**
- ✅ Use environment variables
- ✅ Validate input
- ✅ Use secure password hashing (Supabase Auth)
- ✅ Implement proper error handling
- ✅ Document security requirements

---

## Troubleshooting

### "Cannot find module"

Scripts must be run from project root:
```bash
cd /path/to/project
npm run script-name
```

### "Permission denied"

Make script executable:
```bash
chmod +x scripts/script-name.mjs
```

### "Missing environment variables"

Check .env files exist:
```bash
ls -la apps/admin/.env.local
ls -la apps/admin/.env.admin.local
```

Or set variables manually:
```bash
export VAR_NAME="value"
```

### "Database connection failed"

Verify credentials:
```bash
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY  # Should NOT be empty
```

Test connection:
```bash
npm run health-check
```

---

## Support

For script issues:
1. Check this documentation
2. Review script comments
3. Run with verbose logging
4. Check [DEPLOYMENT.md](../docs/DEPLOYMENT.md)
5. Contact DevOps team
