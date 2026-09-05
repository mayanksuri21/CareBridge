"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Activity, ArrowRight, CalendarDays, FileText, Send, Stethoscope, CheckCircle2, Pill, Video } from "lucide-react"
import { toast } from "sonner"

import { PatientPrescriptionsSection } from "@/components/patient/prescriptions-section"
import { MyConsultationsPanel } from "@/components/patient/my-consultations-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { generatePrescriptionPDF, type PrintablePrescription } from "@/lib/generate-prescription-pdf"
import { Download } from "lucide-react"
import { formatStableDateTime, formatStableDate } from "@/lib/utils"

/** Plays a pleasant dual-tone chime when the doctor starts the consultation. */
function playDoctorAlertChime() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Note 1: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Note 2: A5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.15);
    gain2.gain.setValueAtTime(0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn("Could not play consultation chime:", e);
  }
}

/** Returns true if a consultation's scheduled date+time is more than 30 minutes in the past. */
function isConsultationPast(appt: any): boolean {
  try {
    const dStr = appt.appointment_date || appt.scheduled_date || appt.scheduled_at?.split('T')?.[0] || appt.scheduled_at?.split(' ')?.[0] || '';
    if (!dStr) return false;
    let parsedDate: Date | null = null;
    if (dStr.includes('-')) {
      const parts = dStr.split('-');
      if (parts[0].length === 4) {
        parsedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        parsedDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    } else if (dStr.includes('/')) {
      const parts = dStr.split('/');
      if (parts[2]?.length === 4) {
        parsedDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      const tStr = appt.time_slot || appt.scheduled_time || '';
      let hours = 12, minutes = 0;
      if (tStr) {
        const timeParts = tStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeParts) {
          hours = parseInt(timeParts[1], 10);
          minutes = parseInt(timeParts[2], 10);
          const ampm = timeParts[3].toUpperCase();
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        }
      }
      const scheduledDateTime = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), hours, minutes, 0, 0);
      const now = new Date();
      return now.getTime() > scheduledDateTime.getTime() + 30 * 60 * 1000;
    }
  } catch {}
  return false;
}

/** Returns true if the appointment is a live/active consultation (not past, not just scheduled). */
function isLiveConsultation(appt: any): boolean {
  return appt.status === 'doctor_in_room' || appt.status === 'patient_waiting' ||
    appt.status === 'patient_admitted' || appt.status === 'in_progress' || appt.call_active;
}

/** Filter out past scheduled/booked consultations — keep live, pending, and rejected/declined. */
function filterOutPastConsultations(appts: any[]): any[] {
  return appts.filter((a: any) => {
    if (isLiveConsultation(a)) return true;
    if (a.status === 'pending') return true;
    if (a.status === 'rejected' || a.status === 'declined' || a.status === 'cancelled') return true;
    return !isConsultationPast(a);
  });
}

function formatAppointmentSlot(appt: any) {
  if (appt.appointment_date && appt.time_slot) {
    return `📅 ${appt.appointment_date}  ⏰ ${appt.time_slot}`
  }
  if (appt.scheduled_at) {
    const start = new Date(appt.scheduled_at)
    if (!Number.isNaN(start.getTime())) {
      const datePart = start.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      const timePart = start.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
      return `📅 ${datePart}  ⏰ ${timePart}`
    }
  }
  if (appt.reason) {
    const dateMatch = appt.reason.match(/Selected Date:\s*([\w\d, -]+)/i) || appt.reason.match(/Preferred Date:\s*([\w\d, -]+)/i)
    const timeMatch = appt.reason.match(/Time Slot:\s*([\w\d: ]+)/i)
    if (dateMatch && timeMatch) {
      return `📅 ${dateMatch[1].trim()}  ⏰ ${timeMatch[1].trim()}`
    }
    if (dateMatch) {
      return `📅 ${dateMatch[1].trim()}`
    }
  }
  return "Time not set"
}

type PatientDashboardClientProps = {
  patientId: string
  patientName: string
  patientEmail: string | null | undefined
  initialPrescriptions?: PrintablePrescription[]
  initialAppointments?: any[]
}

export function PatientDashboardClient({
  patientId,
  patientName,
  patientEmail,
  initialPrescriptions = [],
  initialAppointments = [],
}: PatientDashboardClientProps) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [symptoms, setSymptoms] = useState("")
  const [primaryConcern, setPrimaryConcern] = useState("")
  const [bookingDoctorId, setBookingDoctorId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [prescriptions, setPrescriptions] = useState<PrintablePrescription[]>(initialPrescriptions)
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(true)
  const [appointments, setAppointments] = useState<any[]>(initialAppointments)
  const [loadingAppointments, setLoadingAppointments] = useState(initialAppointments.length === 0)

  const [symptomLogs, setSymptomLogs] = useState<any[]>([])

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem('patient_symptom_history') || '[]')
      setSymptomLogs(data)
    } catch (_) {
      setSymptomLogs([])
    }
  }, [])

  const activeAppointments = filterOutPastConsultations(appointments)

  const upcomingCount = activeAppointments.filter((appt) =>
    appt.status === "scheduled" || appt.status === "confirmed" || appt.status === "booked" || appt.status === "in_progress"
  ).length

  const pendingCount = activeAppointments.filter((appt) =>
    appt.status === "pending"
  ).length

  const liveAppointment = appointments.find((appt) => {
    const isDeclined = appt.status === "declined" || appt.status === "cancelled" || appt.status === "rejected" || appt.reason?.includes("Declined:");
    if (isDeclined || appt.status === "completed") return false;
    if (appt.status === "scheduled" || appt.status === "booked" || appt.status === "pending" || appt.status === "confirmed") return false;
    return appt.status === "in_progress" || appt.status === "doctor_in_room" || (Boolean(appt.is_doctor_in_room) && appt.status !== "scheduled" && appt.status !== "booked" && appt.status !== "confirmed");
  })

  const playedChimeForApptIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (liveAppointment && playedChimeForApptIdRef.current !== liveAppointment.id) {
      playedChimeForApptIdRef.current = liveAppointment.id;
      playDoctorAlertChime();
    }
  }, [liveAppointment]);

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  })()

  const refreshPrescriptions = useCallback(async () => {
    let completed = false
    const safetyTimer = setTimeout(() => {
      if (!completed) {
        setLoadingPrescriptions(false)
      }
    }, 8000)
    try {
      setLoadingPrescriptions(true)
      if (!patientId) {
        setPrescriptions([])
        return
      }
      const res = await fetch(`/api/prescriptions?patient_id=${patientId}`)
      if (!res.ok) throw new Error("Failed to fetch prescriptions")

      const payload = await res.json()
      setPrescriptions(payload.prescriptions || [])
    } catch (err) {
      console.error("Prescription fetch error:", err)
      setPrescriptions(initialPrescriptions)
    } finally {
      completed = true
      clearTimeout(safetyTimer)
      setLoadingPrescriptions(false)
    }
  }, [patientId, initialPrescriptions])

  const refreshAppointments = useCallback(async () => {
    try {
      setLoadingAppointments(true)
      const res = await fetch(`/api/patient/consultations?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      if (!res.ok) throw new Error("Failed to fetch appointments")

      const payload = await res.json()
      let list = payload.appointments || []

      // Filter by patient ID
      if (patientId) {
        list = list.filter((a: any) => a.patient_id === patientId);
      }

      // Map appointment status client-side exactly like the call api does
      list = list.map((appt: any) => {
        const reasonStr = appt.reason || '';
        const isDeclined = appt.status === 'cancelled' || appt.status === 'rejected' || appt.status === 'declined' || reasonStr.includes('Declined:') || reasonStr.includes('[PATIENT_DECLINED]');

        const isDoctorInRoom = !isDeclined && (reasonStr.includes('[DOCTOR_IN_ROOM]') || Boolean(appt.is_doctor_in_room));
        const isPatientWaiting = !isDeclined && reasonStr.includes('[PATIENT_WAITING]');
        const isPatientAdmitted = !isDeclined && reasonStr.includes('[PATIENT_ADMITTED]');
        const isCallActive = !isDeclined && (reasonStr.includes('[CALL_ACTIVE]') || isDoctorInRoom);
        const isPendingApproval = reasonStr.includes('[PENDING_APPROVAL]');

        let cleanReason = reasonStr;
        ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]'].forEach(tag => {
          cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '');
        });

        let statusVal = appt.status;
        if (appt.status === 'completed') {
          statusVal = 'completed';
        } else if (isDeclined) {
          statusVal = 'declined';
        } else if (isPatientAdmitted) {
          statusVal = 'patient_admitted';
        } else if (isPatientWaiting) {
          statusVal = 'patient_waiting';
        } else if (isDoctorInRoom) {
          statusVal = 'doctor_in_room';
        } else if (isCallActive || appt.status === 'in_progress') {
          statusVal = 'in_progress';
        } else if (appt.status === 'confirmed') {
          statusVal = 'confirmed';
        } else if (appt.status === 'scheduled') {
          statusVal = 'scheduled';
        } else if (appt.status === 'booked') {
          statusVal = isPendingApproval ? 'pending' : 'scheduled';
        }

        // Parse date/time
        const dateMatch = cleanReason.match(/Selected Date:\s*([\w\d, -]+)/i) || cleanReason.match(/Preferred Date:\s*([\w\d, -]+)/i);
        const timeMatch = cleanReason.match(/Time Slot:\s*([\w\d: ]+)/i);
        const parsedDate = dateMatch ? dateMatch[1].trim() : (appt.scheduled_date || '17-08-2026');
        const parsedTime = timeMatch ? timeMatch[1].trim() : (appt.scheduled_time || '12:00 PM');

        return {
          ...appt,
          id: appt.id,
          roomId: appt.id,
          appointment_id: appt.id,
          status: statusVal,
          is_doctor_in_room: isDoctorInRoom,
          call_active: isCallActive,
          reason: cleanReason,
          appointment_date: parsedDate,
          time_slot: parsedTime,
          doctor_name: appt.doctor_name || 'Dr. Rahul Sharma',
          department: appt.department || 'General Medicine'
        };
      });

      setAppointments(filterOutPastConsultations(list))
    } catch (err) {
      console.error(err)
      setAppointments([])
    } finally {
      setLoadingAppointments(false)
    }
  }, [patientId])

  useEffect(() => {
    void refreshAppointments()
  }, [refreshAppointments])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/patient/consultations?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.appointments) {
            let list = data.appointments;
            if (patientId) {
              list = list.filter((a: any) => a.patient_id === patientId);
            }

            list = list.map((appt: any) => {
              const reasonStr = appt.reason || '';
              const isDoctorInRoom = reasonStr.includes('[DOCTOR_IN_ROOM]') || appt.is_doctor_in_room;
              const isPatientWaiting = reasonStr.includes('[PATIENT_WAITING]');
              const isPatientAdmitted = reasonStr.includes('[PATIENT_ADMITTED]');
              const isPatientDeclined = reasonStr.includes('[PATIENT_DECLINED]');
              const isCallActive = reasonStr.includes('[CALL_ACTIVE]') || isDoctorInRoom;
              const isPendingApproval = reasonStr.includes('[PENDING_APPROVAL]');

              let cleanReason = reasonStr;
              ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]'].forEach(tag => {
                cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '');
              });

              let statusVal = appt.status;
              if (appt.status === 'completed') {
                statusVal = 'completed';
              } else if (isPatientDeclined) {
                statusVal = 'declined';
              } else if (isDoctorInRoom) {
                statusVal = 'in_progress';
              } else if (isPatientAdmitted) {
                statusVal = 'patient_admitted';
              } else if (isPatientWaiting) {
                statusVal = 'patient_waiting';
              } else if (appt.status === 'in_progress') {
                statusVal = 'in_progress';
              } else if (appt.status === 'confirmed') {
                statusVal = 'confirmed';
              } else if (appt.status === 'scheduled') {
                statusVal = 'scheduled';
              } else if (appt.status === 'booked') {
                statusVal = isPendingApproval ? 'pending' : 'scheduled';
              }

              // Parse date/time
              const dateMatch = cleanReason.match(/Selected Date:\s*([\w\d, -]+)/i) || cleanReason.match(/Preferred Date:\s*([\w\d, -]+)/i);
              const timeMatch = cleanReason.match(/Time Slot:\s*([\w\d: ]+)/i);
              const parsedDate = dateMatch ? dateMatch[1].trim() : (appt.scheduled_date || '17-08-2026');
              const parsedTime = timeMatch ? timeMatch[1].trim() : (appt.scheduled_time || '12:00 PM');

              return {
                ...appt,
                id: appt.id,
                roomId: appt.id,
                appointment_id: appt.id,
                status: statusVal,
                is_doctor_in_room: isDoctorInRoom,
                call_active: statusVal !== 'completed' && (isDoctorInRoom || statusVal === 'in_progress' || isPatientWaiting || isPatientAdmitted),
                reason: cleanReason,
                appointment_date: parsedDate,
                time_slot: parsedTime,
                doctor_name: appt.doctor_name || 'Dr. Rahul Sharma',
                department: appt.department || 'General Medicine'
              };
            });

            setAppointments(filterOutPastConsultations(list));
          }
        }
      } catch (err) {
        console.error("Failed to poll call state:", err);
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [patientId]);

  useEffect(() => {
    const channel = supabase
      .channel(`patient-${patientId}-appointments`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `patient_id=eq.${patientId}` },
        () => {
          void refreshAppointments()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, patientId, refreshAppointments])

  useEffect(() => {
    if (initialPrescriptions.length > 0) {
      setPrescriptions(initialPrescriptions)
      setLoadingPrescriptions(false)
    }
    void refreshPrescriptions()
  }, [refreshPrescriptions, initialPrescriptions])

  useEffect(() => {
    const channel = supabase
      .channel(`patient-${patientId}-prescriptions`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "prescriptions", filter: `patient_id=eq.${patientId}` },
        () => refreshPrescriptions(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, patientId, refreshPrescriptions])

  async function handleRequestConsultation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    const reason = [primaryConcern.trim(), symptoms.trim()].filter(Boolean).join(" — ") || "Patient requested consultation"
    const symptomsPayload = symptoms.trim() || primaryConcern.trim() || null

    try {
      const doctorId = bookingDoctorId.trim() || null

      let slotId: string | null = null
      if (!doctorId) {
        const { data: anyDoctor } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "doctor")
          .limit(1)
          .maybeSingle()
        if (anyDoctor) {
          try {
            const { data: slot, error: slotError } = await supabase
              .from("schedule_slots")
              .insert({
                doctor_id: anyDoctor.id,
                start_time: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
                end_time: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
                is_booked: true,
              })
              .select("id")
              .maybeSingle()
            if (!slotError && slot) slotId = slot.id
          } catch {
          }
        }
      }

      const { error } = await supabase
        .from("appointments")
        .insert({
          patient_id: patientId,
          doctor_id: doctorId,
          slot_id: slotId,
          status: "pending",
          reason,
          symptoms: symptomsPayload,
        })

      if (error) throw error

      setSubmitted(true)
      setSymptoms("")
      setPrimaryConcern("")
      setBookingDoctorId("")
      toast.success("Consultation request submitted! You will receive a confirmation shortly.")

      setTimeout(() => router.push("/consultation/book"), 1500)
    } catch (err) {
      console.error(err)
      toast.error("Unable to submit your request. Please try the booking page directly.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden font-sans pb-12">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none -z-10" />

      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/65 sticky top-0 z-30 shadow-lg">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Activity className="h-5 w-5 text-slate-950 font-bold" />
            </div>
            <div>
              <Link href="/" className="text-xs font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 hover:opacity-90 transition-opacity">
                CareBridge Telehealth
              </Link>
              <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-white">
                Welcome back, {patientName}
              </h1>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-900/60 rounded-xl transition-all">
              <Link href="/patient/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-900/60 rounded-xl transition-all">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-900/60 rounded-xl transition-all">
              <Link href="/profile">My Profile</Link>
            </Button>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition-all font-semibold text-xs px-4 py-2">
              <Link href="/consultation/book">Book a Doctor</Link>
            </Button>
          </nav>
        </div>
      </header>

      {liveAppointment && (() => {
        const rawDoctorName = liveAppointment.doctor?.name || liveAppointment.doctor_name || "Rahul Sharma";
        const formattedDoctorName = rawDoctorName.startsWith('Dr.') ? rawDoctorName : `Dr. ${rawDoctorName}`;
        return (
          <div className="border-b border-emerald-500/40 backdrop-blur-md py-4 px-6 sticky top-[81px] z-20 animate-in fade-in slide-in-from-top duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(6,95,70,0.85) 0%, rgba(15,23,42,0.92) 50%, rgba(6,95,70,0.85) 100%)',
              boxShadow: '0 0 40px rgba(16,185,129,0.3), 0 0 80px rgba(16,185,129,0.15), inset 0 1px 0 rgba(16,185,129,0.2)',
              animation: 'livePulseGlow 2s ease-in-out infinite'
            }}>
            <style>{`
              @keyframes livePulseGlow {
                0%, 100% { box-shadow: 0 0 40px rgba(16,185,129,0.3), 0 0 80px rgba(16,185,129,0.15), inset 0 1px 0 rgba(16,185,129,0.2); }
                50% { box-shadow: 0 0 60px rgba(16,185,129,0.5), 0 0 120px rgba(16,185,129,0.25), inset 0 1px 0 rgba(16,185,129,0.3); }
              }
            `}</style>
            <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3.5 w-3.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </span>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="text-base">🔴</span>
                  {formattedDoctorName} has started your consultation and is waiting in the room!
                </p>
              </div>
              <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/40 px-6 py-2.5 text-xs font-extrabold shrink-0 animate-pulse border border-emerald-400">
                <Link href={`/consultation/${liveAppointment.id}`} className="flex items-center gap-2">
                  <Video className="w-4 h-4" /> Join Now
                </Link>
              </Button>
            </div>
          </div>
        );
      })()}

      <main className="container mx-auto px-6 py-8">
        <section className="mb-8 rounded-3xl border border-slate-900 bg-slate-900/20 backdrop-blur-md p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl -z-10" />
          <p className="text-xs font-bold tracking-wider text-emerald-400 uppercase">{greeting}</p>
          <h2 className="text-xl font-extrabold tracking-tight text-white mt-1">
            Here&apos;s your CareBridge health overview
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 backdrop-blur-sm p-5 hover:border-slate-700/65 transition-all group relative overflow-hidden shadow-md">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500/40" />
              <p className="text-xs font-medium text-slate-400">Active Prescriptions</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-white group-hover:scale-105 transition-transform origin-left">{prescriptions.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 backdrop-blur-sm p-5 hover:border-slate-700/65 transition-all group relative overflow-hidden shadow-md">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-500/40" />
              <p className="text-xs font-medium text-slate-400">Upcoming Appointments</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-white group-hover:scale-105 transition-transform origin-left">
                {upcomingCount} <span className="text-sm font-medium text-slate-400">Scheduled</span>
                <span className="text-sm font-medium text-slate-400 ml-2">|</span>
                <span className="text-sm font-medium text-amber-400 ml-2">{pendingCount} Pending</span>
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 backdrop-blur-sm p-5 hover:border-slate-700/65 transition-all group relative overflow-hidden shadow-md">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-violet-500/40" />
              <p className="text-xs font-medium text-slate-400">Last Visit</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-white group-hover:scale-105 transition-transform origin-left" suppressHydrationWarning>
                {prescriptions[0]
                  ? formatStableDate(prescriptions[0].created_at)
                  : "—"}
              </p>
            </div>
          </div>
        </section>

        <Tabs defaultValue="records" className="space-y-6">
          <TabsList className="h-auto w-full justify-start gap-2 bg-slate-950/60 border border-slate-900/50 p-2 sm:w-fit rounded-2xl backdrop-blur-md shadow-2xl relative">
            <TabsTrigger
              value="records"
              className="gap-2 rounded-xl py-2.5 px-4 text-slate-400 transition-all font-semibold text-xs data-[state=active]:bg-slate-900 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/30 data-[state=active]:shadow-[0_0_15px_rgba(16,185,129,0.15)] border border-transparent hover:text-slate-200 hover:border-slate-800/85 hover:bg-slate-900/40"
            >
              <FileText className="size-4 text-emerald-400 group-data-[state=active]:animate-pulse" />
              Medical Records
            </TabsTrigger>
            <TabsTrigger
              value="appointments"
              className="gap-2 rounded-xl py-2.5 px-4 text-slate-400 transition-all font-semibold text-xs data-[state=active]:bg-slate-900 data-[state=active]:text-cyan-400 data-[state=active]:border-cyan-500/30 data-[state=active]:shadow-[0_0_15px_rgba(6,182,212,0.15)] border border-transparent hover:text-slate-200 hover:border-slate-800/85 hover:bg-slate-900/40"
            >
              <CalendarDays className="size-4 text-cyan-400 group-data-[state=active]:animate-pulse" />
              My Consultations
            </TabsTrigger>
            <TabsTrigger
              value="care"
              className="gap-2 rounded-xl py-2.5 px-4 text-slate-400 transition-all font-semibold text-xs data-[state=active]:bg-slate-900 data-[state=active]:text-violet-400 data-[state=active]:border-violet-500/30 data-[state=active]:shadow-[0_0_15px_rgba(139,92,246,0.15)] border border-transparent hover:text-slate-200 hover:border-slate-800/85 hover:bg-slate-900/40"
            >
              <Activity className="size-4 text-violet-400 group-data-[state=active]:animate-pulse" />
              Find Care
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-4 outline-none">
            <div className="rounded-2xl border border-slate-900 bg-slate-900/20 backdrop-blur-md p-6">
              <h3 className="text-lg font-bold text-white">My Prescriptions & Records</h3>
              <p className="text-xs text-slate-400 mt-1">Your latest digital prescriptions are ready for download and pharmacy use.</p>
            </div>

            {loadingPrescriptions ? (
              <div className="h-32 flex flex-col items-center justify-center text-slate-400 gap-2 animate-pulse bg-slate-900/30 border border-slate-900/80 rounded-2xl">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs">Loading prescriptions...</span>
              </div>
            ) : prescriptions.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/20 p-10 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <Pill className="h-7 w-7 text-emerald-450" />
                </div>
                <h3 className="text-base font-bold text-white">No active prescriptions found yet.</h3>
                <p className="mt-1 max-w-sm text-xs text-slate-450">
                  Once your doctor issues one, it will appear here.
                </p>
                <div className="mt-6">
                  <Button asChild className="bg-emerald-650 hover:bg-emerald-600 rounded-xl gap-2 text-xs">
                    <Link href="/consultation/book">
                      <CalendarDays className="h-4 w-4" /> Book a consultation
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {prescriptions.map((prescription) => (
                  <Card key={prescription.id} className="bg-slate-900/40 border border-slate-900/80 rounded-2xl hover:border-slate-800 transition-all shadow-lg overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-450 shrink-0">
                            <Pill className="size-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-bold text-white">
                              {prescription.diagnosis ?? "CareBridge Prescription"}
                            </CardTitle>
                            <CardDescription className="text-slate-450 text-xs mt-0.5" suppressHydrationWarning>
                              Dr. {prescription.doctor_name || "Rahul Sharma"} &middot;{" "}
                              {formatStableDateTime(prescription.created_at)}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition-all text-xs">
                            <Link href={`/prescription/${prescription.id}`} target="_blank">
                              <FileText className="mr-1.5 h-3.5 w-3.5" />
                              View Prescription
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="outline" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl shadow-md transition-all text-xs">
                            <a href={`/api/prescriptions/pdf?id=${prescription.id}`} target="_blank" rel="noreferrer">
                              <Download className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                              Download (PDF)
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-350 bg-slate-950/20 p-4 border-t border-slate-900" suppressHydrationWarning>
                      <span className="font-semibold text-slate-500 block mb-1 text-[10px] uppercase tracking-wider">Instructions / Advice:</span>
                      {prescription.instructions || prescription.advice || "Follow prescribed dosage"}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="appointments" className="space-y-4 outline-none">
            <div className="rounded-2xl border border-slate-900 bg-slate-900/20 backdrop-blur-md p-6">
              <h3 className="text-lg font-bold text-white">My Consultation Bookings</h3>
              <p className="text-xs text-slate-400 mt-1">View and manage your upcoming and completed doctor consultation requests.</p>
            </div>

            <MyConsultationsPanel
              patientId={patientId}
            />
          </TabsContent>

          <TabsContent value="care" className="grid gap-6 md:grid-cols-2 outline-none">
            <Card className="bg-slate-900/40 border border-slate-900/80 rounded-2xl hover:border-slate-800 transition-all p-6 relative overflow-hidden group shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -z-10 group-hover:bg-emerald-500/10 transition-all" />
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-450 flex items-center justify-center mb-4">
                <Activity className="size-6 animate-pulse" />
              </div>
              <CardTitle className="text-lg font-bold text-white">AI Symptom Checker</CardTitle>
              <CardDescription className="text-xs text-slate-450 mt-1 mb-6">
                Describe how you feel and get structured guidance before your next consultation.
              </CardDescription>
              <Button asChild className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl gap-2 w-full justify-center text-xs">
                <Link href="/symptoms">
                  Start symptom check <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </Card>

            <Card className="bg-slate-900/40 border border-slate-900/80 rounded-2xl hover:border-slate-805 transition-all p-6 relative overflow-hidden group shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl -z-10 group-hover:bg-cyan-500/10 transition-all" />
              <div className="h-12 w-12 rounded-xl bg-cyan-500/10 text-cyan-455 flex items-center justify-center mb-4">
                <Stethoscope className="size-6" />
              </div>
              <CardTitle className="text-lg font-bold text-white">Find a Doctor</CardTitle>
              <CardDescription className="text-xs text-slate-455 mt-1 mb-6">
                Browse available specialists and book a convenient consultation time.
              </CardDescription>
              <Button asChild variant="outline" className="bg-transparent border-slate-800 text-slate-300 hover:bg-slate-900 rounded-xl gap-2 w-full justify-center text-xs">
                <Link href="/consultation/book">
                  Book consultation <CalendarDays className="w-4 h-4" />
                </Link>
              </Button>
            </Card>

            <Card className="md:col-span-2 bg-slate-900/40 border border-slate-900/80 rounded-2xl p-6 shadow-lg overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -z-10" />
              <CardHeader className="px-0 pt-0 pb-6 border-b border-slate-900/60">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
                  🩺 Recent AI Symptom Assessments & Tracking
                </CardTitle>
                <CardDescription className="text-xs text-slate-450 mt-1">
                  Your recent AI triage analyses, severity levels, and clinical insights.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pt-6">
                {symptomLogs.length === 0 ? (
                  <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-900/85 p-8 text-center text-xs text-slate-450 bg-slate-950/20">
                    <Activity className="h-8 w-8 text-slate-500 mb-2" />
                    No AI symptom assessments logged yet. Run your first check to get clinical guidance.
                    <Button asChild className="mt-4 bg-emerald-600 hover:bg-emerald-750 text-white rounded-xl gap-1">
                      <Link href="/symptoms">
                        Start AI Assessment <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {symptomLogs.map((log: any, idx: number) => {
                      const dateObj = new Date(log.timestamp)
                      const isEmergency = log.urgency === "emergency"
                      const isUrgent = log.urgency === "urgent"

                      return (
                        <div
                          key={idx}
                          className="flex flex-col md:flex-row md:items-center justify-between border border-slate-900 bg-slate-950/30 rounded-xl p-4 gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-white text-sm">{log.condition || "General Symptoms"}</span>
                              <Badge
                                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold border ${isEmergency
                                    ? "bg-rose-955/50 border-rose-500/30 text-rose-400"
                                    : isUrgent
                                      ? "bg-amber-955/50 border-amber-500/30 text-amber-400"
                                      : "bg-slate-800 border-slate-700 text-slate-300"
                                  }`}
                              >
                                {log.urgency ? log.urgency.charAt(0).toUpperCase() + log.urgency.slice(1) : "Routine"}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-slate-450">
                              📅 {isNaN(dateObj.getTime()) ? "Unknown Date" : dateObj.toLocaleString("en-US", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true
                              })}
                            </p>
                            {log.primary_concern && (
                              <p className="text-xs text-slate-300 mt-1.5">
                                <span className="font-medium text-slate-500">Primary Concern:</span> {log.primary_concern}
                              </p>
                            )}
                            <p className="text-xs text-slate-400 line-clamp-2 mt-1 bg-slate-955/40 p-2 rounded-lg border border-slate-900/50">
                              {log.description || "No recommendations logged."}
                            </p>
                          </div>

                          <Button asChild size="sm" variant="outline" className="shrink-0 bg-transparent border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl self-start md:self-center text-xs">
                            <Link href="/symptoms">
                              Run New Check
                            </Link>
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
