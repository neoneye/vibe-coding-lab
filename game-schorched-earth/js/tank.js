// Tank entity: state + procedural drawing (flag-striped hull).
window.SE = window.SE || {};

(function (SE) {
    'use strict';

    var BODY_W = 26;
    var BODY_H = 12;

    function Tank(opts) {
        this.x = opts.x;
        this.y = 0;
        this.country = opts.country;           // entry from SE.COUNTRIES
        this.control = opts.control;           // 'human' | 'ai'
        this.difficulty = opts.difficulty || 'normal';
        this.name = opts.name;
        this.hp = 100;
        this.alive = true;
        this.angle = opts.facingLeft ? 135 : 45;
        this.power = 60;
        this.weaponIdx = 0;
        this.ammo = {};
        for (var i = 0; i < SE.WEAPONS.length; i++) {
            this.ammo[SE.WEAPONS[i].id] = SE.WEAPONS[i].ammo;
        }
        this.lastMiss = null; // {targetName, dx} — AI shot correction memory
    }

    // Snap the tank onto the terrain surface. Returns how far it fell
    // (positive = downward). Dirt mounds lift the tank (negative, no damage).
    Tank.prototype.settle = function (hm) {
        var xi = Math.min(hm.length - 1, Math.max(0, Math.round(this.x)));
        var newY = hm[xi] - BODY_H / 2;
        var fall = newY - this.y;
        this.y = newY;
        return fall;
    };

    Tank.prototype.fallDamage = function (dist) {
        return dist > 40 ? Math.floor((dist - 40) * 0.5) : 0;
    };

    Tank.prototype.weapon = function () {
        return SE.WEAPONS[this.weaponIdx];
    };

    // Cycle to the next weapon that still has ammo.
    Tank.prototype.cycleWeapon = function (dir) {
        var n = SE.WEAPONS.length;
        for (var k = 1; k <= n; k++) {
            var idx = (this.weaponIdx + dir * k + n * k) % n;
            if (this.ammo[SE.WEAPONS[idx].id] > 0) {
                this.weaponIdx = idx;
                return;
            }
        }
    };

    Tank.prototype.muzzle = function () {
        var a = this.angle * Math.PI / 180;
        var len = 18;
        return {
            x: this.x + Math.cos(a) * len,
            y: this.y - 4 - Math.sin(a) * len
        };
    };

    Tank.prototype.draw = function (ctx, isActive) {
        if (!this.alive) return;
        var x = this.x, y = this.y;

        // barrel
        var m = this.muzzle();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();

        // hull: three flag stripes, clipped to a rounded shape
        var w = BODY_W, h = BODY_H;
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x - w / 2, y - h / 2, w, h, 5);
        } else {
            ctx.rect(x - w / 2, y - h / 2, w, h);
        }
        ctx.clip();
        var colors = this.country.colors;
        for (var i = 0; i < 3; i++) {
            ctx.fillStyle = colors[i];
            ctx.fillRect(x - w / 2, y - h / 2 + (h / 3) * i, w, h / 3 + 1);
        }
        ctx.restore();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x - w / 2, y - h / 2, w, h, 5);
        } else {
            ctx.rect(x - w / 2, y - h / 2, w, h);
        }
        ctx.stroke();

        // treads
        ctx.fillStyle = '#333';
        ctx.fillRect(x - w / 2 - 1, y + h / 2 - 2, w + 2, 4);

        // label: name + hp
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = isActive ? '#ffee66' : '#e8e8e8';
        ctx.fillText(this.name, x, y - 26);
        var hpFrac = Math.max(0, this.hp) / 100;
        ctx.fillStyle = '#00000088';
        ctx.fillRect(x - 15, y - 22, 30, 4);
        ctx.fillStyle = hpFrac > 0.5 ? '#5fd35f' : hpFrac > 0.25 ? '#e6c229' : '#e05252';
        ctx.fillRect(x - 15, y - 22, 30 * hpFrac, 4);

        if (isActive) {
            ctx.fillStyle = '#ffee66';
            ctx.beginPath();
            ctx.moveTo(x, y - 34);
            ctx.lineTo(x - 4, y - 40);
            ctx.lineTo(x + 4, y - 40);
            ctx.closePath();
            ctx.fill();
        }
    };

    Tank.BODY_W = BODY_W;
    Tank.BODY_H = BODY_H;
    SE.Tank = Tank;
})(window.SE);
