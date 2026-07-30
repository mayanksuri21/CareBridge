"use client"
import { useEffect, useMemo, useState } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export default function PatientProfile() {
  const supabase = createSupabaseBrowserClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [language, setLanguage] = useState("en")
  const [address, setAddress] = useState("")
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: userRes, error: userError } = await supabase.auth.getUser()
        if (userError) {
          console.error("Error getting user:", userError)
          setStatus("Failed to load user information")
          return
        }
        
        const uid = userRes.user?.id
        if (!uid) {
          setStatus("No user found. Please log in.")
          return
        }
        
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .single()
        
        if (profileError) {
          if (profileError.code === 'PGRST116') {
            console.log("No existing profile found, user can create one")
          } else {
            console.error("Error loading profile:", profileError)
            setStatus("Failed to load profile information")
          }
        } else if (profile) {
          setName(profile.name || "")
          setPhone(profile.phone || "")
          setLanguage(profile.language || "en")
          setAddress(profile.address || "")
        }
      } catch (error) {
        console.error("Unexpected error loading profile:", error)
        setStatus("An unexpected error occurred while loading your profile")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  const save = async () => {
    if (saving) return 
    
    setSaving(true)
    setStatus(null)
    
    try {
      const { data: userRes, error: userError } = await supabase.auth.getUser()
      if (userError) {
        throw new Error(`Authentication error: ${userError.message}`)
      }
      
      const uid = userRes.user?.id
      if (!uid) {
        throw new Error("No user ID found. Please log in again.")
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: uid,
          name: name.trim(),
          phone: phone.trim(),
          language,
          address: address.trim(),
          role: "patient"
        })

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }
      
      setStatus("Profile saved successfully!")
      setTimeout(() => setStatus(null), 3000)
    } catch (error) {
      console.error("Error saving profile:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save profile"
      setStatus(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const completionPercentage = useMemo(() => {
    const fields = [name, phone, address]
    const completed = fields.filter(field => field.trim().length > 0).length
    return Math.round((completed / fields.length) * 100)
  }, [name, phone, address])

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
        <h1 className="text-2xl font-bold mb-2">Patient Profile</h1>
        <p className="text-muted-foreground mb-8">Manage your personal information</p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Profile Completion</CardTitle>
            <CardDescription>Complete your profile for better healthcare experience</CardDescription>
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
                placeholder="John Doe"
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
              <label htmlFor="address" className="text-sm font-medium">Address</label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Your Address"
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