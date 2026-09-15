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

async function testRpcs() {
  const functionsToTest = [
    'exec', 'exec_sql', 'execute_sql', 'sql', 'query', 'run_sql',
    'postgres', 'pg_query', 'raw_sql', 'eval', 'execute'
  ];

  for (const fn of functionsToTest) {
    const { data, error } = await supabase.rpc(fn, { sql: 'SELECT 1' });
    if (!error) {
      console.log(`FOUND WORKING RPC: ${fn}`);
      return fn;
    } else {
      console.log(`fn ${fn}: ${error.message} (${error.code})`);
    }
  }
}

testRpcs();
