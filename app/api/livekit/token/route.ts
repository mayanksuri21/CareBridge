import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { AccessToken } from "livekit-server-sdk"

function getAdminClient(authHeader?: string | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceKey) {
    return createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });
  }

  return createClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {}
      },
      auth: { persistSession: false }
    }
  );
}

async function handleTokenGeneration(req: Request, roomName?: string, participantName?: string) {
  try {
    const supabase = await createSupabaseServerClient()
    const authHeader = req.headers.get("authorization")
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined

    const {
      data: { user },
    } = bearerToken ? await supabase.auth.getUser(bearerToken) : await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!roomName) {
      return NextResponse.json({ error: "roomName required" }, { status: 400 })
    }

    const adminSupabase = getAdminClient(authHeader)
    // Fetch the appointment from database using service role (admin) to verify ownership and admission state
    const { data: appt, error: apptErr } = await adminSupabase
      .from("appointments")
      .select("doctor_id, patient_id, reason, status")
      .eq("id", roomName)
      .maybeSingle()

    if (apptErr || !appt) {
      console.warn("[LiveKit Token] Appointment not found for room:", roomName, apptErr)
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    let isDoctor = user.id === appt.doctor_id
    let isPatient = user.id === appt.patient_id

    // Fallback: Check if user has doctor role in profile or metadata if doctor_id doesn't match directly
    if (!isDoctor && !isPatient) {
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()

      if (profile?.role === "doctor") {
        isDoctor = true
      }
    }

    if (!isDoctor && !isPatient) {
      console.warn("[LiveKit Token] Access denied for user:", user.id, "on room:", roomName)
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Patient must be admitted to retrieve the LiveKit token
    if (isPatient) {
      const isAdmitted =
        appt.reason?.includes("[PATIENT_ADMITTED]") ||
        appt.status === "in_progress" ||
        false

      if (!isAdmitted) {
        return NextResponse.json({ error: "Waiting for admission" }, { status: 403 })
      }
    }

    const username =
      participantName ||
      (typeof user.user_metadata.full_name === "string"
        ? user.user_metadata.full_name
        : user.email ?? (isDoctor ? "Doctor" : "Patient"))

    const rolePrefix = isDoctor ? "doctor" : "patient"
    const uniqueIdentity = `${rolePrefix}_${user.id}`

    const apiKey = process.env.LIVEKIT_API_KEY!
    const apiSecret = process.env.LIVEKIT_API_SECRET!
    const at = new AccessToken(apiKey, apiSecret, { identity: uniqueIdentity, name: username, ttl: "1h" })
    at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true })

    const token = await at.toJwt()
    return NextResponse.json({ token, identity: uniqueIdentity, roomName })
  } catch (err: any) {
    console.error("[LiveKit Token] Generation error:", err)
    return NextResponse.json({ error: err.message || "Failed to generate token" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomName = body.roomName || body.roomId || body.room
    const participantName = body.participantName || body.name
    return await handleTokenGeneration(req, roomName, participantName)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const roomName = searchParams.get("roomName") || searchParams.get("roomId") || searchParams.get("room") || undefined
  const participantName = searchParams.get("participantName") || searchParams.get("name") || undefined
  return await handleTokenGeneration(req, roomName, participantName)
}
