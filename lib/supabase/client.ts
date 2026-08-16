"use client"

import { createBrowserClient } from "@supabase/ssr"

let client: any = null

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)

  if (typeof window === "undefined") {
    return browserClient
  }

  if (!client) {
    client = browserClient
  }

  return client as typeof browserClient
}