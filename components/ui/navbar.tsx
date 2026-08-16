"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { User, CalendarDays, Home, FileText, Stethoscope, Menu, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AuthButton } from "@/components/auth/auth-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth-provider"

const HOME_URL = "/"

export function Navbar() {
  const { session, profile, loading, signOut } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async (e?: React.MouseEvent | any) => {
    if (e && e.preventDefault) {
      e.preventDefault()
    }
    if (signingOut) return
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
  }

  const displayName = profile?.name || session?.user.user_metadata?.full_name || session?.user.email || "Account"
  const isPatient = session && profile?.role === "patient"
  const isDoctor = session && profile?.role === "doctor"

  return (
    <header className="border-b border-border/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 bg-background">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href={HOME_URL} className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <Stethoscope className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground tracking-tight">CareBridge</span>
            </Link>
          </div>

          {mounted && (
            <nav className="hidden md:flex items-center gap-3 lg:gap-5 text-sm text-muted-foreground">
              <Link href={HOME_URL} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Home className="h-4 w-4" /> Home
              </Link>
              {isPatient && (
                <>
                  <Link
                    href="/patient/dashboard"
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium"
                  >
                    <FileText className="h-4 w-4" /> Your History
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <User className="h-4 w-4" /> My Profile
                  </Link>
                  <Button asChild className="gap-1.5" size="sm">
                    <Link href="/consultation/book">
                      <CalendarDays className="h-4 w-4" /> Book a Doctor
                    </Link>
                  </Button>
                </>
              )}
              {isDoctor && (
                <>
                  <Link
                    href="/doctor/dashboard"
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium"
                  >
                    <CalendarDays className="h-4 w-4" /> Clinical Dashboard
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <User className="h-4 w-4" /> My Profile
                  </Link>
                </>
              )}
              {loading ? (
                <AuthButton />
              ) : session ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      <User className="h-4 w-4" /> {displayName}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild>
                      <Link href="/profile">My Profile</Link>
                    </DropdownMenuItem>
                    {isPatient && (
                      <DropdownMenuItem asChild>
                        <Link href="/patient/dashboard">Your History</Link>
                      </DropdownMenuItem>
                    )}
                    {isDoctor && (
                      <DropdownMenuItem asChild>
                        <Link href="/doctor/dashboard">Clinical Dashboard</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleSignOut} className="text-left cursor-pointer">
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <AuthButton />
              )}
            </nav>
          )}

          {mounted && (
            <div className="md:hidden flex items-center gap-2">
              {loading ? (
                <AuthButton />
              ) : session ? (
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/profile">{displayName}</Link>
                </Button>
              ) : (
                <AuthButton />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label="Toggle navigation"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          )}
        </div>

        {mobileOpen && mounted && (
          <div className="mt-4 flex flex-col gap-2 border-t pt-4 md:hidden">
            <Link
              href={HOME_URL}
              className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <Home className="h-4 w-4" /> Home
            </Link>
            {isPatient && (
              <>
                <Link
                  href="/patient/dashboard"
                  className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  <FileText className="h-4 w-4" /> Your History
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted text-muted-foreground hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  <User className="h-4 w-4" /> My Profile
                </Link>
                <Button asChild className="gap-1.5" size="sm" onClick={() => setMobileOpen(false)}>
                  <Link href="/consultation/book">
                    <CalendarDays className="h-4 w-4" /> Book a Doctor
                  </Link>
                </Button>
              </>
            )}
            {isDoctor && (
              <>
                <Link
                  href="/doctor/dashboard"
                  className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  <CalendarDays className="h-4 w-4" /> Clinical Dashboard
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted text-muted-foreground hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  <User className="h-4 w-4" /> My Profile
                </Link>
              </>
            )}
            {loading ? (
              <div className="mt-1">
                <AuthButton />
              </div>
            ) : !session ? (
              <div className="mt-1">
                <AuthButton />
              </div>
            ) : (
              <Button 
                onClick={() => handleSignOut()} 
                disabled={signingOut} 
                variant="outline" 
                size="sm" 
                className="w-full mt-1"
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
