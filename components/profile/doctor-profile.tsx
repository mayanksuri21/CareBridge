"use client"
import { useEffect, useMemo, useState } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export default function DoctorProfile() {
  const supabase = createSupabaseBrowserClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [language, setLanguage] = useState("en")
  const [address, setAddress] = useState("")
  const [specialty, setSpecialty] = useState("")
  const [doctorLanguages, setDoctorLanguages] = useState<string>("")
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: userRes } = await supabase.auth.getUser()
        const uid = userRes.user?.id
        if (!uid) return
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .single()
        
        if (profile) {
          setName(profile.name || "")
          setPhone(profile.phone || "")
          setLanguage(profile.language || "en")
          setAddress(profile.address || "")
          setSpecialty(profile.specialty || "")
          setDoctorLanguages(profile.doctor_languages || "")
        }
      } catch (error) {
        console.error("Error loading profile:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const save = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const uid = userRes.user?.id
      if (!uid) return

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: uid,
          name,
          phone,
          language,
          address,
          specialty,
          doctor_languages: doctorLanguages,
          role: "doctor"
        })

      if (error) throw error
      setStatus("Profile saved successfully!")
    } catch (error) {
      console.error("Error saving profile:", error)
      setStatus("Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  const completionPercentage = useMemo(() => {
    const fields = [name, phone, address, specialty, doctorLanguages]
    const completed = fields.filter(field => field.trim().length > 0).length
    return Math.round((completed / fields.length) * 100)
  }, [name, phone, address, specialty, doctorLanguages])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Doctor Profile</h1>
        <p className="text-muted-foreground mb-8">Manage your professional information</p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Profile Completion</CardTitle>
            <CardDescription>Complete your profile to start accepting patients</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={completionPercentage} className="mb-2" />
            <p className="text-sm text-muted-foreground">{completionPercentage}% complete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Full Name</label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. John Doe"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="specialty" className="text-sm font-medium">Medical Specialty</label>
              <Input
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="General Practice, Cardiology, etc."
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">Phone Number</label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium">Practice Address</label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Clinic/Hospital Address"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="languages" className="text-sm font-medium">Languages Spoken</label>
              <Input
                id="languages"
                value={doctorLanguages}
                onChange={(e) => setDoctorLanguages(e.target.value)}
                placeholder="English, Hindi, Punjabi"
              />
            </div>

            {status && (
              <p className={`text-sm ${status.includes("successfully") ? "text-green-600" : "text-red-600"}`}>
                {status}
              </p>
            )}

            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}