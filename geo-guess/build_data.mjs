// One-time converter: download Natural Earth 50m admin-0 countries (public domain),
// simplify, and embed as window.COUNTRIES in index.html's country-data block.
// Usage: node build_data.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const round2 = (n) => Math.round(n * 100) / 100;

const res = await fetch(SRC_URL);
if (!res.ok) { console.error("download failed:", res.status); process.exit(1); }
const gj = await res.json();

const out = [];
for (const f of gj.features) {
  const p = f.properties;
  const name = p.NAME || p.NAME_LONG || p.ADMIN;
  if (!name || name === "Antarctica") continue;
  let iso2 = (p.ISO_A2_EH && p.ISO_A2_EH !== "-99") ? p.ISO_A2_EH
           : (p.ISO_A2 && p.ISO_A2 !== "-99") ? p.ISO_A2 : "";
  const g = f.geometry;
  if (!g) continue;
  const polys = g.type === "Polygon" ? [g.coordinates]
              : g.type === "MultiPolygon" ? g.coordinates : [];
  const rings = [];
  for (const poly of polys) {
    const outer = poly[0];
    if (!outer || outer.length < 4) continue;
    rings.push(outer.map(([x, y]) => [round2(x), round2(y)]));
  }
  if (!rings.length) continue;
  let big = rings[0];
  for (const r of rings) if (r.length > big.length) big = r;
  let sx = 0, sy = 0;
  for (const v of big) { sx += v[0]; sy += v[1]; }
  const centroid = [round2(sx / big.length), round2(sy / big.length)];
  out.push({ name, iso2, rings, centroid });
}

const json = JSON.stringify(out);
const file = join(dirname(fileURLToPath(import.meta.url)), "index.html");
let html = readFileSync(file, "utf8");
const block = `<script id="country-data">window.COUNTRIES = ${json};</script>`;
html = html.replace(/<script id="country-data">[\s\S]*?<\/script>/, block);
writeFileSync(file, html);
console.log("embedded", out.length, "countries;", json.length, "bytes");
