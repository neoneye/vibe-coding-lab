// Prints grasp diagnostics per object for the canned poses. Usage: node tune.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const src = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1];
new Function(src + `;
const ss = generateSensors();
for (const k of ['sphere', 'cube', 'pencil']) {
  const { world } = computePose(POSES[k]);
  const obj = { type: k, pos: OBJ_DEFS[k].ready.slice(), quat: OBJ_DEFS[k].quat0.slice() };
  const cs = computeContacts(world, ss, obj);
  const g = evalGrasp(cs, ss);
  const per = {};
  cs.forEach(c => { const d = ss[c.sensor].digit; per[d] = (per[d] || 0) + 1; });
  console.log(k, '=> force', g.force.toFixed(1), 'opp', g.opposition.toFixed(2),
    'groups', g.groups, 'contacts', cs.length, per);
  for (const b of [4, 7, 10, 13, 16]) {
    console.log('   tip', DIGIT_OF_BONE[b], 'sdf', objSdf(obj, tipPos(world, b)).toFixed(2));
  }
}`)();
