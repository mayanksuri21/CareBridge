"use client"

import React from "react"
import Link from "next/link"
import { CalendarDays, Video } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatStableDate } from "@/lib/utils"
import { toast } from "sonner"

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
  onRefresh?: () => void
}

export function MyConsultationsPanel({ appointments: initialAppointments, loading, onRefresh }: MyConsultationsPanelProps) {
  const [appointments, setAppointments] = React.useState<Appointment[]>([])

  React.useEffect(() => {
    setAppointments(initialAppointments || [])
  }, [initialAppointments])

  const [dismissingId, setDismissingId] = React.useState<string | null>(null)

  const handleDismiss = async (aptId: string) => {
    setDismissingId(aptId)
    try {
      const res = await fetch(`/api/patient/appointments?id=${aptId}`, {
        method: "DELETE"
      })
      if (!res.ok) throw new Error("Failed to delete appointment")
      toast.success("Appointment dismissed successfully")
      onRefresh?.()
    } catch (err) {
      console.error(err)
      toast.error("Failed to dismiss appointment")
    } finally {
      setDismissingId(null)
    }
  }

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
        const datePart = apt.appointment_date || (apt.scheduled_at ? formatStableDate(apt.scheduled_at) : "") || "Date not set"
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
                     {(apt.status === "declined" || apt.status === "cancelled") && (
                       <span className="px-2 py-1 text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full">✕ Declined by Doctor</span>
                     )}
                     {!isScheduled && !isPending && apt.status !== "declined" && apt.status !== "cancelled" && apt.status && (
                       <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive gap-1 capitalize font-medium">
                         {apt.status}
                       </Badge>
                     )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground" suppressHydrationWarning>
                    <span>📅 {datePart} | ⏰ {timePart}</span>
                    <span>Created on {formatStableDate(apt.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground/80 pt-1">
                    <span className="font-semibold text-foreground">Reason/Symptoms:</span>{" "}
                    {apt.reason || apt.symptoms || "Consultation Request"}
                  </p>
                  {(apt.status === "declined" || apt.status === "cancelled") && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1">
                      The doctor was unavailable for this slot. Please choose another time.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  {isScheduled && (
                    <Button asChild size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Link href={`/consultation/room/${apt.id}`}>
                        <Video className="h-4 w-4" /> Join Video Call
                      </Link>
                    </Button>
                  )}
                   {(apt.status === 'declined' || apt.status === 'cancelled') && (
                     <button
                       onClick={async () => {
                         await fetch(`/api/patient/appointments?id=${apt.id}`, { method: 'DELETE' });
                         setAppointments((prev: any[]) => prev.filter((a) => a.id !== apt.id));
                         onRefresh?.();
                       }}
                       className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600/20 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-500/40 transition-colors"
                     >
                       🗑️ Remove
                     </button>
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
