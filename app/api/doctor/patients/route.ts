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

    // 1. Fetch appointments for this doctor including real schedule_slots start_time and end_time
    const { data: appts, error: apptErr } = await supabase
      .from('appointments')
      .select('id, patient_id, patient_name, patient_email, phone, status, symptoms, reason, appointment_date, scheduled_at, created_at, slot_id, schedule_slots:slot_id(start_time, end_time)')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    if (apptErr) {
      console.error('Doctor Patients API appointments fetch error:', apptErr);
      throw apptErr;
    }

    // 2. Fetch prescriptions created by this doctor OR associated with any of this doctor's appointments
    const apptIds = (appts || []).map(a => a.id).filter(Boolean);
    let prescQuery = supabase.from('prescriptions').select('*');
    if (apptIds.length > 0) {
      prescQuery = prescQuery.or(`doctor_id.eq.${doctorId},appointment_id.in.(${apptIds.join(',')})`);
    } else {
      prescQuery = prescQuery.eq('doctor_id', doctorId);
    }
    const { data: prescriptions, error: prescErr } = await prescQuery.order('created_at', { ascending: false });
    if (prescErr) {
      console.error('Doctor Patients API prescriptions fetch error:', prescErr);
    }

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

    // Map appointment ID -> patient key for accurate prescription linking
    const apptToPatientKeyMap: Record<string, string> = {};

    // 4. Group data per patient (merge by email if present, else by patient_id)
    const patientMap: Record<string, any> = {};

    const getPatientKey = (email: string | null | undefined, pid: string): string => {
      if (email && typeof email === 'string' && email.trim() && email.toLowerCase() !== 'not provided' && email.includes('@')) {
        return email.toLowerCase().trim();
      }
      return pid || 'unknown';
    };

    const extractCleanReason = (reasonStr?: string, symptomsStr?: string): string => {
      let text = reasonStr || '';
      if (text) {
        ['[DOCTOR_IN_ROOM]', '[PATIENT_WAITING]', '[PATIENT_ADMITTED]', '[PATIENT_DECLINED]', '[CALL_ACTIVE]', '[PENDING_APPROVAL]', '[PAYMENT_PAID]', '[PAYMENT_PENDING]', '[ARCHIVED_BY_DOCTOR]'].forEach(tag => {
          text = text.replace(` ${tag}`, '').replace(tag, '');
        });
        text = text.replace(/\[[A-Z_]+\]/g, '').trim();

        if (text.includes('Selected Date:')) text = text.split('Selected Date:')[0].trim();
        if (text.includes('Preferred Date:')) text = text.split('Preferred Date:')[0].trim();
        if (text.includes('Time Slot:')) text = text.split('Time Slot:')[0].trim();
        text = text.replace(/^[|-]\s*/, '').replace(/\s*[|-]$/, '').trim();
      }
      if (text && text.toLowerCase() !== 'general consultation') {
        return text;
      }
      if (symptomsStr && symptomsStr.trim()) {
        return symptomsStr.trim();
      }
      return text || 'General Consultation';
    };

    (appts || []).forEach(a => {
      const pid = a.patient_id || 'unknown';
      const prof = profilesMap[pid] || {};
      
      const slotData: any = a.schedule_slots;
      const apptStartTime = (Array.isArray(slotData) ? slotData[0]?.start_time : slotData?.start_time) || a.scheduled_at || a.appointment_date || a.created_at;

      const cleanApptReason = extractCleanReason(a.reason, a.symptoms);

      const formattedAppt = {
        ...a,
        reason: cleanApptReason,
        scheduled_at: apptStartTime,
      };

      const resolvedName = prof.name || a.patient_name || 'Anonymous Patient';
      const resolvedEmail = prof.email || a.patient_email || 'Not provided';
      const resolvedPhone = prof.phone || a.phone || 'Not provided';
      const key = getPatientKey(resolvedEmail, pid);

      if (a.id) {
        apptToPatientKeyMap[a.id] = key;
      }

      if (!patientMap[key]) {
        patientMap[key] = {
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
        if (patientMap[key].name === 'Anonymous Patient' && resolvedName !== 'Anonymous Patient') {
          patientMap[key].name = resolvedName;
        }
        if (patientMap[key].email === 'Not provided' && resolvedEmail !== 'Not provided') {
          patientMap[key].email = resolvedEmail;
        }
        if (patientMap[key].phone === 'Not provided' && resolvedPhone !== 'Not provided') {
          patientMap[key].phone = resolvedPhone;
        }
      }

      // Add appointment if not already present
      if (!patientMap[key].appointments.some((existing: any) => existing.id === a.id)) {
        patientMap[key].appointments.push(formattedAppt);
      }
    });

    (prescriptions || []).forEach(p => {
      let key = p.appointment_id ? apptToPatientKeyMap[p.appointment_id] : null;

      if (!key) {
        const pid = p.patient_id;
        const prof = (pid && profilesMap[pid]) ? profilesMap[pid] : {};
        const resolvedEmail = prof.email || p.patient_email || 'Not provided';
        key = getPatientKey(resolvedEmail, pid || 'rx-patient');
      }

      if (!patientMap[key]) {
        const pid = p.patient_id || key;
        const prof = (pid && profilesMap[pid]) ? profilesMap[pid] : {};
        const resolvedName = prof.name || p.patient_name || 'Anonymous Patient';
        const resolvedEmail = prof.email || p.patient_email || 'Not provided';
        const resolvedPhone = prof.phone || p.patient_phone || 'Not provided';

        patientMap[key] = {
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

      // Avoid adding duplicate prescriptions if already present
      if (patientMap[key].prescriptions.some((rx: any) => rx.id === p.id)) {
        return;
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
      if (!diagnosis && p.appointment_id) {
        const linkedAppt = (appts || []).find(a => a.id === p.appointment_id);
        if (linkedAppt) {
          diagnosis = extractCleanReason(linkedAppt.reason, linkedAppt.symptoms);
        }
      }

      patientMap[key].prescriptions.push({
        ...p,
        diagnosis: diagnosis || 'General Consultation',
        medicines: medicinesList,
        advice: advice || 'Follow prescribed dosage',
        instructions: advice || 'Follow prescribed dosage'
      });
    });

    let results = Object.values(patientMap);

    // Calculate total visits and sort patient history (newest consultation first)
    results.forEach((p: any) => {
      p.total_visits = p.appointments.length;
      p.appointments.sort((a: any, b: any) => {
        const timeA = new Date(a.scheduled_at || a.appointment_date || a.created_at || 0).getTime();
        const timeB = new Date(b.scheduled_at || b.appointment_date || b.created_at || 0).getTime();
        return timeB - timeA;
      });
      p.prescriptions.sort((a: any, b: any) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
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
