import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type DoctorVerificationStatus = "pending" | "approved" | "rejected"

export async function requireDoctorVerification(allowedStatus?: DoctorVerificationStatus) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?role=doctor")

  const [{ data: profile }, { data: application }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("doctor_verification_applications").select("status, rejection_reason").eq("doctor_id", user.id).maybeSingle(),
  ])

  if (profile?.role !== "doctor") redirect("/")
  const status = application?.status as DoctorVerificationStatus | undefined
  if (!status) redirect("/doctor-verification")
  if (allowedStatus && status !== allowedStatus) {
    if (status === "approved") redirect("/doctor/dashboard")
    if (status === "rejected") redirect("/doctor/verification-rejected")
    redirect("/doctor/verification-pending")
  }
  return { user, application: application ? { status, rejectionReason: application.rejection_reason } : null }
}
