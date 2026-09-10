// Extracts the <script id="shared-code"> block from index.html and runs XTests in Node.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'index.html'), 'utf8');
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) { console.error('shared-code block not found'); process.exit(1); }
const fn = new Function(m[1] + '\nreturn XTests.run();');
try {
  fn();
  console.log('prime-lab1: all tests passed');
} catch (e) {
  console.error('prime-lab1: FAIL', e.message);
  process.exit(1);
}
