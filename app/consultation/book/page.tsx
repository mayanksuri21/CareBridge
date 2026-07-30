"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Calendar, Clock, Stethoscope } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export default function BookConsultationPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [doctors, setDoctors] = useState<any[]>([])
  const [slots, setSlots] = useState<any[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<string>("")
  const [selectedSlot, setSelectedSlot] = useState<string>("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from("doctors").select("id, profiles(name), specialty, languages").then(({ data }) => {
      setDoctors(data || [])
    })
  }, [])

  useEffect(() => {
    if (!selectedDoctor) return
    supabase
      .from("schedule_slots")
      .select("id, start_time, end_time, is_booked")
      .eq("doctor_id", selectedDoctor)
      .eq("is_booked", false)
      .order("start_time")
      .then(({ data }) => setSlots(data || []))
  }, [selectedDoctor])

  const book = async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      alert("Please login first")
      setLoading(false)
      return
    }
    const { error: apptErr, data: appt } = await supabase
      .from("appointments")
      .insert({ patient_id: user.id, doctor_id: selectedDoctor, slot_id: selectedSlot, reason })
      .select()
      .single()
    if (apptErr) {
      alert(apptErr.message)
      setLoading(false)
      return
    }
    await supabase.from("schedule_slots").update({ is_booked: true }).eq("id", selectedSlot)
    setLoading(false)
    window.location.href = `/consultation/${appt.id}`
  }

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
              <Stethoscope className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Book Appointment</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Doctor and Time</CardTitle>
              <CardDescription>Choose a doctor and an available slot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Doctor</label>
                <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.profiles?.name || d.id} • {d.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Available Slots</label>
                <Select value={selectedSlot} onValueChange={setSelectedSlot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a time" />
                  </SelectTrigger>
                  <SelectContent>
                    {slots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          {new Date(s.start_time).toLocaleString()} - {new Date(s.end_time).toLocaleTimeString()}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Reason</label>
                <Textarea placeholder="Describe your symptoms" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>

              <Button onClick={book} disabled={!selectedDoctor || !selectedSlot || !reason || loading} className="w-full">
                <Calendar className="w-4 h-4 mr-2" /> Book Appointment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
