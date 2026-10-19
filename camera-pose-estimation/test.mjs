// Runs the pose classifier embedded in index.html (<script id="shared-code">) in Node.
// Usage: node test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
assert.ok(m, 'shared-code script block found');
const module = { exports: {} };
new Function('module', m[1])(module);
const PoseLogic = module.exports;

const { total, failures } = PoseLogic.PoseTests.run();
for (const f of failures) console.log('FAIL', f);
console.log(`${total - failures.length}/${total} pose checks passed`);

// Readout of the demo poses, handy when tuning thresholds.
if (process.argv.includes('-v')) {
  for (const [name, spec] of PoseLogic.POSES) {
    const { lm2, lm3 } = PoseLogic.buildPose(spec);
    const { f } = PoseLogic.classify(lm2, lm3);
    const a = f.arms, g = f.legs, r = Math.round;
    console.log(name.padEnd(20), `elbow ${r(a.left.elbow)}/${r(a.right.elbow)} elev ${r(a.left.elev)}/${r(a.right.elev)} ${a.left.cls}/${a.right.cls}`,
      `knee ${r(g.left.knee)}/${r(g.right.knee)} footY ${g.left.footY.toFixed(2)}/${g.right.footY.toFixed(2)} toOther ${g.left.footToOther.toFixed(2)}`,
      `wristGap ${f.wristGap.toFixed(2)} wristNose ${a.left.wristNose.toFixed(2)}/${a.right.wristNose.toFixed(2)} tilt ${r(f.tilt)} spread ${r(f.legSpread)}`);
  }
}
process.exit(failures.length ? 1 : 0);
