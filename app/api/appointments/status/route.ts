import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

/** Release the linked schedule slot so it becomes bookable again. */
async function releaseSlot(supabase: any, appointmentId: string) {
  try {
    const { data: appt } = await supabase
      .from('appointments')
      .select('slot_id')
      .eq('id', appointmentId)
      .maybeSingle();

    if (appt?.slot_id) {
      await supabase
        .from('schedule_slots')
        .update({ is_booked: false })
        .eq('id', appt.slot_id)
        .eq('is_booked', true);
    }
  } catch (e) {
    console.warn('[status-api] Failed to release slot:', e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const appointmentId = body.appointment_id || body.appointmentId;
    const status = body.status;
    console.log("[status-api] received request:", { appointmentId, status });

    if (!appointmentId) {
      return NextResponse.json({ error: "Missing appointmentId" }, { status: 400 });
    }

    const supabase = getAdminClient();

    console.log("[status-api] fetching current appointment");
    const { data: currentAppt, error: fetchErr } = await supabase
      .from('appointments')
      .select('reason, status')
      .eq('id', appointmentId)
      .maybeSingle();
    console.log("[status-api] current appointment:", currentAppt, "error:", fetchErr?.message);

    if (fetchErr) {
      console.error("Fetch current appointment error:", fetchErr.message);
    }

    let reasonVal = currentAppt?.reason || '';
    reasonVal = reasonVal.replace(/\s*\[PENDING_APPROVAL\]/g, '').trim();

    let dbStatus = status || 'cancelled';
    if (status === 'scheduled') {
      dbStatus = 'scheduled';
    } else if (status === 'rejected' || status === 'declined' || status === 'cancelled') {
      dbStatus = 'cancelled';
    }

    const updatePayload: any = { 
      status: dbStatus, 
      reason: reasonVal
    };

    console.log("[status-api] executing update:", updatePayload);
    let { data, error } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointmentId)
      .select()
      .maybeSingle();
    console.log("[status-api] update result:", { data: !!data, error: error?.message, code: error?.code });

    if (error && (error.message.includes("check constraint") || error.code === "23514")) {
      console.warn("[status-api] status violates DB constraint, trying fallback mapping...");
      let fallbackStatus = dbStatus;
      if (dbStatus === 'scheduled') fallbackStatus = 'booked';
      if (dbStatus === 'cancelled' || dbStatus === 'declined') fallbackStatus = 'cancelled';
      
      const fallbackPayload: any = { ...updatePayload, status: fallbackStatus };
      const fallback = await supabase
        .from('appointments')
        .update(fallbackPayload)
        .eq('id', appointmentId)
        .select()
        .maybeSingle();
      error = fallback.error;
      data = fallback.data;
      if (!error) dbStatus = fallbackStatus;
      console.log("[status-api] constraint fallback result:", { data: !!data, error: error?.message, dbStatus });
    }

    if (!error && !data) {
      console.log("[status-api] no data returned, verifying...");
      const { data: verifyData } = await supabase
        .from('appointments')
        .select('status, reason, updated_at')
        .eq('id', appointmentId)
        .maybeSingle();
      if (verifyData) data = verifyData as any;
      console.log("[status-api] verify result:", { data: !!data });
    }

    if (error) {
      console.error("[status-api] Update status error:", error.message, error.code);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      console.error("[status-api] Update status failed: no rows matched for id:", appointmentId);
      return NextResponse.json({ error: "Appointment not found or could not be updated" }, { status: 404 });
    }

    // Release the linked schedule slot when the appointment is cancelled, declined,
    // or completed — the slot should become bookable again.
    if (dbStatus === 'cancelled' || dbStatus === 'completed') {
      await releaseSlot(supabase, appointmentId);
    }

    const frontendStatus = 
      dbStatus === 'booked' ? 'scheduled' : 
      dbStatus === 'cancelled' ? 'declined' : dbStatus;

    const responseAppointment = {
      ...(data || {}),
      status: frontendStatus
    };

    console.log("[status-api] success:", responseAppointment.status);
    return NextResponse.json({ success: true, appointment: responseAppointment });
  } catch (err: any) {
    console.error("[status-api] catch block error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
