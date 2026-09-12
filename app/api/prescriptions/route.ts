import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateAge } from '@/lib/utils';

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
    const appointmentId = searchParams.get('appointment_id') || searchParams.get('appointmentId');
    const prescriptionId = searchParams.get('id') || searchParams.get('prescription_id');

    let query = supabaseAdmin.from('prescriptions').select('*');

    if (prescriptionId) {
      query = query.eq('id', prescriptionId);
    } else if (appointmentId) {
      query = query.eq('appointment_id', appointmentId);
    } else {
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

      query = query.eq('patient_id', resolvedPatientId);
    }

    const { data: prescriptions, error } = await query.order('created_at', { ascending: false });

    if (error || !prescriptions) {
      console.error('Error fetching prescriptions:', error);
      return NextResponse.json({ prescriptions: [], prescription: null });
    }

    // Resolve doctor names
    const doctorIds = Array.from(new Set(prescriptions.map((rx: any) => rx.doctor_id).filter(Boolean)));
    let doctorMap = new Map();
    if (doctorIds.length > 0) {
      const { data: docProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, name')
        .in('id', doctorIds);
      if (docProfiles) {
        doctorMap = new Map(docProfiles.map((p: any) => [p.id, p]));
      }
    }

    // Resolve appointment details across all retrieved prescriptions
    const apptIds = Array.from(new Set(prescriptions.map((rx: any) => rx.appointment_id).filter(Boolean)));
    let apptMap = new Map();
    if (apptIds.length > 0) {
      const { data: appts } = await supabaseAdmin
        .from('appointments')
        .select('id, patient_id, patient_name, patient_email, phone')
        .in('id', apptIds);
      if (appts) {
        apptMap = new Map(appts.map((a: any) => [a.id, a]));
      }
    }

    // Resolve missing patient_id from appointments if needed
    for (const rx of prescriptions) {
      if (!rx.patient_id && rx.appointment_id && apptMap.has(rx.appointment_id)) {
        rx.patient_id = apptMap.get(rx.appointment_id).patient_id;
      }
    }

    // Resolve patient details across all retrieved prescriptions
    const patientIds = Array.from(new Set(prescriptions.map((rx: any) => rx.patient_id).filter(Boolean)));
    let patientMap = new Map();
    if (patientIds.length > 0) {
      const { data: patientProfiles, error: patientProfileError } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, phone')
        .in('id', patientIds);

      if (patientProfileError) {
        console.error("Patient profile fetch error:", patientProfileError);
      }

      if (patientProfiles) {
        patientMap = new Map(patientProfiles.map((p: any) => [p.id, p]));
      }
    }
    // Format output to ensure it matches the PrintablePrescription format
    const formatted = prescriptions.map((rx: any) => {
      let medicinesList = [];
      if (rx.medicines) {
        medicinesList = typeof rx.medicines === 'string' ? JSON.parse(rx.medicines) : rx.medicines;
      } else if (rx.note) {
        try {
          const match = rx.note.match(/Medications:\s*(\[.*\])/i);
          if (match) {
            medicinesList = JSON.parse(match[1]);
          }
        } catch { }
      }

      let diagnosis = rx.diagnosis;
      let advice = rx.advice || rx.note;

      // Parse out clean advice/instructions if note has concatenated metadata
      if (rx.note && rx.note.includes('Instructions:')) {
        const match = rx.note.match(/Instructions:\s*([\s\S]*)/i);
        if (match) {
          advice = match[1].trim();
        }
      }
      if (!diagnosis && rx.note && rx.note.includes('Diagnosis:')) {
        const diagMatch = rx.note.match(/Diagnosis:\s*([^\n\r]*)/i);
        if (diagMatch) diagnosis = diagMatch[1].trim();
      }

      const doc = doctorMap.get(rx.doctor_id);
      const docName = doc?.name || rx.doctor_name || 'Rahul Sharma';
      const cleanDocName = docName.startsWith('Dr. ') ? docName.substring(4) : docName;

      const appt = rx.appointment_id ? apptMap.get(rx.appointment_id) : null;
      const patientProf = patientMap.get(rx.patient_id);
      const patientName = patientProf?.name || appt?.patient_name || rx.patient_name || 'Patient';
      const patientAge = patientProf?.age ? String(patientProf.age) : 'N/A';
      const patientGender = patientProf?.gender || 'N/A';
      const resolvedPatientEmail = patientProf?.email || appt?.patient_email || 'No email';
      const patientPhone = (patientProf?.phone && patientProf.phone.trim() !== '') ? patientProf.phone.trim() : (appt?.phone || 'No phone');

      return {
        id: rx.id,
        appointment_id: rx.appointment_id,
        created_at: rx.created_at,
        doctor_id: rx.doctor_id,
        doctor_name: cleanDocName,
        patient_id: rx.patient_id,
        patient_name: patientName,
        patient_age: patientAge,
        patient_gender: patientGender,
        patient_email: resolvedPatientEmail,
        patient_phone: patientPhone,
        diagnosis: diagnosis || 'General Consultation',
        medicines: medicinesList,
        advice: advice || 'Follow prescribed dosage',
        instructions: advice || 'Follow prescribed dosage'
      };
    });

    return NextResponse.json({
      prescriptions: formatted,
      prescription: formatted[0] || null
    });
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
    const prescription_id = body.prescription_id || body.prescriptionId || body.id;
    const diagnosis = body.diagnosis || "Consultation Prescription";
    const medications = body.medications || body.medicines || [];
    const instructions = body.instructions || body.advice || body.notes || "";

    let resolvedPatientId = patient_id;
    if (!resolvedPatientId && appointment_id) {
      const { data: appt } = await supabaseAdmin
        .from('appointments')
        .select('patient_id')
        .eq('id', appointment_id)
        .maybeSingle();
      if (appt?.patient_id) {
        resolvedPatientId = appt.patient_id;
      }
    }

    // Resolve doctor name to store it in DB
    let doctorName = 'Rahul Sharma';
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

    const formattedNote = `Diagnosis: ${diagnosis}\n\nMedications: ${JSON.stringify(medications)}\n\nInstructions: ${instructions}`;

    // Check if prescription already exists to UPDATE in place instead of creating duplicate
    let existingRx: any = null;
    if (prescription_id) {
      const { data } = await supabaseAdmin
        .from('prescriptions')
        .select('id, note, appointment_id, patient_id, doctor_id')
        .eq('id', prescription_id)
        .maybeSingle();
      existingRx = data;
    } else if (appointment_id) {
      const { data } = await supabaseAdmin
        .from('prescriptions')
        .select('id, note, appointment_id, patient_id, doctor_id')
        .eq('appointment_id', appointment_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existingRx = data;
    }

    if (existingRx) {
      let updatedResult;
      const updatePayload: any = {
        diagnosis,
        medicines: medications,
        advice: instructions,
        note: formattedNote
      };
      if (resolvedPatientId) {
        updatePayload.patient_id = resolvedPatientId;
      }

      try {
        const { data, error } = await supabaseAdmin
          .from('prescriptions')
          .update(updatePayload)
          .eq('id', existingRx.id)
          .select()
          .single();
        if (error) throw error;
        updatedResult = data;
      } catch {
        const fallbackPayload: any = { note: formattedNote };
        if (resolvedPatientId) fallbackPayload.patient_id = resolvedPatientId;
        const { data, error } = await supabaseAdmin
          .from('prescriptions')
          .update(fallbackPayload)
          .eq('id', existingRx.id)
          .select()
          .single();
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        updatedResult = data;
      }

      return NextResponse.json({ ok: true, prescription: updatedResult, updated: true });
    }

    let insertResult;
    try {
      const { data, error } = await supabaseAdmin
        .from('prescriptions')
        .insert([
          {
            appointment_id,
            doctor_id,
            patient_id: resolvedPatientId,
            doctor_name: doctorName,
            diagnosis,
            medicines: medications,
            advice: instructions,
            note: formattedNote,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;
      insertResult = data;
    } catch (err: any) {
      console.warn('Inserting using baseline prescriptions schema fallback...', err.message);

      const { data, error } = await supabaseAdmin
        .from('prescriptions')
        .insert([
          {
            appointment_id,
            doctor_id,
            patient_id,
            note: formattedNote,
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
