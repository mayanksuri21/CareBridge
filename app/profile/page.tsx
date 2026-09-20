"use client"

import { useEffect, useMemo, useState } from "react"
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
  AlertCircle,
  Calendar as CalendarIcon
} from "lucide-react"
import Link from "next/link"
import type { Session } from "@supabase/supabase-js"
import { TextEffect } from "@/components/ui/text-effect"
import { useAuth } from "@/components/auth-provider"
import { calculateAge, cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

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
  date_of_birth?: string | null
  age?: number | string | null
  gender?: string | null
  blood_group?: string | null
  emergency_contact?: string | null
  allergies?: string | null
}

function formatDobISO(rawDob?: string | null): string {
  if (!rawDob) return '';
  const trimmed = rawDob.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.includes('T')) {
    const part = trimmed.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

function parseDobToLocalDate(dobISO?: string | null): Date | undefined {
  const iso = formatDobISO(dobISO);
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatLocalDateToISO(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDisplayDate(dobISO?: string | null): string {
  const iso = formatDobISO(dobISO);
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const { toast } = useToast()
  const { session: authSession, loading: authLoading, refreshProfile } = useAuth()
  
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [profileData, setProfileData] = useState<Partial<ProfileData>>({})
  const [profileCompleteness, setProfileCompleteness] = useState(0)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [dobPickerOpen, setDobPickerOpen] = useState(false)
  const [pickerMonth, setPickerMonth] = useState<Date>(new Date(1995, 0, 1))

  const parsedDobDate = useMemo(() => {
    return parseDobToLocalDate(profileData.date_of_birth);
  }, [profileData.date_of_birth]);

  useEffect(() => {
    if (parsedDobDate) {
      setPickerMonth(parsedDobDate);
    } else {
      setPickerMonth(new Date(1995, 0, 1));
    }
  }, [parsedDobDate]);

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      if (authLoading) return

      try {
        const effectiveUser = authSession?.user
        if (!effectiveUser) {
          if (!isMounted) return
          console.log("Profile page: No session found, redirecting to login")
          toast({
            title: "Not Authenticated",
            description: "Please log in to access your profile",
            variant: "destructive"
          })
          router.push("/login")
          return
        }

        setSession(authSession)
        setFetchError(null)

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, name, email, phone, role, address, company, portfolio, github, about, avatar_url, specialty, language, onboarding_completed, first_login_at, created_at, updated_at, age, gender")
          .eq("id", effectiveUser.id)
          .maybeSingle()

        if (!isMounted) return

        if (profileError) {
          console.error("Profile error returned from Supabase:", profileError)
          setFetchError(profileError.message || "Failed to load profile data from database")
          return
        }

        if (!profile) {
          const rawUserDob = effectiveUser.user_metadata?.date_of_birth || effectiveUser.user_metadata?.dob || "";
          const userDob = formatDobISO(rawUserDob);
          setShowOnboarding(true)
          const defaultData: Partial<ProfileData> = {
            name: effectiveUser.user_metadata?.full_name || effectiveUser.user_metadata?.name || "",
            email: effectiveUser.email || "",
            role: "patient",
            phone: "",
            address: "",
            company: "",
            portfolio: "",
            github: "",
            about: "",
            avatar_url: "",
            specialty: "",
            language: "en",
            date_of_birth: userDob,
            age: userDob ? (calculateAge(userDob) ?? "") : "",
            gender: effectiveUser.user_metadata?.gender || "",
            blood_group: "",
            emergency_contact: "",
            allergies: ""
          }
          setProfileData(defaultData)
          calculateCompleteness(defaultData)
        } else {
          const isJsonAbout = profile.about?.trim().startsWith('[') || profile.about?.trim().startsWith('{');
          const rawEffectiveDob = effectiveUser.user_metadata?.date_of_birth || effectiveUser.user_metadata?.dob || "";
          const effectiveDob = formatDobISO(rawEffectiveDob);
          const dynamicAge = effectiveDob ? (calculateAge(effectiveDob) ?? profile.age ?? "") : (profile.age ?? effectiveUser.user_metadata?.age ?? "");
          
          const loadedData: Partial<ProfileData> = {
            ...profile,
            name: profile.name || effectiveUser.user_metadata?.full_name || effectiveUser.user_metadata?.name || "",
            email: profile.email || effectiveUser.email || "",
            about: isJsonAbout ? "" : (profile.about || ""),
            date_of_birth: effectiveDob,
            age: dynamicAge,
            gender: profile.gender || effectiveUser.user_metadata?.gender || "",
            blood_group: "",
            emergency_contact: "",
            allergies: ""
          }

          setProfileData(loadedData)
          if (!profile.onboarding_completed) {
            setShowOnboarding(true)
          }
          calculateCompleteness(loadedData)
        }
      } catch (error: any) {
        console.error("Error loading profile:", error)
        if (isMounted) {
          setFetchError(error?.message || "An unexpected error occurred while loading profile")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [router, supabase, authLoading, authSession?.user?.id])

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

      const rawDobInput = profileData.date_of_birth ? String(profileData.date_of_birth).trim() : "";
      const todayISOStr = new Date().toISOString().split('T')[0];

      if (rawDobInput && rawDobInput > todayISOStr) {
        setSaving(false);
        toast({
          title: "Invalid Date of Birth",
          description: "Date of Birth cannot be in the future.",
          variant: "destructive"
        });
        return;
      }

      const dobVal = formatDobISO(rawDobInput) || null;
      const dynamicCalculatedAge = dobVal ? calculateAge(dobVal) : (profileData.age ? Number(profileData.age) : null);

      const updateData: any = {
        id: session.user.id,
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone || '',
        address: profileData.address || '',
        company: profileData.company || '',
        about: profileData.about || '',
        avatar_url: avatarUrl || '',
        specialty: profileData.specialty || '',
        language: profileData.language || 'en',
        age: dynamicCalculatedAge,
        gender: profileData.gender || null,
        onboarding_completed: true,
        first_login_at: profileData.first_login_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log('Saving profile data:', updateData)

      const { error: dbError, data: dbResult } = await supabase
        .from("profiles")
        .upsert(updateData, { onConflict: 'id' })
        .select()
        .maybeSingle()

      if (dbError) {
        console.error('Database error saving profile:', dbError)
        setSaving(false);
        toast({
          title: "Save Failed",
          description: `Failed to save profile: ${dbError.message}`,
          variant: "destructive"
        });
        return;
      }

      // Explicit check for DOB metadata update on Auth user
      const existingUserMetadata = session.user.user_metadata || {};
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          ...existingUserMetadata,
          date_of_birth: dobVal,
          dob: dobVal
        }
      });

      if (authError) {
        console.error("Auth metadata error saving DOB:", authError);
        setSaving(false);
        toast({
          title: "Save Failed",
          description: `Failed to update date of birth metadata: ${authError.message}`,
          variant: "destructive"
        });
        return;
      }

      console.log('Profile saved successfully:', dbResult)

      const savedFullState = {
        ...profileData,
        ...updateData,
        date_of_birth: dobVal || ""
      };

      setProfileData(savedFullState)
      setSelectedImage(null)
      setImagePreview("")
      setIsEditing(false)
      setShowOnboarding(false)
      calculateCompleteness(savedFullState)

      await refreshProfile()

      toast({
        title: "Success",
        description: "Profile updated successfully",
      })

    } catch (error: any) {
      console.error("Error saving profile:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to save profile",
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
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
        email: session.user.email || '',
        phone: '',
        role: 'patient' as const,
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
      await refreshProfile()

    } catch (error) {
      console.error("Skip onboarding error:", error)
    }
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Failed to Load Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">{fetchError}</p>
            <Button 
              variant="outline" 
              onClick={() => {
                setFetchError(null)
                setLoading(true)
                window.location.reload()
              }}
              className="w-full"
            >
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    )
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
                      <Label htmlFor="role">Role</Label>
                      <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted/50 text-sm font-medium flex items-center gap-2">
                        <Badge variant={profileData.role === "doctor" ? "default" : "secondary"} className="capitalize">
                          {profileData.role || "patient"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">(Read-only)</span>
                      </div>
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

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="date_of_birth">Date of Birth</Label>
                        {profileData.date_of_birth && calculateAge(profileData.date_of_birth) !== null && (
                          <span className="text-xs text-primary font-semibold">
                            Age: {calculateAge(profileData.date_of_birth)} yrs
                          </span>
                        )}
                      </div>
                      <Popover open={dobPickerOpen} onOpenChange={setDobPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="date_of_birth"
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-10 px-3 cursor-pointer",
                              !profileData.date_of_birth && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {profileData.date_of_birth
                              ? formatDisplayDate(profileData.date_of_birth)
                              : <span>Pick a date of birth</span>
                            }
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="start">
                          <div className="flex items-center justify-between gap-2 pb-3 border-b mb-2">
                            <Select
                              value={String(pickerMonth.getMonth())}
                              onValueChange={(val) => {
                                const newM = new Date(pickerMonth);
                                newM.setMonth(parseInt(val, 10));
                                setPickerMonth(newM);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs font-medium w-[110px]">
                                <SelectValue placeholder="Month" />
                              </SelectTrigger>
                              <SelectContent className="max-h-56">
                                {[
                                  "January", "February", "March", "April", "May", "June",
                                  "July", "August", "September", "October", "November", "December"
                                ].map((m, idx) => (
                                  <SelectItem key={m} value={String(idx)} className="text-xs">
                                    {m}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={String(pickerMonth.getFullYear())}
                              onValueChange={(val) => {
                                const newM = new Date(pickerMonth);
                                newM.setFullYear(parseInt(val, 10));
                                setPickerMonth(newM);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs font-medium w-[90px]">
                                <SelectValue placeholder="Year" />
                              </SelectTrigger>
                              <SelectContent className="max-h-56">
                                {Array.from({ length: 2026 - 1920 + 1 }, (_, i) => 2026 - i).map((y) => (
                                  <SelectItem key={y} value={String(y)} className="text-xs">
                                    {y}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {profileData.date_of_birth && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
                                onClick={() => {
                                  handleInputChange("date_of_birth", "");
                                  handleInputChange("age", "");
                                  setDobPickerOpen(false);
                                }}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          <Calendar
                            mode="single"
                            month={pickerMonth}
                            onMonthChange={setPickerMonth}
                            selected={parsedDobDate}
                            onSelect={(selectedDate) => {
                              if (!selectedDate) return;
                              const isoStr = formatLocalDateToISO(selectedDate);
                              const todayISO = formatLocalDateToISO(new Date());
                              if (isoStr > todayISO) {
                                toast({
                                  title: "Invalid Date",
                                  description: "Date of Birth cannot be in the future.",
                                  variant: "destructive"
                                });
                                return;
                              }
                              handleInputChange("date_of_birth", isoStr);
                              const dynamicAge = calculateAge(isoStr);
                              if (dynamicAge !== null) {
                                handleInputChange("age", String(dynamicAge));
                              }
                              setDobPickerOpen(false);
                            }}
                            disabled={(date) => date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Select 
                        value={profileData.gender || ""} 
                        onValueChange={(value) => handleInputChange("gender", value)}
                      >
                        <SelectTrigger id="gender">
                          <SelectValue placeholder="Select Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {profileData.role === "patient" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="blood_group">Blood Group</Label>
                          <Input
                            id="blood_group"
                            value={profileData.blood_group || ""}
                            onChange={(e) => handleInputChange("blood_group", e.target.value)}
                            placeholder="e.g. O+, A-"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="emergency_contact">Emergency Contact</Label>
                          <Input
                            id="emergency_contact"
                            value={profileData.emergency_contact || ""}
                            onChange={(e) => handleInputChange("emergency_contact", e.target.value)}
                            placeholder="Contact Name & Number"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="allergies">Medical Allergies / Conditions</Label>
                          <Textarea
                            id="allergies"
                            value={profileData.allergies || ""}
                            onChange={(e) => handleInputChange("allergies", e.target.value)}
                            placeholder="List any known allergies, chronic diseases, or medical conditions..."
                            rows={3}
                          />
                        </div>
                      </>
                    )}

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

                      {((profileData.date_of_birth && calculateAge(profileData.date_of_birth) !== null) || (profileData.age !== undefined && profileData.age !== null && profileData.age !== "")) && (
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <span>Age: {profileData.date_of_birth && calculateAge(profileData.date_of_birth) !== null ? calculateAge(profileData.date_of_birth) : profileData.age} years</span>
                        </div>
                      )}

                      {profileData.date_of_birth && (
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <span>Date of Birth: {formatDisplayDate(profileData.date_of_birth)}</span>
                        </div>
                      )}

                      {profileData.gender && (
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <span>Gender: {profileData.gender}</span>
                        </div>
                      )}

                      {profileData.role === "patient" && (
                        <>
                          {profileData.blood_group && (
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Blood Group:</span>
                              <Badge variant="outline">{profileData.blood_group}</Badge>
                            </div>
                          )}
                          {profileData.emergency_contact && (
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Emergency Contact:</span>
                              <span>{profileData.emergency_contact}</span>
                            </div>
                          )}
                          {profileData.allergies && (
                            <div className="flex flex-col gap-1 pt-1">
                              <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Medical Allergies:</span>
                              <span className="text-sm text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded-md border border-red-100 dark:border-red-900/30">
                                {profileData.allergies}
                              </span>
                            </div>
                          )}
                        </>
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

