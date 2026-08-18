#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.e2e.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const techEmail = process.env.E2E_TECH_EMAIL || 'tecnico.e2e@wisper.com';
const techPassword = process.env.E2E_TECH_PASSWORD || 'test-password-123';

console.log('\n📦 Wisper Logística - Storage Validation\n');

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.log('❌ Missing configuration\n');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey);

async function testStorageAccess() {
  console.log('🔧 Testing storage with technician session:\n');

  const techClient = createClient(supabaseUrl, anonKey);

  const { data: authData, error: authError } = await techClient.auth.signInWithPassword({
    email: techEmail,
    password: techPassword,
  });

  if (authError) {
    console.log(`   ⚠️  Could not sign in: ${authError.message}`);
    console.log('      Run seed-e2e first\n');
    return;
  }

  // Get technician and their ticket
  const { data: techData } = await techClient
    .from('technicians')
    .select('id')
    .eq('profile_id', authData.user.id)
    .single();

  if (!techData) {
    console.log('   ⚠️  No technician record\n');
    return;
  }

  const { data: ticket } = await techClient
    .from('tickets')
    .select('id')
    .eq('technician_id', techData.id)
    .limit(1)
    .single();

  if (!ticket) {
    console.log('   ⚠️  No ticket found for this technician\n');
    return;
  }

  // Test upload to ticket-evidences
  const testFile = readFileSync(join(__dirname, 'fixtures/test-image.txt'));
  const fileName = `test-${Date.now()}.txt`;

  const { data: uploadData, error: uploadError } = await techClient.storage
    .from('ticket-evidences')
    .upload(fileName, testFile, {
      contentType: 'text/plain',
    });

  if (uploadError) {
    console.log(`   ❌ Upload evidence: ${uploadError.message}`);
  } else {
    console.log(`   ✅ Upload evidence: OK`);

    // Test download
    const { data: downloadData, error: downloadError } = await techClient.storage
      .from('ticket-evidences')
      .download(fileName);

    if (downloadError) {
      console.log(`   ❌ Download evidence: ${downloadError.message}`);
    } else {
      console.log(`   ✅ Download evidence: OK`);
    }

    // Test signed URL
    const { data: signedUrl, error: signedError } = await techClient.storage
      .from('ticket-evidences')
      .createSignedUrl(fileName, 60);

    if (signedError) {
      console.log(`   ❌ Create signed URL: ${signedError.message}`);
    } else {
      console.log(`   ✅ Create signed URL: OK`);
    }

    // Cleanup
    await adminClient.storage.from('ticket-evidences').remove([fileName]);
    console.log(`   ✅ Cleanup: OK`);
  }

  await techClient.auth.signOut();
  console.log();
}

async function main() {
  try {
    await testStorageAccess();
    console.log('✅ Storage validation completed\n');
  } catch (error) {
    console.error('\n❌ Storage validation failed:', error.message);
    process.exit(1);
  }
}

main();
