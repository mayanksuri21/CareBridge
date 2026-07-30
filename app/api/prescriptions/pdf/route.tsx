import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "../../../../lib/supabase/server"
import QRCode from "qrcode"
import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"

function PrescriptionPDF({ presc, items }: any) {
  const styles = StyleSheet.create({
    page: { padding: 24 },
    header: { fontSize: 18, marginBottom: 12 },
    section: { marginBottom: 12 },
    small: { fontSize: 10 },
  })
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>HealthConnect e‑Prescription</Text>
        <View style={styles.section}>
          <Text>Prescription ID: {presc.id}</Text>
          <Text>Date: {new Date(presc.created_at).toLocaleString()}</Text>
        </View>
        <View style={styles.section}>
          <Text>Doctor: {presc.doctor_id}</Text>
          <Text>Patient: {presc.patient_id}</Text>
        </View>
        <View style={styles.section}>
          <Text>Medications:</Text>
          {items.map((it: any, i: number) => (
            <Text key={i} style={styles.small}>
              - {it.medication_name} | {it.dosage} | {it.frequency} | {it.duration}
            </Text>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.small}>Note: {presc.note || '-'}</Text>
        </View>
        {presc.qr && <Image src={presc.qr} style={{ width: 100, height: 100 }} />}
      </Page>
    </Document>
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const supabase = createSupabaseServerClient()
  const { data: presc, error } = await supabase.from("prescriptions").select("*").eq("id", id).single()
  if (error || !presc) return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 })
  const { data: items } = await supabase.from("prescription_items").select("*").eq("prescription_id", id)
  const qrData = `${process.env.NEXT_PUBLIC_APP_URL}/prescriptions/${id}`
  const qr = await QRCode.toDataURL(qrData)
  const pdfOutput: any = await pdf(<PrescriptionPDF presc={{ ...presc, qr }} items={items || []} />).toBuffer()
  return new Response(pdfOutput as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=prescription-${id}.pdf`,
    },
  })
}
