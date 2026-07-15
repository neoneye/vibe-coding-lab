// Ballistics. Angle convention: 0 = right, 90 = straight up, 180 = left.
// Canvas y grows downward, so upward velocity is negative vy.
window.SE = window.SE || {};

(function (SE) {
    'use strict';

    var GRAVITY = 240;    // px/s^2
    var WIND_ACCEL = 6;   // px/s^2 per wind unit (wind ranges about -10..10)
    var SPEED_PER_POWER = 4.4; // muzzle speed = power * this (power 0..100)

    function launchVelocity(angleDeg, power) {
        var a = angleDeg * Math.PI / 180;
        var speed = power * SPEED_PER_POWER;
        return { vx: Math.cos(a) * speed, vy: -Math.sin(a) * speed };
    }

    function step(p, wind, dt) {
        p.vx += wind * WIND_ACCEL * dt;
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
    }

    // Simulate a shot against the heightmap. Returns {hitX, hitY, t} on
    // surface impact, or null if it leaves the world sideways / times out.
    function simulateShot(x0, y0, angleDeg, power, wind, hm, W, H) {
        var v = launchVelocity(angleDeg, power);
        var p = { x: x0, y: y0, vx: v.vx, vy: v.vy };
        var dt = 1 / 240;
        var maxT = 30;
        for (var t = 0; t < maxT; t += dt) {
            step(p, wind, dt);
            if (p.x < -50 || p.x > W + 50) return null;
            if (p.y > H + 50) return null;
            var xi = Math.round(p.x);
            if (xi >= 0 && xi < hm.length && p.y >= hm[xi]) {
                return { hitX: p.x, hitY: p.y, t: t };
            }
        }
        return null;
    }

    SE.physics = {
        GRAVITY: GRAVITY,
        WIND_ACCEL: WIND_ACCEL,
        SPEED_PER_POWER: SPEED_PER_POWER,
        launchVelocity: launchVelocity,
        step: step,
        simulateShot: simulateShot
    };
})(window.SE);
