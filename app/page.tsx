"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Phone,
  MapPin,
  Users,
  Clock,
  Video,
  FileText,
  Pill,
  Brain,
  Stethoscope,
  Shield,
  Lock,
  CheckCircle2,
  ArrowRight,
  Star,
  Moon,
  Sun,
} from "lucide-react"
import { LanguageSelector } from "@/components/language-selector"
import { AuthButton } from "@/components/auth/auth-button"
import { useTheme } from "next-themes"
import { useLanguage } from "@/components/language-provider"
import GradualBlur from "@/components/ui/gradual-blur"
import { Footer } from "@/components/ui/footer-section"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import type { Session } from "@supabase/supabase-js"
import { TextEffect } from "@/components/ui/text-effect"

export default function HomePage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const { theme, setTheme } = useTheme()
  const { t } = useLanguage()
  const supabase = createSupabaseBrowserClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const routes = [
      "/(auth)/login",
      "/consultation/book",
      "/records",
      "/pharmacy",
      "/symptoms",
      "/(patient)/appointments",
      "/(doctor)/dashboard",
    ]
    routes.forEach((r) => {
      try { router.prefetch(r) } catch {}
    })
  }, [router])

  useEffect(() => {
    let isMounted = true
    
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (isMounted) {
          if (error) {
            console.error("Error getting session on homepage:", error)
            setSession(null)
          } else {
            setSession(session)
          }
          setLoading(false)
        }
      } catch (err) {
        console.error("Homepage session check failed:", err)
        if (isMounted) {
          setSession(null)
          setLoading(false)
        }
      }
    }
    
    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSession(session)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  const togglePlayback = async () => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) {
      try { await el.play(); setIsPlaying(true) } catch {}
    } else {
      el.pause(); setIsPlaying(false)
    }
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-64 w-[120vw] -translate-x-1/2 rounded-full bg-gradient-to-r from-primary/25 via-fuchsia-500/10 to-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-60 w-60 rounded-full bg-primary/10 blur-2xl" />
      </div>

      <header className="border-b border-border/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <Phone className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">HealthConnect</h1>
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">Nabha Rural Healthcare</Badge>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">{t.navFeatures}</a>
              <a href="#how-it-works" className="hover:text-foreground transition-colors">{t.navHowItWorks}</a>
              <a href="#patients" className="hover:text-foreground transition-colors">{t.navForPatients}</a>
              <a href="#doctors" className="hover:text-foreground transition-colors">{t.navForDoctors}</a>
            </nav>
            <div className="flex items-center gap-3">
              <button onClick={toggleTheme} className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent/50">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <LanguageSelector />
              <AuthButton />
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">        
        <div className="container mx-auto px-4 py-14 md:py-20 relative z-10">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-4">
                <Shield className="h-3.5 w-3.5 text-primary" /> {t.heroSecureTagline}
              </div>
              <TextEffect
                per="word"
                preset="slide"
                className="text-4xl md:text-5xl font-bold tracking-tight text-foreground text-balance"
                delay={0.2}
              >
                {t.healthcareAtFingerTips}
              </TextEffect>
              <TextEffect
                per="char"
                preset="fade"
                className="mt-4 text-lg text-muted-foreground max-w-xl"
                delay={1}
              >
                {t.healthcareDescription}
              </TextEffect>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {session ? (
                  <>
                    <Link href="/profile">
                      <Button size="lg" className="gap-2">
                        View Profile <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/consultation/book">
                      <Button size="lg" variant="outline" className="gap-2">
                        Book Consultation <Stethoscope className="h-4 w-4" />
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <Button size="lg" className="gap-2">
                        {t.patientCta} <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button size="lg" variant="outline" className="gap-2">
                        {t.doctorCta} <Stethoscope className="h-4 w-4" />
                      </Button>
                    </Link>
                  </>
                )}
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> 173 {t.villagesServed}</div>
                <div className="flex items-center gap-2"><Users className="h-4 w-4" /> 11 {t.doctorsAvailable}</div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {t.support24x7}</div>
              </div>
            </div>
            <div className="relative">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-[520px] rounded-xl border bg-card/50 p-0 shadow-sm overflow-hidden">
                <video ref={videoRef} className="h-full w-full object-cover" src="/promo.mp4" playsInline muted loop autoPlay />
                
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-20">
                  <Button size="sm" variant="secondary" onClick={togglePlayback} className="backdrop-blur bg-background/80">
                    {isPlaying ? t.videoPause : t.videoPlay}
                  </Button>
                  <div className="rounded-full bg-background/80 px-2 py-1 text-xs text-muted-foreground">{t.videoDemoLabel}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="patients" className="px-4 py-8">
        <div className="container mx-auto">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-xl">For Patients</CardTitle>
                </div>
                <CardDescription>Book consultations, access records, and get e‑prescriptions.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="mb-4 list-inside list-disc text-sm text-muted-foreground">
                  <li>24×7 video consultations in your language</li>
                  <li>Digital records and prescriptions</li>
                  <li>Reserve medicines at nearby pharmacies</li>
                </ul>
                <div className="flex flex-wrap gap-3">
                  <Link href="/consultation/book"><Button>Start a consultation</Button></Link>
                  <Link href="/login"><Button variant="outline">Login / Register</Button></Link>
                </div>
              </CardContent>
            </Card>
            <Card id="doctors" className="border-secondary/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                    <Stethoscope className="h-5 w-5 text-secondary" />
                  </div>
                  <CardTitle className="text-xl">For Doctors</CardTitle>
                </div>
                <CardDescription>Join the network, serve rural patients, and manage appointments.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="mb-4 list-inside list-disc text-sm text-muted-foreground">
                  <li>Flexible online clinic with low bandwidth</li>
                  <li>E‑prescriptions with QR verification</li>
                  <li>Integrated scheduling and patient records</li>
                </ul>
                <Link href="/login"><Button className="gap-2">Doctor Login / Register <ArrowRight className="h-4 w-4" /></Button></Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="features" className="py-8 px-4 relative">        
        <div className="container mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Video className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{t.videoConsultation}</CardTitle>
                <CardDescription>Connect with doctors through secure video calls</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/consultation/book">
                  <Button className="w-full" size="lg">
                    {t.startConsultation}
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2 text-center">{t.availableLanguages}</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-secondary" />
                </div>
                <CardTitle className="text-lg">{t.healthRecords}</CardTitle>
                <CardDescription>Access your medical history and prescriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/records">
                  <Button variant="outline" className="w-full bg-transparent" size="lg">
                    {t.viewRecords}
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2 text-center">{t.worksOffline}</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Pill className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-lg">{t.medicineTracker}</CardTitle>
                <CardDescription>Check medicine availability at local pharmacies</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/pharmacy">
                  <Button variant="outline" className="w-full bg-transparent" size="lg">
                    {t.checkAvailability}
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2 text-center">{t.realTimeUpdates}</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{t.symptomChecker}</CardTitle>
                <CardDescription>AI-powered health assessment tool</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/symptoms">
                  <Button variant="outline" className="w-full bg-transparent" size="lg">
                    {t.checkSymptoms}
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2 text-center">{t.lowBandwidthOptimized}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-12 bg-muted/30">
        <div className="container mx-auto">
          <h3 className="mb-8 text-center text-2xl font-bold">How HealthConnect works</h3>
          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardHeader>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-center text-base">1. Sign up</CardTitle>
                <CardDescription className="text-center">Create your secure account</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-center text-base">2. Book</CardTitle>
                <CardDescription className="text-center">Choose a doctor and time</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Video className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-center text-base">3. Consult</CardTitle>
                <CardDescription className="text-center">Join the secure video room</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Pill className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-center text-base">4. Get care</CardTitle>
                <CardDescription className="text-center">E‑prescription & pharmacy pickup</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-8 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">173</div>
              <div className="text-sm text-muted-foreground">{t.villagesServed}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">11</div>
              <div className="text-sm text-muted-foreground">{t.doctorsAvailable}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">24/7</div>
              <div className="text-sm text-muted-foreground">{t.support24x7}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">31%</div>
              <div className="text-sm text-muted-foreground">Internet Coverage</div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 relative">        
        <div className="container mx-auto relative z-10">
          <h3 className="mb-8 text-center text-2xl font-bold">What people say</h3>
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-1 text-amber-500">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <p className="text-sm text-muted-foreground">“Doctor spoke in Punjabi and helped me get the right medicines the same day.”</p>
                <p className="mt-3 text-xs font-medium">– Patient from Nabha</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-1 text-amber-500">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <p className="text-sm text-muted-foreground">“Low-bandwidth calls worked even on my 3G phone. Very easy to use.”</p>
                <p className="mt-3 text-xs font-medium">– Community Health Worker</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-1 text-amber-500">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <p className="text-sm text-muted-foreground">“E‑prescriptions with QR codes are convenient for our pharmacy counter.”</p>
                <p className="mt-3 text-xs font-medium">– Local Pharmacist</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-2xl font-bold">Privacy, security, and consent</h3>
              <p className="mt-2 text-muted-foreground">We follow healthcare best practices to keep your data safe.</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> End‑to‑end encrypted sessions</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Patient consent before joining calls</li>
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Audit logs and role‑based access</li>
              </ul>
            </div>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Need help getting started? Our team can assist clinics and local health workers to onboard to HealthConnect.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/login"><Button>Patient Login</Button></Link>
                  <Link href="/login"><Button variant="outline">Doctor Login</Button></Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-8 px-4 relative">        
        <div className="container mx-auto relative z-10">
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-2">{t.emergencyServices}</h3>
                <p className="text-muted-foreground mb-4">{t.emergencyDescription}</p>
                <Button variant="destructive" size="lg" className="text-lg px-8">
                  {t.callEmergency}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="relative">
        <GradualBlur 
          strength={1.5} 
          height="10rem" 
          position="bottom"
          curve="ease-out"
          opacity={0.6}
        />
      </div>

      <Footer />
    </div>
  )
}
