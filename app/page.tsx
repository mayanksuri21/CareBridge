"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone,
  MapPin,
  Mail,
  Clock,
  Video,
  Users,
  FileText,
  Pill,
  Brain,
  Stethoscope,
  Shield,
  Lock,
  CheckCircle2,
  ArrowRight,
  Star,
  Send,
  Moon,
  Sun,
} from "lucide-react";
import { LanguageSelector } from "@/components/language-selector";
import { AuthButton } from "@/components/auth/auth-button";
import { useTheme } from "next-themes";
import { useLanguage } from "@/components/language-provider";
import GradualBlur from "@/components/ui/gradual-blur";
import { Footer } from "@/components/ui/footer-section";
import { Navbar } from "@/components/ui/navbar";
import { useAuth } from "@/components/auth-provider";
import { TextEffect } from "@/components/ui/text-effect";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function HomePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const { session, profile, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("scroll-smooth");

    return () => {
      document.documentElement.classList.remove("scroll-smooth");
    };
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const routes = [
      "/(auth)/login",
      "/consultation/book",
      "/records",
      "/pharmacy",
      "/symptoms",
      "/(patient)/appointments",
      "/(doctor)/dashboard",
    ];
    routes.forEach((r) => {
      try {
        router.prefetch(r);
      } catch {}
    });
  }, [router]);



  const dashboardHref = profile?.role === "doctor" ? "/doctor/dashboard" : "/patient/dashboard";
  const dashboardLabel = profile?.role === "doctor" ? "Go to Doctor Dashboard" : "Go to Your History";
  const historyHref = "/patient/dashboard";
  const displayName = profile?.name || session?.user.user_metadata?.full_name || session?.user.email || "Account";

  const togglePlayback = async () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
        setIsPlaying(true);
      } catch {}
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const faqItems = [
    {
      question: "What is CareBridge?",
      answer:
        "CareBridge is a digital healthcare platform that helps patients connect with certified doctors, manage records, and access care securely from anywhere.",
    },
    {
      question: "How do I book a consultation?",
      answer:
        "You can sign in, choose a consultation option, and select a suitable time for your appointment from the booking flow on the site.",
    },
    {
      question: "Is my information secure?",
      answer:
        "Yes. CareBridge uses secure access controls and encrypted sessions to help protect patient information and support trusted digital care.",
    },
    {
      question: "Can I access my records online?",
      answer:
        "Yes. Patients can view medical records, prescriptions, and care history through the platform when available in their account.",
    },
    {
      question: "Who can use CareBridge?",
      answer:
        "CareBridge is designed for patients, doctors, and care teams who want a streamlined and connected way to manage healthcare services.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-64 w-[120vw] -translate-x-1/2 rounded-full bg-gradient-to-r from-primary/25 via-fuchsia-500/10 to-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-60 w-60 rounded-full bg-primary/10 blur-2xl" />
      </div>

      <Navbar />
      <div className="border-b border-border/50 bg-muted/10">
        <div className="container mx-auto flex flex-wrap items-center justify-end gap-3 px-4 py-2 text-sm">
          <nav className="mr-auto hidden md:flex items-center gap-4 text-muted-foreground">
            <a href="#about" className="hover:text-foreground transition-colors">About</a>
            <a href="#features" className="hover:text-foreground transition-colors">{t.navFeatures}</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">{t.navHowItWorks}</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
          </nav>
          <button
            onClick={toggleTheme}
            className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent/50"
            aria-label="Toggle theme"
          >
            {mounted ? (
              theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <LanguageSelector />
        </div>
      </div>

      <section className="relative overflow-hidden py-10 md:py-16 lg:py-20">
        <div className="container mx-auto px-4 py-10 md:py-16 lg:py-20 relative z-10">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-4">
                <Shield className="h-3.5 w-3.5 text-primary" />{" "}
                {t.heroSecureTagline}
              </div>
              <TextEffect
                per="word"
                preset="slide"
                className="text-4xl md:text-5xl font-bold tracking-tight text-foreground text-balance"
                delay={0.2}
              >
                Trusted care, just a tap away
              </TextEffect>
              <TextEffect
                per="char"
                preset="fade"
                className="mt-4 text-lg text-muted-foreground max-w-xl"
                delay={1}
              >
                Connect with certified doctors, manage your records, and get
                support when you need it most — all from one secure, easy-to-use
                platform.
              </TextEffect>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {session ? (
                  <>
                    <Link href={dashboardHref}>
                      <Button size="lg" className="gap-2">
                        {dashboardLabel} <ArrowRight className="h-4 w-4" />
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
                    <Link href="/doctor/register">
                      <Button size="lg" variant="outline" className="gap-2">
                        {t.doctorCta} <Stethoscope className="h-4 w-4" />
                      </Button>
                    </Link>
                  </>
                )}
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5">
                  <Shield className="h-4 w-4 text-primary" /> Secure
                </div>
                <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5">
                  <Users className="h-4 w-4 text-primary" /> Verified Doctors
                </div>
                <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5">
                  <Clock className="h-4 w-4 text-primary" /> 24×7 Support
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-[520px] rounded-xl border bg-card/50 p-0 shadow-sm overflow-hidden">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  src="/promo.mp4"
                  playsInline
                  muted
                  loop
                  autoPlay
                />

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-20">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={togglePlayback}
                    className="backdrop-blur bg-background/80"
                  >
                    {isPlaying ? t.videoPause : t.videoPlay}
                  </Button>
                  <div className="rounded-full bg-background/80 px-2 py-1 text-xs text-muted-foreground">
                    {t.videoDemoLabel}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="px-4 py-16 md:py-20 scroll-mt-24">
        <div className="container mx-auto">
          <div className="mb-10 text-center">
            <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">
              About CareBridge
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              CareBridge brings accessible, secure, and technology-driven
              healthcare services together in one connected platform.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Mission</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Provide accessible, secure, and technology-driven healthcare
                  services that support better outcomes for every community.
                </p>
              </CardContent>
            </Card>

            <Card className="border-secondary/20">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                  <Stethoscope className="h-5 w-5 text-secondary" />
                </div>
                <CardTitle className="text-xl">Vision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Bridge the gap between patients and healthcare professionals
                  through digital solutions that are inclusive and reliable.
                </p>
              </CardContent>
            </Card>

            <Card className="border-muted-foreground/20">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Users className="h-5 w-5 text-accent" />
                </div>
                <CardTitle className="text-xl">Trusted Care</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Deliver connected care experiences backed by secure
                  consultations, clear communication, and dependable support.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {(!session || loading) && (
        <section id="patients" className="px-4 py-16 md:py-20 scroll-mt-24">
          <div className="container mx-auto">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="h-full border-primary/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-xl">For Patients</CardTitle>
                  </div>
                  <CardDescription>
                    Book consultations, access records, and get e‑prescriptions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="mb-4 list-inside list-disc text-sm text-muted-foreground">
                    <li>24×7 video consultations in your language</li>
                    <li>Digital records and prescriptions</li>
                    <li>Reserve medicines at nearby pharmacies</li>
                  </ul>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/consultation/book">
                      <Button>Start a consultation</Button>
                    </Link>
                    <Link href="/login">
                      <Button variant="outline">Login / Register</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              <Card
                id="doctors"
                className="h-full border-secondary/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                      <Stethoscope className="h-5 w-5 text-secondary" />
                    </div>
                    <CardTitle className="text-xl">For Doctors</CardTitle>
                  </div>
                  <CardDescription>
                    Join the network, serve rural patients, and manage
                    appointments.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="mb-4 list-inside list-disc text-sm text-muted-foreground">
                    <li>Flexible online clinic with low bandwidth</li>
                    <li>E‑prescriptions with QR verification</li>
                    <li>Integrated scheduling and patient records</li>
                  </ul>
                  <p className="mb-3 text-sm font-medium text-secondary">
                    Verification is required before you can provide consultations.
                  </p>
                  <Link href="/doctor/register">
                    <Button className="gap-2">
                      Doctor Login / Register <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      <section
        id="features"
        className="py-16 md:py-20 px-4 relative scroll-mt-24"
      >
        <div className="container mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Video className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{t.videoConsultation}</CardTitle>
                <CardDescription>
                  Connect with doctors through secure video calls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/consultation/book">
                  <Button className="w-full" size="lg">
                    {t.startConsultation}
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {t.availableLanguages}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-secondary" />
                </div>
                <CardTitle className="text-lg">{t.healthRecords}</CardTitle>
                <CardDescription>
                  Access your medical history and prescriptions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/records">
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    size="lg"
                  >
                    {t.viewRecords}
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {t.worksOffline}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Pill className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-lg">{t.medicineTracker}</CardTitle>
                <CardDescription>
                  Check medicine availability at local pharmacies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/pharmacy">
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    size="lg"
                  >
                    {t.checkAvailability}
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {t.realTimeUpdates}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{t.symptomChecker}</CardTitle>
                <CardDescription>
                  AI-powered health assessment tool
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/symptoms">
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    size="lg"
                  >
                    {t.checkSymptoms}
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {t.lowBandwidthOptimized}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="px-4 py-16 md:py-20 bg-muted/30 scroll-mt-24"
      >
        <div className="container mx-auto">
          <h3 className="mb-10 text-center text-3xl md:text-4xl font-semibold tracking-tight">
            How CareBridge works
          </h3>
          <div className="grid gap-6 md:grid-cols-4">
            <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <CardHeader>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-center text-base">
                  1. Sign up
                </CardTitle>
                <CardDescription className="text-center">
                  Create your secure account
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <CardHeader>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-center text-base">2. Book</CardTitle>
                <CardDescription className="text-center">
                  Choose a doctor and time
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <CardHeader>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Video className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-center text-base">
                  3. Consult
                </CardTitle>
                <CardDescription className="text-center">
                  Join the secure video room
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <CardHeader>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Pill className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-center text-base">
                  4. Get care
                </CardTitle>
                <CardDescription className="text-center">
                  E‑prescription & pharmacy pickup
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">10,000+</div>
              <div className="text-sm text-muted-foreground">
                Patients Served
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">250+</div>
              <div className="text-sm text-muted-foreground">
                Verified Doctors
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">24×7</div>
              <div className="text-sm text-muted-foreground">24×7 Support</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">98%</div>
              <div className="text-sm text-muted-foreground">
                Patient Satisfaction
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20 relative">
        <div className="container mx-auto relative z-10">
          <h3 className="mb-10 text-center text-3xl md:text-4xl font-semibold tracking-tight">
            What people say
          </h3>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-1 text-amber-500">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <p className="text-sm text-muted-foreground">
                  “The virtual consultation felt personal and professional, and
                  I had a clear care plan within minutes.”
                </p>
                <p className="mt-3 text-xs font-medium">– Sarah L., Patient</p>
              </CardContent>
            </Card>
            <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-1 text-amber-500">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <p className="text-sm text-muted-foreground">
                  “I appreciated the secure follow-up and the ability to review
                  my records and prescriptions in one place.”
                </p>
                <p className="mt-3 text-xs font-medium">– Daniel R., Patient</p>
              </CardContent>
            </Card>
            <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-1 text-amber-500">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <p className="text-sm text-muted-foreground">
                  “CareBridge helps our clinic coordinate care more efficiently
                  while keeping communication clear for patients.”
                </p>
                <p className="mt-3 text-xs font-medium">
                  – Dr. Amina Khan, Primary Care Physician
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="px-4 py-16 md:py-20 bg-muted/30 scroll-mt-24"
      >
        <div className="container mx-auto">
          <div className="mb-10 text-center">
            <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Frequently Asked Questions
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              Everything you need to know about using CareBridge for secure,
              connected healthcare.
            </p>
          </div>
          <Card className="transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <CardContent className="pt-6">
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item) => (
                  <AccordionItem key={item.question} value={item.question}>
                    <AccordionTrigger className="text-left text-base font-semibold">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent>{item.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-2xl font-bold">
                Privacy, security, and consent
              </h3>
              <p className="mt-2 text-muted-foreground">
                We follow healthcare best practices to keep your data safe.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" /> End‑to‑end encrypted
                  sessions
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Patient
                  consent before joining calls
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Audit logs and
                  role‑based access
                </li>
              </ul>
            </div>
            <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Need help getting started? Our team can assist clinics and
                  care teams in onboarding to CareBridge.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/login">
                    <Button>Patient Login</Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="outline">Doctor Login</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 relative">
        <div className="container mx-auto relative z-10">
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t.emergencyServices}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {t.emergencyDescription}
                </p>
                <Button
                  variant="destructive"
                  size="lg"
                  className="text-lg px-8"
                >
                  {t.callEmergency}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="contact" className="px-4 py-16 md:py-20 scroll-mt-24">
        <div className="container mx-auto">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] items-center">
            <div className="rounded-3xl border border-border/50 bg-card/70 p-8 shadow-sm backdrop-blur">
              <h3 className="text-3xl font-bold mb-4">We're Here to Help</h3>

              <p className="text-muted-foreground mb-8">
                CareBridge connects patients and healthcare professionals
                through a secure, reliable, and accessible digital healthcare
                platform. Our team is always available to answer your questions
                and support your healthcare journey.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-4 rounded-2xl border border-border/50 bg-background/50 p-4">
                  <Shield className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h4 className="font-semibold">Secure Platform</h4>
                    <p className="text-sm text-muted-foreground">
                      End-to-end protected healthcare services.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl border border-border/50 bg-background/50 p-4">
                  <Clock className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h4 className="font-semibold">Fast Support</h4>
                    <p className="text-sm text-muted-foreground">
                      Quick assistance whenever you need help.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl border border-border/50 bg-background/50 p-4">
                  <Phone className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h4 className="font-semibold">Always Available</h4>
                    <p className="text-sm text-muted-foreground">
                      Dedicated healthcare support for patients and doctors.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <Card className="h-full border-primary/20 bg-card/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-2xl">Contact Us</CardTitle>
                  <CardDescription>
                    Reach out to our team for support, inquiries, or assistance
                    with your CareBridge experience.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 text-sm text-muted-foreground">
                  <div className="space-y-2 rounded-3xl border border-border/50 bg-background/50 p-4">
                    <div className="flex items-center gap-3 text-foreground">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="font-medium">Email</span>
                    </div>
                    <p>support@carebridge.com</p>
                  </div>
                  <div className="space-y-2 rounded-3xl border border-border/50 bg-background/50 p-4">
                    <div className="flex items-center gap-3 text-foreground">
                      <Phone className="h-4 w-4 text-primary" />
                      <span className="font-medium">Phone</span>
                    </div>
                    <p>+91 90123 45678</p>
                  </div>
                  <div className="space-y-2 rounded-3xl border border-border/50 bg-background/50 p-4">
                    <div className="flex items-center gap-3 text-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-medium">Address</span>
                    </div>
                    <p>CareBridge Digital Health</p>
                    <p>Sector 62, Noida</p>
                    <p>Uttar Pradesh 201309</p>
                    <p>India</p>
                  </div>
                  <div className="space-y-2 rounded-3xl border border-border/50 bg-background/50 p-4">
                    <div className="flex items-center gap-3 text-foreground">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-medium">Support Hours</span>
                    </div>
                    <p>Mon–Sat • 9:00 AM – 7:00 PM IST</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="h-full border-secondary/20 bg-card/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl">Send a message</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="name">
                          Name
                        </label>
                        <Input id="name" placeholder="Your name" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="email">
                          Email
                        </label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="subject">
                        Subject
                      </label>
                      <Input id="subject" placeholder="Subject" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="message">
                        Message
                      </label>
                      <Textarea
                        id="message"
                        placeholder="How can we help?"
                        className="min-h-[140px]"
                      />
                    </div>
                    <Button
                      type="button"
                      className="w-full sm:w-auto gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Send className="h-4 w-4" />
                      Send Message
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
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
  );
}
