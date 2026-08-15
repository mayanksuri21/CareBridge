import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AccessToken } from "livekit-server-sdk"

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { roomName } = await req.json()
    if (!roomName) return NextResponse.json({ error: "roomName required" }, { status: 400 })

    // Fetch the appointment from database using service role (admin) to verify ownership and admission state
    const { data: appt, error: apptErr } = await supabase
      .from('appointments')
      .select('doctor_id, patient_id, reason, status')
      .eq('id', roomName)
      .maybeSingle()

    if (apptErr || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    const isDoctor = user.id === appt.doctor_id
    const isPatient = user.id === appt.patient_id

    if (!isDoctor && !isPatient) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Patient must be admitted to retrieve the LiveKit token
    if (isPatient) {
      const isAdmitted = appt.reason?.includes('[PATIENT_ADMITTED]') || false
      if (!isAdmitted) {
        return NextResponse.json({ error: "Waiting for admission" }, { status: 403 })
      }
    }

    const username =
      typeof user.user_metadata.full_name === "string"
        ? user.user_metadata.full_name
        : user.email ?? user.id
    const uniqueIdentity = `${username.replaceAll(" ", "*")}*${Date.now()}`

    const apiKey = process.env.LIVEKIT_API_KEY!
    const apiSecret = process.env.LIVEKIT_API_SECRET!
    const at = new AccessToken(apiKey, apiSecret, { identity: uniqueIdentity, ttl: "1h" })
    at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true })

    const token = await at.toJwt()
    return NextResponse.json({ token })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
