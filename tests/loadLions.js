import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// lions.js is a plain browser script (not an ES module) that attaches
// itself to `window.Lions`. To test it, we read the source and run it
// in this test's jsdom environment, where `window` already exists as a
// global — exactly like a <script> tag would.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, '..', 'lions.js'), 'utf8');

export function loadLions() {
  window.eval(src);
  return window.Lions;
}
