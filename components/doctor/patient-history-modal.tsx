"use client"

import { useEffect, useMemo, useState } from "react"
import { ClipboardList, ExternalLink, FileText } from "lucide-react"

import type { Patient } from "@/components/doctor/today-consultations"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type PatientHistoryConsultation = {
  id: string
  reason: string | null
  symptoms: string | null
  status: string
  created_at: string
  scheduled_at: string | null
  schedule_slots: {
    start_time: string
    end_time?: string
  } | null
  prescriptions: Array<{
    id?: string
    diagnosis?: string | null
    medicines?: any
    advice?: string | null
    note?: string | null
    created_at?: string
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

      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, reason, symptoms, status, created_at, scheduled_at, schedule_slots(start_time, end_time), prescriptions(id, diagnosis, medicines, advice, note, created_at)",
        )
        .eq("doctor_id", doctorId)
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })

      if (!isCurrentRequest) return

      if (error) {
        console.error("PatientHistoryModal error fetching consultation history:", error)
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

  const cleanReasonDisplay = (reasonStr: string | null) => {
    if (!reasonStr) return "General Consultation"
    let clean = reasonStr
    if (clean.includes("Selected Date:") || clean.includes("Symptoms:") || clean.includes("Preferred Date:")) {
      const splitIdx = clean.search(/(Symptoms:|Preferred Date:|Selected Date:|Time Slot:)/i)
      if (splitIdx !== -1) {
        clean = clean.substring(0, splitIdx).trim()
      }
    }
    ;['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]', '[PAYMENT_PAID]', '[PAYMENT_PENDING]', '[ARCHIVED_BY_DOCTOR]'].forEach((tag) => {
      clean = clean.replace(` ${tag}`, '').replace(tag, '')
    })
    clean = clean.trim()
    return clean || "General Consultation"
  }

  const parseMedicines = (rx: any) => {
    if (!rx) return []
    if (Array.isArray(rx.medicines)) return rx.medicines
    if (typeof rx.medicines === "string") {
      try { return JSON.parse(rx.medicines) } catch {}
    }
    if (rx.note) {
      try {
        const match = rx.note.match(/Medications:\s*(\[.*\])/i)
        if (match) return JSON.parse(match[1])
      } catch {}
    }
    return []
  }

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

          <div className="space-y-4 px-4 pb-6 mt-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading consultation history...</p>
            ) : errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : history.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No previous consultation history found for this patient with you.
              </div>
            ) : (
              history.map((consultation) => {
                const dateObj = new Date(consultation.schedule_slots?.start_time || consultation.scheduled_at || consultation.created_at)
                const isValidDate = !isNaN(dateObj.getTime())
                const displayDate = isValidDate
                  ? dateObj.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
                  : "Date unavailable"
                const displayTime = isValidDate
                  ? dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
                  : ""

                const rx = consultation.prescriptions && consultation.prescriptions.length > 0 ? consultation.prescriptions[0] : null
                const medicines = parseMedicines(rx)

                return (
                  <article key={consultation.id} className="relative border-l pl-5 pb-5 last:pb-0 space-y-2">
                    <ClipboardList className="absolute -left-2.5 top-0 size-5 rounded-full bg-background text-primary" />
                    
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <span>{displayDate}</span>
                        {displayTime && <span className="text-xs text-muted-foreground">• {displayTime}</span>}
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold border-emerald-200 text-emerald-700 bg-emerald-50">
                        {consultation.status || "Completed"}
                      </Badge>
                    </div>

                    <p className="text-sm font-semibold text-foreground">
                      {cleanReasonDisplay(consultation.reason)}
                    </p>

                    {consultation.symptoms && (
                      <p className="text-xs text-muted-foreground bg-slate-50 p-2 rounded-md border">
                        <span className="font-medium text-foreground">Symptoms: </span>
                        {consultation.symptoms}
                      </p>
                    )}

                    <div className="pt-2 border-t text-xs">
                      <span className="font-semibold text-muted-foreground block mb-1">Prescription:</span>
                      {rx ? (
                        <div className="space-y-1.5 bg-teal-50/60 p-2.5 rounded-lg border border-teal-100">
                          <div className="flex items-center justify-between">
                            <span className="text-teal-800 font-bold flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5 text-teal-600" /> ✓ Prescription Issued
                            </span>
                            {rx.id && (
                              <button
                                type="button"
                                onClick={() => window.open(`/prescription/${rx.id}`, "_blank")}
                                className="text-teal-700 hover:underline font-bold flex items-center gap-0.5 cursor-pointer text-[11px]"
                              >
                                View Rx <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {rx.diagnosis && (
                            <p className="text-slate-700">
                              <span className="font-medium">Diagnosis: </span>{rx.diagnosis}
                            </p>
                          )}
                          {medicines.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {medicines.map((m: any, idx: number) => (
                                <span key={idx} className="text-[10px] bg-white text-teal-800 px-1.5 py-0.5 rounded border border-teal-200 font-medium">
                                  {m.medication_name || m.name || m.medicineName} {m.dosage ? `(${m.dosage})` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground font-medium">No prescription issued</p>
                      )}
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
