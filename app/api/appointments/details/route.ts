import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateAge } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function getSupabaseClient(authHeader?: string | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceKey) {
    return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  }

  const headers: Record<string, string> = {};
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers },
    auth: { persistSession: false }
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawId = searchParams.get('id');

    if (!rawId) {
      return NextResponse.json({ error: 'Missing appointment ID' }, { status: 400 });
    }

    let id = rawId;
    try { id = decodeURIComponent(id); } catch (_) {}
    id = id.trim().replace(/\s+/g, '-');

    const authHeader = request.headers.get('authorization');
    const supabase = getSupabaseClient(authHeader);

    const { data: appt, error } = await supabase
      .from('appointments')
      .select('id, doctor_id, patient_id, reason, status, symptoms, scheduled_at, appointment_date')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!appt) {
      return NextResponse.json({ appointment: null }, { status: 200 });
    }

    // Fetch authentic patient profile details from profiles table using patient_id
    let patient: any = null;
    if (appt.patient_id) {
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, name, email, phone')
        .eq('id', appt.patient_id)
        .maybeSingle();

      if (profData) {
        patient = {
          id: profData.id,
          name: profData.name || null,
          email: profData.email || null,
          phone: profData.phone || null
        };
      }
    }

    const formattedAppointment = {
      ...appt,
      patient: patient
    };

    return NextResponse.json({ appointment: formattedAppointment }, { status: 200 });
  } catch (err: any) {
    console.error('Appointments details fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
