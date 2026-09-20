"use client"

import { createBrowserClient } from "@supabase/ssr"

let client: any = null

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (typeof window === "undefined") {
    return createBrowserClient(supabaseUrl, supabaseAnonKey)
  }

  if (!client) {
    client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }

  return client as ReturnType<typeof createBrowserClient>
}