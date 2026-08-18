#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.e2e.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n👤 Creating Second E2E Technician\n');

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing configuration\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createSecondTechnician() {
  const email = 'tecnico2.e2e@wisper.com';
  const password = 'E2ETech2Pass2024!';
  const fullName = 'Técnico E2E 2';

  // Check if user exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users.find((u) => u.email === email);

  let userId;

  if (existing) {
    console.log(`✅ User ${email} already exists`);
    userId = existing.id;
  } else {
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      console.log(`❌ Failed to create user: ${createError.message}`);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log(`✅ Created user ${email}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Check profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      full_name: fullName,
      email,
      role: 'TECHNICIAN',
      is_active: true,
    });

    if (error) {
      console.log(`❌ Failed to create profile: ${error.message}`);
      process.exit(1);
    }

    console.log('✅ Created profile');
  } else {
    console.log('✅ Profile exists');
  }

  // Check technician record
  const { data: tech } = await supabase
    .from('technicians')
    .select('id')
    .eq('profile_id', userId)
    .single();

  if (!tech) {
    const { error } = await supabase.from('technicians').insert({
      profile_id: userId,
      zone: 'E2E Test Zone 2',
      vehicle: 'TEST-002',
      is_active: true,
    });

    if (error) {
      console.log(`❌ Failed to create technician: ${error.message}`);
      process.exit(1);
    }

    console.log('✅ Created technician record');
  } else {
    console.log('✅ Technician record exists');
  }

  console.log('\n🎉 Second technician ready\n');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log('');
}

createSecondTechnician();
