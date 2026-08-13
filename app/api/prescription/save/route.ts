import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { createSupabaseServerClient } from "@/lib/supabase/server"

type Medicine = {
  name: string
  dosage?: string
  frequency?: string
  duration?: string
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json() as {
      appointmentId?: string
      patientId?: string
      diagnosis?: string
      advice?: string
      medicines?: Medicine[]
    }
    const medicines = Array.isArray(body.medicines)
      ? body.medicines.filter((medicine) => medicine?.name?.trim())
      : []
    if (medicines.length === 0) return NextResponse.json({ error: "At least one medicine is required" }, { status: 400 })

    const admin = getAdminClient()
    const { data: doctorProfile, error: doctorError } = await admin
      .from("profiles")
      .select("name, role")
      .eq("id", user.id)
      .maybeSingle()
    if (doctorError || doctorProfile?.role !== "doctor") return NextResponse.json({ error: "Doctor authorization required" }, { status: 403 })

    const appointmentId = body.appointmentId && uuidPattern.test(body.appointmentId) ? body.appointmentId : null
    let patientId = body.patientId && uuidPattern.test(body.patientId) ? body.patientId : null
    if (appointmentId) {
      const { data: appointment, error: appointmentError } = await admin
        .from("appointments")
        .select("doctor_id, patient_id")
        .eq("id", appointmentId)
        .maybeSingle()
      if (appointmentError || !appointment || appointment.doctor_id !== user.id) {
        return NextResponse.json({ error: "Appointment is not available to this doctor" }, { status: 403 })
      }
      patientId = appointment.patient_id
    }

    const { data: prescription, error: prescriptionError } = await admin
      .from("prescriptions")
      .insert({
        appointment_id: appointmentId,
        patient_id: patientId,
        doctor_id: user.id,
        doctor_name: doctorProfile.name ?? "CareBridge Doctor",
        diagnosis: body.diagnosis?.trim() || null,
        medicines,
        advice: body.advice?.trim() || null,
        note: body.advice?.trim() || null,
      })
      .select("id, created_at")
      .single()
    if (prescriptionError || !prescription) throw prescriptionError ?? new Error("Prescription could not be saved")

    const { error: itemsError } = await admin.from("prescription_items").insert(
      medicines.map((medicine) => ({
        prescription_id: prescription.id,
        medication_name: medicine.name.trim(),
        dosage: medicine.dosage?.trim() || null,
        frequency: medicine.frequency?.trim() || null,
        duration: medicine.duration?.trim() || null,
      })),
    )
    if (itemsError) throw itemsError

    return NextResponse.json({ prescription })
  } catch (error) {
    console.error("Prescription save failed:", error)
    return NextResponse.json({ error: "Unable to save prescription" }, { status: 500 })
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const admin = getAdminClient()
    const { data, error } = await admin
      .from("prescriptions")
      .select("id, created_at, doctor_name, diagnosis, medicines, advice")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false })
    if (error) throw error
    return NextResponse.json({ prescriptions: data ?? [] })
  } catch (error) {
    console.error("Prescription list failed:", error)
    return NextResponse.json({ error: "Unable to load prescriptions" }, { status: 500 })
  }
}
