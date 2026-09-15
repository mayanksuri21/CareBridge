import fs from 'fs';

const content = fs.readFileSync('app/consultation/[appointmentId]/page.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== HOOKS AND EARLY RETURNS IN CONSULTATION PAGE ===");
lines.forEach((line, index) => {
  const lineNum = index + 1;
  if (line.includes('useEffect') || line.includes('useState') || line.includes('useMemo') || line.includes('useCallback') || line.includes('useRef')) {
    console.log(`Line ${lineNum}: ${line.trim()}`);
  }
  if (line.trim().startsWith('return') && (line.includes('<div') || line.includes('null') || line.includes('('))) {
    console.log(`---> Line ${lineNum} EARLY RETURN: ${line.trim().slice(0, 60)}`);
  }
});
