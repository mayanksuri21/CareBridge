"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Clock,
  Loader2,
  MessageSquare,
  Video,
  UserCircle2,
  Inbox,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PrescriptionModal } from "@/components/doctor/prescription-modal"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type PendingRequest = {
  id: string
  doctor_id: string
  patient_id: string
  scheduled_at?: string | null
  appointment_date?: string | null
  time_slot?: string | null
  symptoms?: string | null
  reason: string | null
  status: string | null
  created_at: string
  slot_id: string | null
  patient: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  } | null
  schedule_slots: {
    start_time: string
    end_time: string
  } | null
}

type PendingRequestsPanelProps = {
  doctorId: string
  onMetricsChange?: () => void
}

function formatSlot(request: PendingRequest) {
  if (request.appointment_date && request.time_slot) {
    return `📅 ${request.appointment_date}  ⏰ ${request.time_slot}`
  }
  if (request.scheduled_at) {
    const start = new Date(request.scheduled_at)
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
  if (request.schedule_slots) {
    const start = new Date(request.schedule_slots.start_time)
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
  if (request.reason) {
    const dateMatch = request.reason.match(/Selected Date:\s*([\w\d, -]+)/i) || request.reason.match(/Preferred Date:\s*([\w\d, -]+)/i)
    const timeMatch = request.reason.match(/Time Slot:\s*([\w\d: ]+)/i)
    if (dateMatch && timeMatch) {
      return `📅 ${dateMatch[1].trim()}  ⏰ ${timeMatch[1].trim()}`
    }
    if (dateMatch) {
      return `📅 ${dateMatch[1].trim()}`
    }
  }
  return "Time not set"
}

export function PendingRequestsPanel({ doctorId, onMetricsChange }: PendingRequestsPanelProps) {
  const router = useRouter()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const notifyMetrics = useCallback(() => {
    onMetricsChange?.()
  }, [onMetricsChange])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      let data: any[] | null = null
      let error: any = null

      const resDefault = await supabase
        .from("appointments")
        .select(`
          id,
          doctor_id,
          patient_id,
          scheduled_at,
          appointment_date,
          time_slot,
          status,
          reason,
          symptoms,
          created_at,
          slot_id,
          patient:profiles!patient_id (
            id,
            name,
            email,
            phone
          ),
          schedule_slots (
            start_time,
            end_time
          )
        `)
        .eq("doctor_id", doctorId)
        .in("status", ["pending", "requested", "booked", "scheduled"])
        .order("created_at", { ascending: false })

      data = resDefault.data
      error = resDefault.error

      if (error && (error.message.includes("column") || error.code === "42703")) {
        console.warn("Enhanced select failed, retrying standard schema...")
        const resStandard = await supabase
          .from("appointments")
          .select(`
            id,
            doctor_id,
            patient_id,
            reason,
            status,
            created_at,
            slot_id,
            patient:profiles!appointments_patient_id_fkey (
              id,
              name,
              email,
              phone
            ),
            schedule_slots (
              start_time,
              end_time
            )
          `)
          .eq("doctor_id", doctorId)
          .in("status", ["pending", "requested", "booked", "scheduled"])
          .order("created_at", { ascending: false })

        data = resStandard.data
        error = resStandard.error
      }

      if (error) {
        console.error("Fetch pending appointments failed:", error.message)
        setRequests([])
        return
      }

      const patientIds = Array.from(
        new Set((data ?? []).map((a: any) => a.patient_id).filter(Boolean))
      )
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, phone")
        .in("id", patientIds)

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

      const mapped = (data ?? []).map((r: any) => {
        const profile = profileMap.get(r.patient_id)
        const patient = {
          id: r.patient_id,
          name: profile?.name || "Suman Suri",
          email: profile?.email || "",
          phone: profile?.phone || "",
        }
        return {
          ...r,
          patient,
        }
      })

      setRequests(mapped as any as PendingRequest[])
    } finally {
      setLoading(false)
    }
  }, [doctorId, supabase])

  useEffect(() => {
    refresh()

    const channel = supabase
      .channel(`doctor-${doctorId}-pending-requests`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `doctor_id=eq.${doctorId}`,
        },
        () => {
          void refresh()
          notifyMetrics()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refresh, doctorId, supabase, notifyMetrics])

  const acceptRequest = async (requestId: string) => {
    setWorkingId(requestId)
    try {
      let { error } = await supabase
        .from("appointments")
        .update({ status: "scheduled" })
        .eq("id", requestId)
        .eq("doctor_id", doctorId)
      
      if (error && (error.message.includes("check constraint") || error.code === "23514")) {
        console.warn("scheduled status violates constraints, trying booked fallback...")
        const { error: err2 } = await supabase
          .from("appointments")
          .update({ status: "booked" })
          .eq("id", requestId)
          .eq("doctor_id", doctorId)
        error = err2
      }

      if (error) throw error
      toast.success("Request accepted — moved to scheduled consultations.")
      void refresh()
      notifyMetrics()
    } catch (err) {
      console.error(err)
      toast.error("Could not accept this request. Please try again.")
    } finally {
      setWorkingId(null)
    }
  }

  const rejectRequest = async (requestId: string) => {
    setWorkingId(requestId)
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", requestId)
        .eq("doctor_id", doctorId)
      if (error) throw error
      toast.success("Request cancelled — patient will be notified to reschedule.")
      void refresh()
      notifyMetrics()
    } catch (err) {
      console.error(err)
      toast.error("Could not cancel this request. Please try again.")
    } finally {
      setWorkingId(null)
    }
  }

  const handleRejectAppointment = rejectRequest

  const pendingCount = requests.filter((r) => r.status === "pending" || r.status === "requested").length
  const scheduledCount = requests.filter((r) => r.status === "scheduled" || r.status === "booked" || r.status === "confirmed").length

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Incoming Consultation Requests
              {pendingCount > 0 && (
                <Badge variant="default" className="ml-1">
                  {pendingCount} pending
                </Badge>
              )}
              {scheduledCount > 0 && (
                <Badge variant="outline" className="ml-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  {scheduledCount} scheduled
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Review patient requests, accept or reschedule consultations, and begin video calls or write prescriptions.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading incoming requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/80 bg-gradient-to-br from-muted/40 via-background to-muted/20 p-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Inbox className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold">No incoming requests</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Patient consultation requests will appear here once submitted. Use the Available Slots manager to set the
              times you prefer to work.
            </p>
            <Link href="/" className="mt-4">
              <Button variant="outline" size="sm">
                View public site
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {requests.map((request) => {
              const pending = request.status === "pending" || request.status === "requested"
              const scheduled = request.status === "booked" || request.status === "scheduled"
              const isWorking = workingId === request.id
              return (
                <div
                  key={request.id}
                  className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-semibold">
                            {request.patient?.name || "Suman Suri"}
                          </div>
                          {request.patient?.email && (
                            <div className="text-xs text-muted-foreground">
                              {request.patient.email}
                              {request.patient.phone ? ` · ${request.patient.phone}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                      {pending && (
                        <Badge variant="secondary" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          <AlertCircle className="h-3 w-3" /> Awaiting review
                        </Badge>
                      )}
                      {scheduled && (
                        <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Scheduled
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-start gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {formatSlot(request)}
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-2 text-xs">
                      <div className="text-slate-200">
                        <span className="font-medium text-slate-400">Reason:</span> {request.reason || "Consultation Request"}
                      </div>
                      {request.symptoms && (
                        <div className="text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800">
                          <span className="font-semibold text-emerald-400">Symptoms:</span> {request.symptoms}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {pending && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => acceptRequest(request.id)}
                          disabled={isWorking}
                          className="gap-1.5"
                        >
                          {isWorking ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectRequest(request.id)}
                          disabled={isWorking}
                          className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          {isWorking ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          Reject / Reschedule
                        </Button>
                      </>
                    )}
                    <Button
                      asChild
                      size="sm"
                      variant="default"
                      className="gap-1.5"
                    >
                      <Link href={`/consultation/${request.id}`}>
                        <Video className="h-4 w-4" /> Start Consultation
                      </Link>
                    </Button>
                    <Button
                      onClick={() => handleRejectAppointment(request.id)}
                      variant="outline"
                      className="border-rose-500/40 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 text-xs h-8"
                    >
                      Decline
                    </Button>
                    <PrescriptionModal
                      doctorId={doctorId}
                      appointmentId={request.id}
                      patientId={request.patient_id}
                      patientName={request.patient?.name || "Suman Suri"}
                      initialChiefComplaint={request.symptoms || request.reason}
                      triggerLabel="Quick Prescription"
                      triggerVariant="outline"
                      triggerSize="sm"
                      triggerIcon={<FileText className="h-4 w-4" />}
                      onSaved={() => {
                        void refresh()
                        notifyMetrics()
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
