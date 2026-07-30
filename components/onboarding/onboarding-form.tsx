"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Heart, Stethoscope, User as UserIcon, X } from "lucide-react"
import { createInitialProfile, completeOnboarding } from "@/lib/supabase/onboarding-utils"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@supabase/supabase-js"

interface OnboardingFormProps {
  user: User
  onComplete: () => void
}

export function OnboardingForm({ user, onComplete }: OnboardingFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: user.user_metadata?.full_name || user.user_metadata?.name || "",
    phone: user.user_metadata?.phone_number || "",
    role: "patient" as "patient" | "doctor",
    address: "",
    specialty: ""
  })
  const { toast } = useToast()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!formData.name?.trim()) {
        toast({
          title: "Missing Name",
          description: "Please enter your full name",
          variant: "destructive"
        })
        return
      }

      if (!formData.phone?.trim()) {
        toast({
          title: "Missing Phone",
          description: "Please enter your phone number",
          variant: "destructive"
        })
        return
      }

      if (!formData.role) {
        toast({
          title: "Missing Role",
          description: "Please select whether you are a patient or healthcare provider",
          variant: "destructive"
        })
        return
      }

      if (formData.role === "doctor" && !formData.specialty?.trim()) {
        toast({
          title: "Missing Specialty",
          description: "Please specify your medical specialty",
          variant: "destructive"
        })
        return
      }

      console.log('Starting onboarding process with data:', { ...formData, userId: user.id })
      await createInitialProfile(user, {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
        address: formData.address?.trim() || '',
        specialty: formData.specialty?.trim() || ''
      })

      console.log('Initial profile created, completing onboarding...')
      await completeOnboarding(user.id)
      
      console.log('Profile setup completed successfully')

      toast({
        title: "Welcome to HealthConnect!",
        description: "Your profile has been set up successfully",
        duration: 3000
      })
      onComplete()
      router.push('/profile')
    } catch (error) {
      console.error('Onboarding failed:', error)
      
      let errorMessage = "There was an error setting up your profile. Please try again."
      
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String((error as any).message)
      }

      toast({
        title: "Setup Failed", 
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleCancel = () => {
    toast({
      title: "Setup cancelled",
      description: "You can complete your profile setup later.",
      duration: 3000
    })
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 flex justify-center">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-primary-foreground fill-current" />
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardTitle className="text-2xl">Welcome to HealthConnect</CardTitle>
          <CardDescription>
            Let's set up your profile to get started with our telemedicine platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="role">I am a *</Label>
              <Select value={formData.role} onValueChange={(value) => handleChange("role", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4" />
                      Patient - Seeking medical care
                    </div>
                  </SelectItem>
                  <SelectItem value="doctor">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4" />
                      Doctor - Providing medical care
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === "doctor" && (
              <div>
                <Label htmlFor="specialty">Medical Specialty *</Label>
                <Input
                  id="specialty"
                  type="text"
                  value={formData.specialty}
                  onChange={(e) => handleChange("specialty", e.target.value)}
                  placeholder="e.g., General Medicine, Cardiology, Pediatrics"
                  required
                />
              </div>
            )}

            <div>
              <Label htmlFor="address">Address (Optional)</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Enter your address"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="button"
                variant="outline"
                className="flex-1" 
                onClick={handleCancel}
                disabled={loading}
              >
                Skip for Now
              </Button>
              <Button 
                type="submit" 
                className="flex-1" 
                size="lg" 
                disabled={loading}
              >
                {loading ? "Setting up your profile..." : "Complete Setup"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default OnboardingForm