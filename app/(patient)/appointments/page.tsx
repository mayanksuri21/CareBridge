"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Calendar } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export default function PatientAppointments() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [appointments, setAppointments] = useState<any[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      const { data: appts } = await supabase
        .from("appointments")
        .select("id, doctor_id, reason, created_at, status")
        .eq("patient_id", uid)
        .order("created_at", { ascending: false })
      setAppointments(appts || [])
    })
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">My Appointments</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-4">
        {appointments.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle>Appointment #{a.id.slice(0,8)} • {new Date(a.created_at).toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm">Reason: {a.reason}</div>
              <Link href={`/consultation/${a.id}`}>
                <Button>Join</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
