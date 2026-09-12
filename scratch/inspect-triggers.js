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

async function inspectTriggers() {
  // Let's check using pg triggers or information_schema or rpc if available
  // Or check appointments table structure
  const { data, error } = await supabase.from('appointments').select('*').limit(3);
  console.log("Appointments sample:", data);
  
  // Let's see if there are any SQL functions
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(5);
  console.log("Profiles sample:", profiles);
}

inspectTriggers();
