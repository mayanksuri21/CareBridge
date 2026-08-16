"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import type { Session, User } from "@supabase/supabase-js"
import type { UserProfile } from "@/lib/supabase/user-profile-utils"
import { getUserProfile } from "@/lib/supabase/user-profile-utils"

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const handleSession = async (currentSession: Session | null) => {
    setSession(currentSession)
    setUser(currentSession?.user ?? null)

    if (currentSession?.user) {
      try {
        const prof = await getUserProfile(currentSession.user)
        setProfile(prof)
      } catch (err) {
        console.error("Error loading user profile in provider:", err)
        setProfile(null)
      }
    } else {
      setProfile(null)
    }
    setLoading(false)
  }

  const refreshProfile = async () => {
    if (user) {
      try {
        const prof = await getUserProfile(user)
        setProfile(prof)
      } catch (err) {
        console.error("Error refreshing profile in provider:", err)
      }
    }
  }

  useEffect(() => {
    let isMounted = true
    let isInitialCheckDone = false

    const init = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        if (isMounted && !isInitialCheckDone) {
          isInitialCheckDone = true
          await handleSession(currentSession)
        }
      } catch (err) {
        console.error("Auth getSession error:", err)
        if (isMounted) setLoading(false)
      }
    }

    void init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log("AuthProvider AuthStateChange:", event, currentSession ? "session exists" : "no session")
      if (isMounted) {
        isInitialCheckDone = true
        await handleSession(currentSession)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = async () => {
    try {
      setLoading(true)
      // Call server logout to clear cookies
      try {
        await fetch('/api/auth/logout', { method: 'POST' })
      } catch (err) {
        console.warn("Logout API failed", err)
      }
      
      // Call supabase client-side logout
      await supabase.auth.signOut({ scope: 'global' })
      
      // Clean up localStorage/sessionStorage
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase') || key === 'hc_pending_profile') {
            localStorage.removeItem(key)
          }
        })
        sessionStorage.clear()
      } catch (storageError) {
        console.warn('Storage cleanup failed:', storageError)
      }

      setSession(null)
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error("Sign out error:", error)
    } finally {
      setLoading(false)
    }
  }

  const value: AuthContextValue = {
    user,
    session,
    profile,
    loading,
    signOut,
    refreshProfile
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}
