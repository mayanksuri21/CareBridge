const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  console.log(".env.local keys:", content.split('\n').map(l => l.split('=')[0].trim()).filter(Boolean));
}
console.log("process.env keys containing SUPABASE or DB or POSTGRES:",
  Object.keys(process.env).filter(k => /SUPABASE|DB|POSTGRES|PASS/i.test(k))
);
