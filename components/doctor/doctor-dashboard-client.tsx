"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarRange,
  Clock,
  Trash2,
  Calendar,
  CalendarOff,
  CalendarCheck,
  Stethoscope,
  MessageSquare
} from "lucide-react"
import { toast } from "sonner"

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
  const [savedSchedule, setSavedSchedule] = useState<any[]>([])
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

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
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {item.slots && item.slots.map((slot: string) => (
                                  <Badge key={slot} variant="outline" className="text-[10px] bg-slate-800 text-slate-200 border-slate-700">
                                    {slot}
                                  </Badge>
                                ))}
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
