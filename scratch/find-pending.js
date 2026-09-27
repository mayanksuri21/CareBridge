const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const envVars = {};
envLocal.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.trim();
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFallbackQuery() {
  const doctorId = "aa525a34-507a-4091-83fa-8e183f0d4c23";

  let query = supabase
    .from('appointments')
    .select(`
      id,
      doctor_id,
      patient_id,
      slot_id,
      status,
      reason,
      symptoms,
      notes,
      phone,
      age,
      gender,
      patient_age,
      patient_gender,
      created_at,
      appointment_date,
      time_slot,
      schedule_slots:slot_id (
        start_time,
        end_time
      ),
      patient_name,
      patient_email,
      patient:profiles!patient_id (
        id,
        name,
        email,
        phone,
        age,
        gender,
        date_of_birth
      )
    `)
    .in('status', ['pending', 'booked', 'scheduled', 'cancelled'])
    .order('created_at', { ascending: false });

  if (doctorId) {
    query = query.or(`doctor_id.eq.${doctorId},doctor_id.is.null`);
  }

  const { data, error } = await query;
  console.log('Query error:', error);
  console.log('Returned data count:', data ? data.length : 0);
  if (data) {
    console.log('Data:', JSON.stringify(data.slice(0, 3), null, 2));
  }
}

testFallbackQuery();
