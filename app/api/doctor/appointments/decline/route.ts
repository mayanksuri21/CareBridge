import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

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

    // Build updated reason: strip tags and any previous decline annotation,
    // then append "| Declined: <reason>" so the reason is always recoverable.
    let existingReason = currentAppt.reason || '';
    existingReason = existingReason.replace(/\s*\[PENDING_APPROVAL\]/g, '').trim();
    existingReason = existingReason.replace(/\s*\|\s*Declined:.*$/i, '').trim();

    const updatedReason = existingReason
      ? `${existingReason} | Declined: ${declineReason.trim()}`
      : `Declined: ${declineReason.trim()}`;

    // Use ONLY columns that exist in the schema: status + reason
    const updatePayload = {
      status: 'declined',
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

    // If 'declined' is not in the DB check constraint, fall back to 'cancelled'
    if (error && (error.message?.includes("check constraint") || error.code === "23514")) {
      console.warn("[decline-api] 'declined' violates constraint, falling back to 'cancelled'");
      const fallbackPayload = { status: 'cancelled', reason: updatedReason };
      const fallback = await supabase
        .from('appointments')
        .update(fallbackPayload)
        .eq('id', appointment_id)
        .select()
        .maybeSingle();
      error = fallback.error;
      data = fallback.data;
      console.log("[decline-api] fallback result:", {
        data: data ? { id: data.id, status: data.status } : null,
        error: error?.message
      });
    }

    if (error) {
      console.error("[decline-api] update failed:", error.message, error.code);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      console.error("[decline-api] no row returned for id:", appointment_id);
      return NextResponse.json({ error: "Appointment not found or could not be updated" }, { status: 404 });
    }

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
