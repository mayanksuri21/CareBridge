import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = getAdmin();

    const parts = (body.scheduled_at || '').split(' ');
    const appointmentDate = parts[0] || '2026-08-17';
    const timeSlot = parts.slice(1).join(' ') || '12:00 PM';

    // Store date, time, and symptoms dynamically in the reason text block
    const fullReason = `${body.reason || 'General Consultation'}\n\nSelected Date: ${appointmentDate}\nTime Slot: ${timeSlot}${body.symptoms ? `\nSymptoms: ${body.symptoms}` : ''}`;

    // Map properties matching only the actual columns in public.appointments schema
    const newAppt = {
      patient_id: body.patient_id || null,
      doctor_id: body.doctor_id || null,
      reason: fullReason,
      status: 'booked' // Default valid status complying with table check constraints
    };

    const { data, error } = await supabase.from('appointments').insert([newAppt]).select().maybeSingle();

    if (error) {
      console.error("Database insert failed:", error.message);
      throw error;
    }

    return NextResponse.json({
      success: true,
      appointment: data
    });
  } catch (err: any) {
    console.error("Create Appointment Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}