"use client"

import { useEffect, useState, useId } from "react"
import { useRouter } from "next/navigation"
import { useCharacterLimit } from "@/hooks/use-character-limit"
import { useImageUpload } from "@/hooks/use-image-upload"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ImagePlus, ArrowLeft, User, MapPin, Phone, Mail, Building, Github, Linkedin } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { checkOnboardingStatus, completeOnboarding } from "@/lib/supabase/onboarding-utils"
import { OnboardingForm } from "@/components/onboarding/onboarding-form"
import type { Session } from "@supabase/supabase-js"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

interface ProfileData {
  id?: string
  name: string
  role: "patient" | "doctor"
  email: string
  phone: string
  address: string
  specialty?: string
  doctor_languages?: string
  portfolio?: string
  company?: string
  github?: string
  linkedin?: string
  about: string
  avatar_url?: string
}

export default function EnhancedProfilePage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const { toast } = useToast()
  const id = useId()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [profileData, setProfileData] = useState<ProfileData>({
    name: "",
    role: "patient",
    email: "",
    phone: "",
    address: "",
    specialty: "",
    doctor_languages: "",
    portfolio: "",
    company: "",
    github: "",
    linkedin: "",
    about: "",
    avatar_url: "",
  })

  const maxLength = 180
  const { value: aboutText, characterCount, handleChange: handleAboutChange, setValue: setAboutValue } = useCharacterLimit({
    maxLength,
    initialValue: profileData.about,
  })

  const {
    previewUrl,
    fileInputRef,
    handleThumbnailClick,
    handleFileChange,
    isUploading,
  } = useImageUpload()

  const profileImage = previewUrl || profileData.avatar_url || "/placeholder-user.jpg"

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        
        if (session?.user?.id) {

          const onboardingStatus = await checkOnboardingStatus(session.user)
          
          if (onboardingStatus.isFirstTime && !onboardingStatus.hasProfile) {

            setShowOnboarding(true)
            setLoading(false)
            return
          }

          const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single()

          if (profile && !error) {

            const loadedData: ProfileData = {
              id: profile.id,
              name: profile.name || session.user.user_metadata?.full_name || "",
              role: profile.role || "patient",
              email: session.user.email || "",
              phone: profile.phone || "",
              address: profile.address || "",
              specialty: profile.specialty || "",
              doctor_languages: profile.doctor_languages || "",
              portfolio: profile.portfolio || "",
              company: profile.company || "",
              github: profile.github || "",
              linkedin: profile.linkedin || "",
              about: profile.about || "I'm passionate about healthcare and helping others.",
              avatar_url: profile.avatar_url || "",
            }
            setProfileData(loadedData)
            setAboutValue(loadedData.about)

            if (!onboardingStatus.onboardingCompleted) {
              setIsEditing(true) 
            } else {
              setIsEditing(false) 
            }
          } else if (session?.user) {

            setIsEditing(true)
            const initialData: ProfileData = {
              name: session.user.user_metadata?.full_name || "",
              role: session.user.user_metadata?.role || "patient",
              email: session.user.email || "",
              phone: "",
              address: "",
              specialty: "",
              doctor_languages: "",
              portfolio: "",
              company: "",
              github: "",
              linkedin: "",
              about: "",
              avatar_url: "",
            }
            setProfileData(initialData)
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  const handleCancel = () => {

    router.push('/')
  }

  const handleSave = async () => {

    if (!profileData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive",
      })
      return
    }

    if (!profileData.email.trim()) {
      toast({
        title: "Validation Error", 
        description: "Email is required",
        variant: "destructive",
      })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(profileData.email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      if (!session?.user?.id) {
        throw new Error("User session not found")
      }

      const updateData = {
        id: session.user.id,
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone || '',
        role: profileData.role,
        address: profileData.address || '',
        company: profileData.company || '',
        portfolio: profileData.portfolio || '',
        github: profileData.github || '',
        about: aboutText || '',
        avatar_url: previewUrl || profileData.avatar_url || '',
        specialty: profileData.specialty || '',
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      }

      console.log('Attempting to save profile with data:', updateData)

      const { error, data } = await supabase
        .from("profiles")
        .upsert(updateData, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()

      if (error) {
        console.error('Supabase error details:', error)
        throw new Error(`Database error: ${error.message} (Code: ${error.code})`)
      }

      console.log('Profile save successful:', data)

      setProfileData(prev => ({
        ...prev,
        ...updateData,
        about: aboutText,
        avatar_url: previewUrl || profileData.avatar_url,
      }))

      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully",
      })

      setIsEditing(false)
    } catch (error) {
      console.error("Error saving profile:", error)

      let errorMessage = "Failed to save profile. Please try again."
      
      if (error instanceof Error) {
        errorMessage = error.message
      }

      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }))
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    setIsEditing(false)

    window.location.reload()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Please log in to view your profile.</p>
            <Link href="/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showOnboarding && session.user) {
    return <OnboardingForm user={session.user} onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="min-h-screen bg-background">
      
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">My Profile</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        
        <Card className="w-full">
          <CardHeader className="relative">
            
            <div
              className="absolute inset-0 h-36 rounded-t-lg"
              style={{
                background: "radial-gradient(circle, rgba(238, 174, 202, 1) 0%, rgba(148, 187, 233, 1) 100%)",
              }}
            />

            <div className="relative -mb-12 flex justify-center pt-20">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                  <AvatarImage src={profileImage} alt="Profile" />
                  <AvatarFallback>
                    <User className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <>
                    <button
                      onClick={handleThumbnailClick}
                      className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label="Change profile picture"
                    >
                      <ImagePlus size={16} />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*"
                    />
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-16 space-y-6">
            
            {!isEditing ? (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold">{profileData.name || "Complete Your Profile"}</h2>
                  <Badge variant="secondary" className="capitalize">
                    {profileData.role}
                  </Badge>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{profileData.email}</span>
                    </div>
                    {profileData.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{profileData.phone}</span>
                      </div>
                    )}
                    {profileData.address && (
                      <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{profileData.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {profileData.company && (
                      <div className="flex items-center gap-3">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{profileData.company}</span>
                      </div>
                    )}
                    {profileData.role === "doctor" && profileData.specialty && (
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{profileData.specialty}</span>
                      </div>
                    )}
                  </div>
                </div>

                {profileData.about && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-2">About</h3>
                      <p className="text-muted-foreground">{profileData.about}</p>
                    </div>
                  </>
                )}

                <div className="flex justify-center pt-4">
                  <Button onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`${id}-name`}>Full Name</Label>
                    <Input
                      id={`${id}-name`}
                      placeholder="E.g. John Doe"
                      value={profileData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`${id}-role`}>Role</Label>
                    <Input
                      id={`${id}-role`}
                      value={profileData.role === "doctor" ? "Doctor" : "Patient"}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`${id}-email`}>Email</Label>
                    <Input
                      id={`${id}-email`}
                      type="email"
                      value={profileData.email}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`${id}-phone`}>Phone</Label>
                    <Input
                      id={`${id}-phone`}
                      placeholder="+1 (555) 000-0000"
                      value={profileData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`${id}-address`}>Address</Label>
                    <Input
                      id={`${id}-address`}
                      placeholder="Your full address"
                      value={profileData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`${id}-company`}>Company</Label>
                    <Input
                      id={`${id}-company`}
                      placeholder="Your workplace"
                      value={profileData.company}
                      onChange={(e) => handleInputChange("company", e.target.value)}
                    />
                  </div>
                </div>

                {profileData.role === "doctor" && (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`${id}-specialty`}>Medical Specialty</Label>
                      <Input
                        id={`${id}-specialty`}
                        placeholder="E.g. General Practice, Cardiology"
                        value={profileData.specialty}
                        onChange={(e) => handleInputChange("specialty", e.target.value)}
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`${id}-languages`}>Languages Spoken</Label>
                      <Input
                        id={`${id}-languages`}
                        placeholder="E.g. English, Hindi, Punjabi"
                        value={profileData.doctor_languages}
                        onChange={(e) => handleInputChange("doctor_languages", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`${id}-portfolio`}>Portfolio/Website</Label>
                    <Input
                      id={`${id}-portfolio`}
                      placeholder="https://your-website.com"
                      value={profileData.portfolio}
                      onChange={(e) => handleInputChange("portfolio", e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`${id}-github`}>GitHub</Label>
                    <Input
                      id={`${id}-github`}
                      placeholder="https://github.com/username"
                      value={profileData.github}
                      onChange={(e) => handleInputChange("github", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-about`}>About</Label>
                  <Textarea
                    id={`${id}-about`}
                    placeholder="Tell us a little about yourself..."
                    value={aboutText}
                    onChange={handleAboutChange}
                    maxLength={maxLength}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {maxLength - characterCount} characters left
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    className="sm:flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || isUploading}
                    className="sm:flex-1"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}