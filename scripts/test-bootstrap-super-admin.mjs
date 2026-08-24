#!/usr/bin/env node

/**
 * Test Suite for Bootstrap Super Admin Script
 *
 * Tests:
 * 1. Missing environment variables fail correctly
 * 2. Invalid email format fails correctly
 * 3. Weak password fails correctly
 * 4. First run creates SUPER_ADMIN successfully
 * 5. Second run detects existing SUPER_ADMIN (idempotency)
 * 6. Existing user without SUPER_ADMIN role gets promoted
 *
 * Usage:
 *   node scripts/test-bootstrap-super-admin.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { spawn } from 'child_process';

config({ path: 'apps/admin/.env.local' });
config({ path: 'apps/admin/.env.admin.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase configuration for tests');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test user credentials
const TEST_EMAIL = 'test-bootstrap-super-admin@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test Bootstrap Admin';

let testResults = [];

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) console.log(`   ${details}`);
  testResults.push({ name, passed, details });
}

function runBootstrapScript(env = {}) {
  return new Promise((resolve, reject) => {
    const script = spawn('node', ['scripts/bootstrap-super-admin.mjs'], {
      env: { ...process.env, ...env },
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    script.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    script.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    script.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    script.on('error', (error) => {
      reject(error);
    });
  });
}

async function cleanupTestUser() {
  try {
    // Find test user
    const { data: users } = await supabase.auth.admin.listUsers();
    const testUser = users?.users.find(u => u.email === TEST_EMAIL);

    if (testUser) {
      // Delete auth user (cascade will delete profile)
      await supabase.auth.admin.deleteUser(testUser.id);
      console.log('🧹 Cleaned up test user');
    }
  } catch (error) {
    console.warn('⚠️  Cleanup warning:', error.message);
  }
}

async function runTests() {
  console.log('🧪 Starting Bootstrap Super Admin Tests\n');

  // Test 1: Missing environment variables
  console.log('\n📋 Test 1: Missing environment variables');
  try {
    const result = await runBootstrapScript({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      // Missing BOOTSTRAP_* variables
    });

    logTest(
      'Missing env vars should fail',
      result.code !== 0 && result.stderr.includes('Missing SUPER_ADMIN bootstrap configuration'),
      `Exit code: ${result.code}`
    );
  } catch (error) {
    logTest('Missing env vars should fail', false, error.message);
  }

  // Test 2: Invalid email format
  console.log('\n📋 Test 2: Invalid email format');
  try {
    const result = await runBootstrapScript({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      BOOTSTRAP_SUPER_ADMIN_EMAIL: 'invalid-email',
      BOOTSTRAP_SUPER_ADMIN_PASSWORD: TEST_PASSWORD,
      BOOTSTRAP_SUPER_ADMIN_NAME: TEST_NAME
    });

    logTest(
      'Invalid email should fail',
      result.code !== 0 && result.stderr.includes('Invalid email format'),
      `Exit code: ${result.code}`
    );
  } catch (error) {
    logTest('Invalid email should fail', false, error.message);
  }

  // Test 3: Weak password
  console.log('\n📋 Test 3: Weak password validation');
  try {
    const result = await runBootstrapScript({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      BOOTSTRAP_SUPER_ADMIN_EMAIL: TEST_EMAIL,
      BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'weak',
      BOOTSTRAP_SUPER_ADMIN_NAME: TEST_NAME
    });

    logTest(
      'Weak password should fail',
      result.code !== 0 && result.stderr.includes('Password must be at least 8 characters'),
      `Exit code: ${result.code}`
    );
  } catch (error) {
    logTest('Weak password should fail', false, error.message);
  }

  // Cleanup before creation tests
  await cleanupTestUser();

  // Test 4: First run creates SUPER_ADMIN
  console.log('\n📋 Test 4: First run creates SUPER_ADMIN');
  try {
    const result = await runBootstrapScript({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      BOOTSTRAP_SUPER_ADMIN_EMAIL: TEST_EMAIL,
      BOOTSTRAP_SUPER_ADMIN_PASSWORD: TEST_PASSWORD,
      BOOTSTRAP_SUPER_ADMIN_NAME: TEST_NAME
    });

    const success = result.code === 0 && result.stdout.includes('SUPER_ADMIN created successfully');
    logTest('First run creates user', success, `Exit code: ${result.code}`);

    // Verify user was created with correct role
    const { data: users } = await supabase.auth.admin.listUsers();
    const createdUser = users?.users.find(u => u.email === TEST_EMAIL);

    if (createdUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active, must_change_password')
        .eq('id', createdUser.id)
        .single();

      logTest(
        'User has SUPER_ADMIN role',
        profile?.role === 'SUPER_ADMIN',
        `Role: ${profile?.role}`
      );

      logTest(
        'User is active',
        profile?.is_active === true,
        `is_active: ${profile?.is_active}`
      );

      logTest(
        'Password change not required',
        profile?.must_change_password === false,
        `must_change_password: ${profile?.must_change_password}`
      );
    } else {
      logTest('User has SUPER_ADMIN role', false, 'User not found');
    }
  } catch (error) {
    logTest('First run creates user', false, error.message);
  }

  // Test 5: Second run is idempotent (doesn't modify existing)
  console.log('\n📋 Test 5: Idempotency - second run doesn\'t modify');
  try {
    // Get original password hash (we can't access it, but we verify login still works)
    const { error: loginBefore } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (loginBefore) {
      logTest('Verify login before second run', false, loginBefore.message);
    } else {
      logTest('Verify login before second run', true, 'Login successful');
      await supabase.auth.signOut();
    }

    // Run bootstrap again
    const result = await runBootstrapScript({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      BOOTSTRAP_SUPER_ADMIN_EMAIL: TEST_EMAIL,
      BOOTSTRAP_SUPER_ADMIN_PASSWORD: TEST_PASSWORD,
      BOOTSTRAP_SUPER_ADMIN_NAME: TEST_NAME
    });

    const success = result.code === 0 && result.stdout.includes('SUPER_ADMIN already exists');
    logTest('Second run exits successfully', success, `Exit code: ${result.code}`);
    logTest(
      'Second run detects existing',
      result.stdout.includes('SUPER_ADMIN already exists'),
      'Message correct'
    );

    // Verify password wasn't changed (login still works)
    const { error: loginAfter } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (loginAfter) {
      logTest('Password unchanged after second run', false, 'Login failed - password was changed!');
    } else {
      logTest('Password unchanged after second run', true, 'Login still works');
      await supabase.auth.signOut();
    }
  } catch (error) {
    logTest('Second run is idempotent', false, error.message);
  }

  // Test 6: Existing non-SUPER_ADMIN user gets promoted
  console.log('\n📋 Test 6: Promote existing non-SUPER_ADMIN user');
  try {
    // Demote the test user to ADMIN
    const { data: users } = await supabase.auth.admin.listUsers();
    const testUser = users?.users.find(u => u.email === TEST_EMAIL);

    if (testUser) {
      await supabase
        .from('profiles')
        .update({ role: 'ADMIN' })
        .eq('id', testUser.id);

      // Run bootstrap - should promote to SUPER_ADMIN
      const result = await runBootstrapScript({
        SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
        BOOTSTRAP_SUPER_ADMIN_EMAIL: TEST_EMAIL,
        BOOTSTRAP_SUPER_ADMIN_PASSWORD: TEST_PASSWORD,
        BOOTSTRAP_SUPER_ADMIN_NAME: TEST_NAME
      });

      const success = result.code === 0 && result.stdout.includes('promoted to SUPER_ADMIN');
      logTest('Promotes ADMIN to SUPER_ADMIN', success, `Exit code: ${result.code}`);

      // Verify promotion
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', testUser.id)
        .single();

      logTest(
        'User role is SUPER_ADMIN after promotion',
        profile?.role === 'SUPER_ADMIN',
        `Role: ${profile?.role}`
      );
    } else {
      logTest('Promotes ADMIN to SUPER_ADMIN', false, 'Test user not found');
    }
  } catch (error) {
    logTest('Promotes ADMIN to SUPER_ADMIN', false, error.message);
  }

  // Cleanup after all tests
  await cleanupTestUser();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;

  console.log(`Total: ${testResults.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Some tests failed:');
    testResults.filter(t => !t.passed).forEach(t => {
      console.log(`   - ${t.name}: ${t.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});
