"use client"

import { FormEvent, useId, useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type Medicine = {
  medicineName: string
  dosage: string
  frequency: string
  duration: string
}

type PrescriptionModalProps = {
  doctorId: string
  appointmentId?: string
  patientId?: string
  patientName?: string | null
  initialChiefComplaint?: string | null
}

const emptyMedicine = (): Medicine => ({
  medicineName: "",
  dosage: "",
  frequency: "",
  duration: "",
})

export function PrescriptionModal({
  doctorId,
  appointmentId,
  patientId,
  patientName,
  initialChiefComplaint,
}: PrescriptionModalProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const patientFieldId = useId()
  const [open, setOpen] = useState(false)
  const [chiefComplaint, setChiefComplaint] = useState(initialChiefComplaint ?? "")
  const [directPatientId, setDirectPatientId] = useState("")
  const [medicines, setMedicines] = useState<Medicine[]>([emptyMedicine()])
  const [advice, setAdvice] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function updateMedicine(index: number, field: keyof Medicine, value: string) {
    setMedicines((currentMedicines) =>
      currentMedicines.map((medicine, medicineIndex) =>
        medicineIndex === index ? { ...medicine, [field]: value } : medicine,
      ),
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    const populatedMedicines = medicines.filter((medicine) => medicine.medicineName.trim())
    if (populatedMedicines.length === 0) {
      setErrorMessage("Add at least one medicine before exporting the prescription.")
      return
    }

    setIsSaving(true)
    const prescriptionPatientId = (patientId ?? directPatientId.trim()) || null
    const note = [
      chiefComplaint.trim() ? `Diagnosis / Chief complaint: ${chiefComplaint.trim()}` : "",
      advice.trim() ? `Additional advice / Doctor notes: ${advice.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")

    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .insert({
        appointment_id: appointmentId ?? null,
        doctor_id: doctorId,
        patient_id: prescriptionPatientId,
        note: note || null,
      })
      .select("id")
      .single()

    if (prescriptionError || !prescription) {
      setErrorMessage(prescriptionError?.message ?? "Unable to save the prescription.")
      setIsSaving(false)
      return
    }

    const { error: itemsError } = await supabase.from("prescription_items").insert(
      populatedMedicines.map((medicine) => ({
        prescription_id: prescription.id,
        medication_name: medicine.medicineName.trim(),
        dosage: medicine.dosage.trim() || null,
        frequency: medicine.frequency.trim() || null,
        duration: medicine.duration.trim() || null,
      })),
    )

    if (itemsError) {
      setErrorMessage(`Prescription saved, but its medicines could not be saved: ${itemsError.message}`)
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    setOpen(false)
    window.open(`/api/prescriptions/pdf?id=${encodeURIComponent(prescription.id)}`, "_blank", "noopener,noreferrer")
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Create Prescription
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Prescription</DialogTitle>
            <DialogDescription>
            Save the prescription and open a printable PDF.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={patientFieldId}>
                Patient Name / ID
              </label>
              {patientId ? (
                <Input
                  id={patientFieldId}
                  value={patientName ? `${patientName} (${patientId})` : patientId}
                  readOnly
                />
              ) : (
                <Input
                  id={patientFieldId}
                  value={directPatientId}
                  onChange={(event) => setDirectPatientId(event.target.value)}
                  placeholder="Patient UUID (optional for a direct test prescription)"
                />
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={`chief-complaint-${appointmentId}`}>
                Diagnosis / Chief Complaint
              </label>
              <Textarea
                id={`chief-complaint-${appointmentId}`}
                value={chiefComplaint}
                onChange={(event) => setChiefComplaint(event.target.value)}
                placeholder="Diagnosis or reason for the consultation"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium">Medicines</label>
                <Button type="button" size="sm" variant="outline" onClick={() => setMedicines((items) => [...items, emptyMedicine()])}>
                  <Plus /> Add medicine
                </Button>
              </div>
              {medicines.map((medicine, index) => (
                <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
                  <Input
                    value={medicine.medicineName}
                    onChange={(event) => updateMedicine(index, "medicineName", event.target.value)}
                    placeholder="Medicine name"
                    aria-label={`Medicine name ${index + 1}`}
                  />
                  <Input
                    value={medicine.dosage}
                    onChange={(event) => updateMedicine(index, "dosage", event.target.value)}
                    placeholder="Dosage"
                    aria-label={`Dosage ${index + 1}`}
                  />
                  <Input
                    value={medicine.frequency}
                    onChange={(event) => updateMedicine(index, "frequency", event.target.value)}
                    placeholder="Frequency"
                    aria-label={`Frequency ${index + 1}`}
                  />
                  <Input
                    value={medicine.duration}
                    onChange={(event) => updateMedicine(index, "duration", event.target.value)}
                    placeholder="Duration"
                    aria-label={`Duration ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setMedicines((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                    disabled={medicines.length === 1}
                    aria-label={`Remove medicine ${index + 1}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={`advice-${appointmentId}`}>
                Additional Advice / Doctor Notes
              </label>
              <Textarea
                id={`advice-${appointmentId}`}
                value={advice}
                onChange={(event) => setAdvice(event.target.value)}
                placeholder="Follow-up instructions, lifestyle advice, or additional notes"
              />
            </div>

            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save & Open PDF"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
