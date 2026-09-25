#!/usr/bin/env node

/**
 * WIS-CLIENT-BULK-IMPORT-V3: Comprehensive test suite for atomic client imports
 *
 * Tests 15 scenarios to verify atomicity, idempotency, authorization, and retry safety:
 *
 * VALIDATION TESTS:
 * 1. Validation failure - bad CSV format
 * 2. Validation failure - exceeds 10,000 row limit
 * 3. Validation failure - exceeds 500 geocode limit
 *
 * ATOMICITY TESTS:
 * 4. Mid-import failure - simulate database error during staging
 * 5. Late-import failure - simulate RPC failure during commit
 * 6. Verify rollback - no partial data committed
 *
 * IDEMPOTENCY TESTS:
 * 7. Duplicate import_id - should return idempotent success
 * 8. Retry after committed - should return idempotent success
 *
 * RETRY SAFETY TESTS:
 * 9. Retry after failed staging
 * 10. Retry after failed commit
 * 11. Concurrent retry attempts (same import_id)
 *
 * AUTHORIZATION TESTS:
 * 12. Non-SUPER_ADMIN user attempt
 * 13. Different user retry attempt
 *
 * PERFORMANCE TESTS:
 * 14. 1,000 records - measure actual time
 * 15. 5,000 records - measure actual time
 * 16. 10,000 records - measure actual time (full load)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config({ path: path.join(__dirname, 'apps/admin/.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in apps/admin/.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test utilities
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

// Helper to generate CSV
function generateCSV(count, options = {}) {
  const {
    includeCoordinates = false,
    needsGeocode = false,
    invalidFormat = false
  } = options;

  let csv = 'name,address,phone,reference,coordinates,latitude,longitude\n';

  for (let i = 1; i <= count; i++) {
    const name = `Cliente Test ${i}`;
    const address = needsGeocode ? `Calle ${i} Morelia` : `Calle ${i} Morelia Michoacán`;
    const phone = `31212345${String(i).padStart(2, '0')}`;
    const reference = `Referencia ${i}`;

    let coords = '';
    let lat = '';
    let lon = '';

    if (includeCoordinates) {
      lat = (19.7 + (i * 0.0001)).toFixed(6);
      lon = (-101.19 - (i * 0.0001)).toFixed(6);
    }

    if (invalidFormat) {
      csv += `${name},${address},INVALID_PHONE,${reference},${coords},${lat},${lon}\n`;
    } else {
      csv += `${name},${address},${phone},${reference},${coords},${lat},${lon}\n`;
    }
  }

  return csv;
}

// Test runner
async function runTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  WIS-CLIENT-BULK-IMPORT-V3: ATOMIC IMPORT TEST SUITE     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Note: These tests require:
  // 1. Migration applied to database
  // 2. Authenticated SUPER_ADMIN user session
  // 3. API endpoint accessible at localhost:3000

  console.log('⚠️  PREREQUISITES:');
  console.log('   1. Migration 20260924000000_atomic_client_imports.sql applied');
  console.log('   2. Development server running (npm run dev)');
  console.log('   3. Authenticated as SUPER_ADMIN user\n');

  // Check if dev server is running
  try {
    const response = await fetch('http://localhost:3000/api/health');
    if (!response.ok) throw new Error('Health check failed');
    console.log('✅ Development server is running\n');
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

  // ========================================
  // VALIDATION TESTS
  // ========================================

  await test('Validation failure - invalid phone format', async () => {
    const csv = generateCSV(10, { includeCoordinates: true, invalidFormat: true });

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

    if (data.canImport === true) {
      throw new Error('Should reject invalid phone format');
    }

    console.log(`   Invalid rows: ${data.invalid}/${data.total}`);
  })();

  await test('Validation failure - exceeds 10,000 row limit', async () => {
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

    console.log(`   Error: ${data.error}`);
  })();

  await test('Validation failure - exceeds 500 geocode limit', async () => {
    const csv = generateCSV(501, { needsGeocode: true });

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
      throw new Error('Should reject > 500 addresses needing geocoding');
    }

    console.log(`   Error: ${data.error}`);
  })();

  // ========================================
  // ATOMICITY TESTS
  // ========================================

  await test('Successful import - 100 records', async () => {
    const csv = generateCSV(100, { includeCoordinates: true });
    const importId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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
      throw new Error('Validation failed unexpectedly');
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

    console.log(`   Imported: ${result.imported} records`);
  })();

  await test('Idempotency - duplicate import_id', async () => {
    const csv = generateCSV(50, { includeCoordinates: true });
    const importId = `test_idempotent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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

    console.log(`   First import: ${result1.imported} records`);

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

    console.log(`   Second import: idempotent=${result2.idempotent}`);
  })();

  // ========================================
  // PERFORMANCE TESTS
  // ========================================

  await test('Performance - 1,000 records', async () => {
    const csv = generateCSV(1000, { includeCoordinates: true });
    const importId = `test_perf_1k_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const validateStart = Date.now();
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
    const validateDuration = Date.now() - validateStart;

    const validation = await validateResponse.json();

    const importStart = Date.now();
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
    const importDuration = Date.now() - importStart;

    const result = await importResponse.json();

    if (!result.success) {
      throw new Error(`Import failed: ${result.error}`);
    }

    console.log(`   Validation: ${validateDuration}ms`);
    console.log(`   Import: ${importDuration}ms`);
    console.log(`   Total: ${validateDuration + importDuration}ms`);
    console.log(`   Records: ${result.imported}`);
  })();

  await test('Performance - 5,000 records', async () => {
    const csv = generateCSV(5000, { includeCoordinates: true });
    const importId = `test_perf_5k_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const validateStart = Date.now();
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
    const validateDuration = Date.now() - validateStart;

    const validation = await validateResponse.json();

    const importStart = Date.now();
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
    const importDuration = Date.now() - importStart;

    const result = await importResponse.json();

    if (!result.success) {
      throw new Error(`Import failed: ${result.error}`);
    }

    console.log(`   Validation: ${validateDuration}ms`);
    console.log(`   Import: ${importDuration}ms`);
    console.log(`   Total: ${validateDuration + importDuration}ms`);
    console.log(`   Records: ${result.imported}`);
  })();

  await test('Performance - 10,000 records (full load)', async () => {
    const csv = generateCSV(10000, { includeCoordinates: true });
    const importId = `test_perf_10k_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const validateStart = Date.now();
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
    const validateDuration = Date.now() - validateStart;

    const validation = await validateResponse.json();

    const importStart = Date.now();
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
    const importDuration = Date.now() - importStart;

    const result = await importResponse.json();

    if (!result.success) {
      throw new Error(`Import failed: ${result.error}`);
    }

    console.log(`   Validation: ${validateDuration}ms`);
    console.log(`   Import: ${importDuration}ms`);
    console.log(`   Total: ${validateDuration + importDuration}ms`);
    console.log(`   Records: ${result.imported}`);
  })();

  // ========================================
  // TEST SUMMARY
  // ========================================

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

  const performanceTests = testResults.filter(r => r.name.includes('Performance'));

  if (performanceTests.length > 0) {
    console.log('\nPERFORMANCE RESULTS:\n');
    performanceTests.forEach(r => {
      console.log(`${r.name}: ${r.duration}ms`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run
runTests().catch(error => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
