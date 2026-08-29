import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
    { auth: { persistSession: false } },
  );
}

// "02:30 PM" -> { hour: 14, minute: 30 }
function parseSlotLabel(label: string): { hour: number; minute: number } {
  const match = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hour: 12, minute: 0 };
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return { hour, minute };
}

// dateStr expected as "YYYY-MM-DD"
function buildSlotRange(dateStr: string, label: string, durationMin = 30) {
  const { hour, minute } = parseSlotLabel(label);
  const start = new Date(`${dateStr}T00:00:00`);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60000);
  return { start, end };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = getSupabase();

    if (!body.doctor_id) {
      return NextResponse.json(
        { error: "doctor_id is required" },
        { status: 400 },
      );
    }

    const parts = (body.scheduled_at || "").split(" ");
    const appointmentDate =
      body.appointment_date || body.scheduled_date || parts[0] || "";
    const timeSlot =
      body.time_slot || body.scheduled_time || parts.slice(1).join(" ") || "";

    if (!appointmentDate || !timeSlot) {
      return NextResponse.json(
        { error: "Missing appointment date or time slot" },
        { status: 400 },
      );
    }

    const { start, end } = buildSlotRange(appointmentDate, timeSlot);

    // 1. Look for an existing schedule_slots row for this doctor on this day,
    //    then match it to the requested time in JS to avoid timestamp/timezone
    //    equality issues in the SQL query itself.
    const dayStart = new Date(`${appointmentDate}T00:00:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60000);

    const { data: daySlots, error: daySlotsError } = await supabase
      .from("schedule_slots")
      .select("id, start_time, is_booked")
      .eq("doctor_id", body.doctor_id)
      .gte("start_time", dayStart.toISOString())
      .lt("start_time", dayEnd.toISOString());

    if (daySlotsError) {
      console.error("schedule_slots lookup error:", daySlotsError.message);
      return NextResponse.json(
        { error: daySlotsError.message },
        { status: 500 },
      );
    }

    let matchedSlot = (daySlots || []).find(
      (s: any) => new Date(s.start_time).getTime() === start.getTime(),
    );

    if (matchedSlot?.is_booked) {
      return NextResponse.json(
        {
          error:
            "This time slot has just been booked by someone else. Please pick another slot.",
        },
        { status: 409 },
      );
    }

    // 2. If no slot row exists yet for this doctor/date/time, create one.
    if (!matchedSlot) {
      const { data: createdSlot, error: createSlotError } = await supabase
        .from("schedule_slots")
        .insert({
          doctor_id: body.doctor_id,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          is_booked: false,
        })
        .select("id, start_time, is_booked")
        .single();

      if (createSlotError) {
        console.error("schedule_slots create error:", createSlotError.message);
        return NextResponse.json(
          { error: createSlotError.message },
          { status: 500 },
        );
      }
      matchedSlot = createdSlot;
    }

    // 3. Mark the slot as booked.
    const { data: bookedSlot, error: markBookedError } = await supabase
      .from("schedule_slots")
      .update({ is_booked: true })
      .eq("id", matchedSlot.id)
      .eq("is_booked", false)
      .select("id")
      .maybeSingle();

    if (markBookedError) {
      console.error("schedule_slots update error:", markBookedError.message);

      return NextResponse.json(
        { error: markBookedError.message },
        { status: 500 },
      );
    }

    if (!bookedSlot) {
      return NextResponse.json(
        {
          error: "This time slot has just been booked by another patient.",
        },
        { status: 409 },
      );
    }

    // 4. Insert the appointment, referencing the real slot via slot_id.
    //    We still encode date/time/symptoms into `reason` as a readable
    //    fallback for any existing display logic that parses it.
    const appointmentId = crypto.randomUUID();

    const fullReason = body.reason || "General Consultation";

    const { data, error: insertError } = await supabase
      .from("appointments")
      .insert({
        id: appointmentId,

        patient_id: body.patient_id || null,
        doctor_id: body.doctor_id,

        slot_id: matchedSlot.id,

        patient_name: body.patient_name || null,
        patient_email: body.patient_email || null,
        phone: body.phone || null,

        doctor_name: body.doctor_name || null,

        appointment_date: appointmentDate,
        time_slot: timeSlot,

        scheduled_at: start.toISOString(),

        reason: fullReason,
        symptoms: body.symptoms || null,

        status: "pending",
      })
      .select()
      .single();

    if (insertError || !data) {
      console.error("Appointment create error:", insertError);

      // Roll back slot booking if appointment creation failed.
      await supabase
        .from("schedule_slots")
        .update({ is_booked: false })
        .eq("id", matchedSlot.id);

      return NextResponse.json(
        {
          error: insertError?.message || "Failed to create appointment",
        },
        { status: 500 },
      );
    }

    const responseAppointment = {
      id: appointmentId,
      patient_id: body.patient_id || null,
      doctor_id: body.doctor_id,
      slot_id: matchedSlot.id,
      patient_name: body.patient_name || null,
      patient_email: body.patient_email || null,
      phone: body.phone || null,
      doctor_name: body.doctor_name || null,
      scheduled_date: appointmentDate,
      scheduled_time: timeSlot,
      scheduled_at: `${appointmentDate} ${timeSlot}`,
      reason: body.reason || "General Consultation",
      symptoms: body.symptoms || "",
      status: "pending",
      call_active: false,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      appointment: responseAppointment,
    });
  } catch (err: any) {
    console.error("Create appointment catch error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
