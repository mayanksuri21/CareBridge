"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, CalendarDays, Home, FileText, Stethoscope, Menu, X, ChevronRight, Activity, Video } from "lucide-react"

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

type NavbarProps = {
  variant?: "public" | "patient" | "doctor" | "consultation" | "auto"
}

export function Navbar({ variant = "auto" }: NavbarProps) {
  const pathname = usePathname()
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

  // Determine effective variant if 'auto'
  let effectiveVariant = variant
  if (effectiveVariant === "auto") {
    if (pathname?.startsWith("/consultation/room") || (pathname?.startsWith("/consultation/") && pathname !== "/consultation/book")) {
      effectiveVariant = "consultation"
    } else if (pathname?.startsWith("/doctor")) {
      effectiveVariant = "doctor"
    } else if (pathname?.startsWith("/patient")) {
      effectiveVariant = "patient"
    } else {
      effectiveVariant = "public"
    }
  }

  // Consultation Room variant header
  if (effectiveVariant === "consultation") {
    return (
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 text-slate-100">
        <div className="container mx-auto px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={HOME_URL} className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-950/40 group-hover:scale-105 transition-transform">
                  <Stethoscope className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold tracking-tight text-white font-sans">
                  Care<span className="text-emerald-400">Bridge</span>
                </span>
              </Link>
              <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />
              <div className="hidden sm:flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Live Consultation Session
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isDoctor ? (
                <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-800/60 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" /> Clinical Mode
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-sky-300 bg-sky-955/80 border border-sky-800/60 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                  <Video className="w-3.5 h-3.5 text-sky-400" /> Patient Room
                </span>
              )}
            </div>
          </div>
        </div>
      </header>
    )
  }

  // Doctor Portal Navbar variant
  if (effectiveVariant === "doctor") {
    return (
      <header className="border-b border-sky-100 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md sticky top-0 z-30 text-slate-900 dark:text-slate-100 transition-colors shadow-xs">
        <div className="container mx-auto px-4 md:px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={HOME_URL} className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 via-teal-600 to-emerald-500 flex items-center justify-center shadow-md shadow-sky-600/20 group-hover:scale-105 transition-transform">
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans">
                  Care<span className="text-emerald-600 dark:text-emerald-400">Bridge</span>
                </span>
              </Link>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 dark:bg-emerald-955/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wide">
                <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Doctor Portal
              </span>
            </div>

            {mounted && (
              <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Link
                  href={HOME_URL}
                  className="flex items-center gap-1.5 transition-colors py-1 hover:text-slate-900 dark:hover:text-white"
                >
                  <Home className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Public Site
                </Link>
                <Link
                  href="/doctor/dashboard"
                  className={`flex items-center gap-1.5 transition-colors py-1 ${
                    pathname === "/doctor/dashboard"
                      ? "text-emerald-700 dark:text-emerald-400 font-bold border-b-2 border-emerald-600"
                      : "hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Clinical Dashboard
                </Link>
                <Link
                  href="/profile"
                  className={`flex items-center gap-1.5 transition-colors py-1 ${
                    pathname === "/profile"
                      ? "text-emerald-700 dark:text-emerald-400 font-bold border-b-2 border-emerald-600"
                      : "hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <User className="h-4 w-4 text-sky-600 dark:text-sky-400" /> My Profile
                </Link>

                {loading ? (
                  <AuthButton />
                ) : session ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-sky-50 dark:hover:bg-slate-800">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                          {displayName.substring(0, 1).toUpperCase()}
                        </div>
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{displayName}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl">
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/profile">My Profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/doctor/dashboard">Clinical Dashboard</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={handleSignOut} className="text-red-600 dark:text-red-400 cursor-pointer">
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
            <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4 md:hidden text-sm font-medium">
              <Link
                href={HOME_URL}
                className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setMobileOpen(false)}
              >
                <Home className="h-4 w-4 text-sky-600" /> Public Site
              </Link>
              <Link
                href="/doctor/dashboard"
                className="flex items-center gap-2 rounded-xl px-3 py-2 bg-emerald-50 dark:bg-emerald-955/80 font-bold text-emerald-700 dark:text-emerald-400"
                onClick={() => setMobileOpen(false)}
              >
                <CalendarDays className="h-4 w-4 text-emerald-600" /> Clinical Dashboard
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setMobileOpen(false)}
              >
                <User className="h-4 w-4 text-sky-600" /> My Profile
              </Link>
              {session && (
                <Button
                  onClick={() => handleSignOut()}
                  disabled={signingOut}
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 border-slate-200 dark:border-slate-800"
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

  // Standard/Public & Patient Navbar (Light visual style with CareBridge Blue + Green visual identity)
  return (
    <header className="border-b border-sky-100 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="container mx-auto px-4 md:px-6 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={HOME_URL} className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 via-teal-600 to-emerald-500 flex items-center justify-center shadow-md shadow-sky-600/20 group-hover:scale-105 transition-transform">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans">
                Care<span className="text-emerald-600 dark:text-emerald-400">Bridge</span>
              </span>
            </Link>
          </div>

          {mounted && (
            <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
              <Link
                href={HOME_URL}
                className={`flex items-center gap-1.5 transition-colors py-1 hover:text-slate-900 dark:hover:text-white ${
                  pathname === HOME_URL ? "text-sky-700 dark:text-sky-400 font-semibold" : ""
                }`}
              >
                <Home className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Home
              </Link>

              {isPatient && (
                <>
                  <Link
                    href="/patient/dashboard"
                    className={`flex items-center gap-1.5 transition-colors py-1 hover:text-slate-900 dark:hover:text-white ${
                      pathname === "/patient/dashboard"
                        ? "text-sky-700 dark:text-sky-400 font-semibold border-b-2 border-sky-600"
                        : ""
                    }`}
                  >
                    <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Your History
                  </Link>
                  <Link
                    href="/profile"
                    className={`flex items-center gap-1.5 transition-colors py-1 hover:text-slate-900 dark:hover:text-white ${
                      pathname === "/profile"
                        ? "text-sky-700 dark:text-sky-400 font-semibold border-b-2 border-sky-600"
                        : ""
                    }`}
                  >
                    <User className="h-4 w-4 text-sky-600 dark:text-sky-400" /> My Profile
                  </Link>
                  <Button asChild size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm rounded-xl px-4">
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
                    className={`flex items-center gap-1.5 transition-colors py-1 hover:text-slate-900 dark:hover:text-white ${
                      pathname === "/doctor/dashboard"
                        ? "text-emerald-700 dark:text-emerald-400 font-semibold border-b-2 border-emerald-600"
                        : ""
                    }`}
                  >
                    <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Clinical Dashboard
                  </Link>
                  <Link
                    href="/profile"
                    className={`flex items-center gap-1.5 transition-colors py-1 hover:text-slate-900 dark:hover:text-white ${
                      pathname === "/profile"
                        ? "text-emerald-700 dark:text-emerald-400 font-semibold border-b-2 border-emerald-600"
                        : ""
                    }`}
                  >
                    <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> My Profile
                  </Link>
                </>
              )}

              {loading ? (
                <AuthButton />
              ) : session ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-sky-50 dark:hover:bg-slate-800">
                      <div className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-xs">
                        {displayName.substring(0, 1).toUpperCase()}
                      </div>
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{displayName}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl">
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/profile">My Profile</Link>
                    </DropdownMenuItem>
                    {isPatient && (
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/patient/dashboard">Your History</Link>
                      </DropdownMenuItem>
                    )}
                    {isDoctor && (
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/doctor/dashboard">Clinical Dashboard</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleSignOut} className="text-red-600 dark:text-red-400 cursor-pointer">
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
          <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4 md:hidden text-sm">
            <Link
              href={HOME_URL}
              className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
              onClick={() => setMobileOpen(false)}
            >
              <Home className="h-4 w-4 text-sky-600" /> Home
            </Link>
            {isPatient && (
              <>
                <Link
                  href="/patient/dashboard"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  <FileText className="h-4 w-4 text-sky-600" /> Your History
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  <User className="h-4 w-4 text-sky-600" /> My Profile
                </Link>
                <Button asChild className="gap-1.5 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl" size="sm" onClick={() => setMobileOpen(false)}>
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
                  className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  <CalendarDays className="h-4 w-4 text-emerald-600" /> Clinical Dashboard
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  <User className="h-4 w-4 text-emerald-600" /> My Profile
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
                className="w-full mt-1 border-slate-200 dark:border-slate-800"
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
