import Link from "next/link"
import { CalendarCheck, ClipboardList, FileText, Stethoscope, Users } from "lucide-react"

import { PrescriptionModal } from "@/components/doctor/prescription-modal"
import { requireDoctorVerification } from "@/lib/supabase/doctor-verification"
import { TodayConsultations } from "@/components/doctor/today-consultations"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type DoctorProfile = {
  id: string
  name: string | null
  email: string | null
  specialty: string | null
  phone: string | null
  language: string | null
}

type DashboardMetrics = {
  totalAppointments: number
  totalPrescriptions: number
  todayAppointments: number
  todayCompleted: number
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
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

  const [{ count: todayAppointments }, { count: todayCompleted }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      .gte("created_at", startOfToday.toISOString())
      .lt("created_at", startOfTomorrow.toISOString()),

    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      .eq("status", "completed")
      .gte("created_at", startOfToday.toISOString())
      .lt("created_at", startOfTomorrow.toISOString()),
  ])

  const doctor = (profile ?? {
    id: doctorId,
    name: result.user.email?.split("@")[0] ?? "Doctor",
    email: result.user.email,
    specialty: null,
    phone: null,
    language: null,
  }) as DoctorProfile

  const metrics: DashboardMetrics = {
    totalAppointments: totalAppointments ?? 0,
    totalPrescriptions: totalPrescriptions ?? 0,
    todayAppointments: todayAppointments ?? 0,
    todayCompleted: todayCompleted ?? 0,
  }

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
            <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/90 transition-colors">
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
              {doctor.name ?? "Doctor"}
              {doctor.specialty && (
                <span className="ml-3 text-base md:text-lg font-medium text-muted-foreground">
                  {doctor.specialty}
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {doctor.email ?? result.user.email ?? ""}
              {result.application?.status && (
                <Badge variant="secondary" className="ml-3">
                  Verified &middot; {result.application.status}
                </Badge>
              )}
            </p>
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

      <section className="container mx-auto grid gap-4 px-4 pb-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Appointments</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{metrics.totalAppointments}</p>
                <p className="mt-1 text-xs text-muted-foreground">All-time consultation count</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Prescriptions Issued</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{metrics.totalPrescriptions}</p>
                <p className="mt-1 text-xs text-muted-foreground">Lifetime digital prescriptions</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10">
                <FileText className="h-5 w-5 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today&apos;s Schedule</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{metrics.todayAppointments}</p>
                <p className="mt-1 text-xs text-muted-foreground">Appointments booked today</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10">
                <CalendarCheck className="h-5 w-5 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed Today</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{metrics.todayCompleted}</p>
                <p className="mt-1 text-xs text-muted-foreground">Consultations marked done</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
                <ClipboardList className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <TodayConsultations doctorId={doctorId} />
      </section>
    </main>
  )
}
