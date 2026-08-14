import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name,
    language = "en",
    role,
    phone,
    address,
    specialty,
    about,
    avatar_url,
    age,
    gender,
  } = body || {};

  let userRole = "patient";

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (existingProfile?.role) {
    userRole = existingProfile.role;
  } else {
    const requestedRole = role || user.user_metadata?.role;
    if (requestedRole === "doctor" || requestedRole === "patient") {
      userRole = requestedRole;
    }
  }

  const { error: upsertErr } = await supabase.from("profiles").upsert({
    id: user.id,
    name:
      name ?? user.user_metadata?.name ?? user.user_metadata?.full_name ?? null,
    language,
    role: userRole,
    phone: phone ?? user.user_metadata?.phone ?? null,
    address: address ?? null,
    specialty: specialty ?? null,
    about: about ?? null,
    avatar_url: avatar_url ?? null,
    age: age !== undefined ? (age ? Number(age) : null) : (user.user_metadata?.age ? Number(user.user_metadata.age) : null),
    gender: gender ?? user.user_metadata?.gender ?? null,
  });

  if (upsertErr) {
    console.error("PROFILE UPSERT ERROR:", upsertErr);
    return NextResponse.json(
      {
        error: upsertErr.message,
        details: upsertErr.details,
        hint: upsertErr.hint,
      },
      { status: 400 },
    );
  }
  if (userRole === "doctor") {
    try {
      const { error: docErr } = await supabase.from("doctors").upsert({
        id: user.id,
        specialty: specialty ?? null,
      });

      if (docErr) {
        console.warn("Doctor table upsert warning:", docErr.message);
      }
    } catch (docError) {
      console.warn("Doctor table operation failed:", docError);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      profile: profile || null,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 },
    );
  }
}
