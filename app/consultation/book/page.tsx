"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Calendar, Clock, Stethoscope, CheckCircle2, CalendarDays, AlertCircle, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type VerificationStatus = "pending" | "approved" | "rejected" | null

type DoctorRow = {
  id: string
  name: string | null
  specialty: string | null
  language: string | null
  verification_status: VerificationStatus
  available_slots: Array<{
    label: string
    hour: number
    minute: number
    durationMin: number
  }> | null
  active_slots?: string[]
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

function parseTimeString(timeStr: string): { label: string; hour: number; minute: number; durationMin: number } {
  try {
    const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i)
    if (match) {
      let hour = parseInt(match[1], 10)
      const minute = parseInt(match[2], 10)
      const ampm = match[3].toUpperCase()
      
      if (ampm === "PM" && hour < 12) {
        hour += 12
      } else if (ampm === "AM" && hour === 12) {
        hour = 0
      }
      
      return {
        label: timeStr,
        hour,
        minute,
        durationMin: 45
      }
    }
  } catch (e) {
    console.error("Failed to parse time string:", timeStr, e)
  }
  return { label: timeStr, hour: 12, minute: 0, durationMin: 45 }
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
  const [dateSlots, setDateSlots] = useState<string[]>([])
  const [isLeave, setIsLeave] = useState<boolean>(false)
  const [dateSlotsLoading, setDateSlotsLoading] = useState(false)
  const [bookedSlotsForDate, setBookedSlotsForDate] = useState<string[]>([])

  useEffect(() => {
    if (!selectedDoctor || !selectedDate) {
      setDateSlots([])
      setIsLeave(false)
      return
    }

    let cancelled = false
    setDateSlotsLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/doctors/slots?doctorId=${selectedDoctor}&date=${selectedDate}`)
        if (!res.ok) throw new Error("Failed to fetch slots")
        const json = await res.json()
        if (!cancelled) {
          setIsLeave(json.isLeave || false)
          setDateSlots(json.slots || [])
        }
      } catch (err) {
        console.error("Failed to fetch slots for date:", err)
      } finally {
        if (!cancelled) setDateSlotsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedDoctor, selectedDate])

  useEffect(() => {
    if (!selectedDoctor || !selectedDate) {
      setBookedSlotsForDate([])
      return
    }

    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("time_slot")
        .eq("doctor_id", selectedDoctor)
        .eq("appointment_date", selectedDate)
        .neq("status", "cancelled")

      if (!error && data && !cancelled) {
        setBookedSlotsForDate(data.map((item) => item.time_slot).filter(Boolean) as string[])
      } else {
        setBookedSlotsForDate([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedDoctor, selectedDate, supabase])

  const todayISO = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  }, [])

  const selectedDoctorData = doctors.find((d) => d.id === selectedDoctor) ?? null
  
  const activeSlotsForSelectedDoctor = useMemo(() => {
    if (!selectedDoctorData) return []
    if (!selectedDate) {
      if (Array.isArray(selectedDoctorData.active_slots) && selectedDoctorData.active_slots.length > 0) {
        return selectedDoctorData.active_slots.map((label) => parseTimeString(label))
      }
      return []
    }
    return dateSlots.map((label) => parseTimeString(label))
  }, [selectedDoctorData, selectedDate, dateSlots])

  const noSlotsConfigured = !!selectedDate && activeSlotsForSelectedDoctor.length === 0

  useEffect(() => {
    let cancelled = false
    setDoctorsLoading(true)
    ;(async () => {
      try {
        const res = await fetch("/api/doctors")
        if (!res.ok) throw new Error("Failed to fetch doctors")
        const data = await res.json()
        const doctorsList = data.doctors || []

        if (cancelled) return

        const parsedDoctors: DoctorRow[] = doctorsList.map((d: any) => {
          const slots = Array.isArray(d.active_slots)
            ? d.active_slots.map((label: string) => parseTimeString(label))
            : null

          return {
            id: d.id,
            name: d.name,
            specialty: d.specialty,
            language: d.language || null,
            verification_status: d.verification_status || "approved",
            available_slots: slots,
            active_slots: d.active_slots || []
          }
        })

        setDoctors(parsedDoctors)
      } catch (err) {
        console.error("Failed to load doctor profiles:", err)
      } finally {
        if (!cancelled) setDoctorsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
      const slotIdx = parseInt(selectedSlotIndex, 10)
      const slot = activeSlotsForSelectedDoctor[slotIdx] ?? null
      if (!slot) {
        toast.error("Invalid date or time selected.")
        return
      }

      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        toast.error("Please login before booking.")
        router.push("/login?role=patient")
        return
      }

      const fullReason = symptoms.trim() ? `${reason.trim()}\n\nSymptoms: ${symptoms.trim()}` : reason.trim()

      const res = await fetch("/api/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctor,
          patientId: user.id,
          patientName: name,
          patientEmail: email,
          appointmentDate: selectedDate,
          timeSlot: slot.label,
          reason: fullReason
        })
      })

      const result = await res.json()

      if (!res.ok || result.error) {
        console.error("Booking post error:", result?.error)
        toast.error(`Unable to create appointment request: ${result?.error || "Unknown error"}`)
        return
      }

      setBooked(result.appointmentId)
      toast.success("Consultation request submitted! Your doctor will review it shortly.")
    } catch (err: any) {
      console.error(err)
      toast.error("An error occurred during booking. Please try again.")
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
    activeSlotsForSelectedDoctor,
    supabase,
    router
  ])

  const resetForm = useCallback(() => {
    setBooked(null)
    setSelectedSlotIndex("")
    setReason("")
    setSymptoms("")
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-4">
              <Link href="/">
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
        <div className="max-w-3xl mx-auto space-y-6">
          {booked ? (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-8 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto"/>
              <h2 className="text-2xl font-bold text-white">Consultation Request Sent!</h2>
              <p className="text-slate-300 max-w-md mx-auto">
                Your request for {selectedDate} at {activeSlotsForSelectedDoctor[parseInt(selectedSlotIndex, 10)]?.label || ""} with Dr. {selectedDoctorData?.name || "Doctor"} has been submitted.
              </p>
              <div className="flex justify-center gap-4 pt-4">
                <Button asChild className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  <Link href="/patient/dashboard">Go to My Dashboard</Link>
                </Button>
                <Button onClick={resetForm} variant="outline">
                  Book Another
                </Button>
              </div>
            </div>
          ) : (
            <>
          <Card>
            <CardHeader>
              <CardTitle>Select Doctor and Time</CardTitle>
              <CardDescription>
                Choose a verified doctor, a preferred date, and one of the available time slots.
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
                      {doctorsLoading ? (
                        <div className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading doctors...
                        </div>
                      ) : doctors.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No doctors available yet
                        </SelectItem>
                      ) : (
                        doctors.map((d) => {
                          const approved = d.verification_status === "approved"
                          const pending = d.verification_status === "pending"
                          return (
                            <SelectItem key={d.id} value={d.id}>
                              <div className="flex flex-wrap items-center gap-2 py-0.5">
                                <Stethoscope className="h-4 w-4 text-primary" />
                                <span className="font-medium">Dr. {d.name ?? "Unnamed"}</span>
                                {d.specialty && (
                                  <span className="text-muted-foreground">
                                    — {d.specialty}
                                  </span>
                                )}
                                {approved && (
                                  <Badge variant="outline" className="ml-1 font-normal border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                                  </Badge>
                                )}
                                {pending && (
                                  <Badge variant="outline" className="ml-1 font-normal border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                    <Clock className="h-3 w-3 mr-1" /> Pending
                                  </Badge>
                                )}
                                {d.language && (
                                  <Badge variant="secondary" className="ml-1 font-normal">
                                    {d.language}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          )
                        })
                      )}
                    </SelectContent>
                  </Select>
                  {selectedDoctorData && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Showing {activeSlotsForSelectedDoctor.length} time slots
                      {selectedDoctorData.verification_status === "approved" ? " for this verified doctor." : "."}
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
                    disabled={!selectedDate || activeSlotsForSelectedDoctor.length === 0 || isLeave}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !selectedDoctor
                            ? "Pick a doctor first"
                            : !selectedDate
                              ? "Pick a date first"
                              : isLeave
                                ? "Doctor is on leave"
                                : noSlotsConfigured
                                  ? "No slots configured"
                                  : "Select a time"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSlotsForSelectedDoctor.length === 0 && (
                        <SelectItem value="none" disabled>
                          {selectedDate
                            ? isLeave
                              ? "Doctor is on leave on this date"
                              : "Doctor has no available consultation hours on this date"
                            : "Doctor has not set availability yet"}
                        </SelectItem>
                      )}
                      {activeSlotsForSelectedDoctor.map((s, idx) => {
                        const isSlotBooked = bookedSlotsForDate.includes(s.label)
                        return (
                          <SelectItem key={s.label + idx} value={String(idx)} disabled={isSlotBooked}>
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-2 text-primary" />
                              {s.label} {isSlotBooked ? "(Booked)" : ""}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border bg-muted/30 p-4 md:col-span-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    {selectedDoctor ? `Available slots for ${selectedDoctorData?.name ?? "selected doctor"}` : "Standard clinic hours"}
                  </p>
                  {isLeave ? (
                    <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-warning-foreground text-amber-700 dark:text-amber-300 font-medium">
                      <span>⚠️ Dr. {selectedDoctorData?.name ?? "selected doctor"} is on leave on this date. Please pick another date.</span>
                    </div>
                  ) : noSlotsConfigured ? (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Doctor has no available consultation hours on this date.</span>
                    </div>
                  ) : dateSlotsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading doctor slots...
                    </div>
                  ) : doctorsLoading && !selectedDoctor ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading doctor schedule...
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {activeSlotsForSelectedDoctor && activeSlotsForSelectedDoctor.length > 0 ? (
                        activeSlotsForSelectedDoctor.map((s, idx) => {
                          const isSlotBooked = bookedSlotsForDate.includes(s.label)
                          const isDisabled = !selectedDate || isSlotBooked
                          const active = selectedSlotIndex === String(idx)

                          let chipClass = "px-3 py-2 rounded-lg text-xs font-medium border transition-all "
                          if (isDisabled) {
                            chipClass += "opacity-40 cursor-not-allowed bg-slate-900/50 text-slate-500 border-slate-800 line-through decoration-slate-600"
                          } else if (active) {
                            chipClass += "bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-400 font-semibold"
                          } else {
                            chipClass += "bg-slate-800/80 text-slate-200 border-slate-700 hover:border-emerald-500/50"
                          }

                          return (
                            <button
                              key={s.label + idx}
                              type="button"
                              onClick={() => setSelectedSlotIndex(String(idx))}
                              disabled={isDisabled}
                              className={chipClass}
                            >
                              <Clock className="h-3 w-3 inline mr-1.5 align-[-2px]" />
                              {s.label}
                            </button>
                          )
                        })
                      ) : (
                        <div className="text-amber-400 text-sm py-2">
                          Doctor has no available consultation hours on this date.
                        </div>
                      )}
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
                  disabled={!selectedDoctor || !selectedDate || selectedSlotIndex === "" || !reason || booking || !!booked || noSlotsConfigured || isLeave}
                  className="gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  {booking ? "Submitting..." : booked ? "Sent!" : "Request Consultation"}
                </Button>
              </div>
            </CardContent>
          </Card>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
