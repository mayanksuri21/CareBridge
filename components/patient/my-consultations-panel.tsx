"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Video } from 'lucide-react';
import Link from 'next/link';

export function MyConsultationsPanel({ patientId }: { patientId?: string }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConsultations = async () => {
    try {
      const res = await fetch('/api/appointments/call');
      const data = await res.json();
      if (data.appointments) {
        let list = data.appointments;
        // Filter by patient ID for safety and security
        if (patientId) {
          list = list.filter((a: any) => a.patient_id === patientId);
        }
        // ONLY show active/scheduled appointments (exclude completed)
        const activeOnly = list.filter(
          (a: any) =>
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
              <h4 className="text-sm font-bold text-white">Your Doctor is in the Consultation Room!</h4>
              <p className="text-xs text-emerald-300/90 mt-0.5">
                {activeLiveAppt.doctor_name || 'Doctor'} has started your session. Please join now.
              </p>
            </div>
          </div>
          <Link href={`/consultation/${activeLiveAppt.id}`}>
            <button className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-955 font-bold text-xs shadow-lg shadow-emerald-500/30 flex items-center gap-2 transition-all cursor-pointer">
              <Video className="w-4 h-4"/> Join Room Now →
            </button>
          </Link>
        </div>
      )}

      {/* Appointment Cards */}
      {appointments.length === 0 ? (
        <div className="text-center py-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
          No active consultations scheduled. Book an appointment to get started.
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
            const date = appt.scheduled_date || appt.scheduled_at?.split('T')?.[0] || 'Scheduled Date';
            const time = appt.scheduled_time || '12:00 PM';

            return (
              <div
                key={appt.id}
                className={`p-5 rounded-2xl bg-slate-900/90 border transition-all ${
                  isLive
                    ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <h4 className="font-bold text-slate-100 text-sm">{doctorName}</h4>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-emerald-400 border border-slate-700">
                        {department}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500"/> {date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500"/> {time}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                      <strong className="text-slate-400">Reason:</strong> {appt.reason || 'General Consultation'}
                    </p>
                  </div>

                  <div className="w-full md:w-auto">
                    {isLive ? (
                      <Link href={`/consultation/${appt.id}`}>
                        <button className="w-full md:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse flex items-center justify-center gap-2 transition-all">
                          <Video className="w-4 h-4"/> Doctor in Room • Join Call
                        </button>
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-medium bg-slate-955 text-slate-500 border border-slate-800 cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Waiting for Doctor...
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
