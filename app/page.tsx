"use client";

import { useEffect, useState } from "react";
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
  Stethoscope,
  Shield,
  Lock,
  CheckCircle2,
  ArrowRight,
  Send,
  Moon,
  Sun,
  ChevronDown,
  ChevronUp,
  Award,
  Globe,
  Building2,
  Sparkles,
  Zap,
  FolderHeart,
  CreditCard,
  HeartHandshake,
  CalendarCheck,
} from "lucide-react";
import { LanguageSelector } from "@/components/language-selector";
import { useTheme } from "next-themes";
import { useLanguage } from "@/components/language-provider";
import { Footer } from "@/components/ui/footer-section";
import { Navbar } from "@/components/ui/navbar";
import { useAuth } from "@/components/auth-provider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function HomePage() {
  const router = useRouter();
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

  const dashboardHref =
    profile?.role === "doctor" ? "/doctor/dashboard" : "/patient/dashboard";
  const dashboardLabel =
    profile?.role === "doctor"
      ? "Go to Doctor Dashboard"
      : "Go to Your History";

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const faqItems = [
    {
      question: "What is CareBridge?",
      answer:
        "CareBridge is a digital healthcare platform connecting patients with certified doctors, enabling secure virtual consultations, medical records management, and direct e-prescription routing.",
    },
    {
      question: "How does an online consultation work?",
      answer:
        "Choose your reason for consultation or select a preferred doctor, select an available date and time slot, and meet your board-certified clinician via our secure WebRTC video room.",
    },
    {
      question: "Is my healthcare information secure?",
      answer:
        "Yes. CareBridge utilizes enterprise-grade 256-bit encryption, strict access controls, and HIPAA-compliant data policies to keep your personal records protected.",
    },
    {
      question: "Can I access my prescriptions digitally?",
      answer:
        "Yes. Upon consultation conclusion, authorized prescriptions are generated directly in your portal with direct routing options.",
    },
    {
      question: "Who can use CareBridge?",
      answer:
        "CareBridge is designed for patients seeking accessible telehealth care and verified doctors wanting a streamlined digital practice management workflow.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Retained existing shared Navbar */}
      <Navbar />

      {/* Quick utility bar with Theme & Language controls */}
      <div className="border-b border-border/50 bg-muted/20">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground uppercase tracking-wider font-sans">
            <a href="#about" className="hover:text-primary transition-colors">
              About
            </a>
            <a href="#services" className="hover:text-primary transition-colors">
              Services
            </a>
            <a href="#how-it-works" className="hover:text-primary transition-colors">
              How It Works
            </a>
            <a href="#why-carebridge" className="hover:text-primary transition-colors">
              Why CareBridge
            </a>
            <a href="#faq" className="hover:text-primary transition-colors">
              FAQ
            </a>
            <a href="#contact" className="hover:text-primary transition-colors">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={toggleTheme}
              className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all flex items-center gap-1.5"
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === "dark" ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-amber-400" /> Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 text-slate-700" /> Dark Mode
                  </>
                )
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>
            <LanguageSelector />
          </div>
        </div>
      </div>

      <main className="w-full">
        {/* SECTION 1: HERO SECTION */}
        <section className="w-full pt-12 md:pt-20 pb-16 md:pb-28 px-4 sm:px-6 md:px-12 bg-gradient-to-b from-slate-50 via-teal-50/20 to-background dark:from-slate-950 dark:via-teal-950/10 dark:to-background relative overflow-hidden">
          <div className="absolute -top-24 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center relative z-10">
            {/* Left Typographic Column */}
            <div className="lg:col-span-6 flex flex-col items-start">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                </span>
                <span className="text-xs font-semibold tracking-wider uppercase text-emerald-700 dark:text-emerald-400">
                  Redefining Healthcare Access
                </span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-foreground leading-[1.1] mb-6">
                Healthcare that feels{" "}
                <span className="italic font-light text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-sky-600 dark:from-teal-400 dark:to-sky-400">
                  simpler
                </span>
                .
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground font-light leading-relaxed mb-8 max-w-lg">
                Connect with trusted healthcare professionals, manage your care, and stay connected — all through one secure digital platform.
              </p>

              {/* Dynamic CTAs */}
              <div className="flex flex-wrap items-center gap-4 mb-8 w-full sm:w-auto">
                {session ? (
                  <>
                    <Link href={dashboardHref}>
                      <Button size="lg" className="rounded-full px-8 bg-teal-600 hover:bg-teal-700 text-white shadow-md gap-2">
                        {dashboardLabel} <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/consultation/book">
                      <Button size="lg" variant="outline" className="rounded-full px-8 gap-2 border-border">
                        Book Consultation <Stethoscope className="h-4 w-4 text-teal-600" />
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <Button size="lg" className="rounded-full px-8 bg-teal-600 hover:bg-teal-700 text-white shadow-md gap-2">
                        Get Started Patient <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/doctor/register">
                      <Button size="lg" variant="outline" className="rounded-full px-8 gap-2 border-border">
                        Doctor Register <Stethoscope className="h-4 w-4 text-teal-600" />
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs tracking-wider uppercase text-muted-foreground font-medium">
                <span className="text-foreground font-semibold">Secure</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-foreground font-semibold">Connected</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-foreground font-semibold">Human</span>
              </div>
            </div>

            {/* Right Visual Column */}
            <div className="lg:col-span-6 relative">
              <div className="relative w-full rounded-3xl overflow-hidden aspect-[4/3] sm:aspect-[16/12] shadow-2xl bg-card border border-border">
                <img
                  alt="Board certified lead physician"
                  className="w-full h-full object-cover object-top hover:scale-102 transition-transform duration-700"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjElUyjos1S6iejAfEyC711cNmPfqaqjYFt-ZaUBKmAMvYW5WhEXo7MMQ12ISIQvk_hcmHxchGXDy30bhiNcRQPuD0LE1NddE_PibAKei0LkIMFxFOyYESqVDG_YViVfoaOIMexgoRQGBc5lTMc-_f418hj12THAOM8zk4sXMcubDnaXn6YRswVwZeWCGNyjVLHi8j0A9Gs4DDYa8KXY-BbzHbvX2XHISSUqWsiRh9B9G3ejKTay0DAA"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
              </div>

              {/* Floating Badge 1 */}
              <div className="hidden sm:flex absolute -top-4 -right-4 bg-card/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-border shadow-lg items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <p className="text-xs font-bold text-foreground">Verified Clinician</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Board Certified • Internal Med</p>
                </div>
              </div>

              {/* Floating Badge 2 */}
              <div className="absolute -bottom-6 -left-3 sm:left-4 bg-card/90 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-teal-500/20 shadow-lg flex items-center gap-3.5 max-w-xs">
                <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <p className="text-xs font-bold text-foreground">Active Telehealth Suite</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    WebRTC Ready • <span className="text-teal-600 dark:text-teal-400 font-bold">256-bit Encrypted</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: TRUST STRIP */}
        <section className="w-full bg-slate-100/80 dark:bg-slate-900/60 py-10 px-4 sm:px-6 md:px-12 border-y border-border">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Secure by Design</h3>
                <p className="text-xs text-muted-foreground font-normal leading-relaxed">Private digital healthcare & 256-bit encryption protecting every consult.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Verified Care</h3>
                <p className="text-xs text-muted-foreground font-normal leading-relaxed">Board-certified physicians, licensed specialists, and accredited clinicians.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <FolderHeart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Connected Hub</h3>
                <p className="text-xs text-muted-foreground font-normal leading-relaxed">Visits, records, and prescriptions synchronized in one unified portal.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Easy Access</h3>
                <p className="text-xs text-muted-foreground font-normal leading-relaxed">Care on-demand 24/7 or schedule flexibly from wherever you are.</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: ABOUT CAREBRIDGE */}
        <section className="w-full py-20 md:py-28 px-4 sm:px-6 md:px-12 bg-background" id="about">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Visual */}
            <div className="lg:col-span-6 order-2 lg:order-1 relative">
              <div className="rounded-3xl overflow-hidden aspect-[4/3] bg-muted shadow-xl relative border border-border">
                <img
                  alt="Physicians consulting together"
                  className="w-full h-full object-cover object-center"
                  src="https://lh3.googleusercontent.com/aida/AEtjO1VIvVbGOUhagIzT9sNLQnx8TdtdWyKJke5qerNFJKoPMRSJYeoD_X9-W8hj8ftUf3PgyOa69E2PZN7lYYmz2WPwNe53Xv1i2hyXs8pOyLK3PKCkmgSieOmplb8A1qD_QsZfCiM3kgxuC4Kljs5Zh6fKB9KO3IT2Ic-VWTFsBByxFmgnwOD0_RducU-3JLBVm8QcE0tz0PGY9-cfcl6XG7j2nIAupXVUJWIBeFRnLxegf53LkHZcdhqpKIEq"
                />
              </div>
              <div className="absolute -bottom-5 -right-2 sm:right-6 bg-card/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-teal-500/20 shadow-lg flex items-center gap-3">
                <img
                  alt="Dr. Sarah Jenkins"
                  className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCFAJllZobtkyR1OA9f7FoXlg2C2j_Ems9ASUqe7dmGslU7A8qZ04bO3Ai5wN3wogOmRB3iMzIkTvTx-K8whlyMf1lK4V8R5r3YOl8xFdr3H2zrFqVKqLLZngcEbmPkIDs1yj6FFmFLozXm-mqRgx_vPya5EHGG6y0pIqSWBx2Q7HJZ8zWGV011nm-VuAPA2FsuAExpF_MsBsTfKbZ7jY8CzCRrSWFtVmnEfUFyOXRox6eJwaup3Abnfw"
                />
                <div>
                  <div className="text-xs font-bold text-foreground">Dr. Sarah Jenkins, MD</div>
                  <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">Head of Family Medicine</div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ml-2"></span>
              </div>
            </div>

            {/* Right Story Narrative */}
            <div className="lg:col-span-6 order-1 lg:order-2 flex flex-col items-start">
              <span className="text-xs font-semibold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-3">About CareBridge</span>
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground font-normal leading-tight mb-6">
                Better care starts with a better connection.
              </h2>
              <p className="text-base text-muted-foreground font-light leading-relaxed mb-4">
                CareBridge was founded on a simple conviction: healthcare should never be fragmented, clinical, or rushed. We unite primary care, virtual consultations, and ongoing personal health history into one human-centered experience.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8 font-light">
                By stripping away administrative hurdles and replacing sterile clinical barriers with genuine dialogue, we return medicine to an attentive, unhurried partnership between doctor and patient.
              </p>
              <Link href="#services" className="group inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 transition-colors">
                <span>Discover CareBridge Services</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 4: SERVICES */}
        <section className="w-full py-20 md:py-28 px-4 sm:px-6 md:px-12 bg-slate-50/50 dark:bg-slate-900/30 border-y border-border" id="services">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-3xl mb-14">
              <span className="text-xs font-semibold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-2 block">Comprehensive Clinical Scope</span>
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground font-normal mb-3">
                Everything you need for connected care.
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg font-light leading-relaxed">
                From your first consultation to ongoing care, CareBridge keeps the experience simple and connected.
              </p>
            </div>

            {/* Featured Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
              {/* Featured Card */}
              <div className="lg:col-span-7 bg-card rounded-3xl p-8 shadow-sm border border-border flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wider bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full">
                      Featured Service
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">01 / Priority Care</span>
                  </div>
                  <h3 className="font-serif text-2xl sm:text-3xl text-foreground mb-3">Online Consultations</h3>
                  <p className="text-muted-foreground font-light text-sm leading-relaxed mb-6">
                    Immediate, high-fidelity access to licensed physicians for clinical diagnosis, proactive preventative recommendations, and routine evaluations without stepping into a waiting room.
                  </p>

                  <div className="mb-6 p-4 rounded-2xl bg-muted/50 border border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <img
                          alt="Doctor"
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-card"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCFAJllZobtkyR1OA9f7FoXlg2C2j_Ems9ASUqe7dmGslU7A8qZ04bO3Ai5wN3wogOmRB3iMzIkTvTx-K8whlyMf1lK4V8R5r3YOl8xFdr3H2zrFqVKqLLZngcEbmPkIDs1yj6FFmFLozXm-mqRgx_vPya5EHGG6y0pIqSWBx2Q7HJZ8zWGV011nm-VuAPA2FsuAExpF_MsBsTfKbZ7jY8CzCRrSWFtVmnEfUFyOXRox6eJwaup3Abnfw"
                        />
                        <img
                          alt="Doctor"
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-card"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjElUyjos1S6iejAfEyC711cNmPfqaqjYFt-ZaUBKmAMvYW5WhEXo7MMQ12ISIQvk_hcmHxchGXDy30bhiNcRQPuD0LE1NddE_PibAKei0LkIMFxFOyYESqVDG_YViVfoaOIMexgoRQGBc5lTMc-_f418hj12THAOM8zk4sXMcubDnaXn6YRswVwZeWCGNyjVLHi8j0A9Gs4DDYa8KXY-BbzHbvX2XHISSUqWsiRh9B9G3ejKTay0DAA"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">On-Call Physicians</p>
                        <p className="text-[11px] text-muted-foreground">General Practice, Pediatrics, Cardiology</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Available Now
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-border text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      <span>Same-day clinical appointments</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      <span>Direct electronic prescriptions</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 flex items-center justify-between border-t border-border">
                  <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    Available 24/7 Nationwide
                  </span>
                  <Link href={session ? "/consultation/book" : "/login"}>
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white rounded-full gap-1.5">
                      Start Visit <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Compact Secondary Services */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-card rounded-3xl p-6 shadow-sm border border-border hover:border-teal-500/50 transition-all group flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                        <Clock className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">02</span>
                    </div>
                    <h4 className="text-base font-semibold text-foreground group-hover:text-teal-600 transition-colors mb-1">
                      Appointment Scheduling
                    </h4>
                    <p className="text-xs text-muted-foreground font-light leading-relaxed">
                      Guaranteed on-demand or scheduled consultation times tailored to your personal week.
                    </p>
                  </div>
                  <div className="pt-3 text-right">
                    <Link href="/consultation/book" className="text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 uppercase">
                      Reserve Slot →
                    </Link>
                  </div>
                </div>

                <div className="bg-card rounded-3xl p-6 shadow-sm border border-border hover:border-teal-500/50 transition-all group flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                        <Video className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">03</span>
                    </div>
                    <h4 className="text-base font-semibold text-foreground group-hover:text-teal-600 transition-colors mb-1">
                      Video Consultations
                    </h4>
                    <p className="text-xs text-muted-foreground font-light leading-relaxed">
                      Crystal-clear, encrypted virtual face-to-face appointments hosted in a quiet clinical suite.
                    </p>
                  </div>
                  <div className="pt-3 text-right">
                    <Link href="/consultation/book" className="text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 uppercase">
                      High-Def Care →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom 3 Grid Services */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card rounded-3xl p-6 shadow-sm border border-border hover:border-teal-500/50 transition-all group flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                      <Pill className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">04</span>
                  </div>
                  <h4 className="text-base font-semibold text-foreground group-hover:text-teal-600 transition-colors mb-1">
                    Digital Prescriptions
                  </h4>
                  <p className="text-xs text-muted-foreground font-light leading-relaxed">
                    Instant routing to your preferred pharmacy upon physician sign-off.
                  </p>
                </div>
                <div className="pt-4 text-right">
                  <span className="text-[11px] font-bold text-teal-600 uppercase">Direct Routing →</span>
                </div>
              </div>

              <div className="bg-card rounded-3xl p-6 shadow-sm border border-border hover:border-teal-500/50 transition-all group flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                      <FolderHeart className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">05</span>
                  </div>
                  <h4 className="text-base font-semibold text-foreground group-hover:text-teal-600 transition-colors mb-1">
                    Medical Records
                  </h4>
                  <p className="text-xs text-muted-foreground font-light leading-relaxed">
                    A unified health timeline for clinical summaries, diagnostics, and vitals.
                  </p>
                </div>
                <div className="pt-4 text-right">
                  <span className="text-[11px] font-bold text-teal-600 uppercase">Secure Vault →</span>
                </div>
              </div>

              <div className="bg-card rounded-3xl p-6 shadow-sm border border-border hover:border-teal-500/50 transition-all group flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">06</span>
                  </div>
                  <h4 className="text-base font-semibold text-foreground group-hover:text-teal-600 transition-colors mb-1">
                    Secure Payments
                  </h4>
                  <p className="text-xs text-muted-foreground font-light leading-relaxed">
                    Transparent, upfront flat billing with automated Razorpay integration.
                  </p>
                </div>
                <div className="pt-4 text-right">
                  <span className="text-[11px] font-bold text-teal-600 uppercase">Transparent →</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: HOW IT WORKS */}
        <section className="w-full py-20 md:py-28 px-4 sm:px-6 md:px-12 bg-background" id="how-it-works">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl mb-16">
              <span className="text-xs font-semibold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-2 block">Simple Engagement</span>
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground font-normal">
                Four intuitive steps to comprehensive care.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
              <div className="flex flex-col border-t border-border pt-6">
                <span className="font-serif text-4xl font-light text-muted-foreground/60 mb-4">01</span>
                <h3 className="text-base font-semibold text-foreground mb-2">Discover</h3>
                <p className="text-xs text-muted-foreground font-light leading-relaxed">
                  Explore verified clinical specialties and select the specialized care you require.
                </p>
              </div>

              <div className="flex flex-col border-t border-border pt-6">
                <span className="font-serif text-4xl font-light text-muted-foreground/60 mb-4">02</span>
                <h3 className="text-base font-semibold text-foreground mb-2">Schedule</h3>
                <p className="text-xs text-muted-foreground font-light leading-relaxed">
                  Reserve an on-demand immediate visit or pick a convenient appointment slot.
                </p>
              </div>

              <div className="flex flex-col border-t border-border pt-6">
                <span className="font-serif text-4xl font-light text-muted-foreground/60 mb-4">03</span>
                <h3 className="text-base font-semibold text-foreground mb-2">Connect</h3>
                <p className="text-xs text-muted-foreground font-light leading-relaxed">
                  Meet your physician in a private, high-fidelity encrypted video consultation room.
                </p>
              </div>

              <div className="flex flex-col border-t border-border pt-6">
                <span className="font-serif text-4xl font-light text-muted-foreground/60 mb-4">04</span>
                <h3 className="text-base font-semibold text-foreground mb-2">Continue Care</h3>
                <p className="text-xs text-muted-foreground font-light leading-relaxed">
                  Receive your personalized care plan, authorized digital prescriptions, and clinical notes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: WHY CAREBRIDGE */}
        <section className="w-full py-20 md:py-28 px-4 sm:px-6 md:px-12 bg-slate-100/60 dark:bg-slate-900/40 border-y border-border" id="why-carebridge">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left 4 Pillars */}
            <div className="lg:col-span-6 flex flex-col">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 mb-4 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                <span className="text-xs font-semibold tracking-wider text-teal-700 dark:text-teal-400 uppercase">The CareBridge Difference</span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground font-normal mb-8 leading-tight">
                Healthcare designed around people.
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-1">Secure by design</h3>
                    <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                      Enterprise-grade HIPAA compliance and patient-first data encryption protecting every consultation and record.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-1">Simple to use</h3>
                    <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                      Zero friction or unnecessary technical complexity between you and the attentive clinical care you need.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <FolderHeart className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-1">Connected care</h3>
                    <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                      Consultations, pharmacy routing, and ongoing medical summaries united under one continuous, accessible roof.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <HeartHandshake className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-1">Human experience</h3>
                    <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                      Empathetic healthcare engineered to make visits calm, unhurried, and deeply respectful of your personal time.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Doctor Interaction Image */}
            <div className="lg:col-span-6 relative">
              <div className="rounded-3xl overflow-hidden aspect-[4/3] sm:aspect-[16/11] bg-card shadow-xl border border-border">
                <img
                  alt="Doctor consulting gently with patient"
                  className="w-full h-full object-cover object-center"
                  src="https://lh3.googleusercontent.com/aida/AEtjO1UM5Abzi00Vovr3Ea5dnB5DKETTRd7V8drjg-lvBuulQorc5ZKbWUE72w4Fr-x2vjPV2SHiE39liDhovVLfFxopbOHzIzkXFh8FFI29ZuoHH2QA9_YGriuw0ma0qaww3EIDndjU9QD_-ibvvmZ9bse1606jrKY4pRSlOrGsW2EohSfBHpbZ6iHZovO9uRhm-IbgUukcXL1ZDvI1LN9p7k0Ik2OqOdYjHej_AMVnfvASaelvFgU-00RG-54"
                />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7: FAQ */}
        <section className="w-full py-20 md:py-28 px-4 sm:px-6 md:px-12 bg-background border-b border-border" id="faq">
          <div className="max-w-4xl mx-auto">
            <div className="mb-12 text-center">
              <span className="text-xs font-semibold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-2 block">Clarifications</span>
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground font-normal">
                Frequently Asked Questions
              </h2>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-3">
              {faqItems.map((item, idx) => (
                <AccordionItem key={idx} value={`faq-${idx}`} className="border border-border rounded-xl px-4 bg-card">
                  <AccordionTrigger className="text-base font-medium text-foreground hover:text-teal-600 transition-colors py-4">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground font-light leading-relaxed pb-4">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* SECTION 8: CONTACT SECTION */}
        <section className="w-full py-20 md:py-28 px-4 sm:px-6 md:px-12 bg-slate-50/50 dark:bg-slate-900/30" id="contact">
          <div className="max-w-7xl mx-auto">
            <div className="mb-12 text-center">
              <span className="text-xs font-semibold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-2 block">Get In Touch</span>
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground font-normal">
                Contact CareBridge Support
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-xl">Contact Information</CardTitle>
                  <CardDescription>
                    Reach out to our dedicated support team for assistance with your digital health experience.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                    <Mail className="h-4 w-4 text-teal-600" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Email</p>
                      <p>support@carebridge.com</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                    <Phone className="h-4 w-4 text-teal-600" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Phone</p>
                      <p>+91 90123 45678</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                    <MapPin className="h-4 w-4 text-teal-600" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Headquarters</p>
                      <p>Sector 62, Noida, Uttar Pradesh 201309, India</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                    <Clock className="h-4 w-4 text-teal-600" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Support Hours</p>
                      <p>Mon–Sat • 9:00 AM – 7:00 PM IST</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-xl">Send Us a Message</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground" htmlFor="contact-name">
                          Name
                        </label>
                        <Input id="contact-name" placeholder="Your name" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground" htmlFor="contact-email">
                          Email
                        </label>
                        <Input id="contact-email" type="email" placeholder="you@example.com" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground" htmlFor="contact-subject">
                        Subject
                      </label>
                      <Input id="contact-subject" placeholder="How can we help?" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground" htmlFor="contact-message">
                        Message
                      </label>
                      <Textarea id="contact-message" placeholder="Type your message..." className="min-h-[120px]" />
                    </div>
                    <Button type="button" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-2">
                      <Send className="h-4 w-4" /> Send Message
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Retained existing shared Footer */}
      <Footer />
    </div>
  );
}
