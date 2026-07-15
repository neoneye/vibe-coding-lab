// Projectile flight + explosion resolution.
window.SE = window.SE || {};

(function (SE) {
    'use strict';

    var DIRECT_HIT_DIST = 14;
    var ROLL_SPEED = 90;       // px/s along the surface
    var ROLL_MAX_TIME = 4;     // s before a roller gives up and explodes
    var SHOOTER_GRACE = 0.25;  // s during which the shooter can't be direct-hit

    function Projectile(opts) {
        this.x = opts.x;
        this.y = opts.y;
        this.vx = opts.vx;
        this.vy = opts.vy;
        this.weapon = opts.weapon;   // entry from SE.WEAPONS
        this.shooter = opts.shooter || null;
        this.isWarhead = !!opts.isWarhead; // MIRV child — never splits again
        this.t = 0;
        this.rolling = false;
        this.rollDir = 0;
        this.rollT = 0;
        this.trail = [];
    }

    // Advance by dt. Returns null while flying, or a list of events:
    //   {type:'explode', x, y}   — resolve with SE.applyExplosion
    //   {type:'fizzle'}          — left the world sideways, no explosion
    //   {type:'split', children} — MIRV apex; children are new Projectiles
    Projectile.prototype.update = function (dt, wind, hm, W, H, tanks) {
        this.t += dt;

        if (this.rolling) {
            return this.updateRolling(dt, hm, W);
        }

        SE.physics.step(this, wind, dt);
        if (this.trail.length === 0 || this.t - this.trail[this.trail.length - 1].t > 0.03) {
            this.trail.push({ x: this.x, y: this.y, t: this.t });
        }

        if (this.x < -50 || this.x > W + 50 || this.y > H + 50) {
            return [{ type: 'fizzle' }];
        }

        // MIRV splits at apex
        if (this.weapon.type === 'mirv' && !this.isWarhead && this.vy >= 0) {
            var children = [];
            for (var i = 0; i < 5; i++) {
                children.push(new Projectile({
                    x: this.x, y: this.y,
                    vx: this.vx + (i - 2) * 30,
                    vy: this.vy,
                    weapon: this.weapon,
                    shooter: this.shooter,
                    isWarhead: true
                }));
            }
            return [{ type: 'split', children: children }];
        }

        // direct tank hit
        for (var j = 0; j < tanks.length; j++) {
            var tank = tanks[j];
            if (!tank.alive) continue;
            if (tank === this.shooter && this.t < SHOOTER_GRACE) continue;
            var dx = tank.x - this.x, dy = tank.y - this.y;
            if (dx * dx + dy * dy < DIRECT_HIT_DIST * DIRECT_HIT_DIST) {
                return [{ type: 'explode', x: this.x, y: this.y }];
            }
        }

        // surface impact
        var xi = Math.round(this.x);
        if (xi >= 0 && xi < hm.length && this.y >= hm[xi]) {
            if (this.weapon.type === 'roller') {
                this.rolling = true;
                this.y = hm[xi] - 2;
                // roll downhill; on a flat/ambiguous slope follow current vx
                var slopeDown = this.slopeDir(hm, xi);
                this.rollDir = slopeDown !== 0 ? slopeDown : (this.vx >= 0 ? 1 : -1);
                return null;
            }
            return [{ type: 'explode', x: this.x, y: Math.min(this.y, hm[xi]) }];
        }
        return null;
    };

    Projectile.prototype.slopeDir = function (hm, xi) {
        var left = hm[Math.max(0, xi - 2)];
        var right = hm[Math.min(hm.length - 1, xi + 2)];
        if (right > left + 0.5) return 1;   // ground drops to the right
        if (left > right + 0.5) return -1;  // ground drops to the left
        return 0;
    };

    Projectile.prototype.updateRolling = function (dt, hm, W) {
        this.rollT += dt;
        var next = this.x + this.rollDir * ROLL_SPEED * dt;
        var xi = Math.round(next);
        if (xi < 1 || xi > hm.length - 2 || this.rollT > ROLL_MAX_TIME) {
            return [{ type: 'explode', x: this.x, y: this.y }];
        }
        // stop at a local minimum: continuing would mean going uphill
        var here = hm[Math.round(this.x)];
        if (hm[xi] < here - 0.25) {
            return [{ type: 'explode', x: this.x, y: here - 1 }];
        }
        this.x = next;
        this.y = hm[xi] - 2;
        this.trail.push({ x: this.x, y: this.y, t: this.t });
        return null;
    };

    Projectile.prototype.draw = function (ctx) {
        ctx.fillStyle = '#ffffffaa';
        for (var i = Math.max(0, this.trail.length - 40); i < this.trail.length; i++) {
            ctx.fillRect(this.trail[i].x - 1, this.trail[i].y - 1, 2, 2);
        }
        ctx.fillStyle = this.weapon.type === 'dirt' ? '#c99b4a' : '#ff4444';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.weapon.type === 'roller' && this.rolling ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
    };

    // Resolve an explosion: deform terrain, damage tanks by proximity, then
    // settle every living tank and apply fall damage. Mutates tank hp/alive.
    // Returns [{tank, dmg}] for every tank that took damage.
    SE.applyExplosion = function (x, y, weapon, hm, tanks, H) {
        var results = [];
        if (weapon.type === 'dirt') {
            SE.terrain.addDirt(hm, x, weapon.radius);
        } else {
            SE.terrain.carve(hm, x, y, weapon.radius, H);
            for (var i = 0; i < tanks.length; i++) {
                var tank = tanks[i];
                if (!tank.alive) continue;
                var dx = tank.x - x, dy = tank.y - y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < weapon.radius) {
                    var dmg = Math.round(weapon.maxDamage * Math.max(0, 1 - dist / weapon.radius));
                    if (dmg > 0) {
                        tank.hp -= dmg;
                        results.push({ tank: tank, dmg: dmg });
                    }
                }
            }
        }
        for (var j = 0; j < tanks.length; j++) {
            var t2 = tanks[j];
            if (!t2.alive) continue;
            var fall = t2.settle(hm);
            var fdmg = t2.fallDamage(fall);
            if (fdmg > 0) {
                t2.hp -= fdmg;
                results.push({ tank: t2, dmg: fdmg, fall: true });
            }
        }
        for (var k = 0; k < tanks.length; k++) {
            if (tanks[k].alive && tanks[k].hp <= 0) {
                tanks[k].hp = 0;
                tanks[k].alive = false;
            }
        }
        return results;
    };

    SE.Projectile = Projectile;
})(window.SE);
