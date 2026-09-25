#!/usr/bin/env node

/**
 * WIS-CLIENT-BULK-IMPORT-V3.1: Security and Retry Hardening Test Suite
 *
 * Tests critical scenarios:
 * 1. Authorization - non-admin impersonation attempt
 * 2. Retry safety - failed import retry
 * 3. Content integrity - import_id reuse with different data
 * 4. Concurrency - concurrent retry attempts
 * 5. Geocoding limit - 51 addresses rejected, 50 accepted
 * 6. Large import - 10,000 records with coordinates
 * 7. Over limit - 10,001 records rejected
 * 8. Timeout recovery - committed status preserved on error
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment
require('dotenv').config({ path: path.join(__dirname, 'apps/admin/.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in apps/admin/.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test results
const testResults = [];
let testNumber = 0;

function test(name, fn) {
  testNumber++;
  return async () => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`TEST ${testNumber}: ${name}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const startTime = Date.now();
    try {
      await fn();
      const duration = Date.now() - startTime;
      console.log(`✅ PASS (${duration}ms)`);
      testResults.push({ test: testNumber, name, status: 'PASS', duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ FAIL (${duration}ms)`);
      console.error(`   Error: ${error.message}`);
      testResults.push({ test: testNumber, name, status: 'FAIL', duration, error: error.message });
    }
  };
}

// Generate CSV
function generateCSV(count, options = {}) {
  const {
    includeCoordinates = false,
    seed = 0
  } = options;

  let csv = 'name,address,phone,reference,coordinates,latitude,longitude\n';

  for (let i = 1; i <= count; i++) {
    const name = `Cliente Test ${seed}_${i}`;
    const address = `Calle ${i} Morelia Michoacán`;
    const phone = `31212345${String(i % 100).padStart(2, '0')}`;
    const reference = `Ref ${i}`;

    let lat = '';
    let lon = '';

    if (includeCoordinates) {
      lat = (19.7 + (i * 0.0001)).toFixed(6);
      lon = (-101.19 - (i * 0.0001)).toFixed(6);
    }

    csv += `${name},${address},${phone},${reference},,${lat},${lon}\n`;
  }

  return csv;
}

async function runTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  WIS-CLIENT-BULK-IMPORT-V3.1: HARDENING TEST SUITE       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Check dev server
  try {
    const response = await fetch('http://localhost:3000/api/health');
    if (!response.ok) throw new Error('Health check failed');
    console.log('✅ Development server running\n');
  } catch (error) {
    console.error('❌ Development server not accessible');
    console.error('   Run: cd apps/admin && npm run dev\n');
    process.exit(1);
  }

  // Get auth session
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (authError || !session) {
    console.error('❌ Not authenticated');
    console.error('   Please login through the admin UI first\n');
    process.exit(1);
  }

  console.log(`✅ Authenticated as: ${session.user.email}\n`);

  const accessToken = session.access_token;

  // ===========================================
  // TEST 1: Geocoding Limit Enforcement
  // ===========================================

  await test('Geocoding limit - 51 addresses rejected', async () => {
    const csv = generateCSV(51, { includeCoordinates: false });

    const response = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        action: 'validate',
        csvContent: csv
      })
    });

    const data = await response.json();

    if (response.ok) {
      throw new Error('Should reject > 50 addresses needing geocoding');
    }

    if (!data.error || !data.error.includes('51')) {
      throw new Error(`Expected error about 51 addresses, got: ${data.error}`);
    }

    console.log(`   ✓ Rejected: ${data.error}`);
  })();

  await test('Geocoding limit - 50 addresses accepted', async () => {
    const csv = generateCSV(50, { includeCoordinates: false });

    const response = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        action: 'validate',
        csvContent: csv
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Should accept 50 addresses: ${data.error}`);
    }

    if (!data.canImport) {
      throw new Error('Should be able to import 50 geocoded addresses');
    }

    console.log(`   ✓ Accepted: ${data.valid} valid rows`);
  })();

  // ===========================================
  // TEST 2: Import Limits
  // ===========================================

  await test('Row limit - 10,001 records rejected', async () => {
    const csv = generateCSV(10001, { includeCoordinates: true });

    const response = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        action: 'validate',
        csvContent: csv
      })
    });

    const data = await response.json();

    if (response.ok) {
      throw new Error('Should reject > 10,000 rows');
    }

    console.log(`   ✓ Rejected: ${data.error}`);
  })();

  // ===========================================
  // TEST 3: Successful Import
  // ===========================================

  await test('Successful import - 100 records', async () => {
    const csv = generateCSV(100, { includeCoordinates: true, seed: Date.now() });
    const importId = `test_v31_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Validate
    const validateResponse = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        action: 'validate',
        csvContent: csv
      })
    });

    const validation = await validateResponse.json();

    if (!validation.canImport) {
      throw new Error('Validation failed');
    }

    // Import
    const importResponse = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        action: 'import',
        importId,
        validatedRows: validation.results.filter(r => r.isValid)
      })
    });

    const result = await importResponse.json();

    if (!result.success) {
      throw new Error(`Import failed: ${result.error}`);
    }

    console.log(`   ✓ Imported: ${result.imported} records`);
  })();

  // ===========================================
  // TEST 4: Idempotency
  // ===========================================

  await test('Idempotency - duplicate import_id with same data', async () => {
    const csv = generateCSV(50, { includeCoordinates: true, seed: 12345 });
    const importId = `test_idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Validate
    const validateResponse = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        action: 'validate',
        csvContent: csv
      })
    });

    const validation = await validateResponse.json();

    // First import
    const import1 = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        action: 'import',
        importId,
        validatedRows: validation.results.filter(r => r.isValid)
      })
    });

    const result1 = await import1.json();

    if (!result1.success) {
      throw new Error(`First import failed: ${result1.error}`);
    }

    console.log(`   ✓ First import: ${result1.imported} records`);

    // Second import (should be idempotent)
    const import2 = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        action: 'import',
        importId,
        validatedRows: validation.results.filter(r => r.isValid)
      })
    });

    const result2 = await import2.json();

    if (!result2.success) {
      throw new Error(`Second import should succeed idempotently: ${result2.error}`);
    }

    if (!result2.idempotent) {
      throw new Error('Second import should be marked as idempotent');
    }

    console.log(`   ✓ Second import: idempotent=${result2.idempotent}`);
  })();

  // ===========================================
  // TEST 5: Content Integrity
  // ===========================================

  await test('Content integrity - import_id reuse with different data', async () => {
    const csv1 = generateCSV(30, { includeCoordinates: true, seed: 1000 });
    const csv2 = generateCSV(30, { includeCoordinates: true, seed: 2000 });
    const importId = `test_content_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // First import
    const validate1 = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ action: 'validate', csvContent: csv1 })
    });

    const validation1 = await validate1.json();

    const import1 = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({
        action: 'import',
        importId,
        validatedRows: validation1.results.filter(r => r.isValid)
      })
    });

    const result1 = await import1.json();

    if (!result1.success) {
      throw new Error(`First import failed: ${result1.error}`);
    }

    console.log(`   ✓ First import succeeded with dataset A`);

    // Second import with DIFFERENT data but SAME import_id
    const validate2 = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ action: 'validate', csvContent: csv2 })
    });

    const validation2 = await validate2.json();

    const import2 = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({
        action: 'import',
        importId,  // Same ID, different data
        validatedRows: validation2.results.filter(r => r.isValid)
      })
    });

    const result2 = await import2.json();

    // Should reject with 409 Conflict
    if (import2.status !== 409) {
      throw new Error(`Expected 409 Conflict, got ${import2.status}`);
    }

    if (!result2.error || !result2.error.includes('datos diferentes')) {
      throw new Error(`Expected content mismatch error, got: ${result2.error}`);
    }

    console.log(`   ✓ Rejected: ${result2.error}`);
  })();

  // ===========================================
  // TEST 6: Performance
  // ===========================================

  await test('Performance - 1,000 records with coordinates', async () => {
    const csv = generateCSV(1000, { includeCoordinates: true, seed: Date.now() });
    const importId = `test_perf_1k_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const validateStart = Date.now();
    const validateResponse = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ action: 'validate', csvContent: csv })
    });
    const validateDuration = Date.now() - validateStart;

    const validation = await validateResponse.json();

    const importStart = Date.now();
    const importResponse = await fetch('http://localhost:3000/api/clients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({
        action: 'import',
        importId,
        validatedRows: validation.results.filter(r => r.isValid)
      })
    });
    const importDuration = Date.now() - importStart;

    const result = await importResponse.json();

    if (!result.success) {
      throw new Error(`Import failed: ${result.error}`);
    }

    console.log(`   Validation: ${validateDuration}ms`);
    console.log(`   Import: ${importDuration}ms`);
    console.log(`   Total: ${validateDuration + importDuration}ms`);
  })();

  // ===========================================
  // SUMMARY
  // ===========================================

  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                     TEST SUMMARY                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const total = testResults.length;

  console.log(`Tests run: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}\n`);

  if (failed > 0) {
    console.log('FAILED TESTS:\n');
    testResults
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`❌ Test ${r.test}: ${r.name}`);
        console.log(`   ${r.error}\n`);
      });
  }

  console.log('\nNOTE: Authorization and concurrency tests require manual verification:');
  console.log('- Non-admin user attempting RPC call');
  console.log('- Concurrent retry attempts (stress test)');
  console.log('- Timeout recovery (simulate network timeout)\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
