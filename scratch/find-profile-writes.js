const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      searchDir(filePath, pattern, fileList);
    } else if (/\.(tsx?|jsx?|sql)$/.test(file)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (pattern.test(content)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const filesWithProfiles = searchDir('.', /profiles/i);
console.log('Files mentioning profiles:');
for (const f of filesWithProfiles) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (/insert|update|upsert/i.test(line) && /profiles/i.test(line)) {
      console.log(`[WRITE TO PROFILES] ${f}:${idx + 1}: ${line.trim()}`);
    } else if (/(from\(['"]profiles['"]\))/i.test(line)) {
      // Check next 5 lines
      const snippet = lines.slice(idx, idx + 6).join(' ');
      if (/insert|update|upsert/i.test(snippet)) {
        console.log(`[PROFILES OPERATION] ${f}:${idx + 1}: ${snippet.substring(0, 120)}`);
      }
    }
  });
}
