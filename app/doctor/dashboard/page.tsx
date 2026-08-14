import Link from "next/link"
import { CalendarCheck, Stethoscope } from "lucide-react"

import { requireDoctorVerification } from "@/lib/supabase/doctor-verification"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { DoctorDashboardClient } from "@/components/doctor/doctor-dashboard-client"

export const dynamic = "force-dynamic"

type DoctorProfile = {
  id: string
  name: string | null
  email: string | null
  specialty: string | null
  phone: string | null
  language: string | null
  available_slots: any[] | null
}

export default async function DoctorDashboard() {
  const result = await requireDoctorVerification("approved")
  const supabase = await createSupabaseServerClient()
  const doctorId = result.user.id

  const [{ data: profile }, { count: totalAppointments }, { count: totalPrescriptions }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, email, specialty, phone, language")
      .eq("id", doctorId)
      .maybeSingle(),

    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctorId),

    supabase
      .from("prescriptions")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctorId),
  ])

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const todayDateStr = today.toDateString()

  const [{ data: allAppointments }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, status, created_at, scheduled_at, appointment_date")
      .eq("doctor_id", doctorId),
  ])

  const todayScheduled = (allAppointments ?? []).filter((appt) => {
    const isScheduled = appt.status === "scheduled" || appt.status === "confirmed" || appt.status === "booked"
    if (!isScheduled) return false

    if (appt.appointment_date === todayStr) return true
    if (appt.scheduled_at) {
      const d = new Date(appt.scheduled_at)
      if (!Number.isNaN(d.getTime()) && d.toDateString() === todayDateStr) {
        return true
      }
    }
    return false
  })
  const todayAppointments = todayScheduled.length

  const todayCompleted = (allAppointments ?? []).filter((appt) => {
    const isCompleted = appt.status === "completed"
    if (!isCompleted) return false

    if (appt.appointment_date === todayStr) return true
    if (appt.scheduled_at) {
      const d = new Date(appt.scheduled_at)
      if (!Number.isNaN(d.getTime()) && d.toDateString() === todayDateStr) {
        return true
      }
    }
    if (appt.created_at) {
      const d = new Date(appt.created_at)
      if (!Number.isNaN(d.getTime()) && d.toDateString() === todayDateStr) {
        return true
      }
    }
    return false
  }).length

  const doctorName = profile?.name || result.user.email?.split("@")[0] || "Doctor"

  const greeting = (() => {
    const hour = today.getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  })()

  return (
    <DoctorDashboardClient
      doctorId={doctorId}
      doctorName={doctorName}
      doctorEmail={profile?.email || result.user.email || null}
      doctorSpecialty={profile?.specialty || null}
      applicationStatus={result.application?.status || null}
      totalAppointments={totalAppointments ?? 0}
      totalPrescriptions={totalPrescriptions ?? 0}
      todayAppointments={todayAppointments}
      todayCompleted={todayCompleted}
      greeting={greeting}
    />
  )
}
