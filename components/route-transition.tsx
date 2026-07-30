"use client"

import { usePathname } from "next/navigation"
import React from "react"

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="animate-page">
      {children}
    </div>
  )
}
