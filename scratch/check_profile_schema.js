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

async function checkProfileSchema() {
  const { data: prof, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', 'd720dda3-8a25-4955-a617-eb35352a7ab8')
    .maybeSingle();

  console.log('=== PROFILE ALL KEYS AND VALUES ===');
  console.log(prof);
  console.log('Error:', error);
}
checkProfileSchema();
