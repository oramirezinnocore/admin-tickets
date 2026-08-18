#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from both files
config({ path: 'apps/admin/.env.local' });
config({ path: 'apps/admin/.env.admin.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const adminFullName = process.env.ADMIN_FULL_NAME || 'Administrator';

if (!supabaseUrl || !serviceRoleKey || !adminEmail || !adminPassword) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD');
  console.error('Optional: ADMIN_FULL_NAME');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  console.log('🚀 Creating admin user...');

  try {
    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      process.exit(1);
    }

    const existingUser = existingUsers.users.find(u => u.email === adminEmail);

    let userId;

    if (existingUser) {
      console.log('ℹ️  User already exists:', adminEmail);
      userId = existingUser.id;

      // Update user metadata
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: adminFullName }
      });

      if (updateError) {
        console.error('❌ Error updating user metadata:', updateError.message);
        process.exit(1);
      }
      console.log('✅ User metadata updated');
    } else {
      // Create new user without metadata first (to avoid trigger issues)
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true
      });

      if (createError) {
        console.error('❌ Error creating user:', createError.message);
        console.error('Error details:', JSON.stringify(createError, null, 2));
        process.exit(1);
      }

      userId = newUser.user.id;
      console.log('✅ User created:', userId);

      // Wait a bit for trigger to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Update profile role to ADMIN
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'ADMIN', full_name: adminFullName })
      .eq('id', userId);

    if (profileError) {
      console.error('❌ Error updating profile:', profileError.message);
      process.exit(1);
    }

    console.log('✅ Profile updated to ADMIN role');
    console.log('');
    console.log('🎉 Admin user ready!');
    console.log('   Email:', adminEmail);
    console.log('   Role: ADMIN');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

createAdmin();
