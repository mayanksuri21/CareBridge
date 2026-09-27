"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import {
  CalendarRange,
  Clock,
  Trash2,
  Calendar,
  CalendarOff,
  CalendarCheck,
  Stethoscope,
  MessageSquare,
  Download,
  Activity,
  FileText,
  ExternalLink,
  CheckCircle2,
  LayoutDashboard,
  Users,
  Settings,
  HelpCircle,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  X,
  User,
} from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { generatePrescriptionPDF } from "@/lib/generate-prescription-pdf"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PrescriptionModal } from "@/components/doctor/prescription-modal"
import { LiveMetrics } from "@/components/doctor/live-metrics"
import { PendingRequestsPanel } from "@/components/doctor/pending-requests-panel"
import { TodayConsultations } from "@/components/doctor/today-consultations"
import { DoctorSlotManager } from "@/components/doctor/doctor-slot-manager"

type DoctorDashboardClientProps = {
  doctorId: string
  doctorName: string
  doctorEmail: string | null
  doctorSpecialty: string | null
  applicationStatus: string | null
  totalAppointments: number
  totalPrescriptions: number
  todayAppointments: number
  todayCompleted: number
  greeting: string
}

export function DoctorDashboardClient({
  doctorId,
  doctorName,
  doctorEmail,
  doctorSpecialty,
  applicationStatus,
  totalAppointments,
  totalPrescriptions,
  todayAppointments,
  todayCompleted,
  greeting
}: DoctorDashboardClientProps) {
  const router = useRouter()
  const { signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [savedSchedule, setSavedSchedule] = useState<any[]>([])

  const [activeNav, setActiveNav] = useState("dashboard")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

  const handleSignOut = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (signingOut) return
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    router.push("/")
  }

  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState<number>(0)

  // EHR Portal state variables
  const [patientQuery, setPatientQuery] = useState("")
  const [patients, setPatients] = useState<any[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null)

  const searchPatients = useCallback(async (q: string = "") => {
    try {
      setLoadingPatients(true)
      const res = await fetch(`/api/doctor/patients?doctor_id=${doctorId}&q=${q}`)
      if (!res.ok) throw new Error("Failed to search patients")
      const data = await res.json()
      const fetchedPatients = data.patients || []
      setPatients(fetchedPatients)

      if (fetchedPatients.length > 0) {
        setSelectedPatient((prev: any) => {
          if (prev) {
            const updated = fetchedPatients.find((p: any) => p.patient_id === prev.patient_id)
            return updated || fetchedPatients[0]
          }
          return fetchedPatients[0]
        })
      } else {
        setSelectedPatient(null)
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to load patient history records.")
    } finally {
      setLoadingPatients(false)
    }
  }, [doctorId])

  const handlePatientSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void searchPatients(patientQuery)
  }

  useEffect(() => {
    void searchPatients()
  }, [])

  useEffect(() => {
    if (!doctorId) return

    const cached = localStorage.getItem(`doctor_schedule_${doctorId}`)
    if (cached) {
      try {
        setSavedSchedule(JSON.parse(cached))
        setLoadingSchedule(false)
      } catch (_) { }
    }

    fetch(`/api/doctor/schedule?doctor_id=${doctorId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.presets && data.presets.length > 0) {
          setSavedSchedule(data.presets)
          localStorage.setItem(`doctor_schedule_${doctorId}`, JSON.stringify(data.presets))
        }
      })
      .catch((err) => console.error("Error loading schedule:", err))
      .finally(() => {
        setLoadingSchedule(false)
      })
  }, [doctorId])

  const deletePresetItem = async (index: number) => {
    try {
      const updated = savedSchedule.filter((_, idx) => idx !== index)
      const res = await fetch("/api/doctor/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_id: doctorId, presets: updated })
      })
      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || "Failed to remove item")
      }
      setSavedSchedule(updated)
      localStorage.setItem(`doctor_schedule_${doctorId}`, JSON.stringify(updated))
      toast.success("Schedule item removed.")
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to delete schedule item.")
    }
  }

  const doctorInitials = (doctorName || "DR")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "#dashboard" },
    { id: "schedule", label: "My Schedule", icon: CalendarRange, href: "#schedule" },
    { id: "patients", label: "Patients", icon: Users, href: "#patients" },
    { id: "requests", label: "Consultation Requests", icon: MessageSquare, href: "#requests", badge: pendingCount > 0 ? pendingCount : null },
    { id: "prescriptions", label: "Prescriptions", icon: FileText, href: "#prescriptions-section" },
    { id: "settings", label: "Settings", icon: Settings, href: "#doctor-header" },
  ]

  const handleNavClick = (id: string, href: string) => {
    setActiveNav(id)
    setMobileMenuOpen(false)
    if (href.startsWith("#")) {
      const el = document.querySelector(href)
      if (el) {
        el.scrollIntoView({ behavior: "smooth" })
      }
    } else {
      router.push(href)
    }
  }

  return (
    <div id="dashboard" className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col">
      {/* LEFT SIDEBAR NAVIGATION (DESKTOP) */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200/80 z-40 p-4 hidden lg:flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          {/* CareBridge Brand Logo Header */}
          <div className="flex items-center gap-3 px-2 pt-2">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <span className="font-extrabold text-xl text-slate-900 tracking-tight block leading-none">CareBridge</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">Doctor Portal</span>
            </div>
          </div>

          {/* Navigation Links List */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeNav === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id, item.href)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-teal-50/80 text-teal-700 font-bold border border-teal-100/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Help Box & Doctor Profile Footer */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="bg-sky-50/70 border border-sky-100 p-4 rounded-2xl space-y-2">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900">Need help?</p>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Contact support for any assistance.</p>
            </div>
            <button
              onClick={() => toast.info("Support contact: support@carebridge.health")}
              className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer pt-1"
            >
              Get Support &gt;
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center border border-teal-200 shrink-0">
                {doctorInitials}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate">Dr. {doctorName}</span>
                <span className="text-[10px] text-slate-500 block truncate">{doctorSpecialty || "General Medicine"}</span>
              </div>
            </div>
            <button
              onClick={() => void handleSignOut()}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative bg-white w-64 max-w-full p-4 flex flex-col justify-between h-full z-10 space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2 pt-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center">
                    <Stethoscope className="w-4 h-4 text-teal-600" />
                  </div>
                  <span className="font-extrabold text-lg text-slate-900">CareBridge</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeNav === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id, item.href)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-teal-50 text-teal-700 font-bold border border-teal-100"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge ? (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center border border-teal-200">
                  {doctorInitials}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate">Dr. {doctorName}</span>
                </div>
              </div>
              <button
                onClick={() => void handleSignOut()}
                className="p-2 text-slate-400 hover:text-rose-600 rounded-xl"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP BAR & MAIN CONTENT WRAPPER */}
      <div className="lg:pl-64 flex-1 flex flex-col min-w-0">
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          {/* Search Input Bar (connected to patient search logic) */}
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <form onSubmit={handlePatientSearchSubmit} className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search patients by name, email, or ID..."
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
              />
            </form>
          </div>

          {/* Top Bar Utilities & Profile Dropdown */}
          <div className="flex items-center gap-3.5 shrink-0">
            <div className="relative">
              <button
                className="p-2 rounded-xl border border-slate-200/80 text-slate-600 hover:bg-slate-50 relative transition cursor-pointer"
                onClick={() => toast.info("No unread notifications.")}
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-white"></span>
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 p-1.5 rounded-xl border border-slate-200/80 hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-extrabold text-xs flex items-center justify-center border border-teal-200">
                  {doctorInitials}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-bold text-slate-900 block leading-tight">Dr. {doctorName}</span>
                  <span className="text-[10px] text-slate-500 block leading-tight">{doctorSpecialty || "General Medicine"}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-lg py-1.5 z-50 text-xs">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="font-bold text-slate-900">Dr. {doctorName}</p>
                    <p className="text-[10px] text-slate-500 truncate">{doctorEmail || "Verified Doctor"}</p>
                  </div>
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false)
                      handleNavClick("settings", "#doctor-header")
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" /> Profile & Details
                  </button>
                  <button
                    onClick={() => void handleSignOut()}
                    className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* MAIN BODY DASHBOARD CONTENT */}
        <main className="flex-1 p-4 md:p-6 space-y-6">
          {/* DOCTOR HEADER BANNER SECTION */}
          <section id="doctor-header" className="bg-white border border-sky-100 rounded-3xl p-6 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{greeting},</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Dr. {doctorName}
                  </h1>
                  {doctorSpecialty && (
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200/80 px-3 py-1 rounded-full">
                      {doctorSpecialty}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  {applicationStatus && (
                    <Badge variant="outline" className="font-bold border-emerald-300 bg-emerald-50 text-emerald-700 gap-1 rounded-full px-3 py-0.5 text-xs">
                      Verified &middot; {applicationStatus}
                    </Badge>
                  )}
                  {doctorEmail && (
                    <span className="text-xs text-slate-500 font-medium">
                      {doctorEmail}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Button asChild variant="outline" className="gap-2 rounded-xl border-slate-200 font-semibold text-xs h-10 px-4">
                  <Link href="/consultation/book">
                    <CalendarCheck className="h-4 w-4 text-sky-600" /> Book on behalf
                  </Link>
                </Button>
                <PrescriptionModal
                  doctorId={doctorId}
                  patientId={selectedPatient?.patient_id}
                  patientName={selectedPatient?.name}
                  triggerLabel="Quick Prescription"
                />
              </div>
            </div>
          </section>

          {/* LIVE METRICS CARDS */}
          <LiveMetrics
            doctorId={doctorId}
            initialTotalAppointments={totalAppointments}
            initialTotalPrescriptions={totalPrescriptions}
            initialTodayAppointments={todayAppointments}
            initialTodayCompleted={todayCompleted}
          />

          {/* SECTION 2: TODAY'S CONSULTATIONS (LEFT) + SCHEDULE & AVAILABILITY (RIGHT) */}
          <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            {/* Today's Consultations */}
            <TodayConsultations doctorId={doctorId} />

            {/* Schedule & Availability Section */}
            <div id="schedule">
              <Card className="border-sky-100 shadow-2xs bg-white rounded-3xl overflow-hidden h-full flex flex-col justify-between">
                <CardHeader className="bg-sky-50/50 border-b border-sky-100 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-900 tracking-tight">
                        <CalendarRange className="h-4 w-4 text-sky-600" /> Schedule &amp; Availability
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        Configure working hours, manage leaves, and set availability for patient booking.
                      </CardDescription>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs cursor-pointer"
                      onClick={() => setModalOpen(true)}
                    >
                      Manage
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 tracking-tight">Today&apos;s Availability</h4>

                    {loadingSchedule ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
                        <Clock className="h-4 w-4 animate-spin text-sky-600" /> Loading schedule...
                      </div>
                    ) : savedSchedule.length === 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="text-xs font-extrabold px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 10:30 AM
                        </span>
                        <span className="text-xs font-extrabold px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 12:00 PM
                        </span>
                        <span className="text-xs font-extrabold px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 02:00 PM
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {savedSchedule.map((item: any, idx: number) => {
                          const isLeavePreset = item.slots && item.slots.length === 0
                          return (
                            <div
                              key={idx}
                              className={`flex items-start justify-between border rounded-2xl p-3 transition-all text-xs ${
                                isLeavePreset ? "border-amber-200 bg-amber-50/50" : "border-sky-100 bg-slate-50/70"
                              }`}
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <span className="text-xs font-bold text-slate-900 block tracking-tight">{item.interval}</span>
                                {isLeavePreset ? (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-semibold border-amber-200 text-[10px]">
                                    Leave / Unavailable
                                  </Badge>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {item.slots && item.slots.map((slot: string) => {
                                      let displaySlot = slot
                                      if (slot.includes("T") || (slot.includes("-") && slot.includes(":"))) {
                                        const d = new Date(slot)
                                        if (!isNaN(d.getTime())) {
                                          displaySlot = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                        }
                                      }
                                      return (
                                        <span
                                          key={slot}
                                          className="text-[10px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg inline-flex items-center gap-1"
                                        >
                                          <Clock className="w-3 h-3 text-emerald-600" />
                                          {displaySlot}
                                        </span>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-rose-600 hover:bg-rose-50 rounded-xl h-7 w-7 shrink-0 ml-2"
                                onClick={() => deletePresetItem(idx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button
                      size="sm"
                      className="bg-[#0070f3] hover:bg-[#005bb5] text-white font-bold rounded-xl text-xs px-4 py-2 shadow-2xs cursor-pointer"
                      onClick={() => setModalOpen(true)}
                    >
                      Set Availability
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs px-4 py-2 cursor-pointer gap-1.5"
                      onClick={async () => {
                        const bookingUrl = `${window.location.origin}/consultation/book?doctor=${doctorId}`
                        if (navigator.clipboard) {
                          await navigator.clipboard.writeText(bookingUrl)
                          toast.success("Booking link copied to clipboard!")
                        }
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" /> Share Booking Link
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* SECTION 3: CONSULTATION REQUESTS (LEFT) + CONFIRMED CONSULTATIONS (RIGHT) */}
          <section id="requests">
            <PendingRequestsPanel doctorId={doctorId} onRequestCountChange={setPendingCount} />
          </section>

          {/* PATIENT MEDICAL HISTORY & EHR SEARCH PORTAL SECTION */}
          <section id="patients" className="pt-2">
            <Card className="w-full border-sky-100 shadow-2xs bg-white rounded-3xl overflow-hidden">
              <CardHeader className="bg-sky-50/50 border-b border-sky-100 p-5">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  🩺 Patient Medical History & EHR Search Portal
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Search patients by Name, Email, or Blood Group to view complete clinical timelines.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handlePatientSearchSubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
                  <Input
                    type="text"
                    placeholder="Search patient by name, email, or blood group..."
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    className="max-w-md rounded-xl border-slate-200 text-xs bg-slate-50"
                  />
                  <Button type="submit" className="bg-[#00a86b] hover:bg-[#008f5b] text-white font-bold rounded-xl px-6 text-xs">
                    Search
                  </Button>
                  {patientQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setPatientQuery("")
                        void searchPatients("")
                      }}
                      className="rounded-xl text-slate-500 text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </form>

                <div className="grid gap-6 md:grid-cols-[1fr_2.2fr]">
                  {/* Left Column: Patients List */}
                  <div className="border border-slate-200/80 rounded-2xl p-3 bg-slate-50/60 max-h-[480px] overflow-y-auto space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 px-1">
                      Patients ({patients.length})
                    </span>

                    {loadingPatients ? (
                      <div className="text-center py-8 text-xs text-slate-500">
                        Loading records...
                      </div>
                    ) : patients.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-500">
                        No matching patients found.
                      </div>
                    ) : (
                      patients.map((p) => {
                        const isSelected = selectedPatient?.patient_id === p.patient_id
                        return (
                          <div
                            key={p.patient_id}
                            onClick={() => setSelectedPatient(p)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? "border-emerald-500 bg-emerald-50 text-slate-900 shadow-2xs font-semibold"
                                : "border-slate-200/80 hover:bg-white text-slate-800 bg-white/70"
                            }`}
                          >
                            <span className="font-bold block text-xs">{p.name}</span>
                            <span className="text-[11px] text-slate-500 block truncate mt-0.5">{p.email}</span>
                            <div className="flex justify-between items-center mt-2 text-[10px] font-medium text-slate-400">
                              <span>Blood: {p.blood_group}</span>
                              <span>Visits: {p.total_visits}</span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Right Column: Selected Patient Details & Medical History Timeline */}
                  <div className="border border-slate-200/80 rounded-2xl p-5 bg-white min-h-[400px]">
                    {selectedPatient ? (
                      <div className="space-y-6">
                        {/* Patient Header Bio */}
                        <div className="border-b border-slate-100 pb-4">
                          <h3 className="text-xl font-extrabold tracking-tight text-slate-900">{selectedPatient.name}</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Phone</span>
                              <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{selectedPatient.phone || "Not provided"}</span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Email</span>
                              <span className="font-semibold text-slate-800 text-xs mt-0.5 block truncate">{selectedPatient.email || "Not provided"}</span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Visits</span>
                              <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{selectedPatient.total_visits}</span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Blood Group</span>
                              <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{selectedPatient.blood_group || "N/A"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Medical timeline */}
                        <div className="grid gap-6 md:grid-cols-2">
                          {/* Consultation History Timeline */}
                          <div className="space-y-3">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Consultation History ({selectedPatient.appointments.length})
                            </h4>
                            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                              {selectedPatient.appointments.map((appt: any, idx: number) => {
                                let displayDate = "Date unavailable"
                                const rawDate = appt.scheduled_at || appt.appointment_date || appt.created_at
                                if (rawDate) {
                                  const dateObj = new Date(rawDate)
                                  if (!isNaN(dateObj.getTime())) {
                                    displayDate = dateObj.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })
                                  }
                                }
                                const linkedRx = selectedPatient.prescriptions?.find((r: any) => r.appointment_id === appt.id)
                                return (
                                  <div key={idx} className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/50 space-y-1.5 text-xs">
                                    <div className="flex justify-between items-center">
                                      <span className="font-bold text-[10px] text-slate-400">
                                        {displayDate}
                                      </span>
                                      <Badge variant="outline" className="text-[9px] uppercase font-bold border-emerald-200 text-emerald-700 bg-emerald-50">
                                        {appt.status}
                                      </Badge>
                                    </div>
                                    <p className="text-slate-900 font-semibold">{appt.reason || "General Consultation"}</p>
                                    {appt.symptoms && (
                                      <p className="text-[10px] text-slate-500 bg-white p-1.5 rounded-lg border border-slate-100">
                                        <span className="font-semibold text-slate-700">Symptoms:</span> {appt.symptoms}
                                      </p>
                                    )}
                                    {linkedRx ? (
                                      <div className="pt-1.5 flex items-center justify-between border-t border-slate-100 text-[10px]">
                                        <span className="text-teal-700 font-bold flex items-center gap-1">
                                          <FileText className="w-3 h-3" /> Prescription Issued
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => window.open(`/prescription/${linkedRx.id}`, "_blank")}
                                          className="text-teal-600 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                                        >
                                          View Rx <ExternalLink className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Completed
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Prescriptions History */}
                          <div id="prescriptions-section" className="space-y-3">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                              <span>Prescribed Diagnoses ({selectedPatient.prescriptions.length})</span>
                              <Badge variant="outline" className="text-[9px] uppercase font-bold border-teal-200 text-teal-700 bg-teal-50">
                                Issued Prescriptions
                              </Badge>
                            </h4>
                            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                              {selectedPatient.prescriptions.length === 0 ? (
                                <p className="text-xs text-slate-400 py-4">No historical prescriptions issued by you.</p>
                              ) : (
                                selectedPatient.prescriptions.map((rx: any, idx: number) => {
                                  const dateObj = new Date(rx.created_at)
                                  return (
                                    <div key={idx} className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/50 space-y-2 text-xs">
                                      <div className="flex justify-between items-center">
                                        <span className="font-bold text-[10px] text-slate-400 flex items-center gap-1">
                                          <FileText className="w-3 h-3 text-teal-600" />
                                          {isNaN(dateObj.getTime()) ? "Issued" : dateObj.toLocaleDateString()}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 text-[10px] px-2 gap-1 text-teal-700 border-teal-200 hover:bg-teal-50"
                                            onClick={() => window.open(`/prescription/${rx.id}`, "_blank")}
                                          >
                                            <ExternalLink className="h-2.5 w-2.5" /> View
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 text-slate-500 hover:bg-slate-100"
                                            title="Download PDF"
                                            onClick={() => {
                                              if (rx.id) {
                                                window.open(`/api/prescriptions/pdf?id=${rx.id}`, "_blank")
                                              } else {
                                                generatePrescriptionPDF({
                                                  ...rx,
                                                  doctor_name: doctorName
                                                })
                                              }
                                            }}
                                          >
                                            <Download className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                      <p className="text-slate-900 font-semibold">{rx.diagnosis || "General Consultation"}</p>
                                      {rx.medicines && rx.medicines.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {rx.medicines.map((m: any, mIdx: number) => (
                                            <span
                                              key={mIdx}
                                              className="text-[9px] bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded border border-teal-100 font-semibold"
                                            >
                                              {m.medication_name || m.medicineName || m.name} ({m.dosage})
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center h-full text-xs text-slate-400 py-16 space-y-2">
                        <Activity className="h-8 w-8 text-slate-300" />
                        <p className="font-bold text-slate-700">No Patient Selected</p>
                        <p className="max-w-xs text-[11px] text-slate-400">Select a patient from the search list to view their complete Electronic Health Record (EHR) timeline.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>

      {/* Availability Configuration Dialog Component */}
      <DoctorSlotManager
        doctorId={doctorId}
        open={modalOpen}
        onOpenChange={setModalOpen}
        savedSchedule={savedSchedule}
        onSuccess={(updatedPresets) => {
          setSavedSchedule(updatedPresets)
        }}
      />
    </div>
  )
}
