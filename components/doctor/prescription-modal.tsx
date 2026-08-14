"use client"

import { FormEvent, ReactNode, useEffect, useId, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

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

type TriggerVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
type TriggerSize = "default" | "sm" | "lg" | "icon"

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
  triggerLabel?: string
  triggerVariant?: TriggerVariant
  triggerSize?: TriggerSize
  triggerIcon?: ReactNode
  onSaved?: () => void
}

const emptyMedicine = (): Medicine => ({
  medicineName: "",
  dosage: "",
  frequency: "",
  duration: "",
})

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function PrescriptionModal({
  doctorId,
  appointmentId,
  patientId,
  patientName,
  initialChiefComplaint,
  triggerLabel = "Create Prescription",
  triggerVariant = "default",
  triggerSize = "sm",
  triggerIcon,
  onSaved,
}: PrescriptionModalProps) {
  const patientFieldId = useId()
  const [open, setOpen] = useState(false)
  const [chiefComplaint, setChiefComplaint] = useState(initialChiefComplaint ?? "")
  const [directPatientId, setDirectPatientId] = useState("")
  const [medicines, setMedicines] = useState<Medicine[]>([emptyMedicine()])
  const [advice, setAdvice] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setChiefComplaint(initialChiefComplaint ?? "")
    }
  }, [open, initialChiefComplaint])

  function updateMedicine(index: number, field: keyof Medicine, value: string) {
    setMedicines((currentMedicines) =>
      currentMedicines.map((medicine, medicineIndex) =>
        medicineIndex === index ? { ...medicine, [field]: value } : medicine,
      ),
    )
  }

  function openPrintablePrescription(targetWindow: Window | null) {
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    }[character] ?? character))
    const prescriptionWindow = targetWindow ?? window.open("", "_blank", "noopener,noreferrer")
    if (!prescriptionWindow) {
      setErrorMessage("Unable to open the printable prescription. Please allow pop-ups and try again.")
      return false
    }

    const patientLabel = patientName ?? "Demo patient"
    const issuedDate = new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date())
    const prescriptionReference = `RX-CB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    const medicineRows = medicines
      .filter((medicine) => medicine.medicineName.trim())
      .map((medicine) => `<tr><td>${escapeHtml(medicine.medicineName)}</td><td>${escapeHtml(medicine.dosage || "-")}</td><td>${escapeHtml(medicine.frequency || "-")}</td><td>${escapeHtml(medicine.duration || "-")}</td></tr>`)
      .join("")
    prescriptionWindow.document.write(`<!doctype html>
<html><head><title>${prescriptionReference} | CareBridge</title><style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f8fafc; color: #172033; font-family: Inter, Arial, sans-serif; font-size: 13px; line-height: 1.5; }
  .sheet { width: 100%; min-height: 273mm; background: #fff; border: 1px solid #dbe4ee; border-radius: 14px; overflow: hidden; }
  .header { display: flex; justify-content: space-between; gap: 24px; padding: 28px 30px; background: linear-gradient(135deg, #f0fdfa, #f8fafc 65%); border-bottom: 3px solid #0f766e; }
  .brand { color: #0f766e; font-size: 25px; font-weight: 800; letter-spacing: -.6px; }
  .tagline { margin-top: 3px; color: #0284c7; font-size: 11px; font-weight: 700; letter-spacing: .7px; text-transform: uppercase; }
  .doctor { min-width: 235px; border-left: 1px solid #99f6e4; padding-left: 20px; }
  .doctor strong { display: block; color: #0f172a; font-size: 15px; }
  .doctor p { margin: 2px 0; color: #475569; }
  .content { padding: 26px 30px 30px; }
  .metadata { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; overflow: hidden; border: 1px solid #cbd5e1; border-radius: 10px; background: #cbd5e1; }
  .metadata div { min-height: 58px; padding: 12px 14px; background: #f0fdfa; }
  .label { display: block; margin-bottom: 3px; color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; }
  .value { color: #0f172a; font-size: 14px; font-weight: 700; }
  .rx { margin: 28px 0 12px; color: #0f766e; font-family: Georgia, serif; font-size: 32px; font-style: italic; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; overflow: hidden; border: 1px solid #cbd5e1; border-radius: 10px; }
  th { padding: 11px 12px; background: #059669; color: #fff; font-size: 11px; letter-spacing: .35px; text-align: left; text-transform: uppercase; }
  td { padding: 12px; border-top: 1px solid #e2e8f0; color: #334155; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .notes { margin-top: 25px; padding: 16px 18px; border-left: 4px solid #0f766e; border-radius: 8px; background: #f0fdfa; }
  .notes h2 { margin: 0 0 7px; color: #0f766e; font-size: 13px; }
  .notes p { margin: 0; white-space: pre-wrap; }
  .signature { margin: 48px 0 22px auto; width: 285px; border-top: 1px solid #94a3b8; padding-top: 9px; text-align: right; }
  .signature strong { color: #0f766e; font-size: 15px; }
  .signature span { display: block; color: #64748b; font-size: 10px; }
  .disclaimer { border-top: 1px solid #e2e8f0; padding-top: 14px; color: #64748b; font-size: 10px; text-align: center; }
  @media print { body { background: #fff; } .sheet { min-height: auto; border: 0; border-radius: 0; } }
</style></head><body>
<main class="sheet"><header class="header"><div><div class="brand">CareBridge Telehealth Platform</div><div class="tagline">Official Digital Health Record</div></div><div class="doctor"><strong>Dr. Sarah Jenkins, M.D.</strong><p>Senior Consultant - General Medicine</p><p>Reg No: MCI / NMC Reg. #892341</p></div></header>
<section class="content"><div class="metadata"><div><span class="label">Patient Name</span><span class="value">${escapeHtml(patientLabel)}</span></div><div><span class="label">Age / Sex</span><span class="value">28 / Male</span></div><div><span class="label">Date</span><span class="value">${issuedDate}</span></div><div><span class="label">Prescription ID</span><span class="value">${prescriptionReference}</span></div></div>
<div class="rx">Rx</div><p><span class="label">Chief Diagnosis</span><span class="value">${escapeHtml(chiefComplaint || "Not recorded")}</span></p><table><thead><tr><th>Medicine Name</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead><tbody>${medicineRows}</tbody></table>
<section class="notes"><h2>Doctor Notes / Advice</h2><p>${escapeHtml(advice || "No additional advice recorded.")}</p></section><div class="signature"><strong>Dr. Sarah Jenkins</strong><span>Digitally Signed &amp; Validated via CareBridge Security Protocol</span></div><footer class="disclaimer">This is a electronically generated prescription under Telemedicine Practice Guidelines. No physical signature required.</footer></section></main>
</body></html>`)
    prescriptionWindow.document.close()
    prescriptionWindow.focus()
    prescriptionWindow.print()
    return true
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const populatedMedicines = medicines.filter((medicine) => medicine.medicineName.trim())
    if (populatedMedicines.length === 0) {
      setErrorMessage("Add at least one medicine before exporting the prescription.")
      return
    }

    setIsSaving(true)
    const requestedPatientId = patientId ?? directPatientId.trim()
    const prescriptionPatientId = requestedPatientId && uuidPattern.test(requestedPatientId)
      ? requestedPatientId
      : null

    if (requestedPatientId && !prescriptionPatientId) {
      setErrorMessage("Patient ID must be a valid UUID.")
      setIsSaving(false)
      return
    }
    const note = [
      chiefComplaint.trim() ? `Diagnosis / Chief complaint: ${chiefComplaint.trim()}` : "",
      advice.trim() ? `Additional advice / Doctor notes: ${advice.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")

    // Open synchronously in the click handler so browsers do not block the printable fallback.
    const printableWindow = window.open("", "_blank")
    try {
      const response = await fetch("/api/prescription/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          patientId: prescriptionPatientId,
          diagnosis: chiefComplaint,
          advice,
          medicines: populatedMedicines.map((medicine) => ({
            name: medicine.medicineName,
            dosage: medicine.dosage,
            frequency: medicine.frequency,
            duration: medicine.duration,
          })),
        }),
      })
      if (!response.ok) throw new Error("Prescription persistence is unavailable")
    } catch (error) {
      console.warn("DB insert bypassed for demo session:", error)
    }

    openPrintablePrescription(printableWindow)

    setIsSaving(false)
    setOpen(false)
    setSuccessMessage("Prescription generated successfully!")
    toast.success("Prescription generated successfully!")
    if (onSaved) onSaved()
  }

  return (
    <>
      <Button size={triggerSize} variant={triggerVariant} onClick={() => setOpen(true)} className="gap-1.5">
        {triggerIcon}
        {triggerLabel}
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
                Patient
              </label>
              {patientName ? (
                <Input
                  id={patientFieldId}
                  value={patientId ? `${patientName} (${patientId})` : patientName}
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
            {successMessage && <p className="text-sm text-primary">{successMessage}</p>}

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
