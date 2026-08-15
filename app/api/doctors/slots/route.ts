import { NextResponse, NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

function parseDateSafely(dateStr: string): Date | null {
  if (!dateStr) return null;
  let dateObj: Date;
  
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      // DD-MM-YYYY
      dateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
  } else {
    dateObj = new Date(dateStr);
  }
  
  return isNaN(dateObj.getTime()) ? null : dateObj;
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

    const dateObj = parseDateSafely(date);
    if (!dateObj) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
    }

    const dayOfWeek = dateObj.getDay(); // 0 (Sunday) to 6 (Saturday)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[dayOfWeek];

    // Query profiles which contains the doctor's serialized schedule
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('schedule_presets, schedule_config, doctor_schedules, about')
      .eq('id', doctorId)
      .maybeSingle()

    if (profileErr) {
      console.error("Error fetching profiles:", profileErr)
      return NextResponse.json({ error: profileErr.message }, { status: 500 })
    }

    let config: any[] = []
    const scheduleData = profile?.schedule_presets || profile?.schedule_config || profile?.doctor_schedules || profile?.about
    if (scheduleData) {
      try {
        config = typeof scheduleData === 'string' ? JSON.parse(scheduleData) : scheduleData
      } catch {
        config = []
      }
    }

    if (!Array.isArray(config)) {
      config = []
    }

    // 1. Check for explicit leave (new preset or legacy structure)
    const isExplicitLeave = config.some((item: any) => {
      if (!item) return false;
      // New presets structure leave check
      if (item.interval === date && (!item.slots || item.slots.length === 0)) return true;
      // Legacy structure leave check
      if (item.schedule_type === 'leave' && item.specific_date === date && item.is_leave === true) return true;
      return false;
    });

    if (isExplicitLeave) {
      return NextResponse.json({ isLeave: true, slots: [], message: "Doctor is on leave on this date." })
    }

    // 2. Check for specific date slot overrides
    const specificOverride = config.find((item: any) => {
      if (!item) return false;
      if (item.interval === date && item.slots && item.slots.length > 0) return true;
      if (item.schedule_type === 'specific_date' && item.specific_date === date && item.slots && item.slots.length > 0) return true;
      return false;
    });

    if (specificOverride) {
      return NextResponse.json({ isLeave: false, slots: specificOverride.slots });
    }

    // 3. Check for day of week preset in config (recurring or intervals like "Monday to Friday")
    const matchingPreset = config.find((item: any) => {
      if (!item) return false;
      
      // New presets structure interval check
      if (item.interval) {
        const intervalLower = item.interval.toLowerCase();
        if (intervalLower === "every day" || intervalLower === "everyday") return true;
        if (intervalLower === "monday to friday") {
          return dayOfWeek >= 1 && dayOfWeek <= 5;
        }
        return intervalLower.includes(dayName.toLowerCase());
      }

      // Legacy structure day of week check
      if (item.schedule_type === 'recurring' && item.day_of_week === dayOfWeek) {
        return true;
      }

      return false;
    });

    if (matchingPreset && matchingPreset.slots && matchingPreset.slots.length > 0) {
      return NextResponse.json({ isLeave: false, slots: matchingPreset.slots });
    }

    // 4. Default template match: Monday to Friday standard clinical hours
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const DEFAULT_WEEKDAY_SLOTS = [
        "09:00 AM", "10:30 AM", "12:00 PM", "02:30 PM", "04:00 PM", "05:30 PM", "07:00 PM"
      ];
      return NextResponse.json({ isLeave: false, slots: DEFAULT_WEEKDAY_SLOTS });
    }

    // Default: No configurations exist
    return NextResponse.json({ isLeave: false, slots: [] })
  } catch (err: any) {
    console.error("GET slots error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
