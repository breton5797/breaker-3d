// Prints landmark murals as text to eyeball their shapes.
// Usage: node scripts/preview-maps.mjs [name,name,...]   (default: all)
import { LEVELS } from '../src/sim/maps.js';

const SHOW = { a: ' ', b: '·', S: '█' };
const want = process.argv[2]?.split(',');
for (const m of LEVELS) {
  if (want && !want.some((w) => m.name.includes(w))) continue;
  console.log(`\n=== ${m.name} — ${m.subtitle}`);
  for (const line of m.build()) console.log([...line].map((c) => SHOW[c] ?? c).join(''));
}
