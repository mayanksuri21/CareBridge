const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const candidateRPCs = ['exec_sql', 'execute_sql', 'run_sql', 'sql', 'query', 'exec'];
  for (const rpc of candidateRPCs) {
    console.log(`Testing RPC: ${rpc}`);
    try {
      const { data, error } = await supabase.rpc(rpc, { query_text: 'SELECT 1;', sql: 'SELECT 1;', sql_query: 'SELECT 1;', query: 'SELECT 1;' });
      if (error) {
        console.log(`  Error: ${error.message} (Code: ${error.code})`);
      } else {
        console.log(`  SUCCESS on RPC: ${rpc}! Result:`, data);
        break;
      }
    } catch (e) {
      console.log(`  Exception on ${rpc}:`, e.message);
    }
  }
}

run();
