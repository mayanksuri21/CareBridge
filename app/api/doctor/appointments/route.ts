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
      .in('status', ['scheduled', 'pending', 'in_progress', 'booked', 'declined'])
      .order('created_at', { ascending: false });

    if (doctorId) {
      query = query.or(`doctor_id.eq.${doctorId},doctor_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const mapped = (data || []).map((appt: any) => {
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
      } else if (appt.status === 'cancelled') {
        statusVal = 'declined';
      }

      const dateMatch = cleanReason.match(/Selected Date:\s*([\w\d, -]+)/i) || cleanReason.match(/Preferred Date:\s*([\w\d, -]+)/i);
      const timeMatch = cleanReason.match(/Time Slot:\s*([\w\d: ]+)/i);
      const symptomsMatch = cleanReason.match(/Symptoms:\s*([\s\S]*)/i);

      const scheduledDate = dateMatch ? dateMatch[1].trim() : (appt.scheduled_date || appt.appointment_date || '17-08-2026');
      const scheduledTime = timeMatch ? timeMatch[1].trim() : (appt.scheduled_time || appt.time_slot || '12:00 PM');
      const symptomsText = symptomsMatch ? symptomsMatch[1].trim() : (appt.symptoms || '');

      return {
        ...appt,
        status: statusVal,
        call_active: isCallActive || isDoctorInRoom || isPatientWaiting || isPatientAdmitted,
        reason: cleanReason,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        symptoms: symptomsText,
        is_doctor_in_room: isDoctorInRoom,
        is_patient_waiting: isPatientWaiting,
        is_patient_admitted: isPatientAdmitted,
        is_patient_declined: isPatientDeclined
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