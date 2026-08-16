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

    // 1. Fetch current appointment details
    const { data: currentAppt } = await supabase
      .from('appointments')
      .select('reason, status')
      .eq('id', appointment_id)
      .maybeSingle();

    if (!currentAppt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    let reasonText = currentAppt.reason || '';
    let statusText = currentAppt.status || 'booked';

    const tags = ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]'];
    const removeTags = (text: string) => {
      let t = text;
      tags.forEach(tag => {
        t = t.replace(` ${tag}`, '').replace(tag, '');
      });
      return t;
    };

    let cleanReason = removeTags(reasonText);

    if (action === 'start') {
      reasonText = `${cleanReason} [DOCTOR_IN_ROOM] [CALL_ACTIVE]`;
      statusText = 'booked';
    } else if (action === 'join_waiting') {
      reasonText = `${cleanReason} [PATIENT_WAITING] [CALL_ACTIVE]`;
      statusText = 'booked';
    } else if (action === 'admit') {
      reasonText = `${cleanReason} [PATIENT_ADMITTED] [CALL_ACTIVE]`;
      statusText = 'booked';
    } else if (action === 'decline_admission') {
      reasonText = `${cleanReason} [PATIENT_DECLINED]`;
      statusText = 'declined';
    } else if (action === 'end' || action === 'complete') {
      reasonText = cleanReason;
      statusText = 'completed';
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({
        reason: reasonText,
        status: statusText
      })
      .eq('id', appointment_id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Update appointment call status error:", error.message);
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      status: statusText,
      reason: reasonText,
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
      const reasonStr = appt.reason || '';
      
      const isDoctorInRoom = reasonStr.includes('[DOCTOR_IN_ROOM]');
      const isPatientWaiting = reasonStr.includes('[PATIENT_WAITING]');
      const isPatientAdmitted = reasonStr.includes('[PATIENT_ADMITTED]');
      const isPatientDeclined = reasonStr.includes('[PATIENT_DECLINED]');
      const isCallActive = reasonStr.includes('[CALL_ACTIVE]');
      const isPendingApprovalTag = reasonStr.includes('[PENDING_APPROVAL]');

      let cleanReason = reasonStr;
      ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]'].forEach(tag => {
        cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '');
      });

      let statusVal = appt.status;
      if (isPatientAdmitted) {
        statusVal = 'patient_admitted';
      } else if (isPatientWaiting) {
        statusVal = 'patient_waiting';
      } else if (isDoctorInRoom) {
        statusVal = 'doctor_in_room';
      } else if (isCallActive) {
        statusVal = 'in_progress';
      } else if (appt.status === 'pending' || (appt.status === 'booked' && isPendingApprovalTag)) {
        statusVal = 'pending';
      } else if (appt.status === 'booked' || appt.status === 'scheduled') {
        statusVal = 'scheduled';
      } else if (appt.status === 'cancelled' || appt.status === 'rejected') {
        statusVal = 'declined';
      }

      return {
        ...appt,
        status: statusVal,
        call_active: isCallActive || isDoctorInRoom || isPatientWaiting || isPatientAdmitted,
        reason: cleanReason,
        is_doctor_in_room: isDoctorInRoom,
        is_patient_waiting: isPatientWaiting,
        is_patient_admitted: isPatientAdmitted,
        is_patient_declined: isPatientDeclined
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
