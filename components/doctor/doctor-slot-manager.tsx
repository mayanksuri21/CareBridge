"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock, CalendarRange, Check, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export type SavedSlot = {
  label: string
  hour: number
  minute: number
  durationMin: number
}

export const DEFAULT_SLOT_OPTIONS: SavedSlot[] = [
  { label: "09:00 AM", hour: 9, minute: 0, durationMin: 45 },
  { label: "10:30 AM", hour: 10, minute: 30, durationMin: 45 },
  { label: "11:00 AM", hour: 11, minute: 0, durationMin: 45 },
  { label: "12:00 PM", hour: 12, minute: 0, durationMin: 45 },
  { label: "02:00 PM", hour: 14, minute: 0, durationMin: 45 },
  { label: "02:30 PM", hour: 14, minute: 30, durationMin: 45 },
  { label: "04:00 PM", hour: 16, minute: 0, durationMin: 45 },
  { label: "05:00 PM", hour: 17, minute: 0, durationMin: 45 },
  { label: "05:30 PM", hour: 17, minute: 30, durationMin: 45 },
  { label: "07:00 PM", hour: 19, minute: 0, durationMin: 45 },
  { label: "07:30 PM", hour: 19, minute: 30, durationMin: 45 },
  { label: "08:30 PM", hour: 20, minute: 30, durationMin: 45 },
]

type DoctorSlotManagerProps = {
  doctorId: string
  initialSavedSlots?: SavedSlot[]
}

export function DoctorSlotManager({ doctorId, initialSavedSlots = [] }: DoctorSlotManagerProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeLabels, setActiveLabels] = useState<Set<string>>(new Set())
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoading(true)
      try {
        if (initialSavedSlots.length > 0) {
          setActiveLabels(new Set(initialSavedSlots.map((s) => s.label)))
          return
        }
        const { data, error } = await supabase
          .from("doctors")
          .select("available_slots")
          .eq("id", doctorId)
          .maybeSingle()
        if (!error && data && Array.isArray((data as any).available_slots)) {
          setActiveLabels(new Set((data as any).available_slots.map((s: SavedSlot) => s.label)))
        } else if (error) {
          const { data: profileData, error: profileErr } = await supabase
            .from("profiles")
            .select("available_slots")
            .eq("id", doctorId)
            .maybeSingle()
          if (!profileErr && profileData && Array.isArray((profileData as any).available_slots)) {
            setActiveLabels(new Set((profileData as any).available_slots.map((s: SavedSlot) => s.label)))
          }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, doctorId, initialSavedSlots, supabase])

  const toggleSlot = (label: string) => {
    setSavedMessage(null)
    setActiveLabels((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const saveSlots = useCallback(async () => {
    setSaving(true)
    setSavedMessage(null)
    try {
      const selectedSlots = DEFAULT_SLOT_OPTIONS.filter((slot) => activeLabels.has(slot.label))
      const updatePayload = { available_slots: selectedSlots } as any

      const { error } = await supabase.from("doctors").update(updatePayload).eq("id", doctorId)
      if (error) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ available_slots: selectedSlots })
          .eq("id", doctorId)
        if (profileErr) throw profileErr
      }

      setSavedMessage(`Saved ${selectedSlots.length} available time slots`)
      toast.success("Available slots updated. Patients will now see these times when booking.")
    } catch (err) {
      console.error(err)
      toast.error("Unable to save slots. Please try again.")
    } finally {
      setSaving(false)
    }
  }, [doctorId, activeLabels, supabase])

  const activeCount = activeLabels.size

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-primary" /> Available Slots
            </CardTitle>
            <CardDescription>
              Patients see these times when booking you. Active slots: <span className="font-medium text-foreground">{activeCount}</span>
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Clock className="h-4 w-4" /> Set Available Slots
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Set Your Available Hours</DialogTitle>
                <DialogDescription>
                  Toggle the time slots you are available for consultations. These are the hours patients can request.
                </DialogDescription>
              </DialogHeader>
              <Card className="border-muted/50">
                <CardContent className="p-5">
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading current slots...
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {DEFAULT_SLOT_OPTIONS.map((slot) => {
                        const active = activeLabels.has(slot.label)
                        return (
                          <div
                            key={slot.label}
                            className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-all ${
                              active ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Clock className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                              <Label
                                htmlFor={`slot-${slot.label}`}
                                className={`text-sm ${active ? "font-medium text-foreground" : ""}`}
                              >
                                {slot.label}
                              </Label>
                            </div>
                            <Switch
                              id={`slot-${slot.label}`}
                              checked={active}
                              onCheckedChange={() => toggleSlot(slot.label)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {savedMessage && (
                    <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" /> {savedMessage}
                    </div>
                  )}
                </CardContent>
              </Card>
              <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {activeCount} of {DEFAULT_SLOT_OPTIONS.length} slots selected
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Close
                  </Button>
                  <Button
                    onClick={saveSlots}
                    disabled={saving || loading}
                    className="gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" /> Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {activeCount === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Clock className="h-6 w-6 text-muted-foreground/60" />
            No available slots configured yet.
            <Button variant="link" size="sm" onClick={() => setOpen(true)} className="text-underline mt-1">
              Click here to set your availability →
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {DEFAULT_SLOT_OPTIONS.filter((s) => activeLabels.has(s.label)).map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
              >
                <Check className="h-3 w-3" /> {s.label}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
