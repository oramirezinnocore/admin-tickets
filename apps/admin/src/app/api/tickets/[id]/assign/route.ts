import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTicketAssignedPush } from '@/lib/send-technician-push';
import { getTicketSlaState, TicketSlaState, formatTicketFolio } from '@wisper/shared';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;
    const { technicianId } = await request.json();

    if (!technicianId) {
      return NextResponse.json({ error: 'Technician ID required' }, { status: 400 });
    }

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('*, client:clients(*)')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Update ticket assignment
    const updates: any = {
      technician_id: technicianId,
      assigned_at: new Date().toISOString(),
    };

    // Set status to ASSIGNED if coming from PENDING, PAUSED, or IN_REVIEW
    if (['PENDING', 'PAUSED', 'IN_REVIEW'].includes(ticket.status)) {
      updates.status = 'ASSIGNED';
    }

    const { error: updateError } = await supabaseAdmin
      .from('tickets')
      .update(updates)
      .eq('id', ticketId);

    if (updateError) {
      console.error('[API] Error updating ticket:', updateError);
      return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
    }

    // Send push notification (non-blocking)
    const slaState = getTicketSlaState(ticket.created_at);
    const isHighPriority = slaState === TicketSlaState.RED || slaState === TicketSlaState.OVERDUE;

    sendTicketAssignedPush(
      technicianId,
      ticket.folio,
      ticketId,
      ticket.client?.name || 'Cliente',
      isHighPriority
    ).then((result) => {
      if (!result.success) {
        console.warn('[API] Push notification failed:', result.error);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error in assign route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
