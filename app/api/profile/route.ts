import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { 
    name, 
    language = "en", 
    role, 
    phone, 
    address, 
    specialty, 
    doctor_languages,
    portfolio,
    company,
    github,
    linkedin,
    about,
    avatar_url
  } = body || {}

  let userRole = "patient" 

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  
  if (existingProfile?.role) {

    userRole = existingProfile.role
  } else {

    const requestedRole = role || user.user_metadata?.role
    if (requestedRole === "doctor" || requestedRole === "patient") {
      userRole = requestedRole
    }
  }

  const { error: upsertErr } = await supabase
    .from("profiles")
    .upsert({ 
      id: user.id, 
      name: name ?? user.user_metadata?.name ?? user.user_metadata?.full_name ?? null, 
      language, 
      role: userRole, 
      phone: phone ?? user.user_metadata?.phone ?? null,
      address: address ?? null,
      specialty: specialty ?? null,
      doctor_languages: doctor_languages ?? null,
      portfolio: portfolio ?? null,
      company: company ?? null,
      github: github ?? null,
      linkedin: linkedin ?? null,
      about: about ?? null,
      avatar_url: avatar_url ?? null
    })

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 400 })

  if (userRole === "doctor") {
    try {
      const { error: docErr } = await supabase
        .from("doctors")
        .upsert({ 
          id: user.id, 
          specialty: specialty ?? null, 
          languages: doctor_languages ? [doctor_languages] : null 
        })
      
      if (docErr) {
        console.warn("Doctor table upsert warning:", docErr.message)
      }
    } catch (docError) {
      console.warn("Doctor table operation failed:", docError)
    }
  }

  return NextResponse.json({ ok: true })
}

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ 
      profile: profile || null,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata
      }
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}
