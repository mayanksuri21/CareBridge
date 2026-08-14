import { NextResponse, NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

function parseTimeString(timeStr: string) {
  const [time, modifier] = timeStr.split(" ")
  let [hours, minutes] = time.split(":").map(Number)
  if (hours === 12) {
    hours = 0
  }
  if (modifier === "PM") {
    hours += 12
  }
  return { hour: hours, minute: minutes, durationMin: 45 }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  let supabase: any

  // 1. Initialize Supabase Client
  // If service role key is available, use it to bypass RLS
  if (serviceRoleKey) {
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  } else {
    // Fall back to server client with cookies context to load authenticated browser session
    const cookieStore = cookies()
    supabase = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {}
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch {}
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

    // 2. Calculate time slots ranges
    const [y, m, d] = appointmentDate.split("-").map(Number)
    const timeObj = parseTimeString(timeSlot)
    const start = new Date(Date.UTC(y, m - 1, d, timeObj.hour, timeObj.minute, 0, 0))
    const end = new Date(start.getTime() + timeObj.durationMin * 60 * 1000)

    // 3. Optional: Create/read slot inside schedule_slots (wrapped to prevent RLS failures from blocking bookings)
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
        const { data: newSlot, error: insertSlotErr } = await supabase
          .from("schedule_slots")
          .insert({
            doctor_id: doctorId,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            is_booked: true
          })
          .select("id")
          .maybeSingle()

        if (!insertSlotErr && newSlot) {
          slotId = (newSlot as any)?.id ?? null
        } else {
          console.warn("Optional schedule slot creation failed (bypassing):", insertSlotErr?.message)
        }
      } else {
        await supabase
          .from("schedule_slots")
          .update({ is_booked: true })
          .eq("id", slotId)
      }
    } catch (slotErr) {
      console.warn("Optional schedule_slots table operations failed (bypassing):", slotErr)
    }

    // 4. Create appointment payload with dynamic columns fallback check
    const appointmentPayload: any = {
      patient_id: patientId,
      doctor_id: doctorId,
      slot_id: slotId,
      appointment_date: appointmentDate,
      time_slot: timeSlot,
      reason: reason || "No description provided",
      symptoms: symptoms || null,
      status: "pending"
    }

    let { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .insert(appointmentPayload)
      .select("id")
      .maybeSingle()

    if (apptErr) {
      console.warn("First insert attempt failed (likely missing custom columns):", apptErr.message)

      // Fallback 1: If custom columns are missing, insert only standard columns and append info to reason
      if (apptErr.message.includes("column") || apptErr.code === "42703") {
        console.log("Retrying with schema-aligned standard columns...")
        const standardPayload = {
          patient_id: patientId,
          doctor_id: doctorId,
          slot_id: slotId,
          reason: `${reason || "No description provided"}\n\nPreferred Date: ${appointmentDate}\nTime Slot: ${timeSlot}${symptoms ? `\nSymptoms: ${symptoms}` : ""}`,
          status: "pending"
        }

        const { data: appt2, error: apptErr2 } = await supabase
          .from("appointments")
          .insert(standardPayload)
          .select("id")
          .maybeSingle()

        appt = appt2
        apptErr = apptErr2
      }

      // Fallback 2: If status check constraint restricts "pending" status values
      if (apptErr && (apptErr.message.includes("check constraint") || apptErr.code === "23514")) {
        console.log("Retrying fallback with status: booked...")
        const finalPayload = {
          patient_id: patientId,
          doctor_id: doctorId,
          slot_id: slotId,
          reason: `${reason || "No description provided"}\n\nPreferred Date: ${appointmentDate}\nTime Slot: ${timeSlot}${symptoms ? `\nSymptoms: ${symptoms}` : ""}`,
          status: "booked"
        }

        const { data: appt3, error: apptErr3 } = await supabase
          .from("appointments")
          .insert(finalPayload)
          .select("id")
          .maybeSingle()

        appt = appt3
        apptErr = apptErr3
      }
    }

    if (apptErr || !appt) {
      console.error("Booking post final error:", apptErr)
      return NextResponse.json({ error: apptErr?.message || "Insert failed" }, { status: 500 })
    }

    return NextResponse.json({ success: true, appointmentId: (appt as any)?.id })
  } catch (err: any) {
    console.error("Booking post route error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
