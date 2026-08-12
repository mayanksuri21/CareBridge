import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

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

  // Refresh/synchronize the Supabase session.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (request.nextUrl.pathname.startsWith("/login")) {
    const force = request.nextUrl.searchParams.get("force")
    const mode = request.nextUrl.searchParams.get("mode")

    if (force === "true" || mode === "register") {
      return response
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