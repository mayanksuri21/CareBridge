"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, User, Activity, Loader2,
  Check, X, LogOut, ShieldAlert, FileText, Plus, Trash, AlertCircle,
  Clock, Calendar, Sparkles, Edit3, ExternalLink, XCircle
} from 'lucide-react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import { Room, RoomEvent, Track } from "livekit-client";

type MedicineInput = {
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
};

export default function ConsultationRoom() {
  const { user: authUser, session: authSession, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const isTypingNotesRef = useRef(false);
  const lastSavedNotesRef = useRef<string>('');
  const latestNotesRef = useRef<string>('');
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingNotesRef = useRef<boolean>(false);
  const appointmentRef = useRef<any>(null);

  // Robust appointment ID extraction across Next.js App Router param variants
  const rawAppointmentId = (params?.appointmentId || params?.id) as string | string[] | undefined;
  // Fail-safe appointment ID extraction
  const appointmentId = useMemo(() => {
    const raw = (params?.appointmentId || params?.id) as any;
    if (typeof raw === 'string' && raw) return raw;
    if (Array.isArray(raw) && raw[0]) return raw[0];
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/');
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart !== 'consultation') return lastPart;
    }
    return '';
  }, [params]);

  const roomId = appointmentId || (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '');
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // WebRTC Stream Elements Refs
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Local media stream reference
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Controlled LiveKit Room Instance & Connection Tracking Refs
  const roomRef = useRef<Room | null>(null);
  const isConnectingRef = useRef(false);
  const connectedRoomIdRef = useRef<string | null>(null);
  const isFetchingTokenRef = useRef(false);
  const tokenFetchFailedRef = useRef(false);
  const fetchedRoomIdRef = useRef<string | null>(null);

  // DRAGGABLE PIP PREVIEW COORDINATES
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragPosStart = useRef({ x: 0, y: 0 });

  // WebRTC Tracks States
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingAppt, setLoadingAppt] = useState(true);
  const [admittingId, setAdmittingId] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [patientJoinClicked, setPatientJoinClicked] = useState(false);

  // Clinical Notes & Prescriptions State
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle' | 'error'>('idle');

  useEffect(() => {
    appointmentRef.current = appointment;
  }, [appointment]);

  const [medicines, setMedicines] = useState<MedicineInput[]>([]);
  const [medInput, setMedInput] = useState<MedicineInput>({ name: '', dosage: '', duration: '', instructions: '' });
  const [sendingPrescription, setSendingPrescription] = useState(false);
  const [consultationPrescription, setConsultationPrescription] = useState<any>(null);
  const [isEditingPrescription, setIsEditingPrescription] = useState(false);

  // Real-time prescription sync during active consultation
  const fetchConsultationPrescription = useCallback(async () => {
    if (!roomId || roomId === 'consultation') return;
    try {
      const res = await fetch(`/api/prescriptions?appointment_id=${roomId}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.prescription) {
          setConsultationPrescription(data.prescription);
        }
      }
    } catch (err) {
      console.warn("Could not fetch consultation prescription:", err);
    }
  }, [roomId]);

  useEffect(() => {
    fetchConsultationPrescription();
    const interval = setInterval(fetchConsultationPrescription, 4000);
    return () => clearInterval(interval);
  }, [fetchConsultationPrescription]);

  // Leave vs End Call Modal State (Google Meet style for Doctor)
  const [showDoctorEndModal, setShowDoctorEndModal] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);

  // Helper to normalize appointment tags into structured properties
  const normalizeAppointment = useCallback((appt: any) => {
    if (!appt) return null;
    const reasonStr = appt.reason || appt.raw_reason || '';
    const isDoctorInRoom = reasonStr.includes('[DOCTOR_IN_ROOM]') || Boolean(appt.is_doctor_in_room);
    const isPatientWaiting = reasonStr.includes('[PATIENT_WAITING]') || Boolean(appt.is_patient_waiting);
    const isPatientAdmitted = reasonStr.includes('[PATIENT_ADMITTED]') || Boolean(appt.is_patient_admitted);
    const isPatientDeclined = reasonStr.includes('[PATIENT_DECLINED]') || Boolean(appt.is_patient_declined);
    const isCallActive = reasonStr.includes('[CALL_ACTIVE]') || Boolean(appt.call_active);

    let cleanReason = reasonStr;
    ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]'].forEach(tag => {
      cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '');
    });

    return {
      ...appt,
      id: appt.id,
      appointment_id: appt.id,
      roomId: appt.id,
      reason: cleanReason,
      raw_reason: reasonStr,
      is_doctor_in_room: appt.status !== 'completed' && isDoctorInRoom,
      is_patient_waiting: appt.status !== 'completed' && isPatientWaiting,
      is_patient_admitted: appt.status !== 'completed' && isPatientAdmitted,
      is_patient_declined: isPatientDeclined,
      call_active: appt.status !== 'completed' && (isCallActive || isDoctorInRoom || isPatientWaiting || isPatientAdmitted || appt.status === 'in_progress')
    };
  }, []);

  // 1. Fetch current user and profile role with AuthProvider sync
  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);
      if (authUser.user_metadata?.role === 'doctor') {
        setUserRole('doctor');
      }
    }
  }, [authUser]);

  useEffect(() => {
    async function fetchUserAndRole() {
      try {
        const user = authUser || (await supabase.auth.getUser()).data?.user;
        if (user) {
          setCurrentUser(user);

          // Authoritative profile role query
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          let role = profile?.role || (user.user_metadata?.role as string) || null;

          if (role !== 'doctor') {
            const { data: docApp } = await supabase
              .from("doctor_verification_applications")
              .select("status")
              .eq("doctor_id", user.id)
              .maybeSingle();
            if (docApp) role = 'doctor';
          }
          setUserRole(role);
        }
      } catch (err) {
        console.warn("Could not fetch user/role in consultation room:", err);
      } finally {
        setLoadingUser(false);
      }
    }
    if (!authLoading) {
      fetchUserAndRole();
    }
  }, [supabase, authUser, authLoading]);

  // Safety timeout: Ensure loading screen never hangs indefinitely
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingUser(false);
      setLoadingAppt(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  // 2. Fetch appointment data with Supabase join and robust API fallbacks
  const loadAppointment = useCallback(async (retryCount = 0) => {
    const effectiveId = appointmentId || (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() : '');

    if (!effectiveId || effectiveId === 'consultation') {
      if (retryCount < 5) {
        setTimeout(() => loadAppointment(retryCount + 1), 300);
      } else {
        setLoadingAppt(false);
      }
      return;
    }

    try {
      let apptData: any = null;

      // 1. PRIMARY: Query service role admin API first (Bypasses Supabase RLS for Patient)
      try {
        const apiRes = await fetch(`/api/appointments/call?appointment_id=${effectiveId}`, {
          cache: 'no-store'
        });
        if (apiRes.ok) {
          const apiJson = await apiRes.json();
          if (apiJson?.appointment) {
            apptData = apiJson.appointment;
          }
        }
      } catch (apiErr) {
        console.warn("Primary call API fetch error:", apiErr);
      }

      // 2. SECONDARY: Fallback to direct Supabase query if API didn't return data
      if (!apptData) {
        try {
          const { data: simpleData } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', effectiveId)
            .maybeSingle();

          if (simpleData) {
            apptData = simpleData;
          }
        } catch (dbErr) {
          console.error("Supabase direct fetch error:", dbErr);
        }
      }

      // 3. TERTIARY: Details API fallback
      if (!apptData) {
        try {
          const detRes = await fetch(`/api/appointments/details?id=${effectiveId}`, {
            cache: 'no-store'
          });
          if (detRes.ok) {
            const detJson = await detRes.json();
            if (detJson?.appointment) {
              apptData = detJson.appointment;
            }
          }
        } catch (detErr) {
          console.warn("Details API fetch error:", detErr);
        }
      }

      // Apply fetched appointment data
      if (apptData) {
        const normalized = typeof normalizeAppointment === 'function' ? normalizeAppointment(apptData) : apptData;
        setAppointment((prev: any) => ({ ...prev, ...normalized }));

        // Load clinical notes without overwriting while typing
        const notesMatch = (apptData.reason || apptData.raw_reason)?.match(/\[CLINICAL_NOTES\]:\s*([\s\S]*)/i);
        const notesVal = notesMatch ? notesMatch[1].trim() : '';
        if (notesVal && !isTypingNotesRef.current) {
          setClinicalNotes((prev) => {
            if (prev && prev.trim() !== '') return prev;
            lastSavedNotesRef.current = notesVal;
            latestNotesRef.current = notesVal;
            return notesVal;
          });
        }
        setLoadingAppt(false);
        return;
      }

      // Retry if not fetched yet
      if (retryCount < 3) {
        setTimeout(() => loadAppointment(retryCount + 1), 600);
        return;
      }
    } catch (err) {
      console.error("Room fetch error:", err);
    } finally {
      if (retryCount >= 3) {
        setLoadingAppt(false);
      }
    }
  }, [appointmentId, supabase, normalizeAppointment]);

  // 3. Polling fallback + Realtime listener to sync state changes immediately
  useEffect(() => {
    loadAppointment(0);
    const interval = setInterval(() => loadAppointment(0), 3000);

    const channel = supabase
      .channel(`consultation-room-${appointmentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `id=eq.${appointmentId}`,
        },
        () => {
          loadAppointment(0);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [appointmentId, supabase, loadAppointment]);

  // Determine user role and call view eligibility
  const isDoctorById = Boolean(
    currentUser &&
    appointment &&
    (
      (appointment.doctor_id && currentUser.id === appointment.doctor_id) ||
      (appointment.doctor?.email && currentUser.email === appointment.doctor.email)
    )
  );
  const hasUserSession = Boolean(currentUser || authUser);
  const isDoctorRole =
    userRole === 'doctor' ||
    currentUser?.user_metadata?.role === 'doctor' ||
    currentUser?.role === 'doctor' ||
    authUser?.user_metadata?.role === 'doctor' ||
    (typeof window !== 'undefined' && hasUserSession && (
      document.referrer.includes('/doctor') ||
      window.location.search.includes('role=doctor') ||
      window.location.pathname.includes('/doctor')
    ));

  // The logged-in user is a Doctor if their ID matches appointment.doctor_id OR their profile/metadata role is 'doctor'
  const isDoctor = Boolean(isDoctorById || isDoctorRole);

  // The user is ONLY a Patient if they are NOT a doctor
  const isPatientById = Boolean(
    currentUser &&
    appointment &&
    appointment.patient_id &&
    currentUser.id === appointment.patient_id
  );
  const isPatientRole = userRole === 'patient' || currentUser?.user_metadata?.role === 'patient';
  const isPatient = !isDoctor && Boolean(isPatientById || isPatientRole);
  // Safe Debug Log (Placed after both isDoctor and isPatient are declared)
  console.log("DEBUG ROLES:", {
    currentUserId: currentUser?.id,
    currentUserRole: userRole,
    currentUserMetaRole: currentUser?.user_metadata?.role,
    appointmentDoctorId: appointment?.doctor_id,
    appointmentPatientId: appointment?.patient_id,
    isDoctor,
    isPatient,
    appointmentStatus: appointment?.status,
    isPatientAdmitted: appointment?.is_patient_admitted
  });

  // Ensure that for authenticated Doctor, loading state unblocks cleanly
  useEffect(() => {
    if (isDoctor && !authLoading) {
      setLoadingUser(false);
      if (appointment) {
        setLoadingAppt(false);
      }
    }
  }, [isDoctor, appointment, authLoading]);

  const loading = (authLoading && !currentUser) || (loadingUser && !currentUser) || loadingAppt;

  // The call view is immediately visible for the doctor, or for an admitted / in_progress patient who clicked join
  const isAdmittedOrActive = Boolean(appointment?.is_patient_admitted || appointment?.status === 'in_progress');
  const showCallView = isDoctor || (isPatient && isAdmittedOrActive && patientJoinClicked);

  // Auto-set patientJoinClicked if patient rejoins an in-progress consultation
  useEffect(() => {
    if (isPatient && (appointment?.status === 'in_progress' || appointment?.is_patient_admitted) && !patientJoinClicked) {
      setPatientJoinClicked(true);
    }
  }, [isPatient, appointment?.status, appointment?.is_patient_admitted, patientJoinClicked]);

  // 4. Fetch LiveKit Token for authorized users (Controlled, single fetch, no infinite loop)
  useEffect(() => {
    const exactRoomId = String(appointment?.id || appointmentId || '').trim().replace(/\s+/g, '-');
    if (!exactRoomId || exactRoomId === 'consultation') return;

    // Reset token if appointment room changed
    if (fetchedRoomIdRef.current && fetchedRoomIdRef.current !== exactRoomId) {
      console.log("[LiveKit] Room changed from", fetchedRoomIdRef.current, "to", exactRoomId, "- resetting token");
      setToken(null);
      fetchedRoomIdRef.current = null;
      tokenFetchFailedRef.current = false;
      isFetchingTokenRef.current = false;
    }

    if (!appointment || token || appointment.status === 'completed' || appointment.status === 'missed') return;
    if (isFetchingTokenRef.current || tokenFetchFailedRef.current) return;

    // CRITICAL: Do NOT request token while auth is still INITIAL_SESSION / no session
    if (authLoading) return;
    if (!authSession || !(authUser || currentUser)) {
      // Unauthenticated state: do not spam /token with 401
      return;
    }

    const isAdmittedOrActive = Boolean(
      appointment?.is_patient_admitted ||
      appointment?.status === 'in_progress' ||
      appointment?.status === 'scheduled'
    );

    const shouldConnect = Boolean(isDoctor || isAdmittedOrActive || showCallView || patientJoinClicked);
    if (!shouldConnect) return;

    isFetchingTokenRef.current = true;
    console.log("[LiveKit] Joining exact room:", exactRoomId);

    const fetchLiveKitToken = async () => {
      try {
        const accessToken = authSession?.access_token;
        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify({
            roomName: exactRoomId,
            participantName: (authUser || currentUser)?.user_metadata?.full_name || (authUser || currentUser)?.email || (isDoctor ? 'Doctor' : 'Patient')
          })
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          const errorMsg = errJson.error || `HTTP ${res.status}`;
          if (res.status === 401 || res.status === 403) {
            tokenFetchFailedRef.current = true;
            console.error("[LiveKit] Token auth error (stopping retries):", errorMsg);
            if (res.status === 401) {
              toast.error("Authentication session expired. Please log in again.");
            }
          }
          throw new Error(errorMsg);
        }

        const data = await res.json();
        if (data.token) {
          console.log("[LiveKit] Token obtained successfully for room:", exactRoomId);
          fetchedRoomIdRef.current = exactRoomId;
          setToken(data.token);
        }
      } catch (err: any) {
        console.warn("[LiveKit] Token fetch failed:", err.message);
      } finally {
        isFetchingTokenRef.current = false;
      }
    };

    fetchLiveKitToken();
  }, [appointment, token, appointmentId, isDoctor, showCallView, patientJoinClicked, authLoading, authSession, authUser, currentUser]);

  // 5. Camera & Microphone Media Stream Initialization (Single Hardware Access)
  useEffect(() => {
    if (!showCallView || appointment?.status === 'completed' || appointment?.status === 'missed') return;

    let activeStream: MediaStream | null = null;
    let isCancelled = false;

    async function initLocalMedia() {
      console.log("[WebRTC] [LocalMedia] Initializing camera & microphone for room:", appointmentId);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: true,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        activeStream = stream;
        localStreamRef.current = stream;
        setLocalStream(stream);

        console.log("[WebRTC] [LocalMedia] Acquired physical camera + microphone. Tracks:", stream.getTracks().map(t => `${t.kind}:${t.id}`));

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(() => { });
        }
      } catch (mediaErr: any) {
        console.warn("[WebRTC] Physical camera acquisition error (e.g. device in use by another tab):", mediaErr.name, mediaErr.message);

        // Fallback: Try audio-only first, and create an animated canvas simulated video track so WebRTC pipeline never fails
        let audioTrack: MediaStreamTrack | null = null;
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          audioTrack = audioOnly.getAudioTracks()[0] || null;
        } catch (aErr) {
          console.warn("[WebRTC] Audio fallback also unavailable:", aErr);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        let frame = 0;
        const renderFrame = () => {
          if (!ctx) return;
          frame++;
          ctx.fillStyle = '#0a0f1d';
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(320, 220, 65 + Math.sin(frame * 0.1) * 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(isDoctor ? 'Doctor Live Video' : 'Patient Live Video', 320, 340);
          ctx.font = '14px system-ui, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('CareBridge Active Feed', 320, 370);
        };
        const animInterval = setInterval(renderFrame, 66);
        const canvasStream = canvas.captureStream(15);
        const canvasVideoTrack = canvasStream.getVideoTracks()[0];

        const tracks: MediaStreamTrack[] = [];
        if (canvasVideoTrack) tracks.push(canvasVideoTrack);
        if (audioTrack) tracks.push(audioTrack);

        const fallbackStream = new MediaStream(tracks);
        if (isCancelled) {
          clearInterval(animInterval);
          tracks.forEach(t => t.stop());
          return;
        }

        activeStream = fallbackStream;
        localStreamRef.current = fallbackStream;
        setLocalStream(fallbackStream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = fallbackStream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(() => { });
        }
        console.log("[WebRTC] [LocalMedia] Initialized resilient fallback stream. Tracks:", fallbackStream.getTracks().map(t => `${t.kind}:${t.id}`));
      }
    }

    initLocalMedia();

    return () => {
      isCancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    };
  }, [showCallView, isDoctor, appointmentId]);

  // Keep local video element synced if ref or stream updates
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(() => { });
      }
    }
  }, [localStream]);

  // 6. WebRTC / LiveKit Room Connection & Track Management
  useEffect(() => {
    if (!showCallView || !token) return;

    const exactRoomId = String(appointment?.id || appointmentId || '').trim().replace(/\s+/g, '-');
    if (!exactRoomId) return;

    let isCancelled = false;

    // Resilient helper to mount remote tracks with instant autoplay
    const attachRemoteTrack = (trackOrPub: any, participant?: any) => {
      if (!trackOrPub) return;
      const track = trackOrPub.track || trackOrPub;
      if (!track) return;
      const kind = (track.kind || trackOrPub.kind || '').toString().toLowerCase();

      if (kind === 'video') {
        console.log("[WebRTC] [RemoteTrack] Attaching remote video track from:", participant?.identity);
        const tryAttachVideo = (attemptsLeft = 12) => {
          const el = remoteVideoRef.current || (document.getElementById('remote-video') as HTMLVideoElement);
          if (el) {
            try {
              track.attach(el);
              el.muted = true; // Video element MUST remain muted to guarantee instant browser autoplay
              el.playsInline = true;
              el.play().catch((err: any) => console.warn("[WebRTC] Remote video play notice:", err));
              setHasRemoteVideo(true);
              console.log("[WebRTC] [RemoteVideo] Attached successfully to remote-video element");
            } catch (err) {
              console.error("[WebRTC] Error attaching remote video track:", err);
            }
          } else if (attemptsLeft > 0) {
            setTimeout(() => tryAttachVideo(attemptsLeft - 1), 150);
          }
        };
        tryAttachVideo();
      } else if (kind === 'audio') {
        console.log("[WebRTC] [RemoteTrack] Attaching remote audio track from:", participant?.identity);
        try {
          const participantId = participant?.identity || participant?.sid || 'remote';
          const audioId = `remote-audio-${participantId}`;
          const existingAudio = document.getElementById(audioId);
          if (existingAudio) existingAudio.remove();

          const audioEl = track.attach();
          audioEl.id = audioId;
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
          const playPromise = audioEl.play();
          if (playPromise !== undefined) {
            playPromise.catch((err: any) => {
              console.warn("[WebRTC] Remote audio autoplay blocked by browser policy, waiting for user interaction:", err);
              const resumeAudio = () => {
                audioEl.play().catch(() => {});
                window.removeEventListener('click', resumeAudio);
                window.removeEventListener('keydown', resumeAudio);
              };
              window.addEventListener('click', resumeAudio, { once: true });
              window.addEventListener('keydown', resumeAudio, { once: true });
            });
          }
        } catch (audioErr) {
          console.error("[WebRTC] Error attaching remote audio track:", audioErr);
        }
      }
    };

    // Scan all remote participants and attach tracks
    const syncRemoteTracks = (targetRoom?: Room) => {
      const activeRoom = targetRoom || roomRef.current;
      if (!activeRoom) return;
      let foundVideo = false;
      activeRoom.remoteParticipants.forEach((participant) => {
        console.log("[WebRTC] [Sync] Scanning remote participant:", participant.identity);
        participant.trackPublications.forEach((pub: any) => {
          if (pub.isSubscribed && pub.track) {
            attachRemoteTrack(pub.track, participant);
            if (pub.kind === 'video' && !pub.isMuted) foundVideo = true;
          } else if (typeof pub.setSubscribed === 'function') {
            pub.setSubscribed(true);
          }
        });
      });
      if (foundVideo) {
        setHasRemoteVideo(true);
      }
    };

    // Check if any active remote video tracks remain before clearing display
    const checkRemainingRemoteVideo = () => {
      const activeRoom = roomRef.current;
      if (!activeRoom) {
        setHasRemoteVideo(false);
        return;
      }
      let hasActiveVideo = false;
      activeRoom.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub: any) => {
          if (pub.kind === 'video' && pub.isSubscribed && pub.track && !pub.isMuted) {
            hasActiveVideo = true;
            attachRemoteTrack(pub.track, p);
          }
        });
      });
      setHasRemoteVideo(hasActiveVideo);
    };

    const onTrackSubscribed = (track: any, publication: any, participant: any) => {
      console.log("[WebRTC] [TrackSubscribed]:", track?.kind, "from", participant?.identity);
      attachRemoteTrack(track, participant);
    };

    const onTrackPublished = (publication: any, participant: any) => {
      console.log("[WebRTC] [TrackPublished]:", publication?.kind, "from", participant?.identity);
      if (typeof publication.setSubscribed === 'function') {
        publication.setSubscribed(true);
      }
      if (publication.track) {
        attachRemoteTrack(publication.track, participant);
      }
    };

    const onTrackUnsubscribed = (track: any) => {
      console.log("[WebRTC] [TrackUnsubscribed]:", track?.kind);
      try { track.detach(); } catch (_) { }
      if (track?.kind === 'audio') {
        const audioEl = document.getElementById(`remote-audio-${track.sid}`);
        if (audioEl) audioEl.remove();
      }
      checkRemainingRemoteVideo();
    };

    const onTrackMuted = (publication: any, participant: any) => {
      console.log("[WebRTC] [TrackMuted]:", publication?.kind, "from", participant?.identity);
      if (publication?.kind === 'video') {
        checkRemainingRemoteVideo();
      }
    };

    const onTrackUnmuted = (publication: any, participant: any) => {
      console.log("[WebRTC] [TrackUnmuted]:", publication?.kind, "from", participant?.identity);
      if (publication?.kind === 'video' && publication.track) {
        attachRemoteTrack(publication.track, participant);
      }
    };

    const onParticipantConnected = (participant: any) => {
      console.log("[WebRTC] [ParticipantConnected]:", participant?.identity);
      syncRemoteTracks();
    };

    const onParticipantDisconnected = (participant: any) => {
      console.log("[WebRTC] [ParticipantDisconnected]:", participant?.identity);
      checkRemainingRemoteVideo();
    };

    const onDataReceived = (payload: Uint8Array, participant?: any) => {
      try {
        const decoder = new TextDecoder();
        const str = decoder.decode(payload);
        const msg = JSON.parse(str);
        if (msg?.type === 'MEETING_ENDED' || msg?.type === 'CALL_ENDED') {
          toast.info("Doctor has ended the consultation.");
          handlePatientLeave();
        }
      } catch (err) {
        console.warn("LiveKit DataReceived error:", err);
      }
    };

    async function connectRoom() {
      const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!token || !livekitUrl) return;

      if (isConnectingRef.current) return;

      // Clean up previous room if it was for a different appointment
      if (roomRef.current && connectedRoomIdRef.current && connectedRoomIdRef.current !== exactRoomId) {
        console.log("[WebRTC] Disconnecting previous room:", connectedRoomIdRef.current);
        try {
          roomRef.current.removeAllListeners();
          roomRef.current.disconnect();
        } catch (_) {}
        roomRef.current = null;
        connectedRoomIdRef.current = null;
      }

      // If already connected to this exact room, sync tracks and exit
      if (roomRef.current && roomRef.current.state === 'connected' && connectedRoomIdRef.current === exactRoomId) {
        syncRemoteTracks(roomRef.current);
        return;
      }

      if (!roomRef.current) {
        roomRef.current = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
      }

      const currentRoom = roomRef.current;

      // Attach event listeners cleanly without duplication
      currentRoom.removeAllListeners();
      currentRoom.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      currentRoom.on(RoomEvent.TrackPublished, onTrackPublished);
      currentRoom.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      currentRoom.on(RoomEvent.TrackMuted, onTrackMuted);
      currentRoom.on(RoomEvent.TrackUnmuted, onTrackUnmuted);
      currentRoom.on(RoomEvent.ParticipantConnected, onParticipantConnected);
      currentRoom.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      currentRoom.on(RoomEvent.DataReceived, onDataReceived);

      isConnectingRef.current = true;
      console.log("[WebRTC] Connecting to LiveKit room:", exactRoomId);

      try {
        await currentRoom.connect(livekitUrl, token, { autoSubscribe: true });
        if (isCancelled) {
          currentRoom.disconnect();
          return;
        }

        connectedRoomIdRef.current = exactRoomId;
        console.log("[WebRTC] Connected successfully. Room state:", currentRoom.state);

        // WebRTC PeerConnection diagnostic hooks
        try {
          const anyEngine = (currentRoom as any).engine;
          const pubPc: RTCPeerConnection | undefined = anyEngine?.publisher?.pc;
          const subPc: RTCPeerConnection | undefined = anyEngine?.subscriber?.pc;
          [
            { pc: pubPc, name: 'Publisher' },
            { pc: subPc, name: 'Subscriber' }
          ].forEach(({ pc, name }) => {
            if (!pc) return;
            console.log(`[WebRTC] [PeerConnection] ${name} RTCPeerConnection initialized`);
            pc.addEventListener('connectionstatechange', () => {
              console.log(`[WebRTC] [PeerConnection] ${name} connection state:`, pc.connectionState);
            });
            pc.addEventListener('iceconnectionstatechange', () => {
              console.log(`[WebRTC] [ICE] ${name} ICE connection state:`, pc.iceConnectionState);
            });
            pc.addEventListener('icecandidate', (e) => {
              if (e.candidate) {
                console.log(`[WebRTC] [ICE] ${name} candidate generated:`, e.candidate.protocol, e.candidate.type);
              }
            });
          });
        } catch (diagErr) {
          console.warn("[WebRTC] Diagnostic hook notice:", diagErr);
        }

        // Publish existing local tracks cleanly from localStreamRef
        if (currentRoom.localParticipant && localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          const audioTrack = localStreamRef.current.getAudioTracks()[0];

          if (videoTrack && !isVideoOff) {
            try {
              await currentRoom.localParticipant.publishTrack(videoTrack, {
                name: 'camera',
                source: Track.Source.Camera
              });
              console.log("[WebRTC] Published local video track to LiveKit");
            } catch (vErr) {
              console.warn("[WebRTC] Video track publish warning:", vErr);
            }
          }

          if (audioTrack && !isMuted) {
            try {
              await currentRoom.localParticipant.publishTrack(audioTrack, {
                name: 'microphone',
                source: Track.Source.Microphone
              });
              console.log("[WebRTC] Published local audio track to LiveKit");
            } catch (aErr) {
              console.warn("[WebRTC] Audio track publish warning:", aErr);
            }
          }
        }

        // Sync existing participants and tracks immediately & on staggered delays
        syncRemoteTracks(currentRoom);
        setTimeout(() => syncRemoteTracks(currentRoom), 300);
        setTimeout(() => syncRemoteTracks(currentRoom), 1000);
      } catch (connErr) {
        console.error("[WebRTC] Connection failure:", connErr);
      } finally {
        isConnectingRef.current = false;
      }
    }

    connectRoom();

    return () => {
      isCancelled = true;
    };
  }, [token, showCallView, appointmentId, isVideoOff, isMuted]);

  // Global room and media cleanup on appointment change or unmount
  useEffect(() => {
    return () => {
      console.log("[WebRTC] Room lifecycle cleanup for appointment:", appointmentId);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (roomRef.current) {
        try {
          roomRef.current.removeAllListeners();
          roomRef.current.disconnect();
        } catch (_) {}
        roomRef.current = null;
      }
      connectedRoomIdRef.current = null;
      isConnectingRef.current = false;
      document.querySelectorAll('[id^="remote-audio-"]').forEach((el) => el.remove());
    };
  }, [appointmentId]);

  // Handle tab closing or refreshing cleanly
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch (_) {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, []);

  // 8. Clinical Notes Debounced Autosave (Decoupled from appointment polling loop)
  useEffect(() => {
    latestNotesRef.current = clinicalNotes;

    if (!isDoctor || !roomId) return;

    // Do not save if notes match what is already known to be saved
    if (clinicalNotes === lastSavedNotesRef.current) {
      return;
    }

    // Clear any pending debounce timer
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }

    // Debounce save by 1200ms
    notesTimeoutRef.current = setTimeout(async () => {
      const noteToSave = latestNotesRef.current;
      if (noteToSave === lastSavedNotesRef.current || isSavingNotesRef.current) {
        return;
      }

      isSavingNotesRef.current = true;
      setSaveStatus('saving');

      try {
        const appt = appointmentRef.current;
        let cleanReason = appt?.reason || appt?.raw_reason || '';
        const notesIdx = cleanReason.indexOf('\n\n[CLINICAL_NOTES]:');
        if (notesIdx !== -1) {
          cleanReason = cleanReason.substring(0, notesIdx);
        }

        const newReason = `${cleanReason}\n\n[CLINICAL_NOTES]: ${noteToSave}`;

        const { error } = await supabase
          .from('appointments')
          .update({ reason: newReason })
          .eq('id', roomId);

        if (error) throw error;

        lastSavedNotesRef.current = noteToSave;
        if (latestNotesRef.current === noteToSave) {
          setSaveStatus('saved');
        }
      } catch (err) {
        console.error("Autosave notes failed:", err);
        setSaveStatus('error');
      } finally {
        isSavingNotesRef.current = false;
        // If doctor typed more while save was in-flight, return to idle so next debounce can save
        if (latestNotesRef.current !== lastSavedNotesRef.current) {
          setSaveStatus('idle');
        }
      }
    }, 1200);

    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }
    };
  }, [clinicalNotes, isDoctor, roomId, supabase]);

  // 9. Draggable self preview helpers (Touch & Mouse)
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
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMute;
      });
    }
    if (roomRef.current && roomRef.current.state === 'connected' && roomRef.current.localParticipant) {
      try {
        await roomRef.current.localParticipant.setMicrophoneEnabled(!nextMute);
      } catch (err) {
        console.warn("LiveKit mic toggle warning:", err);
      }
    }
  };

  const toggleVideo = async () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);

    // 1. Toggle local media track enabled state so hardware stays initialized
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !nextVideoOff;
      });
    }

    // 2. Toggle LiveKit native camera ONLY if engine is fully connected
    if (roomRef.current && roomRef.current.state === 'connected' && roomRef.current.localParticipant) {
      try {
        await roomRef.current.localParticipant.setCameraEnabled(!nextVideoOff);
      } catch (err) {
        console.warn("LiveKit camera toggle warning:", err);
      }
    }

    // 3. Ensure local video preview playback is re-attached and playing when toggled back ON
    if (!nextVideoOff && localVideoRef.current) {
      if (localStreamRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().catch(() => { });
    }
  };

  // Watch for appointment status becoming completed (concluded by doctor)
  useEffect(() => {
    if (appointment?.status === 'completed') {
      toast.info("This consultation has already concluded.");
      try {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }
      } catch (_) { }
      try {
        if (roomRef.current) {
          roomRef.current.removeAllListeners();
          roomRef.current.disconnect();
          roomRef.current = null;
        }
      } catch (_) { }
      connectedRoomIdRef.current = null;
      isConnectingRef.current = false;
      document.querySelectorAll('[id^="remote-audio-"]').forEach((el) => el.remove());
      const timer = setTimeout(() => {
        router.push(isDoctor ? '/doctor/dashboard' : '/patient/dashboard');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [appointment?.status, isDoctor, router]);

  // Patient Leave Call: Only disconnects room and stops local tracks. Does NOT end or complete the appointment in DB.
  const handlePatientLeave = async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (roomRef.current?.localParticipant) {
        for (const [, pub] of roomRef.current.localParticipant.videoTrackPublications) {
          if (pub.track) pub.track.stop();
        }
        for (const [, pub] of roomRef.current.localParticipant.audioTrackPublications) {
          if (pub.track) pub.track.stop();
        }
      }
      if (roomRef.current) {
        try {
          roomRef.current.removeAllListeners();
          await roomRef.current.disconnect();
        } catch (_) {}
        roomRef.current = null;
      }
    } catch (_) { }

    connectedRoomIdRef.current = null;
    isConnectingRef.current = false;
    fetchedRoomIdRef.current = null;
    document.querySelectorAll('[id^="remote-audio-"]').forEach((el) => el.remove());

    // Reset UI & Connection state completely
    setToken(null);
    setHasRemoteVideo(false);
    setPatientJoinClicked(false);

    toast.info("You left the consultation. You can rejoin anytime from your dashboard.");
    router.push('/patient/dashboard');
  };

  // Doctor Leave Room (temporary): Doctor disconnects without concluding appointment
  const handleDoctorLeave = async () => {
    setShowDoctorEndModal(false);
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (roomRef.current?.localParticipant) {
        for (const [, pub] of roomRef.current.localParticipant.videoTrackPublications) {
          if (pub.track) pub.track.stop();
        }
        for (const [, pub] of roomRef.current.localParticipant.audioTrackPublications) {
          if (pub.track) pub.track.stop();
        }
      }
      if (roomRef.current) {
        try {
          roomRef.current.removeAllListeners();
          await roomRef.current.disconnect();
        } catch (_) {}
        roomRef.current = null;
      }
    } catch (_) { }

    connectedRoomIdRef.current = null;
    isConnectingRef.current = false;
    fetchedRoomIdRef.current = null;
    document.querySelectorAll('[id^="remote-audio-"]').forEach((el) => el.remove());

    setToken(null);
    setHasRemoteVideo(false);

    toast.info("You left the consultation room. You can rejoin anytime from your dashboard.");
    router.push('/doctor/dashboard');
  };

  // Doctor End Consultation for All (Doctor Only): Broadcasts MEETING_ENDED, marks appointment completed in Supabase, disconnects room
  const handleDoctorEndForAll = async () => {
    setIsEndingCall(true);
    try {
      // 1. Broadcast MEETING_ENDED over LiveKit data channel to notify patient
      const activeRoom = roomRef.current;
      if (activeRoom && activeRoom.state === 'connected' && activeRoom.localParticipant) {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(JSON.stringify({ type: 'MEETING_ENDED' }));
          await activeRoom.localParticipant.publishData(data, { reliable: true });
        } catch (pubErr) {
          console.warn("Could not broadcast MEETING_ENDED:", pubErr);
        }
      }

      // 2. Mark appointment as completed in Database
      try {
        const cleanId = (roomId || appointment?.id || '').trim();
        await fetch('/api/appointments/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointment_id: cleanId, action: 'complete' }),
        });
      } catch (apiErr) {
        console.warn("Failed to update status via API, continuing exit:", apiErr);
      }

      // 3. Stop hardware tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (activeRoom?.localParticipant) {
        activeRoom.localParticipant.trackPublications.forEach((pub: any) => {
          if (pub.track) pub.track.stop();
        });
      }

      // 4. Disconnect LiveKit Room cleanly
      if (activeRoom) {
        try {
          activeRoom.removeAllListeners();
          await activeRoom.disconnect();
        } catch (_) {}
        roomRef.current = null;
      }

      connectedRoomIdRef.current = null;
      isConnectingRef.current = false;
      fetchedRoomIdRef.current = null;
      document.querySelectorAll('[id^="remote-audio-"]').forEach((el) => el.remove());

      toast.success("Consultation concluded successfully.");
      setShowDoctorEndModal(false);
      router.push('/doctor/dashboard');
    } catch (err) {
      console.error("Error ending consultation:", err);
      toast.error("Error concluding session, redirecting...");
      setShowDoctorEndModal(false);
      router.push('/doctor/dashboard');
    } finally {
      setIsEndingCall(false);
    }
  };
  // Main End/Leave click handler
  const handleEndCall = () => {
    if (isDoctor) {
      setShowDoctorEndModal(true);
    } else {
      handlePatientLeave();
    }
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
      toast.error("Please enter Medicine Name, Dosage, and Duration.");
      return;
    }
    setMedicines([...medicines, { ...medInput }]);
    setMedInput({ name: '', dosage: '', duration: '', instructions: '' });
  };

  const handleRemoveMedicine = (idx: number) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
  };

  const handleSaveAndFinalizePrescription = async () => {
    if (medicines.length === 0) {
      toast.error("Please add at least one medication before finalizing.");
      return;
    }

    // Flush any pending unsaved clinical notes in background without blocking prescription finalization
    if (latestNotesRef.current && latestNotesRef.current !== lastSavedNotesRef.current) {
      if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
      const noteToSave = latestNotesRef.current;
      const appt = appointmentRef.current;
      let cleanReason = appt?.reason || appt?.raw_reason || '';
      const notesIdx = cleanReason.indexOf('\n\n[CLINICAL_NOTES]:');
      if (notesIdx !== -1) cleanReason = cleanReason.substring(0, notesIdx);
      const newReason = `${cleanReason}\n\n[CLINICAL_NOTES]: ${noteToSave}`;
      supabase.from('appointments').update({ reason: newReason }).eq('id', roomId).then(
        ({ error }: any) => {
          if (!error) {
            lastSavedNotesRef.current = noteToSave;
            setSaveStatus('saved');
          }
        },
        () => {}
      );
    }

    setSendingPrescription(true);
    try {
      const medicationsFormatted = medicines.map((m) => ({
        medication_name: m.name,
        dosage: m.dosage,
        frequency: m.instructions || "As directed",
        duration: m.duration || "5 days",
        instructions: m.instructions || "Follow prescribed dosage",
      }));

      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: roomId,
          prescription_id: consultationPrescription?.id,
          doctor_id: appointment?.doctor_id || currentUser?.id,
          patient_id: appointment?.patient_id,
          diagnosis: "Consultation Prescription",
          medications: medicationsFormatted,
          instructions: clinicalNotes || "Follow prescribed dosage",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to finalize prescription");
      }

      toast.success(isEditingPrescription ? "Prescription updated and synced with patient!" : "Prescription finalized and saved to patient's medical records!");
      setIsEditingPrescription(false);
      await fetchConsultationPrescription();
    } catch (err: any) {
      console.error("Prescription finalization error:", err);
      toast.error(err.message || "Failed to finalize prescription.");
    } finally {
      setSendingPrescription(false);
    }
  };

  if ((loadingUser || loadingAppt) && !(isDoctor && appointment)) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center font-sans gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-xs text-slate-400">Connecting to consultation room...</p>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center font-sans gap-3 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-2">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-red-400">Consultation Room Error</h2>
        <p className="text-xs text-slate-400 max-w-sm">
          We could not find this consultation appointment. Please check the URL or try reconnecting.
        </p>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => {
              setLoadingAppt(true);
              loadAppointment(0);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Retry Connection
          </button>
          <Link
            href="/patient/dashboard"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const apptStatus = appointment.status;
  const isPendingStatus = apptStatus === 'pending';
  const isDeclinedStatus = apptStatus === 'declined' || apptStatus === 'cancelled' || apptStatus === 'rejected';
  const isCompletedStatus = apptStatus === 'completed';
  const isMissedStatus = apptStatus === 'missed';
  const backLink = isDoctor ? '/doctor/dashboard' : '/patient/dashboard';
  const backLabel = isDoctor ? 'Back to Doctor Dashboard' : 'Back to Patient Dashboard';

  // Access Guard on Ended / Missed Session: If consultation already completed/concluded or marked as missed, block joining
  if (isCompletedStatus || isMissedStatus) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
        <div className="max-w-md w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl space-y-4">
          <div className={`w-14 h-14 rounded-full ${isMissedStatus ? 'bg-red-500/10 border border-red-500/40' : 'bg-emerald-500/10 border border-emerald-500/40'} flex items-center justify-center mx-auto`}>
            {isMissedStatus ? (
              <XCircle className="w-7 h-7 text-red-400" />
            ) : (
              <Check className="w-7 h-7 text-emerald-400" />
            )}
          </div>
          <h2 className="text-xl font-bold text-white">
            {isMissedStatus ? "Consultation Missed" : "Consultation Ended"}
          </h2>
          <p className="text-xs text-slate-400">
            This consultation session has ended or was marked as missed.
          </p>
          <Link
            href={backLink}
            className="mt-6 inline-block w-full py-3 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition border border-slate-700 text-white text-center cursor-pointer"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isPendingStatus && !isDoctor) {
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
    let declineReason = '';
    if (appointment.reason) {
      const bracketMatch = appointment.reason.match(/\[Declined:\s*([^\]]+)\]/i);
      if (bracketMatch) {
        declineReason = bracketMatch[1].trim();
      } else {
        const pipeMatch = appointment.reason.match(/\|\s*Declined:\s*(.+)$/i);
        if (pipeMatch) {
          declineReason = pipeMatch[1].trim();
        }
      }
    }
    if (!declineReason) {
      declineReason = 'No reason provided';
    }
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

  // --- RENDER PATIENT WAITING ROOM FLOWS (PATIENT ONLY - DOCTOR ALWAYS BYPASSES DIRECTLY TO CALL UI) ---
  // If the user is the doctor, DO NOT render the waiting room under any circumstance!
  if (!isDoctor) {
    const isWaiting = appointment.is_patient_waiting;
    const isDeclined = appointment.is_patient_declined;
    const isAdmitted = appointment.is_patient_admitted;

    // A. Declined State
    if (isDeclined) {
      return (
        <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/40 flex items-center justify-center mb-6">
            <X className="w-8 h-8 text-rose-400" />
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
          <div className="max-w-md w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center mb-4 mx-auto">
              <Check className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-white">Cleared to Join</h2>
            <p className="text-xs text-slate-400">
              Your doctor has admitted you to the consultation room.
            </p>
            <button
              onClick={() => setPatientJoinClicked(true)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer animate-pulse"
            >
              Join Consultation Now
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
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center mb-6 mx-auto">
              <User className="w-6 h-6 text-emerald-400" />
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
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
            <h2 className="text-lg font-bold text-white">Consultation Waiting Room</h2>
            <p className="text-xs text-slate-400">
              You have successfully joined the waiting room. The doctor has been notified and will admit you shortly.
            </p>
            <div className="bg-slate-950 border border-slate-800/80 p-3 rounded-2xl text-[11px] text-slate-500">
              Please do not refresh this page. You will be connected automatically upon admission.
            </div>
            <button
              onClick={handleEndCall}
              className="mt-4 px-4 py-2 border border-slate-800 text-xs text-slate-400 rounded-xl hover:bg-slate-900 transition"
            >
              Cancel Call Request
            </button>
          </div>
        </div>
      );
    }
  }

  // Details formatted for patient card
  const patientName = appointment.patient?.name || appointment.patient_name || 'Patient';
  const age = appointment.patient?.age || '32';
  const gender = appointment.patient?.gender || 'Female';
  const complaint = appointment.reason || 'General Consultation';
  const symptoms = appointment.symptoms || '';
  const date = appointment.scheduled_date || appointment.appointment_date || '2026-08-17';
  const time = appointment.scheduled_time || appointment.time_slot || '12:00 PM';

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans overflow-y-auto">
      {/* Audio render tag */}
      <audio ref={audioRef} autoPlay />

      {/* Header Bar */}
      <header className="px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={handleEndCall}
            className="px-3.5 py-1.5 rounded-xl text-xs bg-slate-800/90 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1.5 cursor-pointer border border-slate-700/60"
          >
            <LogOut className="w-3.5 h-3.5" /> Leave Room
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-sm font-bold text-slate-100">Live Consultation Room</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDoctor && (
            <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 px-3 py-1 rounded-full flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400" /> Doctor Portal
            </span>
          )}
          <span className="text-[11px] font-mono text-slate-400 bg-slate-900/80 border border-slate-800 px-3 py-1 rounded-full">
            Room: {roomId?.slice(0, 8)}...
          </span>
        </div>
      </header>

      {/* MAIN CONSULTATION VIEWPORT - RESPONSIVE 3-COLUMN GRID (Task 2) */}
      <main className="p-4 md:p-6 w-full max-w-[1700px] mx-auto flex-1 flex flex-col">
        <div className={`grid grid-cols-1 ${isDoctor ? "lg:grid-cols-3" : "max-w-5xl mx-auto w-full"} gap-6 flex-1`}>

          {/* LEFT SIDE (2 Columns for doctor, full width for patient): Video Tiles & Controls */}
          <div className={`${isDoctor ? "lg:col-span-2" : "w-full"} flex flex-col gap-4`}>
            <div
              ref={containerRef}
              className="w-full h-[480px] md:h-[560px] bg-slate-950 rounded-2xl border border-slate-800/80 relative overflow-hidden flex items-center justify-center shadow-2xl"
            >
              {/* Main Remote Video (always rendered with physical layout so decoding is never suspended) */}
              <video
                id="remote-video"
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${hasRemoteVideo ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
              />

              {/* Remote Participant Name Tag Overlay */}
              <div
                className={`absolute top-4 left-4 z-20 bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 px-3 py-1 rounded-full text-xs font-medium text-slate-200 flex items-center gap-1.5 shadow-lg pointer-events-none transition-opacity duration-300 ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {isDoctor
                    ? (appointment?.patient?.name || appointment?.patient_name || 'Patient')
                    : (appointment?.doctor_name || appointment?.doctor?.name || 'Dr. Rahul Sharma')}
                </span>
              </div>

              {/* Waiting Spinner Fallback Overlay with CSS Opacity/Pointer-Events Transition */}
              <div
                className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-slate-400 p-6 text-center bg-slate-950 transition-all duration-500 ease-in-out ${hasRemoteVideo ? 'opacity-0 pointer-events-none select-none' : 'opacity-100 pointer-events-auto'
                  }`}
              >
                <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">Waiting for participant video track...</h3>
                  <p className="text-xs text-slate-500 max-w-xs">
                    {isDoctor ? "The patient will appear here once connected to the session." : "Connecting to doctor's video feed..."}
                  </p>
                </div>
              </div>

              {/* Draggable PiP Local Camera Preview Tile (Task 3: autoPlay, playsInline, muted) */}
              <div
                ref={dragRef}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                style={{
                  right: `${position.x}px`,
                  bottom: `${position.y}px`
                }}
                className="absolute w-36 h-48 md:w-44 md:h-56 rounded-2xl border-2 border-slate-700/80 bg-slate-900 shadow-2xl overflow-hidden cursor-move z-40 transition-shadow select-none hover:shadow-emerald-500/20"
              >
                <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-slate-950/70 backdrop-blur-sm text-[9px] font-bold text-slate-300 border border-slate-800/80 flex items-center gap-1 pointer-events-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> You
                </div>

                {/* Always keep video element mounted so stream is never lost on toggle */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover -scale-x-100 ${isVideoOff ? 'hidden' : 'block'}`}
                />

                {isVideoOff && (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-950 text-slate-500 text-[10px]">
                    <User className="w-6 h-6 text-slate-600" />
                    <span>Camera off</span>
                  </div>
                )}
              </div>

              {/* Video Call Controls Bar */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/95 backdrop-blur-xl px-6 py-2.5 rounded-full border border-slate-700/80 shadow-2xl z-40">
                <button
                  onClick={toggleMic}
                  title={isMuted ? "Unmute Mic" : "Mute Mic"}
                  className={`p-3 rounded-full transition-all cursor-pointer ${isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleVideo}
                  title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
                  className={`p-3 rounded-full transition-all cursor-pointer ${isVideoOff ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                >
                  {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleEndCall}
                  title="End Consultation"
                  className="p-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/50 transition-all cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active Patient In-Consultation Prescription Viewer (Task 4 & 6) */}
            {!isDoctor && (
              <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Doctor&apos;s Prescription
                        {consultationPrescription && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                            Issued &amp; Active
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {appointment?.doctor_name ? `Dr. ${appointment.doctor_name.replace(/^Dr\.\s*/i, '')}` : "Attending Doctor"}
                      </p>
                    </div>
                  </div>
                  {consultationPrescription && (
                    <div className="flex items-center gap-2">
                      <a
                        href={`/prescription/${consultationPrescription.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition border border-slate-700 flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                        View Full Document
                      </a>
                      <a
                        href={`/api/prescriptions/pdf?id=${consultationPrescription.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                      >
                        Download PDF
                      </a>
                    </div>
                  )}
                </div>

                {consultationPrescription ? (
                  <div className="space-y-4">
                    <div className="text-xs text-slate-300">
                      <span className="text-slate-500 font-medium">Diagnosis: </span>
                      <span className="text-white font-semibold">{consultationPrescription.diagnosis || "Consultation Prescription"}</span>
                    </div>

                    {consultationPrescription.medicines && consultationPrescription.medicines.length > 0 ? (
                      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-semibold">
                            <tr>
                              <th className="p-2.5">Medication</th>
                              <th className="p-2.5">Dosage</th>
                              <th className="p-2.5">Frequency</th>
                              <th className="p-2.5">Duration</th>
                              <th className="p-2.5">Instructions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-slate-300">
                            {consultationPrescription.medicines.map((m: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-900/40">
                                <td className="p-2.5 font-medium text-white">{m.medication_name || m.name || m.medicineName}</td>
                                <td className="p-2.5 text-slate-400">{m.dosage || "-"}</td>
                                <td className="p-2.5 text-slate-400">{m.frequency || "-"}</td>
                                <td className="p-2.5 text-slate-400">{m.duration || "-"}</td>
                                <td className="p-2.5 text-slate-400">{m.instructions || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No specific medications listed.</p>
                    )}

                    {consultationPrescription.advice && (
                      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs">
                        <span className="text-slate-400 font-semibold block text-[10px] uppercase mb-1">Doctor&apos;s Advice &amp; Instructions:</span>
                        <p className="text-slate-200">{consultationPrescription.advice}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-500 text-xs">
                    <p>No prescription issued yet. Once your doctor writes and finalizes your prescription during this session, it will automatically appear here in real-time.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT SIDE (1 Column, CONDITIONAL FOR DOCTOR ONLY): Clinical Side Panel (Task 2) */}
          {isDoctor && (
            <div className="lg:col-span-1 flex flex-col gap-5 overflow-y-auto max-h-[85vh] pr-1">

              {/* Patient Waiting Admission Alert Queue */}
              {appointment.is_patient_waiting && (
                <div className="bg-emerald-950/40 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-[0_0_25px_rgba(16,185,129,0.25)] animate-pulse space-y-3">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> Patient Waiting to Enter
                  </h3>
                  <p className="text-xs text-slate-200">
                    <strong>{patientName}</strong> is in the waiting room requesting entry.
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={handleAdmit}
                      disabled={admittingId}
                      className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                    >
                      <Check className="w-4 h-4" /> Admit Patient
                    </button>
                    <button
                      onClick={handleDecline}
                      className="py-2.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <X className="w-4 h-4" /> Decline
                    </button>
                  </div>
                </div>
              )}

              {/* 1. Patient Info Card */}
              <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-md">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-slate-800 pb-2.5">
                  <User className="w-4 h-4" /> Patient Details
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-medium">Patient Name</span>
                    <span className="font-bold text-slate-100 text-sm">{patientName}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] block font-medium">Age & Gender</span>
                      <span className="font-semibold text-slate-200">{age} yrs • {gender}</span>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] block font-medium">Appointment Time</span>
                      <span className="font-semibold text-slate-200">{time}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block font-medium">Scheduled Date</span>
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" /> {date}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-medium">Reason for Visit</span>
                    <p className="mt-1 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 text-xs leading-relaxed max-h-20 overflow-y-auto">
                      {complaint}
                    </p>
                  </div>

                  {symptoms && (
                    <div>
                      <span className="text-slate-400 text-[10px] block uppercase font-medium">Reported Symptoms</span>
                      <p className="mt-1 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-emerald-300 text-xs leading-relaxed max-h-20 overflow-y-auto">
                        {symptoms}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Clinical Notes Box */}
              <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Clinical Notes
                  </h3>
                  {saveStatus === 'saving' && (
                    <span className="text-[10px] text-slate-400 animate-pulse flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin text-teal-400" /> Saving...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                      <Check className="w-3.5 h-3.5" /> Saved
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="text-[10px] text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Save failed
                    </span>
                  )}
                </div>
                <textarea
                  placeholder="Type clinical observations, physical examination notes, advice, or diagnosis here..."
                  value={clinicalNotes}
                  onFocus={() => { if (typeof isTypingNotesRef !== 'undefined') isTypingNotesRef.current = true; }}
                  onBlur={() => { if (typeof isTypingNotesRef !== 'undefined') isTypingNotesRef.current = false; }}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none transition"
                />
              </div>

              {/* 3. Prescription Pad & Finalized Viewer (Doctor side) */}
              {consultationPrescription && !isEditingPrescription ? (
                <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-md space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" /> Prescription Finalized
                    </h3>
                    <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-full font-medium">
                      Active for Patient
                    </span>
                  </div>

                  <div className="text-xs text-slate-300">
                    <span className="text-slate-500 font-medium">Diagnosis: </span>
                    <span className="text-white font-semibold">{consultationPrescription.diagnosis || "Consultation Prescription"}</span>
                  </div>

                  {consultationPrescription.medicines && consultationPrescription.medicines.length > 0 && (
                    <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/80">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase font-semibold">
                          <tr>
                            <th className="p-2">Medication</th>
                            <th className="p-2">Dosage</th>
                            <th className="p-2">Duration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 text-slate-300">
                          {consultationPrescription.medicines.map((m: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-900/40">
                              <td className="p-2 font-medium text-white">{m.medication_name || m.name || m.medicineName}</td>
                              <td className="p-2 text-slate-400">{m.dosage || "-"}</td>
                              <td className="p-2 text-slate-400">{m.duration || m.frequency || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {consultationPrescription.advice && (
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs">
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase mb-1">Advice &amp; Instructions:</span>
                      <p className="text-slate-200">{consultationPrescription.advice}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPrescription(true);
                        if (consultationPrescription.medicines) {
                          setMedicines(consultationPrescription.medicines.map((m: any) => ({
                            name: m.medication_name || m.name || m.medicineName || '',
                            dosage: m.dosage || '',
                            duration: m.duration || '',
                            instructions: m.instructions || m.frequency || ''
                          })));
                        }
                        if (consultationPrescription.advice && !clinicalNotes) {
                          setClinicalNotes(consultationPrescription.advice);
                        }
                      }}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-400" /> Edit Prescription
                    </button>
                    <a
                      href={`/prescription/${consultationPrescription.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-indigo-500/30 text-center"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View Document
                    </a>
                  </div>
                </div>
              ) : (
                <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-md space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4" /> {isEditingPrescription ? "Edit Finalized Prescription" : "Prescription Pad"}
                    </h3>
                    {isEditingPrescription ? (
                      <button
                        type="button"
                        onClick={() => setIsEditingPrescription(false)}
                        className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500">Rx Formulary</span>
                    )}
                  </div>

                  {/* Medication Inputs */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block font-medium">Medication Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Amoxicillin 500mg"
                        value={medInput.name}
                        onChange={(e) => setMedInput({ ...medInput, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block font-medium">Dosage</label>
                      <input
                        type="text"
                        placeholder="e.g. 1 Capsule"
                        value={medInput.dosage}
                        onChange={(e) => setMedInput({ ...medInput, dosage: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block font-medium">Frequency / Instructions</label>
                      <input
                        type="text"
                        placeholder="e.g. Twice daily after meals"
                        value={medInput.instructions}
                        onChange={(e) => setMedInput({ ...medInput, instructions: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block font-medium">Duration</label>
                      <input
                        type="text"
                        placeholder="e.g. 5 days"
                        value={medInput.duration}
                        onChange={(e) => setMedInput({ ...medInput, duration: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddMedicine}
                    className="w-full py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-400" /> Add Medication
                  </button>

                  {/* Medicines List Table */}
                  {medicines.length > 0 && (
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80 max-h-36 overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase font-semibold">
                          <tr>
                            <th className="p-2">Medication</th>
                            <th className="p-2">Dosage</th>
                            <th className="p-2">Duration</th>
                            <th className="p-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 text-slate-300">
                          {medicines.map((m, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/40">
                              <td className="p-2 font-medium text-white">{m.name}</td>
                              <td className="p-2 text-slate-400">{m.dosage}</td>
                              <td className="p-2 text-slate-400">{m.duration}</td>
                              <td className="p-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMedicine(idx)}
                                  className="p-1 text-rose-400 hover:bg-rose-950/60 rounded cursor-pointer transition"
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

                  {/* Save & Finalize Prescription Button */}
                  <div className="flex gap-2">
                    {isEditingPrescription && (
                      <button
                        type="button"
                        onClick={() => setIsEditingPrescription(false)}
                        className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer border border-slate-700"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveAndFinalizePrescription}
                      disabled={sendingPrescription || medicines.length === 0}
                      className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer border border-indigo-400/30"
                    >
                      {sendingPrescription ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> {isEditingPrescription ? "Updating..." : "Saving & Finalizing..."}
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" /> {isEditingPrescription ? "Update & Finalize Prescription" : "Save & Finalize Prescription"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Google Meet-Style Leave vs End Consultation Modal for Doctor */}
      {showDoctorEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-[#0d1527] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                  <PhoneOff className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Leave Consultation?</h3>
                  <p className="text-xs text-slate-400">Choose how you want to exit this call.</p>
                </div>
              </div>
              <button
                onClick={() => setShowDoctorEndModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 pt-2">
              {/* Option 1: Leave Room (Can Rejoin) */}
              <button
                onClick={handleDoctorLeave}
                className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-left transition flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-700/60 flex items-center justify-center text-slate-300 shrink-0 mt-0.5 group-hover:bg-slate-700">
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition">
                    Just Leave Room
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Disconnect yourself without ending the session. You can rejoin at any time from your dashboard.
                  </div>
                </div>
              </button>

              {/* Option 2: End Consultation for All (Conclude & Complete) */}
              <button
                onClick={handleDoctorEndForAll}
                disabled={isEndingCall}
                className="w-full p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-left transition flex items-start gap-3.5 group cursor-pointer disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 shrink-0 mt-0.5 group-hover:bg-red-500/30">
                  {isEndingCall ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneOff className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-red-400 group-hover:text-red-300 transition">
                    {isEndingCall ? "Ending Consultation..." : "End Consultation for All"}
                  </div>
                  <div className="text-[11px] text-red-300/70 mt-0.5">
                    Conclude the consultation session for all participants and mark the appointment completed.
                  </div>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowDoctorEndModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
