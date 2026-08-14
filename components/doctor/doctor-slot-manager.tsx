"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock, CalendarRange, Check, Loader2, CheckCircle2, AlertTriangle, Calendar, CalendarOff, Trash2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type ScheduleItem = {
  schedule_type: 'recurring' | 'specific_date' | 'leave'
  day_of_week?: number // 0 (Sunday) to 6 (Saturday)
  specific_date?: string // 'YYYY-MM-DD'
  slots: string[]
  is_leave?: boolean
}

export const TIME_SLOT_OPTIONS = [
  "09:00 AM",
  "10:30 AM",
  "12:00 PM",
  "02:00 PM",
  "02:30 PM",
  "04:00 PM",
  "05:30 PM",
  "07:00 PM"
]

const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

type DoctorSlotManagerProps = {
  doctorId: string
}

export function DoctorSlotManager({ doctorId }: DoctorSlotManagerProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // All schedules loaded from profiles.about
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([])
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  // Scheduling Configuration States
  const [mode, setMode] = useState<'recurring' | 'specific'>('recurring')
  
  // Recurring state
  const [preset, setPreset] = useState<string>("monfri") // monfri, everyday, custom
  const [customDays, setCustomDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]))
  
  // Specific Date state
  const [specificDate, setSpecificDate] = useState<string>("")
  const [isLeave, setIsLeave] = useState<boolean>(false)
  
  // Active slots for currently configured item
  const [activeSlots, setActiveSlots] = useState<Set<string>>(new Set())

  const todayISO = useMemo(() => {
    return new Date().toISOString().slice(0, 10)
  }, [])

  // Load schedule configuration on dialog mount
  const loadSchedule = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("doctor_schedules, about")
        .eq("id", doctorId)
        .maybeSingle()

      const rawSchedule = data?.doctor_schedules || data?.about
      if (!error && rawSchedule) {
        try {
          const parsed = JSON.parse(rawSchedule)
          if (Array.isArray(parsed)) {
            setScheduleItems(parsed as ScheduleItem[])
          }
        } catch {
          setScheduleItems([])
        }
      }
    } catch (err) {
      console.error("Failed to load schedule:", err)
    } finally {
      setLoading(false)
    }
  }, [doctorId, supabase])

  useEffect(() => {
    if (open) {
      void loadSchedule()
      setSpecificDate(todayISO)
      setActiveSlots(new Set())
    }
  }, [open, todayISO, loadSchedule])

  const toggleSlot = (slot: string) => {
    setSavedMessage(null)
    setActiveSlots((prev) => {
      const next = new Set(prev)
      if (next.has(slot)) next.delete(slot)
      else next.add(slot)
      return next
    })
  }

  const toggleCustomDay = (day: number) => {
    setCustomDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  const saveConfig = async () => {
    setSaving(true)
    setSavedMessage(null)
    try {
      let updated = [...scheduleItems]

      if (mode === 'recurring') {
        let targetDays: number[] = []
        if (preset === "monfri") {
          targetDays = [1, 2, 3, 4, 5]
        } else if (preset === "everyday") {
          targetDays = [0, 1, 2, 3, 4, 5, 6]
        } else {
          targetDays = Array.from(customDays)
        }

        if (targetDays.length === 0) {
          toast.error("Please select at least one day.")
          setSaving(false)
          return
        }

        const slots = Array.from(activeSlots)
        if (slots.length === 0) {
          toast.error("Please select at least one time slot.")
          setSaving(false)
          return
        }

        // Filter out old recurring items for the targeted days
        updated = updated.filter(
          item => !(item.schedule_type === 'recurring' && targetDays.includes(item.day_of_week!))
        )

        // Insert new recurring configurations
        for (const day of targetDays) {
          updated.push({
            schedule_type: 'recurring',
            day_of_week: day,
            slots
          })
        }
        setSavedMessage("Recurring schedule templates saved successfully!")
      } else {
        if (!specificDate) {
          toast.error("Please select a valid date.")
          setSaving(false)
          return
        }

        // Filter out old overrides for this date
        updated = updated.filter(item => !(item.specific_date === specificDate))

        if (isLeave) {
          updated.push({
            schedule_type: 'leave',
            specific_date: specificDate,
            is_leave: true,
            slots: []
          })
          setSavedMessage(`Marked ${specificDate} as Leave`)
        } else {
          const slots = Array.from(activeSlots)
          if (slots.length === 0) {
            toast.error("Please select at least one time slot or mark as leave.")
            setSaving(false)
            return
          }
          updated.push({
            schedule_type: 'specific_date',
            specific_date: specificDate,
            is_leave: false,
            slots
          })
          setSavedMessage(`Saved slots override for ${specificDate}`)
        }
      }

      // Save serialized configuration in profiles.doctor_schedules
      const { error } = await supabase
        .from("profiles")
        .update({ doctor_schedules: JSON.stringify(updated) })
        .eq("id", doctorId)

      if (error) throw error

      setScheduleItems(updated)
      toast.success("Schedule configuration saved successfully.")
      setActiveSlots(new Set())
    } catch (err) {
      console.error(err)
      toast.error("Unable to save schedule configuration. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (index: number) => {
    try {
      const updated = scheduleItems.filter((_, idx) => idx !== index)
      const { error } = await supabase
        .from("profiles")
        .update({ doctor_schedules: JSON.stringify(updated) })
        .eq("id", doctorId)

      if (error) throw error

      setScheduleItems(updated)
      toast.success("Schedule item removed.")
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete item.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-primary" /> Schedule & Leave Manager
            </CardTitle>
            <CardDescription>
              Configure templates, specific date overrides, and leaves for patient booking.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Clock className="h-4 w-4" /> Set Availability
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configure Availability Rules</DialogTitle>
                <DialogDescription>
                  Create recurring clinic hours or override availability on specific dates.
                </DialogDescription>
              </DialogHeader>

              {/* Mode Select */}
              <div className="grid grid-cols-2 gap-2 p-1 border rounded-lg bg-muted/30">
                <button
                  type="button"
                  onClick={() => { setMode('recurring'); setActiveSlots(new Set()); setSavedMessage(null) }}
                  className={`py-1.5 text-sm font-medium rounded-md transition-colors ${
                    mode === 'recurring' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Recurring Presets
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('specific'); setActiveSlots(new Set()); setSavedMessage(null) }}
                  className={`py-1.5 text-sm font-medium rounded-md transition-colors ${
                    mode === 'specific' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Date Override / Leave
                </button>
              </div>

              <div className="space-y-4 py-2">
                {/* Recurring Options */}
                {mode === 'recurring' ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Preset Interval</Label>
                      <Select value={preset} onValueChange={setPreset}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select preset" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monfri">Monday to Friday</SelectItem>
                          <SelectItem value="everyday">Every Day (Mon - Sun)</SelectItem>
                          <SelectItem value="custom">Custom Selection</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {preset === "custom" && (
                      <div className="space-y-2 border rounded-lg p-3">
                        <Label className="block mb-2">Days of Week</Label>
                        <div className="flex flex-wrap gap-2">
                          {dayLabels.map((label, idx) => {
                            const active = customDays.has(idx)
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() => toggleCustomDay(idx)}
                                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                                  active
                                    ? "bg-primary/10 border-primary text-primary"
                                    : "border-muted text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                {label.slice(0, 3)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Specific Date Options
                  <div className="space-y-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Target Date</Label>
                        <Input
                          type="date"
                          min={todayISO}
                          value={specificDate}
                          onChange={(e) => setSpecificDate(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Leave Toggle */}
                    <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-4">
                      <div className="space-y-0.5">
                        <Label htmlFor="leave-toggle" className="text-sm font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          Mark Selected Date as Leave / Unavailable
                        </Label>
                        <span className="text-xs text-muted-foreground block">
                          Patient bookings will be disabled for this full date.
                        </span>
                      </div>
                      <Switch
                        id="leave-toggle"
                        checked={isLeave}
                        onCheckedChange={setIsLeave}
                      />
                    </div>
                  </div>
                )}

                {/* Time Slots Selector Grid */}
                {(!isLeave || mode === 'recurring') && (
                  <div className="space-y-2">
                    <Label>Select Time Slots</Label>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                      {TIME_SLOT_OPTIONS.map((slot) => {
                        const active = activeSlots.has(slot)
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => toggleSlot(slot)}
                            className={`flex items-center justify-center py-2.5 border text-xs font-semibold rounded-lg transition-all ${
                              active
                                ? "bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-400"
                                : "bg-slate-800/80 text-slate-200 border-slate-700 hover:border-emerald-500/50"
                            }`}
                          >
                            {slot}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {savedMessage && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {savedMessage}
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
                <div className="flex gap-2 w-full justify-end">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Close
                  </Button>
                  <Button
                    onClick={saveConfig}
                    disabled={saving || loading}
                    className="gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" /> Save Schedule Rule
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
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading schedule configuration...
          </div>
        ) : scheduleItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Clock className="h-6 w-6 text-muted-foreground/60" />
            No custom schedule configurations saved.
            <Button variant="link" size="sm" onClick={() => setOpen(true)} className="text-underline mt-1">
              Click here to set your schedule →
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Show Recurring schedule summaries */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recurring Presets</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {scheduleItems
                  .filter((i) => i.schedule_type === 'recurring')
                  .map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between border rounded-lg p-3 bg-muted/10">
                      <div>
                        <span className="text-sm font-semibold block">{dayLabels[item.day_of_week!]}s</span>
                        <span className="text-xs text-muted-foreground">{item.slots.join(", ")}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => deleteItem(scheduleItems.indexOf(item))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Show Leaves and Date Overrides */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Leave and Date Overrides</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {scheduleItems
                  .filter((i) => i.schedule_type === 'specific_date' || i.schedule_type === 'leave')
                  .map((item, idx) => (
                    <div key={idx} className={`flex items-center justify-between border rounded-lg p-3 ${
                      item.is_leave ? "border-amber-500/20 bg-amber-500/5" : "bg-muted/10"
                    }`}>
                      <div>
                        <div className="flex items-center gap-2">
                          {item.is_leave ? (
                            <CalendarOff className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Calendar className="h-4 w-4 text-primary" />
                          )}
                          <span className="text-sm font-semibold">{item.specific_date}</span>
                          {item.is_leave && <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold border-amber-500/20">Leave</Badge>}
                        </div>
                        {!item.is_leave && (
                          <span className="text-xs text-muted-foreground mt-1 block">{item.slots.join(", ")}</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => deleteItem(scheduleItems.indexOf(item))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
