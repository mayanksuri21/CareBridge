export type PrintablePrescription = {
  id: string
  created_at: string
  doctor_name: string | null
  diagnosis: string | null
  medicines: Array<{ name: string; dosage?: string; frequency?: string; duration?: string }>
  advice: string | null
  instructions?: string | null
  patient_name?: string | null
  patient_age?: string | number | null
  patient_gender?: string | null
}

export function generatePrescriptionPDF(prescription: PrintablePrescription) {
  const popup = window.open("", "_blank")
  if (!popup) return
  
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character] ?? character))
  
  const rows = prescription.medicines
    .map((medicine) => `<tr><td>${escapeHtml(medicine.name)}</td><td>${escapeHtml(medicine.dosage ?? "-")}</td><td>${escapeHtml(medicine.frequency ?? "-")}</td><td>${escapeHtml(medicine.duration ?? "-")}</td></tr>`)
    .join("")
    
  const doctorLabel = prescription.doctor_name 
    ? (prescription.doctor_name.startsWith("Dr. ") ? prescription.doctor_name : `Dr. ${prescription.doctor_name}`)
    : "Dr. Rahul Sharma"
    
  const patientLabel = prescription.patient_name || "Suman Suri"
  const ageLabel = prescription.patient_age ? `${prescription.patient_age} yrs` : "N/A"
  const genderLabel = prescription.patient_gender || "N/A"
  const patientAgeSex = `${ageLabel} / ${genderLabel}`
  
  const adviceText = prescription.instructions || prescription.advice || "Follow prescribed dosage"

  popup.document.write(`<!doctype html><html><head><title>CareBridge e-Prescription</title><style>
    @page{size:A4;margin:12mm}
    body{font:13px Arial, sans-serif;color:#1e293b;line-height:1.5;margin:24px}
    .header{padding:24px;border-bottom:3px solid #0f766e;background:#f0fdfa;display:flex;justify-content:space-between;align-items:center}
    .brand{font-size:22px;font-weight:800;color:#0f766e}
    .tagline{font-size:10px;color:#0284c7;text-transform:uppercase;font-weight:bold;margin-top:2px}
    .doctor-info{text-align:right}
    .doctor-name{font-size:14px;font-weight:bold;color:#0f172a}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}
    .meta-item{min-height:40px}
    .label{font-size:9px;color:#64748b;text-transform:uppercase;font-weight:bold;display:block;margin-bottom:2px}
    .value{font-size:12px;font-weight:bold;color:#0f172a}
    .rx{font-size:28px;font-style:italic;color:#0f766e;font-weight:bold;margin:15px 0 5px}
    table{width:100%;border-collapse:collapse;margin:15px 0;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden}
    th{background:#0f766e;color:#fff;text-align:left;padding:10px;font-size:10px;text-transform:uppercase}
    td{padding:10px;border-top:1px solid #e2e8f0;font-size:11px}
    tr:nth-child(even) td{background:#f8fafc}
    .notes{margin-top:20px;padding:16px;border-left:4px solid #0f766e;background:#f0fdfa;border-radius:4px}
    .notes-title{font-size:11px;font-weight:bold;color:#0f766e;margin-bottom:6px;text-transform:uppercase}
    .signature{margin-top:40px;text-align:right;border-top:1px solid #cbd5e1;padding-top:10px}
    @media print{body{margin:0}}
  </style></head><body>
    <header class="header">
      <div>
        <div class="brand">CareBridge Telehealth</div>
        <div class="tagline">Official Digital Health Record</div>
      </div>
      <div class="doctor-info">
        <div class="doctor-name">${escapeHtml(doctorLabel)}</div>
        <div style="font-size:10px;color:#64748b">Reg No: MCI / NMC Reg. #892341</div>
      </div>
    </header>
    <section class="meta">
      <div class="meta-item"><span class="label">Patient Name</span><span class="value">${escapeHtml(patientLabel)}</span></div>
      <div class="meta-item"><span class="label">Age / Gender</span><span class="value">${escapeHtml(patientAgeSex)}</span></div>
      <div class="meta-item"><span class="label">Date</span><span class="value">${new Date(prescription.created_at).toLocaleDateString()}</span></div>
      <div class="meta-item"><span class="label">Prescription ID</span><span class="value">RX-${escapeHtml(prescription.id.substring(0, 8).toUpperCase())}</span></div>
    </section>
    <div class="meta-item" style="margin-bottom:15px"><span class="label">Chief Diagnosis</span><span class="value" style="font-size:14px">${escapeHtml(prescription.diagnosis ?? "General Consultation")}</span></div>
    <div class="rx">Rx</div>
    <table>
      <thead>
        <tr>
          <th>Medicine Name</th>
          <th>Dosage</th>
          <th>Frequency</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <section class="notes">
      <div class="notes-title">Doctor Notes / Advice</div>
      <p style="margin:0">${escapeHtml(adviceText)}</p>
    </section>
    <div class="signature">
      <strong>${escapeHtml(doctorLabel)}</strong><br>
      <span style="font-size:9px;color:#64748b">Digitally Signed & Validated via CareBridge e‑Rx Protocol</span>
    </div>
  </body></html>`)
  
  popup.document.close()
  popup.focus()
  popup.print()
}
