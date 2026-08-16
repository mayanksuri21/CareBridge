import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const appointmentId = body.appointment_id || body.appointmentId;
    const status = body.status;
    const decline_reason = body.reason_notes || body.decline_reason;

    if (!appointmentId) {
      return NextResponse.json({ error: "Missing appointmentId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { auth: { persistSession: false } }
    );

    const { data: currentAppt, error: fetchErr } = await supabase
      .from('appointments')
      .select('reason, status')
      .eq('id', appointmentId)
      .maybeSingle();

    if (fetchErr) {
      console.error("Fetch current appointment error:", fetchErr.message);
    }

    let reasonVal = currentAppt?.reason || '';
    reasonVal = reasonVal.replace(/\s*\[PENDING_APPROVAL\]/g, '').trim();

    let dbStatus = status || 'cancelled';
    if (status === 'scheduled') {
      dbStatus = 'scheduled';
    } else if (status === 'rejected' || status === 'declined' || status === 'cancelled') {
      dbStatus = 'declined';
    }

    const updatePayload: any = { 
      status: dbStatus, 
      reason: reasonVal
    };

    if (decline_reason) {
      updatePayload.reason_notes = decline_reason;
    }

    let { data, error } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointmentId)
      .select()
      .maybeSingle();

    if (error && (error.message.includes("check constraint") || error.code === "23514")) {
      console.warn("status violates DB constraint, trying fallback mapping...");
      let fallbackStatus = dbStatus;
      if (dbStatus === 'scheduled') fallbackStatus = 'booked';
      if (dbStatus === 'declined') fallbackStatus = 'cancelled';
      
      const fallback = await supabase
        .from('appointments')
        .update({ ...updatePayload, status: fallbackStatus })
        .eq('id', appointmentId)
        .select()
        .maybeSingle();
      error = fallback.error;
      data = fallback.data;
      if (!error) dbStatus = fallbackStatus;
    }

    if (!error && !data) {
      const { data: verifyData } = await supabase
        .from('appointments')
        .select('status, reason, reason_notes, updated_at')
        .eq('id', appointmentId)
        .maybeSingle();
      if (verifyData) data = verifyData as any;
    }

    if (error) {
      console.error("Update status error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      console.error("Update status failed: no rows matched for id:", appointmentId);
      return NextResponse.json({ error: "Appointment not found or could not be updated" }, { status: 404 });
    }

    const frontendStatus = 
      dbStatus === 'booked' ? 'scheduled' : 
      dbStatus === 'cancelled' ? 'declined' : dbStatus;

    const responseAppointment = {
      ...(data || {}),
      status: frontendStatus
    };

    return NextResponse.json({ success: true, appointment: responseAppointment });
  } catch (err: any) {
    console.error("Status update catch block error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
