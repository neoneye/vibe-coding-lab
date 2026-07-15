// Terrain heightmap: hm[x] = y of the surface at column x (smaller y = higher
// ground, canvas coordinates). No overhangs, so carving a hole automatically
// models the sand above collapsing into it.
window.SE = window.SE || {};

(function (SE) {
    'use strict';

    // Small seedable PRNG so terrain/AI math can be tested deterministically.
    SE.mulberry32 = function (seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };

    // Midpoint displacement over a 2^k+1 grid, interpolated to `width` columns.
    function generate(width, height, rng) {
        rng = rng || Math.random;
        var k = 8;
        var n = (1 << k) + 1; // 257 control points
        var pts = new Float64Array(n);
        var minY = height * 0.25;
        var maxY = height * 0.9;
        pts[0] = height * (0.55 + rng() * 0.3);
        pts[n - 1] = height * (0.55 + rng() * 0.3);
        var amplitude = height * 0.45;
        var roughness = 0.55;
        for (var step = (n - 1) / 2; step >= 1; step = Math.floor(step / 2)) {
            for (var i = step; i < n; i += step * 2) {
                var mid = (pts[i - step] + pts[i + step]) / 2;
                pts[i] = mid + (rng() * 2 - 1) * amplitude;
            }
            amplitude *= roughness;
            if (step === 1) break;
        }
        var hm = new Float64Array(width);
        for (var x = 0; x < width; x++) {
            var f = (x / (width - 1)) * (n - 1);
            var i0 = Math.floor(f);
            var i1 = Math.min(n - 1, i0 + 1);
            var t = f - i0;
            var y = pts[i0] * (1 - t) + pts[i1] * t;
            hm[x] = Math.min(maxY, Math.max(minY, y));
        }
        return hm;
    }

    // Remove a circular disc of terrain centered at (cx, cy). For each column,
    // the removed thickness is the overlap between the circle and the ground;
    // the surface drops by that amount (collapse included).
    function carve(hm, cx, cy, radius, floorY) {
        var w = hm.length;
        var x0 = Math.max(0, Math.ceil(cx - radius));
        var x1 = Math.min(w - 1, Math.floor(cx + radius));
        for (var x = x0; x <= x1; x++) {
            var dx = x - cx;
            var half = Math.sqrt(radius * radius - dx * dx);
            var top = cy - half;
            var bottom = cy + half;
            var removed = bottom - Math.max(top, hm[x]);
            if (removed > 0) {
                hm[x] = hm[x] + removed;
                if (floorY !== undefined) hm[x] = Math.min(hm[x], floorY);
            }
        }
    }

    // Pile a half-disc mound of dirt centered on column cx.
    function addDirt(hm, cx, radius, ceilY) {
        if (ceilY === undefined) ceilY = 20;
        var w = hm.length;
        var x0 = Math.max(0, Math.ceil(cx - radius));
        var x1 = Math.min(w - 1, Math.floor(cx + radius));
        for (var x = x0; x <= x1; x++) {
            var dx = x - cx;
            var half = Math.sqrt(radius * radius - dx * dx);
            hm[x] = Math.max(ceilY, hm[x] - half);
        }
    }

    SE.terrain = { generate: generate, carve: carve, addDirt: addDirt };
})(window.SE);
