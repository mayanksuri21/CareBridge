"use client"

import { useEffect, useState } from "react"
import { Download, Pill, FileText } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { generatePrescriptionPDF, type PrintablePrescription } from "@/lib/generate-prescription-pdf"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { formatStableDate } from "@/lib/utils"

type PatientPrescriptionsSectionProps = {
  fallbackPrescriptions?: PrintablePrescription[]
}

export function PatientPrescriptionsSection({ fallbackPrescriptions = [] }: PatientPrescriptionsSectionProps) {
  const [prescriptions, setPrescriptions] = useState<PrintablePrescription[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadPrescriptions = async () => {
      try {
        const response = await fetch("/api/prescriptions")
        const payload = await response.json() as { prescriptions?: PrintablePrescription[] }
        const records = response.ok ? payload.prescriptions ?? [] : []
        setPrescriptions(records.length > 0 ? records : fallbackPrescriptions)
      } catch {
        setPrescriptions(fallbackPrescriptions)
      } finally {
        setIsLoading(false)
      }
    }
    void loadPrescriptions()

    const intervalId = window.setInterval(() => void loadPrescriptions(), 15_000)
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel("patient-prescriptions")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "prescriptions" }, () => {
        void loadPrescriptions()
      })
      .subscribe()

    return () => {
      window.clearInterval(intervalId)
      void supabase.removeChannel(channel)
    }
  }, [fallbackPrescriptions])

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading prescriptions...</p>
  if (prescriptions.length === 0) return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No prescriptions have been received yet.</p>

  return (
    <div className="space-y-4">
      {prescriptions.map((prescription) => (
        <Card key={prescription.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <Pill className="mt-1 size-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">{prescription.diagnosis ?? "CareBridge Prescription"}</CardTitle>
                  <CardDescription suppressHydrationWarning>
                    Dr. {prescription.doctor_name || "Rahul Sharma"} - {formatStableDate(prescription.created_at)}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm">
                  <Link href={`/prescription/${prescription.id}`} target="_blank">
                    <FileText className="mr-1.5 h-4 w-4" /> View Prescription
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/prescriptions/pdf?id=${prescription.id}`} target="_blank" rel="noreferrer">
                    <Download className="mr-1.5 h-4 w-4" /> Download PDF
                  </a>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground" suppressHydrationWarning>
            {prescription.instructions || prescription.advice || "Follow prescribed dosage"}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
