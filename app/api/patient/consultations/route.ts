import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false });

    const formatted = (data || []).map((appt: any) => {
      const reasonStr = appt.reason || '';
      const isDeclined = appt.status === 'cancelled' || appt.status === 'rejected' || appt.status === 'declined' || reasonStr.includes('Declined:') || reasonStr.includes('[PATIENT_DECLINED]');
      const isCompleted = appt.status === 'completed';
      const isMissed = appt.status === 'missed';
      const isTerminated = isDeclined || isCompleted || isMissed;

      const isDoctorInRoom = !isTerminated && reasonStr.includes('[DOCTOR_IN_ROOM]');
      const isPatientWaiting = !isTerminated && reasonStr.includes('[PATIENT_WAITING]');
      const isPatientAdmitted = !isTerminated && reasonStr.includes('[PATIENT_ADMITTED]');
      const isCallActive = !isTerminated && (reasonStr.includes('[CALL_ACTIVE]') || isDoctorInRoom);

      let statusVal = appt.status;
      if (isDeclined) {
        statusVal = 'declined';
      } else if (isCompleted) {
        statusVal = 'completed';
      } else if (isMissed) {
        statusVal = 'missed';
      } else if (isDoctorInRoom || isCallActive) {
        statusVal = 'in_progress';
      }

      return {
        ...appt,
        roomId: appt.id,
        appointment_id: appt.id,
        is_doctor_in_room: isDoctorInRoom,
        call_active: isCallActive,
        status: statusVal
      };
    });

    return new NextResponse(JSON.stringify({ appointments: formatted }), {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ appointments: [] });
  }
}
