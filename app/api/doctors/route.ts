export const dynamic = 'force-dynamic';
import { NextResponse, NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

export async function GET(request: NextRequest) {
  const supabase = getAdminClient()

  try {
    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get('doctorId')
    const date = searchParams.get('date')

    // If querying slots for a specific doctor (and optionally a specific date)
    if (doctorId) {
      // Read the doctor's recurring template from profiles.schedule_presets
      const { data: profile } = await supabase
        .from('profiles')
        .select('schedule_presets, schedule_config')
        .eq('id', doctorId)
        .maybeSingle();

      const stored = profile?.schedule_presets || profile?.schedule_config;
      const parsed = stored
        ? (typeof stored === 'string' ? JSON.parse(stored) : stored)
        : [];
      const presets = Array.isArray(parsed) ? parsed : [];

      // Extract all time slot labels from the presets
      const activeSlots: string[] = [];
      for (const preset of presets) {
        if (Array.isArray(preset.slots)) {
          for (const slot of preset.slots) {
            if (slot && !activeSlots.includes(slot)) {
              activeSlots.push(slot);
            }
          }
        }
      }

      return NextResponse.json({ slots: activeSlots.map(s => ({ label: s })) })
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

    // Read all doctors' schedule_presets in bulk
    const doctorIds = (doctorsData || []).map((d: any) => d.id);
    const doctorPresetsMap = new Map<string, string[]>();

    if (doctorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, schedule_presets, schedule_config')
        .in('id', doctorIds);

      for (const prof of (profiles || [])) {
        const stored = (prof as any).schedule_presets || (prof as any).schedule_config;
        if (!stored) continue;
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
        const presets = Array.isArray(parsed) ? parsed : [];
        const slots: string[] = [];
        for (const preset of presets) {
          if (Array.isArray(preset.slots)) {
            for (const slot of preset.slots) {
              if (slot && !slots.includes(slot)) {
                slots.push(slot);
              }
            }
          }
        }
        if (slots.length > 0) {
          doctorPresetsMap.set(prof.id, slots);
        }
      }
    }

    const formatted = (doctorsData || []).map((doc: any) => {
      const activeSlots = doctorPresetsMap.get(doc.id) || [];

      return {
        id: doc.id,
        name: doc.name || 'Dr. ' + (doc.email?.split('@')[0] || 'Doctor'),
        specialty: doc.specialty || 'General Practitioner',
        available_slots: activeSlots,
        active_slots: activeSlots
      }
    })

    return NextResponse.json({ doctors: formatted })
  } catch (err: any) {
    console.error("Route handler error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
