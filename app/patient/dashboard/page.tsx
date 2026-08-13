import { redirect } from "next/navigation"
import { Activity, ArrowRight, CalendarDays, FileText, Stethoscope } from "lucide-react"

import { PatientDashboardClient } from "@/components/patient/patient-dashboard-client"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { PrintablePrescription } from "@/lib/generate-prescription-pdf"

export const dynamic = "force-dynamic"

type PatientProfile = {
  id: string
  name: string | null
  email: string | null
  language: string | null
}

export default async function PatientDashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login?role=patient")

  const [{ data: profile }, { data: prescriptionsRaw, error: rxError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, email, language")
      .eq("id", user.id)
      .maybeSingle(),

    supabase
      .from("prescriptions")
      .select("id, created_at, doctor_name, diagnosis, medicines, advice")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false }),
  ])

  const { data: profileCheck } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileCheck?.role === "doctor") redirect("/doctor/dashboard")

  const patient: PatientProfile = profile ?? {
    id: user.id,
    name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Patient",
    email: user.email ?? null,
    language: "en",
  }

  const prescriptions: PrintablePrescription[] = rxError
    ? []
    : ((prescriptionsRaw ?? []) as unknown as PrintablePrescription[])

  return (
    <PatientDashboardClient
      patientId={patient.id}
      patientName={patient.name ?? "Patient"}
      patientEmail={patient.email}
      initialPrescriptions={prescriptions}
    />
  )
}

