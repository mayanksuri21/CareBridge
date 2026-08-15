import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { appointment_id, action } = await request.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const isStart = action === 'start';

    // 1. Fetch current appointment details to preserve reason
    const { data: currentAppt } = await supabase
      .from('appointments')
      .select('reason, status')
      .eq('id', appointment_id)
      .maybeSingle();

    if (!currentAppt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    let reasonText = currentAppt.reason || '';
    if (isStart) {
      if (!reasonText.includes('[CALL_ACTIVE]')) {
        reasonText = reasonText ? `${reasonText} [CALL_ACTIVE]` : '[CALL_ACTIVE]';
      }
      
      // Update reason to mark call as active
      const { data, error } = await supabase
        .from('appointments')
        .update({ reason: reasonText })
        .eq('id', appointment_id)
        .select();

      if (error) console.warn("Start call update warning:", error);
    } else {
      // Remove CALL_ACTIVE marker and mark status as completed
      if (reasonText.includes('[CALL_ACTIVE]')) {
        reasonText = reasonText.replace(' [CALL_ACTIVE]', '').replace('[CALL_ACTIVE]', '');
      }

      const { data, error } = await supabase
        .from('appointments')
        .update({
          reason: reasonText,
          status: 'completed'
        })
        .eq('id', appointment_id)
        .select();

      if (error) console.warn("End call update warning:", error);
    }

    return NextResponse.json({ 
      success: true, 
      status: isStart ? 'in_progress' : 'completed',
      appointment_id 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const appointment_id = searchParams.get('appointment_id');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const mapAppointment = (appt: any) => {
      if (!appt) return null;
      const isCallActive = appt.reason?.includes('[CALL_ACTIVE]') || false;
      let cleanReason = appt.reason || '';
      if (isCallActive) {
        cleanReason = cleanReason.replace(' [CALL_ACTIVE]', '').replace('[CALL_ACTIVE]', '');
      }
      return {
        ...appt,
        status: isCallActive ? 'in_progress' : (appt.status === 'booked' ? 'scheduled' : appt.status),
        call_active: isCallActive,
        reason: cleanReason
      };
    };

    if (appointment_id) {
      const { data } = await supabase.from('appointments').select('*').eq('id', appointment_id).maybeSingle();
      return NextResponse.json({ appointment: mapAppointment(data) });
    }

    const { data } = await supabase.from('appointments').select('*').order('created_at', { ascending: false });
    const mapped = (data || []).map(mapAppointment);
    return NextResponse.json({ appointments: mapped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
