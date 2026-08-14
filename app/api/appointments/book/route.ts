import { NextResponse, NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

function parseTimeString(timeStr: string) {
  const [time, modifier] = timeStr.split(" ")
  let [hours, minutes] = (time || "00:00").split(":").map(Number)
  if (hours === 12 && modifier === "AM") {
    hours = 0
  }
  if (modifier === "PM" && hours !== 12) {
    hours += 12
  }
  return { hour: hours, minute: minutes, durationMin: 45 }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  let supabase: any

  // 1. Prioritize Service Role Client (Bypasses RLS completely)
  if (serviceRoleKey) {
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  } else {
    // Fallback: SSR Client
    const cookieStore = cookies()
    supabase = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch { }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch { }
        },
      },
    })
  }

  try {
    const body = await request.json()
    const { doctorId, patientId, appointmentDate, timeSlot, reason, symptoms } = body

    if (!doctorId || !patientId || !appointmentDate || !timeSlot) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 2. Compute full ISO Date string
    const [y, m, d] = appointmentDate.split("-").map(Number)
    const timeObj = parseTimeString(timeSlot)
    const start = new Date(Date.UTC(y, m - 1, d, timeObj.hour, timeObj.minute, 0, 0))
    const end = new Date(start.getTime() + timeObj.durationMin * 60 * 1000)

    // 3. Optional: schedule_slots handling (Safe try-catch)
    let slotId: string | null = null
    try {
      const { data: existingSlot } = await supabase
        .from("schedule_slots")
        .select("id")
        .eq("doctor_id", doctorId)
        .gte("start_time", start.toISOString())
        .lt("end_time", end.toISOString())
        .maybeSingle()

      slotId = (existingSlot as any)?.id ?? null

      if (!slotId) {
        const { data: newSlot } = await supabase
          .from("schedule_slots")
          .insert({
            doctor_id: doctorId,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            is_booked: true,
          })
          .select("id")
          .maybeSingle()

        slotId = (newSlot as any)?.id ?? null
      } else {
        await supabase.from("schedule_slots").update({ is_booked: true }).eq("id", slotId)
      }
    } catch (e) {
      console.warn("schedule_slots bypass:", e)
    }

    // 4. Robust Dynamic Appointments Table Insertion
    const fullReason = `${reason || "Consultation Request"}\n\nSelected Date: ${appointmentDate}\nTime Slot: ${timeSlot}${symptoms ? `\nSymptoms: ${symptoms}` : ""}`

    // Attempt 1: Schema with scheduled_at timestamp / slot_id
    let { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .insert({
        doctor_id: doctorId,
        patient_id: patientId,
        slot_id: slotId,
        scheduled_at: start.toISOString(),
        status: "pending",
        reason: fullReason,
      })
      .select("id")
      .maybeSingle()

    // Attempt 2: Schema with appointment_date & time_slot columns
    if (apptErr) {
      console.warn("Attempt 1 failed, trying with appointment_date column:", apptErr.message)
      const res = await supabase
        .from("appointments")
        .insert({
          doctor_id: doctorId,
          patient_id: patientId,
          slot_id: slotId,
          appointment_date: appointmentDate,
          time_slot: timeSlot,
          status: "pending",
          reason: reason || "Consultation Request",
          symptoms: symptoms || null,
        })
        .select("id")
        .maybeSingle()

      appt = res.data
      apptErr = res.error
    }

    // Attempt 3: Schema with standard basic columns (date, status, reason)
    if (apptErr) {
      console.warn("Attempt 2 failed, trying minimal columns:", apptErr.message)
      const res = await supabase
        .from("appointments")
        .insert({
          doctor_id: doctorId,
          patient_id: patientId,
          slot_id: slotId,
          status: "pending",
          reason: fullReason,
        })
        .select("id")
        .maybeSingle()

      appt = res.data
      apptErr = res.error
    }

    if (apptErr || !appt) {
      console.error("Final insert failed:", apptErr)
      return NextResponse.json({ error: apptErr?.message || "Booking insert failed" }, { status: 500 })
    }

    return NextResponse.json({ success: true, appointmentId: (appt as any)?.id }, { status: 200 })
  } catch (err: any) {
    console.error("POST /api/appointments/book error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}