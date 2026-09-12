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

async function checkTriggers() {
  // Try querying rpc or postgres functions if any exist
  const { data: rpcData, error: rpcErr } = await supabase.rpc('is_verification_admin');
  console.log('rpc is_verification_admin test:', rpcData, rpcErr?.message);
}

checkTriggers();
