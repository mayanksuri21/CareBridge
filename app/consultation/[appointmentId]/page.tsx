"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mic, MicOff, Video, VideoOff, PhoneOff, User, Activity } from 'lucide-react';
import Link from 'next/link';

export default function ConsultationRoom() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.appointmentId || params?.id) as string;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [patientData, setPatientData] = useState({
    name: 'Suman Suri',
    age: '32',
    gender: 'Female',
    complaint: 'Fever and headache from last 3 days',
    status: 'in_progress'
  });

  // 1. Fetch real appointment data
  useEffect(() => {
    async function loadData() {
      if (!roomId) return;
      try {
        const res = await fetch(`/api/appointments/call?appointment_id=${roomId}`);
        const json = await res.json();
        if (json?.appointment) {
          const appt = json.appointment;
          setPatientData({
            name: appt.patient_name || appt.patient_email?.split('@')[0] || 'Suman Suri',
            age: appt.patient_age || '32',
            gender: appt.patient_gender || 'Female',
            complaint: appt.reason || appt.symptoms || 'Fever and headache from last 3 days',
            status: appt.status || 'in_progress'
          });
        }
      } catch (err) {
        console.error("Room fetch error:", err);
      }
    }
    loadData();
  }, [roomId]);

  // 2. Camera Mount
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
      .then((s) => {
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch((e) => console.warn("Camera permission prompt/error:", e));

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
    router.push('/patient/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/patient/dashboard">
            <button className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition">
              ← Leave Room
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-sm font-bold text-slate-100">Live Clinical Consultation</h1>
          </div>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-3 py-1 rounded-full">
          Room ID: {roomId?.slice(0, 8)}...
        </span>
      </header>

      {/* Grid */}
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-65px)] overflow-hidden">
        
        {/* Main Video View */}
        <div className="lg:col-span-3 bg-slate-950/90 rounded-2xl border border-slate-800/80 relative overflow-hidden flex items-center justify-center shadow-2xl">
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
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/90 backdrop-blur-xl px-6 py-2.5 rounded-full border border-slate-700/80 shadow-2xl">
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
          {/* Patient Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 backdrop-blur-md">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <User className="w-4 h-4" /> Patient File
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 text-[10px] block uppercase">Patient Name</span>
                <span className="font-semibold text-slate-100 text-sm">{patientData.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                  <span className="text-slate-500 text-[10px] block">Age</span>
                  <span className="font-semibold text-slate-200">{patientData.age} yrs</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                  <span className="text-slate-500 text-[10px] block">Gender</span>
                  <span className="font-semibold text-slate-200">{patientData.gender}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block uppercase">Chief Complaint</span>
                <p className="mt-1 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 text-xs">
                  {patientData.complaint}
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
              className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
