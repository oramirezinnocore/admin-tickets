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

console.log('\n⏰ Wisper Logística - SLA Validation\n');

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing configuration\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getTicketSlaState(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  const hours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

  if (hours <= 24) return 'GREEN';
  if (hours <= 48) return 'YELLOW';
  if (hours <= 72) return 'RED';
  return 'OVERDUE';
}

function getSlaOrderPriority(slaState) {
  switch (slaState) {
    case 'OVERDUE':
      return 1;
    case 'RED':
      return 2;
    case 'YELLOW':
      return 3;
    case 'GREEN':
      return 4;
    default:
      return 5;
  }
}

async function main() {
  // Get E2E tickets
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id, folio, failure_type, created_at, status')
    .ilike('failure_type', '%[E2E]%')
    .in('status', ['PENDING', 'ASSIGNED', 'IN_REVIEW', 'PAUSED'])
    .order('created_at', { ascending: true });

  if (error) {
    console.log(`❌ Failed to fetch tickets: ${error.message}\n`);
    process.exit(1);
  }

  if (!tickets || tickets.length === 0) {
    console.log('⚠️  No E2E tickets found. Run seed-e2e first.\n');
    process.exit(0);
  }

  console.log('📊 E2E Tickets SLA Status:\n');

  const ticketsWithSla = tickets.map((t) => ({
    ...t,
    sla: getTicketSlaState(t.created_at),
    priority: getSlaOrderPriority(getTicketSlaState(t.created_at)),
  }));

  ticketsWithSla.forEach((t) => {
    const age = Math.floor(
      (new Date().getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60)
    );
    const emoji = t.sla === 'OVERDUE' ? '🔴' : t.sla === 'RED' ? '🟠' : t.sla === 'YELLOW' ? '🟡' : '🟢';
    console.log(`${emoji} ${t.sla.padEnd(8)} | ${age}h | ${t.failure_type.substring(0, 50)}`);
  });

  console.log('\n🔄 Expected order (OVERDUE → RED → YELLOW → GREEN):\n');

  const sorted = [...ticketsWithSla].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  sorted.forEach((t, index) => {
    console.log(`${index + 1}. ${t.sla} - ${t.failure_type.substring(0, 50)}`);
  });

  // Validate expected SLA states
  console.log('\n✅ SLA Validation:\n');

  let allCorrect = true;

  const greenTicket = ticketsWithSla.find((t) => t.failure_type.includes('GREEN'));
  if (greenTicket) {
    const correct = greenTicket.sla === 'GREEN';
    console.log(`   GREEN ticket: ${correct ? '✅' : '❌'} ${greenTicket.sla}`);
    if (!correct) allCorrect = false;
  }

  const yellowTicket = ticketsWithSla.find((t) => t.failure_type.includes('YELLOW'));
  if (yellowTicket) {
    const correct = yellowTicket.sla === 'YELLOW';
    console.log(`   YELLOW ticket: ${correct ? '✅' : '❌'} ${yellowTicket.sla}`);
    if (!correct) allCorrect = false;
  }

  const redTicket = ticketsWithSla.find((t) => t.failure_type.includes('RED'));
  if (redTicket) {
    const correct = redTicket.sla === 'RED';
    console.log(`   RED ticket: ${correct ? '✅' : '❌'} ${redTicket.sla}`);
    if (!correct) allCorrect = false;
  }

  const overdueTicket = ticketsWithSla.find((t) => t.failure_type.includes('OVERDUE'));
  if (overdueTicket) {
    const correct = overdueTicket.sla === 'OVERDUE';
    console.log(`   OVERDUE ticket: ${correct ? '✅' : '❌'} ${overdueTicket.sla}`);
    if (!correct) allCorrect = false;
  }

  // Validate order
  const expectedOrder = ['OVERDUE', 'RED', 'YELLOW', 'GREEN'];
  const actualOrder = sorted.map((t) => t.sla);
  const orderCorrect = expectedOrder.every((sla) => {
    const expectedIndex = expectedOrder.indexOf(sla);
    const actualIndex = actualOrder.indexOf(sla);
    return actualIndex === -1 || expectedIndex <= actualIndex;
  });

  console.log(`   Order: ${orderCorrect ? '✅' : '❌'}`);

  if (!orderCorrect) allCorrect = false;

  console.log(allCorrect ? '\n✅ All SLA validations passed\n' : '\n❌ Some validations failed\n');

  process.exit(allCorrect ? 0 : 1);
}

main();
