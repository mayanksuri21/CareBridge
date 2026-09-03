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
    console.warn('[decline-api] Failed to release slot:', e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const appointment_id = body.appointment_id;
    const declineReason = body.decline_reason;

    console.log("[decline-api] received:", { appointment_id, declineReason });

    if (!appointment_id) {
      return NextResponse.json({ error: "Missing appointment_id" }, { status: 400 });
    }
    if (!declineReason || !declineReason.trim()) {
      return NextResponse.json({ error: "Missing decline reason" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Fetch current appointment to get existing reason text
    const { data: currentAppt, error: fetchErr } = await supabase
      .from('appointments')
      .select('reason, status')
      .eq('id', appointment_id)
      .maybeSingle();

    if (fetchErr) {
      console.error("[decline-api] fetch error:", fetchErr.message);
    }
    if (!currentAppt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    console.log("[decline-api] current appointment:", {
      id: appointment_id,
      status: currentAppt.status,
      reason: currentAppt.reason
    });

    // Build updated reason: strip ALL call/room tags and previous decline annotations,
    // then append "| Declined: <reason>" so the reason is always clean and recoverable.
    let existingReason = currentAppt.reason || '';
    const tagsToRemove = [
      '[DOCTOR_IN_ROOM]',
      '[PATIENT_WAITING]',
      '[PATIENT_ADMITTED]',
      '[PATIENT_DECLINED]',
      '[CALL_ACTIVE]',
      '[PENDING_APPROVAL]'
    ];
    tagsToRemove.forEach(tag => {
      existingReason = existingReason.split(` ${tag}`).join('').split(tag).join('');
    });
    existingReason = existingReason.replace(/\s*\|\s*Declined:.*$/i, '').trim();

    const updatedReason = existingReason
      ? `${existingReason} | Declined: ${declineReason.trim()}`
      : `Declined: ${declineReason.trim()}`;

    // Primary status: 'cancelled' is universally permitted by appointments_status_check
    const updatePayload = {
      status: 'cancelled',
      reason: updatedReason
    };

    console.log("[decline-api] update payload:", updatePayload);

    let { data, error } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointment_id)
      .select()
      .maybeSingle();

    console.log("[decline-api] update result:", {
      data: data ? { id: data.id, status: data.status, reason: (data as any).reason } : null,
      error: error?.message,
      code: error?.code
    });

    if (error) {
      console.error("[decline-api] update failed:", error.message, error.code);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      console.error("[decline-api] no row returned for id:", appointment_id);
      return NextResponse.json({ error: "Appointment not found or could not be updated" }, { status: 404 });
    }

    // Release the linked schedule slot so it becomes bookable again.
    await releaseSlot(supabase, appointment_id);

    console.log("[decline-api] success:", { id: data.id, status: data.status });
    return NextResponse.json({
      success: true,
      message: "Appointment declined successfully",
      appointment: {
        id: data.id,
        status: data.status,
        reason: (data as any).reason
      }
    });
  } catch (err: any) {
    console.error("[decline-api] catch error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
