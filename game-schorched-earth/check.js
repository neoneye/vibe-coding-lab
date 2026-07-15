// Node sanity checks for the pure game core. Run: node check.js
'use strict';

global.window = {};
require('./js/countries.js');
require('./js/weapons.js');
require('./js/terrain.js');
require('./js/physics.js');
require('./js/ai.js');
require('./js/tank.js');
require('./js/projectile.js');
require('./js/audio.js'); // must load without an AudioContext
require('./js/game.js');  // must load without touching the DOM

const SE = global.window.SE;
let failures = 0;

function check(name, cond) {
    console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name);
    if (!cond) failures++;
}

// --- data ---
check('12+ countries incl. Iran/Ukraine/Russia',
    SE.COUNTRIES.length >= 12 &&
    ['iran', 'ukraine', 'russia'].every(id => SE.COUNTRIES.some(c => c.id === id)));
check('USA flag: 7 alternating stripes + starred canton',
    (() => {
        const usa = SE.COUNTRIES.find(c => c.id === 'usa');
        return usa && usa.stripes && usa.stripes.length === 7 &&
            usa.stripes[0] === usa.stripes[2] && usa.stripes[1] === '#ffffff' &&
            usa.canton && !!usa.canton.color && !!usa.canton.stars;
    })());
check('6 weapons, baby missile unlimited',
    SE.WEAPONS.length === 6 && SE.WEAPONS[0].ammo === Infinity);

// --- terrain ---
const rng = SE.mulberry32(1234);
const hm = SE.terrain.generate(960, 600, rng);
check('heightmap length/bounds',
    hm.length === 960 && Math.min(...hm) >= 150 && Math.max(...hm) <= 540);
const before400 = hm[400];
SE.terrain.carve(hm, 400, hm[400], 40, 600);
check('carve lowers surface ~radius', hm[400] - before400 > 35);
const afterCarve = hm[400];
SE.terrain.addDirt(hm, 400, 40);
check('dirt raises surface', afterCarve - hm[400] > 35);

// --- physics ---
const flat = new Float64Array(960).fill(550);
const hitR = SE.physics.simulateShot(100, 500, 45, 80, 0, flat, 960, 600);
const hitL = SE.physics.simulateShot(860, 500, 135, 80, 0, flat, 960, 600);
check('45° lands right of launch', hitR && hitR.hitX > 200);
check('mirror symmetry ±3px',
    hitR && hitL && Math.abs((hitR.hitX - 100) - (860 - hitL.hitX)) < 3);
const noWind = SE.physics.simulateShot(100, 500, 60, 70, 0, flat, 960, 600);
const tailWind = SE.physics.simulateShot(100, 500, 60, 70, 8, flat, 960, 600);
check('tailwind carries further',
    noWind && tailWind && tailWind.hitX > noWind.hitX + 20);

// --- AI ---
const zeroNoise = () => 0.5; // noise term (rng()+rng()-1) becomes 0
const plan = SE.ai.planShot(
    { x: 100, y: 540, ammo: { missile: 10 } },
    { x: 600, y: 540, hp: 100 },
    3, flat, 960, 600, 'hard', null, zeroNoise);
const replay = SE.physics.simulateShot(100, 530, plan.angle, plan.power, 3, flat, 960, 600);
check('noiseless hard AI lands within 20px of target',
    replay && Math.abs(replay.hitX - 600) < 20);
const corrected = SE.ai.planShot(
    { x: 100, y: 540, ammo: {} },
    { x: 600, y: 540, hp: 100 },
    3, flat, 960, 600, 'hard', { dx: 30 }, zeroNoise);
check('miss correction shifts aim + falls back to baby missile',
    corrected.weaponId === 'babyMissile');

// --- explosion damage ---
const tanks = [
    Object.assign(Object.create(SE.Tank.prototype),
        { x: 500, y: flat[500] - 6, hp: 100, alive: true, name: 'A' }),
    Object.assign(Object.create(SE.Tank.prototype),
        { x: 700, y: flat[700] - 6, hp: 100, alive: true, name: 'B' })
];
const nuke = SE.WEAPONS.find(w => w.id === 'bigNuke');
const flatCopy = Float64Array.from(flat);
const hits = SE.applyExplosion(505, flatCopy[505], nuke, flatCopy, tanks, 600);
check('near tank damaged, far tank spared',
    tanks[0].hp < 100 && hits.some(h => h.tank === tanks[0]));
check('blast craters terrain', flatCopy[505] > 560);

console.log(failures === 0 ? '\nAll checks passed.' : '\n' + failures + ' check(s) FAILED');
process.exit(failures === 0 ? 0 : 1);
