"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mic, MicOff, Video, VideoOff, PhoneOff, User, Activity, Loader2, Check, X, LogOut, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function ConsultationRoom() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.appointmentId || params?.id) as string;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [admittingId, setAdmittingId] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [patientJoinClicked, setPatientJoinClicked] = useState(false);

  // 1. Fetch current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user);
    });
  }, [supabase]);

  // 2. Fetch appointment data
  const loadAppointment = async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/appointments/call?appointment_id=${roomId}`);
      const json = await res.json();
      if (json?.appointment) {
        setAppointment(json.appointment);
      }
    } catch (err) {
      console.error("Room fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Polling fallback + Realtime listener to sync state changes immediately
  useEffect(() => {
    loadAppointment();
    const interval = setInterval(loadAppointment, 3000);

    const channel = supabase
      .channel(`consultation-room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `id=eq.${roomId}`,
        },
        () => {
          loadAppointment();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  // 4. If Patient is Admitted and clicked join, fetch the LiveKit Token
  useEffect(() => {
    if (!appointment || !currentUser) return;
    const isPatient = currentUser.id === appointment.patient_id;
    const isAdmitted = appointment.is_patient_admitted;

    if (isPatient && isAdmitted && patientJoinClicked && !token) {
      // Fetch LiveKit Token
      fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomId })
      })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          setToken(data.token);
          toast.success("Successfully admitted. Joined call room!");
        } else {
          console.error("LiveKit token error:", data.error);
        }
      })
      .catch(err => console.error("Token fetch catch error:", err));
    }
  }, [appointment, currentUser, token, roomId, patientJoinClicked]);

  // 5. Camera Mount
  const isDoctor = currentUser && appointment && currentUser.id === appointment.doctor_id;
  const isPatient = currentUser && appointment && currentUser.id === appointment.patient_id;
  const showCallView = isDoctor || (isPatient && appointment?.is_patient_admitted && patientJoinClicked);

  useEffect(() => {
    if (!showCallView) return;

    navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
      .then((s) => {
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch((e) => console.warn("Camera permission prompt/error:", e));

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [showCallView]);

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleEndCall = async () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    try {
      await fetch('/api/appointments/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: roomId, action: 'end' })
      });
    } catch (_) {}
    router.push(isDoctor ? '/doctor/dashboard' : '/patient/dashboard');
  };

  // Wait room action triggers
  const handleJoinWaiting = async () => {
    try {
      await fetch('/api/appointments/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: roomId, action: 'join_waiting' })
      });
      loadAppointment();
      toast.success("Joined wait room. Waiting for doctor to admit you...");
    } catch (err) {
      toast.error("Could not join waiting room.");
    }
  };

  const handleAdmit = async () => {
    setAdmittingId(true);
    try {
      await fetch('/api/appointments/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: roomId, action: 'admit' })
      });
      loadAppointment();
      toast.success("Patient admitted successfully!");
    } catch (err) {
      toast.error("Failed to admit patient.");
    } finally {
      setAdmittingId(false);
    }
  };

  const handleDecline = async () => {
    try {
      await fetch('/api/appointments/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: roomId, action: 'decline_admission' })
      });
      loadAppointment();
      toast.success("Patient entry declined.");
    } catch (err) {
      toast.error("Failed to decline patient.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center font-sans gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-xs text-slate-400">Syncing waiting room and consultation data...</p>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center font-sans gap-3">
        <h2 className="text-lg font-bold text-red-400">Consultation Room Error</h2>
        <p className="text-xs text-slate-400">We could not find this consultation appointment. Please check the URL.</p>
        <Link href="/patient/dashboard" className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl transition">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // --- RENDER PATIENT FLOW PAGES ---
  if (isPatient) {
    const isWaiting = appointment.is_patient_waiting;
    const isDeclined = appointment.is_patient_declined;
    const isAdmitted = appointment.is_patient_admitted;

    // A. Declined State
    if (isDeclined) {
      return (
        <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-550/10 border border-rose-550/40 flex items-center justify-center mb-6">
            <X className="w-8 h-8 text-rose-455" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Admission Declined</h2>
          <p className="text-sm text-slate-400 max-w-sm">The doctor could not admit you to this consultation room at this moment.</p>
          <Link href="/patient/dashboard" className="mt-8 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition border border-slate-700">
            Back to Patient Dashboard
          </Link>
        </div>
      );
    }

    // B. Admitted state but not yet joined the LiveKit room
    if (isAdmitted && !patientJoinClicked) {
      return (
        <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
          <div className="max-w-md w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl space-y-4 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-550/10 border border-emerald-500/40 flex items-center justify-center mb-4 mx-auto">
              <Check className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-white">Cleared to Join</h2>
            <p className="text-xs text-slate-400">
              Dr. Rahul Sharma has admitted you to the consultation room.
            </p>
            <button
              onClick={() => setPatientJoinClicked(true)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              Join Consultation
            </button>
          </div>
        </div>
      );
    }

    // C. Not Joined Wait room Yet (Doctor Ready banner)
    if (!isWaiting && !isAdmitted) {
      return (
        <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
          <div className="max-w-md w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-550/10 border border-emerald-550/40 flex items-center justify-center mb-6 mx-auto">
              <User className="w-6 h-6 text-emerald-450" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">Doctor is Waiting for You</h2>
            <p className="text-xs text-slate-400 mb-6">
              Your consultation session is ready. Please click below to request entry into the room.
            </p>
            <button
              onClick={handleJoinWaiting}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              Request Entry & Join Waiting Room
            </button>
          </div>
        </div>
      );
    }

    // D. Waiting state (Admit Pending)
    if (isWaiting && !isAdmitted) {
      return (
        <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
          <div className="max-w-md w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-455 mx-auto" />
            <h2 className="text-lg font-bold text-white">Consultation Waiting Room</h2>
            <p className="text-xs text-slate-400">
              You have successfully joined the waiting room. The doctor has been notified and will admit you shortly.
            </p>
            <div className="bg-slate-955 border border-slate-800/80 p-3 rounded-2xl text-[11px] text-slate-500">
              Please do not refresh this page. You will be connected automatically upon admission.
            </div>
            <button
              onClick={handleEndCall}
              className="mt-4 px-4 py-2 border border-slate-800 text-xs text-slate-400 rounded-xl hover:bg-slate-955 transition"
            >
              Cancel Call Request
            </button>
          </div>
        </div>
      );
    }
  }

  // --- RENDER CALL VIEW (FOR DOCTOR & ADMITTED PATIENT) ---
  const patientName = appointment.patient?.name || appointment.patient_name || 'Suman Suri';
  const age = appointment.patient?.age || '32';
  const gender = appointment.patient?.gender || 'Female';
  const complaint = appointment.reason || 'General Consultation';

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleEndCall}
            className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Leave Room
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-sm font-bold text-slate-100">Live Consultation Room</h1>
          </div>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-3 py-1 rounded-full">
          Room ID: {roomId?.slice(0, 8)}...
        </span>
      </header>

      {/* Grid */}
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-65px)] overflow-hidden">
        
        {/* Main Video View */}
        <div className="lg:col-span-3 bg-slate-955 rounded-2xl border border-slate-800/80 relative overflow-hidden flex items-center justify-center shadow-2xl">
          {isVideoOff ? (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                <User className="w-8 h-8 text-slate-400" />
              </div>
              <span className="text-xs">Camera is turned off</span>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
          )}

          {/* Call Controls Bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/95 backdrop-blur-xl px-6 py-2.5 rounded-full border border-slate-700/80 shadow-2xl">
            <button
              onClick={toggleMic}
              className={`p-3 rounded-full transition-all ${
                isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full transition-all ${
                isVideoOff ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </button>
            <button
              onClick={handleEndCall}
              className="p-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/50 transition-all"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Info Sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto">
          {/* Patient Admission Queue (ONLY FOR DOCTOR) */}
          {isDoctor && appointment.is_patient_waiting && (
            <div className="bg-[#111927]/95 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-pulse space-y-3">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> Patient Waiting
              </h3>
              <p className="text-[11px] text-slate-300">
                <strong>{patientName}</strong> is waiting to join the consultation room.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={handleAdmit}
                  disabled={admittingId}
                  className="py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" /> Admit
                </button>
                <button
                  onClick={handleDecline}
                  className="py-2 rounded-xl bg-rose-955 hover:bg-rose-900 text-rose-300 border border-rose-800/80 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Decline
                </button>
              </div>
            </div>
          )}

          {/* Patient Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 backdrop-blur-md">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <User className="w-4 h-4" /> Patient File
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 text-[10px] block uppercase">Patient Name</span>
                <span className="font-semibold text-slate-100 text-sm">{patientName}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-955 p-2 rounded-lg border border-slate-800/60">
                  <span className="text-slate-500 text-[10px] block">Age</span>
                  <span className="font-semibold text-slate-200">{age} yrs</span>
                </div>
                <div className="bg-slate-955 p-2 rounded-lg border border-slate-800/60">
                  <span className="text-slate-500 text-[10px] block">Gender</span>
                  <span className="font-semibold text-slate-200">{gender}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block uppercase">Chief Complaint</span>
                <p className="mt-1 p-2.5 rounded-lg bg-slate-955 border border-slate-800 text-slate-300 text-xs">
                  {complaint}
                </p>
              </div>
            </div>
          </div>

          {/* Live Clinical Notes */}
          <div className="flex-1 min-h-[180px] bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col backdrop-blur-md">
            <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Doctor Clinical Notes
            </h3>
            <textarea
              placeholder="Record symptoms observations, advice, or prescription notes here..."
              className="flex-1 w-full bg-slate-955 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
