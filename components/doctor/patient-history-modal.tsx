"use client"

import { useEffect, useMemo, useState } from "react"
import { ClipboardList } from "lucide-react"

import type { Patient } from "@/components/doctor/today-consultations"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type PrescriptionItem = {
  medication_name: string | null
  dosage: string | null
  frequency: string | null
  duration: string | null
  instructions: string | null
}

type PatientHistoryConsultation = {
  id: string
  reason: string | null
  status: string
  schedule_slots: {
    start_time: string
  } | null
  prescriptions: Array<{
    note: string | null
    prescription_items: PrescriptionItem[] | null
  }> | null
}

type PatientHistoryModalProps = {
  doctorId: string
  patient: Patient
}

export function PatientHistoryModal({ doctorId, patient }: PatientHistoryModalProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<PatientHistoryConsultation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let isCurrentRequest = true
    const loadHistory = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, reason, status, schedule_slots!inner(start_time), prescriptions(note, prescription_items(medication_name, dosage, frequency, duration, instructions))",
        )
        .eq("doctor_id", doctorId)
        .eq("patient_id", patient.id)
        .lt("schedule_slots.start_time", startOfToday.toISOString())
        .order("start_time", { referencedTable: "schedule_slots", ascending: false })

      if (!isCurrentRequest) return

      if (error) {
        setHistory([])
        setErrorMessage("Unable to load consultation history. Please try again.")
      } else {
        setHistory((data ?? []) as unknown as PatientHistoryConsultation[])
      }
      setIsLoading(false)
    }

    void loadHistory()
    return () => {
      isCurrentRequest = false
    }
  }, [doctorId, open, patient.id, supabase])

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        View History
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{patient.name ?? "Patient"}&apos;s consultation history</SheetTitle>
            <SheetDescription>
              Previous consultations with you only.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading consultation history...</p>
            ) : errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : history.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No previous consultation history found for this patient with you.
              </div>
            ) : (
              history.map((consultation) => (
                <article key={consultation.id} className="relative border-l pl-5 pb-5 last:pb-0">
                  <ClipboardList className="absolute -left-2.5 top-0 size-5 rounded-full bg-background text-primary" />
                  <time className="text-sm font-medium">
                    {consultation.schedule_slots?.start_time
                      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                          new Date(consultation.schedule_slots.start_time),
                        )
                      : "Date unavailable"}
                  </time>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Chief complaint: </span>
                    {consultation.reason ?? "Not recorded"}
                  </p>
                  {consultation.prescriptions?.map((prescription, index) => (
                    <div key={`${consultation.id}-${index}`} className="mt-3 space-y-2 text-sm">
                      {prescription.note && (
                        <p>
                          <span className="font-medium">Doctor&apos;s notes: </span>
                          {prescription.note}
                        </p>
                      )}
                      {prescription.prescription_items?.length ? (
                        <div>
                          <p className="font-medium">Prescription</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                            {prescription.prescription_items.map((item, itemIndex) => (
                              <li key={`${consultation.id}-${index}-${itemIndex}`}>
                                {[item.medication_name, item.dosage, item.frequency, item.duration]
                                  .filter(Boolean)
                                  .join(", ") || "Prescription details not recorded"}
                                {item.instructions ? ` - ${item.instructions}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </article>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
