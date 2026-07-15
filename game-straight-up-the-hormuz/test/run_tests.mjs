// Headless test harness: extracts the hormuz-logic script block from
// index.html and runs assertions against globalThis.Hormuz.
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
const m = html.match(/<script id="hormuz-logic">([\s\S]*?)<\/script>/);
if (!m) throw new Error('logic script block not found');
(0, eval)(m[1]);
const H = globalThis.Hormuz;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
// simple deterministic rng for tests
function makeRng(seed = 42) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

test('namespace basics', () => {
  assert.equal(H.SHIPS.length, 5);
  assert.deepEqual(H.SHIPS.map(s => s.size), [5, 4, 3, 3, 2]);
  assert.deepEqual(H.DIFFICULTIES.normal, { oil: 50, mines: 16, oilFields: 6 });
});

test('createGame board integrity', () => {
  const st = H.createGame('normal', makeRng(7));
  assert.equal(st.oil, 50);
  assert.equal(st.status, 'playing');
  assert.equal(st.empRemaining, 0);
  const flat = st.cells.flat();
  assert.equal(flat.filter(c => c.content === 'ship').length, 17);
  assert.equal(flat.filter(c => c.content === 'mine').length, 16);
  assert.equal(flat.filter(c => c.content === 'oil').length, 6);
  // ships straight, right size, cells arrays match the grid
  assert.deepEqual(st.ships.map(s => s.size), [5, 4, 3, 3, 2]);
  for (const [i, ship] of st.ships.entries()) {
    assert.equal(ship.cells.length, ship.size);
    const rs = new Set(ship.cells.map(([r]) => r));
    const cs = new Set(ship.cells.map(([, c]) => c));
    assert.ok(rs.size === 1 || cs.size === 1, `${ship.name} not straight`);
    for (const [r, c] of ship.cells) {
      assert.equal(st.cells[r][c].content, 'ship');
      assert.equal(st.cells[r][c].shipIndex, i);
    }
  }
  // numbers correct on every water cell
  const K = ['ship', 'mine', 'oil'];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    if (st.cells[r][c].content !== 'water') continue;
    let n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const cell = (st.cells[r + dr] || [])[c + dc];
      if (cell && K.includes(cell.content)) n++;
    }
    assert.equal(st.cells[r][c].number, n, `number at ${r},${c}`);
  }
  // variant mix (normal): 2 depth, 2 oilfire, 2 emp, 10 standard
  const mines = flat.filter(c => c.content === 'mine').map(c => c.mineType);
  for (const t of ['depth', 'oilfire', 'emp']) assert.equal(mines.filter(x => x === t).length, 2, t);
  assert.equal(mines.filter(x => x === 'standard').length, 10);
});

test('createGame easy variant mix and counts', () => {
  const st = H.createGame('easy', makeRng(11));
  assert.equal(st.oil, 60);
  const mines = st.cells.flat().filter(c => c.content === 'mine').map(c => c.mineType);
  assert.equal(mines.length, 12);
  for (const t of ['depth', 'oilfire', 'emp']) assert.equal(mines.filter(x => x === t).length, 1, t);
  assert.equal(mines.filter(x => x === 'standard').length, 9);
  assert.equal(st.cells.flat().filter(c => c.content === 'oil').length, 8);
});

test('every fleet has at least one horizontal and one vertical ship', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const st = H.createGame('normal', makeRng(seed));
    let horizontal = 0, vertical = 0;
    for (const ship of st.ships) {
      if (new Set(ship.cells.map(([r]) => r)).size === 1) horizontal++;
      else vertical++;
    }
    assert.ok(horizontal >= 1 && vertical >= 1, `seed ${seed}: ${horizontal}h/${vertical}v`);
  }
});

test('createGame deterministic per seed', () => {
  const a = H.createGame('easy', makeRng(3)), b = H.createGame('easy', makeRng(3));
  assert.deepEqual(a, b);
});

// find a board (by scanning seeds) containing a water cell matching pred
function findBoard(pred, difficulty = 'normal') {
  for (let seed = 1; seed < 500; seed++) {
    const st = H.createGame(difficulty, makeRng(seed));
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
      if (pred(st, r, c)) return { st, r, c, seed };
    }
  }
  throw new Error('no board found matching predicate');
}

test('reveal water costs 1 oil and yields number event', () => {
  const { st, r, c } = findBoard((s, r, c) => s.cells[r][c].content === 'water' && s.cells[r][c].number > 0);
  const events = H.reveal(st, r, c);
  assert.equal(st.oil, 49);
  assert.equal(st.stats.shots, 1);
  assert.equal(st.stats.oilSpent, 1);
  assert.ok(st.cells[r][c].revealed);
  assert.ok(events.some(e => e.type === 'number' && e.r === r && e.c === c && e.value === st.cells[r][c].number));
});

test('reveal zero floods connected region for one oil', () => {
  const { st, r, c } = findBoard((s, r, c) => s.cells[r][c].content === 'water' && s.cells[r][c].number === 0);
  const events = H.reveal(st, r, c);
  assert.equal(st.oil, 49);
  // all 8 neighbours of the zero cell must now be revealed
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const cell = (st.cells[r + dr] || [])[c + dc];
    if (cell) assert.ok(cell.revealed, `neighbour ${r + dr},${c + dc} not revealed`);
  }
  const flood = events.find(e => e.type === 'flood');
  assert.ok(flood && flood.count >= 1);
});

test('hitting every segment sinks the ship', () => {
  const st = H.createGame('normal', makeRng(7));
  st.oil = 500;
  const destroyer = st.ships[4];
  const e1 = H.reveal(st, ...destroyer.cells[0]);
  assert.ok(e1.some(e => e.type === 'hit' && e.ship === 'Destroyer'));
  assert.equal(destroyer.sunk, false);
  const e2 = H.reveal(st, ...destroyer.cells[1]);
  assert.ok(e2.some(e => e.type === 'sunk' && e.ship === 'Destroyer'));
  assert.equal(destroyer.sunk, true);
  assert.equal(destroyer.hits, 2);
});

test('oil field capture nets +9', () => {
  const { st, r, c } = findBoard((s, r, c) => s.cells[r][c].content === 'oil');
  const events = H.reveal(st, r, c);
  assert.equal(st.oil, 59); // 50 - 1 + 10
  assert.equal(st.stats.oilGained, 10);
  assert.ok(events.some(e => e.type === 'oil' && e.amount === 10));
});

test('reveal rejected when out of oil / re-revealed / not playing', () => {
  const { st, r, c } = findBoard((s, r, c) => s.cells[r][c].content === 'water' && s.cells[r][c].number > 0);
  st.oil = 0;
  assert.deepEqual(H.reveal(st, r, c), [{ type: 'rejected', reason: 'no-oil' }]);
  st.oil = 5;
  H.reveal(st, r, c);
  assert.deepEqual(H.reveal(st, r, c), [{ type: 'rejected', reason: 'revealed' }]);
  st.status = 'won';
  assert.deepEqual(H.reveal(st, 0, 0), [{ type: 'rejected', reason: 'not-playing' }]);
});

test('sinking the whole fleet wins, even on the last drop of oil', () => {
  const st = H.createGame('normal', makeRng(7));
  st.oil = 17;
  let events = [];
  for (const ship of st.ships) for (const [r, c] of ship.cells) events = H.reveal(st, r, c);
  assert.equal(st.oil, 0);
  assert.equal(st.status, 'won');
  assert.ok(events.some(e => e.type === 'won'));
});

test('running dry with ships afloat loses', () => {
  const { st, r, c } = findBoard((s, r, c) => s.cells[r][c].content === 'water' && s.cells[r][c].number > 0);
  st.oil = 1;
  const events = H.reveal(st, r, c);
  assert.equal(st.oil, 0);
  assert.equal(st.status, 'lost');
  assert.ok(events.some(e => e.type === 'lost'));
});

test('flags are free, toggle, and clear on reveal', () => {
  const { st, r, c } = findBoard((s, r, c) => s.cells[r][c].content === 'water' && s.cells[r][c].number > 0);
  H.toggleFlag(st, r, c);
  assert.equal(st.cells[r][c].flagged, true);
  assert.equal(st.oil, 50);
  H.toggleFlag(st, r, c);
  assert.equal(st.cells[r][c].flagged, false);
  H.toggleFlag(st, r, c);
  H.reveal(st, r, c);
  assert.equal(st.cells[r][c].flagged, false);
});

function findMine(type) {
  return findBoard((s, r, c) => s.cells[r][c].content === 'mine' && s.cells[r][c].mineType === type);
}

test('standard mine costs 3 oil on top of the shot', () => {
  const { st, r, c } = findMine('standard');
  const events = H.reveal(st, r, c);
  assert.equal(st.oil, 46); // 50 - 1 shot - 3 penalty
  assert.equal(st.stats.minesHit, 1);
  assert.ok(events.some(e => e.type === 'mine' && e.mineType === 'standard' && e.penalty === 3));
});

test('depth charge: -5, reveals neighbours, burns their oil, hits their ships, duds their mines', () => {
  const { st, r, c } = findMine('depth');
  const before = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const cell = (st.cells[r + dr] || [])[c + dc];
    if (cell) before.push([r + dr, c + dc, cell]);
  }
  const events = H.reveal(st, r, c);
  assert.ok(events.some(e => e.type === 'mine' && e.mineType === 'depth' && e.penalty === 5));
  let expectedOil = 50 - 1 - 5;
  for (const [rr, cc, cell] of before) {
    assert.ok(cell.revealed, `neighbour ${rr},${cc} not revealed`);
    if (cell.content === 'oil') {
      assert.equal(cell.burned, true);
    } else if (cell.content === 'mine') {
      assert.ok(events.some(e => e.type === 'mine' && e.r === rr && e.c === cc && e.dud === true));
    } else if (cell.content === 'ship') {
      assert.ok(events.some(e => e.type === 'hit' && e.r === rr && e.c === cc));
    }
  }
  assert.equal(st.stats.minesHit, 1); // dud mines don't count as hit
  assert.equal(st.stats.oilGained, 0); // neighbour oil burned, never paid out
  if (st.status === 'playing') assert.equal(st.oil, Math.max(0, expectedOil));
});

test('oil fire burns the nearest unrevealed oil field', () => {
  const { st, r, c } = findMine('oilfire');
  const fields = [];
  for (let rr = 0; rr < 10; rr++) for (let cc = 0; cc < 10; cc++) {
    if (st.cells[rr][cc].content === 'oil') fields.push([rr, cc, (rr - r) ** 2 + (cc - c) ** 2]);
  }
  const minD = Math.min(...fields.map(f => f[2]));
  const events = H.reveal(st, r, c);
  const ev = events.find(e => e.type === 'mine' && e.mineType === 'oilfire');
  assert.ok(ev && ev.target, 'no oilfire target');
  const [tr, tc] = ev.target;
  assert.equal((tr - r) ** 2 + (tc - c) ** 2, minD, 'did not burn the nearest field');
  assert.equal(st.cells[tr][tc].burned, true);
  assert.equal(st.cells[tr][tc].revealed, true);
  assert.equal(st.oil, 49); // only the shot itself
});

test('oil fire falls back to standard when no oil fields remain', () => {
  const { st, r, c } = findMine('oilfire');
  for (const row of st.cells) for (const cell of row) {
    if (cell.content === 'oil') { cell.revealed = true; cell.burned = true; }
  }
  const events = H.reveal(st, r, c);
  assert.equal(st.oil, 46);
  assert.ok(events.some(e => e.type === 'mine' && e.mineType === 'oilfire' && e.fallback === true && e.penalty === 3));
});

test('EMP sets a 3-action lockout that paid actions tick down', () => {
  const { st, r, c } = findMine('emp');
  st.oil = 100;
  H.reveal(st, r, c);
  assert.equal(st.empRemaining, 3);
  // three paid reveals tick it back to 0
  let ticked = 0;
  for (let rr = 0; rr < 10 && ticked < 3; rr++) for (let cc = 0; cc < 10 && ticked < 3; cc++) {
    const cell = st.cells[rr][cc];
    if (!cell.revealed && cell.content === 'water' && cell.number > 0) {
      H.reveal(st, rr, cc);
      ticked++;
      assert.equal(st.empRemaining, 3 - ticked);
    }
  }
  assert.equal(ticked, 3);
});

test('a mine penalty can lose the game', () => {
  const { st, r, c } = findMine('standard');
  st.oil = 2;
  const events = H.reveal(st, r, c);
  assert.equal(st.oil, 0);
  assert.equal(st.status, 'lost');
  assert.ok(events.some(e => e.type === 'lost'));
});

function count3x3(st, r, c) {
  const out = { ships: 0, mines: 0, oil: 0 };
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const cell = (st.cells[r + dr] || [])[c + dc];
    if (!cell) continue;
    if (cell.content === 'ship') out.ships++;
    else if (cell.content === 'mine') out.mines++;
    else if (cell.content === 'oil') out.oil++;
  }
  return out;
}

test('recon reports 3x3 counts for 3 oil, tiles stay hidden', () => {
  const st = H.createGame('normal', makeRng(7));
  const expected = count3x3(st, 4, 4);
  const events = H.recon(st, 4, 4);
  assert.equal(st.oil, 47);
  const ev = events.find(e => e.type === 'recon');
  assert.deepEqual({ ships: ev.ships, mines: ev.mines, oil: ev.oil }, expected);
  assert.deepEqual(st.reconZones, [{ r: 4, c: 4, ...expected }]);
  for (const row of st.cells) for (const cell of row) assert.equal(cell.revealed, false);
});

test('recon clips at the corner', () => {
  const st = H.createGame('normal', makeRng(9));
  const expected = count3x3(st, 0, 0);
  const ev = H.recon(st, 0, 0).find(e => e.type === 'recon');
  assert.deepEqual({ ships: ev.ships, mines: ev.mines, oil: ev.oil }, expected);
});

test('recon rejected when broke', () => {
  const st = H.createGame('normal', makeRng(7));
  st.oil = 2;
  assert.deepEqual(H.recon(st, 4, 4), [{ type: 'rejected', reason: 'no-oil' }]);
});

test('bombing run resolves 3 cells in a line for 5 oil', () => {
  const st = H.createGame('normal', makeRng(7));
  st.oil = 500;
  const destroyer = st.ships[4];
  const [[r0, c0], [r1, c1]] = destroyer.cells;
  const orientation = r0 === r1 ? 'row' : 'col';
  // centre the run on the first segment so it covers both destroyer cells
  const events = H.bombingRun(st, orientation, r1, c1);
  const targets = [];
  for (let k = -1; k <= 1; k++) {
    const rr = orientation === 'col' ? r1 + k : r1;
    const cc = orientation === 'row' ? c1 + k : c1;
    if (rr >= 0 && rr < 10 && cc >= 0 && cc < 10) targets.push([rr, cc]);
  }
  for (const [rr, cc] of targets) assert.ok(st.cells[rr][cc].revealed, `cell ${rr},${cc} not revealed`);
  assert.ok(events.filter(e => e.type === 'hit').length >= 1);
  assert.equal(st.stats.oilSpent, 5);
});

test('bombing run clips at board edge', () => {
  const st = H.createGame('normal', makeRng(7));
  st.oil = 500;
  H.bombingRun(st, 'row', 0, 0); // covers (0,-1)=(clip),(0,0),(0,1)
  assert.ok(st.cells[0][0].revealed);
  assert.ok(st.cells[0][1].revealed);
});

test('bombing run triggers mines it hits', () => {
  const { st, r, c } = findMine('standard');
  st.oil = 500;
  const events = H.bombingRun(st, 'row', r, c);
  assert.ok(events.some(e => e.type === 'mine' && e.mineType === 'standard' && e.penalty === 3));
});

test('EMP locks out both abilities until it expires', () => {
  const { st, r, c } = findMine('emp');
  st.oil = 100;
  H.reveal(st, r, c);
  assert.equal(st.empRemaining, 3);
  assert.deepEqual(H.recon(st, 4, 4), [{ type: 'rejected', reason: 'emp' }]);
  assert.deepEqual(H.bombingRun(st, 'row', 4, 4), [{ type: 'rejected', reason: 'emp' }]);
  assert.equal(st.empRemaining, 3); // rejections are not actions
  let ticked = 0;
  for (let rr = 0; rr < 10 && ticked < 3; rr++) for (let cc = 0; cc < 10 && ticked < 3; cc++) {
    const cell = st.cells[rr][cc];
    if (!cell.revealed && cell.content === 'water' && cell.number > 0) { H.reveal(st, rr, cc); ticked++; }
  }
  assert.equal(st.empRemaining, 0);
  assert.ok(H.recon(st, 4, 4).some(e => e.type === 'recon'));
});

test('abilities can run you dry and lose the game', () => {
  const st = H.createGame('normal', makeRng(7));
  st.oil = 3;
  const events = H.recon(st, 4, 4);
  assert.equal(st.oil, 0);
  assert.equal(st.status, 'lost');
  assert.ok(events.some(e => e.type === 'lost'));
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (e) { failed++; console.error(`FAIL - ${name}\n${e.stack}`); }
}
if (failed) { console.error(`${failed} test(s) failed`); process.exit(1); }
console.log('ALL TESTS PASSED');
