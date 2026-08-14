import { NextResponse, NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

type ScheduleItem = {
  schedule_type: 'recurring' | 'specific_date' | 'leave'
  day_of_week?: number // 0 (Sunday) to 6 (Saturday)
  specific_date?: string // 'YYYY-MM-DD'
  slots: string[]
  is_leave?: boolean
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  try {
    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get('doctorId')
    const date = searchParams.get('date')

    if (!doctorId || !date) {
      return NextResponse.json({ error: "Missing doctorId or date" }, { status: 400 })
    }

    // Query profiles.doctor_schedules which contains the doctor's serialized schedule
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('doctor_schedules, about')
      .eq('id', doctorId)
      .maybeSingle()

    if (profileErr) {
      console.error("Error fetching profiles:", profileErr)
      return NextResponse.json({ error: profileErr.message }, { status: 500 })
    }

    let config: ScheduleItem[] = []
    const scheduleData = profile?.doctor_schedules || profile?.about
    if (scheduleData) {
      try {
        config = JSON.parse(scheduleData)
      } catch {
        config = []
      }
    }

    if (!Array.isArray(config)) {
      config = []
    }

    // Rule 1: Check for explicit Leave record on date
    const leaveRecord = config.find(
      (item) => item.schedule_type === 'leave' && item.specific_date === date && item.is_leave === true
    )
    if (leaveRecord) {
      return NextResponse.json({ isLeave: true, slots: [], message: "Doctor is on leave on this date." })
    }

    // Rule 2: Check for explicit date override with slots for that date
    const dateOverride = config.find(
      (item) => item.schedule_type === 'specific_date' && item.specific_date === date
    )
    if (dateOverride) {
      return NextResponse.json({ isLeave: false, slots: dateOverride.slots })
    }

    // Rule 3: Fallback to recurring day of week preset
    const [year, month, day] = date.split('-').map(Number)
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()

    const recurringPreset = config.find(
      (item) => item.schedule_type === 'recurring' && item.day_of_week === dayOfWeek
    )
    if (recurringPreset) {
      return NextResponse.json({ isLeave: false, slots: recurringPreset.slots })
    }

    // Default: No configurations exist
    return NextResponse.json({ isLeave: false, slots: [] })
  } catch (err: any) {
    console.error("GET slots error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
