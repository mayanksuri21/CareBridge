const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  const { data: paymentsData, error: paymentsErr } = await supabase
    .from('payments')
    .select('*')
    .limit(1);

  if (paymentsErr) {
    console.log("PAYMENTS TABLE STATUS: NOT FOUND", paymentsErr.message);
  } else {
    console.log("PAYMENTS TABLE STATUS: EXISTS!");
    console.log("Sample columns:", paymentsData);
  }

  const { data: apptData } = await supabase
    .from('appointments')
    .select('payment_status')
    .limit(1);
  console.log("APPOINTMENTS payment_status column check:", apptData);
}

verify();
