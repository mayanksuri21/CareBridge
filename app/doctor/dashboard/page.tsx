import { requireDoctorVerification } from "@/lib/supabase/doctor-verification"

export default async function DoctorDashboard() {
  const result = await requireDoctorVerification("approved")

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">Doctor Dashboard</h1>

      <p className="mt-4">
        Logged in as: {result.user.email}
      </p>

      <p>
        Verification status: {result.application?.status}
      </p>
    </main>
  )
}