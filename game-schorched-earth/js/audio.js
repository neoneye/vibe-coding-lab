// Procedural sound effects via Web Audio — no audio assets.
// Browsers block audio until a user gesture, so unlock() is called from the
// first click/keydown (wired up in game.js).
window.SE = window.SE || {};

(function (SE) {
    'use strict';

    var ctx = null;
    var master = null;
    var muted = false;

    function ensureCtx() {
        if (ctx) return true;
        var AC = (typeof window.AudioContext !== 'undefined' && window.AudioContext) ||
                 (typeof window.webkitAudioContext !== 'undefined' && window.webkitAudioContext);
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.35;
        master.connect(ctx.destination);
        return true;
    }

    function unlock() {
        if (!ensureCtx()) return;
        if (ctx.state === 'suspended') ctx.resume();
    }

    function toggleMute() {
        muted = !muted;
        if (master) master.gain.value = muted ? 0 : 0.35;
        return muted;
    }

    function ready() {
        return ctx && ctx.state === 'running' && !muted;
    }

    // Shared noise buffer (1s of white noise), created once.
    var noiseBuf = null;
    function noiseSource() {
        if (!noiseBuf) {
            noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
            var data = noiseBuf.getChannelData(0);
            for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
        var src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        return src;
    }

    // Filtered noise burst: the body of every bang.
    function noiseBurst(startFreq, endFreq, dur, gain) {
        var t = ctx.currentTime;
        var src = noiseSource();
        var filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(startFreq, t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t + dur);
        var g = ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(filter).connect(g).connect(master);
        src.start(t);
        src.stop(t + dur);
    }

    // Sine sweep: sub-bass boom / whistle blip.
    function sweep(startFreq, endFreq, dur, gain, type) {
        var t = ctx.currentTime;
        var osc = ctx.createOscillator();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
        var g = ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(g).connect(master);
        osc.start(t);
        osc.stop(t + dur);
    }

    function playFire() {
        if (!ready()) return;
        noiseBurst(2500, 300, 0.18, 0.5);   // muzzle hiss
        sweep(220, 70, 0.15, 0.4, 'triangle'); // launch thump
    }

    // size: weapon blast radius (22..75). Bigger radius = deeper, longer boom.
    function playExplosion(size, isDirt) {
        if (!ready()) return;
        var k = Math.min(1.6, size / 45);
        if (isDirt) {
            noiseBurst(500, 60, 0.35, 0.6); // muffled earthy thud
            sweep(90, 40, 0.3, 0.5);
            return;
        }
        noiseBurst(1800 * k, 50, 0.5 + 0.45 * k, 0.9);      // blast crack + rumble
        sweep(120 * Math.max(0.8, k), 28, 0.55 + 0.4 * k, 0.8); // sub boom
        noiseBurst(6000, 900, 0.1, 0.35);                    // initial snap
    }

    function playSplit() {
        if (!ready()) return;
        sweep(900, 1600, 0.12, 0.25, 'square'); // MIRV separation blip
    }

    function playDeath() {
        if (!ready()) return;
        sweep(400, 45, 0.7, 0.5, 'sawtooth'); // falling whine
        noiseBurst(1200, 80, 0.6, 0.6);
    }

    SE.audio = {
        unlock: unlock,
        toggleMute: toggleMute,
        playFire: playFire,
        playExplosion: playExplosion,
        playSplit: playSplit,
        playDeath: playDeath
    };
})(window.SE);
