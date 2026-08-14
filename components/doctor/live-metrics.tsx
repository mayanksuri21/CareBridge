"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarCheck, ClipboardList, FileText, Users } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type LiveMetricsProps = {
  doctorId: string
  initialTotalAppointments: number
  initialTotalPrescriptions: number
  initialTodayAppointments: number
  initialTodayCompleted: number
}

function todayRangeISO() {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { startISO: start.toISOString(), endISO: end.toISOString() }
}

export function LiveMetrics({
  doctorId,
  initialTotalAppointments,
  initialTotalPrescriptions,
  initialTodayAppointments,
  initialTodayCompleted,
}: LiveMetricsProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [totalAppointments, setTotalAppointments] = useState(initialTotalAppointments)
  const [totalPrescriptions, setTotalPrescriptions] = useState(initialTotalPrescriptions)
  const [todayAppointments, setTodayAppointments] = useState(initialTodayAppointments)
  const [todayCompleted, setTodayCompleted] = useState(initialTodayCompleted)

  const refresh = useCallback(async () => {
    const { startISO, endISO } = todayRangeISO()

    const [
      { count: totalApt },
      { count: totalRx },
      { count: todayApt },
      { count: todayDone },
    ] = await Promise.all([
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", doctorId),
      supabase
        .from("prescriptions")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", doctorId),
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .gte("created_at", startISO)
        .lt("created_at", endISO),
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .eq("status", "completed")
        .gte("created_at", startISO)
        .lt("created_at", endISO),
    ])

    setTotalAppointments(totalApt ?? initialTotalAppointments)
    setTotalPrescriptions(totalRx ?? initialTotalPrescriptions)
    setTodayAppointments(todayApt ?? initialTodayAppointments)
    setTodayCompleted(todayDone ?? initialTodayCompleted)
  }, [
    doctorId,
    supabase,
    initialTotalAppointments,
    initialTotalPrescriptions,
    initialTodayAppointments,
    initialTodayCompleted,
  ])

  useEffect(() => {
    const aptChannel = supabase
      .channel(`doctor-${doctorId}-metrics-appointments`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `doctor_id=eq.${doctorId}`,
        },
        () => void refresh(),
      )
      .subscribe()

    const rxChannel = supabase
      .channel(`doctor-${doctorId}-metrics-prescriptions`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prescriptions",
          filter: `doctor_id=eq.${doctorId}`,
        },
        () => void refresh(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(aptChannel)
      void supabase.removeChannel(rxChannel)
    }
  }, [doctorId, supabase, refresh])

  return (
    <section className="container mx-auto grid gap-4 px-4 pb-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Appointments</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{totalAppointments}</p>
              <p className="mt-1 text-xs text-muted-foreground">All-time consultation count</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Prescriptions Issued</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{totalPrescriptions}</p>
              <p className="mt-1 text-xs text-muted-foreground">Lifetime digital prescriptions</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10">
              <FileText className="h-5 w-5 text-secondary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Today&apos;s Schedule</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{todayAppointments}</p>
              <p className="mt-1 text-xs text-muted-foreground">Appointments booked today</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10">
              <CalendarCheck className="h-5 w-5 text-accent" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completed Today</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{todayCompleted}</p>
              <p className="mt-1 text-xs text-muted-foreground">Consultations marked done</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
