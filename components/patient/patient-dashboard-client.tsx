"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Activity, ArrowRight, CalendarDays, FileText, Send, Stethoscope, CheckCircle2, Pill, Video } from "lucide-react"
import { toast } from "sonner"

import { PatientPrescriptionsSection } from "@/components/patient/prescriptions-section"
import { MyConsultationsPanel } from "@/components/patient/my-consultations-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { generatePrescriptionPDF, type PrintablePrescription } from "@/lib/generate-prescription-pdf"
import { Download } from "lucide-react"
import { formatStableDateTime, formatStableDate } from "@/lib/utils"

function formatAppointmentSlot(appt: any) {
  if (appt.appointment_date && appt.time_slot) {
    return `📅 ${appt.appointment_date}  ⏰ ${appt.time_slot}`
  }
  if (appt.scheduled_at) {
    const start = new Date(appt.scheduled_at)
    if (!Number.isNaN(start.getTime())) {
      const datePart = start.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      const timePart = start.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
      return `📅 ${datePart}  ⏰ ${timePart}`
    }
  }
  if (appt.reason) {
    const dateMatch = appt.reason.match(/Selected Date:\s*([\w\d, -]+)/i) || appt.reason.match(/Preferred Date:\s*([\w\d, -]+)/i)
    const timeMatch = appt.reason.match(/Time Slot:\s*([\w\d: ]+)/i)
    if (dateMatch && timeMatch) {
      return `📅 ${dateMatch[1].trim()}  ⏰ ${timeMatch[1].trim()}`
    }
    if (dateMatch) {
      return `📅 ${dateMatch[1].trim()}`
    }
  }
  return "Time not set"
}

type PatientDashboardClientProps = {
  patientId: string
  patientName: string
  patientEmail: string | null | undefined
  initialPrescriptions?: PrintablePrescription[]
  initialAppointments?: any[]
}

export function PatientDashboardClient({
  patientId,
  patientName,
  patientEmail,
  initialPrescriptions = [],
  initialAppointments = [],
}: PatientDashboardClientProps) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [symptoms, setSymptoms] = useState("")
  const [primaryConcern, setPrimaryConcern] = useState("")
  const [bookingDoctorId, setBookingDoctorId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [prescriptions, setPrescriptions] = useState<PrintablePrescription[]>(initialPrescriptions)
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(true)
  const [appointments, setAppointments] = useState<any[]>(initialAppointments)
  const [loadingAppointments, setLoadingAppointments] = useState(initialAppointments.length === 0)

  const upcomingCount = appointments.filter((appt) =>
    appt.status === "scheduled" || appt.status === "confirmed" || appt.status === "booked"
  ).length

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  })()

  const refreshPrescriptions = useCallback(async () => {
    let completed = false
    const safetyTimer = setTimeout(() => {
      if (!completed) {
        setLoadingPrescriptions(false)
      }
    }, 8000)
    try {
      setLoadingPrescriptions(true)
      if (!patientId) {
        setPrescriptions([])
        return
      }
      const res = await fetch(`/api/prescriptions?patient_id=${patientId}`)
      if (!res.ok) throw new Error("Failed to fetch prescriptions")
      
      const payload = await res.json()
      setPrescriptions(payload.prescriptions || [])
    } catch (err) {
      console.error("Prescription fetch error:", err)
      setPrescriptions(initialPrescriptions)
    } finally {
      completed = true
      clearTimeout(safetyTimer)
      setLoadingPrescriptions(false)
    }
  }, [patientId, initialPrescriptions])

  const refreshAppointments = useCallback(async () => {
    try {
      setLoadingAppointments(true)
      const res = await fetch(`/api/patient/appointments?patient_id=${patientId}`)
      if (!res.ok) throw new Error("Failed to fetch appointments")
      
      const payload = await res.json()
      setAppointments(payload.appointments || [])
    } catch (err) {
      console.error(err)
      setAppointments([])
    } finally {
      setLoadingAppointments(false)
    }
  }, [patientId])

  useEffect(() => {
    void refreshAppointments()
  }, [refreshAppointments])

  useEffect(() => {
    const channel = supabase
      .channel(`patient-${patientId}-appointments`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `patient_id=eq.${patientId}` },
        () => {
          void refreshAppointments()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, patientId, refreshAppointments])

  useEffect(() => {
    if (initialPrescriptions.length > 0) {
      setPrescriptions(initialPrescriptions)
      setLoadingPrescriptions(false)
    }
    void refreshPrescriptions()
  }, [refreshPrescriptions, initialPrescriptions])

  useEffect(() => {
    const channel = supabase
      .channel(`patient-${patientId}-prescriptions`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "prescriptions", filter: `patient_id=eq.${patientId}` },
        () => refreshPrescriptions(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, patientId, refreshPrescriptions])

  async function handleRequestConsultation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    const reason = [primaryConcern.trim(), symptoms.trim()].filter(Boolean).join(" — ") || "Patient requested consultation"
    const symptomsPayload = symptoms.trim() || primaryConcern.trim() || null

    try {
      const doctorId = bookingDoctorId.trim() || null

      let slotId: string | null = null
      if (!doctorId) {
        const { data: anyDoctor } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "doctor")
          .limit(1)
          .maybeSingle()
        if (anyDoctor) {
          try {
            const { data: slot, error: slotError } = await supabase
              .from("schedule_slots")
              .insert({
                doctor_id: anyDoctor.id,
                start_time: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
                end_time: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
                is_booked: true,
              })
              .select("id")
              .maybeSingle()
            if (!slotError && slot) slotId = slot.id
          } catch {
          }
        }
      }

      const { error } = await supabase
        .from("appointments")
        .insert({
          patient_id: patientId,
          doctor_id: doctorId,
          slot_id: slotId,
          status: "booked",
          reason,
          symptoms: symptomsPayload,
        })

      if (error) throw error

      setSubmitted(true)
      setSymptoms("")
      setPrimaryConcern("")
      setBookingDoctorId("")
      toast.success("Consultation request submitted! You will receive a confirmation shortly.")

      setTimeout(() => router.push("/consultation/book"), 1500)
    } catch (err) {
      console.error(err)
      toast.error("Unable to submit your request. Please try the booking page directly.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div>
            <Link href="/" className="text-sm font-medium text-primary hover:text-primary/90 transition-colors">
              CareBridge
            </Link>
            <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">
              Welcome back, {patientName}
            </h1>
            {patientEmail && (
              <p className="text-sm text-muted-foreground">{patientEmail}</p>
            )}
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/patient/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/profile">My Profile</Link>
            </Button>
            <Button asChild>
              <Link href="/consultation/book">Book a Doctor</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <section className="mb-6 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-6">
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h2 className="text-xl font-semibold tracking-tight">
            Here&apos;s your CareBridge health overview
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-background/60 p-4">
              <p className="text-xs text-muted-foreground">Active Prescriptions</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{prescriptions.length}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-4">
              <p className="text-xs text-muted-foreground">Upcoming Appointments</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{upcomingCount} Scheduled</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-4">
              <p className="text-xs text-muted-foreground">Last Visit</p>
              <p className="mt-1 text-2xl font-bold tracking-tight" suppressHydrationWarning>
                {prescriptions[0]
                  ? formatStableDate(prescriptions[0].created_at)
                  : "—"}
              </p>
            </div>
          </div>
        </section>

        <Tabs defaultValue="records" className="space-y-6">
          <TabsList className="h-auto w-full justify-start gap-2 bg-muted/30 p-2 sm:w-fit">
            <TabsTrigger value="records" className="gap-2">
              <FileText className="size-4" />Medical Records & Prescriptions
            </TabsTrigger>
            <TabsTrigger value="appointments" className="gap-2">
              <CalendarDays className="size-4" />My Consultations
            </TabsTrigger>
            <TabsTrigger value="care" className="gap-2">
              <Activity className="size-4" />Find Care
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Prescriptions & Records</CardTitle>
                <CardDescription>
                  Your latest digital prescriptions are ready for download and pharmacy use.
                </CardDescription>
              </CardHeader>
            </Card>

            {loadingPrescriptions ? (
              <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                Loading prescriptions...
              </div>
            ) : prescriptions.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/80 bg-gradient-to-br from-muted/40 via-background to-muted/20 p-10 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Pill className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-base font-semibold">No active prescriptions found yet.</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Once your doctor issues one, it will appear here.
                </p>
                <div className="mt-6">
                  <Button asChild className="gap-2">
                    <Link href="/consultation/book">
                      <CalendarDays className="h-4 w-4" /> Book a consultation
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {prescriptions.map((prescription) => (
                  <Card key={prescription.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <Pill className="mt-1 size-5 text-primary" />
                          <div>
                            <CardTitle className="text-lg">
                              {prescription.diagnosis ?? "CareBridge Prescription"}
                            </CardTitle>
                            <CardDescription suppressHydrationWarning>
                              Dr. {prescription.doctor_name || "Rahul Sharma"} &middot;{" "}
                              {formatStableDateTime(prescription.created_at)}
                            </CardDescription>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => generatePrescriptionPDF(prescription)}>
                          <Download className="mr-1.5 h-4 w-4" />
                          Download e-Prescription (PDF)
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground" suppressHydrationWarning>
                      {prescription.instructions || prescription.advice || "Follow prescribed dosage"}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="appointments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Consultation Bookings</CardTitle>
                <CardDescription>
                  View and manage your upcoming and completed doctor consultation requests.
                </CardDescription>
              </CardHeader>
            </Card>

            <MyConsultationsPanel
              appointments={appointments}
              loading={loadingAppointments}
              onRefresh={refreshAppointments}
            />
          </TabsContent>

          <TabsContent value="care" className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <Activity className="size-6 text-primary" />
                <CardTitle className="mt-3">AI Symptom Checker</CardTitle>
                <CardDescription>
                  Describe how you feel and get structured guidance before your next consultation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="gap-2">
                  <Link href="/symptoms">
                    Start symptom check <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Stethoscope className="size-6 text-secondary" />
                <CardTitle className="mt-3">Find a Doctor</CardTitle>
                <CardDescription>
                  Browse available specialists and book a convenient consultation time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/consultation/book">
                    Book consultation <CalendarDays />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Request a Consultation</CardTitle>
                    <CardDescription>
                      Share your symptoms and our care team will match you with a suitable doctor.
                    </CardDescription>
                  </div>
                  {submitted && (
                    <Badge variant="secondary" className="gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Requested
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleRequestConsultation}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium" htmlFor="primary-concern">
                        Primary Concern
                      </label>
                      <Input
                        id="primary-concern"
                        value={primaryConcern}
                        onChange={(e) => setPrimaryConcern(e.target.value)}
                        placeholder="e.g. Fever for last 2 days"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium" htmlFor="symptoms-text">
                        Symptoms (optional)
                      </label>
                      <Textarea
                        id="symptoms-text"
                        value={symptoms}
                        onChange={(e) => setSymptoms(e.target.value)}
                        rows={4}
                        placeholder="List symptoms you're experiencing — cough, body ache, fatigue, etc."
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium" htmlFor="doctor-id">
                        Prefer a specific doctor? (optional — Doctor UUID)
                      </label>
                      <Input
                        id="doctor-id"
                        value={bookingDoctorId}
                        onChange={(e) => setBookingDoctorId(e.target.value)}
                        placeholder="Leave empty for auto-assignment"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Your request is saved to the appointments table with status &quot;scheduled&quot;.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        asChild
                        type="button"
                        variant="outline"
                      >
                        <Link href="/consultation/book">Full booking page</Link>
                      </Button>
                      <Button type="submit" disabled={submitting || submitted} className="gap-2">
                        {submitting ? (
                          "Submitting..."
                        ) : (
                          <>
                            <Send className="h-4 w-4" /> Submit Request
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
