import Link from "next/link"

import { PrescriptionModal } from "@/components/doctor/prescription-modal"
import { requireDoctorVerification } from "@/lib/supabase/doctor-verification"
import { TodayConsultations } from "@/components/doctor/today-consultations"
import { Button } from "@/components/ui/button"

export default async function DoctorDashboard() {
  const result = await requireDoctorVerification("approved")

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-primary">CareBridge</Link>
        <nav>
          <Button asChild variant="ghost" size="sm"><Link href="/doctor/dashboard">Dashboard</Link></Button>
        </nav>
      </header>
      <h1 className="text-2xl font-bold">Doctor Dashboard</h1>

      <p className="mt-4">
        Logged in as: {result.user.email}
      </p>

      <p>
        Verification status: {result.application?.status}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <p className="mr-auto text-sm font-medium">Quick Actions</p>
        <PrescriptionModal doctorId={result.user.id} />
        <Button asChild variant="outline">
          <Link href="/consultation/demo-session">Join Video Call</Link>
        </Button>
      </div>

      <div className="mt-6">
        <TodayConsultations doctorId={result.user.id} />
      </div>
    </main>
  )
}
