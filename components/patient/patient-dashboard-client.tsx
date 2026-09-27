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
import { Navbar } from "@/components/ui/navbar"

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
    if (appt.scheduled_at) {
      const sDate = new Date(appt.scheduled_at);
      if (!isNaN(sDate.getTime())) {
        const now = new Date();
        return now.getTime() > sDate.getTime() + 30 * 60 * 1000;
      }
    }
    const dStr = appt.appointment_date || appt.scheduled_date || '';
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
      } else if (parts[0]?.length === 4) {
        parsedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
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
  if (appt.status === 'missed' || isConsultationPast(appt)) return false;
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
  patientEmail: string | null
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

  const [appointments, setAppointments] = useState<any[]>(initialAppointments)
  const [prescriptions, setPrescriptions] = useState<PrintablePrescription[]>(initialPrescriptions)
  const [loadingAppointments, setLoadingAppointments] = useState(!initialAppointments.length)
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(!initialPrescriptions.length)

  const [primaryConcern, setPrimaryConcern] = useState("")
  const [symptoms, setSymptoms] = useState("")
  const [bookingDoctorId, setBookingDoctorId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [symptomLogs, setSymptomLogs] = useState<any[]>([])

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem('patient_symptom_history') || '[]')
      setSymptomLogs(data)
    } catch (_) {
      setSymptomLogs([])
    }
  }, [])

  const scheduledCount = appointments.filter((appt) =>
    (appt.status === "scheduled" || appt.status === "confirmed" || (appt.status === "booked" && !appt.reason?.includes("[PENDING_APPROVAL]"))) &&
    !isConsultationPast(appt) &&
    appt.status !== "declined" &&
    appt.status !== "cancelled" &&
    appt.status !== "missed" &&
    appt.status !== "completed" &&
    !appt.reason?.includes("Declined:")
  ).length

  const pendingCount = appointments.filter((appt) =>
    (appt.status === "pending" || (appt.status === "booked" && appt.reason?.includes("[PENDING_APPROVAL]"))) &&
    appt.status !== "declined" &&
    appt.status !== "cancelled"
  ).length

  const completedAppointments = appointments
    .filter((appt) => appt.status === "completed")
    .sort((a, b) => {
      const dateA = new Date(a.scheduled_at || a.appointment_date || a.scheduled_date || a.created_at || 0).getTime();
      const dateB = new Date(b.scheduled_at || b.appointment_date || b.scheduled_date || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  const latestCompleted = completedAppointments[0];
  const lastVisitDate = latestCompleted
    ? formatStableDate(latestCompleted.scheduled_at || latestCompleted.appointment_date || latestCompleted.scheduled_date || latestCompleted.created_at)
    : (prescriptions[0] ? formatStableDate(prescriptions[0].created_at) : "—");

  const liveAppointment = appointments.find((appt) => {
    const isDeclined = appt.status === "declined" || appt.status === "cancelled" || appt.status === "rejected" || appt.reason?.includes("Declined:");
    if (isDeclined || appt.status === "completed" || appt.status === "missed" || isConsultationPast(appt)) return false;
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
        const isCompleted = appt.status === 'completed';

        let cleanReason = reasonStr;
        ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]'].forEach(tag => {
          cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '');
        });

        // Parse date/time
        const dateMatch = cleanReason.match(/Selected Date:\s*([\w\d, -]+)/i) || cleanReason.match(/Preferred Date:\s*([\w\d, -]+)/i);
        const timeMatch = cleanReason.match(/Time Slot:\s*([\w\d: ]+)/i);
        const parsedDate = dateMatch ? dateMatch[1].trim() : (appt.scheduled_date || appt.appointment_date || appt.scheduled_at?.split('T')?.[0] || '');
        const parsedTime = timeMatch ? timeMatch[1].trim() : (appt.scheduled_time || appt.time_slot || '');

        const isPast = isConsultationPast({ appointment_date: parsedDate, time_slot: parsedTime, scheduled_date: appt.scheduled_date, scheduled_time: appt.scheduled_time, scheduled_at: appt.scheduled_at });
        const isMissed = appt.status === 'missed' || (isPast && !isCompleted && !isDeclined);

        const isTerminated = isDeclined || isCompleted || isMissed;
        const isDoctorInRoom = !isTerminated && (reasonStr.includes('[DOCTOR_IN_ROOM]') || Boolean(appt.is_doctor_in_room));
        const isPatientWaiting = !isTerminated && reasonStr.includes('[PATIENT_WAITING]');
        const isPatientAdmitted = !isTerminated && reasonStr.includes('[PATIENT_ADMITTED]');
        const isCallActive = !isTerminated && (reasonStr.includes('[CALL_ACTIVE]') || isDoctorInRoom);
        const isPendingApproval = reasonStr.includes('[PENDING_APPROVAL]');

        let statusVal = appt.status;
        if (isCompleted) {
          statusVal = 'completed';
        } else if (isDeclined) {
          statusVal = 'declined';
        } else if (isMissed) {
          statusVal = 'missed';
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

        return {
          ...appt,
          id: appt.id,
          roomId: appt.id,
          appointment_id: appt.id,
          status: statusVal,
          is_doctor_in_room: !isTerminated && isDoctorInRoom,
          call_active: !isTerminated && isCallActive,
          reason: cleanReason,
          appointment_date: parsedDate,
          time_slot: parsedTime,
          doctor_name: appt.doctor_name || 'Dr. Rahul Sharma',
          department: appt.department || 'General Medicine'
        };
      });

      setAppointments(list)
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
              const isDeclined = appt.status === 'cancelled' || appt.status === 'rejected' || appt.status === 'declined' || reasonStr.includes('Declined:') || reasonStr.includes('[PATIENT_DECLINED]');
              const isCompleted = appt.status === 'completed';

              let cleanReason = reasonStr;
              ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]'].forEach(tag => {
                cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '');
              });

              // Parse date/time
              const dateMatch = cleanReason.match(/Selected Date:\s*([\w\d, -]+)/i) || cleanReason.match(/Preferred Date:\s*([\w\d, -]+)/i);
              const timeMatch = cleanReason.match(/Time Slot:\s*([\w\d: ]+)/i);
              const parsedDate = dateMatch ? dateMatch[1].trim() : (appt.scheduled_date || appt.appointment_date || appt.scheduled_at?.split('T')?.[0] || '');
              const parsedTime = timeMatch ? timeMatch[1].trim() : (appt.scheduled_time || appt.time_slot || '');

              const isPast = isConsultationPast({ appointment_date: parsedDate, time_slot: parsedTime, scheduled_date: appt.scheduled_date, scheduled_time: appt.scheduled_time, scheduled_at: appt.scheduled_at });
              const isMissed = appt.status === 'missed' || (isPast && !isCompleted && !isDeclined);

              const isTerminated = isDeclined || isCompleted || isMissed;
              const isDoctorInRoom = !isTerminated && (reasonStr.includes('[DOCTOR_IN_ROOM]') || Boolean(appt.is_doctor_in_room));
              const isPatientWaiting = !isTerminated && reasonStr.includes('[PATIENT_WAITING]');
              const isPatientAdmitted = !isTerminated && reasonStr.includes('[PATIENT_ADMITTED]');
              const isCallActive = !isTerminated && (reasonStr.includes('[CALL_ACTIVE]') || isDoctorInRoom);
              const isPendingApproval = reasonStr.includes('[PENDING_APPROVAL]');

              let statusVal = appt.status;
              if (isCompleted) {
                statusVal = 'completed';
              } else if (isDeclined) {
                statusVal = 'declined';
              } else if (isMissed) {
                statusVal = 'missed';
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

              return {
                ...appt,
                id: appt.id,
                roomId: appt.id,
                appointment_id: appt.id,
                status: statusVal,
                is_doctor_in_room: !isTerminated && isDoctorInRoom,
                call_active: !isTerminated && isCallActive,
                reason: cleanReason,
                appointment_date: parsedDate,
                time_slot: parsedTime,
                doctor_name: appt.doctor_name || 'Dr. Rahul Sharma',
                department: appt.department || 'General Medicine'
              };
            });

            setAppointments(list);
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
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden font-sans pb-16">
      {/* Retained shared Navbar */}
      <Navbar />

      {/* Ambient background glows matching DESIGN.md */}
      <div className="absolute top-0 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Prominent Live Consultation Alert Banner */}
      {liveAppointment && (() => {
        const rawDoctorName = liveAppointment.doctor?.name || liveAppointment.doctor_name || "Rahul Sharma";
        const formattedDoctorName = rawDoctorName.startsWith('Dr.') ? rawDoctorName : `Dr. ${rawDoctorName}`;
        return (
          <div className="bg-emerald-500/10 dark:bg-emerald-950/40 border-b border-emerald-500/30 py-3.5 px-4 sm:px-6 sticky top-[65px] z-20 backdrop-blur-md">
            <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3.5 w-3.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-600"></span>
                </span>
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span>🔴</span>
                  {formattedDoctorName} has started your consultation and is waiting in the room!
                </p>
              </div>
              <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 py-2 text-xs font-bold shrink-0 animate-pulse shadow-md">
                <Link href={`/consultation/${liveAppointment.id}`} className="flex items-center gap-2">
                  <Video className="w-4 h-4" /> Join Now
                </Link>
              </Button>
            </div>
          </div>
        );
      })()}

      <main className="container mx-auto px-4 sm:px-6 md:px-12 py-8 max-w-7xl">
        {/* SECTION 1: Tonal Welcome Hero (Deep Navy Heading + Tonal Blue-Mint Background) */}
        <section className="mb-8 rounded-3xl border border-border bg-gradient-to-r from-sky-50/60 via-background to-emerald-50/60 dark:from-sky-950/20 dark:via-background dark:to-emerald-950/20 shadow-xs p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl -z-10" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <span className="text-xs font-semibold tracking-wider text-emerald-700 dark:text-emerald-400 uppercase">{greeting}</span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-normal text-slate-900 dark:text-slate-100 leading-tight">
                Welcome back, {patientName}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground font-light mt-1">
                Your personal CareBridge health timeline and upcoming consultations.
              </p>
            </div>

            <Button asChild className="rounded-full px-6 bg-teal-600 hover:bg-teal-700 text-white shadow-md text-xs font-semibold gap-1.5 shrink-0 self-start sm:self-center">
              <Link href="/consultation/book">
                Book Consultation <Stethoscope className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {/* Differentiated Blue + Green Statistics Cards */}
          <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-3">
            {/* Card 1: Active Prescriptions (Healthcare Green Accent) */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 hover:border-emerald-500/40 hover:shadow-md transition-all relative overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Active Prescriptions</p>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Pill className="w-4 h-4" />
                </div>
              </div>
              <p className="mt-2 font-mono text-3xl font-bold text-emerald-900 dark:text-emerald-200">{prescriptions.length}</p>
            </div>

            {/* Card 2: Upcoming Visits (Healthcare Blue Accent) */}
            <div className="rounded-2xl border border-sky-500/20 bg-sky-50/50 dark:bg-sky-950/20 p-5 hover:border-sky-500/40 hover:shadow-md transition-all relative overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-300">Upcoming Visits</p>
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <CalendarDays className="w-4 h-4" />
                </div>
              </div>
              <p className="mt-2 font-mono text-3xl font-bold text-sky-900 dark:text-sky-200 flex items-baseline gap-2">
                {scheduledCount} <span className="text-xs font-sans font-medium text-muted-foreground">Scheduled</span>
                <span className="text-xs font-sans font-semibold text-amber-600 dark:text-amber-400">({pendingCount} Pending)</span>
              </p>
            </div>

            {/* Card 3: Last Visit (Deep Teal Accent) */}
            <div className="rounded-2xl border border-teal-500/20 bg-teal-50/50 dark:bg-teal-950/20 p-5 hover:border-teal-500/40 hover:shadow-md transition-all relative overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300">Last Visit</p>
                <div className="w-8 h-8 rounded-xl bg-teal-500/15 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <p className="mt-2 font-mono text-2xl font-bold text-teal-900 dark:text-teal-200" suppressHydrationWarning>
                {lastVisitDate}
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: Interactive Tabs with Blue Selected Navigation Hierarchy */}
        <Tabs defaultValue="records" className="space-y-6">
          <TabsList className="h-auto w-full justify-start gap-2 bg-muted/40 border border-border p-1.5 sm:w-fit rounded-2xl shadow-xs">
            <TabsTrigger
              value="records"
              className="gap-2 rounded-xl py-2 px-4 text-xs font-semibold transition-all data-[state=active]:bg-sky-600 data-[state=active]:text-white dark:data-[state=active]:bg-sky-600 dark:data-[state=active]:text-white data-[state=active]:shadow-xs border border-transparent"
            >
              <FileText className="size-4" />
              Medical Records
            </TabsTrigger>
            <TabsTrigger
              value="appointments"
              className="gap-2 rounded-xl py-2 px-4 text-xs font-semibold transition-all data-[state=active]:bg-sky-600 data-[state=active]:text-white dark:data-[state=active]:bg-sky-600 dark:data-[state=active]:text-white data-[state=active]:shadow-xs border border-transparent"
            >
              <CalendarDays className="size-4" />
              My Consultations
            </TabsTrigger>
            <TabsTrigger
              value="care"
              className="gap-2 rounded-xl py-2 px-4 text-xs font-semibold transition-all data-[state=active]:bg-sky-600 data-[state=active]:text-white dark:data-[state=active]:bg-sky-600 dark:data-[state=active]:text-white data-[state=active]:shadow-xs border border-transparent"
            >
              <Activity className="size-4" />
              Find Care
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MEDICAL RECORDS */}
          <TabsContent value="records" className="space-y-4 outline-none">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl font-normal text-slate-900 dark:text-slate-100">My Prescriptions & Medical Records</h3>
                <p className="text-xs text-muted-foreground font-light mt-1">Authorized digital prescriptions ready for direct pharmacy routing or PDF download.</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            {loadingPrescriptions ? (
              <div className="h-32 flex flex-col items-center justify-center text-muted-foreground gap-2 animate-pulse bg-card border border-border rounded-2xl">
                <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-medium">Loading medical records...</span>
              </div>
            ) : prescriptions.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-xs">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Pill className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No active prescriptions found yet.</h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground font-light">
                  Once your physician issues a prescription during your consultation, it will appear here.
                </p>
                <div className="mt-6">
                  <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white rounded-full text-xs font-semibold gap-2">
                    <Link href="/consultation/book">
                      <CalendarDays className="h-4 w-4" /> Book a consultation
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {prescriptions.map((prescription) => (
                  <Card key={prescription.id} className="bg-card border border-border rounded-2xl hover:border-teal-500/50 transition-all shadow-xs overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                            <Pill className="size-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold text-foreground">
                              {prescription.diagnosis ?? "CareBridge Prescription"}
                            </CardTitle>
                            <CardDescription className="text-muted-foreground text-xs mt-0.5" suppressHydrationWarning>
                              Dr. {prescription.doctor_name || "Rahul Sharma"} &middot;{" "}
                              {formatStableDateTime(prescription.created_at)}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-center">
                          {/* Healthcare Blue View Action */}
                          <Button asChild size="sm" className="bg-sky-600 hover:bg-sky-700 text-white rounded-full text-xs shadow-xs font-semibold">
                            <Link href={`/prescription/${prescription.id}`} target="_blank">
                              <FileText className="mr-1.5 h-3.5 w-3.5" />
                              View Prescription
                            </Link>
                          </Button>
                          {/* Neutral Outline Download Action */}
                          <Button asChild size="sm" variant="outline" className="border-border rounded-full text-xs font-semibold">
                            <a href={`/api/prescriptions/pdf?id=${prescription.id}`} target="_blank" rel="noreferrer">
                              <Download className="mr-1.5 h-3.5 w-3.5 text-sky-600" />
                              Download PDF
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground bg-muted/20 p-4 border-t border-border/50" suppressHydrationWarning>
                      <span className="font-semibold text-foreground block mb-1 text-[10px] uppercase tracking-wider">Instructions / Clinical Advice:</span>
                      <div className="whitespace-pre-wrap">
                        {prescription.instructions || prescription.advice || "Follow prescribed dosage"}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: MY CONSULTATIONS */}
          <TabsContent value="appointments" className="space-y-4 outline-none">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl font-normal text-slate-900 dark:text-slate-100">My Consultation Bookings</h3>
                <p className="text-xs text-muted-foreground font-light mt-1">View upcoming appointments, pending approvals, and past consultation history.</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600 shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
            </div>

            <MyConsultationsPanel patientId={patientId} />
          </TabsContent>

          {/* TAB 3: FIND CARE & AI ASSESSMENTS */}
          <TabsContent value="care" className="grid gap-6 md:grid-cols-2 outline-none">
            <Card className="bg-card border border-border rounded-2xl hover:border-teal-500/50 transition-all p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4">
                  <Activity className="size-5" />
                </div>
                <CardTitle className="text-lg font-semibold text-foreground">AI Symptom Checker</CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-light mt-1 mb-6">
                  Describe how you feel to receive instant triage recommendations before your consultation.
                </CardDescription>
              </div>
              <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white rounded-full gap-2 w-full justify-center text-xs font-semibold">
                <Link href="/symptoms">
                  Start Symptom Check <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </Card>

            <Card className="bg-card border border-border rounded-2xl hover:border-sky-500/50 transition-all p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center mb-4">
                  <Stethoscope className="size-5" />
                </div>
                <CardTitle className="text-lg font-semibold text-foreground">Find a Doctor</CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-light mt-1 mb-6">
                  Browse board-certified specialists and reserve a video consultation slot.
                </CardDescription>
              </div>
              <Button asChild className="bg-sky-600 hover:bg-sky-700 text-white rounded-full gap-2 w-full justify-center text-xs font-semibold">
                <Link href="/consultation/book">
                  Book Consultation <CalendarDays className="w-4 h-4" />
                </Link>
              </Button>
            </Card>

            {/* AI Symptom Assessment History */}
            <Card className="md:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-xs">
              <CardHeader className="px-0 pt-0 pb-6 border-b border-border">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                  🩺 Recent AI Symptom Triage History
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-light mt-1">
                  Your recent symptom triage analyses, urgency levels, and clinical insights.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pt-6">
                {symptomLogs.length === 0 ? (
                  <div className="flex flex-col items-center rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground bg-muted/20">
                    <Activity className="h-8 w-8 text-muted-foreground mb-2" />
                    No AI symptom assessments logged yet. Run your first check to get instant clinical guidance.
                    <Button asChild className="mt-4 bg-teal-600 hover:bg-teal-700 text-white rounded-full text-xs gap-1 font-semibold">
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
                          className="flex flex-col md:flex-row md:items-center justify-between border border-border bg-muted/20 rounded-xl p-4 gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-foreground text-sm">{log.condition || "General Symptoms"}</span>
                              <Badge
                                className={`rounded-full px-2.5 py-0.5 text-[9px] font-semibold border ${isEmergency
                                    ? "bg-destructive/15 border-destructive/30 text-destructive"
                                    : isUrgent
                                      ? "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400"
                                      : "bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-400"
                                  }`}
                              >
                                {log.urgency ? log.urgency.charAt(0).toUpperCase() + log.urgency.slice(1) : "Routine"}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-mono">
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
                              <p className="text-xs text-muted-foreground mt-1.5">
                                <span className="font-semibold text-foreground">Primary Concern:</span> {log.primary_concern}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1 bg-card p-2 rounded-lg border border-border">
                              {log.description || "No recommendations logged."}
                            </p>
                          </div>

                          <Button asChild size="sm" variant="outline" className="shrink-0 border-border rounded-full text-xs self-start md:self-center">
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
