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
const supabase = createClient(url, key);

async function checkLatest() {
  const { data: rx } = await supabase
    .from('prescriptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log('=== LATEST PRESCRIPTION ===');
  console.log(rx);

  if (rx) {
    if (rx.patient_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', rx.patient_id)
        .maybeSingle();
      console.log('\n=== PATIENT PROFILE (via rx.patient_id) ===');
      console.log(prof);
    }

    if (rx.appointment_id) {
      const { data: appt } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', rx.appointment_id)
        .maybeSingle();
      console.log('\n=== APPOINTMENT ===');
      console.log(appt);

      if (appt && appt.patient_id) {
        const { data: apptProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', appt.patient_id)
          .maybeSingle();
        console.log('\n=== PATIENT PROFILE (via appt.patient_id) ===');
        console.log(apptProf);
      }
    }
  }
}
checkLatest();
