import Link from "next/link"
import { XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireDoctorVerification } from "@/lib/supabase/doctor-verification"

export default async function VerificationRejectedPage() {
  const { application } = await requireDoctorVerification("rejected")
  return <main className="container mx-auto max-w-2xl px-4 py-16"><Card><CardHeader><XCircle className="h-9 w-9 text-destructive" /><CardTitle>Verification was not approved</CardTitle><CardDescription>Doctor dashboard access remains unavailable until a future application is approved.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-md border border-destructive/30 bg-destructive/5 p-4"><p className="font-medium">Rejection reason</p><p className="mt-1 text-sm">{application?.rejectionReason}</p></div><Link href="/doctor-verification"><Button>Review and resubmit application</Button></Link></CardContent></Card></main>
}
