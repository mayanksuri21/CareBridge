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
    const patientId = searchParams.get('patient_id');
    const patientEmail = searchParams.get('email');

    let resolvedPatientId = patientId;
    
    // Fallback to logged-in user session
    if (!resolvedPatientId) {
      try {
        const { cookies } = require("next/headers");
        const { createServerClient } = require("@supabase/ssr");
        const cookieStore = await cookies();
        const userClient = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
          cookies: {
            get(name: string) { return cookieStore.get(name)?.value; },
            set(name: string, value: string, options: any) { cookieStore.set({ name, value, ...options }); },
            remove(name: string, options: any) { cookieStore.set({ name, value: "", ...options }); }
          }
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) resolvedPatientId = user.id;
      } catch (e) {
        console.warn("Session check in prescriptions API failed:", e);
      }
    }

    if (!resolvedPatientId && patientEmail) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', patientEmail)
        .maybeSingle();
      if (profile) resolvedPatientId = profile.id;
    }

    if (!resolvedPatientId) {
      return NextResponse.json({ prescriptions: [] });
    }

    const { data: prescriptions, error } = await supabaseAdmin
      .from('prescriptions')
      .select('*')
      .eq('patient_id', resolvedPatientId)
      .order('created_at', { ascending: false });

    if (error || !prescriptions) {
      console.error('Error fetching prescriptions:', error);
      return NextResponse.json({ prescriptions: [] });
    }

    // Format output to ensure it matches the PrintablePrescription format
    const formatted = prescriptions.map((rx: any) => {
      let medicinesList = [];
      if (rx.medicines) {
        medicinesList = typeof rx.medicines === 'string' ? JSON.parse(rx.medicines) : rx.medicines;
      } else if (rx.note) {
        try {
          const match = rx.note.match(/Medications:\s*(\[.*\])/i);
          if (match) medicinesList = JSON.parse(match[1]);
        } catch {}
      }

      let diagnosis = rx.diagnosis;
      let advice = rx.advice || rx.note;
      if (!diagnosis && rx.note) {
        const diagMatch = rx.note.match(/Diagnosis:\s*([^\n\r]*)/i);
        if (diagMatch) diagnosis = diagMatch[1].trim();
      }

      return {
        id: rx.id,
        created_at: rx.created_at,
        doctor_name: rx.doctor_name || 'CareBridge Doctor',
        diagnosis: diagnosis || 'General Consultation',
        medicines: medicinesList,
        advice: advice || ''
      };
    });

    return NextResponse.json({ prescriptions: formatted });
  } catch (error: any) {
    console.error('Prescriptions GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const body = await request.json();
    const appointment_id = body.appointment_id || body.appointmentId;
    const doctor_id = body.doctor_id || body.doctorId;
    const patient_id = body.patient_id || body.patientId;
    const diagnosis = body.diagnosis;
    const medications = body.medications || body.medicines || [];
    const instructions = body.instructions || body.advice || body.notes || "";

    // Resolve doctor name to store it in DB
    let doctorName = 'CareBridge Doctor';
    if (doctor_id) {
      const { data: docProfile } = await supabaseAdmin
        .from('profiles')
        .select('name')
        .eq('id', doctor_id)
        .maybeSingle();
      if (docProfile?.name) {
        doctorName = docProfile.name;
      }
    }

    let insertResult;
    try {
      const { data, error } = await supabaseAdmin
        .from('prescriptions')
        .insert([
          {
            appointment_id,
            doctor_id,
            patient_id,
            doctor_name: doctorName,
            diagnosis,
            medicines: medications,
            advice: instructions,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;
      insertResult = data;
    } catch (err: any) {
      console.warn('Inserting using baseline prescriptions schema fallback...', err.message);
      
      const serializedNote = `Diagnosis: ${diagnosis || ''}\n\nMedications: ${JSON.stringify(medications)}\n\nInstructions: ${instructions}`;
      const { data, error } = await supabaseAdmin
        .from('prescriptions')
        .insert([
          {
            appointment_id,
            doctor_id,
            patient_id,
            note: serializedNote,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Baseline prescription insert failed:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      insertResult = data;
    }

    return NextResponse.json({ ok: true, prescription: insertResult });
  } catch (error: any) {
    console.error('Prescriptions POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
