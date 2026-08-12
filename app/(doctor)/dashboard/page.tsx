import Link from "next/link"
import { Button } from "@/components/ui/button"
import { requireDoctorVerification } from "@/lib/supabase/doctor-verification"

export default async function DoctorDashboard() {
  await requireDoctorVerification("approved")

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Doctor Dashboard</h1>

        <Link href="/profile">
          <Button size="sm">Edit Profile</Button>
        </Link>
      </div>
    </div>
  )
}