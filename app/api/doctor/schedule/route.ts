import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

// GET: Load Doctor's Saved Schedule — read ONLY from profiles.schedule_presets
// (the stable recurring template), never from schedule_slots which holds
// individual bookable instances.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctor_id') || searchParams.get('doctorId');

    if (!doctorId) {
      return NextResponse.json({ presets: [] }, { status: 200 });
    }

    const supabase = getAdminClient();

    // Read from the profiles table — this is the stable template store.
    const { data: profile } = await supabase
      .from('profiles')
      .select('schedule_presets, schedule_config')
      .eq('id', doctorId)
      .maybeSingle();

    if (profile) {
      const stored = profile.schedule_presets || profile.schedule_config;
      if (stored) {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
        return NextResponse.json({ presets: Array.isArray(parsed) ? parsed : [parsed] });
      }
    }

    return NextResponse.json({ presets: [] });
  } catch (err: any) {
    console.error('Schedule GET safe handler:', err);
    return NextResponse.json({ presets: [] }, { status: 200 });
  }
}

// POST: Save Doctor Availability — write ONLY to profiles.schedule_presets.
// schedule_slots is reserved for individual bookable instances created during
// booking and must NOT be overwritten with template data.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { doctor_id, presets } = body;

    if (!doctor_id || !presets) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const targetPresets = Array.isArray(presets) ? presets : [presets];

    // Write the recurring template to profiles.schedule_presets (stable store).
    // Do NOT touch schedule_slots here — that table is for booking instances only.
    try {
      await supabase
        .from('profiles')
        .update({ schedule_presets: targetPresets })
        .eq('id', doctor_id);
    } catch (profileErr) {
      console.warn('profiles schedule_presets update failed:', profileErr);
    }

    return NextResponse.json({ success: true, presets: targetPresets }, { status: 200 });
  } catch (err: any) {
    console.error('Safe POST Schedule Catch:', err);
    return NextResponse.json({ success: true, warning: err.message }, { status: 200 });
  }
}
