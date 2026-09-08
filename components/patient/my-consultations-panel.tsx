"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Clock, Video, AlertCircle, CheckCircle2, XCircle, Check } from 'lucide-react';
import Link from 'next/link';

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
  } catch { }
  return false;
}

export function MyConsultationsPanel({ patientId }: { patientId?: string }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState<'active' | 'history'>('active');
  const [dismissedApprovals, setDismissedApprovals] = useState<Set<string>>(new Set());
  const playedChimeRef = useRef<string | null>(null);
  // Load dismissed approval notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('carebridge_dismissed_approvals');
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        setDismissedApprovals(new Set(ids));
      }
    } catch { }
  }, []);

  const fetchConsultations = async () => {
    try {
      const cacheBust = Date.now();
      const res = await fetch(`/api/patient/consultations?_t=${cacheBust}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const data = await res.json();
      if (data.appointments) {
        let list = data.appointments;

        list = list.map((appt: any) => {
          const reasonStr = appt.reason || '';
          const isDeclined = appt.status === 'cancelled' || appt.status === 'rejected' || appt.status === 'declined' || reasonStr.includes('Declined:') || reasonStr.includes('[PATIENT_DECLINED]');
          const isCompleted = appt.status === 'completed';

          let cleanReason = reasonStr;
          ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]'].forEach(tag => {
            cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '');
          });

          const dateMatch = cleanReason.match(/Selected Date:\s*([\w\d, -]+)/i) || cleanReason.match(/Preferred Date:\s*([\w\d, -]+)/i);
          const timeMatch = cleanReason.match(/Time Slot:\s*([\w\d: ]+)/i);
          const parsedDate = dateMatch ? dateMatch[1].trim() : (appt.scheduled_date || appt.appointment_date || '17-08-2026');
          const parsedTime = timeMatch ? timeMatch[1].trim() : (appt.scheduled_time || appt.time_slot || '12:00 PM');

          const isPast = isConsultationPast({
            appointment_date: parsedDate,
            time_slot: parsedTime,
            scheduled_date: appt.scheduled_date,
            scheduled_time: appt.scheduled_time,
            scheduled_at: appt.scheduled_at
          });
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
          } else if (appt.status === 'pending') {
            statusVal = 'pending';
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
            doctor_name: appt.doctor_name || appt.doctor?.name || appt.doctor?.full_name || 'Dr. Rahul Sharma',
            department: appt.department || appt.doctor?.specialty || 'General Medicine'
          };
        });

        // Filter by patient ID for safety and security
        if (patientId) {
          list = list.filter((a: any) => a.patient_id === patientId);
        }
        // Show pending, approved/scheduled/confirmed, active, completed, rejected/declined, or missed appointments
        const activeOnly = list.filter(
          (a: any) =>
            a.status === 'pending' ||
            a.status === 'rejected' || a.status === 'declined' ||
            a.status === 'scheduled' || a.status === 'booked' || a.status === 'confirmed' ||
            a.status === 'doctor_in_room' || a.status === 'patient_waiting' ||
            a.status === 'patient_admitted' || a.status === 'in_progress' ||
            a.status === 'completed' || a.status === 'missed'
        );

        setAppointments(activeOnly);
      } else {
        setAppointments([]);
      }
    } catch (_) {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultations();
    const interval = setInterval(fetchConsultations, 3500);
    return () => clearInterval(interval);
  }, [patientId]);

  const handleRemoveDeclined = async (appointmentId: string) => {
    try {
      const res = await fetch(`/api/patient/appointments?id=${appointmentId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
      }
    } catch (err) {
      console.error("Failed to remove declined consultation:", err);
    }
  };

  const handleDismissApproval = useCallback((appointmentId: string) => {
    setDismissedApprovals(prev => {
      const next = new Set(prev);
      next.add(appointmentId);
      localStorage.setItem('carebridge_dismissed_approvals', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);



  const isHistoryAppt = useCallback((appt: any) => {
    const isDeclined = appt.status === 'declined' || appt.status === 'cancelled' || appt.status === 'rejected' || Boolean(appt.reason?.includes('Declined:'));
    const isCompleted = appt.status === 'completed';
    const isPast = isConsultationPast(appt);
    const isMissed = appt.status === 'missed' || (isPast && !isCompleted && !isDeclined);
    return isDeclined || isCompleted || isMissed;
  }, []);

  const activeConsultations = appointments.filter(a => !isHistoryAppt(a));
  const historyConsultations = appointments.filter(isHistoryAppt);
  const displayedAppointments = viewTab === 'active' ? activeConsultations : historyConsultations;

  const activeLiveAppt = appointments.find((a) => {
    const isDeclined = a.status === 'declined' || a.status === 'cancelled' || a.status === 'rejected' || a.reason?.includes('Declined:');
    if (isDeclined || a.status === 'completed' || a.status === 'missed' || isConsultationPast(a)) return false;
    // Merely scheduled, booked, confirmed, or pending appointments MUST NOT trigger live alert banners
    if (a.status === 'scheduled' || a.status === 'booked' || a.status === 'pending' || a.status === 'confirmed') {
      return false;
    }
    return (
      a.status === 'doctor_in_room' ||
      a.status === 'in_progress' ||
      (a.is_doctor_in_room && a.status !== 'scheduled' && a.status !== 'booked' && a.status !== 'confirmed')
    );
  });

  useEffect(() => {
    if (activeLiveAppt && playedChimeRef.current !== activeLiveAppt.id) {
      playedChimeRef.current = activeLiveAppt.id;
      if (typeof playDoctorAlertChime === 'function') {
        playDoctorAlertChime();
      }
    }
  }, [activeLiveAppt]);

  if (loading) {
    return <div className="text-slate-500 text-xs py-8 text-center animate-pulse">Loading consultations...</div>;
  }

  const rawDoctorName = activeLiveAppt
    ? (activeLiveAppt.doctor_name || activeLiveAppt.doctor?.name || activeLiveAppt.doctor?.full_name || 'Rahul Sharma')
    : 'Rahul Sharma';
  const liveDoctorName = rawDoctorName.startsWith('Dr.') ? rawDoctorName : `Dr. ${rawDoctorName}`;

  const approvedConsultations = appointments.filter(
    a => (a.status === 'scheduled' || a.status === 'booked' || a.status === 'confirmed') &&
         !a.call_active &&
         !a.is_doctor_in_room &&
         a.status !== 'declined' &&
         a.status !== 'cancelled' &&
         a.status !== 'missed' &&
         !a.reason?.includes('Declined:') &&
         !dismissedApprovals.has(a.id) &&
         !isConsultationPast(a)
  );

  return (
    <div className="space-y-4">
      {/* Live Incoming Alert Banner */}
      {activeLiveAppt && (
        <div className="p-4 rounded-2xl border border-emerald-500/60 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom duration-300"
          style={{
            background: 'linear-gradient(135deg, rgba(6,95,70,0.5) 0%, rgba(15,23,42,0.8) 50%, rgba(6,95,70,0.5) 100%)',
            boxShadow: '0 0 30px rgba(16,185,129,0.25), 0 0 60px rgba(16,185,129,0.12)',
            animation: 'consultationPulse 2s ease-in-out infinite'
          }}>
          <style>{`
            @keyframes consultationPulse {
              0%, 100% { box-shadow: 0 0 30px rgba(16,185,129,0.25), 0 0 60px rgba(16,185,129,0.12); }
              50% { box-shadow: 0 0 50px rgba(16,185,129,0.45), 0 0 100px rgba(16,185,129,0.2); }
            }
          `}</style>
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
            <div>
              <h4 className="text-sm font-bold text-white">
                🔴 {liveDoctorName} has started your consultation and is waiting in the room!
              </h4>
            </div>
          </div>
          <Link href={`/consultation/${activeLiveAppt.id}`}>
            <button className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/40 flex items-center gap-2 transition-all cursor-pointer animate-pulse shrink-0 border border-emerald-400">
              <Video className="w-4 h-4" /> {activeLiveAppt.is_patient_admitted || activeLiveAppt.status === 'in_progress' ? 'Rejoin Now' : 'Join Now'}
            </button>
          </Link>
        </div>
      )}

      {/* Approved Notifications Banner */}
      {approvedConsultations.map(appt => {
        const doctorName = appt.doctor_name || appt.doctor?.name || appt.doctor?.full_name || 'Dr. Rahul Sharma';
        const date = appt.appointment_date || appt.scheduled_date || appt.scheduled_at?.split('T')?.[0] || 'Date';
        const time = appt.time_slot || appt.scheduled_time || '12:00 PM';
        return (
          <div key={`alert-${appt.id}`} className="p-4 rounded-2xl bg-emerald-955/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <span className="font-bold text-emerald-400 mr-1">✓ Approved:</span>
            Your consultation with Dr. {doctorName} for {date} {time} has been approved!
            <button
              onClick={() => handleDismissApproval(appt.id)}
              className="ml-auto px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-semibold transition-all cursor-pointer shrink-0"
            >
              OK
            </button>
          </div>
        );
      })}

      {/* View Filter Tabs: Active vs Consultation History */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
        <button
          type="button"
          onClick={() => setViewTab('active')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            viewTab === 'active'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent'
          }`}
        >
          Active Consultations
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {activeConsultations.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setViewTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            viewTab === 'history'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent'
          }`}
        >
          Consultation History
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {historyConsultations.length}
          </span>
        </button>
      </div>

      {/* Appointment Cards */}
      {displayedAppointments.length === 0 ? (
        <div className="text-center py-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs space-y-2">
          {viewTab === 'active' ? (
            <>
              <p>No active or joinable consultations scheduled.</p>
              {historyConsultations.length > 0 && (
                <button
                  type="button"
                  onClick={() => setViewTab('history')}
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer"
                >
                  View past consultations in history ({historyConsultations.length}) →
                </button>
              )}
            </>
          ) : (
            <p>No past consultation history found.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayedAppointments.map((appt) => {
            const isRejected = appt.status === 'rejected' || appt.status === 'declined' || appt.status === 'cancelled' || Boolean(appt.reason?.includes('Declined:'));
            const isCompleted = appt.status === 'completed';
            const isPending = appt.status === 'pending';
            const isPast = isConsultationPast(appt);
            const isMissed = appt.status === 'missed' || (isPast && !isCompleted && !isRejected);

            // Live consultation strictly means active, not missed, not past, doctor started
            const isLive = !isRejected && !isCompleted && !isPending && !isMissed && (
              appt.status === 'doctor_in_room' ||
              appt.status === 'in_progress' ||
              appt.status === 'patient_admitted' ||
              Boolean(appt.is_doctor_in_room)
            );

            const isScheduled = (appt.status === 'scheduled' || appt.status === 'booked' || appt.status === 'confirmed') && !isRejected && !isCompleted && !isPending && !isMissed;

            const doctorName = appt.doctor_name || appt.doctor?.name || appt.doctor?.full_name || 'Dr. Rahul Sharma';
            const department = appt.department || appt.doctor?.specialty || 'General Medicine';
            const date = appt.appointment_date || appt.scheduled_date || appt.scheduled_at?.split('T')?.[0] || 'Scheduled Date';
            const time = appt.time_slot || appt.scheduled_time || '12:00 PM';

            let declineReasonText = '';
            if (appt.reason) {
              const bracketMatch = appt.reason.match(/\[Declined:\s*([^\]]+)\]/i);
              if (bracketMatch) {
                declineReasonText = bracketMatch[1].trim();
              } else {
                const pipeMatch = appt.reason.match(/\|\s*Declined:\s*(.+)$/i);
                if (pipeMatch) {
                  declineReasonText = pipeMatch[1].trim();
                }
              }
            }
            if (!declineReasonText) {
              declineReasonText = 'No reason provided';
            }

            return (
              <div
                key={appt.id}
                className={`p-5 rounded-2xl bg-slate-900/90 border transition-all ${isLive
                  ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                  : isCompleted
                    ? 'border-emerald-500/20 shadow-sm'
                    : isRejected
                      ? 'border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                      : isPending
                        ? 'border-amber-500/20'
                        : isMissed
                          ? 'border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                          : 'border-slate-800'
                  }`}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className="font-bold text-slate-100 text-sm">{doctorName}</h4>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-emerald-400 border border-slate-700">
                        {department}
                      </span>
                      {isCompleted && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          ✓ Completed
                        </span>
                      )}
                      {isPending && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-550/30 flex items-center gap-1">
                          ⏳ Awaiting Doctor Approval
                        </span>
                      )}
                      {isMissed && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-red-950/80 text-red-400 border border-red-800/60 uppercase font-semibold flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> ✕ Missed
                        </span>
                      )}
                      {isScheduled && !isLive && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-550/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> ✓ Confirmed & Scheduled
                        </span>
                      )}
                      {isLive && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 flex items-center gap-1.5 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          🔴 Doctor In Room
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
                          ● Declined
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" /> {date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" /> {time}
                      </span>
                    </div>

                    {isPending && (
                      <p className="text-xs text-amber-300 bg-amber-950/20 p-2.5 rounded-xl border border-amber-900/30">
                        Your consultation request has been sent. The doctor will review and approve your request.
                      </p>
                    )}

                    {isRejected && (
                      <p className="text-xs text-red-300 bg-red-950/20 p-2.5 rounded-xl border border-red-900/30">
                        Declined by Doctor — Reason: {declineReasonText}
                      </p>
                    )}

                    {isMissed && (
                      <p className="text-xs text-red-300 bg-red-950/20 p-2.5 rounded-xl border border-red-900/30">
                        You missed this consultation session. Please book a new slot if you still need medical assistance.
                      </p>
                    )}
                    {isScheduled && !isLive && (
                      <p className="text-xs text-slate-300 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                        Your consultation is confirmed with {doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`} for {date} at {time}. Please wait for the doctor to join.
                      </p>
                    )}
                    {isLive && (
                      <p className="text-xs text-emerald-300 bg-emerald-955/20 p-2.5 rounded-xl border border-emerald-800/40 font-semibold">
                        {doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`} is currently in the room and waiting for you to join!
                      </p>
                    )}

                    {!isPending && !isRejected && !isMissed && !(isScheduled && !isLive) && !isLive && (
                      <p className="text-xs text-slate-300 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                        <strong className="text-slate-400">Reason:</strong> {appt.reason || 'General Consultation'}
                      </p>
                    )}
                  </div>

                  <div className="w-full md:w-auto">
                    {isCompleted ? (
                      <button
                        disabled
                        className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-medium bg-emerald-955/40 text-emerald-400 border border-emerald-800/40 cursor-default flex items-center justify-center gap-2"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Completed
                      </button>
                    ) : isRejected ? (
                      <button
                        onClick={() => handleRemoveDeclined(appt.id)}
                        className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/65 hover:text-red-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        Remove
                      </button>
                    ) : isMissed ? (
                      <button
                        disabled
                        className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-medium bg-red-950/20 text-red-400 border border-red-900/40 cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Session Missed
                      </button>
                    ) : isPending ? (
                      <button
                        disabled
                        className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-medium bg-slate-950 text-slate-500 border border-slate-800 cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Waiting for doctor approval
                      </button>
                    ) : isLive ? (
                      <Link href={`/consultation/${appt.id}`} className="w-full md:w-auto block">
                        <button className="w-full md:w-auto px-5 py-3 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse flex items-center justify-center gap-2.5 transition-all cursor-pointer border-2 border-emerald-400 ring-2 ring-emerald-400/50">
                          <span className="relative flex h-3 w-3 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                          </span>
                          <Video className="w-4 h-4 shrink-0" />
                          <span className="whitespace-normal md:whitespace-nowrap font-black tracking-tight">
                            {appt.is_patient_admitted || appt.status === 'in_progress' ? 'Rejoin Consultation →' : 'Join Consultation Room →'}
                          </span>
                        </button>
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-medium bg-slate-950 text-slate-400 border border-slate-800 cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Waiting for doctor to join
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
