"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import {
  CalendarRange,
  Clock,
  Trash2,
  Calendar,
  CalendarOff,
  CalendarCheck,
  Stethoscope,
  MessageSquare,
  Download,
  Activity
} from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { generatePrescriptionPDF } from "@/lib/generate-prescription-pdf"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PrescriptionModal } from "@/components/doctor/prescription-modal"
import { LiveMetrics } from "@/components/doctor/live-metrics"
import { PendingRequestsPanel } from "@/components/doctor/pending-requests-panel"
import { TodayConsultations } from "@/components/doctor/today-consultations"
import { DoctorSlotManager } from "@/components/doctor/doctor-slot-manager"

type DoctorDashboardClientProps = {
  doctorId: string
  doctorName: string
  doctorEmail: string | null
  doctorSpecialty: string | null
  applicationStatus: string | null
  totalAppointments: number
  totalPrescriptions: number
  todayAppointments: number
  todayCompleted: number
  greeting: string
}

const dayLabels = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
]

export function DoctorDashboardClient({
  doctorId,
  doctorName,
  doctorEmail,
  doctorSpecialty,
  applicationStatus,
  totalAppointments,
  totalPrescriptions,
  todayAppointments,
  todayCompleted,
  greeting
}: DoctorDashboardClientProps) {
  const router = useRouter()
  const { signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [savedSchedule, setSavedSchedule] = useState<any[]>([])

  const handleSignOut = async (e: React.FormEvent) => {
    e.preventDefault()
    if (signingOut) return
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    router.push("/")
  }
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  // EHR Portal state variables
  const [patientQuery, setPatientQuery] = useState("")
  const [patients, setPatients] = useState<any[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null)

  const searchPatients = useCallback(async (q: string = "") => {
    try {
      setLoadingPatients(true)
      const res = await fetch(`/api/doctor/patients?doctor_id=${doctorId}&q=${q}`)
      if (!res.ok) throw new Error("Failed to search patients")
      const data = await res.json()
      setPatients(data.patients || [])
      
      // Keep selected patient profile in sync if details change
      if (selectedPatient) {
        const updatedSelected = (data.patients || []).find((p: any) => p.patient_id === selectedPatient.patient_id)
        if (updatedSelected) {
          setSelectedPatient(updatedSelected)
        }
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to load patient history records.")
    } finally {
      setLoadingPatients(false)
    }
  }, [doctorId, selectedPatient])

  const handlePatientSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void searchPatients(patientQuery)
  }

  // Load patient list on component mount
  useEffect(() => {
    void searchPatients()
  }, [])

  // Load saved schedule presets with local storage caching
  useEffect(() => {
    if (!doctorId) return

    // 1. Instant load from local storage
    const cached = localStorage.getItem(`doctor_schedule_${doctorId}`)
    if (cached) {
      try {
        setSavedSchedule(JSON.parse(cached))
        setLoadingSchedule(false)
      } catch (_) {}
    }

    // 2. Fetch from DB
    fetch(`/api/doctor/schedule?doctor_id=${doctorId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.presets && data.presets.length > 0) {
          setSavedSchedule(data.presets)
          localStorage.setItem(`doctor_schedule_${doctorId}`, JSON.stringify(data.presets))
        }
      })
      .catch((err) => console.error("Error loading schedule:", err))
      .finally(() => {
        setLoadingSchedule(false)
      })
  }, [doctorId])

  const deletePresetItem = async (index: number) => {
    try {
      const updated = savedSchedule.filter((_, idx) => idx !== index)
      const res = await fetch("/api/doctor/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_id: doctorId, presets: updated })
      })
      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || "Failed to remove item")
      }
      setSavedSchedule(updated)
      localStorage.setItem(`doctor_schedule_${doctorId}`, JSON.stringify(updated))
      toast.success("Schedule item removed.")
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to delete schedule item.")
    }
  }

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
            <form onSubmit={handleSignOut}>
              <Button type="submit" disabled={signingOut} variant="outline" size="sm">
                {signingOut ? "Signing out..." : "Sign out"}
              </Button>
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
              {doctorSpecialty && (
                <span className="ml-3 text-base md:text-lg font-medium text-muted-foreground">
                  {doctorSpecialty}
                </span>
              )}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {applicationStatus && (
                <Badge variant="secondary" className="font-semibold">
                  Verified &middot; {applicationStatus}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {doctorEmail || ""}
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
        initialTotalAppointments={totalAppointments}
        initialTotalPrescriptions={totalPrescriptions}
        initialTodayAppointments={todayAppointments}
        initialTodayCompleted={todayCompleted}
      />

      <section className="container mx-auto grid gap-4 px-4 pb-4 lg:grid-cols-[1.2fr_1fr]">
        <PendingRequestsPanel doctorId={doctorId} />
        
        {/* Schedule & Leave Manager Card UI */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-primary" /> Schedule & Leave Manager
                </CardTitle>
                <CardDescription>
                  Configure templates, specific date overrides, and leaves for patient booking.
                </CardDescription>
              </div>
              
              <Button className="gap-2" onClick={() => setModalOpen(true)}>
                <Clock className="h-4 w-4" /> Set Availability
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            {loadingSchedule ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-6">
                <Clock className="h-4 w-4 animate-spin" /> Loading schedule configurations...
              </div>
            ) : savedSchedule.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                <Clock className="h-6 w-6 text-muted-foreground/60" />
                No custom schedule configurations saved.
                <Button variant="link" size="sm" onClick={() => setModalOpen(true)} className="text-underline mt-1">
                  Click here to set your schedule →
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Active Configurations</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {savedSchedule.map((item: any, idx: number) => {
                      const isLeavePreset = item.slots && item.slots.length === 0;
                      return (
                        <div key={idx} className={`flex items-center justify-between border rounded-lg p-3 ${
                          isLeavePreset ? "border-amber-500/20 bg-amber-500/5" : "bg-muted/10"
                        }`}>
                          <div>
                            <span className="text-sm font-semibold block">{item.interval}</span>
                            {isLeavePreset ? (
                              <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold border-amber-500/20 mt-1">
                                Leave / Unavailable
                              </Badge>
                            ) : (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {item.slots && item.slots.map((slot: string) => {
                                  let displaySlot = slot;
                                  if (slot.includes('T') || (slot.includes('-') && slot.includes(':'))) {
                                    const d = new Date(slot);
                                    if (!isNaN(d.getTime())) {
                                      displaySlot = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    }
                                  }
                                  return (
                                    <span key={slot} className="text-xs font-semibold px-3 py-1.5 bg-slate-800 text-emerald-400 border border-slate-700 rounded-lg inline-block">
                                      {displaySlot}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {item.updated_at && (
                              <span className="text-[9px] text-muted-foreground block mt-1">
                                Updated {new Date(item.updated_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                            onClick={() => deletePresetItem(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <TodayConsultations doctorId={doctorId} />
      </section>

      {/* Patient Medical History & EHR Search Portal Section */}
      <section className="container mx-auto px-4 pb-16">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🩺 Patient Medical History & EHR Search Portal
            </CardTitle>
            <CardDescription>
              Search patients by Name, Email, or Blood Group to view complete clinical timelines.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePatientSearchSubmit} className="flex gap-2 mb-6">
              <Input
                type="text"
                placeholder="Search patient by name, email, or blood group..."
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                className="max-w-md bg-muted/40"
              />
              <Button type="submit">Search</Button>
              {patientQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPatientQuery("");
                    void searchPatients("");
                  }}
                >
                  Clear
                </Button>
              )}
            </form>

            <div className="grid gap-6 md:grid-cols-[1fr_2.2fr]">
              {/* Left Column: Patients List */}
              <div className="border rounded-xl p-3 bg-muted/10 max-h-[500px] overflow-y-auto space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-3 px-1">
                  Patients ({patients.length})
                </span>
                
                {loadingPatients ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Loading records...
                  </div>
                ) : patients.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No matching patients found.
                  </div>
                ) : (
                  patients.map((p) => {
                    const isSelected = selectedPatient?.patient_id === p.patient_id
                    return (
                      <div
                        key={p.patient_id}
                        onClick={() => setSelectedPatient(p)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary-foreground"
                            : "border-border hover:bg-muted/40 text-foreground"
                        }`}
                      >
                        <span className="font-semibold block text-sm">{p.name}</span>
                        <span className="text-xs text-muted-foreground block truncate">{p.email}</span>
                        <div className="flex justify-between items-center mt-2 text-[10px] text-muted-foreground">
                          <span>Blood: {p.blood_group}</span>
                          <span>Visits: {p.total_visits}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Right Column: Selected Patient Details & Medical History Timeline */}
              <div className="border rounded-xl p-5 bg-card min-h-[400px]">
                {selectedPatient ? (
                  <div className="space-y-6">
                    {/* Patient Header Bio */}
                    <div className="border-b pb-4">
                      <h3 className="text-2xl font-bold tracking-tight text-foreground">{selectedPatient.name}</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                        <div className="bg-muted/30 p-2.5 rounded-lg">
                          <span className="text-muted-foreground block font-medium">Age / Gender</span>
                          <span className="font-semibold text-sm mt-0.5 block">{selectedPatient.age} yrs / {selectedPatient.gender}</span>
                        </div>
                        <div className="bg-muted/30 p-2.5 rounded-lg">
                          <span className="text-muted-foreground block font-medium">Blood Group</span>
                          <span className="font-semibold text-sm mt-0.5 block text-rose-500">{selectedPatient.blood_group}</span>
                        </div>
                        <div className="bg-muted/30 p-2.5 rounded-lg">
                          <span className="text-muted-foreground block font-medium">Phone Number</span>
                          <span className="font-semibold text-sm mt-0.5 block">{selectedPatient.phone}</span>
                        </div>
                        <div className="bg-muted/30 p-2.5 rounded-lg">
                          <span className="text-muted-foreground block font-medium">Patient UUID</span>
                          <span className="font-semibold text-[10px] mt-1 block truncate text-muted-foreground">{selectedPatient.patient_id}</span>
                        </div>
                      </div>
                    </div>

                    {/* Medical timeline splitting */}
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Consultation History Timeline */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Consultation History ({selectedPatient.appointments.length})</h4>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {selectedPatient.appointments.map((appt: any, idx: number) => {
                            const dateObj = new Date(appt.scheduled_at || appt.appointment_date)
                            return (
                              <div key={idx} className="border rounded-lg p-3 bg-muted/10 space-y-1 text-xs">
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold text-[11px] text-muted-foreground">
                                    {isNaN(dateObj.getTime()) ? "Scheduled slot" : dateObj.toLocaleDateString()}
                                  </span>
                                  <Badge variant="outline" className="text-[9px] uppercase">
                                    {appt.status}
                                  </Badge>
                                </div>
                                <p className="text-foreground font-medium">{appt.reason || "General Checkup"}</p>
                                {appt.symptoms && (
                                  <p className="text-[10px] text-muted-foreground bg-muted/20 p-1.5 rounded">
                                    <span className="font-semibold">Symptoms:</span> {appt.symptoms}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Prescriptions & Diagnosis history */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prescribed Diagnoses ({selectedPatient.prescriptions.length})</h4>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {selectedPatient.prescriptions.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-4">No historical prescriptions issued by you.</p>
                          ) : (
                            selectedPatient.prescriptions.map((rx: any, idx: number) => {
                              const dateObj = new Date(rx.created_at)
                              return (
                                <div key={idx} className="border rounded-lg p-3 bg-muted/10 space-y-1 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold text-[11px] text-muted-foreground">
                                      {isNaN(dateObj.getTime()) ? "Issued" : dateObj.toLocaleDateString()}
                                    </span>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-primary hover:bg-primary/10"
                                      onClick={() => generatePrescriptionPDF({
                                        ...rx,
                                        doctor_name: doctorName
                                      })}
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <p className="text-foreground font-semibold">{rx.diagnosis || "General Consultation"}</p>
                                  <p className="text-[10px] text-muted-foreground line-clamp-3">
                                    {rx.advice || rx.instructions || rx.note || "No advice notes."}
                                  </p>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center h-full text-sm text-muted-foreground py-20 space-y-2">
                    <Activity className="h-10 w-10 text-muted-foreground/40" />
                    <p className="font-medium text-foreground">No Patient Selected</p>
                    <p className="max-w-xs text-xs">Select a patient from the search list to view their complete Electronic Health Record (EHR) timeline.</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Availability Configuration Dialog Component */}
      <DoctorSlotManager
        doctorId={doctorId}
        open={modalOpen}
        onOpenChange={setModalOpen}
        savedSchedule={savedSchedule}
        onSuccess={(updatedPresets) => {
          setSavedSchedule(updatedPresets)
        }}
      />
    </main>
  )
}
