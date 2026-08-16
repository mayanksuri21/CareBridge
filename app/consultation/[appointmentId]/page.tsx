"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mic, MicOff, Video, VideoOff, PhoneOff, User, Activity, Loader2, Check, X, LogOut, ShieldAlert, FileText, Plus, Trash, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room, RoomEvent, Track } from "livekit-client";

type MedicineInput = {
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
};

export default function ConsultationRoom() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.appointmentId || params?.id) as string;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // WebRTC Stream Elements Refs
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // DRAGGABLE PIP PREVIEW COORDINATES
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragPosStart = useRef({ x: 0, y: 0 });

  // WebRTC Tracks States
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [admittingId, setAdmittingId] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [patientJoinClicked, setPatientJoinClicked] = useState(false);

  // Clinical Notes & Prescriptions State
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');

  const [medicines, setMedicines] = useState<any[]>([]);
  const [medInput, setMedInput] = useState<MedicineInput>({ name: '', dosage: '', duration: '', instructions: '' });
  const [sendingPrescription, setSendingPrescription] = useState(false);

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

        // Load clinical notes from reason column if present
        const notesMatch = json.appointment.reason?.match(/\[CLINICAL_NOTES\]:\s*([\s\S]*)/i);
        const notesVal = notesMatch ? notesMatch[1].trim() : '';
        setClinicalNotes(notesVal);
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

  // 4. Fetch LiveKit Token for authorized users
  const isDoctor = currentUser && appointment && currentUser.id === appointment.doctor_id;
  const isPatient = currentUser && appointment && currentUser.id === appointment.patient_id;
  const showCallView = isDoctor || (isPatient && appointment?.is_patient_admitted && patientJoinClicked);

  useEffect(() => {
    if (!appointment || !currentUser || token) return;

    if (isDoctor || (isPatient && appointment?.is_patient_admitted && patientJoinClicked)) {
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
        } else {
          console.error("LiveKit token error:", data.error);
        }
      })
      .catch(err => console.error("Token fetch catch error:", err));
    }
  }, [appointment, currentUser, token, roomId, patientJoinClicked, isDoctor, isPatient]);

  // 5. Initialize LiveKit Room and WebRTC Peer Connection
  const room = useMemo(() => new Room({
    adaptiveStream: true,
    dynacast: true,
  }), []);

  useEffect(() => {
    if (!showCallView || !token) return;

    room.on(RoomEvent.Connected, async () => {
      try {
        if (typeof room.localParticipant.enableCameraAndMicrophone === 'function') {
          await room.localParticipant.enableCameraAndMicrophone();
        } else {
          await room.localParticipant.setCameraEnabled(true);
          await room.localParticipant.setMicrophoneEnabled(true);
        }
      } catch (trackErr) {
        console.error("PublishTrackError caught safely:", trackErr);
      }
    });

    const connectToRoom = async () => {
      try {
        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);

        navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
          .then((s) => {
            setLocalStream(s);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = s;
            }
          })
          .catch(e => console.warn("Local camera preview error:", e));
      } catch (err) {
        console.error("WebRTC connection failed:", err);
      }
    };

    connectToRoom();

    // Track Subscribed listener
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === 'video') {
        const streamObj = new MediaStream([track.mediaStreamTrack]);
        setRemoteStream(streamObj);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = streamObj;
        }
      } else if (track.kind === 'audio') {
        const audioStream = new MediaStream([track.mediaStreamTrack]);
        if (audioRef.current) {
          audioRef.current.srcObject = audioStream;
          audioRef.current.play().catch(e => console.warn("Audio play fail:", e));
        }
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      if (track.kind === 'video') {
        setRemoteStream(null);
      }
    });

    return () => {
      room.disconnect();
    };
  }, [showCallView, token, room]);

  // 6. Clinical Notes Debounced Autosave
  useEffect(() => {
    if (!appointment || !isDoctor || clinicalNotes === '') return;

    // Avoid saving on initial load when state is parsed
    const notesMatch = appointment.reason?.match(/\[CLINICAL_NOTES\]:\s*([\s\S]*)/i);
    const initialNotes = notesMatch ? notesMatch[1].trim() : '';
    if (clinicalNotes === initialNotes) return;

    setSaveStatus('saving');
    
    const timeout = setTimeout(async () => {
      try {
        let cleanReason = appointment.reason || '';
        const notesIdx = cleanReason.indexOf('\n\n[CLINICAL_NOTES]:');
        if (notesIdx !== -1) {
          cleanReason = cleanReason.substring(0, notesIdx);
        }
        
        const newReason = `${cleanReason}\n\n[CLINICAL_NOTES]: ${clinicalNotes}`;

        const { error } = await supabase
          .from('appointments')
          .update({ reason: newReason })
          .eq('id', roomId);

        if (error) throw error;
        setSaveStatus('saved');
      } catch (err) {
        console.error("Autosave notes failed:", err);
        setSaveStatus('idle');
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [clinicalNotes, appointment, isDoctor, roomId, supabase]);

  // 7. Draggable self preview helper logic (Touch & Mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragPosStart.current = { x: position.x, y: position.y };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    let newX = dragPosStart.current.x - dx;
    let newY = dragPosStart.current.y - dy;

    if (containerRef.current && dragRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const dragRect = dragRef.current.getBoundingClientRect();
      const maxX = containerRect.width - dragRect.width - 10;
      const maxY = containerRect.height - dragRect.height - 10;

      newX = Math.max(10, Math.min(maxX, newX));
      newY = Math.max(10, Math.min(maxY, newY));
    }

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    dragStart.current = { x: touch.clientX, y: touch.clientY };
    dragPosStart.current = { x: position.x, y: position.y };
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.current.x;
    const dy = touch.clientY - dragStart.current.y;
    
    let newX = dragPosStart.current.x - dx;
    let newY = dragPosStart.current.y - dy;

    if (containerRef.current && dragRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const dragRect = dragRef.current.getBoundingClientRect();
      const maxX = containerRect.width - dragRect.width - 10;
      const maxY = containerRect.height - dragRect.height - 10;

      newX = Math.max(10, Math.min(maxX, newX));
      newY = Math.max(10, Math.min(maxY, newY));
    }

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleTouchMove]);

  // Audio / Video toggles
  const toggleMic = async () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    await room.localParticipant.setMicrophoneEnabled(!nextMute);
  };

  const toggleVideo = async () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);
    await room.localParticipant.setCameraEnabled(!nextVideoOff);
  };

  const handleEndCall = async () => {
    if (localStream) localStream.getTracks().forEach((t: any) => t.stop());
    try {
      await fetch('/api/appointments/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: roomId, action: 'end' })
      });
    } catch (_) {}
    router.push(isDoctor ? '/doctor/dashboard' : '/patient/dashboard');
  };

  // State Triggers
  const handleJoinWaiting = async () => {
    try {
      await fetch('/api/appointments/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: roomId, action: 'join_waiting' })
      });
      loadAppointment();
      toast.success("Requested entry. Waiting for doctor to admit you...");
    } catch (err) {
      toast.error("Could not request entry.");
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
      toast.success("Patient admitted to session!");
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

  // Prescription System Form Handlers
  const handleAddMedicine = () => {
    if (!medInput.name || !medInput.dosage || !medInput.duration) {
      toast.error("Please enter Medicine, Dosage, and Duration.");
      return;
    }
    setMedicines([...medicines, { ...medInput }]);
    setMedInput({ name: '', dosage: '', duration: '', instructions: '' });
  };

  const handleRemoveMedicine = (idx: number) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
  };

  const handleSendPrescription = async () => {
    if (medicines.length === 0) {
      toast.error("Please add at least one medication.");
      return;
    }

    setSendingPrescription(true);
    try {
      const medicationsFormatted = medicines.map(m => ({
        medication_name: m.name,
        dosage: m.dosage,
        duration: m.duration,
        instructions: m.instructions
      }));

      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: roomId,
          doctor_id: appointment.doctor_id,
          patient_id: appointment.patient_id,
          diagnosis: "Consultation Prescription",
          medications: medicationsFormatted,
          instructions: clinicalNotes
        })
      });

      if (!res.ok) throw new Error("Failed to send prescription");
      
      toast.success("Prescription sent successfully!");
      toast.success("Saved to patient's medical records");
      setMedicines([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to send prescription.");
    } finally {
      setSendingPrescription(false);
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

  const apptStatus = appointment.status;
  const isPendingStatus = apptStatus === 'pending';
  const isDeclinedStatus = apptStatus === 'declined' || apptStatus === 'cancelled' || apptStatus === 'rejected';
  const backLink = isDoctor ? '/doctor/dashboard' : '/patient/dashboard';
  const backLabel = isDoctor ? 'Back to Doctor Dashboard' : 'Back to Patient Dashboard';

  if (isPendingStatus) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Consultation Not Yet Approved</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-2">
          This consultation request is still awaiting the doctor&apos;s approval.
        </p>
        <p className="text-xs text-slate-500 max-w-sm">
          Once the doctor approves your request, the video consultation will become available.
        </p>
        <Link href={backLink} className="mt-8 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition border border-slate-700">
          {backLabel}
        </Link>
      </div>
    );
  }

  if (isDeclinedStatus) {
    const declineReason = appointment.reason_notes || 'The doctor was unable to accept this consultation request at the requested time.';
    return (
      <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/40 flex items-center justify-center mb-6">
          <X className="w-8 h-8 text-rose-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Consultation Request Declined</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-4">
          The doctor has declined this consultation request.
        </p>
        <div className="max-w-md w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-left mb-2">
          <p className="text-[11px] uppercase font-semibold text-rose-400 mb-1.5">Decline Reason</p>
          <p className="text-xs text-slate-300 leading-relaxed">{declineReason}</p>
        </div>
        <Link href={backLink} className="mt-6 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition border border-slate-700">
          {backLabel}
        </Link>
      </div>
    );
  }

  // --- RENDER PATIENT WAITING ROOM FLOWS ---
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

    // B. Admitted but not yet clicked Join
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
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer animate-pulse"
            >
              Join Consultation
            </button>
          </div>
        </div>
      );
    }

    // C. Not Joined Waiting room Yet (Doctor Ready banner)
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

  // --- RENDER CLINICAL ROOM LAYOUT (TOP/BOTTOM SPLIT) ---
  const patientName = appointment.patient?.name || appointment.patient_name || 'Suman Suri';
  const age = appointment.patient?.age || '32';
  const gender = appointment.patient?.gender || 'Female';
  const complaint = appointment.reason || 'General Consultation';
  const date = appointment.scheduled_date || appointment.appointment_date || '2026-08-17';
  const time = appointment.scheduled_time || appointment.time_slot || '12:00 PM';

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans overflow-y-auto">
      {/* Audio render tag */}
      <audio ref={audioRef} autoPlay />

      {/* Header */}
      <header className="px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleEndCall}
            className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5 cursor-pointer"
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

      {/* TOP SECTION: Video consultation area */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-10 gap-4">
        
        {/* Left Area (70%): Large Video & Draggable Preview */}
        <div 
          ref={containerRef}
          className="lg:col-span-7 h-[420px] bg-slate-955 rounded-2xl border border-slate-800/80 relative overflow-hidden flex items-center justify-center shadow-2xl"
        >
          {/* Main Large Video: Remote Participant Track */}
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-slate-600 mb-2" />
              <span className="text-xs">Waiting for participant video track...</span>
            </div>
          )}

          {/* Draggable self preview Picture-in-Picture card */}
          <div
            ref={dragRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            style={{
              right: `${position.x}px`,
              bottom: `${position.y}px`
            }}
            className="absolute w-32 h-44 md:w-36 md:h-48 rounded-xl border border-slate-700 bg-slate-900/90 shadow-2xl overflow-hidden cursor-move z-50 transition-shadow select-none hover:shadow-emerald-500/20"
          >
            {isVideoOff ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-950/80 text-slate-600 text-[10px]">
                <User className="w-5 h-5 text-slate-500" />
                <span>Camera off</span>
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
            )}
          </div>

          {/* Call Controls Bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/95 backdrop-blur-xl px-6 py-2 rounded-full border border-slate-700/80 shadow-2xl z-40">
            <button
              onClick={toggleMic}
              className={`p-2.5 rounded-full transition-all cursor-pointer ${
                isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-2.5 rounded-full transition-all cursor-pointer ${
                isVideoOff ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </button>
            <button
              onClick={handleEndCall}
              className="p-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/50 transition-all cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Area (30%): Patient Details & Queue (Doctor Only) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Patient Admission Queue */}
          {isDoctor && appointment.is_patient_waiting && (
            <div className="bg-[#111927]/95 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-pulse space-y-3">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> Patient Waiting
              </h3>
              <p className="text-[11px] text-slate-300">
                <strong>{patientName}</strong> is requesting entry to the room.
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

          {/* Patient Info Card */}
          {isDoctor && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex-1 backdrop-blur-md">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                <User className="w-4 h-4" /> Patient Details
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
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-955 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-slate-500 text-[10px] block">Date</span>
                    <span className="font-semibold text-slate-200">{date}</span>
                  </div>
                  <div className="bg-slate-955 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-slate-500 text-[10px] block">Time</span>
                    <span className="font-semibold text-slate-200">{time}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Reason for Visit</span>
                  <p className="mt-1 p-2.5 rounded-lg bg-slate-955 border border-slate-800 text-slate-300 text-xs leading-relaxed max-h-24 overflow-y-auto">
                    {complaint}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM SECTION: Splits Left/Right (Clinical Notes & Prescription - Doctor Only) */}
      {isDoctor && (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 border-t border-slate-800/80 bg-slate-950/40">
          
          {/* Left Block: Clinical Notes */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col backdrop-blur-md">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4" /> Clinical Notes
              </h3>
              {saveStatus === 'saving' && (
                <span className="text-[10px] text-slate-500 animate-pulse flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
            <textarea
              placeholder="Record symptoms observations, advice, or diagnosis notes here..."
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              className="flex-1 w-full bg-slate-955 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 resize-none min-h-[160px]"
            />
          </div>

          {/* Right Block: Prescription Management */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col backdrop-blur-md space-y-4">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" /> Prescription system
            </h3>

            {/* Medicine Add Fields */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 block">Medicine</label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol 500mg"
                  value={medInput.name}
                  onChange={(e) => setMedInput({ ...medInput, name: e.target.value })}
                  className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 block">Dosage</label>
                <input
                  type="text"
                  placeholder="e.g. 1 tablet"
                  value={medInput.dosage}
                  onChange={(e) => setMedInput({ ...medInput, dosage: e.target.value })}
                  className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 block">Duration</label>
                <input
                  type="text"
                  placeholder="e.g. 5 days"
                  value={medInput.duration}
                  onChange={(e) => setMedInput({ ...medInput, duration: e.target.value })}
                  className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 block">Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Twice daily after food"
                  value={medInput.instructions}
                  onChange={(e) => setMedInput({ ...medInput, instructions: e.target.value })}
                  className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              onClick={handleAddMedicine}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700/80"
            >
              <Plus className="w-4 h-4" /> Add Medicine
            </button>

            {/* Medicines List Preview */}
            {medicines.length > 0 && (
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-955 max-h-36 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-slate-500 text-[10px] uppercase">
                    <tr>
                      <th className="p-2">Medicine</th>
                      <th className="p-2">Dosage</th>
                      <th className="p-2">Duration</th>
                      <th className="p-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {medicines.map((m, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-medium">{m.name}</td>
                        <td className="p-2">{m.dosage}</td>
                        <td className="p-2">{m.duration}</td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() => handleRemoveMedicine(idx)}
                            className="p-1 text-rose-400 hover:bg-rose-950/60 rounded cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              onClick={handleSendPrescription}
              disabled={sendingPrescription || medicines.length === 0}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              {sendingPrescription ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" /> Sending Prescription...
                </span>
              ) : "Send Prescription"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
