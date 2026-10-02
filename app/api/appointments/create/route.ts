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

function normalizeYMD(rawDate?: string | null): string | null {
  if (!rawDate) return null;
  const str = rawDate.trim();
  if (!str) return null;
  const ymd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${String(ymd[2]).padStart(2, "0")}-${String(ymd[3]).padStart(2, "0")}`;
  }
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
  }
  const p = new Date(str);
  if (!isNaN(p.getTime())) {
    return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}-${String(p.getDate()).padStart(2, "0")}`;
  }
  return null;
}

function normalizeTimeSlot(rawTime?: string | null, scheduledAt?: string | null): string | null {
  if (rawTime && rawTime.trim()) {
    const match = rawTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (ampm === "PM" && h !== 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  if (scheduledAt) {
    const match = scheduledAt.match(/T(\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
    const d = new Date(scheduledAt);
    if (!isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
  }
  return null;
}

function isNonBlockingStatus(status?: string | null, reason?: string | null): boolean {
  const statusLower = (status || "").trim().toLowerCase();
  const reasonText = reason || "";

  // Do NOT block for cancelled, declined, or rejected appointments
  if (
    statusLower === "cancelled" ||
    statusLower === "declined" ||
    statusLower === "rejected"
  ) {
    return true;
  }

  // Also ignore payment-expired and patient-declined markers
  if (
    reasonText.includes("[PAYMENT_EXPIRED]") ||
    reasonText.includes("[PATIENT_DECLINED]") ||
    reasonText.includes("Declined:")
  ) {
    return true;
  }

  return false;
}

async function isValidDoctorSlot(
  supabase: any,
  doctorId: string,
  appointmentDate: string,
  timeSlot: string
): Promise<boolean> {
  const reqTimeNorm = normalizeTimeSlot(timeSlot);
  if (!reqTimeNorm) return false;

  const dateObj = new Date(`${appointmentDate}T00:00:00`);
  if (isNaN(dateObj.getTime())) return false;

  const dayOfWeek = dateObj.getDay(); // 0 = Sun, 6 = Sat
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = days[dayOfWeek];

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("schedule_presets, schedule_config, doctor_schedules, about, active_slots")
    .eq("id", doctorId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching doctor profile for slot validation:", error);
    return false;
  }

  let config: any[] = [];
  const scheduleData =
    profile?.schedule_presets ||
    profile?.schedule_config ||
    profile?.doctor_schedules ||
    profile?.about;
  if (scheduleData) {
    try {
      config = typeof scheduleData === "string" ? JSON.parse(scheduleData) : scheduleData;
    } catch {
      config = [];
    }
  }
  if (!Array.isArray(config)) {
    config = [];
  }

  // 1. Explicit leave check
  const isExplicitLeave = config.some((item: any) => {
    if (!item) return false;
    if (item.interval === appointmentDate && (!item.slots || item.slots.length === 0)) return true;
    if (item.schedule_type === "leave" && item.specific_date === appointmentDate && item.is_leave === true) return true;
    return false;
  });
  if (isExplicitLeave) return false;

  // 2. Specific date slot overrides
  const specificOverride = config.find((item: any) => {
    if (!item) return false;
    if (item.interval === appointmentDate && item.slots && item.slots.length > 0) return true;
    if (item.schedule_type === "specific_date" && item.specific_date === appointmentDate && item.slots && item.slots.length > 0) return true;
    return false;
  });
  if (specificOverride && Array.isArray(specificOverride.slots)) {
    return specificOverride.slots.some((s: string) => normalizeTimeSlot(s) === reqTimeNorm);
  }

  // 3. Day of week preset
  const matchingPreset = config.find((item: any) => {
    if (!item) return false;
    if (item.interval) {
      const intervalLower = item.interval.toLowerCase();
      if (intervalLower === "every day" || intervalLower === "everyday") return true;
      if (intervalLower === "monday to friday") {
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      }
      return intervalLower.includes(dayName.toLowerCase());
    }
    if (item.schedule_type === "recurring" && item.day_of_week === dayOfWeek) {
      return true;
    }
    return false;
  });
  if (matchingPreset && Array.isArray(matchingPreset.slots) && matchingPreset.slots.length > 0) {
    return matchingPreset.slots.some((s: string) => normalizeTimeSlot(s) === reqTimeNorm);
  }

  // 4. Doctor profile active_slots (if defined)
  if (Array.isArray(profile?.active_slots) && profile.active_slots.length > 0) {
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      return profile.active_slots.some((s: string) => normalizeTimeSlot(s) === reqTimeNorm);
    }
  }

  // 5. Default template matching: Monday to Friday standard clinical hours
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const DEFAULT_WEEKDAY_SLOTS = ["10:30 AM", "12:00 PM", "02:00 PM", "02:30 PM"];
    return DEFAULT_WEEKDAY_SLOTS.some((s: string) => normalizeTimeSlot(s) === reqTimeNorm);
  }

  return false;
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
        { error: "appointment_date and time_slot are required" },
        { status: 400 },
      );
    }

    const targetYMD = normalizeYMD(appointmentDate);
    const targetNormalizedTime = normalizeTimeSlot(timeSlot);

    if (!targetYMD || !targetNormalizedTime) {
      return NextResponse.json(
        { error: "Invalid appointment_date or time_slot format" },
        { status: 400 },
      );
    }

    // ==================================================
    // CRITICAL: Conflict Checks MUST complete BEFORE
    // creating/updating schedule_slots or inserting appointments.
    // FAIL CLOSED: DB errors return 500 immediately.
    // ==================================================
    if (body.patient_id) {
      const { data: existingAppts, error: apptsError } = await supabase
        .from("appointments")
        .select("id, status, reason, appointment_date, scheduled_at, time_slot, doctor_id, patient_id")
        .eq("patient_id", body.patient_id);

      if (apptsError) {
        console.error("Conflict validation lookup error:", apptsError.message);
        return NextResponse.json(
          { error: "Failed to validate existing appointments. Please try again." },
          { status: 500 },
        );
      }

      for (const appt of existingAppts || []) {
        if (isNonBlockingStatus(appt.status, appt.reason)) {
          continue;
        }

        let aDate = appt.appointment_date;
        if (!aDate && appt.scheduled_at) {
          aDate = appt.scheduled_at.split("T")[0];
        }
        if (!aDate && appt.reason) {
          const m = appt.reason.match(/Selected Date:\s*([\d{4}-\d{2}-\d{2}]+)/i) || appt.reason.match(/Preferred Date:\s*([\d{4}-\d{2}-\d{2}]+)/i);
          if (m) aDate = m[1].trim();
        }

        const existingYMD = normalizeYMD(aDate);
        if (!existingYMD || existingYMD !== targetYMD) {
          continue;
        }

        // RULE 1: SAME DOCTOR + SAME DAY
        // A patient can have only ONE valid appointment with the SAME doctor on the SAME calendar date.
        if (appt.doctor_id === body.doctor_id) {
          let rawDocName = (body.doctor_name || "").trim();
          let docName = rawDocName;
          if (!docName) {
            docName = "Dr. Rahul Sharma";
          } else if (!/^dr\.?\s+/i.test(docName)) {
            docName = `Dr. ${docName}`;
          }

          return NextResponse.json(
            {
              error: `Can't book this doctor again today. You already have a consultation with ${docName} today. Please choose another date or doctor.`,
            },
            { status: 400 },
          );
        }

        // RULE 2: SAME PATIENT + SAME DATE + SAME TIME
        // A patient must NOT be able to book TWO different doctors for the EXACT SAME date and time.
        const existingTimeNorm = normalizeTimeSlot(appt.time_slot, appt.scheduled_at);
        if (existingTimeNorm && existingTimeNorm === targetNormalizedTime) {
          return NextResponse.json(
            {
              error: "You already have a consultation scheduled at this time. Please choose another time.",
            },
            { status: 400 },
          );
        }
      }
    }

    // Validate future datetime slot
    const { start, end } = buildSlotRange(appointmentDate, timeSlot);
    if (start.getTime() <= Date.now()) {
      return NextResponse.json(
        {
          error:
            "Cannot book appointments for past dates or times. Please select a future time slot from tomorrow onwards.",
        },
        { status: 400 },
      );
    }

    // ==================================================
    // SLOT VALIDATION & SCHEDULE SLOTS CREATION
    // ==================================================
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
            "This time slot is no longer available. Please choose another available time.",
        },
        { status: 409 },
      );
    }

    // If no schedule_slots row exists yet for this doctor/date/time, check if it's a valid active slot
    if (!matchedSlot) {
      const isAvailable = await isValidDoctorSlot(
        supabase,
        body.doctor_id,
        appointmentDate,
        timeSlot,
      );

      if (!isAvailable) {
        return NextResponse.json(
          {
            error:
              "This time slot is no longer available. Please choose another available time.",
          },
          { status: 400 },
        );
      }

      // Slot is valid for doctor/date, so create the schedule_slots row
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

    // Mark slot as booked
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
          error:
            "This time slot is no longer available. Please choose another available time.",
        },
        { status: 409 },
      );
    }

    // Insert appointment
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
      // Roll back slot booking
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

    // Sync phone if provided
    if (body.patient_id && body.phone) {
      try {
        await supabase
          .from("profiles")
          .update({ phone: String(body.phone).trim() })
          .eq("id", body.patient_id);
      } catch (profErr) {
        console.warn("Backend profile phone sync error:", profErr);
      }
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
      reason: data?.reason || fullReason,
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

