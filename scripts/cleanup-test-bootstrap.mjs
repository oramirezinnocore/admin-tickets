#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: 'apps/admin/.env.local' });
config({ path: 'apps/admin/.env.admin.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data: users } = await supabase.auth.admin.listUsers();
const testUser = users?.users.find(u => u.email === 'test-bootstrap@example.com');

if (testUser) {
  await supabase.auth.admin.deleteUser(testUser.id);
  console.log('✅ Cleaned up test-bootstrap@example.com');
} else {
  console.log('ℹ️  No test user to clean');
}
