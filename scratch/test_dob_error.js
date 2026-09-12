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

async function testQueryWithDob() {
  const patientId = 'd720dda3-8a25-4955-a617-eb35352a7ab8';

  console.log('--- TEST 1: Querying with date_of_birth ---');
  const res1 = await supabase
    .from('profiles')
    .select('name, email, age, gender, phone, date_of_birth')
    .eq('id', patientId)
    .maybeSingle();

  console.log('Data 1:', res1.data);
  console.log('Error 1:', res1.error);

  console.log('\n--- TEST 2: Querying without date_of_birth ---');
  const res2 = await supabase
    .from('profiles')
    .select('id, name, email, age, gender, phone')
    .eq('id', patientId)
    .maybeSingle();

  console.log('Data 2:', res2.data);
  console.log('Error 2:', res2.error);
}

testQueryWithDob();
