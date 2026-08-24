#!/usr/bin/env node

/**
 * Bootstrap Super Admin Script
 *
 * Creates the initial SUPER_ADMIN user for production deployment.
 * This script is idempotent and safe to run multiple times:
 * - If SUPER_ADMIN exists: exits successfully without modifications
 * - If SUPER_ADMIN doesn't exist: creates it
 *
 * Required environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - BOOTSTRAP_SUPER_ADMIN_EMAIL
 * - BOOTSTRAP_SUPER_ADMIN_PASSWORD
 * - BOOTSTRAP_SUPER_ADMIN_NAME
 *
 * Exit codes:
 * - 0: Success (created or already exists)
 * - 1: Error (missing variables, connection failure, etc.)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env files (dev/staging) or system env (production)
config({ path: 'apps/admin/.env.local' });
config({ path: 'apps/admin/.env.admin.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bootstrapEmail = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
const bootstrapPassword = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;
const bootstrapName = process.env.BOOTSTRAP_SUPER_ADMIN_NAME;

// Validate required environment variables
if (!supabaseUrl || !serviceRoleKey) {
  console.error('[bootstrap] ❌ Missing Supabase configuration');
  console.error('[bootstrap] Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!bootstrapEmail || !bootstrapPassword || !bootstrapName) {
  console.error('[bootstrap] ❌ Missing SUPER_ADMIN bootstrap configuration');
  console.error('[bootstrap] Required: BOOTSTRAP_SUPER_ADMIN_EMAIL, BOOTSTRAP_SUPER_ADMIN_PASSWORD, BOOTSTRAP_SUPER_ADMIN_NAME');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(bootstrapEmail)) {
  console.error('[bootstrap] ❌ Invalid email format:', bootstrapEmail);
  process.exit(1);
}

// Validate password strength (minimum requirements)
if (bootstrapPassword.length < 8) {
  console.error('[bootstrap] ❌ Password must be at least 8 characters');
  process.exit(1);
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function bootstrapSuperAdmin() {
  console.log('[bootstrap] Checking SUPER_ADMIN...');

  try {
    // Step 1: Check if user already exists in auth.users by email
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('[bootstrap] ❌ Error querying users:', listError.message);
      process.exit(1);
    }

    const existingUser = existingUsers.users.find(u => u.email === bootstrapEmail);

    if (existingUser) {
      // Step 2: User exists - verify it has SUPER_ADMIN role
      const userId = existingUser.id;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('[bootstrap] ❌ Error checking profile:', profileError.message);
        process.exit(1);
      }

      if (profile && profile.role === 'SUPER_ADMIN') {
        console.log('[bootstrap] ✅ SUPER_ADMIN already exists');
        console.log('[bootstrap]    Email:', bootstrapEmail);
        console.log('[bootstrap]    Status: Active');
        console.log('[bootstrap] Deployment can proceed safely.');
        process.exit(0);
      }

      // User exists but not SUPER_ADMIN - this shouldn't happen in production
      // but handle it gracefully by promoting the user
      console.log('[bootstrap] ⚠️  User exists but is not SUPER_ADMIN, promoting...');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: 'SUPER_ADMIN',
          is_active: true,
          must_change_password: false
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[bootstrap] ❌ Error promoting user to SUPER_ADMIN:', updateError.message);
        process.exit(1);
      }

      console.log('[bootstrap] ✅ User promoted to SUPER_ADMIN');
      process.exit(0);
    }

    // Step 3: User doesn't exist - create new SUPER_ADMIN
    console.log('[bootstrap] Creating initial SUPER_ADMIN...');

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: bootstrapEmail,
      password: bootstrapPassword,
      email_confirm: true,
      user_metadata: {
        full_name: bootstrapName
      }
    });

    if (createError) {
      console.error('[bootstrap] ❌ Error creating user:', createError.message);

      // Provide helpful error messages
      if (createError.message.includes('already registered')) {
        console.error('[bootstrap] User may exist but query failed. Check database connection.');
      }

      process.exit(1);
    }

    const userId = newUser.user.id;
    console.log('[bootstrap] ✅ Auth user created');

    // Step 4: Wait for trigger to create profile
    // The handle_new_user() trigger creates profile with TECHNICIAN role by default
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 5: Verify profile was created by trigger
    let retries = 3;
    let profileExists = false;

    while (retries > 0 && !profileExists) {
      const { data: profile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!checkError && profile) {
        profileExists = true;
      } else {
        retries--;
        if (retries > 0) {
          console.log('[bootstrap] Waiting for profile trigger...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!profileExists) {
      console.error('[bootstrap] ❌ Profile not created by trigger after 3 retries');
      console.error('[bootstrap] Check that handle_new_user() trigger is properly configured');
      process.exit(1);
    }

    // Step 6: Update profile to SUPER_ADMIN role
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: 'SUPER_ADMIN',
        full_name: bootstrapName,
        is_active: true,
        must_change_password: false
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[bootstrap] ❌ Error setting SUPER_ADMIN role:', profileError.message);
      console.error('[bootstrap] Auth user created but role not set. Manual intervention required.');
      process.exit(1);
    }

    console.log('[bootstrap] ✅ Profile updated to SUPER_ADMIN role');
    console.log('[bootstrap]');
    console.log('[bootstrap] 🎉 SUPER_ADMIN created successfully');
    console.log('[bootstrap]    Email:', bootstrapEmail);
    console.log('[bootstrap]    Name:', bootstrapName);
    console.log('[bootstrap]    Role: SUPER_ADMIN');
    console.log('[bootstrap]    Status: Active');
    console.log('[bootstrap]');
    console.log('[bootstrap] Deployment can proceed.');

    process.exit(0);

  } catch (error) {
    console.error('[bootstrap] ❌ Unexpected error:', error.message);
    console.error('[bootstrap] Stack:', error.stack);
    process.exit(1);
  }
}

// Execute bootstrap
bootstrapSuperAdmin();
