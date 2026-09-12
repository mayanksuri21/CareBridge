const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envText = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAdmin = createClient(url, key);

async function testPrescriptionResolution() {
  const id = '5ce924e4-c1cb-4711-96cf-9757710b215c';
  
  const { data: presc, error } = await supabaseAdmin.from("prescriptions").select("*").eq("id", id).maybeSingle();
  if (error || !presc) {
    console.error("Prescription error:", error);
    return;
  }

  let patientId = presc.patient_id;
  let appt = null;
  if (presc.appointment_id) {
    const { data } = await supabaseAdmin
      .from("appointments")
      .select("patient_id, patient_name, patient_email, phone")
      .eq("id", presc.appointment_id)
      .maybeSingle();
    if (data) {
      appt = data;
      if (!patientId && data.patient_id) patientId = data.patient_id;
    }
  }

  const [docProfileRes, patProfileRes] = await Promise.all([
    presc.doctor_id ? supabaseAdmin.from("profiles").select("name").eq("id", presc.doctor_id).maybeSingle() : Promise.resolve({ data: null }),
    patientId ? supabaseAdmin.from("profiles").select("name, email, age, gender, phone").eq("id", patientId).maybeSingle() : Promise.resolve({ data: null })
  ]);

  const patProf = patProfileRes.data;
  const resolvedName = patProf?.name || appt?.patient_name || presc.patient_name || "Patient";
  const resolvedEmail = patProf?.email || appt?.patient_email || "No email";
  const resolvedPhone = (patProf?.phone && patProf.phone.trim() !== "") ? patProf.phone.trim() : (appt?.phone || "No phone");
  const resolvedAge = patProf?.age ? String(patProf.age) : "N/A";
  const resolvedGender = patProf?.gender || "N/A";

  console.log("=== RESOLVED PATIENT DETAILS FOR LATEST PRESCRIPTION ===");
  console.log("Prescription ID:", id);
  console.log("Patient Name:", resolvedName);
  console.log("Patient Email:", resolvedEmail);
  console.log("Patient Phone:", resolvedPhone);
  console.log("Patient Age:", resolvedAge);
  console.log("Patient Gender:", resolvedGender);
}

testPrescriptionResolution();
