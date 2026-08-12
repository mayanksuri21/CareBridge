import Link from "next/link"
import { Clock3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireDoctorVerification } from "@/lib/supabase/doctor-verification"

export default async function VerificationPendingPage() {
  await requireDoctorVerification("pending")
  return <main className="container mx-auto max-w-2xl px-4 py-16"><Card><CardHeader><Clock3 className="h-9 w-9 text-amber-600" /><CardTitle>Your verification is under review</CardTitle><CardDescription>Your email confirmation only confirms your account. It does not approve you to practise on CareBridge.</CardDescription></CardHeader><CardContent className="space-y-4"><p>Our authorized verification team is reviewing your professional information and private documents. Doctor dashboard access will be enabled only after approval.</p><Link href="/doctor-verification"><Button variant="outline">View application</Button></Link></CardContent></Card></main>
}
