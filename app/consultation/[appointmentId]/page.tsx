"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Mic, MicOff, PhoneOff, Stethoscope, Video, VideoOff } from "lucide-react"
import {
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from "@livekit/components-react"
import { DisconnectReason, Track } from "livekit-client"

import { PrescriptionModal } from "@/components/doctor/prescription-modal"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type AppointmentDetails = {
  doctor_id: string
  patient_id: string
  reason: string | null
  patient: { id: string; name: string | null } | null
}

const demoPatient = {
  name: "Alex Morgan",
  ageGender: "28 / Male",
  chiefComplaint: "High fever, cough, fatigue since 2 days.",
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function ConsultRoomPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const initializedAppointmentRef = useRef<string | null>(null)
  const tokenRequestRef = useRef(0)
  const hasConnectedRef = useRef(false)
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [token, setToken] = useState<string>("")
  const [isMounted, setIsMounted] = useState(false)
  const [consentOpen, setConsentOpen] = useState(false)
  const [isFetchingToken, setIsFetchingToken] = useState(true)
  const [wasDisconnected, setWasDisconnected] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [clinicalNotes, setClinicalNotes] = useState("")

  const isDoctor = Boolean(currentUserId && (!appointment || currentUserId === appointment.doctor_id))
  const hasPatientRecord = Boolean(appointment?.patient)
  const patientName = appointment?.patient?.name ?? demoPatient.name
  const chiefComplaint = appointment?.reason ?? demoPatient.chiefComplaint

  const fetchToken = useCallback(async (userId: string) => {
    const requestId = ++tokenRequestRef.current
    setToken("")
    setIsFetchingToken(true)
    setWasDisconnected(false)
    setErrorMessage(null)

    try {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: appointmentId,
          identity: `${userId}-${Date.now()}`,
        }),
      })
      const payload = (await response.json()) as { token?: string; error?: string }
      if (!response.ok || !payload.token) {
        throw new Error(payload.error ?? "Unable to create a video room token.")
      }
      if (requestId === tokenRequestRef.current) setToken(payload.token)
    } catch (error) {
      if (requestId === tokenRequestRef.current) {
        setWasDisconnected(true)
        setErrorMessage(error instanceof Error ? error.message : "Unable to join the video room.")
      }
    } finally {
      if (requestId === tokenRequestRef.current) setIsFetchingToken(false)
    }
  }, [appointmentId])

  useEffect(() => {
    setIsMounted(true)
    return () => {
      setIsMounted(false)
    }
  }, [])

  useEffect(() => {
    if (initializedAppointmentRef.current === appointmentId) return
    initializedAppointmentRef.current = appointmentId

    let active = true
    const initializeConsultation = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (active) {
          setErrorMessage("Please sign in to join this consultation.")
          setIsFetchingToken(false)
        }
        return
      }

      setCurrentUserId(user.id)
      if (!uuidPattern.test(appointmentId)) {
        setAppointment(null)
        await fetchToken(user.id)
        return
      }

      const { data } = await supabase
        .from("appointments")
        .select("doctor_id, patient_id, reason, patient:profiles!appointments_patient_id_fkey(id, name)")
        .eq("id", appointmentId)
        .maybeSingle()
      if (!active) return

      const appointmentDetails = data as unknown as AppointmentDetails | null
      setAppointment(appointmentDetails)

      if (appointmentDetails?.patient_id === user.id) {
        setConsentOpen(true)
        setIsFetchingToken(false)
        return
      }

      await fetchToken(user.id)
    }

    void initializeConsultation()
    return () => {
      active = false
    }
  }, [appointmentId, fetchToken, supabase])

  const acceptConsent = async () => {
    if (!currentUserId) return
    const { error } = await supabase.from("consents").insert({
      patient_id: currentUserId,
      appointment_id: appointmentId,
      text: "I consent to telemedicine consultation.",
      accepted: true,
    })
    if (error) {
      setErrorMessage(error.message)
      return
    }
    setConsentOpen(false)
    await fetchToken(currentUserId)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/doctor/dashboard")}>
            <ArrowLeft />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" />
            <h1 className="text-xl font-bold">Consultation Room</h1>
          </div>
        </div>
      </header>

      <main className="grid h-[calc(100vh-100px)] grid-cols-1 gap-6 bg-slate-950 p-6 text-white lg:grid-cols-4">
        <AlertDialog open={consentOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Consent for Telemedicine</AlertDialogTitle>
              <AlertDialogDescription>I agree to participate in this telemedicine consultation and understand its risks and benefits.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => history.back()}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void acceptConsent()}>I Consent</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-4 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Live Consultation</h2>
          </div>
          <div className="min-h-0 flex-1">
                {token && isMounted && (
                <LiveKitRoom
                  key={token}
                  token={token}
                  serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
                  connect={true}
                  video={true}
                  audio={true}
                  className="absolute inset-0 flex h-full w-full flex-col bg-black"
                  onConnected={() => {
                    hasConnectedRef.current = true
                  }}
                  onDisconnected={(reason) => {
                    setToken("")
                    setWasDisconnected(true)
                    if (hasConnectedRef.current && reason === DisconnectReason.CLIENT_INITIATED) {
                      router.push("/doctor/dashboard")
                    }
                  }}
                  onError={(error) => {
                    setErrorMessage(error.message)
                    setToken("")
                    setWasDisconnected(true)
                  }}
                >
                  <div className="flex h-full flex-col justify-between">
                    <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-slate-900/90">
                      <MediaGrid />
                    </div>
                    <MeetControls onEnded={() => router.push("/doctor/dashboard")} />
                  </div>
                  <RoomAudioRenderer />
                </LiveKitRoom>
                )}
          </div>
        </section>

          <aside className="min-h-0 space-y-4 overflow-y-auto lg:col-span-1">
            <Card>
              <CardHeader><CardTitle className="text-base">Patient Details</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                {!hasPatientRecord && <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">Demo patient summary</p>}
                <dl className="space-y-3">
                  <div><dt className="text-muted-foreground">Patient Name</dt><dd className="font-medium">{patientName}</dd></div>
                  <div><dt className="text-muted-foreground">Age / Gender</dt><dd className="font-medium">{hasPatientRecord ? "Not available" : demoPatient.ageGender}</dd></div>
                  <div><dt className="text-muted-foreground">Chief Complaint</dt><dd className="font-medium">{chiefComplaint}</dd></div>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">In-Call Clinical Notes</CardTitle></CardHeader>
              <CardContent><Textarea value={clinicalNotes} onChange={(event) => setClinicalNotes(event.target.value)} placeholder="Capture observations and follow-up notes" className="min-h-36" /></CardContent>
            </Card>
            {isDoctor && <PrescriptionModal appointmentId={appointment ? appointmentId : undefined} doctorId={currentUserId!} patientId={appointment?.patient_id} patientName={patientName} initialChiefComplaint={chiefComplaint} triggerLabel="Issue Prescription" />}
          </aside>
      </main>
    </div>
  )
}

function MediaGrid() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ])
  return <GridLayout className="h-full w-full bg-slate-900 [&_.lk-video-container]:bg-transparent [&_[data-lk-participant-tile]]:overflow-hidden [&_[data-lk-participant-tile]]:rounded-xl [&_[data-lk-participant-tile]]:bg-slate-900 [&_video]:h-full [&_video]:w-full [&_video]:object-contain" tracks={tracks}><ParticipantTile /></GridLayout>
}

function MeetControls({ onEnded }: { onEnded: () => void }) {
  const room = useRoomContext()
  const { isCameraEnabled, isMicrophoneEnabled, localParticipant } = useLocalParticipant()

  const leaveRoom = async () => {
    await room.disconnect()
    onEnded()
  }

  return (
    <div className="mx-auto mt-4 flex w-fit items-center gap-4 rounded-full border border-slate-700 bg-slate-800/90 px-6 py-3 shadow-2xl">
      <div className="flex gap-2">
        <Button
          variant={isMicrophoneEnabled ? "secondary" : "destructive"}
          size="icon"
          aria-label={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
          onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          {isMicrophoneEnabled ? <Mic /> : <MicOff />}
        </Button>
        <Button
          variant={isCameraEnabled ? "secondary" : "destructive"}
          size="icon"
          aria-label={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
          onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
        >
          {isCameraEnabled ? <Video /> : <VideoOff />}
        </Button>
      </div>
      <div className="h-8 w-px bg-slate-700" />
      <Button variant="destructive" size="icon" aria-label="End call" onClick={() => void leaveRoom()}>
        <PhoneOff className="rotate-[-135deg]" />
      </Button>
    </div>
  )
}
