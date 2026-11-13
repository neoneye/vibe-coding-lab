// node motorcycle-decals/test.mjs — checks the shared (DOM-free) code of the decal designer.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const html = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');
const code = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1];
const X = new Function(code + '\nreturn {BIKES,THEMES,PANELS,TYPES,TYPE_KEYS,STYLE_KEYS,buildBike,packTiles,newLayer,layerRecs,propose,proposalSet,sheetSVG,schemaFor,DEF_TRIM,DEF_FINISH,allPanels};')();

const clean = recs => { for (const r of recs) { const s = JSON.stringify(r); assert.ok(!/NaN|Infinity|undefined|null/.test(s), 'bad record ' + s.slice(0, 200)); } };
let n = 0;

for (const spec of X.BIKES) {
  const B = X.buildBike(spec);
  assert.equal(B.paintPanels.length, 6);
  for (const p of B.paintPanels) {
    assert.ok(p.bb.w > 100 && p.bb.h > 50, spec.id + ' ' + p.id + ' size');
    assert.ok(p.out.length > 20 && !/NaN/.test(p.d));
    assert.ok(p.bb.Y1 < 1350, spec.id + ' ' + p.id + ' above ground');
  }
  // fairing must clear the front tyre in side view
  const f = B.by.fairing;
  for (const r of f.st) assert.ok(Math.hypot(r[0] - B.af[0], r[1] - B.af[1]) > spec.rF + 0.01, spec.id + ' fairing hits front wheel');
  const pack = X.packTiles(B, 2048, 12);
  assert.ok(pack && pack.k >= 1.0, spec.id + ' atlas scale ' + (pack && pack.k));
  for (const id of X.PANELS) { const t = pack.tiles[id]; assert.ok(t.x + t.w <= 2048 && t.y + t.h <= 2048); }
  n++;

  // every layer type with defaults, and with outline + shadow
  for (const type of X.TYPE_KEYS) {
    for (const over of [{}, { ol: 4, sh: 10, ang: 33, scale: 1.4, flipV: true }]) {
      const recs = X.layerRecs(X.newLayer(type, over), B, X.THEMES[0].c);
      assert.ok(recs.length > 0, type + ' produced nothing'); clean(recs); n++;
    }
  }
  // every proposal style
  for (const key of X.STYLE_KEYS) {
    for (const seed of [1, 2, 3]) {
      const p = X.propose(key, B, seed);
      assert.ok(p.layers.length >= 1 && p.name && p.why);
      for (const id of X.PANELS) assert.ok(/^c[0-4]$/.test(p.base[id]));
      const recs = p.layers.map(L => X.layerRecs(L, B, X.THEMES[0].c));
      recs.forEach(clean);
      const D = { colors: X.THEMES[0].c, base: p.base, layers: p.layers };
      const svg = X.sheetSVG(D, B, recs, 'test');
      assert.ok(!/NaN|undefined/.test(svg), key + ' sheet');
      assert.equal((svg.match(/stroke="#e6007e"/g) || []).length, 12, 'twelve pieces on the sheet');
      n++;
    }
  }
  const set = X.proposalSet(B, 0);
  assert.equal(set.length, 8);
  assert.equal(new Set(set.map(p => p.key)).size, 8, 'eight different styles');
  assert.deepEqual(set.slice(0, 4).map(p => p.key), spec.likes);
}
// same seed, same proposal
const B0 = X.buildBike(X.BIKES[0]);
assert.deepEqual(X.propose('flames', B0, 5), X.propose('flames', B0, 5));
// schema: every entry has a default inside its range
for (const type of X.TYPE_KEYS) { const s = X.schemaFor(type); for (const e of s.shape.concat(s.pos, s.style)) if (typeof e[2] === 'number') assert.ok(e[5] >= e[2] && e[5] <= e[3], type + '.' + e[0]); }
console.log('ok', n, 'checks');
