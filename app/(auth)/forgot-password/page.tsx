"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, ArrowLeft, Stethoscope, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

function ForgotPasswordContent() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get("email") || ""
  const supabase = createSupabaseBrowserClient()

  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.")
      return
    }

    try {
      setLoading(true)
      setError(null)

      const origin = typeof window !== "undefined" && window.location.origin 
        ? window.location.origin 
        : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
      const redirectTo = `${origin}/reset-password`
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })

      if (resetErr) {
        throw resetErr
      }

      setSubmitted(true)
    } catch (err: any) {
      console.error("Password reset error:", err)
      setError(err?.message || "Failed to send password reset email. Please try again.")
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
            <CardHeader className="space-y-3 text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                {submitted ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : (
                  <Mail className="w-6 h-6 text-primary" />
                )}
              </div>
              <CardTitle className="text-2xl font-bold">
                {submitted ? "Check Your Email" : "Reset Password"}
              </CardTitle>
              <CardDescription>
                {submitted
                  ? `We've sent a password reset link to your email address.`
                  : "Enter your registered email and we'll send you a link to reset your password."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {submitted ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/50 border border-border/80 text-sm text-center space-y-1">
                    <p className="text-xs text-muted-foreground">Reset link sent to:</p>
                    <p className="font-semibold text-foreground break-all">{email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Please check your inbox and click the reset link to choose a new password. If you don&apos;t see it, check your spam or junk folder.
                  </p>
                  <div className="space-y-2 pt-2">
                    <Button
                      variant="outline"
                      className="w-full h-11"
                      onClick={() => {
                        setSubmitted(false)
                        setError(null)
                      }}
                    >
                      Send to a different email
                    </Button>
                    <Link href="/login" className="block w-full">
                      <Button className="w-full h-11">
                        Return to Sign In
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={loading || !email}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending reset link...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>

                  <div className="text-center pt-2">
                    <Link
                      href="/login"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                    >
                      Remember your password? <span className="text-primary hover:underline">Sign In</span>
                    </Link>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  )
}
