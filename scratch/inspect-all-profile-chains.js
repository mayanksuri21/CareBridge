const fs = require('fs');
const path = require('path');

function searchAllProfilesChains(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === '.git' || file === 'scratch') continue;
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      searchAllProfilesChains(full);
    } else if (/\.(tsx?|jsx?|mjs|cjs|sql)$/.test(file)) {
      const content = fs.readFileSync(full, 'utf8');
      const regex = /\.from\s*\(\s*['"`]profiles['"`]\s*\)([\s\S]*?)(;|\n\s*\n|\bconst\b|\blet\b|\bawait\b(?!\s*supabase)|\breturn\b)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const chain = match[0];
        console.log(`\n=== File: ${full} ===\n${chain.substring(0, 300)}`);
      }
    }
  }
}

searchAllProfilesChains('.');
