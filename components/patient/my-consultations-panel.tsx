"use client"

import React from "react"
import Link from "next/link"
import { CalendarDays, Video } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Appointment = {
  id: string
  doctor_id: string | null
  scheduled_at: string | null
  appointment_date: string | null
  time_slot: string | null
  status: string | null
  reason: string | null
  symptoms: string | null
  created_at: string
  doctor: {
    id: string
    name: string | null
    email: string | null
    specialty: string | null
  } | null
}

type MyConsultationsPanelProps = {
  appointments: Appointment[]
  loading: boolean
}

export function MyConsultationsPanel({ appointments, loading }: MyConsultationsPanelProps) {
  if (loading) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        Loading consultations...
      </div>
    )
  }

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/80 bg-gradient-to-br from-muted/40 via-background to-muted/20 p-10 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CalendarDays className="h-7 w-7 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          No upcoming consultations found.{" "}
          <Link href="/consultation/book" className="text-primary hover:underline font-semibold">
            Book a Doctor
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {appointments.map((apt) => {
        const doctor = apt.doctor || { name: "Doctor", specialty: "General Medicine" }
        const doctorName = doctor.name || "Doctor"
        const specialty = doctor.specialty || "General Medicine"

        // Format appointment slot: 📅 ${apt.appointment_date || apt.scheduled_at} | ⏰ ${apt.time_slot || "Slot"}
        const datePart = apt.appointment_date || (apt.scheduled_at ? new Date(apt.scheduled_at).toLocaleDateString() : "") || "Date not set"
        const timePart = apt.time_slot || (apt.scheduled_at ? new Date(apt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "") || "Slot"

        const isScheduled = apt.status === "scheduled" || apt.status === "confirmed" || apt.status === "booked"
        const isPending = apt.status === "pending" || apt.status === "requested"

        return (
          <Card key={apt.id} className="overflow-hidden border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-semibold">
                      Dr. {doctorName} — {specialty}
                    </h4>
                    {isScheduled && (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 gap-1 font-medium">
                        ✅ Confirmed / Scheduled
                      </Badge>
                    )}
                    {isPending && (
                      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1 font-medium">
                        ⏳ Pending Doctor Review
                      </Badge>
                    )}
                    {!isScheduled && !isPending && apt.status && (
                      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive gap-1 capitalize font-medium">
                        {apt.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>📅 {datePart} | ⏰ {timePart}</span>
                    <span>Created on {new Date(apt.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-foreground/80 pt-1">
                    <span className="font-semibold text-foreground">Reason/Symptoms:</span>{" "}
                    {apt.reason || apt.symptoms || "Consultation Request"}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  {isScheduled && (
                    <Button asChild size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Link href={`/consultation/room/${apt.id}`}>
                        <Video className="h-4 w-4" /> Join Video Call
                      </Link>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/consultation/book?doctor=${apt.doctor_id || ""}`}>
                      Book Again
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
