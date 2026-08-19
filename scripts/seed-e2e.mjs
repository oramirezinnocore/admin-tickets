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
const techEmail = process.env.E2E_TECH_EMAIL || 'tecnico.e2e@wisper.com';
const techPassword = process.env.E2E_TECH_PASSWORD || 'test-password-123';
const techName = process.env.E2E_TECH_NAME || 'Técnico E2E';

console.log('\n🌱 Wisper Logística - E2E Seed\n');

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing configuration. Create .env.e2e.local\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seedClients() {
  console.log('📦 Seeding clients...');

  const clients = [
    {
      name: '[E2E] Cliente Centro',
      phone: '4431234567',
      address: 'Centro Histórico, Morelia, Michoacán',
      reference: 'Prueba Wisper E2E',
      latitude: null,
      longitude: null,
      is_active: true,
    },
    {
      name: '[E2E] Cliente Norte',
      phone: '4439876543',
      address: 'Zona Norte, Morelia, Michoacán',
      reference: 'Prueba Wisper E2E',
      latitude: null,
      longitude: null,
      is_active: true,
    },
  ];

  for (const client of clients) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('name', client.name)
      .single();

    if (existing) {
      console.log(`   ↳ ${client.name} already exists`);
      continue;
    }

    const { error } = await supabase.from('clients').insert(client);
    if (error) {
      console.log(`   ❌ ${client.name}: ${error.message}`);
    } else {
      console.log(`   ✅ ${client.name}`);
    }
  }
}

async function seedTechnician() {
  console.log('\n🔧 Seeding technician...');

  // Check if user exists
  const { data: existingAuth } = await supabase.auth.admin.listUsers();
  const existingUser = existingAuth?.users?.find((u) => u.email === techEmail);

  let userId;

  if (existingUser) {
    console.log(`   ↳ Auth user ${techEmail} already exists`);
    userId = existingUser.id;
  } else {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: techEmail,
      password: techPassword,
      email_confirm: true,
    });

    if (authError) {
      console.log(`   ❌ Failed to create auth user: ${authError.message}`);
      return null;
    }

    userId = authData.user.id;
    console.log(`   ✅ Created auth user ${techEmail}`);
  }

  // Check profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    // Create profile (should be auto-created by trigger, but just in case)
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      full_name: techName,
      role: 'TECHNICIAN',
      is_active: true,
    });

    if (error) {
      console.log(`   ❌ Failed to create profile: ${error.message}`);
    } else {
      console.log(`   ✅ Created profile`);
    }
  } else {
    console.log(`   ↳ Profile already exists`);
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
      zone: 'E2E Test Zone',
      vehicle: 'TEST-001',
      is_active: true,
    });

    if (error) {
      console.log(`   ❌ Failed to create technician: ${error.message}`);
      return null;
    } else {
      console.log(`   ✅ Created technician record`);
    }
  } else {
    console.log(`   ↳ Technician record already exists`);
  }

  // Get final technician ID
  const { data: finalTech } = await supabase
    .from('technicians')
    .select('id')
    .eq('profile_id', userId)
    .single();

  return finalTech?.id;
}

async function seedTickets(technicianId) {
  console.log('\n🎫 Seeding tickets...');

  if (!technicianId) {
    console.log('   ⚠️  No technician ID, skipping tickets');
    return;
  }

  // Get E2E client
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('name', '[E2E] Cliente Centro')
    .single();

  if (!client) {
    console.log('   ⚠️  No E2E client found, skipping tickets');
    return;
  }

  const now = new Date();

  // Define tickets with deterministic ages for consistent SLA testing
  // GREEN: 8h old (within 0-24h)
  // YELLOW: 30h old (within 24-48h)
  // RED: 55h old (within 48-72h)
  // OVERDUE: 80h old (over 72h)
  const tickets = [
    {
      client_id: client.id,
      technician_id: technicianId,
      failure_type: '[E2E] Ticket VERDE - 8 h',
      status: 'ASSIGNED',
      created_at: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
    },
    {
      client_id: client.id,
      technician_id: technicianId,
      failure_type: '[E2E] Ticket AMARILLO - 30 h',
      status: 'ASSIGNED',
      created_at: new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString(),
    },
    {
      client_id: client.id,
      technician_id: technicianId,
      failure_type: '[E2E] Ticket ROJO - 55 h',
      status: 'ASSIGNED',
      created_at: new Date(now.getTime() - 55 * 60 * 60 * 1000).toISOString(),
    },
    {
      client_id: client.id,
      technician_id: technicianId,
      failure_type: '[E2E] Ticket VENCIDO - 80 h',
      status: 'ASSIGNED',
      created_at: new Date(now.getTime() - 80 * 60 * 60 * 1000).toISOString(),
    },
  ];

  for (const ticket of tickets) {
    // Check if ticket exists by failure_type
    const { data: existing } = await supabase
      .from('tickets')
      .select('id')
      .eq('failure_type', ticket.failure_type)
      .single();

    if (existing) {
      // Update existing ticket with fresh timestamp
      const { error } = await supabase
        .from('tickets')
        .update({
          created_at: ticket.created_at,
          status: ticket.status,
          technician_id: ticket.technician_id,
          client_id: ticket.client_id,
        })
        .eq('id', existing.id);

      if (error) {
        console.log(`   ❌ ${ticket.failure_type}: ${error.message}`);
      } else {
        console.log(`   🔄 ${ticket.failure_type} (timestamp refreshed)`);
      }
    } else {
      // Insert new ticket
      const { error } = await supabase.from('tickets').insert(ticket);
      if (error) {
        console.log(`   ❌ ${ticket.failure_type}: ${error.message}`);
      } else {
        console.log(`   ✅ ${ticket.failure_type}`);
      }
    }
  }
}

async function main() {
  try {
    await seedClients();
    const techId = await seedTechnician();
    await seedTickets(techId);

    console.log('\n✅ Seed completed\n');
  } catch (error) {
    console.error('\n❌ Seed failed:', error.message);
    process.exit(1);
  }
}

main();
