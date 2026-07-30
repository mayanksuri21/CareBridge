"use client"

import { cn } from "@/lib/utils"

interface GradualBlurProps {
  strength?: number
  height?: string
  position?: "top" | "bottom"
  curve?: "ease-in" | "ease-out" | "ease-in-out"
  opacity?: number
  className?: string
}

export default function GradualBlur({
  strength = 1,
  height = "5rem",
  position = "bottom",
  curve = "ease-out",
  opacity = 0.8,
  className
}: GradualBlurProps) {
  const gradientDirection = position === "top" ? "to bottom" : "to top"
  const blurValue = `${strength * 10}px`
  
  return (
    <div
      className={cn(
        "absolute inset-x-0 pointer-events-none",
        position === "top" ? "top-0" : "bottom-0",
        className
      )}
      style={{
        height,
        background: `linear-gradient(${gradientDirection}, transparent 0%, rgba(0,0,0,${opacity}) 100%)`,
        filter: `blur(${blurValue})`,
        transition: `filter 0.3s ${curve}`,
      }}
    />
  )
}