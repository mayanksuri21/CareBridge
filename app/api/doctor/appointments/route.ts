import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctor_id');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { auth: { persistSession: false } }
    );

    let query = supabase
      .from('appointments')
      .select(`
        id,
        doctor_id,
        patient_id,
        status,
        reason,
        created_at,
        slot_id,
        patient:profiles!patient_id (
          id,
          name,
          email,
          phone
        )
      `)
      .in('status', ['scheduled', 'pending', 'in_progress', 'booked'])
      .order('created_at', { ascending: false });

    if (doctorId) {
      query = query.or(`doctor_id.eq.${doctorId},doctor_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const mapped = (data || []).map((appt: any) => {
      const isCallActive = appt.reason?.includes('[CALL_ACTIVE]') || false;
      let cleanReason = appt.reason || '';
      if (isCallActive) {
        cleanReason = cleanReason.replace(' [CALL_ACTIVE]', '').replace('[CALL_ACTIVE]', '');
      }

      // Parse symptoms, date and time from reason dynamically
      const dateMatch = cleanReason.match(/Selected Date:\s*([\w\d, -]+)/i) || cleanReason.match(/Preferred Date:\s*([\w\d, -]+)/i);
      const timeMatch = cleanReason.match(/Time Slot:\s*([\w\d: ]+)/i);
      const symptomsMatch = cleanReason.match(/Symptoms:\s*([\s\S]*)/i);

      const scheduledDate = dateMatch ? dateMatch[1].trim() : '17-08-2026';
      const scheduledTime = timeMatch ? timeMatch[1].trim() : '12:00 PM';
      const symptomsText = symptomsMatch ? symptomsMatch[1].trim() : '';

      return {
        ...appt,
        status: isCallActive ? 'in_progress' : (appt.status === 'booked' ? 'scheduled' : appt.status),
        call_active: isCallActive,
        reason: cleanReason,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        symptoms: symptomsText
      };
    });

    return new NextResponse(JSON.stringify({ appointments: mapped }), {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  } catch (err: any) {
    console.error("GET doctor appointments error:", err.message);
    return NextResponse.json({ appointments: [] });
  }
}