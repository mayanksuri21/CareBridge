"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarDays, Copy, Check, Video, Link2 } from "lucide-react"

import { PatientHistoryModal } from "@/components/doctor/patient-history-modal"
import { PrescriptionModal } from "@/components/doctor/prescription-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export type Patient = {
  id: string
  name: string | null
  email?: string | null
}

type ConsultationStatus = "booked" | "completed" | "cancelled" | "in-progress" | "in_progress" | string

type TodayConsultation = {
  id: string
  patient_id: string
  reason: string | null
  status: ConsultationStatus
  schedule_slots: {
    start_time: string
    end_time: string
  } | null
  patient: Patient | null
}

type TodayConsultationsProps = {
  doctorId: string
  initialConsultations?: TodayConsultation[]
}

const statusLabels: Record<string, string> = {
  booked: "Scheduled",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  "in-progress": "In Progress",
  in_progress: "In Progress",
}

function statusVariant(status: ConsultationStatus) {
  if (status === "completed") return "secondary" as const
  if (status === "cancelled") return "destructive" as const
  if (status === "in-progress" || status === "in_progress") return "default" as const
  return "outline" as const
}

function formatTimeSlot(slot: TodayConsultation["schedule_slots"]) {
  if (!slot) return "Time not available"

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  return `${formatter.format(new Date(slot.start_time))} - ${formatter.format(new Date(slot.end_time))}`
}

async function fetchTodayConsultations(doctorId: string): Promise<{
  consultations: TodayConsultation[]
  error: Error | null
}> {
  const supabase = createSupabaseBrowserClient()
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, reason, status, schedule_slots!inner(start_time, end_time), patient:profiles!appointments_patient_id_fkey(id, name, email)",
    )
    .eq("doctor_id", doctorId)
    .gte("schedule_slots.start_time", startOfToday.toISOString())
    .lt("schedule_slots.start_time", startOfTomorrow.toISOString())
    .order("start_time", { referencedTable: "schedule_slots", ascending: true })

  if (error) return { consultations: [], error }
  return { consultations: (data ?? []) as unknown as TodayConsultation[], error: null }
}

export function TodayConsultations({ doctorId, initialConsultations = [] }: TodayConsultationsProps) {
  const supabase = createSupabaseBrowserClient()
  const [consultations, setConsultations] = useState<TodayConsultation[]>(initialConsultations)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    const { consultations: fresh, error: fetchError } = await fetchTodayConsultations(doctorId)
    setConsultations(fresh)
    setError(fetchError)
    setLoading(false)
  }, [doctorId])

  useEffect(() => {
    refresh()

    const appointmentsChannel = supabase
      .channel(`doctor-${doctorId}-appointments`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `doctor_id=eq.${doctorId}`,
        },
        () => {
          refresh()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(appointmentsChannel)
    }
  }, [refresh, supabase, doctorId])

  const shareBookingLink = async () => {
    const bookingUrl = `${origin}/consultation/book?doctor=${doctorId}`
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Book a consultation with me",
          text: "Schedule an appointment through CareBridge",
          url: bookingUrl,
        })
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(bookingUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            <CardTitle>Today&apos;s Consultations</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
        <CardDescription>
          {error
            ? "Today's consultation schedule could not be loaded."
            : `Appointments scheduled for today (${consultations.length} total).`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!error && consultations.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/80 bg-gradient-to-br from-muted/40 via-background to-muted/20 p-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CalendarDays className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No active consultations scheduled for today.</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Share your booking link with patients so they can schedule a consultation at a time that suits them.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={shareBookingLink} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                {copied ? "Link Copied!" : "Share Booking Link"}
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <a
                  href={`/consultation/book?doctor=${doctorId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Copy className="h-4 w-4" /> Open Booking Page
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Chief Complaint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultations.map((consultation) => {
                  const patient = consultation.patient ?? {
                    id: consultation.patient_id,
                    name: null,
                  }
                  const canJoin = consultation.status !== "completed" && consultation.status !== "cancelled"

                  return (
                    <TableRow key={consultation.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{patient.name ?? "Unnamed patient"}</div>
                          {patient.email && (
                            <div className="text-xs text-muted-foreground">{patient.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatTimeSlot(consultation.schedule_slots)}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                        {consultation.reason ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(consultation.status)}>
                          {statusLabels[consultation.status] ?? consultation.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {canJoin && (
                            <Button asChild size="sm" variant="default" className="gap-1.5">
                              <a href={`/consultation/${consultation.id}`}>
                                <Video className="h-3.5 w-3.5" /> Join Video Call
                              </a>
                            </Button>
                          )}
                          <PatientHistoryModal doctorId={doctorId} patient={patient} />
                          <PrescriptionModal
                            appointmentId={consultation.id}
                            doctorId={doctorId}
                            patientId={patient.id}
                            patientName={patient.name}
                            initialChiefComplaint={consultation.reason}
                            onSaved={refresh}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
