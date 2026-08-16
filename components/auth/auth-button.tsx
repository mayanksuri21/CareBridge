"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { getUserDisplayName, getUserAvatarUrl, getUserInitials } from "@/lib/supabase/user-profile-utils"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { LogOut } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

export function AuthButton() {
  const { session, loading, signOut, profile: userProfile } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const { toast } = useToast()

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
      await signOut()
    } catch (error) {
      console.error("Sign out error:", error)
    } finally {
      setSigningOut(false)
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
