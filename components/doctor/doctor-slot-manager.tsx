"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Clock, Check, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type ScheduleItem = {
  schedule_type?: 'recurring' | 'specific_date' | 'leave'
  day_of_week?: number // 0 (Sunday) to 6 (Saturday)
  specific_date?: string // 'YYYY-MM-DD'
  slots: string[]
  is_leave?: boolean
  interval?: string
  updated_at?: string
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
  open: boolean
  onOpenChange: (open: boolean) => void
  savedSchedule: ScheduleItem[]
  onSuccess: (updatedPresets: ScheduleItem[]) => void
}

export function DoctorSlotManager({
  doctorId,
  open,
  onOpenChange,
  savedSchedule,
  onSuccess
}: DoctorSlotManagerProps) {
  const [saving, setSaving] = useState(false)
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
  
  // Active Slots Selection
  const [activeSlots, setActiveSlots] = useState<Set<string>>(new Set())

  // Reset/sync local state with parent savedSchedule when the modal opens
  useEffect(() => {
    if (open) {
      setScheduleItems(savedSchedule)
      setSavedMessage(null)
      setMode('recurring')
      setPreset('monfri')
      setCustomDays(new Set([1, 2, 3, 4, 5]))
      setSpecificDate('')
      setIsLeave(false)
      setActiveSlots(new Set())
    }
  }, [open, savedSchedule])

  const todayISO = useMemo(() => {
    return new Date().toISOString().slice(0, 10)
  }, [])

  const toggleSlot = (slot: string) => {
    const next = new Set(activeSlots)
    if (next.has(slot)) {
      next.delete(slot)
    } else {
      next.add(slot)
    }
    setActiveSlots(next)
  }

  const toggleCustomDay = (dayIdx: number) => {
    const next = new Set(customDays)
    if (next.has(dayIdx)) {
      next.delete(dayIdx)
    } else {
      next.add(dayIdx)
    }
    setCustomDays(next)
  }

  const saveConfig = async () => {
    setSaving(true)
    setSavedMessage(null)

    try {
      const selectedTimeSlots = Array.from(activeSlots)
      let selectedInterval = 'Monday to Friday'

      if (mode === 'recurring') {
        if (preset === 'monfri') {
          selectedInterval = 'Monday to Friday'
        } else if (preset === 'everyday') {
          selectedInterval = 'Every Day'
        } else {
          const selectedDayNames = Array.from(customDays)
            .sort((a, b) => a - b)
            .map(d => dayLabels[d])
          selectedInterval = selectedDayNames.join(', ')
        }

        if (selectedTimeSlots.length === 0) {
          toast.error("Please select at least one time slot.")
          setSaving(false)
          return
        }
      } else {
        if (!specificDate) {
          toast.error("Please select a valid date.")
          setSaving(false)
          return
        }
        selectedInterval = specificDate
        if (!isLeave && selectedTimeSlots.length === 0) {
          toast.error("Please select at least one time slot or mark as leave.")
          setSaving(false)
          return
        }
      }

      const newPreset = {
        interval: selectedInterval,
        slots: isLeave && mode === 'specific' ? [] : selectedTimeSlots,
        updated_at: new Date().toISOString()
      }

      // Save to localStorage immediately as an instant cache
      localStorage.setItem(`doctor_schedule_${doctorId}`, JSON.stringify([newPreset]))

      // Send POST fetch request to the server API
      const response = await fetch("/api/doctor/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_id: doctorId, presets: [newPreset] })
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || "Failed to save schedule")
      }

      onSuccess([newPreset]) // Instantly update dashboard client state
      toast.success("Schedule configuration saved successfully.")
      onOpenChange(false) // Close modal dialog instantly
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Unable to save schedule configuration. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={saveConfig}
              disabled={saving}
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
  )
}
