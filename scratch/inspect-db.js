const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read local env file
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (parts) {
      const key = parts[1];
      let val = parts[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
      process.env[key] = val;
    }
  });
} catch (e) {
  console.error("Error parsing env:", e);
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log("Fetching a row to inspect properties...");
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error selecting from appointments:", error);
  } else {
    console.log("Success! Row keys:", data.length > 0 ? Object.keys(data[0]) : "No rows found");
    if (data.length > 0) {
      console.log("Sample row:", JSON.stringify(data[0], null, 2));
    }
  }
}

main();
