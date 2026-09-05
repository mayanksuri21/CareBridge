"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock, ArrowLeft, Stethoscope, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createSupabaseBrowserClient()

  const [verifying, setVerifying] = useState(true)
  const [isRecoveryReady, setIsRecoveryReady] = useState(false)
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let isMounted = true
    let isResolved = false

    const markSuccess = () => {
      if (!isMounted || isResolved) return
      isResolved = true
      setIsRecoveryReady(true)
      setInvalidMessage(null)
      setVerifying(false)
    }

    const markInvalid = (message?: string) => {
      if (!isMounted || isResolved) return
      isResolved = true
      setIsRecoveryReady(false)
      setInvalidMessage(message || "This password reset link is invalid or has expired. Please request a new reset link.")
      setVerifying(false)
    }

    // 1. Check for explicit error parameters in query string or hash fragment
    const urlError = searchParams.get("error") || searchParams.get("error_description")
    if (urlError) {
      const description = searchParams.get("error_description") || "This password reset link is invalid or has expired. Please request a new reset link."
      markInvalid(decodeURIComponent(description.replace(/\+/g, " ")))
      return
    }

    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      if (params.get("error") || params.get("error_description")) {
        const description = params.get("error_description") || "This password reset link is invalid or has expired. Please request a new reset link."
        markInvalid(decodeURIComponent(description.replace(/\+/g, " ")))
        return
      }
    }

    // 2. Listen for Supabase PASSWORD_RECOVERY event or established session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[ResetPassword] Auth event:", event, session ? "session active" : "no session")
      if (!isMounted) return

      if (event === "PASSWORD_RECOVERY" || (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED"))) {
        markSuccess()
      }
    })

    // 3. Helper to check if session is already active
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (data?.session) {
          markSuccess()
          return true
        }
      } catch (err) {
        console.warn("[ResetPassword] getSession error:", err)
      }
      return false
    }

    // 4. Check if a PKCE code was provided in the query params and exchange safely
    const code = searchParams.get("code")

    const handleExchangeAndVerification = async () => {
      // If session is already available, no need to exchange
      const hasActiveSession = await checkSession()
      if (hasActiveSession || isResolved) return

      if (code) {
        try {
          console.log("[ResetPassword] Exchanging recovery code for session...")
          const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
          if (!isMounted) return

          if (exchangeErr) {
            console.warn("[ResetPassword] Code exchange error:", exchangeErr.message)
            // If exchange returned an error (e.g., already exchanged by client auto-detection), check session
            const hasSessionNow = await checkSession()
            if (!hasSessionNow) {
              markInvalid("This password reset link is invalid or has expired. Please request a new reset link.")
            }
          } else if (data?.session || data?.user) {
            markSuccess()
          } else {
            const hasSessionNow = await checkSession()
            if (!hasSessionNow) {
              markInvalid("This password reset link is invalid or has expired. Please request a new reset link.")
            }
          }
        } catch (err: any) {
          console.error("[ResetPassword] Code exchange exception:", err)
          if (!isMounted) return
          const hasSessionNow = await checkSession()
          if (!hasSessionNow) {
            markInvalid("This password reset link is invalid or has expired. Please request a new reset link.")
          }
        }
      } else {
        // No code in URL: Check if session is already active
        const hasSessionNow = await checkSession()
        if (!hasSessionNow) {
          // If no code and no active session, wait for onAuthStateChange or timeout
        }
      }
    }

    void handleExchangeAndVerification()

    // 5. Unconditional safety timeout: guarantees the page NEVER hangs indefinitely
    const timeout = setTimeout(async () => {
      if (isMounted && !isResolved) {
        console.log("[ResetPassword] Safety timeout reached, checking final session state")
        const hasSession = await checkSession()
        if (!hasSession) {
          markInvalid("This password reset link is invalid or has expired. Please request a new reset link.")
        }
      }
    }, 3500)

    return () => {
      isMounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [supabase, searchParams])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    try {
      setLoading(true)
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateErr) {
        throw updateErr
      }

      setSuccess(true)

      // Sign out recovery session cleanly so user logs in fresh with new password
      try {
        await supabase.auth.signOut()
      } catch (_) { }

      setTimeout(() => {
        router.push("/login?reset=success")
      }, 2500)
    } catch (err: any) {
      console.error("Failed to update password:", err)
      setError(err?.message || "Could not update password. Please try again or request a new link.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sign In
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Stethoscope className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-semibold">CareBridge</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 flex-1 flex items-center justify-center">
        <div className="mx-auto max-w-md w-full">
          <Card className="border-0 shadow-xl">
            {verifying ? (
              <CardContent className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">Verifying Recovery Link</h3>
                  <p className="text-xs text-muted-foreground">Please wait while we validate your reset session...</p>
                </div>
              </CardContent>
            ) : invalidMessage ? (
              <>
                <CardHeader className="space-y-3 text-center">
                  <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-destructive" />
                  </div>
                  <CardTitle className="text-2xl font-bold">Link Expired or Invalid</CardTitle>
                  <CardDescription className="text-sm">
                    {invalidMessage}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/50 border border-border/80 text-xs text-muted-foreground text-center">
                    For your security, password reset links can only be used once and expire after a limited time.
                  </div>
                  <div className="space-y-2 pt-2">
                    <Link href="/forgot-password" className="block w-full">
                      <Button className="w-full h-11">
                        Request a New Reset Link
                      </Button>
                    </Link>
                    <Link href="/login" className="block w-full">
                      <Button variant="outline" className="w-full h-11">
                        Return to Sign In
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </>
            ) : success ? (
              <>
                <CardHeader className="space-y-3 text-center">
                  <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <CardTitle className="text-2xl font-bold">Password Reset Successfully</CardTitle>
                  <CardDescription>
                    Your password has been updated successfully.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Redirecting you to the sign in page in a moment...
                  </p>
                  <Link href="/login" className="block w-full pt-2">
                    <Button className="w-full h-11">
                      Sign In Now
                    </Button>
                  </Link>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader className="space-y-3 text-center">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Lock className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl font-bold">Create New Password</CardTitle>
                  <CardDescription>
                    Enter a new secure password for your CareBridge account.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="new-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="At least 6 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-10 pr-10 h-11"
                          disabled={loading}
                          required
                          minLength={6}
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
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirm-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Re-enter your new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 pr-10 h-11"
                          disabled={loading}
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11"
                      disabled={loading || !newPassword || !confirmPassword}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating password...
                        </>
                      ) : (
                        "Reset Password"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
