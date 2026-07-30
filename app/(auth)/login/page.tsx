"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Mail, 
  Lock, 
  User, 
  Phone, 
  Stethoscope, 
  UserCircle2, 
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  ChevronDown
} from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { getPostLoginRedirect } from "@/lib/supabase/profile-utils"
import { useLanguage } from "@/components/language-provider"

type Role = "patient" | "doctor"

export default function AuthPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const { t } = useLanguage()
  
  const [role, setRole] = useState<Role>("patient")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {

        const redirectUrl = await getPostLoginRedirect(session.user.id)
        router.push(redirectUrl)
      }
    }
    checkSession()
  }, [supabase.auth, router])

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match" })
      return
    }

    try {
      setLoading(true)
      setStatus(null)
      
      const { data, error: signUpErr } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            name,
            phone,
            role,
            language: "en"
          }
        }
      })
      
      if (signUpErr) throw signUpErr
      
      if (data.session) {

        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone, role, language: "en" })
        })
        setStatus({ type: "success", message: "Account created successfully!" })

        setTimeout(() => router.push("/profile"), 1500)
      } else {
        setStatus({ type: "success", message: "Please check your email to verify your account." })
      }
    } catch (e: any) {
      setStatus({ type: "error", message: e?.message || "Registration failed" })
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async () => {
    try {
      setLoading(true)
      setStatus(null)
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      
      setStatus({ type: "success", message: "Signed in successfully!" })

      if (data.user) {
        const redirectUrl = await getPostLoginRedirect(data.user.id)
        setTimeout(() => router.push(redirectUrl), 1000)
      } else {
        setTimeout(() => router.push("/profile"), 1000)
      }
    } catch (e: any) {
      setStatus({ type: "error", message: e?.message || "Sign in failed" })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    try {
      setLoading(true)
      setStatus(null)
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      })
      
      if (error) throw error
    } catch (e: any) {
      setStatus({ type: "error", message: e?.message || "Google sign-in failed" })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      
      <header className="border-b border-border/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Stethoscope className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-semibold">HealthConnect</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-md">
          <Card className="border-0 shadow-xl">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Welcome to HealthConnect</CardTitle>
              <CardDescription>
                Join our telemedicine platform serving rural communities
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              
              <div className="space-y-3">
                <Label className="text-sm font-medium">I am a</Label>
                <Select value={role} onValueChange={(value: Role) => setRole(value)}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select your role">
                      <div className="flex items-center gap-2">
                        {role === "patient" ? (
                          <>
                            <UserCircle2 className="h-4 w-4" />
                            <span>Patient</span>
                          </>
                        ) : (
                          <>
                            <Stethoscope className="h-4 w-4" />
                            <span>Doctor</span>
                          </>
                        )}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patient">
                      <div className="flex items-center gap-2">
                        <UserCircle2 className="h-4 w-4" />
                        <span>Patient</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="doctor">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" />
                        <span>Doctor</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Tabs defaultValue="signup" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                </TabsList>

                <TabsContent value="signup" className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="name"
                          placeholder="Enter your full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          placeholder="+91 98765 43210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a strong password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <Button 
                      className="w-full h-12" 
                      onClick={handleSignUp}
                      disabled={loading || !name || !phone || !email || !password || !confirmPassword}
                    >
                      {loading ? "Creating Account..." : "Create Account"}
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <Separator className="w-full" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full h-12"
                      onClick={handleGoogleAuth}
                      disabled={loading}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Continue with Google
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="signin" className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signin-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <Button 
                      className="w-full h-12" 
                      onClick={handleSignIn}
                      disabled={loading || !email || !password}
                    >
                      {loading ? "Signing In..." : "Sign In"}
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <Separator className="w-full" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full h-12"
                      onClick={handleGoogleAuth}
                      disabled={loading}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Continue with Google
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              {status && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  status.type === "success" 
                    ? "bg-green-50 text-green-700 border border-green-200" 
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">{status.message}</span>
                </div>
              )}

              <Separator />

              <div className="text-center text-sm text-muted-foreground">
                By continuing, you agree to our{" "}
                <Link href="#" className="text-primary hover:underline">Terms of Service</Link>
                {" "}and{" "}
                <Link href="#" className="text-primary hover:underline">Privacy Policy</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}