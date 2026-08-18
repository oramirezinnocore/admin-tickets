#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load .env.e2e.local or .env.local
dotenv.config({ path: join(__dirname, '../.env.e2e.local') });
dotenv.config({ path: join(__dirname, '../apps/admin/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🏥 Wisper Logística - Health Check\n');

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ SUPABASE: NOT CONFIGURED');
  console.log('   Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.log('   Create .env.e2e.local from .env.e2e.example\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConnection() {
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) throw error;
    console.log('✅ SUPABASE: CONNECTED');
    return true;
  } catch (error) {
    console.log('❌ SUPABASE: CONNECTION FAILED');
    console.log(`   ${error.message}`);
    return false;
  }
}

async function checkTable(tableName) {
  try {
    const { data, error } = await supabase.from(tableName).select('count').limit(1);
    if (error) throw error;
    console.log(`✅ TABLE ${tableName}: OK`);
    return true;
  } catch (error) {
    console.log(`❌ TABLE ${tableName}: ${error.message}`);
    return false;
  }
}

async function checkView(viewName) {
  try {
    const { data, error } = await supabase.from(viewName).select('*').limit(1);
    if (error) throw error;
    console.log(`✅ VIEW ${viewName}: OK`);
    return true;
  } catch (error) {
    console.log(`❌ VIEW ${viewName}: ${error.message}`);
    return false;
  }
}

async function checkBucket(bucketName) {
  try {
    const { data, error } = await supabase.storage.getBucket(bucketName);
    if (error) throw error;
    console.log(`✅ BUCKET ${bucketName}: OK (${data.public ? 'public' : 'private'})`);
    return true;
  } catch (error) {
    console.log(`❌ BUCKET ${bucketName}: ${error.message}`);
    return false;
  }
}

async function main() {
  const connected = await checkConnection();
  if (!connected) {
    process.exit(1);
  }

  console.log('\n📊 DATABASE TABLES:');
  const tables = [
    'profiles',
    'clients',
    'technicians',
    'tickets',
    'ticket_evidences',
    'ticket_status_history',
    'ticket_signatures',
    'technician_locations',
  ];

  let allTablesOk = true;
  for (const table of tables) {
    const ok = await checkTable(table);
    if (!ok) allTablesOk = false;
  }

  console.log('\n👁️  DATABASE VIEWS:');
  await checkView('technician_latest_locations');

  console.log('\n🪣 STORAGE BUCKETS:');
  await checkBucket('ticket-evidences');
  await checkBucket('ticket-signatures');

  console.log('\n📈 SUMMARY:');
  if (allTablesOk) {
    console.log('✅ All critical components are healthy\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some components need attention\n');
    process.exit(1);
  }
}

main();
