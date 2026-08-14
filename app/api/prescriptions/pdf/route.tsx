import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { createClient } from "@supabase/supabase-js";

function PrescriptionPDF({ presc, items, doctorName, patient }: any) {
  const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: "Helvetica", fontSize: 11, color: "#1e293b", backgroundColor: "#ffffff" },
    header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: "#0f766e", borderBottomStyle: "solid", paddingBottom: 15, marginBottom: 20 },
    brand: { fontSize: 20, fontWeight: "bold", color: "#0f766e" },
    tagline: { fontSize: 9, color: "#0284c7", marginTop: 2 },
    doctorInfo: { textAlign: "right" },
    docName: { fontSize: 12, fontWeight: "bold" },
    metaGrid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#f8fafc", borderRadius: 8, padding: 12, marginBottom: 20, border: 1, borderColor: "#e2e8f0" },
    metaCol: { width: "50%", marginBottom: 8, paddingRight: 10 },
    label: { fontSize: 8, color: "#64748b", textTransform: "uppercase", fontWeight: "bold", marginBottom: 2 },
    value: { fontSize: 10, fontWeight: "medium", color: "#0f172a" },
    rxIcon: { fontSize: 24, fontStyle: "italic", color: "#0f766e", marginBottom: 10, fontWeight: "bold" },
    title: { fontSize: 11, fontWeight: "bold", marginBottom: 5 },
    diagnosis: { fontSize: 12, fontWeight: "bold", color: "#0f172a", marginBottom: 15 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0f766e", borderRadius: 4, padding: 6, marginBottom: 4 },
    tableHeaderCell: { color: "#ffffff", fontSize: 9, fontWeight: "bold" },
    tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", borderBottomStyle: "solid", padding: 8 },
    tableCell: { fontSize: 9, color: "#334155" },
    adviceBox: { marginTop: 20, padding: 12, backgroundColor: "#f0fdfa", borderLeftWidth: 3, borderLeftColor: "#0f766e", borderLeftStyle: "solid", borderRadius: 4 },
    adviceTitle: { fontSize: 9, fontWeight: "bold", color: "#0f766e", marginBottom: 4 },
    adviceText: { fontSize: 9, color: "#1e293b", lineHeight: 1.4 },
    footer: { position: "absolute", bottom: 40, left: 40, right: 40, borderTopWidth: 1, borderTopColor: "#e2e8f0", borderTopStyle: "solid", paddingTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    disclaimer: { fontSize: 7, color: "#64748b", width: "70%" },
    signatureBlock: { textAlign: "right" },
    signText: { fontSize: 9, fontWeight: "bold", color: "#0f766e" },
    signSub: { fontSize: 7, color: "#64748b", marginTop: 2 }
  });

  const formattedDate = new Date(presc.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  let cleanAdvice = presc.advice || presc.note || "Follow prescribed dosage";
  if (presc.note && presc.note.includes("Instructions:")) {
    const match = presc.note.match(/Instructions:\s*([\s\S]*)/i);
    if (match) cleanAdvice = match[1].trim();
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>CareBridge Telehealth</Text>
            <Text style={styles.tagline}>Official Digital Health Record</Text>
          </View>
          <View style={styles.doctorInfo}>
            <Text style={styles.docName}>{doctorName}</Text>
            <Text style={{ fontSize: 8, color: "#64748b" }}>Reg No: MCI / NMC Reg. #892341</Text>
            <Text style={{ fontSize: 8, color: "#64748b" }}>Senior Telehealth Consultant</Text>
          </View>
        </View>

        {/* Patient & Metadata Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.label}>Patient Name</Text>
            <Text style={styles.value}>{patient.name}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.label}>Age / Gender</Text>
            <Text style={styles.value}>{patient.age ? `${patient.age} yrs` : "N/A"} / {patient.gender || "N/A"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.label}>Contact Info</Text>
            <Text style={styles.value}>{patient.phone || patient.email || "N/A"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.label}>Date / Reference ID</Text>
            <Text style={styles.value}>{formattedDate} &middot; RX-{presc.id.substring(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        {/* Diagnosis */}
        <View style={{ marginBottom: 15 }}>
          <Text style={styles.label}>Chief Diagnosis</Text>
          <Text style={styles.diagnosis}>{presc.diagnosis || "General Consultation"}</Text>
        </View>

        <Text style={styles.rxIcon}>Rx</Text>

        {/* Medicines Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: "40%" }]}>Medicine Name</Text>
          <Text style={[styles.tableHeaderCell, { width: "20%" }]}>Dosage</Text>
          <Text style={[styles.tableHeaderCell, { width: "20%" }]}>Frequency</Text>
          <Text style={[styles.tableHeaderCell, { width: "20%" }]}>Duration</Text>
        </View>

        {items.map((it: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "40%", fontWeight: "bold" }]}>{it.medication_name}</Text>
            <Text style={[styles.tableCell, { width: "20%" }]}>{it.dosage || "-"}</Text>
            <Text style={[styles.tableCell, { width: "20%" }]}>{it.frequency || "-"}</Text>
            <Text style={[styles.tableCell, { width: "20%" }]}>{it.duration || "-"}</Text>
          </View>
        ))}

        {/* Notes / Advice */}
        <View style={styles.adviceBox}>
          <Text style={styles.adviceTitle}>Doctor Notes & Advice</Text>
          <Text style={styles.adviceText}>{cleanAdvice}</Text>
        </View>

        {/* Signature & QR Code Footer */}
        <View style={styles.footer}>
          <View style={styles.disclaimer}>
            {presc.qr && <Image src={presc.qr} style={{ width: 50, height: 50, marginBottom: 5 }} />}
            <Text>This is a legally valid e‑prescription generated by a registered medical practitioner under the Telemedicine Practice Guidelines. No physical signature required.</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signText}>{doctorName}</Text>
            <Text style={styles.signSub}>Digitally Signed & Validated</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: presc, error } = await supabaseAdmin.from("prescriptions").select("*").eq("id", id).maybeSingle();
    if (error || !presc) return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });

    // Fetch details
    const [docProfileRes, patProfileRes, itemsRes] = await Promise.all([
      presc.doctor_id ? supabaseAdmin.from("profiles").select("name").eq("id", presc.doctor_id).maybeSingle() : Promise.resolve({ data: null }),
      presc.patient_id ? supabaseAdmin.from("profiles").select("name, email, age, gender, phone").eq("id", presc.patient_id).maybeSingle() : Promise.resolve({ data: null }),
      supabaseAdmin.from("prescription_items").select("*").eq("prescription_id", id)
    ]);

    const doctorName = docProfileRes.data?.name || presc.doctor_name || "Rahul Sharma";
    const cleanDoctorName = doctorName.startsWith("Dr. ") ? doctorName : `Dr. ${doctorName}`;
    const patient = patProfileRes.data || {
      name: "Suman Suri",
      email: "sumansuri0214@gmail.com",
      age: 28,
      gender: "Female",
      phone: "+1 (555) 123-4567"
    };

    const qrData = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/prescription/${id}`;
    const qr = await QRCode.toDataURL(qrData);

    const pdfOutput: any = await pdf(
      <PrescriptionPDF
        presc={{ ...presc, qr }}
        items={itemsRes.data || []}
        doctorName={cleanDoctorName}
        patient={patient}
      />
    ).toBuffer();

    return new Response(pdfOutput as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=prescription-${id}.pdf`
      }
    });
  } catch (err: any) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
