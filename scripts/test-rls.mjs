#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.e2e.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const techEmail = process.env.E2E_TECH_EMAIL || 'tecnico.e2e@wisper.com';
const techPassword = process.env.E2E_TECH_PASSWORD || 'test-password-123';

console.log('\n🔒 Wisper Logística - RLS Validation\n');

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.log('❌ Missing configuration\n');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey);
const anonClient = createClient(supabaseUrl, anonKey);

async function testAnonAccess() {
  console.log('👤 Testing anonymous access (should be denied):\n');

  const { data, error } = await anonClient.from('tickets').select('*').limit(10);

  if (error) {
    console.log('   ✅ Tickets: Access denied with error (expected)');
    console.log(`      ${error.message}`);
    return true;
  } else if (!data || data.length === 0) {
    console.log('   ✅ Tickets: Access returns no data (RLS working)');
    return true;
  } else {
    console.log('   ❌ Tickets: Anonymous can read', data.length, 'tickets (SECURITY ISSUE!)');
    return false;
  }
}

async function testTechnicianAccess() {
  console.log('\n🔧 Testing technician RLS:\n');

  // Create authenticated client
  const techClient = createClient(supabaseUrl, anonKey);

  const { data: authData, error: authError } = await techClient.auth.signInWithPassword({
    email: techEmail,
    password: techPassword,
  });

  if (authError) {
    console.log(`   ⚠️  Could not sign in: ${authError.message}`);
    console.log('      Run seed-e2e first\n');
    return null;
  }

  console.log(`   ✅ Signed in as ${techEmail}`);

  // Get technician ID
  const { data: techData } = await techClient
    .from('technicians')
    .select('id')
    .eq('profile_id', authData.user.id)
    .single();

  if (!techData) {
    console.log('   ⚠️  No technician record found\n');
    return null;
  }

  // Test: Read own tickets
  const { data: ownTickets, error: ownError } = await techClient
    .from('tickets')
    .select('*')
    .eq('technician_id', techData.id)
    .limit(1);

  if (ownError) {
    console.log(`   ❌ Read own tickets: DENIED (should be allowed)`);
    console.log(`      ${ownError.message}`);
  } else {
    console.log(`   ✅ Read own tickets: OK (${ownTickets?.length || 0} found)`);
  }

  // Test: Try to read tickets from another technician
  // First, get another technician if exists
  const { data: otherTech } = await adminClient
    .from('technicians')
    .select('id')
    .neq('id', techData.id)
    .limit(1)
    .single();

  if (otherTech) {
    const { data: otherTickets, error: otherError } = await techClient
      .from('tickets')
      .select('*')
      .eq('technician_id', otherTech.id)
      .limit(1);

    if (otherError || !otherTickets || otherTickets.length === 0) {
      console.log('   ✅ Read other tickets: DENIED (expected)');
    } else {
      console.log('   ❌ Read other tickets: ALLOWED (SECURITY ISSUE!)');
    }
  } else {
    console.log('   ⚠️  No other technician to test cross-access');
  }

  // Test: Update own ticket
  if (ownTickets && ownTickets.length > 0) {
    const ticket = ownTickets[0];
    const { error: updateError } = await techClient
      .from('tickets')
      .update({ technician_notes: 'RLS test note' })
      .eq('id', ticket.id);

    if (updateError) {
      console.log(`   ❌ Update own ticket: DENIED (should be allowed)`);
      console.log(`      ${updateError.message}`);
    } else {
      console.log('   ✅ Update own ticket: OK');
    }
  }

  await techClient.auth.signOut();
  console.log();
}

async function main() {
  try {
    const anonOk = await testAnonAccess();
    await testTechnicianAccess();

    console.log('✅ RLS validation completed\n');
  } catch (error) {
    console.error('\n❌ RLS validation failed:', error.message);
    process.exit(1);
  }
}

main();
