import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctor_id') || searchParams.get('doctorId');
    const query = searchParams.get('q')?.toLowerCase() || '';

    if (!doctorId) {
      return NextResponse.json({ patients: [] }, { status: 200 });
    }

    const supabase = getAdminClient();

    // 1. Fetch appointments for this doctor to find all associated patients
    const { data: appts, error: apptErr } = await supabase
      .from('appointments')
      .select('id, patient_id, patient_name, scheduled_at, status, symptoms, reason, appointment_date')
      .eq('doctor_id', doctorId)
      .order('scheduled_at', { ascending: false });

    if (apptErr) throw apptErr;

    // 2. Fetch prescriptions created by this doctor
    const { data: prescriptions, error: prescErr } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    // 3. Fetch patient profiles
    const patientIds = Array.from(new Set([
      ...(appts || []).map(a => a.patient_id),
      ...(prescriptions || []).map(p => p.patient_id)
    ].filter(Boolean)));
    
    let profilesMap: Record<string, any> = {};
    if (patientIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, age, gender, blood_group, phone')
        .in('id', patientIds);

      (profiles || []).forEach(p => {
        profilesMap[p.id] = p;
      });
    }

    // 4. Group data per patient
    const patientMap: Record<string, any> = {};

    (appts || []).forEach(a => {
      const pid = a.patient_id || 'unknown';
      const prof = profilesMap[pid] || {};
      
      if (!patientMap[pid]) {
        patientMap[pid] = {
          patient_id: pid,
          name: prof.name || a.patient_name || 'Anonymous Patient',
          email: prof.email || 'No email provided',
          age: prof.age || 'N/A',
          gender: prof.gender || 'N/A',
          blood_group: prof.blood_group || 'N/A',
          phone: prof.phone || 'N/A',
          total_visits: 0,
          last_visit: a.scheduled_at || a.appointment_date,
          appointments: [],
          prescriptions: []
        };
      }

      patientMap[pid].total_visits += 1;
      if ((patientMap[pid].name === 'Anonymous Patient' || !patientMap[pid].name) && a.patient_name) {
        patientMap[pid].name = a.patient_name;
      }
      patientMap[pid].appointments.push(a);
    });

    (prescriptions || []).forEach(p => {
      const pid = p.patient_id;
      if (!pid) return;

      if (!patientMap[pid]) {
        const prof = profilesMap[pid] || {};
        patientMap[pid] = {
          patient_id: pid,
          name: prof.name || 'Anonymous Patient',
          email: prof.email || 'No email provided',
          age: prof.age || 'N/A',
          gender: prof.gender || 'N/A',
          blood_group: prof.blood_group || 'N/A',
          phone: prof.phone || 'N/A',
          total_visits: 0,
          last_visit: p.created_at,
          appointments: [],
          prescriptions: []
        };
      }

      let medicinesList = [];
      if (p.medicines) {
        medicinesList = typeof p.medicines === 'string' ? JSON.parse(p.medicines) : p.medicines;
      } else if (p.note) {
        try {
          const match = p.note.match(/Medications:\s*(\[.*\])/i);
          if (match) medicinesList = JSON.parse(match[1]);
        } catch {}
      }

      let diagnosis = p.diagnosis;
      let advice = p.advice || p.note;
      if (p.note && p.note.includes('Instructions:')) {
        const match = p.note.match(/Instructions:\s*([\s\S]*)/i);
        if (match) advice = match[1].trim();
      }
      if (!diagnosis && p.note && p.note.includes('Diagnosis:')) {
        const diagMatch = p.note.match(/Diagnosis:\s*([^\n\r]*)/i);
        if (diagMatch) diagnosis = diagMatch[1].trim();
      }

      patientMap[pid].prescriptions.push({
        ...p,
        diagnosis: diagnosis || 'General Consultation',
        medicines: medicinesList,
        advice: advice || 'Follow prescribed dosage',
        instructions: advice || 'Follow prescribed dosage'
      });
    });

    let results = Object.values(patientMap);

    // Apply search filter if query is present
    if (query) {
      results = results.filter(
        (p: any) =>
          p.name.toLowerCase().includes(query) ||
          p.email.toLowerCase().includes(query) ||
          p.blood_group.toLowerCase().includes(query) ||
          p.patient_id.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({ patients: results }, { status: 200 });
  } catch (err: any) {
    console.error('Doctor Patients API Error:', err);
    return NextResponse.json({ patients: [] }, { status: 200 });
  }
}
