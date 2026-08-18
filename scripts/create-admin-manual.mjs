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

async function createAdminManual() {
  console.log('🚀 Creating admin user manually...');

  try {
    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      process.exit(1);
    }

    const existingUser = existingUsers.users.find(u => u.email === adminEmail);

    if (existingUser) {
      console.log('✅ User already exists:', adminEmail);
      console.log('   User ID:', existingUser.id);

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'ADMIN', full_name: adminFullName })
        .eq('id', existingUser.id);

      if (profileError) {
        console.error('❌ Error updating profile:', profileError.message);
        process.exit(1);
      }

      console.log('✅ Profile updated to ADMIN role');
      console.log('');
      console.log('🎉 Admin user ready!');
      console.log('   Email:', adminEmail);
      console.log('   Role: ADMIN');
      return;
    }

    // Create user without trigger (using service role to bypass)
    console.log('Creating user in auth.users...');

    // Use SQL to insert directly
    const { data: userData, error: createUserError } = await supabase.rpc('create_admin_user', {
      p_email: adminEmail,
      p_password: adminPassword,
      p_full_name: adminFullName
    });

    if (createUserError) {
      console.error('❌ RPC not available, trying alternative method');

      // Alternative: Try using auth.admin API
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
        options: {
          data: {
            full_name: adminFullName
          }
        }
      });

      if (authError) {
        console.error('❌ Error creating user:', authError.message);
        console.error('Details:', JSON.stringify(authError, null, 2));
        process.exit(1);
      }

      const userId = authData.user.id;
      console.log('✅ User created:', userId);

      // Manually create or update profile
      await new Promise(resolve => setTimeout(resolve, 2000));

      const { data: profile, error: profileSelectError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileSelectError || !profile) {
        console.log('Profile does not exist, creating manually...');

        const { error: profileInsertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            full_name: adminFullName,
            email: adminEmail,
            role: 'ADMIN',
            is_active: true
          });

        if (profileInsertError) {
          console.error('❌ Error creating profile:', profileInsertError.message);
          process.exit(1);
        }

        console.log('✅ Profile created with ADMIN role');
      } else {
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ role: 'ADMIN', full_name: adminFullName })
          .eq('id', userId);

        if (profileUpdateError) {
          console.error('❌ Error updating profile:', profileUpdateError.message);
          process.exit(1);
        }

        console.log('✅ Profile updated to ADMIN role');
      }
    }

    console.log('');
    console.log('🎉 Admin user ready!');
    console.log('   Email:', adminEmail);
    console.log('   Role: ADMIN');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

createAdminManual();
