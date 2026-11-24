// Draws first-draft pixel art for every voxel sheet in the rig table (SA.MODELS),
// plus backdrop.png. Existing files are kept, so repainted PNGs are never overwritten;
// pass --force to regenerate everything.
// Usage: node tools/make_art.mjs [--force]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

const game = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(game, "index.html"), "utf8");
const SA = new Function(`${html.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1]}; return SA;`)();
const force = process.argv.includes("--force");

// ---------------------------------------------------------------- PNG writer
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePng(path, w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
}

// ---------------------------------------------------------------- palette
// Each material has [dark, mid, light]. "team" must use SA.TEAM_KEYS exactly (the blue team swaps them).
const PAL = {
  skin: [0x9a5a3a, 0xc47e55, 0xe0a070],
  team: SA.TEAM_KEYS,
  leather: [0x4a2e1a, 0x6e4526, 0x8f5c34],
  bronze: [0x7a4e16, 0xb07a28, 0xe8b850],
  steel: [0x5e646c, 0xa0a8b0, 0xe4eaee],
  wood: [0x3a2414, 0x5a3820, 0x7a5030],
  hair: [0x1c120a, 0x30200f, 0x4a3018],
  eye: [0x101010, 0x101010, 0x101010],
  white: [0xd8d0c0, 0xf0ece0, 0xfffcf4],
  toga: [0xb8b0a0, 0xe0dccc, 0xfaf6ea],
  purple: [0x40144e, 0x6a2482, 0x9444ae],
  laurel: [0x40561a, 0x65802a, 0x94b040],
  gray: [0x8c8c8c, 0xbcbcbc, 0xe4e4e4],
  fur: [0x9a6a28, 0xc8923c, 0xe8b860],
  mane: [0x4e2c0c, 0x744414, 0x9e6426],
  nose: [0x2a1810, 0x3a2418, 0x4a3020],
  hide: [0x55555b, 0x77777e, 0x9a9aa2],
  ivory: [0xc8c0a0, 0xe8e0c8, 0xfffaf0],
  pink: [0xa86e72, 0xc88c8e, 0xe0aaa8],
};

// cheap deterministic hash in [0,1)
const hash = (x, y, z, s = 0) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const ell = (x, y, z, cx, cy, cz, rx, ry, rz) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1;
const cyl = (x, z, cx, cz, r) => (x - cx) ** 2 + (z - cz) ** 2 <= r * r;

// ---------------------------------------------------------------- part drawings
// Each returns a material name (or null for empty) for voxel (x, y, z) in the part's voxel
// coordinates: x forward (the model faces +x), y up, z 0..14 with 14 nearest the camera.
const C = 7; // depth centre
const DRAW = {
  // ---- gladiator
  "gladiator/hips": (x, y, z) => {
    if (!ell(x, 0, z, 5.5, 0, C, 5.6, 1, 5.4)) return null;
    if (y >= 5) return "leather";                                  // belt
    if (y >= 4) return "bronze";                                   // belt plates
    return (x + z) % 3 === 0 ? "team" : "leather";                 // pteruges strips over the tunic
  },
  "gladiator/torso": (x, y, z) => {
    const t = y / 15, rx = 3.6 + 0.6 * t, rz = 3.8 + 1.8 * t;
    if (y >= 14) { if (!cyl(x, z, 7.5, C, y === 14 ? 4.4 : 1.8) || (y === 15 && !cyl(x, z, 7.5, C, 1.8))) return null; return y === 15 ? "skin" : (cyl(x, z, 7.5, C, 1.9) ? "skin" : "skin"); }
    if (!ell(x, 0, z, 7, 0, C, rx, 1, rz)) return null;
    if (x <= 4 && y >= 4) return "team";                           // cloak down the back
    if (y <= 9) return "team";                                     // tunic
    if ((x + y) % 7 === 0 && y === 10) return "team";
    return "skin";
  },
  "gladiator/head": (x, y, z) => {
    if (!ell(x, y, z, 4.8, 4.8, C, 3.9, 4.8, 3.6)) return null;
    if (y >= 7 || (x <= 3 && y >= 3)) return "hair";
    if (x >= 7 && y <= 3) return "hair";                           // beard
    if (x >= 7 && y === 6 && (z === 5 || z === 9)) return "eye";
    return "skin";
  },
  "gladiator/helmet": (x, y, z) => {
    // crest along the top, team coloured
    if (z >= 6 && z <= 8 && y >= 10) { const top = 10 + 4.5 * Math.sin(Math.PI * (x - 0.5) / 10); return y <= top && x >= 1 && x <= 10 ? "team" : null; }
    const outer = ell(x, y, z, 6, 6, C, 4.9, 5.6, 4.6), inner = ell(x, y, z, 6, 6, C, 3.8, 4.6, 3.5);
    if (!outer || inner) return null;
    if (x >= 9 && y >= 5 && y <= 6 && z !== C) return null;        // eye slits beside the nose guard
    if (x >= 9 && y <= 3 && z >= 6 && z <= 8) return null;         // mouth opening
    return "bronze";
  },
  "gladiator/upperArm": (x, y, z) => cyl(x, z, 2, C, 2.1) ? (y >= 9 ? "skin" : "skin") : null,
  "gladiator/forearm": (x, y, z) => {
    if (y <= 3) return (x <= 4 && z >= 5 && z <= 9 && !(y === 3 && (x === 0 || x === 4))) ? "skin" : null; // fist
    if (!cyl(x, z, 2, C, 1.9)) return null;
    return y >= 4 && y <= 7 ? "leather" : "skin";                 // bracer
  },
  "gladiator/thigh": (x, y, z) => cyl(x, z, 3, C, 2.4 + 0.3 * (y / 10)) ? "skin" : null,
  "gladiator/shin": (x, y, z) => {
    if (y <= 1) return (x >= 0 && x <= 8 && z >= 5 && z <= 9) ? (y === 0 ? "leather" : (x >= 6 ? "skin" : "leather")) : null; // sandal + toes
    if (!cyl(x, z, 3, C, 2.2 - 0.2 * (y < 4 ? 1 : 0))) return null;
    return y <= 5 && y % 2 === 0 ? "leather" : "skin";            // sandal straps
  },
  "gladiator/sword": (x, y, z) => {
    if (y === 0) return (x >= 1 && x <= 3 && z >= 6 && z <= 8) ? "bronze" : null;    // pommel
    if (y <= 5) return (x === 2 && z >= 6 && z <= 8) || (x >= 1 && x <= 3 && z === C) ? "wood" : null; // grip
    if (y === 6) return z >= 5 && z <= 9 && x >= 0 && x <= 4 ? "bronze" : null;      // guard
    if (z !== C) return null;
    if (y >= 23) return x === 2 || (y === 23 && x >= 1 && x <= 3) ? "steel" : null;  // tip
    return x >= 1 && x <= 3 ? "steel" : null;
  },
  "gladiator/shield": (x, y, z) => {
    const r = Math.hypot(x - 11.5, y - 11.5);
    if (z === 14) {
      if (r > 9.6) return null;
      // the lambda: two strokes from the apex down to the feet
      const seg = (ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy))); return Math.hypot(x - ax - t * vx, y - ay - t * vy); };
      if (seg(11.5, 18, 6.5, 5) < 1.3 || seg(11.5, 18, 16.5, 5) < 1.3) return "team";
      return "bronze";
    }
    if (z === 13) return r <= 11 ? "bronze" : null;
    if (z === 12) return r <= 11.8 ? "bronze" : null;
    if (z === 11) return r <= 11.2 ? "wood" : null;
    if (z === 10) return r <= 2 || (Math.abs(y - 11.5) < 1 && Math.abs(x - 11.5) < 7) ? "leather" : null; // arm band and grip
    return null;
  },
  // ---- caesar (seated, facing +x; the renderer turns him to face the arena)
  "caesar/body": (x, y, z) => {
    if (y <= 6) {                                                  // lower legs and sandals
      if (x < 12 || x > 16 || !(z >= 3 && z <= 5 || z >= 9 && z <= 11)) return null;
      return y <= 1 ? "leather" : "skin";
    }
    if (y <= 11 && x >= 6 && x <= 17 && z >= 2 && z <= 12) return y === 11 && x >= 15 ? null : "toga"; // lap
    if (!ell(x, 0, z, 8, 0, C, 4.4 + (y > 18 ? 0.4 : 0), 1, 4.6 + (y > 17 ? 1 : 0)) || y > 21) return null;
    if (x <= 5) return "purple";                                   // purple cloak behind
    if (Math.abs((x - 4) - (21 - y) * 0.6) < 1.2) return "purple"; // sash
    return "toga";
  },
  "caesar/head": (x, y, z) => {
    if (!ell(x, y, z, 4.8, 5, C, 3.9, 4.9, 3.6)) return null;
    if (y >= 6 && y <= 7 && !ell(x, y, z, 4.8, 5, C, 3.0, 4.0, 2.7)) return "laurel";
    if (y >= 8 || (x <= 2 && y >= 4)) return "hair";
    if (x >= 7 && y === 6 && (z === 5 || z === 9)) return "eye";
    return "skin";
  },
  "caesar/upperArm": (x, y, z) => cyl(x, z, 2, C, 2.2) ? "toga" : null,
  "caesar/fist": (x, y, z) => {
    if (y <= 3) return x <= 4 && z >= 5 && z <= 9 ? "skin" : null;
    return cyl(x, z, 2, C, 1.9) ? (y >= 8 ? "toga" : "skin") : null;
  },
  "caesar/thumb": (x, y, z) => x === 1 && z >= 6 && z <= 8 ? "skin" : null,
  // ---- spectator (tunic in gray so the renderer can recolour per spectator)
  "spectator/body": (x, y, z) => {
    if (y <= 7) return (x >= 3 && x <= 6) && (z >= 4 && z <= 5 || z >= 9 && z <= 10) ? (y <= 4 ? "skin" : "gray") : null;
    if (!ell(x, 0, z, 5, 0, C, 3.4 + (y > 14 ? 0.3 : 0), 1, 3.8 + (y > 13 ? 1 : 0))) return null;
    return y >= 17 ? "skin" : "gray";
  },
  "spectator/head": (x, y, z) => {
    if (!ell(x, y, z, 4, 4, C, 3.3, 3.8, 3.2)) return null;
    if (y >= 6 || (x <= 2 && y >= 3)) return "hair";
    if (x >= 6 && y === 4 && (z === 5 || z === 9)) return "eye";
    return "skin";
  },
  "spectator/arm": (x, y, z) => cyl(x, z, 1, C, 1.3) ? (y <= 2 ? "skin" : "gray") : null,
  // ---- lion
  "lion/body": (x, y, z) => {
    if (!ell(x, y, z, 15, 7, C, 14.6, 6.2, 5.2)) return null;
    if (x >= 21 && y >= 4) return "mane";                          // mane flows onto the shoulders
    return y <= 3 ? (hash(x, y, z) < 0.5 ? "fur" : "fur") : "fur";
  },
  "lion/head": (x, y, z) => {
    if (x >= 7 && x <= 13 && y >= 2 && y <= 8 && z >= 4 && z <= 10) {   // muzzle
      if (x === 13 && y >= 6 && z >= 6 && z <= 8) return "nose";
      if (x >= 9 && y === 2) return "fur";
      if (x === 10 && y === 8 && (z === 4 || z === 10)) return "eye";
      if (x >= 12 && y <= 3) return null;
      return "fur";
    }
    if (ell(x, y, z, 5, 8, C, 6.4, 6.6, 6.4)) return y >= 13 && x >= 5 && x <= 7 && (z === 3 || z === 11) ? "fur" : "mane";
    return null;
  },
  "lion/frontLeg": (x, y, z) => y <= 2 ? (x <= 4 && z >= 5 && z <= 9 ? "fur" : null) : (cyl(x, z, 2, C, 2) ? "fur" : null),
  "lion/backLeg": (x, y, z) => y <= 2 ? (x >= 1 && x <= 5 && z >= 5 && z <= 9 ? "fur" : null) : (cyl(x, z, 3, C, 1.8 + 1.0 * (y / 12)) ? "fur" : null),
  "lion/tail": (x, y, z) => {
    const cy = 2 + Math.sin(x / 13 * Math.PI) * 0.8 - (x < 4 ? 1 : 0);
    if (x <= 2) return Math.abs(y - 1.5) <= 1.6 && z >= 6 && z <= 8 ? "mane" : null; // tuft
    return Math.abs(y - cy) < 0.7 && z === C ? "fur" : null;
  },
  // ---- elephant: the body is one ellipsoid split across two sheets
  "elephant/bodyFront": (x, y, z) => elephantBody(x, y, z),
  "elephant/bodyBack": (x, y, z) => elephantBody(x, y, z - 15),
  "elephant/head": (x, y, z) => {
    if (x >= 10 && y >= 3 && y <= 5 && (z === 3 || z === 11) && x <= 15) return "ivory";            // tusks
    if (x >= 13 && y >= 5 && y <= 6 && (z === 3 || z === 11) && x <= 15) return "ivory";
    if (!ell(x, y, z, 6, 12, C, 6.8, 9.5, 6.6)) return null;
    if (x === 11 && y === 14 && (z === 3 || z === 11)) return "eye";
    return "hide";
  },
  "elephant/ear": (x, y, z) => z >= 6 && z <= 8 && ell(x, y, 0, 3.6, 8, 0, 4, 7.8, 1) ? (z === 8 && ell(x, y, 0, 3.6, 8, 0, 2.6, 6, 1) ? "pink" : "hide") : null,
  "elephant/trunk": (x, y, z) => cyl(x, z, 3, C, 2.0 + 0.6 * (y / 11)) ? (y % 3 === 0 ? "hide" : "hide") : null,
  "elephant/leg": (x, y, z) => {
    if (y <= 2) { if (!cyl(x, z, 5, C, 4.9)) return null; return x >= 8 && y <= 1 && (z === 5 || z === 7 || z === 9) ? "ivory" : "hide"; }
    return cyl(x, z, 5, C, 4.5) ? "hide" : null;
  },
  "elephant/tail": (x, y, z) => x === 1 && z === C ? (y <= 2 ? "hair" : "hide") : null,
};
function elephantBody(x, y, zc) {
  return ell(x, y, zc, 21.5, 15, -0.5, 21.6, 14.6, 13.6) ? "hide" : null;
}
// Shading hints per material: some get wrinkles or fur texture.
const TEXTURE = { hide: 0.18, fur: 0.15, mane: 0.25, toga: 0.06, leather: 0.1, skin: 0.04, bronze: 0.08, laurel: 0.3 };

function renderSheet(model, sheet, w, h) {
  const D = SA.SLICES, fn = DRAW[`${model}/${sheet}`];
  if (!fn) throw new Error(`no drawing for ${model}/${sheet}`);
  const mat = new Array(w * h * D).fill(null);
  const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= w || y >= h || z >= D) ? null : mat[(z * h + y) * w + x];
  for (let z = 0; z < D; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mat[(z * h + y) * w + x] = fn(x, y, z);
  const rgba = new Uint8Array(w * D * h * 4);
  for (let z = 0; z < D; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const m = at(x, y, z);
    if (!m) continue;
    // light from above and the front: top and front faces lighter, undersides darker
    let shade = 1;
    if (at(x, y + 1, z) === null || at(x + 1, y, z) === null && at(x, y + 1, z) === null) shade = 2;
    if (at(x, y - 1, z) === null && at(x, y + 1, z) !== null) shade = 0;
    if (TEXTURE[m] && hash(x, y, z, sheet.length) < TEXTURE[m]) shade = Math.max(0, shade - 1);
    const c = PAL[m][shade];
    const s = D - 1 - z, sx = s * w + x, sy = h - 1 - y, i = (sy * w * D + sx) * 4;
    rgba[i] = c >> 16; rgba[i + 1] = (c >> 8) & 255; rgba[i + 2] = c & 255; rgba[i + 3] = 255;
  }
  return rgba;
}

// ---------------------------------------------------------------- backdrop (640x200)
function renderBackdrop() {
  const W = 640, H = 200, px = new Uint8Array(W * H * 4);
  const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; px[i] = c >> 16; px[i + 1] = (c >> 8) & 255; px[i + 2] = c & 255; px[i + 3] = 255; };
  const SKY = [0x2f5fa8, 0x3e72b8, 0x5487c6, 0x6e9dd2, 0x8db4dc, 0xaecbe4, 0xcbdde8];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = y / 120 * (SKY.length - 1), k = Math.floor(t), f = t - k;
    const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y & 3][x & 3] / 16;
    put(x, y, SKY[Math.min(SKY.length - 1, k + (f > bayer ? 1 : 0))]);
  }
  // soft clouds
  for (const [cx, cy, r] of [[90, 30, 26], [130, 26, 18], [300, 18, 22], [520, 34, 28], [560, 28, 16]])
    for (let y = -r; y <= r; y++) for (let x = -2 * r; x <= 2 * r; x++)
      if ((x / (2 * r)) ** 2 + (y / r) ** 2 < 1 && y < r * 0.4) put(cx + x, cy + y, y < -r * 0.3 ? 0xffffff : 0xe6eef4);
  // temple on a hill behind the arena, right of centre
  const tx = 440, base = 78;
  for (let x = tx - 70; x <= tx + 70; x++) for (let y = base; y < 110; y++) put(x, y, 0x8a9a6a);
  for (let x = tx - 54; x <= tx + 54; x++) { for (let y = base - 4; y < base; y++) put(x, y, 0xe8e0c8); }                // stylobate
  for (let c = 0; c < 8; c++) { const cx = tx - 48 + c * 13.7 | 0; for (let y = base - 30; y < base - 4; y++) for (let x = cx; x < cx + 6; x++) put(x, y, x === cx ? 0xb8ae96 : x === cx + 5 ? 0xc8c0a8 : 0xf4eedc); }
  for (let x = tx - 56; x <= tx + 56; x++) for (let y = base - 36; y < base - 30; y++) put(x, y, y === base - 36 ? 0xfffaf0 : 0xd8d0b8); // entablature
  for (let y = 0; y < 16; y++) for (let x = -58 + y * 3.4 | 0; x <= 58 - y * 3.4; x++) put(tx + x, base - 37 - y, y === 0 ? 0xc8c0a8 : 0xece4cc); // pediment
  // the arena's far stands: an arched outer wall and tiers of crowd, curving slightly
  const curve = x => Math.round(((x - 320) / 320) ** 2 * 10);
  const rnd = (x, y) => hash(x, y, 7);
  const CROWD = [0xd03a30, 0xe8dcc0, 0x3a6ab0, 0xe0a070, 0x6a2482, 0x5a8a3a, 0xc8923c, 0xf0ece0, 0x8a4a2a];
  for (let x = 0; x < W; x++) {
    const c = curve(x);
    // top wall with arches
    for (let y = 92 + c; y < 120 + c; y++) {
      const ax = x % 22, ay = y - 92 - c;
      const arch = ax >= 5 && ax <= 16 && ay >= 8 && (ay >= 12 || (ax - 10.5) ** 2 + (ay - 12) ** 2 <= 30);
      put(x, y, arch ? 0x5a4a38 : (ay === 0 || ay === 27 ? 0xb8a888 : ((x + y) % 9 === 0 ? 0xc8b898 : 0xd8c8a6)));
    }
    // flag poles on top of the wall
    if (x % 88 === 40) for (let y = 70 + c; y < 92 + c; y++) { put(x, y, 0x6a5038); if (y < 80 + c) for (let k = 1; k < 9; k++) put(x + k, y, (y + k) % 4 ? 0xd03a30 : 0xa02424); }
    // tiers of crowd
    for (let y = 120 + c; y < H; y++) {
      const row = (y - 120 - c) % 6;
      if (row === 0) put(x, y, 0xa89878);                            // tier step
      else if (row >= 3) put(x, y, rnd(x >> 1, y) < 0.85 ? CROWD[Math.floor(rnd(x >> 1, y >> 1) * CROWD.length)] : 0x403020); // bodies
      else put(x, y, rnd(x >> 1, (y >> 1) + 99) < 0.7 ? (rnd(x, y) < 0.3 ? 0x3a2414 : 0xc47e55) : 0x8a7a5a); // heads
    }
  }
  return px;
}

// ---------------------------------------------------------------- main
let wrote = 0, kept = 0;
for (const e of SA.sheetPaths()) {
  const path = join(game, e.path);
  if (existsSync(path) && !force) { console.log(`kept ${e.path}`); kept++; continue; }
  writePng(path, e.w * SA.SLICES, e.h, renderSheet(e.model, e.sheet, e.w, e.h));
  console.log(`wrote ${e.path}`); wrote++;
}
const bd = join(game, "backdrop.png");
if (existsSync(bd) && !force) { console.log("kept backdrop.png"); kept++; }
else { writePng(bd, 640, 200, renderBackdrop()); console.log("wrote backdrop.png"); wrote++; }
console.log(`${wrote} written, ${kept} kept${force ? " (--force)" : ""}`);
