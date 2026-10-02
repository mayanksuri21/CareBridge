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

  return {
    hour: hours,
    minute: minutes,
    durationMin: 45,
  }
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

    supabase = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
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
      }
    )
  }

  try {
    const body = await request.json()

    const {
      doctorId,
      patientId,
      appointmentDate,
      timeSlot,
      reason,
      symptoms,
    } = body

    if (!doctorId || !patientId || !appointmentDate || !timeSlot) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Rule 1: Check if patient already has an active appointment with this doctor on this same date
    if (patientId && doctorId && appointmentDate) {
      try {
        const normalizeYMD = (rawDate?: string | null): string | null => {
          if (!rawDate) return null
          const str = rawDate.trim()
          if (!str) return null
          const ymd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
          if (ymd) return `${ymd[1]}-${String(ymd[2]).padStart(2, '0')}-${String(ymd[3]).padStart(2, '0')}`
          const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
          if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`
          const p = new Date(str)
          if (!isNaN(p.getTime())) {
            return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-${String(p.getDate()).padStart(2, '0')}`
          }
          return null
        }

        const targetYMD = normalizeYMD(appointmentDate)

        const { data: existingAppts } = await supabase
          .from("appointments")
          .select("id, status, reason, appointment_date, scheduled_at")
          .eq("doctor_id", doctorId)
          .eq("patient_id", patientId)

        const hasSameDayActive = (existingAppts || []).some((a: any) => {
          const reasonText = a.reason || ''
          const statusLower = (a.status || '').toLowerCase()
          const isDeclinedOrCancelled =
            statusLower === 'cancelled' ||
            statusLower === 'declined' ||
            statusLower === 'rejected' ||
            reasonText.includes('Declined:') ||
            reasonText.includes('[PAYMENT_EXPIRED]') ||
            reasonText.includes('[PATIENT_DECLINED]')

          if (isDeclinedOrCancelled) return false

          let aDate = a.appointment_date
          if (!aDate && a.scheduled_at) {
            aDate = a.scheduled_at.split('T')[0]
          }
          if (!aDate && reasonText) {
            const m = reasonText.match(/Selected Date:\s*([\d{4}-\d{2}-\d{2}]+)/i) || reasonText.match(/Preferred Date:\s*([\d{4}-\d{2}-\d{2}]+)/i)
            if (m) aDate = m[1].trim()
          }

          const existingYMD = normalizeYMD(aDate)
          return existingYMD && targetYMD && existingYMD === targetYMD
        })

        if (hasSameDayActive) {
          const docName = body.doctor_name || body.doctorName || "Dr. Rahul Sharma"
          return NextResponse.json(
            { error: `Can't book this doctor again today. You already have a consultation with ${docName} today. Please choose another date or doctor.` },
            { status: 400 }
          )
        }
      } catch (checkErr) {
        console.warn("Same day appointment check warning:", checkErr)
      }
    }

    // 2. Compute full ISO Date string
    const [y, m, d] = appointmentDate.split("-").map(Number)
    const timeObj = parseTimeString(timeSlot)

    const start = new Date(
      Date.UTC(
        y,
        m - 1,
        d,
        timeObj.hour,
        timeObj.minute,
        0,
        0
      )
    )

    const end = new Date(
      start.getTime() + timeObj.durationMin * 60 * 1000
    )

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
        await supabase
          .from("schedule_slots")
          .update({ is_booked: true })
          .eq("id", slotId)
      }
    } catch (e) {
      console.warn("schedule_slots bypass:", e)
    }

    // 4. Robust Dynamic Appointments Table Insertion
    const fullReason =
      `${reason || "Consultation Request"}\n\n` +
      `Selected Date: ${appointmentDate}\n` +
      `Time Slot: ${timeSlot}` +
      `${symptoms ? `\nSymptoms: ${symptoms}` : ""}`

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
      console.warn(
        "Attempt 1 failed, trying with appointment_date column:",
        apptErr.message
      )

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

    // Attempt 3: Schema with standard basic columns
    if (apptErr) {
      console.warn(
        "Attempt 2 failed, trying minimal columns:",
        apptErr.message
      )

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

      return NextResponse.json(
        {
          error:
            apptErr?.message || "Booking insert failed",
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        appointmentId: (appt as any)?.id,
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error("POST /api/appointments/book error:", err)

    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}