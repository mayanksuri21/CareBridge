"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { forceLogout } from "@/lib/supabase/auth-utils"
import { getUserProfile, getUserDisplayName, getUserAvatarUrl, getUserInitials } from "@/lib/supabase/user-profile-utils"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { User, LogOut, AlertCircle } from "lucide-react"
import type { Session } from "@supabase/supabase-js"
import type { UserProfile } from "@/lib/supabase/user-profile-utils"

export function AuthButton() {
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const supabase = createSupabaseBrowserClient()
  const { toast } = useToast()

  const loadUserProfile = async (user: any) => {
    if (!user || profileLoading) return
    
    setProfileLoading(true)
    try {
      const profile = await getUserProfile(user)
      setUserProfile(profile)
      console.log('Auth button: Loaded profile with avatar:', profile?.avatar_url || 'No avatar')
    } catch (error) {
      console.error('Failed to load user profile:', error)
      setUserProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (isMounted) {
          if (error) {
            console.error("Error getting session:", error)
            setSession(null)
          } else {
            setSession(data.session)

            if (data.session?.user) {
              await loadUserProfile(data.session.user)
            }
          }
          setLoading(false)
        }
      } catch (err) {
        console.error("Session check failed:", err)
        if (isMounted) {
          setSession(null)
          setLoading(false)
        }
      }
    }
    
    getInitialSession()

    const loadingTimeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn("Auth session check timed out, stopping loading state")
        setLoading(false)
      }
    }, 10000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isMounted) {
        console.log('Auth state change:', event, session ? 'session exists' : 'no session')
        setSession(session)
        setLoading(false) 
        
        if (event === 'SIGNED_OUT') {
          setSigningOut(false)
          setSession(null)
          setUserProfile(null)

        } else if (event === 'SIGNED_IN' && session?.user) {

          await loadUserProfile(session.user)
        }
      }
    })

    return () => {
      isMounted = false
      clearTimeout(loadingTimeout)
      subscription?.unsubscribe()
    }
  }, [supabase.auth])

  const handleSignOut = async () => {
    if (signingOut) return 
    
    setSigningOut(true)
    
    console.log('Starting sign out process...')
    
    try {

      toast({
        title: "Signing out...",
        description: "Logging you out securely.",
        duration: 3000
      })

      setSession(null)
      setUserProfile(null)

      try {
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
        console.log('Cleared local storage keys:', keysToRemove)
      } catch (storageError) {
        console.warn('Could not clear localStorage:', storageError)
      }

      supabase.auth.signOut().catch(error => {
        console.warn('Supabase sign out had an issue, but continuing with redirect:', error)
      })

      console.log('Sign out initiated, redirecting...')

      toast({
        title: "Signed out",
        description: "Redirecting to home page...",
        duration: 2000
      })

      setTimeout(() => {
        console.log('Forcing redirect to home page')
        window.location.replace('/') 
      }, 500)

    } catch (error) {
      console.error("Sign out error:", error)

      toast({
        title: "Signed out",
        description: "Redirecting to home page...",
        duration: 2000
      })

      setTimeout(() => {
        console.log('Forcing redirect after error')
        window.location.replace('/')
      }, 1000)
    }

  }

  if (loading) {
    return (
      <div className="flex items-center gap-2" aria-label="Loading authentication status">
        <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
        <div className="w-16 h-4 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (session) {
    const display = getUserDisplayName(session.user, userProfile)
    const shortDisplay = display.length > 15 ? display.substring(0, 15) + "..." : display
    const avatarUrl = getUserAvatarUrl(userProfile)
    const initials = getUserInitials(display)
    
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 border border-border">
            <AvatarImage src={avatarUrl} alt={display} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {shortDisplay}
            </span>
            <span className="text-xs text-muted-foreground">
              {session.user.email ? "Logged in" : "Connected"}
            </span>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleSignOut} disabled={signingOut} className="bg-transparent">
          <LogOut className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">{signingOut ? "Signing out..." : "Logout"}</span>
        </Button>
      </div>
    )
  }

  return (
    <Link href="/login">
      <Button size="sm">Login</Button>
    </Link>
  )
}
