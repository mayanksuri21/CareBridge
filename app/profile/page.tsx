"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Globe, 
  Github, 
  Stethoscope,
  Camera,
  Edit3,
  Save,
  X,
  ArrowLeft,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import Link from "next/link"
import type { Session } from "@supabase/supabase-js"
import { TextEffect } from "@/components/ui/text-effect"

interface ProfileData {
  id: string
  name: string
  email: string
  phone: string
  role: "patient" | "doctor"
  address: string
  company: string
  portfolio: string
  github: string
  about: string
  avatar_url: string
  specialty: string
  language: string
  onboarding_completed: boolean
  first_login_at: string
  created_at: string
  updated_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const { toast } = useToast()
  
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [profileData, setProfileData] = useState<Partial<ProfileData>>({})
  const [profileCompleteness, setProfileCompleteness] = useState(0)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")

  useEffect(() => {
    const loadProfile = async () => {
      try {
        console.log("Profile page: Testing Supabase connection...")
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        console.log("Profile page: Supabase URL:", supabaseUrl ? "Set" : "Missing")
        console.log("Profile page: Supabase Key:", supabaseKey ? "Set (length: " + supabaseKey.length + ")" : "Missing")
        
        console.log("Profile page: Starting to load session...")
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log("Profile page: Session result:", session ? "Session exists" : "No session", sessionError)
        
        if (sessionError) {
          console.error("Session error:", sessionError)
          setLoading(false)
          toast({
            title: "Authentication Error",
            description: "Please log in to access your profile",
            variant: "destructive"
          })
          router.push("/login")
          return
        }

        if (!session) {
          console.log("Profile page: No session found, redirecting to login")
          setLoading(false)
          toast({
            title: "Not Authenticated",
            description: "Please log in to access your profile",
            variant: "destructive"
          })
          router.push("/login")
          return
        }

        console.log("Profile page: Session found, user ID:", session.user.id)
        setSession(session)

        console.log("Profile page: Checking for existing profile...")
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()

        console.log("Profile page: Profile query result:", profile ? "Profile found" : "No profile", profileError)

        if (profileError && profileError.code !== 'PGRST116') {
          console.error("Profile error:", profileError)
        }

        if (!profile) {
          console.log("Profile page: No profile found, showing onboarding")
          setShowOnboarding(true)
          setProfileData({
            name: session.user.user_metadata?.full_name || "",
            email: session.user.email || "",
            role: "patient",
            phone: "",
            address: "",
            company: "",
            portfolio: "",
            github: "",
            about: "",
            avatar_url: "",
            specialty: "",
            language: "en"
          })
        } else {
          console.log("Profile page: Profile found, loading data:", profile.name)
          setProfileData(profile)
          
          if (!profile.onboarding_completed) {
            console.log("Profile page: Onboarding not completed, showing onboarding")
            setShowOnboarding(true)
          }
        }

        calculateCompleteness(profile || {})
        console.log("Profile page: Loading completed successfully")
        
      } catch (error) {
        console.error("Error loading profile:", error)
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive"
        })
      } finally {
        console.log("Profile page: Setting loading to false")
        setLoading(false)
      }
    }

    console.log("Profile page: useEffect triggered, calling loadProfile")
    loadProfile()
  }, [])

  const calculateCompleteness = (profile: any) => {
    const requiredFields = ['name', 'email', 'phone', 'role']
    const optionalFields = ['address', 'about', 'avatar_url']
    const roleSpecificFields = profile.role === 'doctor' ? ['specialty'] : []
    
    const allFields = [...requiredFields, ...optionalFields, ...roleSpecificFields]
    const completedFields = allFields.filter(field => profile[field] && profile[field].trim() !== "")
    
    const percentage = Math.round((completedFields.length / allFields.length) * 100)
    setProfileCompleteness(percentage)
  }

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    const updatedData = { ...profileData, [field]: value }
    setProfileData(updatedData)
    calculateCompleteness(updatedData)
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    if (!session?.user?.id) return

    if (!profileData.name?.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive"
      })
      return
    }

    if (!profileData.email?.trim()) {
      toast({
        title: "Validation Error",
        description: "Email is required",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      let avatarUrl = profileData.avatar_url
      if (selectedImage) {
        console.log("Uploading image:", selectedImage.name)
        const fileExt = selectedImage.name.split('.').pop()
        const fileName = `${session.user.id}-${Date.now()}.${fileExt}`
        const filePath = `avatars/${fileName}`

        try {
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('profile-images')
            .upload(filePath, selectedImage, {
              cacheControl: '3600',
              upsert: true 
            })

          if (uploadError) {
            console.error('Upload error:', uploadError)

            if (uploadError.message.includes('not found')) {
              console.log('Bucket not found, trying to create...')

              avatarUrl = imagePreview || profileData.avatar_url
              toast({
                title: "Image Upload Info",
                description: "Using image preview. Contact admin to set up storage bucket.",
                variant: "default"
              })
            } else {
              throw uploadError
            }
          } else {

            const { data: { publicUrl } } = supabase.storage
              .from('profile-images')
              .getPublicUrl(filePath)
            
            console.log('Image uploaded successfully:', publicUrl)
            avatarUrl = publicUrl
          }
        } catch (storageError) {
          console.error('Storage error:', storageError)

          avatarUrl = imagePreview || profileData.avatar_url
          toast({
            title: "Image Upload Warning",
            description: "Using local image. Upload may not persist across sessions.",
            variant: "default"
          })
        }
      } else if (imagePreview && !avatarUrl) {

        avatarUrl = imagePreview
      }

      const updateData = {
        id: session.user.id,
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone || '',
        role: profileData.role || 'patient',
        address: profileData.address || '',
        company: profileData.company || '',
        portfolio: profileData.portfolio || '',
        github: profileData.github || '',
        about: profileData.about || '',
        avatar_url: avatarUrl || '',
        specialty: profileData.specialty || '',
        language: profileData.language || 'en',
        onboarding_completed: true,
        first_login_at: profileData.first_login_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log('Saving profile data:', updateData)

      const { error, data } = await supabase
        .from("profiles")
        .upsert(updateData, { onConflict: 'id' })
        .select()

      if (error) {
        console.error('Database error:', error)
        throw new Error(`Database error: ${error.message}`)
      }

      console.log('Profile saved successfully:', data)

      setProfileData(updateData)
      setSelectedImage(null)
      setImagePreview("")
      setIsEditing(false)
      setShowOnboarding(false)
      calculateCompleteness(updateData)

      window.location.reload() 

      toast({
        title: "Success",
        description: "Profile updated successfully!",
      })

    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSkipOnboarding = async () => {
    if (!session?.user?.id) return

    try {
      const basicData = {
        id: session.user.id,
        name: session.user.user_metadata?.full_name || "User",
        email: session.user.email || "",
        role: 'patient' as const,
        phone: '',
        address: '',
        company: '',
        portfolio: '',
        github: '',
        about: '',
        avatar_url: '',
        specialty: '',
        language: 'en',
        onboarding_completed: false,
        first_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from("profiles")
        .upsert(basicData, { onConflict: 'id' })

      if (error) throw error

      setProfileData(basicData)
      setShowOnboarding(false)
      calculateCompleteness(basicData)

    } catch (error) {
      console.error("Skip onboarding error:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-foreground">Loading your profile...</p>
            <p className="text-sm text-muted-foreground">This may take a moment</p>
            <Button 
              variant="outline" 
              onClick={() => {
                console.log("User clicked force reload")
                window.location.reload()
              }}
              className="mt-4"
            >
              Refresh Page
            </Button>
          </div>
        </div>
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

  const isOnboarding = showOnboarding || !profileData.onboarding_completed
  const currentImage = imagePreview || profileData.avatar_url || "/placeholder-user.jpg"

    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        
        <div className="border-b bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Home
                  </Button>
                </Link>
                <h1 className="text-2xl font-bold">
                  {isOnboarding ? "Complete Your Profile" : "My Profile"}
                </h1>
              </div>
              
              {!isOnboarding && (
                <Button
                  onClick={() => setIsEditing(!isEditing)}
                  variant={isEditing ? "outline" : "default"}
                  size="sm"
                  className="gap-2"
                >
                  {isEditing ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                  {isEditing ? "Cancel" : "Edit Profile"}
                </Button>
              )}
            </div>
          </div>
        </div>      <div className="container mx-auto px-4 py-8 max-w-4xl">
        
        {profileCompleteness < 100 && (
          <Card className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Profile {profileCompleteness}% Complete
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-300">
                    Complete your profile to unlock all features
                  </p>
                </div>
                <div className="w-32">
                  <Progress value={profileCompleteness} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden border-border bg-card">
          <div className="h-32 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
          
          <CardContent className="relative px-6 pb-6">
            
            <div className="flex flex-col sm:flex-row sm:items-end gap-6 -mt-16 mb-6">
              <div className="relative">
                <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                  <AvatarImage src={currentImage} alt="Profile" />
                  <AvatarFallback className="text-2xl">
                    <User className="h-16 w-16" />
                  </AvatarFallback>
                </Avatar>
                
                {(isEditing || isOnboarding) && (
                  <label className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div>
                  <TextEffect
                    per="char"
                    preset="fade"
                    className="text-3xl font-bold"
                    delay={0.3}
                  >
                    {profileData.name || "Complete Your Profile"}
                  </TextEffect>
                  {profileData.role && (
                    <Badge variant="secondary" className="capitalize mt-1">
                      {profileData.role}
                    </Badge>
                  )}
                </div>                  {profileCompleteness === 100 && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Profile Complete</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {(isEditing || isOnboarding) ? (
                <>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={profileData.name || ""}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        placeholder="Enter your full name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Role *</Label>
                      <Select
                        value={profileData.role || "patient"}
                        onValueChange={(value: "patient" | "doctor") => handleInputChange("role", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="patient">Patient</SelectItem>
                          <SelectItem value="doctor">Doctor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email || ""}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="your.email@example.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={profileData.phone || ""}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={profileData.address || ""}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        placeholder="Your full address"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company">Company/Organization</Label>
                      <Input
                        id="company"
                        value={profileData.company || ""}
                        onChange={(e) => handleInputChange("company", e.target.value)}
                        placeholder="Where you work"
                      />
                    </div>

                    {profileData.role === "doctor" && (
                      <div className="space-y-2">
                        <Label htmlFor="specialty">Medical Specialty</Label>
                        <Input
                          id="specialty"
                          value={profileData.specialty || ""}
                          onChange={(e) => handleInputChange("specialty", e.target.value)}
                          placeholder="e.g. Cardiology, General Practice"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="portfolio">Portfolio/Website</Label>
                      <Input
                        id="portfolio"
                        value={profileData.portfolio || ""}
                        onChange={(e) => handleInputChange("portfolio", e.target.value)}
                        placeholder="https://your-website.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="github">GitHub Profile</Label>
                      <Input
                        id="github"
                        value={profileData.github || ""}
                        onChange={(e) => handleInputChange("github", e.target.value)}
                        placeholder="https://github.com/username"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="about">About Me</Label>
                      <Textarea
                        id="about"
                        value={profileData.about || ""}
                        onChange={(e) => handleInputChange("about", e.target.value)}
                        placeholder="Tell us about yourself..."
                        rows={4}
                        maxLength={300}
                      />
                      <p className="text-xs text-muted-foreground">
                        {300 - (profileData.about?.length || 0)} characters remaining
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    {isOnboarding && (
                      <Button
                        variant="outline"
                        onClick={handleSkipOnboarding}
                        className="sm:flex-1"
                      >
                        Skip for Now
                      </Button>
                    )}
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="sm:flex-1 gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? "Saving..." : "Save Profile"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <span>{profileData.email}</span>
                      </div>
                      
                      {profileData.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                          <span>{profileData.phone}</span>
                        </div>
                      )}
                      
                      {profileData.address && (
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                          <span>{profileData.address}</span>
                        </div>
                      )}
                      
                      {profileData.company && (
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <span>{profileData.company}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {profileData.role === "doctor" && profileData.specialty && (
                        <div className="flex items-center gap-3">
                          <Stethoscope className="h-5 w-5 text-muted-foreground" />
                          <span>{profileData.specialty}</span>
                        </div>
                      )}
                      
                      {profileData.portfolio && (
                        <div className="flex items-center gap-3">
                          <Globe className="h-5 w-5 text-muted-foreground" />
                          <a 
                            href={profileData.portfolio} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Portfolio
                          </a>
                        </div>
                      )}
                      
                      {profileData.github && (
                        <div className="flex items-center gap-3">
                          <Github className="h-5 w-5 text-muted-foreground" />
                          <a 
                            href={profileData.github} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            GitHub
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {profileData.about && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold mb-3">About Me</h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {profileData.about}
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

