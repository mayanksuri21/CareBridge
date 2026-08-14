import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

async function getUserRole(supabase: any, userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()

    if (error || !data) return null
    return data.role
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const role = user ? await getUserRole(supabase, user.id) : null

  if (request.nextUrl.pathname.startsWith("/login")) {
    const force = request.nextUrl.searchParams.get("force")
    const mode = request.nextUrl.searchParams.get("mode")

    if (force === "true" || mode === "register") {
      return response
    }

    if (user && role) {
      const dashboardPath = role === "doctor" ? "/doctor/dashboard" : "/patient/dashboard"
      return NextResponse.redirect(new URL(dashboardPath, request.url))
    }

    if (user) {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}
