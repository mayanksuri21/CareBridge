import { CalendarDays } from "lucide-react"

import { PatientHistoryModal } from "@/components/doctor/patient-history-modal"
import { PrescriptionModal } from "@/components/doctor/prescription-modal"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type Patient = {
  id: string
  name: string | null
}

type ConsultationStatus = "booked" | "completed" | "cancelled" | string

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
}

const statusLabels: Record<string, string> = {
  booked: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  "in-progress": "In Progress",
  in_progress: "In Progress",
}

function statusVariant(status: ConsultationStatus) {
  if (status === "completed") return "secondary" as const
  if (status === "cancelled") return "destructive" as const
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

export async function TodayConsultations({ doctorId }: TodayConsultationsProps) {
  const supabase = await createSupabaseServerClient()
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, reason, status, schedule_slots!inner(start_time, end_time), patient:profiles!appointments_patient_id_fkey(id, name)",
    )
    .eq("doctor_id", doctorId)
    .gte("schedule_slots.start_time", startOfToday.toISOString())
    .lt("schedule_slots.start_time", startOfTomorrow.toISOString())
    .order("start_time", { referencedTable: "schedule_slots", ascending: true })

  const consultations = (data ?? []) as unknown as TodayConsultation[]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" />
          <CardTitle>Today&apos;s Consultations</CardTitle>
        </div>
        <CardDescription>
          {error
            ? "Today's consultation schedule could not be loaded."
            : "Appointments scheduled for today."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!error && consultations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <p>No consultations are scheduled for today.</p>
            <div className="mt-4 flex justify-center">
              <PrescriptionModal doctorId={doctorId} />
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultations.map((consultation) => {
                const patient = consultation.patient ?? {
                  id: consultation.patient_id,
                  name: null,
                }

                return (
                  <TableRow key={consultation.id}>
                    <TableCell className="font-medium">
                      {patient.name ?? "Unnamed patient"}
                    </TableCell>
                    <TableCell>{formatTimeSlot(consultation.schedule_slots)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(consultation.status)}>
                        {statusLabels[consultation.status] ?? consultation.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <PatientHistoryModal doctorId={doctorId} patient={patient} />
                        <PrescriptionModal
                          appointmentId={consultation.id}
                          doctorId={doctorId}
                          patientId={patient.id}
                          patientName={patient.name}
                          initialChiefComplaint={consultation.reason}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
