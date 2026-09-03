import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const patientEmail = searchParams.get('email');
    const patientId = searchParams.get('patient_id');

    // 1. Resolve Patient ID
    let resolvedPatientId = patientId;
    if (!resolvedPatientId && patientEmail) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', patientEmail)
        .maybeSingle();
      if (profile) resolvedPatientId = profile.id;
    }

    if (!resolvedPatientId) {
      return NextResponse.json({ appointments: [], count: 0 });
    }

    // 2. Fetch Appointments
    const { data: appointments, error: aptError } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('patient_id', resolvedPatientId)
      .order('created_at', { ascending: false });

    if (aptError || !appointments) {
      console.error('Error fetching patient appointments:', aptError);
      return NextResponse.json({ appointments: [], count: 0 });
    }

    // 3. Fetch Doctor Profiles in batch
    const doctorIds = Array.from(new Set(appointments.map((a: any) => a.doctor_id).filter(Boolean)));
    let doctorMap: Record<string, any> = {};

    if (doctorIds.length > 0) {
      const { data: doctors } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, specialty')
        .in('id', doctorIds);

      if (doctors) {
        doctors.forEach((d: any) => {
          doctorMap[d.id] = d;
        });
      }
    }

    // 4. Format Output with in-memory parsed text fields as fallback
    const formatted = appointments.map((apt: any) => {
      const doc = doctorMap[apt.doctor_id] || {};
      
      const reasonStr = apt.reason || "";
      const symptomsMatch = reasonStr.match(/Symptoms:\s*([^\n\r]*)/i);
      const dateMatch = reasonStr.match(/Selected Date:\s*([^\n\r]*)/i) || reasonStr.match(/Preferred Date:\s*([^\n\r]*)/i);
      const timeMatch = reasonStr.match(/Time Slot:\s*([^\n\r]*)/i);
      
      const isDeclined = apt.status === 'cancelled' || apt.status === 'rejected' || apt.status === 'declined' || reasonStr.includes('Declined:') || reasonStr.includes('[PATIENT_DECLINED]');
      
      const isDoctorInRoom = !isDeclined && reasonStr.includes('[DOCTOR_IN_ROOM]');
      const isPatientWaiting = !isDeclined && reasonStr.includes('[PATIENT_WAITING]');
      const isPatientAdmitted = !isDeclined && reasonStr.includes('[PATIENT_ADMITTED]');
      const isCallActive = !isDeclined && reasonStr.includes('[CALL_ACTIVE]');
      const isPendingApproval = reasonStr.includes('[PENDING_APPROVAL]');

      let cleanReason = reasonStr;
      const splitIndex = reasonStr.search(/(Symptoms:|Preferred Date:|Selected Date:|Time Slot:)/i);
      if (splitIndex !== -1) {
        cleanReason = reasonStr.substring(0, splitIndex).trim();
      }
      ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]'].forEach(tag => {
        cleanReason = cleanReason.replace(` ${tag}`, '').replace(tag, '');
      });
      cleanReason = cleanReason.trim();

      let statusVal = apt.status || 'scheduled';
      if (isDeclined) {
        statusVal = 'declined';
      } else if (isPatientAdmitted) {
        statusVal = 'patient_admitted';
      } else if (isPatientWaiting) {
        statusVal = 'patient_waiting';
      } else if (isDoctorInRoom) {
        statusVal = 'in_progress';
      } else if (isCallActive || apt.status === 'in_progress') {
        statusVal = 'in_progress';
      } else if (apt.status === 'booked') {
        statusVal = isPendingApproval ? 'pending' : 'scheduled';
      } else if (apt.status === 'cancelled' || apt.status === 'rejected' || apt.status === 'declined') {
        statusVal = 'declined';
      }

      const parsedDate = dateMatch ? dateMatch[1].trim() : (apt.appointment_date || (apt.scheduled_at ? new Date(apt.scheduled_at).toISOString().split('T')[0] : '2026-08-17'));
      const parsedTime = timeMatch ? timeMatch[1].trim() : (apt.time_slot || '02:00 PM');
      const parsedSymptoms = symptomsMatch ? symptomsMatch[1].trim() : (apt.symptoms || '');

      return {
        id: apt.id,
        roomId: apt.id,
        appointment_id: apt.id,
        doctor_id: apt.doctor_id,
        doctor: {
          id: apt.doctor_id,
          name: doc.name || 'Dr. Rahul Sharma',
          specialty: doc.specialty || 'General Medicine',
          email: doc.email || ''
        },
        appointment_date: parsedDate,
        time_slot: parsedTime,
        symptoms: parsedSymptoms,
        status: statusVal,
        is_doctor_in_room: isDoctorInRoom,
        call_active: isCallActive || isDoctorInRoom || isPatientWaiting || isPatientAdmitted || statusVal === 'in_progress',
        reason: cleanReason || 'General Consultation',
        raw_reason: reasonStr,
        created_at: apt.created_at
      };
    });

    return NextResponse.json({
      appointments: formatted,
      count: formatted.length
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get('id');

    if (!appointmentId) {
      return NextResponse.json({ error: 'Missing appointment ID' }, { status: 400 });
    }

    // Release the linked schedule slot before deleting the appointment,
    // so the slot becomes bookable again for other patients.
    try {
      const { data: appt } = await supabaseAdmin
        .from('appointments')
        .select('slot_id')
        .eq('id', appointmentId)
        .maybeSingle();

      if (appt?.slot_id) {
        await supabaseAdmin
          .from('schedule_slots')
          .update({ is_booked: false })
          .eq('id', appt.slot_id)
          .eq('is_booked', true);
      }
    } catch (e) {
      console.warn('[patient-appointments] Failed to release slot:', e);
    }

    const { error } = await supabaseAdmin
      .from('appointments')
      .delete()
      .eq('id', appointmentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Appointment removed' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
