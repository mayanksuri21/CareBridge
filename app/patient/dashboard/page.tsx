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
    const doctorIds = Array.from(new Set(prescriptionsRaw.map((rx: any) => rx.doctor_id).filter(Boolean)))
    let doctorMap = new Map()
    if (doctorIds.length > 0) {
      const { data: docProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, name")
        .in("id", doctorIds)
      if (docProfiles) {
        doctorMap = new Map(docProfiles.map((p: any) => [p.id, p]))
      }
    }

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
      
      if (rx.note && rx.note.includes('Instructions:')) {
        const match = rx.note.match(/Instructions:\s*([\s\S]*)/i)
        if (match) advice = match[1].trim()
      }
      if (!diagnosis && rx.note && rx.note.includes('Diagnosis:')) {
        const diagMatch = rx.note.match(/Diagnosis:\s*([^\n\r]*)/i)
        if (diagMatch) diagnosis = diagMatch[1].trim()
      }

      const doc = doctorMap.get(rx.doctor_id)
      const docName = doc?.name || rx.doctor_name || 'Rahul Sharma'
      const cleanDocName = docName.startsWith('Dr. ') ? docName.substring(4) : docName

      return {
        id: rx.id,
        created_at: rx.created_at,
        doctor_id: rx.doctor_id,
        doctor_name: cleanDocName,
        diagnosis: diagnosis || 'General Consultation',
        medicines: medicinesList,
        advice: advice || 'Follow prescribed dosage',
        instructions: advice || 'Follow prescribed dosage'
      }
    })
  }

function isConsultationPast(appt: { appointment_date?: string; time_slot?: string; scheduled_date?: string; scheduled_time?: string; scheduled_at?: string }): boolean {
  try {
    if (appt.scheduled_at) {
      const sDate = new Date(appt.scheduled_at);
      if (!isNaN(sDate.getTime())) {
        const now = new Date();
        return now.getTime() > sDate.getTime() + 30 * 60 * 1000;
      }
    }
    const dStr = appt.appointment_date || appt.scheduled_date || '';
    if (!dStr) return false;
    let parsedDate: Date | null = null;
    if (dStr.includes('-')) {
      const parts = dStr.split('-');
      if (parts[0].length === 4) {
        parsedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        parsedDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    } else if (dStr.includes('/')) {
      const parts = dStr.split('/');
      if (parts[2]?.length === 4) {
        parsedDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      } else if (parts[0]?.length === 4) {
        parsedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      const tStr = appt.time_slot || appt.scheduled_time || '';
      let hours = 12, minutes = 0;
      if (tStr) {
        const timeParts = tStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeParts) {
          hours = parseInt(timeParts[1], 10);
          minutes = parseInt(timeParts[2], 10);
          const ampm = timeParts[3].toUpperCase();
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        }
      }
      const scheduledDateTime = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), hours, minutes, 0, 0);
      const now = new Date();
      return now.getTime() > scheduledDateTime.getTime() + 30 * 60 * 1000;
    }
  } catch { }
  return false;
}

  const { data: patientAppts } = await supabaseAdmin
    .from("appointments")
    .select("id, doctor_id, slot_id, status, reason, created_at, appointment_date, time_slot, scheduled_at")
    .eq("patient_id", user.id)
    .in("status", ["scheduled", "pending", "booked", "confirmed", "declined", "cancelled", "in_progress", "completed", "missed"])
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
      const isDoctorInRoom = reasonStr.includes('[DOCTOR_IN_ROOM]')
      const isPatientWaiting = reasonStr.includes('[PATIENT_WAITING]')
      const isPatientAdmitted = reasonStr.includes('[PATIENT_ADMITTED]')
      const isCallActive = reasonStr.includes('[CALL_ACTIVE]') || isDoctorInRoom
      const isPendingApproval = reasonStr.includes('[PENDING_APPROVAL]')

      const symptomsMatch = reasonStr.match(/Symptoms:\s*([^\n\r]*)/i)
      const dateMatch = reasonStr.match(/Selected Date:\s*([^\n\r]*)/i) || reasonStr.match(/Preferred Date:\s*([^\n\r]*)/i)
      const timeMatch = reasonStr.match(/Time Slot:\s*([^\n\r]*)/i)
      
      let cleanReason = reasonStr
      const splitIndex = reasonStr.search(/(Symptoms:|Preferred Date:|Selected Date:|Time Slot:)/i)
      if (splitIndex !== -1) {
        cleanReason = reasonStr.substring(0, splitIndex).trim()
      }
      ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]'].forEach(tag => {
        cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '')
      })
      cleanReason = cleanReason.trim()
      
      const parsedDate = dateMatch ? dateMatch[1].trim() : (apt.appointment_date || apt.scheduled_at?.split('T')?.[0] || '')
      const parsedTime = timeMatch ? timeMatch[1].trim() : (apt.time_slot || '12:00 PM')
      const parsedSymptoms = symptomsMatch ? symptomsMatch[1].trim() : ''

      const isPast = isConsultationPast({
        appointment_date: parsedDate,
        time_slot: parsedTime,
        scheduled_at: apt.scheduled_at,
        scheduled_date: apt.appointment_date,
        scheduled_time: apt.time_slot
      })
      const isMissed = apt.status === 'missed' || (isPast && apt.status !== 'completed' && apt.status !== 'declined' && apt.status !== 'cancelled')

      let statusVal = apt.status || 'scheduled'
      if (apt.status === 'completed') {
        statusVal = 'completed'
      } else if (isMissed) {
        statusVal = 'missed'
      } else if (isPatientAdmitted) {
        statusVal = 'patient_admitted'
      } else if (isPatientWaiting) {
        statusVal = 'patient_waiting'
      } else if (isDoctorInRoom) {
        statusVal = 'in_progress'
      } else if (apt.status === 'in_progress') {
        statusVal = 'in_progress'
      } else if (apt.status === 'confirmed') {
        statusVal = 'confirmed'
      } else if (apt.status === 'booked') {
        statusVal = isPendingApproval ? 'pending' : 'scheduled'
      }

      const isLiveValid = !isMissed && statusVal !== 'completed' && statusVal !== 'declined' && statusVal !== 'cancelled'

      return {
        id: apt.id,
        roomId: apt.id,
        appointment_id: apt.id,
        doctor_id: apt.doctor_id,
        doctor: {
          id: apt.doctor_id,
          name: doc.name || 'Dr. Rahul Sharma',
          specialty: doc.specialty || 'General Medicine',
          email: doc.email || ''
        },
        appointment_date: parsedDate || apt.appointment_date,
        time_slot: parsedTime || apt.time_slot,
        scheduled_at: apt.scheduled_at,
        symptoms: parsedSymptoms,
        status: statusVal,
        is_doctor_in_room: isLiveValid && isDoctorInRoom,
        call_active: isLiveValid && (isDoctorInRoom || statusVal === 'in_progress' || isPatientWaiting || isPatientAdmitted),
        reason: cleanReason || 'General Consultation',
        raw_reason: reasonStr,
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

