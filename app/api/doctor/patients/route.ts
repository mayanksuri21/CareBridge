import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateAge } from '@/lib/utils';

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

    // 1. Fetch appointments for this doctor including real schedule_slots start_time
    const { data: appts, error: apptErr } = await supabase
      .from('appointments')
      .select('id, patient_id, patient_name, patient_email, phone, status, symptoms, reason, appointment_date, scheduled_at, created_at, slot_id, schedule_slots:slot_id(start_time)')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    if (apptErr) throw apptErr;

    // 2. Fetch prescriptions created by this doctor
    const { data: prescriptions, error: prescErr } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    // 3. Fetch patient profiles using valid existing columns
    const patientIds = Array.from(new Set([
      ...(appts || []).map(a => a.patient_id),
      ...(prescriptions || []).map(p => p.patient_id)
    ].filter(Boolean)));
    
    let profilesMap: Record<string, any> = {};
    if (patientIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, phone, role, avatar_url')
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
      
      const slotData: any = a.schedule_slots;
      const apptStartTime = (Array.isArray(slotData) ? slotData[0]?.start_time : slotData?.start_time) || a.scheduled_at || null;
      const formattedAppt = {
        ...a,
        scheduled_at: apptStartTime,
      };

      const resolvedName = prof.name || a.patient_name || 'Anonymous Patient';
      const resolvedEmail = prof.email || a.patient_email || 'Not provided';
      const resolvedPhone = prof.phone || a.phone || 'Not provided';

      if (!patientMap[pid]) {
        patientMap[pid] = {
          patient_id: pid,
          name: resolvedName,
          email: resolvedEmail,
          age: 'Not collected',
          gender: 'Not collected',
          blood_group: 'Not collected',
          phone: resolvedPhone,
          total_visits: 0,
          last_visit: apptStartTime || a.created_at,
          appointments: [],
          prescriptions: []
        };
      } else {
        if (patientMap[pid].name === 'Anonymous Patient' && resolvedName !== 'Anonymous Patient') {
          patientMap[pid].name = resolvedName;
        }
        if (patientMap[pid].email === 'Not provided' && resolvedEmail !== 'Not provided') {
          patientMap[pid].email = resolvedEmail;
        }
        if (patientMap[pid].phone === 'Not provided' && resolvedPhone !== 'Not provided') {
          patientMap[pid].phone = resolvedPhone;
        }
      }

      patientMap[pid].total_visits += 1;
      patientMap[pid].appointments.push(formattedAppt);
    });

    (prescriptions || []).forEach(p => {
      const pid = p.patient_id;
      if (!pid) return;

      const prof = profilesMap[pid] || {};
      const resolvedName = prof.name || 'Anonymous Patient';
      const resolvedEmail = prof.email || 'Not provided';
      const resolvedPhone = prof.phone || 'Not provided';

      if (!patientMap[pid]) {
        patientMap[pid] = {
          patient_id: pid,
          name: resolvedName,
          email: resolvedEmail,
          age: 'Not collected',
          gender: 'Not collected',
          blood_group: 'Not collected',
          phone: resolvedPhone,
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

    // Sort patient history appointments descending by actual start_time (most recent first)
    results.forEach((p: any) => {
      p.appointments.sort((a: any, b: any) => {
        const timeA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
        const timeB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
        return timeB - timeA;
      });
      p.prescriptions.sort((a: any, b: any) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeB - timeA;
      });
    });

    // Apply search filter if query is present
    if (query) {
      results = results.filter(
        (p: any) =>
          p.name.toLowerCase().includes(query) ||
          p.email.toLowerCase().includes(query) ||
          p.patient_id.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({ patients: results }, { status: 200 });
  } catch (err: any) {
    console.error('Doctor Patients API Error:', err);
    return NextResponse.json({ patients: [] }, { status: 200 });
  }
}
