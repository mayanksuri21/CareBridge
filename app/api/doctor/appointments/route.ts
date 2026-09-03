import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  let hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, '0');
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${meridiem}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctor_id');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { auth: { persistSession: false } }
    );

    // appointments has no date/time columns of its own — it references a real
    // slot row via slot_id. Join schedule_slots to get start_time/end_time.
    let query = supabase
      .from('appointments')
      .select(`
        id,
        doctor_id,
        patient_id,
        slot_id,
        status,
        reason,
        created_at,
        appointment_date,
        time_slot,
        schedule_slots:slot_id (
          start_time,
          end_time
        ),
        patient_name,
        patient_email,
        patient:profiles!patient_id (
          id,
          name,
          email,
          phone
        )
      `)
      .in('status', ['pending', 'booked', 'scheduled', 'cancelled'])
      .order('created_at', { ascending: false });

    if (doctorId) {
      query = query.or(`doctor_id.eq.${doctorId},doctor_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const mapped = (data || []).map((appt: any) => {
      const reasonStr = appt.reason || '';
      const isPatientDeclined = reasonStr.includes('[PATIENT_DECLINED]');
      const isDeclinedText = reasonStr.includes('Declined:') || isPatientDeclined;
      const isCancelledOrDeclined = appt.status === 'cancelled' || appt.status === 'rejected' || appt.status === 'declined' || isDeclinedText;

      const isDoctorInRoom = !isCancelledOrDeclined && reasonStr.includes('[DOCTOR_IN_ROOM]');
      const isPatientWaiting = !isCancelledOrDeclined && reasonStr.includes('[PATIENT_WAITING]');
      const isPatientAdmitted = !isCancelledOrDeclined && reasonStr.includes('[PATIENT_ADMITTED]');
      const isCallActive = !isCancelledOrDeclined && (reasonStr.includes('[CALL_ACTIVE]') || isDoctorInRoom);
      const isPendingApprovalTag = reasonStr.includes('[PENDING_APPROVAL]');

      let cleanReason = reasonStr;
      ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]'].forEach(tag => {
        cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '');
      });

      let statusVal = appt.status;
      if (isCancelledOrDeclined) {
        statusVal = 'declined';
      } else if (isPatientAdmitted) {
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
      }

      // Prefer the real slot timestamp; fall back to parsing the reason text
      // (kept for any older appointments created before this fix existed).
      let scheduledDate: string;
      let scheduledTime: string;
      if (appt.schedule_slots?.start_time) {
        scheduledDate = formatDate(appt.schedule_slots.start_time);
        scheduledTime = formatTime(appt.schedule_slots.start_time);
      } else {
        const dateMatch = cleanReason.match(/Selected Date:\s*([\w\d, -]+)/i) || cleanReason.match(/Preferred Date:\s*([\w\d, -]+)/i);
        const timeMatch = cleanReason.match(/Time Slot:\s*([\w\d: ]+)/i);
        scheduledDate = dateMatch ? dateMatch[1].trim() : '17-08-2026';
        scheduledTime = timeMatch ? timeMatch[1].trim() : '12:00 PM';
      }

      const symptomsMatch = cleanReason.match(/Symptoms:\s*([\s\S]*)/i);
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