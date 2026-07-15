// AI aiming: grid-search the ballistic space with simulateShot, refine around
// the best hit, then add difficulty-scaled error. `lastMiss` (signed dx of the
// previous shot vs the same target) lets higher difficulties walk fire onto
// the target.
window.SE = window.SE || {};

(function (SE) {
    'use strict';

    var DIFFICULTY = {
        easy:   { angleErr: 12,  powerErr: 10, correction: 0.0 },
        normal: { angleErr: 5,   powerErr: 5,  correction: 0.5 },
        hard:   { angleErr: 1.5, powerErr: 2,  correction: 0.9 }
    };

    function noise(rng, scale) {
        return (rng() + rng() - 1) * scale;
    }

    function searchBest(x0, y0, aimX, wind, hm, W, H, aMin, aMax, aStep, pMin, pMax, pStep) {
        var best = null;
        for (var a = aMin; a <= aMax; a += aStep) {
            for (var p = pMin; p <= pMax; p += pStep) {
                var hit = SE.physics.simulateShot(x0, y0, a, p, wind, hm, W, H);
                if (!hit) continue;
                var err = Math.abs(hit.hitX - aimX);
                if (!best || err < best.err) {
                    best = { angle: a, power: p, err: err, hitX: hit.hitX };
                }
            }
        }
        return best;
    }

    // me/target: {x, y, hp}. Returns {angle, power, weaponId, predictedErr}.
    function planShot(me, target, wind, hm, W, H, difficulty, lastMiss, rng) {
        rng = rng || Math.random;
        var diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;

        var aimX = target.x;
        if (lastMiss && typeof lastMiss.dx === 'number') {
            aimX = target.x - lastMiss.dx * diff.correction;
        }

        var x0 = me.x;
        var y0 = me.y - 10; // roughly the muzzle height
        var best = searchBest(x0, y0, aimX, wind, hm, W, H, 15, 165, 5, 20, 100, 8);
        if (best) {
            var refined = searchBest(x0, y0, aimX, wind, hm, W, H,
                Math.max(15, best.angle - 4), Math.min(165, best.angle + 4), 1,
                Math.max(20, best.power - 6), Math.min(100, best.power + 6), 2);
            if (refined && refined.err < best.err) best = refined;
        }
        if (!best) {
            // Nothing lands (e.g. absurd wind) — lob toward the target and hope.
            best = { angle: target.x > me.x ? 60 : 120, power: 70, err: 9999 };
        }

        var angle = Math.min(165, Math.max(15, best.angle + noise(rng, diff.angleErr)));
        var power = Math.min(100, Math.max(15, best.power + noise(rng, diff.powerErr)));

        var weaponId = pickWeapon(me, target, best.err, rng);
        return { angle: angle, power: power, weaponId: weaponId, predictedErr: best.err };
    }

    // me.ammo is a map weaponId -> remaining count.
    function pickWeapon(me, target, predictedErr, rng) {
        var ammo = me.ammo || {};
        if ((ammo.bigNuke || 0) > 0 && predictedErr < 25 && target.hp > 40) return 'bigNuke';
        if ((ammo.mirv || 0) > 0 && rng() < 0.25) return 'mirv';
        if ((ammo.missile || 0) > 0) return 'missile';
        return 'babyMissile';
    }

    SE.ai = { planShot: planShot, DIFFICULTY: DIFFICULTY };
})(window.SE);
