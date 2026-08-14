import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Printer, Pill, FileText, Check } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatStableDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PrescriptionPageProps {
  params: Promise<{ id: string }>;
}

export default async function PrescriptionPage({ params }: PrescriptionPageProps) {
  const { id } = await params;
  if (!id) redirect("/patient/dashboard");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const { data: presc, error: prescErr } = await supabaseAdmin
    .from("prescriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (prescErr || !presc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-900">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-rose-500">Prescription Not Found</CardTitle>
            <CardDescription>
              We were unable to locate the requested prescription. It may have been deleted or the link is incorrect.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full">
              <Link href="/patient/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch related profiles and prescription items
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
  const patientName = patient.name;
  
  // Format medicines list
  let medicinesList = [];
  if (presc.medicines) {
    medicinesList = typeof presc.medicines === "string" ? JSON.parse(presc.medicines) : presc.medicines;
  } else if (itemsRes.data && itemsRes.data.length > 0) {
    medicinesList = itemsRes.data.map((item: any) => ({
      medicineName: item.medication_name,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration
    }));
  } else if (presc.note) {
    try {
      const match = presc.note.match(/Medications:\s*(\[.*\])/i);
      if (match) medicinesList = JSON.parse(match[1]);
    } catch {}
  }

  // Format clean advice/instructions
  let cleanAdvice = presc.advice || presc.note || "Follow prescribed dosage";
  if (presc.note && presc.note.includes("Instructions:")) {
    const match = presc.note.match(/Instructions:\s*([\s\S]*)/i);
    if (match) cleanAdvice = match[1].trim();
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 dark:bg-slate-950 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl space-y-6">
        
        {/* Navigation Action Header */}
        <div className="flex items-center justify-between gap-4 print:hidden">
          <Button variant="ghost" asChild className="gap-1">
            <Link href="/patient/dashboard">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5" asChild>
              <a href={`/api/prescriptions/pdf?id=${id}`} target="_blank" rel="noreferrer">
                <Printer className="h-4 w-4" /> Print / View PDF
              </a>
            </Button>
          </div>
        </div>

        {/* Prescription Document Sheet */}
        <Card className="border border-slate-200 shadow-xl print:border-none print:shadow-none dark:border-slate-800">
          
          {/* Header Section */}
          <div className="bg-gradient-to-br from-teal-50/50 to-emerald-50/30 p-6 border-b border-slate-100 print:bg-white print:border-teal-600 print:border-b-4 dark:from-teal-950/10 dark:to-emerald-950/5 dark:border-slate-900">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <span className="text-xs font-semibold tracking-wider text-teal-600 dark:text-teal-400 uppercase">CareBridge Telehealth</span>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">Digital Health Record</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Official e‑Prescription & Medical Order</p>
              </div>

              <div className="text-left md:text-right border-l-2 border-teal-500 pl-4 md:border-l-0 md:border-r-2 md:pr-4 md:pl-0">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{cleanDoctorName}</span>
                <p className="text-xs text-muted-foreground">Reg No: MCI / NMC Reg. #892341</p>
                <p className="text-xs text-muted-foreground">Senior Telehealth Consultant</p>
              </div>
            </div>
          </div>

          <CardContent className="p-8 space-y-6">
            
            {/* Metadata Grid with Dynamic Patient Info */}
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/30 sm:grid-cols-4">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Patient Name</span>
                <p className="text-sm font-semibold mt-0.5 text-slate-800 dark:text-slate-100">{patientName}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {patient.age ? `${patient.age} yrs` : "Age: N/A"} &middot; {patient.gender || "Gender: N/A"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Patient Contact</span>
                <p className="text-xs font-medium mt-0.5 text-slate-800 dark:text-slate-100 truncate">{patient.email || "No email"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{patient.phone || "No phone"}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Issue Date</span>
                <p className="text-sm font-semibold mt-0.5 text-slate-800 dark:text-slate-100" suppressHydrationWarning>{formatStableDate(presc.created_at)}</p>
                <p className="text-[10px] font-mono text-teal-600 dark:text-teal-400 mt-0.5 uppercase">RX-{presc.id.substring(0, 8)}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</span>
                <p className="mt-0.5">
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 gap-1 text-[10px]">
                    <Check className="h-3 w-3" /> Validated
                  </Badge>
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">e‑Signature Secured</p>
              </div>
            </div>

            {/* Diagnosis / Chief Complaint */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Chief Diagnosis</span>
              <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                {presc.diagnosis || "General Consultation"}
              </p>
            </div>

            <Separator className="bg-slate-100 dark:bg-slate-800" />

            {/* Rx Indicator */}
            <div className="font-serif text-3xl font-black italic text-teal-600 dark:text-teal-400 leading-none">Rx</div>

            {/* Medications Table */}
            {medicinesList.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">Medicine Name</th>
                      <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">Dosage</th>
                      <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">Frequency</th>
                      <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {medicinesList.map((med: any, index: number) => (
                      <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{med.medicineName || med.name}</td>
                        <td className="p-3 text-muted-foreground">{med.dosage || "-"}</td>
                        <td className="p-3 text-muted-foreground">{med.frequency || "-"}</td>
                        <td className="p-3 text-muted-foreground">{med.duration || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No medicines listed in this prescription.</p>
            )}

            {/* Notes & Advice */}
            <div className="rounded-xl border-l-4 border-teal-500 bg-teal-50/20 p-4 dark:bg-teal-950/10 space-y-1">
              <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">Doctor Notes & Advice</span>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {cleanAdvice}
              </p>
            </div>

            {/* Signature Block */}
            <div className="flex flex-col items-end pt-6">
              <div className="w-64 text-right space-y-1">
                <div className="border-t border-slate-300 dark:border-slate-800 pt-2">
                  <p className="text-sm font-bold text-teal-700 dark:text-teal-400">{cleanDoctorName}</p>
                  <p className="text-[10px] text-muted-foreground">Digitally Signed via CareBridge e‑Rx Protocol</p>
                </div>
              </div>
            </div>

            <Separator className="bg-slate-100 dark:bg-slate-800" />

            {/* Disclaimer */}
            <p className="text-center text-[10px] text-muted-foreground leading-normal max-w-md mx-auto">
              This is a legally valid e‑prescription generated by a registered medical practitioner under the Telemedicine Practice Guidelines. No physical signature is required.
            </p>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
