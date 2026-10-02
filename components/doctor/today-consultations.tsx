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
  declined: "Declined",
  pending: "Pending Approval",
  "in-progress": "In Progress",
  in_progress: "In Progress",
}

function statusVariant(status: ConsultationStatus) {
  if (status === "completed") return "secondary" as const
  if (status === "cancelled" || status === "declined") return "destructive" as const
  if (status === "in-progress" || status === "in_progress") return "default" as const
  if (status === "pending") return "outline" as const
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

  const { data: rawData, error } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, reason, status, schedule_slots!inner(start_time, end_time), patient:profiles!appointments_patient_id_fkey(id, name, email)",
    )
    .eq("doctor_id", doctorId)
    .gte("schedule_slots.start_time", startOfToday.toISOString())
    .lt("schedule_slots.start_time", startOfTomorrow.toISOString())
    .order("start_time", { referencedTable: "schedule_slots", ascending: true })

  if (error) return { consultations: [], error }
  const data = rawData
  const formatted = (data ?? []).map((appt: any) => {
    const reasonStr = appt.reason || '';
    const isPaid = appt.payment_status === 'paid' || reasonStr.includes('[PAYMENT_PAID]');
    const paymentStatus = isPaid ? 'paid' : (appt.payment_status === 'pending' || reasonStr.includes('[PAYMENT_PENDING]') ? 'pending' : 'pending');
    let cleanReason = reasonStr;
    ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]', '[PAYMENT_PAID]', '[PAYMENT_PENDING]', '[ARCHIVED_BY_DOCTOR]'].forEach(tag => {
      cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '');
    });
    return {
      ...appt,
      payment_status: paymentStatus,
      reason: cleanReason
    };
  });
  return { consultations: formatted as unknown as TodayConsultation[], error: null }
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

  const handleStartConsultation = async (appointmentId: string) => {
    try {
      await fetch('/api/appointments/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointmentId, action: 'start' }),
      });
    } catch (e) {
      console.error("Failed to signal doctor start:", e);
    }
    window.location.href = `/consultation/${appointmentId}`;
  };

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

  const getInitials = (name?: string | null) => {
    if (!name) return "PT"
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <Card className="border-sky-100 shadow-2xs bg-white rounded-3xl overflow-hidden h-full flex flex-col justify-between">
      <CardHeader className="bg-sky-50/50 border-b border-sky-100 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
              <CalendarDays className="h-4 w-4 text-teal-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-extrabold text-slate-900 tracking-tight">
                  Today&apos;s Consultations
                </CardTitle>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/80">
                  {consultations.length} total
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="text-xs font-bold text-teal-700 hover:text-teal-800 hover:bg-teal-50 cursor-pointer gap-1"
          >
            {loading ? "Refreshing..." : "Refresh →"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 flex-1">
        {!error && consultations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500 space-y-2">
            <CalendarDays className="h-6 w-6 text-slate-400" />
            <p className="font-semibold text-slate-700 text-xs">No consultations scheduled for today.</p>
            <Button onClick={shareBookingLink} variant="link" size="sm" className="text-teal-600 font-bold text-xs p-0 h-auto">
              {copied ? "Link Copied!" : "Share Booking Link →"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {consultations.map((consultation) => {
              const patient = consultation.patient ?? {
                id: consultation.patient_id,
                name: null,
              }
              const patientName = patient.name ?? "Unnamed patient"
              const initials = getInitials(patientName)
              const reasonTag = consultation.reason ?? "Consultation"
              const isPaid = (consultation as any).payment_status === "paid"
              const canJoin =
                consultation.status !== "completed" &&
                consultation.status !== "cancelled" &&
                consultation.status !== "declined" &&
                consultation.status !== "pending"

              let displayTime = "12:00 PM"
              if (consultation.schedule_slots?.start_time) {
                const d = new Date(consultation.schedule_slots.start_time)
                if (!isNaN(d.getTime())) {
                  displayTime = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                }
              }

              return (
                <div
                  key={consultation.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-teal-300/80 shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-800 font-extrabold text-xs flex items-center justify-center shrink-0 border border-teal-200">
                      {initials}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs truncate">{patientName}</span>
                        {reasonTag && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 truncate max-w-[140px]">
                            {reasonTag}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {displayTime}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isPaid ? (
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" /> Paid
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Pending
                      </span>
                    )}

                    {canJoin && isPaid ? (
                      <Button
                        size="sm"
                        className="bg-[#00a86b] hover:bg-[#008f5b] text-white font-bold text-xs px-4 py-1.5 rounded-xl shadow-2xs cursor-pointer"
                        onClick={() => handleStartConsultation(consultation.id)}
                      >
                        {consultation.status === 'in_progress' || (consultation as any).call_active || (typeof (consultation.reason || '') === 'string' && ((consultation.reason || '').includes('[DOCTOR_IN_ROOM]') || (consultation.reason || '').includes('[CALL_ACTIVE]'))) ? "Rejoin Consultation" : "Start Consultation"}
                      </Button>
                    ) : (
                      <PatientHistoryModal doctorId={doctorId} patient={patient} />
                    )}

                    <PrescriptionModal
                      appointmentId={consultation.id}
                      doctorId={doctorId}
                      patientId={patient.id}
                      patientName={patient.name}
                      initialChiefComplaint={consultation.reason}
                      onSaved={refresh}
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
