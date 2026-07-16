// Game shell: screens, turn state machine, input, rendering.
window.SE = window.SE || {};

(function (SE) {
    'use strict';

    var W = 960, H = 600;
    var SIM_DT = 1 / 240;

    var canvas, ctx;
    var state = 'title'; // title | setup | playing | roundEnd | matchEnd
    var cfg = null;      // from setup screen
    var match = null;    // {slots, totalRounds, round, scores[]}
    var game = null;     // per-round state
    var menuTerrain = null;
    var keys = {};
    var autoAdvanceTimer = null;

    // ---------------------------------------------------------------- setup UI

    var SLOT_DEFAULTS = [
        { control: 'human', country: 'iran' },
        { control: 'ai', country: 'usa' },
        { control: 'off', country: 'ukraine' },
        { control: 'off', country: 'russia' }
    ];

    function buildSlots() {
        var host = document.getElementById('slots');
        host.innerHTML = '';
        for (var s = 0; s < 4; s++) {
            var row = document.createElement('div');
            row.className = 'slot';
            row.innerHTML =
                '<span class="slotnum">' + (s + 1) + '</span>' +
                '<select class="selControl">' +
                    '<option value="off">Off</option>' +
                    '<option value="human">Human</option>' +
                    '<option value="ai">AI</option>' +
                '</select>' +
                '<span class="flagchip"></span>' +
                '<select class="selCountry">' +
                    SE.COUNTRIES.map(function (c) {
                        return '<option value="' + c.id + '">' + c.name + '</option>';
                    }).join('') +
                '</select>' +
                '<select class="selDifficulty">' +
                    '<option value="easy">Easy</option>' +
                    '<option value="normal" selected>Normal</option>' +
                    '<option value="hard">Hard</option>' +
                '</select>';
            host.appendChild(row);
            var d = SLOT_DEFAULTS[s];
            row.querySelector('.selControl').value = d.control;
            row.querySelector('.selCountry').value = d.country;
            row.querySelectorAll('select').forEach(function (sel) {
                sel.addEventListener('change', refreshSlots);
            });
        }
        refreshSlots();
    }

    function refreshSlots() {
        document.querySelectorAll('#slots .slot').forEach(function (row) {
            var control = row.querySelector('.selControl').value;
            row.classList.toggle('off', control === 'off');
            row.querySelector('.selDifficulty').style.visibility =
                control === 'ai' ? 'visible' : 'hidden';
            var country = countryById(row.querySelector('.selCountry').value);
            paintFlagChip(row.querySelector('.flagchip'), country);
        });
    }

    function flagChipInner(country) {
        var stripes = country.stripes || country.colors;
        var html = stripes.map(function (c) {
            return '<i style="background:' + c +
                ';height:' + (100 / stripes.length) + '%"></i>';
        }).join('');
        if (country.canton) {
            html += '<b style="background-color:' + country.canton.color +
                ';background-image:radial-gradient(circle, ' + country.canton.stars +
                ' 30%, transparent 40%);background-size:3.5px 2.75px"></b>';
        }
        return html;
    }

    function paintFlagChip(el, country) {
        el.innerHTML = flagChipInner(country);
    }

    function countryById(id) {
        for (var i = 0; i < SE.COUNTRIES.length; i++) {
            if (SE.COUNTRIES[i].id === id) return SE.COUNTRIES[i];
        }
        return SE.COUNTRIES[0];
    }

    function applyPreset(kind) {
        var rows = document.querySelectorAll('#slots .slot');
        var set = function (i, control, country) {
            rows[i].querySelector('.selControl').value = control;
            if (country) rows[i].querySelector('.selCountry').value = country;
        };
        if (kind === '1p') {
            set(0, 'human', 'iran'); set(1, 'ai', 'usa');
            set(2, 'off'); set(3, 'off');
        } else if (kind === '2p') {
            set(0, 'human', 'ukraine'); set(1, 'human', 'russia');
            set(2, 'off'); set(3, 'off');
        } else if (kind === 'ai') {
            set(0, 'ai', 'iran'); set(1, 'ai', 'ukraine');
            set(2, 'ai', 'russia'); set(3, 'ai', 'usa');
        }
        refreshSlots();
    }

    function readConfig() {
        var slots = [];
        var usedNames = {};
        document.querySelectorAll('#slots .slot').forEach(function (row, i) {
            var control = row.querySelector('.selControl').value;
            if (control === 'off') return;
            var country = countryById(row.querySelector('.selCountry').value);
            var name = country.name;
            if (usedNames[name]) name += ' ' + (++usedNames[country.name]);
            else usedNames[name] = 1;
            slots.push({
                control: control,
                country: country,
                name: name,
                difficulty: row.querySelector('.selDifficulty').value,
                slotIdx: i
            });
        });
        return {
            slots: slots,
            rounds: parseInt(document.getElementById('selRounds').value, 10)
        };
    }

    // ---------------------------------------------------------------- screens

    function showScreen(id) {
        ['title', 'setup', 'roundEnd', 'matchEnd'].forEach(function (s) {
            document.getElementById(s).classList.toggle('hidden', s !== id);
        });
        document.getElementById('hud').classList.toggle('hidden', id !== null);
        if (id !== null) document.getElementById('hud').classList.add('hidden');
    }

    function showHud() {
        ['title', 'setup', 'roundEnd', 'matchEnd'].forEach(function (s) {
            document.getElementById(s).classList.add('hidden');
        });
        document.getElementById('hud').classList.remove('hidden');
    }

    var bannerTimer = null;
    function banner(msg, ms) {
        var el = document.getElementById('banner');
        el.textContent = msg;
        el.classList.remove('hidden');
        el.style.opacity = 1;
        if (bannerTimer) clearTimeout(bannerTimer);
        bannerTimer = setTimeout(function () { el.style.opacity = 0; }, ms || 1400);
    }

    // ---------------------------------------------------------------- match flow

    function startMatch() {
        cfg = readConfig();
        if (cfg.slots.length < 2) {
            banner('Need at least 2 tanks', 1800);
            return;
        }
        match = {
            slots: cfg.slots,
            totalRounds: cfg.rounds,
            round: 0,
            scores: cfg.slots.map(function () { return 0; })
        };
        startRound();
    }

    function startRound() {
        if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
        match.round++;
        var hm = SE.terrain.generate(W, H, Math.random);
        var n = match.slots.length;
        var tanks = match.slots.map(function (slot, i) {
            var margin = 90;
            var x = margin + (W - 2 * margin) * (n === 1 ? 0.5 : i / (n - 1));
            x += (Math.random() * 2 - 1) * 25;
            x = Math.min(W - 40, Math.max(40, Math.round(x)));
            var tank = new SE.Tank({
                x: x,
                country: slot.country,
                control: slot.control,
                difficulty: slot.difficulty,
                name: slot.name,
                facingLeft: x > W / 2
            });
            tank.matchIdx = i;
            tank.settle(hm);
            return tank;
        });
        game = {
            hm: hm,
            tanks: tanks,
            wind: Math.round((Math.random() * 2 - 1) * 6),
            turnPtr: (match.round - 1) % n - 1, // beginTurn advances first
            phase: 'idle',
            projectiles: [],
            explosions: [],
            floats: [],
            aiTimer: 0,
            postTimer: 0,
            shotExplosions: [],
            currentTarget: null
        };
        state = 'playing';
        showHud();
        banner('Round ' + match.round + ' of ' + match.totalRounds, 1600);
        beginTurn();
    }

    function livingTanks() {
        return game.tanks.filter(function (t) { return t.alive; });
    }

    function currentTank() {
        return game.tanks[game.turnPtr];
    }

    function beginTurn() {
        var n = game.tanks.length;
        for (var k = 1; k <= n; k++) {
            var idx = (game.turnPtr + k) % n;
            if (game.tanks[idx].alive) { game.turnPtr = idx; break; }
        }
        game.wind = Math.max(-10, Math.min(10,
            game.wind + (Math.random() * 2 - 1) * 3));
        game.shotExplosions = [];
        game.currentTarget = null;
        var tank = currentTank();
        // if the selected weapon ran dry, hop to one with ammo
        if (tank.ammo[tank.weapon().id] <= 0) tank.cycleWeapon(1);
        if (tank.control === 'ai') {
            game.phase = 'aiThink';
            game.aiTimer = 0.5 + Math.random() * 0.6;
            banner(tank.name + ' (AI) thinking…', 1000);
        } else {
            game.phase = 'aim';
            banner(tank.name + ' — your turn', 1400);
        }
    }

    function aiTakeTurn() {
        var me = currentTank();
        var enemies = livingTanks().filter(function (t) { return t !== me; });
        if (enemies.length === 0) return;
        var target = enemies.reduce(function (a, b) {
            return Math.abs(a.x - me.x) < Math.abs(b.x - me.x) ? a : b;
        });
        var lastMiss = (me.lastMiss && me.lastMiss.targetName === target.name)
            ? me.lastMiss : null;
        var plan = SE.ai.planShot(
            { x: me.x, y: me.y, ammo: me.ammo },
            { x: target.x, y: target.y, hp: target.hp },
            game.wind, game.hm, W, H, me.difficulty, lastMiss, Math.random);
        me.angle = plan.angle;
        me.power = plan.power;
        for (var i = 0; i < SE.WEAPONS.length; i++) {
            if (SE.WEAPONS[i].id === plan.weaponId) { me.weaponIdx = i; break; }
        }
        game.currentTarget = target;
        fire();
    }

    function fire() {
        var tank = currentTank();
        var weapon = tank.weapon();
        if (tank.ammo[weapon.id] <= 0) return;
        tank.ammo[weapon.id]--;
        var m = tank.muzzle();
        var v = SE.physics.launchVelocity(tank.angle, tank.power);
        game.projectiles.push(new SE.Projectile({
            x: m.x, y: m.y, vx: v.vx, vy: v.vy,
            weapon: weapon, shooter: tank
        }));
        SE.audio.playFire();
        game.phase = 'fire';
    }

    function resolveExplosion(x, y, weapon) {
        game.explosions.push({
            x: x, y: y,
            maxR: Math.max(14, weapon.radius),
            t: 0, dur: 0.45,
            dirt: weapon.type === 'dirt'
        });
        SE.audio.playExplosion(weapon.radius, weapon.type === 'dirt');
        game.shotExplosions.push(x);
        var hits = SE.applyExplosion(x, y, weapon, game.hm, game.tanks, H);
        hits.forEach(function (h) {
            game.floats.push({
                x: h.tank.x, y: h.tank.y - 30,
                text: '-' + h.dmg + (h.fall ? ' (fall)' : ''),
                t: 0
            });
        });
        game.tanks.forEach(function (t) {
            if (!t.alive && !t.deathAnnounced) {
                t.deathAnnounced = true;
                game.explosions.push({ x: t.x, y: t.y, maxR: 30, t: 0, dur: 0.5, dirt: false });
                SE.audio.playDeath();
                banner(t.name + ' destroyed!', 1500);
            }
        });
    }

    function endOfShot() {
        // remember signed miss for AI walking fire
        var shooter = currentTank();
        if (shooter.control === 'ai' && game.currentTarget && game.shotExplosions.length) {
            var tx = game.currentTarget.x;
            var bestDx = null;
            game.shotExplosions.forEach(function (ex) {
                var dx = ex - tx;
                if (bestDx === null || Math.abs(dx) < Math.abs(bestDx)) bestDx = dx;
            });
            shooter.lastMiss = { targetName: game.currentTarget.name, dx: bestDx };
        }
        game.phase = 'post';
        game.postTimer = 0.9;
    }

    function checkRoundEnd() {
        var living = livingTanks();
        if (living.length > 1) return false;
        if (living.length === 1) {
            match.scores[living[0].matchIdx]++;
            showRoundEnd(living[0].name + ' wins round ' + match.round + '!');
        } else {
            showRoundEnd('Round ' + match.round + ' is a draw — mutual destruction');
        }
        return true;
    }

    function scoreRows() {
        return match.slots.map(function (slot, i) {
            var tank = game ? game.tanks[i] : null;
            return {
                name: slot.name,
                control: slot.control === 'human' ? 'Human' : 'AI ' + slot.difficulty,
                score: match.scores[i],
                alive: tank ? tank.alive : true,
                country: slot.country
            };
        }).sort(function (a, b) { return b.score - a.score; });
    }

    function fillTable(tableId) {
        var rows = scoreRows();
        var html = '<tr><th></th><th>Tank</th><th>Player</th><th>Score</th></tr>';
        rows.forEach(function (r) {
            html += '<tr class="' + (r.alive ? '' : 'dead') + '">' +
                '<td><span class="flagchip">' + flagChipInner(r.country) + '</span></td>' +
                '<td>' + r.name + '</td>' +
                '<td>' + r.control + '</td>' +
                '<td class="score">' + r.score + '</td></tr>';
        });
        document.getElementById(tableId).innerHTML = html;
    }

    function showRoundEnd(msg) {
        if (match.round >= match.totalRounds) {
            showMatchEnd();
            return;
        }
        state = 'roundEnd';
        document.getElementById('roundEndTitle').textContent = msg;
        fillTable('scoreTable');
        showScreen('roundEnd');
        if (allAi()) {
            autoAdvanceTimer = setTimeout(startRound, 4000);
        }
    }

    function showMatchEnd() {
        state = 'matchEnd';
        var best = Math.max.apply(null, match.scores);
        var winners = match.slots.filter(function (s, i) {
            return match.scores[i] === best;
        }).map(function (s) { return s.name; });
        var title = best === 0 ? 'Nobody wins…'
            : winners.length > 1 ? 'Draw: ' + winners.join(' & ')
            : winners[0] + ' wins the war!';
        document.getElementById('matchEndTitle').textContent = title;
        fillTable('finalTable');
        showScreen('matchEnd');
    }

    function allAi() {
        return match.slots.every(function (s) { return s.control === 'ai'; });
    }

    function quitToTitle() {
        if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
        state = 'title';
        game = null;
        match = null;
        showScreen('title');
    }

    // ---------------------------------------------------------------- input

    function isHumanAiming() {
        return state === 'playing' && game && game.phase === 'aim' &&
            currentTank().control === 'human';
    }

    function onKeyDown(e) {
        if (state !== 'playing') return;
        if (e.key === 'Escape') {
            // leaving fullscreen comes first; press Escape again to quit
            if (document.fullscreenElement) document.exitFullscreen();
            else if (window.confirm('Quit to menu?')) quitToTitle();
            return;
        }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Tab'].indexOf(e.key) >= 0) {
            e.preventDefault();
        }
        if (!isHumanAiming()) return;
        keys[e.key] = true;
        var tank = currentTank();
        if (e.key === 'Tab') {
            tank.cycleWeapon(e.shiftKey ? -1 : 1);
        } else if (e.key === ' ') {
            fire();
        } else if (!e.repeat) {
            // immediate nudge so a quick tap registers even though held keys
            // are processed per-frame
            var fine = e.shiftKey ? 0.2 : 1;
            if (e.key === 'ArrowLeft') tank.angle = Math.min(180, tank.angle + fine);
            if (e.key === 'ArrowRight') tank.angle = Math.max(0, tank.angle - fine);
            if (e.key === 'ArrowUp') tank.power = Math.min(100, tank.power + fine);
            if (e.key === 'ArrowDown') tank.power = Math.max(5, tank.power - fine);
        }
    }

    function onKeyUp(e) {
        keys[e.key] = false;
    }

    // held-key aiming, called each frame
    function processAimKeys(dt) {
        if (!isHumanAiming()) return;
        var tank = currentTank();
        var fine = keys.Shift ? 0.22 : 1;
        var angleRate = 42 * fine, powerRate = 34 * fine;
        if (keys.ArrowLeft) tank.angle = Math.min(180, tank.angle + angleRate * dt);
        if (keys.ArrowRight) tank.angle = Math.max(0, tank.angle - angleRate * dt);
        if (keys.ArrowUp) tank.power = Math.min(100, tank.power + powerRate * dt);
        if (keys.ArrowDown) tank.power = Math.max(5, tank.power - powerRate * dt);
    }

    function bindUi() {
        document.getElementById('btnToSetup').addEventListener('click', function () {
            state = 'setup';
            showScreen('setup');
        });
        document.getElementById('btnBackTitle').addEventListener('click', quitToTitle);
        document.getElementById('btnStart').addEventListener('click', startMatch);
        document.getElementById('btnNextRound').addEventListener('click', startRound);
        document.getElementById('btnPlayAgain').addEventListener('click', function () {
            state = 'setup';
            showScreen('setup');
        });
        document.querySelectorAll('.presets button').forEach(function (b) {
            b.addEventListener('click', function () { applyPreset(b.dataset.preset); });
        });

        // HUD buttons: hold-to-repeat for angle/power
        var holdRepeat = function (id, action) {
            var el = document.getElementById(id);
            var iv = null;
            var start = function (e) {
                e.preventDefault();
                if (!isHumanAiming()) return;
                action();
                iv = setInterval(function () {
                    if (isHumanAiming()) action(); else stop();
                }, 70);
            };
            var stop = function () { if (iv) { clearInterval(iv); iv = null; } };
            el.addEventListener('mousedown', start);
            el.addEventListener('touchstart', start);
            ['mouseup', 'mouseleave', 'touchend'].forEach(function (ev) {
                el.addEventListener(ev, stop);
            });
        };
        holdRepeat('btnAngleUp', function () {
            currentTank().angle = Math.min(180, currentTank().angle - 1);
        });
        holdRepeat('btnAngleDown', function () {
            currentTank().angle = Math.max(0, currentTank().angle + 1);
        });
        holdRepeat('btnPowerUp', function () {
            currentTank().power = Math.min(100, currentTank().power + 1);
        });
        holdRepeat('btnPowerDown', function () {
            currentTank().power = Math.max(5, currentTank().power - 1);
        });
        document.getElementById('btnWeaponPrev').addEventListener('click', function () {
            if (isHumanAiming()) currentTank().cycleWeapon(-1);
        });
        document.getElementById('btnWeaponNext').addEventListener('click', function () {
            if (isHumanAiming()) currentTank().cycleWeapon(1);
        });
        document.getElementById('btnFire').addEventListener('click', function () {
            if (isHumanAiming()) fire();
        });

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        // audio needs a user gesture before it may start
        window.addEventListener('mousedown', SE.audio.unlock);
        window.addEventListener('keydown', function (e) {
            SE.audio.unlock();
            if (e.key === 'm' || e.key === 'M') {
                banner(SE.audio.toggleMute() ? 'Sound off' : 'Sound on', 900);
            }
            // F toggles fullscreen on every screen; Escape (or the browser's
            // native handling) leaves. fitToViewport refits on resize.
            if ((e.key === 'f' || e.key === 'F') && !e.repeat) {
                if (document.fullscreenElement) document.exitFullscreen();
                else document.documentElement.requestFullscreen().catch(function () {});
            }
            if (e.key === 'Escape' && document.fullscreenElement) {
                document.exitFullscreen();
            }
        });
    }

    // ---------------------------------------------------------------- update

    function update(dt) {
        if (state !== 'playing' || !game) return;
        processAimKeys(dt);

        if (game.phase === 'aiThink') {
            game.aiTimer -= dt;
            if (game.aiTimer <= 0) {
                game.phase = 'aiFiring';
                aiTakeTurn();
            }
        } else if (game.phase === 'fire') {
            // 1.5x playback keeps long lobs snappy; AI planning is unaffected
            // because simulateShot integrates with its own clock.
            var steps = Math.max(1, Math.round(dt * 1.5 / SIM_DT));
            for (var s = 0; s < steps && game.projectiles.length; s++) {
                stepProjectiles(SIM_DT);
            }
            if (game.projectiles.length === 0) endOfShot();
        } else if (game.phase === 'post') {
            game.postTimer -= dt;
            if (game.postTimer <= 0) {
                if (!checkRoundEnd()) beginTurn();
            }
        }

        game.explosions = game.explosions.filter(function (ex) {
            ex.t += dt;
            return ex.t < ex.dur;
        });
        game.floats = game.floats.filter(function (f) {
            f.t += dt;
            return f.t < 1.1;
        });
    }

    function stepProjectiles(dt) {
        var survivors = [];
        game.projectiles.forEach(function (p) {
            var events = p.update(dt, game.wind, game.hm, W, H, game.tanks);
            if (!events) { survivors.push(p); return; }
            events.forEach(function (ev) {
                if (ev.type === 'explode') {
                    resolveExplosion(ev.x, ev.y, p.weapon);
                } else if (ev.type === 'split') {
                    SE.audio.playSplit();
                    ev.children.forEach(function (c) { survivors.push(c); });
                }
                // fizzle: projectile just disappears
            });
        });
        game.projectiles = survivors;
    }

    // ---------------------------------------------------------------- render

    var SKY_STOPS = [
        { at: 0,    c: [11, 16, 38] },    // #0b1026
        { at: 0.55, c: [51, 37, 74] },    // #33254a
        { at: 0.8,  c: [122, 59, 77] },   // #7a3b4d
        { at: 1,    c: [201, 111, 58] }   // #c96f3a
    ];

    function drawSky() {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        SKY_STOPS.forEach(function (s) {
            grad.addColorStop(s.at, 'rgb(' + s.c.join(',') + ')');
        });
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    function skyLuminanceAt(frac) {
        frac = Math.max(0, Math.min(1, frac));
        var c = SKY_STOPS[SKY_STOPS.length - 1].c;
        for (var i = 1; i < SKY_STOPS.length; i++) {
            if (frac <= SKY_STOPS[i].at) {
                var a = SKY_STOPS[i - 1], b = SKY_STOPS[i];
                var t = (frac - a.at) / (b.at - a.at);
                c = [0, 1, 2].map(function (k) {
                    return a.c[k] + (b.c[k] - a.c[k]) * t;
                });
                break;
            }
        }
        return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    }

    // Cannon is black by default; against a dark sky (high-altitude tanks)
    // black disappears, so switch to light steel. Sampled at barrel height.
    function barrelColorAt(y) {
        return skyLuminanceAt((y - 16) / H) < 0.3 ? '#cfd8e4' : '#000000';
    }

    function drawTerrain(hm) {
        ctx.fillStyle = '#5a3e1e';
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (var x = 0; x < W; x++) ctx.lineTo(x, hm[x]);
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
        // sunlit crust
        ctx.fillStyle = '#8a6a35';
        for (var x2 = 0; x2 < W; x2++) {
            ctx.fillRect(x2, hm[x2], 1, 3);
        }
    }

    function drawWindsock() {
        if (!game) return;
        var el = document.getElementById('hudWind');
        var w = game.wind;
        var mag = Math.min(4, Math.ceil(Math.abs(w) / 2.5));
        var arrows = w < -0.5 ? '◀'.repeat(mag) : w > 0.5 ? '▶'.repeat(mag) : '·';
        el.textContent = 'Wind ' + arrows + ' ' + Math.abs(Math.round(w));
    }

    function updateHud() {
        if (!game) return;
        var tank = currentTank();
        document.getElementById('hudName').textContent =
            tank.name + (tank.control === 'human' ? '' : ' (AI)');
        paintFlagChip(document.getElementById('hudFlag'), tank.country);
        document.getElementById('hudHp').textContent = 'HP ' + Math.max(0, tank.hp);
        document.getElementById('hudAngle').textContent = Math.round(tank.angle);
        document.getElementById('hudPower').textContent = Math.round(tank.power);
        var weapon = tank.weapon();
        var ammo = tank.ammo[weapon.id];
        document.getElementById('hudWeapon').textContent =
            weapon.name + (ammo === Infinity ? '' : ' ×' + ammo);
        document.getElementById('hudRound').textContent =
            'Round ' + match.round + '/' + match.totalRounds;
        document.getElementById('btnFire').disabled = !isHumanAiming();
        drawWindsock();
    }

    function render() {
        // renderScale maps the fixed 960×600 logical space onto the
        // (viewport-fitted, dpr-aware) canvas backing store
        ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
        drawSky();
        if (state === 'playing' || state === 'roundEnd') {
            drawTerrain(game.hm);
            var active = currentTank();
            game.tanks.forEach(function (t) {
                t.draw(ctx, state === 'playing' && t === active &&
                    (game.phase === 'aim' || game.phase === 'aiThink'),
                    barrelColorAt(t.y));
            });
            game.projectiles.forEach(function (p) { p.draw(ctx); });
            game.explosions.forEach(drawExplosion);
            game.floats.forEach(drawFloat);
            updateHud();
        } else if (menuTerrain) {
            drawTerrain(menuTerrain);
        }
    }

    function drawExplosion(ex) {
        var f = ex.t / ex.dur;
        var r = ex.maxR * (0.3 + 0.7 * f);
        ctx.globalAlpha = 1 - f;
        ctx.fillStyle = ex.dirt ? '#c99b4a' : '#ffb347';
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (!ex.dirt) {
            ctx.fillStyle = '#fff3c4';
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, r * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawFloat(f) {
        ctx.globalAlpha = Math.max(0, 1 - f.t);
        ctx.fillStyle = '#ff8080';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y - f.t * 22);
        ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------------- main loop

    // Scale the stage to fill the viewport (preserving 960×600 aspect) and
    // raise the canvas backing resolution to match, so the upscale is crisp.
    var renderScale = 1;
    function fitToViewport() {
        var s = Math.min(window.innerWidth / W, window.innerHeight / H);
        document.getElementById('stage').style.transform = 'scale(' + s + ')';
        var dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(W * s * dpr);
        canvas.height = Math.round(H * s * dpr);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        renderScale = s * dpr;
    }

    var lastTs = 0;
    function frame(ts) {
        var dt = Math.min(0.05, (ts - lastTs) / 1000) || 0.016;
        lastTs = ts;
        update(dt);
        render();
        requestAnimationFrame(frame);
    }

    function init() {
        canvas = document.getElementById('canvas');
        ctx = canvas.getContext('2d');
        menuTerrain = SE.terrain.generate(W, H, Math.random);
        fitToViewport();
        window.addEventListener('resize', fitToViewport);
        buildSlots();
        bindUi();
        showScreen('title');
        requestAnimationFrame(frame);
    }

    SE.game = { init: init, barrelColorAt: barrelColorAt };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }
})(window.SE);
