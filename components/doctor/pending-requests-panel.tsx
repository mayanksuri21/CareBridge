"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, Video, RefreshCw, MessageSquare, AlertCircle, CheckCircle2, XCircle, FileText, Loader2 } from "lucide-react";
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

export function PendingRequestsPanel({ doctorId }: { doctorId?: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  // Decline modal states
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReasonOption, setDeclineReasonOption] = useState("");
  const [declineCustomReason, setDeclineCustomReason] = useState("");

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const cacheBust = Date.now();
      const res = await fetch(`/api/doctor/appointments?_t=${cacheBust}`, {
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
          reason: cleanReason,
          scheduled_date: parsedDate,
          scheduled_time: parsedTime
        };
      });

      // Keep active requests (scheduled, pending, or uncompleted)
      const active = filteredList.filter(
        (a: any) =>
          a.status === "pending" ||
          a.status === "scheduled" ||
          a.status === "doctor_in_room" ||
          a.status === "patient_waiting" ||
          a.status === "patient_admitted" ||
          a.status === "in_progress"
      );
      setRequests(active);
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

      toast.success("Request approved and scheduled.");
      setRequests((prev) =>
        prev.map((a) =>
          a.id === appointmentId ? { ...a, status: 'scheduled' } : a
        )
      );
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

    setDeclineOpen(false);
    setWorkingId(declineId);
    try {
      const response = await fetch('/api/appointments/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: declineId,
          status: 'cancelled',
          reason_notes: finalReason
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Failed to decline appointment");
      }

      toast.success("Appointment declined successfully");
      setRequests((prev) => prev.filter((a) => a.id !== declineId));
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Could not decline this request. Please try again.");
    } finally {
      setWorkingId(null);
      setDeclineId(null);
    }
  };

  const handleStartConsultation = (appointmentId: string) => {
    window.location.href = `/consultation/${appointmentId}`;
  };

  return (
    <div className="bg-[#111927]/90 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between min-h-[340px] font-sans">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-slate-100">Incoming Consultation Requests</h3>
            {requests.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {requests.length} Active
              </span>
            )}
          </div>
          <button
            onClick={fetchRequests}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          Review patient requests, approve or decline consultations, and begin video calls.
        </p>

        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 bg-[#0a0f1d]/80 border border-slate-800/70 rounded-xl text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-955/65 border border-emerald-500/30 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-slate-200 mb-1">No incoming requests</h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4 leading-relaxed">
              Patient consultation requests will appear here once submitted. Use the Available Slots manager to set the times you prefer to work.
            </p>
            <Link href="/consultation/book">
              <button className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition">
                View public site
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const pending = req.status === "pending";
              const scheduled = req.status === "scheduled" || req.status === "doctor_in_room" || req.status === "patient_waiting" || req.status === "patient_admitted" || req.status === "in_progress";
              const isWorking = workingId === req.id;

              return (
                <div
                  key={req.id}
                  className="p-4 bg-[#0a0f1d]/90 border border-slate-800/90 hover:border-emerald-500/40 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition shadow-lg"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-white">
                        {req.patient_name || req.patient?.name || req.patient_email || req.patient?.email || "Patient"}
                      </span>
                      {pending && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> 🟡 Pending
                        </span>
                      )}
                      {scheduled && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 uppercase font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Scheduled
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {req.scheduled_date || req.scheduled_at?.split("T")?.[0] || req.scheduled_at?.split(" ")?.[0] || "17-08-2026"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {req.scheduled_time || req.scheduled_at?.split(" ")?.[1] || "12:00 PM"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/70 mt-1">
                      <strong className="text-slate-400">Reason:</strong> {req.reason || "General Consultation"}
                      {req.symptoms ? ` | Symptoms: ${req.symptoms}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {pending && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(req.id)}
                          disabled={isWorking}
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
                        >
                          {isWorking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          {isWorking ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeclineClick(req.id)}
                          disabled={isWorking}
                          className="gap-1.5 bg-red-650 hover:bg-red-600 text-white rounded-xl font-medium"
                        >
                          {isWorking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {isWorking ? 'Declining...' : 'Decline'}
                        </Button>
                      </>
                    )}
                    {scheduled && (
                      <>
                        <Button
                          onClick={() => handleStartConsultation(req.id)}
                          className="w-full md:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          <Video className="w-4 h-4" /> Start Consultation
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeclineClick(req.id)}
                          disabled={isWorking}
                          className="gap-1.5 bg-red-650 hover:bg-red-600 text-white rounded-xl font-medium"
                        >
                          {isWorking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {isWorking ? 'Declining...' : 'Decline'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100 rounded-3xl">
          <DialogHeader>
            <DialogTitle>Decline Consultation Request</DialogTitle>
            <DialogDescription className="text-slate-400">
              Why are you declining this request?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400">Select a reason</label>
              <select
                value={declineReasonOption}
                onChange={(e) => setDeclineReasonOption(e.target.value)}
                className="w-full bg-[#0d1527] text-white border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="" className="bg-[#0d1527] text-slate-400">-- Select a reason --</option>
                <option value="Emergency duty / Hospital surgery conflict" className="bg-[#0d1527] text-white">Emergency duty / Hospital surgery conflict</option>
                <option value="Selected time slot is unavailable" className="bg-[#0d1527] text-white">Selected time slot is unavailable</option>
                <option value="Specialty mismatch - Requires specialist consultation" className="bg-[#0d1527] text-white">Specialty mismatch - Requires specialist consultation</option>
                <option value="Other" className="bg-[#0d1527] text-white">Other reason</option>
              </select>
            </div>

            {declineReasonOption === "Other" && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <label className="text-xs font-semibold text-slate-400">Please enter the reason...</label>
                <textarea
                  value={declineCustomReason}
                  onChange={(e) => setDeclineCustomReason(e.target.value)}
                  placeholder="Specify the reason for declining..."
                  rows={3}
                  className="w-full rounded-xl bg-[#0e1626] border border-slate-800 p-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary placeholder-slate-500"
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setDeclineOpen(false)}
              className="text-slate-355 hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDecline}
              disabled={!declineReasonOption || (declineReasonOption === "Other" && !declineCustomReason.trim())}
              className="bg-red-650 hover:bg-red-600 text-white rounded-xl"
            >
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
