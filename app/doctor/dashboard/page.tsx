import Link from "next/link"
import { CalendarCheck, Stethoscope } from "lucide-react"

import { DoctorSlotManager } from "@/components/doctor/doctor-slot-manager"
import { PendingRequestsPanel } from "@/components/doctor/pending-requests-panel"
import { PrescriptionModal } from "@/components/doctor/prescription-modal"
import { LiveMetrics } from "@/components/doctor/live-metrics"
import { requireDoctorVerification } from "@/lib/supabase/doctor-verification"
import { TodayConsultations } from "@/components/doctor/today-consultations"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createSupabaseServerClient } from "@/lib/supabase/server"

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

  const [{ data: allAppointments }, { data: doctorRow }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, status, created_at, scheduled_at, appointment_date")
      .eq("doctor_id", doctorId),

    supabase
      .from("doctors")
      .select("id")
      .eq("id", doctorId)
      .maybeSingle(),
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

  // Slots will load dynamically within the Slot Manager client component

  const doctor: DoctorProfile = {
    id: doctorId,
    name: profile?.name || result.user.email?.split("@")[0] || "Doctor",
    email: profile?.email || result.user.email || null,
    specialty: profile?.specialty || null,
    phone: profile?.phone || null,
    language: profile?.language || null,
    available_slots: null,
  }

  const doctorName = profile?.name || ("Dr. " + (profile?.name || "Doctor"))

  const greeting = (() => {
    const hour = today.getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  })()

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-primary hover:text-primary/90 transition-colors"
            >
              <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                <Stethoscope className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold tracking-tight">CareBridge</span>
            </Link>
            <Badge variant="outline" className="hidden sm:inline-flex">
              Doctor Portal
            </Badge>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Public Site</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/doctor/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/profile">My Profile</Link>
            </Button>
            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="outline" size="sm">Sign out</Button>
            </form>
          </nav>
        </div>
      </header>

      <section className="container mx-auto px-4 pt-8 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{greeting},</p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {doctorName}
              {doctor.specialty && (
                <span className="ml-3 text-base md:text-lg font-medium text-muted-foreground">
                  {doctor.specialty}
                </span>
              )}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {result.application?.status && (
                <Badge variant="secondary" className="font-semibold">
                  Verified &middot; {result.application.status}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {doctor.email ?? result.user.email ?? ""}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/consultation/book">
                <CalendarCheck className="h-4 w-4" /> Book on behalf
              </Link>
            </Button>
            <PrescriptionModal
              doctorId={doctorId}
              triggerLabel="Quick Prescription"
            />
          </div>
        </div>
      </section>

      <LiveMetrics
        doctorId={doctorId}
        initialTotalAppointments={totalAppointments ?? 0}
        initialTotalPrescriptions={totalPrescriptions ?? 0}
        initialTodayAppointments={todayAppointments ?? 0}
        initialTodayCompleted={todayCompleted ?? 0}
      />

      <section className="container mx-auto grid gap-4 px-4 pb-4 lg:grid-cols-[1.2fr_1fr]">
        <PendingRequestsPanel doctorId={doctorId} />
        <DoctorSlotManager doctorId={doctorId} />
      </section>

      <section className="container mx-auto px-4 pb-16">
        <TodayConsultations doctorId={doctorId} />
      </section>
    </main>
  )
}
