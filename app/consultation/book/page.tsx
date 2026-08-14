"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Calendar, Clock, Stethoscope, CheckCircle2, CalendarDays, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type DoctorRow = {
  id: string
  name: string | null
  specialty: string | null
  languages: string[] | null
  available_slots: Array<{
    label: string
    hour: number
    minute: number
    durationMin: number
  }> | null
}

const FALLBACK_SLOTS: Array<{
  label: string
  hour: number
  minute: number
  durationMin: number
}> = [
  { label: "09:00 AM", hour: 9, minute: 0, durationMin: 45 },
  { label: "10:30 AM", hour: 10, minute: 30, durationMin: 45 },
  { label: "12:00 PM", hour: 12, minute: 0, durationMin: 45 },
  { label: "02:30 PM", hour: 14, minute: 30, durationMin: 45 },
  { label: "04:00 PM", hour: 16, minute: 0, durationMin: 45 },
  { label: "05:30 PM", hour: 17, minute: 30, durationMin: 45 },
  { label: "07:00 PM", hour: 19, minute: 0, durationMin: 45 },
  { label: "08:30 PM", hour: 20, minute: 30, durationMin: 45 },
]

function buildSlotDate(date: string | null, slot: { hour: number; minute: number; durationMin: number } | null): {
  start: Date
  end: Date
} | null {
  if (!date || !slot) return null
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10))
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null
  const start = new Date(y, m - 1, d, slot.hour, slot.minute, 0, 0)
  const end = new Date(start.getTime() + slot.durationMin * 60 * 1000)
  return { start, end }
}

export default function BookConsultationPage() {
  const router = useRouter()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [doctors, setDoctors] = useState<DoctorRow[]>([])
  const [doctorsLoading, setDoctorsLoading] = useState(true)
  const [selectedDoctor, setSelectedDoctor] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<string>("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [reason, setReason] = useState("")
  const [symptoms, setSymptoms] = useState("")
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState<string | null>(null)

  const todayISO = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  }, [])

  const selectedDoctorData = doctors.find((d) => d.id === selectedDoctor) ?? null
  const activeSlotsForSelectedDoctor = useMemo(() => {
    if (!selectedDoctorData) return []
    if (Array.isArray(selectedDoctorData.available_slots) && selectedDoctorData.available_slots.length > 0) {
      return selectedDoctorData.available_slots
    }
    return FALLBACK_SLOTS
  }, [selectedDoctorData])

  useEffect(() => {
    let cancelled = false
    setDoctorsLoading(true)
    ;(async () => {
      try {
        const [{ data: profileDoctors }, { data: drRaw }] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, name, specialty, languages, available_slots")
            .eq("role", "doctor")
            .order("name", { nullsFirst: false }),
          supabase.from("doctors").select("id, specialty, languages, available_slots, profiles(name)"),
        ])

        if (cancelled) return
        const profileMap = new Map<string, DoctorRow>()
        for (const row of (profileDoctors ?? []) as Array<{
          id: string
          name: string | null
          specialty: string | null
          languages: string | string[] | null
          available_slots: DoctorRow["available_slots"] | null
        }>) {
          const languages = Array.isArray(row.languages)
            ? row.languages
            : row.languages
              ? (JSON.parse(String(row.languages)) as string[])
              : null
          profileMap.set(row.id, {
            id: row.id,
            name: row.name ?? null,
            specialty: row.specialty ?? null,
            languages,
            available_slots: Array.isArray(row.available_slots) ? row.available_slots : null,
          })
        }

        for (const raw of (drRaw ?? []) as unknown as Array<{
          id: string
          specialty: string | null
          languages: string | string[] | null
          available_slots: DoctorRow["available_slots"] | null
          profiles: { name: string | null } | { name: string | null }[] | null
        }>) {
          const profileArr = Array.isArray(raw.profiles) ? raw.profiles : null
          const profileObj = !Array.isArray(raw.profiles) ? raw.profiles : null
          const profileName = profileArr?.[0]?.name ?? profileObj?.name ?? null
          const existing = profileMap.get(raw.id)
          const languages = Array.isArray(raw.languages)
            ? raw.languages
            : raw.languages
              ? (JSON.parse(String(raw.languages)) as string[])
              : null
          profileMap.set(raw.id, {
            id: raw.id,
            name: profileName ?? existing?.name ?? null,
            specialty: raw.specialty ?? existing?.specialty ?? null,
            languages: languages ?? existing?.languages,
            available_slots: Array.isArray(raw.available_slots)
              ? raw.available_slots
              : existing?.available_slots ?? null,
          })
        }

        setDoctors(Array.from(profileMap.values()))
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setDoctorsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return
      if (user.email) setEmail(user.email)
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, email, phone")
        .eq("id", user.id)
        .maybeSingle()
      if (cancelled || !profile) return
      if (profile.name) setName(profile.name)
      if (profile.email && !email) setEmail(profile.email)
      if (profile.phone) setPhone(profile.phone)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, email])

  const handleBook = useCallback(async () => {
    if (!selectedDoctor || !selectedDate || selectedSlotIndex === "" || !reason) {
      toast.error("Please complete the required fields: doctor, date, time, and reason.")
      return
    }
    setBooking(true)
    try {
      const slot = activeSlotsForSelectedDoctor[parseInt(selectedSlotIndex, 10)] ?? null
      const range = buildSlotDate(selectedDate, slot)
      if (!range) {
        toast.error("Invalid date or time selected.")
        return
      }

      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        toast.error("Please login before booking.")
        router.push("/login?role=patient")
        return
      }

      let slotId: string | null = null
      try {
        const { data: existingSlot } = await supabase
          .from("schedule_slots")
          .select("id, is_booked")
          .eq("doctor_id", selectedDoctor)
          .gte("start_time", range.start.toISOString())
          .lt("end_time", range.end.toISOString())
          .maybeSingle()
        slotId = (existingSlot as any)?.id ?? null
      } catch {
      }

      if (!slotId) {
        try {
          const { data: newSlot } = await supabase
            .from("schedule_slots")
            .insert({
              doctor_id: selectedDoctor,
              start_time: range.start.toISOString(),
              end_time: range.end.toISOString(),
              is_booked: false,
            })
            .select("id")
            .maybeSingle()
          slotId = (newSlot as any)?.id ?? null
        } catch (createErr) {
          console.warn("slot creation failed, continuing without slot_id", createErr)
        }
      }

      const appointmentPayload: any = {
        patient_id: user.id,
        doctor_id: selectedDoctor,
        slot_id: slotId,
        reason,
        symptoms: symptoms || reason,
        status: "pending",
        patient_info: { name, email, phone },
      }

      const { data: appt, error: apptErr } = await supabase
        .from("appointments")
        .insert(appointmentPayload)
        .select("id")
        .maybeSingle()

      if (apptErr || !appt) {
        console.error(apptErr)
        toast.error("Unable to create your request. Please try again.")
        return
      }

      setBooked(appt.id)
      toast.success("Consultation request submitted! Your doctor will review it shortly.")
      setTimeout(() => {
        router.push(`/consultation/${appt.id}`)
      }, 1500)
    } finally {
      setBooking(false)
    }
  }, [
    selectedDoctor,
    selectedDate,
    selectedSlotIndex,
    reason,
    symptoms,
    name,
    email,
    phone,
    supabase,
    router,
    activeSlotsForSelectedDoctor,
  ])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-4">
              <Link href="/?stay_home=1">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <Stethoscope className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-bold text-foreground">Book Appointment</h1>
              </div>
            </div>
            <Link href="/patient/dashboard">
              <Button variant="outline" size="sm">
                <CalendarDays className="w-4 h-4 mr-2" /> My Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {booked && (
          <div className="mx-auto max-w-3xl mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
            Request sent! Redirecting you to the consultation details...
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Doctor and Time</CardTitle>
              <CardDescription>
                Choose a doctor, a date, and one of their available time slots.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-foreground mb-2 block">Doctor</label>
                  <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                    <SelectTrigger>
                      <SelectValue placeholder={doctorsLoading ? "Loading doctors..." : "Select a doctor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.length === 0 && (
                        <SelectItem value="none" disabled>
                          No doctors available yet
                        </SelectItem>
                      )}
                      {doctors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          <div className="flex items-center gap-2">
                            <Stethoscope className="h-4 w-4 text-primary" />
                            <span>Dr. {d.name ?? "Unnamed"}</span>
                            {d.specialty && (
                              <Badge variant="outline" className="ml-1 font-normal">
                                {d.specialty}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedDoctorData && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Showing {activeSlotsForSelectedDoctor.length} time slots configured by this doctor.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground mb-2 block">Preferred Date</label>
                  <Input
                    type="date"
                    min={todayISO}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground mb-2 block">Available Slots</label>
                  <Select
                    value={selectedSlotIndex}
                    onValueChange={setSelectedSlotIndex}
                    disabled={!selectedDate || activeSlotsForSelectedDoctor.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !selectedDoctor
                            ? "Pick a doctor first"
                            : !selectedDate
                              ? "Pick a date first"
                              : activeSlotsForSelectedDoctor.length === 0
                                ? "No slots configured"
                                : "Select a time"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSlotsForSelectedDoctor.length === 0 && (
                        <SelectItem value="none" disabled>
                          Doctor has not set availability yet
                        </SelectItem>
                      )}
                      {activeSlotsForSelectedDoctor.map((slot, idx) => (
                        <SelectItem key={slot.label + idx} value={String(idx)}>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-2 text-primary" />
                            {slot.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border bg-muted/30 p-4 md:col-span-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    {selectedDoctor ? `Available slots for ${selectedDoctorData?.name ?? "selected doctor"}` : "Standard clinic hours"}
                  </p>
                  {doctorsLoading && !selectedDoctor ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading doctor schedule...
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(activeSlotsForSelectedDoctor || FALLBACK_SLOTS).map((slot, idx) => {
                        const active = selectedSlotIndex === String(idx)
                        return (
                          <button
                            type="button"
                            key={slot.label + idx}
                            onClick={() => setSelectedSlotIndex(String(idx))}
                            disabled={!selectedDate}
                            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "hover:bg-background disabled:opacity-50"
                            }`}
                          >
                            <Clock className="h-3 w-3 inline mr-1.5 align-[-2px]" />
                            {slot.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Patient & Consultation Details</CardTitle>
              <CardDescription>Review your details and describe what&apos;s bothering you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Phone (optional)</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98000 12345" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Reason for visit</label>
                  <Textarea
                    rows={2}
                    placeholder="e.g. Persistent headache & mild fever for 3 days"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Other symptoms (optional)</label>
                  <Textarea
                    rows={3}
                    placeholder="List any other symptoms, medical history, or medications"
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Request saved with status &quot;pending&quot; — doctor will confirm the slot shortly.
                </div>
                <Button
                  onClick={handleBook}
                  disabled={!selectedDoctor || !selectedDate || selectedSlotIndex === "" || !reason || booking || !!booked}
                  className="gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  {booking ? "Submitting..." : booked ? "Sent!" : "Request Consultation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
