const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (parts) {
      const key = parts[1];
      let val = parts[2] || '';
      val = val.trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
      process.env[key] = val;
    }
  });
} catch (e) {
  console.error("Error reading env:", e);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: appts, error: aErr } = await supabase
    .from('appointments')
    .select('doctor_id')
    .not('doctor_id', 'is', null);

  if (aErr) {
    console.error('Appointments error:', aErr);
    return;
  }

  const docIds = [...new Set(appts.map(a => a.doctor_id))];
  console.log(`Found ${docIds.length} unique doctor IDs from appointments.`);

  if (docIds.length === 0) {
    console.log('No doctor appointments found.');
    return;
  }

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .in('id', docIds);

  if (pErr) {
    console.error('Profiles error:', pErr);
    return;
  }

  console.log('Total profiles fetched:', profiles.length);
  const corrupted = profiles.filter(p => p.role !== 'doctor');
  console.log('CORRUPTED PROFILES (role != "doctor"):', JSON.stringify(corrupted, null, 2));

  const { data: approvedDocs } = await supabase
    .from('doctor_verification_applications')
    .select('doctor_id, status')
    .eq('status', 'approved');

  if (approvedDocs && approvedDocs.length > 0) {
    const approvedIds = approvedDocs.map(d => d.doctor_id);
    const { data: approvedProfiles } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .in('id', approvedIds);
    const approvedCorrupted = (approvedProfiles || []).filter(p => p.role !== 'doctor');
    console.log('APPROVED DOCTORS WITH role != "doctor":', JSON.stringify(approvedCorrupted, null, 2));
  }
}

check();
