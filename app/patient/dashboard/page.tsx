import { redirect } from "next/navigation"
import { Activity, ArrowRight, CalendarDays, FileText, Stethoscope } from "lucide-react"
import { createClient } from "@supabase/supabase-js"

import { PatientDashboardClient } from "@/components/patient/patient-dashboard-client"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { PrintablePrescription } from "@/lib/generate-prescription-pdf"

export const dynamic = "force-dynamic"

type PatientProfile = {
  id: string
  name: string | null
  email: string | null
  language: string | null
}

export default async function PatientDashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login?role=patient")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  })

  const [{ data: profile }, { data: prescriptionsRaw, error: rxError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, email, language")
      .eq("id", user.id)
      .maybeSingle(),

    supabaseAdmin
      .from("prescriptions")
      .select("*")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false }),
  ])

  const { data: profileCheck } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileCheck?.role === "doctor") redirect("/doctor/dashboard")

  const patient: PatientProfile = profile ?? {
    id: user.id,
    name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Patient",
    email: user.email ?? null,
    language: "en",
  }

  let prescriptions: PrintablePrescription[] = []
  if (!rxError && prescriptionsRaw && prescriptionsRaw.length > 0) {
    prescriptions = prescriptionsRaw.map((rx: any) => {
      let medicinesList = []
      if (rx.medicines) {
        medicinesList = typeof rx.medicines === 'string' ? JSON.parse(rx.medicines) : rx.medicines
      } else if (rx.note) {
        try {
          const match = rx.note.match(/Medications:\s*(\[.*\])/i)
          if (match) medicinesList = JSON.parse(match[1])
        } catch {}
      }

      let diagnosis = rx.diagnosis
      let advice = rx.advice || rx.note
      if (!diagnosis && rx.note) {
        const diagMatch = rx.note.match(/Diagnosis:\s*([^\n\r]*)/i)
        if (diagMatch) diagnosis = diagMatch[1].trim()
      }

      return {
        id: rx.id,
        created_at: rx.created_at,
        doctor_name: rx.doctor_name || 'CareBridge Doctor',
        diagnosis: diagnosis || 'General Consultation',
        medicines: medicinesList,
        advice: advice || ''
      }
    })
  }

  const { data: patientAppts } = await supabaseAdmin
    .from("appointments")
    .select("id, doctor_id, slot_id, status, reason, created_at")
    .eq("patient_id", user.id)
    .in("status", ["scheduled", "pending", "booked", "confirmed"])
    .order("created_at", { ascending: false })

  let initialApptsMapped: any[] = []
  if (patientAppts && patientAppts.length > 0) {
    const doctorIds = Array.from(new Set(patientAppts.map((a: any) => a.doctor_id).filter(Boolean)))
    let doctorMap = new Map()
    if (doctorIds.length > 0) {
      const { data: docProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email, specialty")
        .in("id", doctorIds)
      if (docProfiles) {
        doctorMap = new Map(docProfiles.map((p: any) => [p.id, p]))
      }
    }
    initialApptsMapped = patientAppts.map((apt: any) => {
      const doc = doctorMap.get(apt.doctor_id) || {}
      
      const reasonStr = apt.reason || ""
      const symptomsMatch = reasonStr.match(/Symptoms:\s*([^\n\r]*)/i)
      const dateMatch = reasonStr.match(/Selected Date:\s*([^\n\r]*)/i) || reasonStr.match(/Preferred Date:\s*([^\n\r]*)/i)
      const timeMatch = reasonStr.match(/Time Slot:\s*([^\n\r]*)/i)
      
      let cleanReason = reasonStr
      const splitIndex = reasonStr.search(/(Symptoms:|Preferred Date:|Selected Date:|Time Slot:)/i)
      if (splitIndex !== -1) {
        cleanReason = reasonStr.substring(0, splitIndex).trim()
      }
      
      const parsedDate = dateMatch ? dateMatch[1].trim() : '2026-08-17'
      const parsedTime = timeMatch ? timeMatch[1].trim() : '02:00 PM'
      const parsedSymptoms = symptomsMatch ? symptomsMatch[1].trim() : ''

      return {
        id: apt.id,
        doctor_id: apt.doctor_id,
        doctor: {
          id: apt.doctor_id,
          name: doc.name || 'Dr. Rahul Sharma',
          specialty: doc.specialty || 'General Medicine',
          email: doc.email || ''
        },
        appointment_date: parsedDate,
        time_slot: parsedTime,
        symptoms: parsedSymptoms,
        status: apt.status || 'scheduled',
        reason: cleanReason || 'General Consultation',
        created_at: apt.created_at
      }
    })
  }

  return (
    <PatientDashboardClient
      patientId={patient.id}
      patientName={patient.name ?? "Patient"}
      patientEmail={patient.email}
      initialPrescriptions={prescriptions}
      initialAppointments={initialApptsMapped}
    />
  )
}

