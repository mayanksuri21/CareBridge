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

async function check() {
  const { data: rxList, error: rxErr } = await supabase
    .from('prescriptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('--- RECENT PRESCRIPTIONS ---');
  console.log(JSON.stringify(rxList, null, 2));

  if (rxList && rxList.length > 0) {
    for (let i = 0; i < rxList.length; i++) {
      const latestRx = rxList[i];
      console.log(`\n=================== PRESCRIPTION #${i + 1} ===================`);
      console.log('ID:', latestRx.id);
      console.log('appointment_id:', latestRx.appointment_id);
      console.log('patient_id:', latestRx.patient_id);
      console.log('doctor_id:', latestRx.doctor_id);
      console.log('doctor_name:', latestRx.doctor_name);

      if (latestRx.appointment_id) {
        const { data: appt } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', latestRx.appointment_id)
          .maybeSingle();
        console.log('\n--- ASSOCIATED APPOINTMENT ---');
        console.log(JSON.stringify(appt, null, 2));

        if (appt && appt.patient_id) {
          const { data: apptPatientProf } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', appt.patient_id)
            .maybeSingle();
          console.log('\n--- PROFILE FROM APPOINTMENT patient_id ---');
          console.log(JSON.stringify(apptPatientProf, null, 2));
        }
      }

      if (latestRx.patient_id) {
        const { data: patientProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', latestRx.patient_id)
          .maybeSingle();
        console.log('\n--- PROFILE FROM PRESCRIPTION patient_id ---');
        console.log(JSON.stringify(patientProf, null, 2));
      } else {
        console.log('\n!!! THIS PRESCRIPTION HAS NULL/MISSING patient_id !!!');
      }
    }
  }
}
check();
