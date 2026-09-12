const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      search(full);
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(file)) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((l, idx) => {
        if (/patient/i.test(l) && /role/i.test(l)) {
          console.log(`${full}:${idx + 1}: ${l.trim()}`);
        }
      });
    }
  }
}

search('.');
