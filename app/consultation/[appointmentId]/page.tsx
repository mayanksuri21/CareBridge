"use client"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog"
import { ArrowLeft, Stethoscope } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { LiveKitRoom, GridLayout, ParticipantTile, useTracks } from "@livekit/components-react"
import { Track } from "livekit-client"

export default function ConsultRoomPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [consented, setConsented] = useState(false)
  const [open, setOpen] = useState(true)
  const [roomToken, setRoomToken] = useState<string | null>(null)
  const [audioOnly, setAudioOnly] = useState(false)

  const acceptConsent = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      alert("Please login")
      return
    }
    await supabase.from("consents").insert({ patient_id: user.id, appointment_id: appointmentId, text: "I consent to telemedicine consultation.", accepted: true })
    setConsented(true)
    setOpen(false)
    const roomName = `appt_${appointmentId}`
    const res = await fetch("/api/livekit/token", { method: "POST", body: JSON.stringify({ roomName }) })
    const data = await res.json()
    setRoomToken(data.token)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Stethoscope className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Consultation</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {!consented && (
          <AlertDialog open={open}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Consent for Telemedicine</AlertDialogTitle>
                <AlertDialogDescription>
                  I agree to participate in this telemedicine consultation. I understand the risks and benefits.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => history.back()}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={acceptConsent}>I Consent</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {consented && roomToken && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Live Consultation</h2>
              <div className="space-x-2">
                <Button variant="outline" className="bg-transparent" onClick={() => setAudioOnly((v) => !v)}>
                  {audioOnly ? "Switch to Video" : "Audio Only"}
                </Button>
              </div>
            </div>
            <LiveKitRoom
              token={roomToken}
              serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
              connect
              video={!audioOnly}
              audio
              style={{ height: "70vh" }}
            >
              <MediaGrid />
            </LiveKitRoom>
          </div>
        )}
      </div>
    </div>
  )
}

function MediaGrid() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: true },
  ])
  return (
    <GridLayout className="h-full" tracks={tracks}>
      <ParticipantTile />
    </GridLayout>
  )
}
