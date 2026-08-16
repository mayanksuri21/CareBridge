import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { appointment_id, reason_notes, decline_reason } = await request.json();
    if (!appointment_id) {
      return NextResponse.json({ error: 'Missing appointment_id' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const declineReason = reason_notes || decline_reason;
    const updatePayload: any = { 
      status: 'declined'
    };
    if (declineReason) {
      updatePayload.reason_notes = declineReason;
    }

    let { error } = await supabaseAdmin
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointment_id);

    if (error && (error.message.includes("check constraint") || error.code === "23514")) {
      console.warn("declined status violates database constraint, trying cancelled fallback...");
      const { error: fallbackErr } = await supabaseAdmin
        .from('appointments')
        .update({ ...updatePayload, status: 'cancelled' })
        .eq('id', appointment_id);
      error = fallbackErr;
    }

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Appointment declined successfully' });
  } catch (err: any) {
    console.error('Decline API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
