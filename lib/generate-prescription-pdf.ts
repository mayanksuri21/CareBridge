export type PrintablePrescription = {
  id: string
  created_at: string
  doctor_name: string | null
  diagnosis: string | null
  medicines: Array<{ name: string; dosage?: string; frequency?: string; duration?: string }>
  advice: string | null
}

export function generatePrescriptionPDF(prescription: PrintablePrescription) {
  const popup = window.open("", "_blank")
  if (!popup) return
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] ?? character))
  const rows = prescription.medicines.map((medicine) => `<tr><td>${escapeHtml(medicine.name)}</td><td>${escapeHtml(medicine.dosage ?? "-")}</td><td>${escapeHtml(medicine.frequency ?? "-")}</td><td>${escapeHtml(medicine.duration ?? "-")}</td></tr>`).join("")
  popup.document.write(`<!doctype html><html><head><title>CareBridge e-Prescription</title><style>@page{size:A4;margin:12mm}body{font:14px Arial;color:#172033}.header{padding:24px;border-bottom:3px solid #0f766e;background:#f0fdfa}.brand{font-size:24px;font-weight:800;color:#0f766e}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:22px 0;padding:14px;background:#f0fdfa}.label{font-size:10px;color:#64748b;text-transform:uppercase}table{width:100%;border-collapse:collapse}th{background:#059669;color:#fff;text-align:left;padding:10px}td{padding:10px;border:1px solid #e2e8f0}.notes{margin-top:22px;padding:14px;border-left:4px solid #0f766e;background:#f0fdfa}@media print{body{margin:0}}</style></head><body><header class="header"><div class="brand">CareBridge Telehealth Platform</div><div>Official Digital Health Record</div></header><section class="meta"><div><span class="label">Prescription ID</span><br>${escapeHtml(prescription.id)}</div><div><span class="label">Date</span><br>${new Date(prescription.created_at).toLocaleDateString()}</div><div><span class="label">Doctor</span><br>${escapeHtml(prescription.doctor_name ?? "CareBridge Doctor")}</div><div><span class="label">Diagnosis</span><br>${escapeHtml(prescription.diagnosis ?? "Not recorded")}</div></section><table><thead><tr><th>Medicine Name</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead><tbody>${rows}</tbody></table><section class="notes"><strong>Doctor Notes / Advice</strong><p>${escapeHtml(prescription.advice ?? "No additional advice recorded.")}</p></section></body></html>`)
  popup.document.close()
  popup.focus()
  popup.print()
}
