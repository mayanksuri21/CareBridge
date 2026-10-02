"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, Video, RefreshCw, MessageSquare, AlertCircle, CheckCircle2, XCircle, FileText, Loader2, CalendarCheck, Trash2, PhoneOff, ChevronDown, ChevronUp, User, Activity } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PrescriptionModal } from "@/components/doctor/prescription-modal";

/** Helper to extract patient initials */
function getInitials(name?: string) {
  if (!name) return "PT";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Helper to extract and format patient Age / Gender */
function formatAgeGender(req: any): string {
  let age: string | number | null = req.patient_age || req.age || req.patient?.age || null;
  if (!age && req.patient?.date_of_birth) {
    try {
      const dob = new Date(req.patient.date_of_birth);
      if (!isNaN(dob.getTime())) {
        const today = new Date();
        let calculated = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
          calculated--;
        }
        age = calculated > 0 ? calculated : null;
      }
    } catch { }
  }

  let gender: string | null = req.patient_gender || req.gender || req.patient?.gender || null;
  if (gender) {
    gender = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
  }

  const ageStr = age ? `${age} Yrs` : null;
  const genderStr = gender || null;

  if (ageStr && genderStr) return `${ageStr} • ${genderStr}`;
  if (ageStr) return ageStr;
  if (genderStr) return genderStr;
  return "Not provided";
}

/** Returns true if a consultation's scheduled date+time is more than 30 minutes in the past. */
function isConsultationPast(appt: any): boolean {
  try {
    const dStr = appt.scheduled_date || appt.appointment_date || appt.scheduled_at?.split('T')?.[0] || appt.scheduled_at?.split(' ')?.[0] || '';
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
      const tStr = appt.scheduled_time || appt.time_slot || '';
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

export function PendingRequestsPanel({
  doctorId,
  onRequestCountChange,
}: {
  doctorId?: string;
  onRequestCountChange?: (count: number) => void;
}) {
  const [requests, setRequests] = useState<any[]>([]);
  const [confirmedConsultations, setConfirmedConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  // Expanded UI state
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Decline modal states
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReasonOption, setDeclineReasonOption] = useState("");
  const [declineCustomReason, setDeclineCustomReason] = useState("");

  // End consultation modal states
  const [endConsultationId, setEndConsultationId] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  const handleConfirmEndConsultation = async () => {
    if (!endConsultationId) return;
    setIsEnding(true);
    try {
      const res = await fetch('/api/appointments/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: endConsultationId, action: 'end' }),
      });
      if (res.ok) {
        setConfirmedConsultations((prev) => prev.filter((a) => a.id !== endConsultationId));
        toast.success("Consultation ended successfully.");
      } else {
        toast.error("Failed to end consultation.");
      }
    } catch (err) {
      console.error("End consultation error:", err);
      toast.error("Failed to end consultation.");
    } finally {
      setIsEnding(false);
      setEndConsultationId(null);
    }
  };

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const cacheBust = Date.now();
      const doctorParam = doctorId ? `&doctor_id=${encodeURIComponent(doctorId)}` : "";
      const res = await fetch(`/api/doctor/appointments?_t=${cacheBust}${doctorParam}`, {
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const list = Array.isArray(data?.appointments) ? data.appointments : [];

      // Filter by doctorId if doctorId is present and not null
      let filteredList = list;
      if (doctorId) {
        filteredList = list.filter((a: any) => a.doctor_id === doctorId || !a.doctor_id);
      }

      filteredList = filteredList.map((appt: any) => {
        const reasonStr = appt.reason || '';
        const isDeclinedText = reasonStr.includes('Declined:') || reasonStr.includes('[PATIENT_DECLINED]');
        const isCancelledOrDeclined = appt.status === 'cancelled' || appt.status === 'rejected' || appt.status === 'declined' || isDeclinedText;

        const isDoctorInRoom = !isCancelledOrDeclined && (reasonStr.includes('[DOCTOR_IN_ROOM]') || Boolean(appt.is_doctor_in_room));
        const isPatientWaiting = !isCancelledOrDeclined && (reasonStr.includes('[PATIENT_WAITING]') || Boolean(appt.is_patient_waiting));
        const isPatientAdmitted = !isCancelledOrDeclined && (reasonStr.includes('[PATIENT_ADMITTED]') || Boolean(appt.is_patient_admitted));
        const isCallActive = !isCancelledOrDeclined && (reasonStr.includes('[CALL_ACTIVE]') || isDoctorInRoom || isPatientWaiting || isPatientAdmitted || appt.status === 'in_progress');
        const isPendingApproval = reasonStr.includes('[PENDING_APPROVAL]');

        const isPaid = appt.payment_status === 'paid' ||
          appt.payment_status === 'completed' ||
          reasonStr.includes('[PAYMENT_PAID]');

        const paymentStatus = isPaid ? 'paid' : 'pending';

        let cleanReason = reasonStr;
        ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]', '[PAYMENT_PAID]', '[PAYMENT_PENDING]', '[ARCHIVED_BY_DOCTOR]'].forEach(tag => {
          cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '');
        });
        cleanReason = cleanReason.replace(/\[[A-Z_]+\]/g, '').trim();

        const dateMatch = cleanReason.match(/Selected Date:\s*([\w\d, -]+)/i) || cleanReason.match(/Preferred Date:\s*([\w\d, -]+)/i);
        const timeMatch = cleanReason.match(/Time Slot:\s*([\w\d: ]+)/i);
        const parsedDate = dateMatch ? dateMatch[1].trim() : (appt.scheduled_date || appt.appointment_date || 'Today');
        const parsedTime = timeMatch ? timeMatch[1].trim() : (appt.scheduled_time || appt.time_slot || '12:00 PM');

        let symptomsText = appt.symptoms || appt.patient_symptoms || appt.additional_symptoms || appt.notes || appt.patient_notes || appt.description || appt.details || appt.symptom || '';
        if (!symptomsText && reasonStr) {
          const symptomsMatch = reasonStr.match(/Symptoms:\s*([\s\S]+)/i);
          if (symptomsMatch && symptomsMatch[1]) {
            symptomsText = symptomsMatch[1]
              .replace(/\[[A-Z_]+\]/g, '')
              .replace(/(Selected Date:|Preferred Date:|Time Slot:).*/gi, '')
              .trim();
          }
        }

        let extractClean = cleanReason;
        if (extractClean.includes('Selected Date:')) extractClean = extractClean.split('Selected Date:')[0].trim();
        if (extractClean.includes('Preferred Date:')) extractClean = extractClean.split('Preferred Date:')[0].trim();
        if (extractClean.includes('Time Slot:')) extractClean = extractClean.split('Time Slot:')[0].trim();
        if (extractClean.includes('Symptoms:')) extractClean = extractClean.split('Symptoms:')[0].trim();
        extractClean = extractClean.replace(/^[|-]\s*/, '').replace(/\s*[|-]$/, '').trim();

        if (!extractClean || extractClean.toLowerCase() === 'general consultation') {
          extractClean = 'General Consultation';
        }

        let statusVal = appt.status;
        if (isCancelledOrDeclined) {
          statusVal = 'declined';
        } else if (isPatientAdmitted) {
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

        return {
          ...appt,
          payment_status: paymentStatus,
          status: statusVal,
          reason: extractClean,
          symptoms: symptomsText,
          scheduled_date: parsedDate,
          scheduled_time: parsedTime
        };
      });

      // Split into pending vs confirmed (strictly exclude declined and cancelled)
      const pending = filteredList.filter(
        (a: any) => a.status === "pending" && a.status !== "declined" && a.status !== "cancelled" && !a.reason?.includes("Declined:")
      );
      const confirmed = filteredList.filter(
        (a: any) =>
          a.status !== "declined" &&
          a.status !== "cancelled" &&
          a.status !== "missed" &&
          !a.reason?.includes("Declined:") &&
          !a.reason?.includes("[ARCHIVED_BY_DOCTOR]") &&
          (a.status === "scheduled" ||
            a.status === "doctor_in_room" || a.status === "patient_waiting" ||
            a.status === "patient_admitted" || a.status === "in_progress")
      );
      setRequests(pending);
      setConfirmedConsultations(confirmed);
    } catch (e) {
      console.error("Fetch pending requests error:", e);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 3000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  useEffect(() => {
    if (onRequestCountChange) {
      onRequestCountChange(requests.length);
    }
  }, [requests.length, onRequestCountChange]);

  const handleApprove = async (appointmentId: string) => {
    setWorkingId(appointmentId);
    try {
      const res = await fetch("/api/appointments/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: appointmentId,
          status: "scheduled",
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || "Failed to approve appointment");
      }

      toast.success("Request approved. Waiting for patient payment.");
      setRequests((prev) => prev.filter((a) => a.id !== appointmentId));
      const targetReq = requests.find((a) => a.id === appointmentId);
      if (targetReq) {
        setConfirmedConsultations((prev) => [
          ...prev,
          { ...targetReq, status: 'scheduled', payment_status: 'pending' }
        ]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not approve this request. Please try again.");
    } finally {
      setWorkingId(null);
    }
  };

  const handleDeclineClick = (appointmentId: string) => {
    setDeclineId(appointmentId);
    setDeclineReasonOption("");
    setDeclineCustomReason("");
    setDeclineOpen(true);
  };

  const handleConfirmDecline = async () => {
    if (!declineId) return;

    let finalReason = declineReasonOption;
    if (declineReasonOption === "Other") {
      if (!declineCustomReason.trim()) {
        toast.error("Please enter a custom reason.");
        return;
      }
      finalReason = declineCustomReason.trim();
    } else if (!declineReasonOption) {
      toast.error("Please select a reason for declining.");
      return;
    }

    const capturedDeclineId = declineId;
    setWorkingId(capturedDeclineId);

    try {
      const payload = {
        appointment_id: capturedDeclineId,
        decline_reason: finalReason
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      let response: Response;
      try {
        response = await fetch('/api/doctor/appointments/decline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'AbortError') {
          throw new Error("Server took too long to respond. Please try again.");
        }
        throw fetchErr;
      } finally {
        clearTimeout(timeoutId);
      }

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok || !responseBody.success) {
        throw new Error(responseBody.error || "Failed to decline appointment");
      }

      setDeclineOpen(false);
      toast.success("Appointment declined successfully");
      setRequests((prev) => prev.filter((a) => a.id !== capturedDeclineId));
      setConfirmedConsultations((prev) => prev.filter((a) => a.id !== capturedDeclineId));
    } catch (err: any) {
      console.error("[decline] failed:", err);
      toast.error(err.message || "Could not decline this request. Please try again.");
    } finally {
      setWorkingId(null);
      setDeclineId(null);
    }
  };

  const handleStartConsultation = async (appointmentId: string) => {
    try {
      await fetch('/api/appointments/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointmentId, action: 'start' }),
      });
    } catch (e) {
      console.error("Failed to signal doctor start:", e);
    }
    window.location.href = `/consultation/${appointmentId}`;
  };

  const handleRemoveMissed = async (appointmentId: string) => {
    setWorkingId(appointmentId);
    try {
      const res = await fetch("/api/appointments/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: appointmentId,
          status: "missed",
          archived_by_doctor: true,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to remove missed consultation");
      }

      toast.success("Missed consultation removed from queue.");
      setConfirmedConsultations((prev) => prev.filter((a) => a.id !== appointmentId));
    } catch (err: any) {
      console.error("Remove missed consultation error:", err);
      toast.error(err.message || "Could not remove consultation. Please try again.");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div id="requests" className="bg-white border border-sky-100 rounded-3xl p-5 md:p-6 flex flex-col justify-between font-sans shadow-sm space-y-6">
      <div>
        {/* INCOMING REQUESTS HEADER BANNER (LIGHT THEME MATCHING REFERENCE) */}
        <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-4 md:p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-100/70 border border-teal-200 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Consultation Requests</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review incoming patient consultation requests, inspect requested slot details, and approve or decline.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {requests.length} Pending
            </span>
            <button
              onClick={fetchRequests}
              className="text-xs text-slate-600 hover:text-slate-900 p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition"
              title="Refresh requests"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 bg-slate-50/50 border border-sky-100/80 rounded-2xl text-center mb-8">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">No pending consultation requests</h4>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              Patient consultation requests will appear here in real-time as patients book appointments.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {requests.map((req) => {
              const isWorking = workingId === req.id;
              const isExpanded = Boolean(expandedIds[req.id]);
              const patientName = req.patient_name || req.patient?.name || req.patient_email || "Patient";
              const initials = getInitials(patientName);
              const reasonTag = req.reason?.replace(/\[.*?\]/g, '').trim() || "Consultation";
              const displayDate = req.scheduled_date || "Today";
              const displayTime = req.scheduled_time || "12:00 PM";

              return (
                <div
                  key={req.id}
                  className="bg-white border border-slate-200/90 rounded-2xl transition-all hover:border-sky-300/80 shadow-2xs overflow-hidden"
                >
                  {/* Collapsed Header Row */}
                  <div className="p-3.5 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-800 font-extrabold text-xs flex items-center justify-center shrink-0 border border-sky-200">
                        {initials}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm tracking-tight truncate">
                            {patientName}
                          </h4>
                          {reasonTag && (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100/80 truncate max-w-[160px]">
                              {reasonTag}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="w-3 h-3 text-sky-600" />
                          <span>{displayDate}, {displayTime}</span>
                          <span>&bull;</span>
                          <span className="text-slate-500 font-medium">New Consultation</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(req.id)}
                        disabled={isWorking}
                        className="bg-[#00a86b] hover:bg-[#008f5b] text-white font-bold text-xs px-5 py-2 rounded-full flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                      >
                        {isWorking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approve
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeclineClick(req.id)}
                        disabled={isWorking}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs px-4 py-2 rounded-full flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {isWorking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        Decline
                      </Button>

                      <button
                        type="button"
                        onClick={() => toggleExpand(req.id)}
                        className="w-8 h-8 rounded-full border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition cursor-pointer"
                        title={isExpanded ? "Collapse" : "Expand details"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Row Panel */}
                  {isExpanded && (
                    <div className="bg-sky-50/40 border-t border-sky-100/80 p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs text-slate-700 animate-in fade-in duration-150">
                      <div className="bg-white border border-sky-100 p-3.5 rounded-xl shadow-2xs flex flex-col justify-between space-y-2">
                        <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-xs border-b border-sky-100 pb-2">
                          <User className="w-3.5 h-3.5 text-sky-600 shrink-0" /> Patient Information
                        </span>
                        <div className="pt-0.5 space-y-1.5 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500 font-medium">Phone</span>
                            <span className="font-semibold text-slate-900 text-xs">{req.patient_phone || req.phone || req.patient?.phone || "Not provided"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500 font-medium shrink-0">Email</span>
                            <span className="font-semibold text-slate-900 text-xs truncate max-w-[160px]">{req.patient_email || req.email || req.patient?.email || "Not provided"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500 font-medium shrink-0">Age / Gender</span>
                            <span className="font-semibold text-slate-900 text-xs truncate">{formatAgeGender(req)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-sky-100 p-3.5 rounded-xl shadow-2xs flex flex-col justify-between space-y-2">
                        <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-xs border-b border-sky-100 pb-2">
                          <Activity className="w-3.5 h-3.5 text-sky-600 shrink-0" /> Symptoms
                        </span>
                        <div className="pt-0.5 flex-1">
                          {(req.symptoms || req.patient_symptoms || req.additional_symptoms || req.notes || req.description) ? (
                            <div className="bg-amber-50/90 border border-amber-200/70 p-2.5 rounded-lg text-amber-950 font-medium leading-relaxed text-xs">
                              {req.symptoms || req.patient_symptoms || req.additional_symptoms || req.notes || req.description}
                            </div>
                          ) : (
                            <p className="text-slate-400 italic text-xs pt-1">No symptoms specified.</p>
                          )}
                        </div>
                      </div>

                      <div className="bg-white border border-sky-100 p-3.5 rounded-xl shadow-2xs flex flex-col justify-between space-y-2">
                        <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-xs border-b border-sky-100 pb-2">
                          <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" /> Additional Details
                        </span>
                        <div className="pt-0.5 flex-1">
                          <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-lg text-slate-800 font-medium leading-relaxed text-xs">
                            {req.reason || "General Consultation Request"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* CONFIRMED CONSULTATIONS SECTION */}
        <div className="flex items-center justify-between mb-4 border-t border-slate-200/80 pt-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Confirmed Consultations</h3>
            {confirmedConsultations.length > 0 && (
              <span className="px-3 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {confirmedConsultations.length} Confirmed
              </span>
            )}
          </div>
        </div>

        {confirmedConsultations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 bg-slate-50/50 border border-sky-100/80 rounded-2xl text-center">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
              <CalendarCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">No confirmed consultations</h4>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              Approved consultation sessions ready for video calls will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {confirmedConsultations.map((req) => {
              const isWorking = workingId === req.id;
              const isPast = isConsultationPast(req);
              const isExpanded = Boolean(expandedIds[req.id]);
              const patientName = req.patient_name || req.patient?.name || req.patient_email || "Patient";
              const initials = getInitials(patientName);
              const reasonTag = req.reason?.replace(/\[.*?\]/g, '').trim() || "Consultation";

              return (
                <div
                  key={req.id}
                  className="bg-white border border-slate-200/90 rounded-2xl transition-all hover:border-emerald-300/80 shadow-2xs overflow-hidden"
                >
                  {/* Collapsed Row */}
                  <div className="p-3.5 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center shrink-0 border border-emerald-200">
                        {initials}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm tracking-tight truncate">
                            {patientName}
                          </h4>
                          {reasonTag && (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100/80 truncate max-w-[160px]">
                              {reasonTag}
                            </span>
                          )}
                          {req.payment_status === "paid" ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Paid
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              Payment Pending
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="w-3 h-3 text-emerald-600" />
                          <span>{req.scheduled_date || "Today"}, {req.scheduled_time || "12:00 PM"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
                      {!isPast && (
                        <>
                          {req.payment_status === "paid" ? (
                            <Button
                              size="sm"
                              onClick={() => handleStartConsultation(req.id)}
                              className="bg-[#00a86b] hover:bg-[#008f5b] text-white font-bold text-xs px-5 py-2 rounded-full flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                            >
                              <Video className="w-3.5 h-3.5" />
                              {req.status === 'in_progress' || req.status === 'doctor_in_room' || req.status === 'patient_waiting' || req.status === 'patient_admitted' || req.is_doctor_in_room || req.call_active || (typeof req.reason === 'string' && (req.reason.includes('[DOCTOR_IN_ROOM]') || req.reason.includes('[CALL_ACTIVE]'))) ? "Rejoin Consultation" : "Start Consultation"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              disabled
                              className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-4 py-2 rounded-full cursor-not-allowed"
                            >
                              Waiting Payment
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEndConsultationId(req.id)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs px-3.5 py-2 rounded-full flex items-center gap-1 transition cursor-pointer"
                            title="End Session"
                          >
                            <PhoneOff className="w-3.5 h-3.5" />
                            End
                          </Button>
                        </>
                      )}

                      {isPast && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveMissed(req.id)}
                          disabled={isWorking}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium px-3.5 py-1.5 rounded-full"
                        >
                          {isWorking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-slate-400" />}
                          Remove
                        </Button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpand(req.id)}
                        className="w-8 h-8 rounded-full border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition cursor-pointer"
                        title={isExpanded ? "Collapse" : "Expand details"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Row Panel */}
                  {isExpanded && (
                    <div className="bg-emerald-50/30 border-t border-emerald-100/80 p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs text-slate-700 animate-in fade-in duration-150">
                      <div className="bg-white border border-emerald-100 p-3.5 rounded-xl shadow-2xs flex flex-col justify-between space-y-2">
                        <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-xs border-b border-emerald-100 pb-2">
                          <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Patient Information
                        </span>
                        <div className="pt-0.5 space-y-1.5 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500 font-medium">Phone</span>
                            <span className="font-semibold text-slate-900 text-xs">{req.patient_phone || req.phone || req.patient?.phone || "Not provided"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500 font-medium shrink-0">Email</span>
                            <span className="font-semibold text-slate-900 text-xs truncate max-w-[160px]">{req.patient_email || req.email || req.patient?.email || "Not provided"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500 font-medium shrink-0">Age / Gender</span>
                            <span className="font-semibold text-slate-900 text-xs truncate">{formatAgeGender(req)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-emerald-100 p-3.5 rounded-xl shadow-2xs flex flex-col justify-between space-y-2">
                        <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-xs border-b border-emerald-100 pb-2">
                          <Activity className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Symptoms
                        </span>
                        <div className="pt-0.5 flex-1">
                          {(req.symptoms || req.patient_symptoms || req.additional_symptoms || req.notes || req.description) ? (
                            <div className="bg-amber-50/90 border border-amber-200/70 p-2.5 rounded-lg text-amber-950 font-medium leading-relaxed text-xs">
                              {req.symptoms || req.patient_symptoms || req.additional_symptoms || req.notes || req.description}
                            </div>
                          ) : (
                            <p className="text-slate-400 italic text-xs pt-1">No symptoms specified.</p>
                          )}
                        </div>
                      </div>

                      <div className="bg-white border border-emerald-100 p-3.5 rounded-xl shadow-2xs flex flex-col justify-between space-y-2">
                        <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-xs border-b border-emerald-100 pb-2">
                          <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Consultation Details
                        </span>
                        <div className="pt-0.5 flex-1">
                          <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-lg text-slate-800 font-medium leading-relaxed text-xs">
                            {req.reason || "Confirmed appointment session."}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="sm:max-w-md bg-white border-sky-100 text-slate-900 rounded-3xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold">Decline Consultation Request</DialogTitle>
            <DialogDescription className="text-slate-500">
              Why are you declining this request?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Select a reason</label>
              <select
                value={declineReasonOption}
                onChange={(e) => setDeclineReasonOption(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="" className="bg-white text-slate-500">-- Select a reason --</option>
                <option value="Emergency duty / Hospital surgery conflict" className="bg-white text-slate-900">Emergency duty / Hospital surgery conflict</option>
                <option value="Selected time slot is unavailable" className="bg-white text-slate-900">Selected time slot is unavailable</option>
                <option value="Specialty mismatch - Requires specialist consultation" className="bg-white text-slate-900">Specialty mismatch - Requires specialist consultation</option>
                <option value="Other" className="bg-white text-slate-900">Other reason</option>
              </select>
            </div>

            {declineReasonOption === "Other" && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <label className="text-xs font-semibold text-slate-600">Please enter the reason...</label>
                <textarea
                  value={declineCustomReason}
                  onChange={(e) => setDeclineCustomReason(e.target.value)}
                  placeholder="Specify the reason for declining..."
                  rows={3}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-400"
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setDeclineOpen(false)}
              className="text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDecline}
              disabled={!declineReasonOption || (declineReasonOption === "Other" && !declineCustomReason.trim())}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
            >
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Consultation Confirmation Modal */}
      <Dialog open={Boolean(endConsultationId)} onOpenChange={(open) => !open && setEndConsultationId(null)}>
        <DialogContent className="bg-white border-sky-100 text-slate-900 sm:max-w-md shadow-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PhoneOff className="w-5 h-5 text-rose-600" />
              End Consultation?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-2">
              Are you sure you want to end this consultation? This will mark the session as completed and close the consultation room for the patient.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEndConsultationId(null)}
              disabled={isEnding}
              className="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmEndConsultation}
              disabled={isEnding}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-rose-600/20"
            >
              {isEnding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Ending...
                </>
              ) : (
                "Yes, End Consultation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
