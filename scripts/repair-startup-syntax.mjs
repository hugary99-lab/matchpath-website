import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const file = new URL('../beta/app.js', import.meta.url);
const original = readFileSync(file, 'utf8');
const fixes = [
  ["return}\\n if(action==='show-login')", "return}\n if(action==='show-login')"],
  ["});\\n   if(metadataError)", "});\n   if(metadataError)"]
];
let repaired = original;
for (const [before, after] of fixes) {
  if (repaired.split(before).length !== 2) throw Error('Expected exactly one known defect: ' + before);
  repaired = repaired.replace(before, after);
}
const temp = mkdtempSync(join(tmpdir(), 'matchpath-check-'));
try {
  const candidate = join(temp, 'app.mjs');
  writeFileSync(candidate, repaired);
  const result = spawnSync(process.execPath, ['--check', candidate], { encoding: 'utf8' });
  if (result.status !== 0) throw Error('Syntax check failed: ' + result.stderr);
  writeFileSync(file, repaired);
  console.log('Repaired two startup syntax defects; node --check passed.');
} finally { rmSync(temp, { recursive: true, force: true }); }
