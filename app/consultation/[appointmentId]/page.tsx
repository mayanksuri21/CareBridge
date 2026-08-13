"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Stethoscope } from "lucide-react"
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react"
import { Track } from "livekit-client"

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
  patient: {
    id: string
    name: string | null
  } | null
}

export default function ConsultRoomPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [requiresConsent, setRequiresConsent] = useState(false)
  const [consentOpen, setConsentOpen] = useState(false)
  const [roomToken, setRoomToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [clinicalNotes, setClinicalNotes] = useState("")

  const isDoctor = Boolean(appointment && currentUserId === appointment.doctor_id)

  const requestRoomToken = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName: `appt_${appointmentId}` }),
      })
      const payload = (await response.json()) as { token?: string; error?: string }
      if (!response.ok || !payload.token) {
        throw new Error(payload.error ?? "Unable to create a video room token.")
      }
      setRoomToken(payload.token)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to join the video room.")
    } finally {
      setIsLoading(false)
    }
  }, [appointmentId])

  useEffect(() => {
    let active = true

    const loadConsultation = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (active) {
          setErrorMessage("Please sign in to join this consultation.")
          setIsLoading(false)
        }
        return
      }

      const { data } = await supabase
        .from("appointments")
        .select("doctor_id, patient_id, reason, patient:profiles!appointments_patient_id_fkey(id, name)")
        .eq("id", appointmentId)
        .maybeSingle()

      if (!active) return

      const appointmentDetails = data as unknown as AppointmentDetails | null
      setCurrentUserId(user.id)
      setAppointment(appointmentDetails)

      const patientNeedsConsent = appointmentDetails?.patient_id === user.id
      setRequiresConsent(patientNeedsConsent)
      if (patientNeedsConsent) {
        setConsentOpen(true)
        setIsLoading(false)
      } else {
        void requestRoomToken()
      }
    }

    void loadConsultation()
    return () => {
      active = false
    }
  }, [appointmentId, requestRoomToken, supabase])

  const acceptConsent = async () => {
    if (requiresConsent && currentUserId) {
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
    }

    setConsentOpen(false)
    await requestRoomToken()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/doctor/dashboard">
              <ArrowLeft />
              Back to Dashboard
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" />
            <h1 className="text-xl font-bold">Consultation Room</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <AlertDialog open={consentOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Consent for Telemedicine</AlertDialogTitle>
              <AlertDialogDescription>
                I agree to participate in this telemedicine consultation and understand its risks and benefits.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => history.back()}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={acceptConsent}>I Consent</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {errorMessage ? (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">{errorMessage}</CardContent>
          </Card>
        ) : isLoading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Preparing your secure video room...</CardContent>
          </Card>
        ) : roomToken ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <LiveKitRoom
                  token={roomToken}
                  serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
                  connect
                  audio
                  video
                  className="flex h-[68vh] min-h-[32rem] flex-col bg-muted/30"
                  onError={(error) => setErrorMessage(error.message)}
                >
                  <div className="min-h-0 flex-1 p-3">
                    <MediaGrid />
                  </div>
                  <RoomAudioRenderer />
                  <ControlBar
                    className="border-t bg-card p-3"
                    controls={{ microphone: true, camera: true, screenShare: true, leave: true }}
                  />
                </LiveKitRoom>
              </CardContent>
            </Card>

            <details open className="group rounded-lg border bg-card xl:max-h-[68vh] xl:overflow-y-auto">
              <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold [&::-webkit-details-marker]:hidden">
                Clinical Panel
                <span className="text-sm font-normal text-muted-foreground group-open:hidden">Open</span>
                <span className="hidden text-sm font-normal text-muted-foreground group-open:inline">Close</span>
              </summary>
              <div className="space-y-5 border-t p-4">
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold">Patient Details</h2>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Name</dt>
                      <dd className="text-right font-medium">{appointment?.patient?.name ?? "Not available"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Age</dt>
                      <dd className="text-right font-medium">Not available</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-muted-foreground">Chief Complaint</dt>
                      <dd>{appointment?.reason ?? "Not recorded"}</dd>
                    </div>
                  </dl>
                </section>

                <section className="space-y-2">
                  <label className="text-sm font-semibold" htmlFor="clinical-notes">
                    In-Call Clinical Notes
                  </label>
                  <Textarea
                    id="clinical-notes"
                    value={clinicalNotes}
                    onChange={(event) => setClinicalNotes(event.target.value)}
                    placeholder="Capture observations and follow-up notes during the call"
                    className="min-h-36"
                  />
                </section>

                {isDoctor && appointment && (
                  <PrescriptionModal
                    appointmentId={appointmentId}
                    doctorId={appointment.doctor_id}
                    patientId={appointment.patient_id}
                    patientName={appointment.patient?.name}
                    initialChiefComplaint={appointment.reason}
                  />
                )}
              </div>
            </details>
          </div>
        ) : null}
      </main>
    </div>
  )
}

function MediaGrid() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ])

  return (
    <GridLayout className="h-full" tracks={tracks}>
      <ParticipantTile />
    </GridLayout>
  )
}
