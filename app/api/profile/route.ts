import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateAge } from "@/lib/utils";

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
    date_of_birth,
    dob,
  } = body || {};

  const effectiveDob = date_of_birth || dob || user.user_metadata?.date_of_birth || user.user_metadata?.dob || null;

  // DOB is the authoritative single source of truth for patient age
  let calculatedAge: number | null = null;
  if (effectiveDob) {
    calculatedAge = calculateAge(effectiveDob);
  } else if (age !== undefined && age !== null && age !== "") {
    calculatedAge = Number(age);
  } else if (user.user_metadata?.age) {
    calculatedAge = Number(user.user_metadata.age);
  }

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

  const profilePayload: any = {
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
    age: calculatedAge,
    gender: gender ?? user.user_metadata?.gender ?? null,
  };

  if (effectiveDob) {
    profilePayload.date_of_birth = effectiveDob;
  }

  let { error: upsertErr } = await supabase.from("profiles").upsert(profilePayload);

  // Fallback: If date_of_birth column is not yet deployed in DB, retry without the column
  if (upsertErr && (upsertErr.message?.includes("date_of_birth") || upsertErr.code === "42703")) {
    delete profilePayload.date_of_birth;
    const retry = await supabase.from("profiles").upsert(profilePayload);
    upsertErr = retry.error;
  }

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

    if (profile) {
      const dob = profile.date_of_birth || user.user_metadata?.date_of_birth || user.user_metadata?.dob || null;
      if (dob) {
        profile.date_of_birth = dob;
        const dynamicAge = calculateAge(dob);
        if (dynamicAge !== null) {
          profile.age = dynamicAge;
        }
      }
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
