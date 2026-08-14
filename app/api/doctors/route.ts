import { NextResponse, NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

function formatTime(isoString: string) {
  const date = new Date(isoString)
  let hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12 // the hour '0' should be '12'
  const strMinutes = minutes < 10 ? '0' + minutes : minutes
  return `${hours.toString().padStart(2, '0')}:${strMinutes} ${ampm}`
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

    // If querying slots for a specific doctor (and optionally a specific date)
    if (doctorId) {
      let query = supabase
        .from('schedule_slots')
        .select('id, start_time, end_time, is_booked')
        .eq('doctor_id', doctorId)

      if (date) {
        const startOfDay = `${date}T00:00:00.000Z`
        const endOfDay = `${date}T23:59:59.999Z`
        query = query.gte('start_time', startOfDay).lte('start_time', endOfDay)
      }

      const { data: slots, error: slotsError } = await query.order('start_time', { ascending: true })

      if (slotsError) {
        console.error("Error fetching slots:", slotsError)
        return NextResponse.json({ error: slotsError.message }, { status: 500 })
      }

      const formattedSlots = (slots || []).map((s: any) => ({
        id: s.id,
        label: formatTime(s.start_time),
        start_time: s.start_time,
        end_time: s.end_time,
        is_booked: s.is_booked
      }))

      return NextResponse.json({ slots: formattedSlots })
    }

    // Default: Fetch all doctors list
    const { data: doctorsData, error: doctorsError } = await supabase
      .from('profiles')
      .select('id, name, email, specialty, role')
      .eq('role', 'doctor')

    if (doctorsError) {
      console.error("Error fetching doctors:", doctorsError)
      return NextResponse.json({ error: doctorsError.message }, { status: 500 })
    }

    const { data: slots, error: slotsError } = await supabase
      .from('schedule_slots')
      .select('doctor_id, start_time')
      .order('start_time', { ascending: true })

    const doctorSlotsMap = new Map<string, string[]>()
    if (slots && !slotsError) {
      for (const slot of slots) {
        if (!slot.doctor_id || !slot.start_time) continue
        const formattedTime = formatTime(slot.start_time)
        const list = doctorSlotsMap.get(slot.doctor_id) || []
        if (!list.includes(formattedTime)) {
          list.push(formattedTime)
        }
        doctorSlotsMap.set(slot.doctor_id, list)
      }
    }

    const formatted = (doctorsData || []).map((doc: any) => {
      const slotsFromDB = doctorSlotsMap.get(doc.id) || []

      return {
        id: doc.id,
        name: doc.name || 'Dr. ' + (doc.email?.split('@')[0] || 'Doctor'),
        specialty: doc.specialty || 'General Practitioner',
        available_slots: slotsFromDB,
        active_slots: slotsFromDB
      }
    })

    return NextResponse.json({ doctors: formatted })
  } catch (err: any) {
    console.error("Route handler error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
