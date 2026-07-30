import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AccessToken } from "livekit-server-sdk"

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { roomName } = await req.json()
  if (!roomName) return NextResponse.json({ error: "roomName required" }, { status: 400 })

  const apiKey = process.env.LIVEKIT_API_KEY!
  const apiSecret = process.env.LIVEKIT_API_SECRET!
  const at = new AccessToken(apiKey, apiSecret, { identity: user.id, ttl: "1h" })
  at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true })

  const token = await at.toJwt()
  return NextResponse.json({ token })
}
