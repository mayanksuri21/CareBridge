"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Video, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

export function MyConsultationsPanel({ patientId }: { patientId?: string }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
          const isDoctorInRoom = reasonStr.includes('[DOCTOR_IN_ROOM]');
          const isPatientWaiting = reasonStr.includes('[PATIENT_WAITING]');
          const isPatientAdmitted = reasonStr.includes('[PATIENT_ADMITTED]');
          const isPatientDeclined = reasonStr.includes('[PATIENT_DECLINED]');
          const isCallActive = reasonStr.includes('[CALL_ACTIVE]');
          const isPendingApproval = reasonStr.includes('[PENDING_APPROVAL]');

          let cleanReason = reasonStr;
          ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]'].forEach(tag => {
            cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '');
          });

          let statusVal = appt.status;
          if (isPatientAdmitted) {
            statusVal = 'patient_admitted';
          } else if (isPatientWaiting) {
            statusVal = 'patient_waiting';
          } else if (isDoctorInRoom) {
            statusVal = 'doctor_in_room';
          } else if (isCallActive) {
            statusVal = 'in_progress';
          } else if (appt.status === 'scheduled') {
            statusVal = 'scheduled';
          } else if (appt.status === 'pending') {
            statusVal = 'pending';
          } else if (appt.status === 'booked') {
            statusVal = isPendingApproval ? 'pending' : 'scheduled';
          } else if (appt.status === 'cancelled' || appt.status === 'rejected' || appt.status === 'declined') {
            statusVal = 'declined';
          }

          const dateMatch = cleanReason.match(/Selected Date:\s*([\w\d, -]+)/i) || cleanReason.match(/Preferred Date:\s*([\w\d, -]+)/i);
          const timeMatch = cleanReason.match(/Time Slot:\s*([\w\d: ]+)/i);
          const parsedDate = dateMatch ? dateMatch[1].trim() : (appt.scheduled_date || appt.appointment_date || '17-08-2026');
          const parsedTime = timeMatch ? timeMatch[1].trim() : (appt.scheduled_time || appt.time_slot || '12:00 PM');

          return {
            ...appt,
            status: statusVal,
            call_active: isCallActive || isDoctorInRoom || isPatientWaiting || isPatientAdmitted,
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

        // Show pending, approved/scheduled, active, or rejected/declined appointments
        const activeOnly = list.filter(
          (a: any) =>
            a.status === 'pending' ||
            a.status === 'rejected' ||
            a.status === 'declined' ||
            a.status === 'scheduled' ||
            a.status === 'booked' ||
            a.status === 'doctor_in_room' ||
            a.status === 'patient_waiting' ||
            a.status === 'patient_admitted' ||
            a.status === 'in_progress'
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
    const interval = setInterval(fetchConsultations, 2000);
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

  if (loading) {
    return <div className="text-slate-500 text-xs py-8 text-center animate-pulse">Loading consultations...</div>;
  }

  const activeLiveAppt = appointments.find((a) =>
    a.status === 'doctor_in_room' ||
    a.status === 'patient_waiting' ||
    a.status === 'patient_admitted' ||
    a.status === 'in_progress' ||
    a.call_active
  );

  const liveDoctorName = activeLiveAppt
    ? (activeLiveAppt.doctor_name || activeLiveAppt.doctor?.name || activeLiveAppt.doctor?.full_name || 'Rahul Sharma').replace(/^Dr\.\s+/i, '')
    : '';

  const approvedConsultations = appointments.filter(
    a => (a.status === 'scheduled' || a.status === 'booked') && !a.call_active
  );

  return (
    <div className="space-y-4">
      {/* Live Incoming Alert Banner */}
      {activeLiveAppt && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-955 via-slate-900 to-emerald-955 border border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.35)] flex flex-col sm:flex-row items-center justify-between gap-4 animate-bounce">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
            <div>
              <h4 className="text-sm font-bold text-white">
                🟢 Dr. {liveDoctorName} is in the Consultation Room — Click to Join Call
              </h4>
            </div>
          </div>
          <Link href={`/consultation/${activeLiveAppt.id}`}>
            <button className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-955 font-bold text-xs shadow-lg shadow-emerald-500/30 flex items-center gap-2 transition-all cursor-pointer">
              <Video className="w-4 h-4" /> Join Video Call
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
          </div>
        );
      })}

      {/* Appointment Cards */}
      {appointments.length === 0 ? (
        <div className="text-center py-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
          No consultations found. Book an appointment to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const isLive =
              appt.status === 'doctor_in_room' ||
              appt.status === 'patient_waiting' ||
              appt.status === 'patient_admitted' ||
              appt.status === 'in_progress' ||
              appt.call_active;
            const doctorName = appt.doctor_name || appt.doctor?.name || appt.doctor?.full_name || 'Dr. Rahul Sharma';
            const department = appt.department || appt.doctor?.specialty || 'General Medicine';
            const date = appt.appointment_date || appt.scheduled_date || appt.scheduled_at?.split('T')?.[0] || 'Scheduled Date';
            const time = appt.time_slot || appt.scheduled_time || '12:00 PM';
            const isPending = appt.status === 'pending';
            const isRejected = appt.status === 'rejected' || appt.status === 'declined' || appt.status === 'cancelled';
            const isScheduled = appt.status === 'scheduled' || appt.status === 'booked';

            // Resilient date/time check
            let isTimeReached = false;
            try {
              const dStr = appt.appointment_date || appt.scheduled_date || appt.scheduled_at?.split('T')?.[0] || '';
              const tStr = appt.time_slot || appt.scheduled_time || '12:00 PM';
              
              if (dStr) {
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
                  if (parts[2].length === 4) {
                    parsedDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
                  }
                }

                if (parsedDate && !isNaN(parsedDate.getTime())) {
                  const timeParts = tStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
                  if (timeParts) {
                    let hour = parseInt(timeParts[1], 10);
                    const minute = parseInt(timeParts[2], 10);
                    const ampm = timeParts[3].toUpperCase();
                    if (ampm === 'PM' && hour < 12) hour += 12;
                    if (ampm === 'AM' && hour === 12) hour = 0;
                    
                    const scheduledDateTime = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), hour, minute);
                    isTimeReached = new Date() >= scheduledDateTime;
                  } else {
                    const scheduledDateTime = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 12, 0);
                    isTimeReached = new Date() >= scheduledDateTime;
                  }
                }
              }
            } catch (err) {
              console.warn("Date parsing error:", err);
            }

            let declineReasonText = appt.reason_notes || appt.decline_reason;
            if (!declineReasonText && appt.reason) {
              const match = appt.reason.match(/\[Declined:\s*([^\]]+)\]/i);
              if (match) {
                declineReasonText = match[1].trim();
              }
            }
            if (!declineReasonText) {
              declineReasonText = 'Doctor is unavailable at the requested time.';
            }

            return (
              <div
                key={appt.id}
                className={`p-5 rounded-2xl bg-slate-900/90 border transition-all ${isLive
                    ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : isRejected
                      ? 'border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                      : isPending
                        ? 'border-amber-500/20'
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
                      {isPending && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-550/30 flex items-center gap-1">
                          ⏳ Awaiting Doctor Approval
                        </span>
                      )}
                      {isScheduled && !isLive && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-550/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> ✓ Confirmed & Scheduled
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-550/30 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> ✕ Request Declined
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

                    {isScheduled && !isLive && (
                      <p className="text-xs text-slate-355 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                        Your consultation is confirmed with {doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`} for {date} at {time}.
                      </p>
                    )}

                    {!isPending && !isRejected && !(isScheduled && !isLive) && (
                      <p className="text-xs text-slate-355 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                        <strong className="text-slate-400">Reason:</strong> {appt.reason || 'General Consultation'}
                      </p>
                    )}
                  </div>

                  <div className="w-full md:w-auto">
                    {isLive || (isScheduled && isTimeReached) ? (
                      <Link href={`/consultation/${appt.id}`}>
                        <button className="w-full md:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-955 shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse flex items-center justify-center gap-2 transition-all cursor-pointer">
                          <Video className="w-4 h-4" /> Join Consultation Room
                        </button>
                      </Link>
                    ) : isPending ? (
                      <button
                        disabled
                        className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-medium bg-slate-955 text-slate-500 border border-slate-800 cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Waiting for doctor approval
                      </button>
                    ) : isRejected ? (
                      <button
                        onClick={() => handleRemoveDeclined(appt.id)}
                        className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-red-955/40 hover:bg-red-900/40 text-red-400 border border-red-900/65 hover:text-red-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-medium bg-slate-955 text-slate-500 border border-slate-800 cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Waiting for doctor to start
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
