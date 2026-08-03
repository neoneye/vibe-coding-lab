# Audio Singularity — Design

Date: 2026-08-03
Directory: `audio-singularity/`

## Premise

Does the AI singularity have a sound?

Colliding black holes, a bouncing ball coming to rest, and a spinning disk coming
to rest share one structure: a **finite-time singularity**. Some quantity
diverges, or some event rate becomes infinite, at a finite moment `t*`. Black
holes chirp toward merger. A ball packs infinitely many bounces into finite time.
Euler's disk spins faster and faster, then abruptly halts. Hyperbolic growth
toward `t*` is also the shape people mean by the AI singularity.

This project builds one instrument whose core is that shared structure. The four
phenomena are presets — points in a single parameter space — not four separate
programs. Morphing between them is the point.

## Scope

A standalone `index.html` in `audio-singularity/`, self-contained, no build step
and no network dependencies, matching the repo convention used by
`audio-bird-synth` and `audio-cat-synth`.

Ships with:

- `audio-singularity/index.html`
- `audio-singularity/test.mjs`
- `audio-singularity/screenshot1.jpg`
- a `gallery.yaml` title entry: `audio-singularity: Audio Singularity`

Out of scope: MIDI, external audio input, preset save/load to disk, sharing URLs,
mobile-specific layout beyond not breaking.

## Architecture

### One DSP core, three consumers

The entire synthesizer is plain JavaScript functions that fill a sample buffer.
There is no Web Audio node graph for synthesis — only a single output node and an
`AnalyserNode` for the spectrogram.

That one core function feeds three consumers:

1. **Live playback** — an `AudioWorkletProcessor` whose module source is built at
   runtime from a `Blob` URL. If `audioContext.audioWorklet.addModule()` fails —
   which it can under `file://`, where the origin is opaque — the code falls back
   to a `ScriptProcessorNode` with a 2048-sample buffer (~43 ms at 48 kHz).
   Both paths call the identical render function; only the glue differs.
2. **WAV export** — the same function run offline into a buffer, then encoded.
3. **Tests** — the same function run headlessly in Node via `test.mjs`.

The core lives in a `<script id="shared-code">` block, matching the pattern in
`game-snake/index.html`, so `test.mjs` can extract and evaluate it.

A **seeded PRNG** lives inside the core. All stochastic voices draw from it.
Consequences: exports are reproducible, and tests can assert byte-identical
output for a given seed.

### Isolation

The core exposes a small surface:

- `createEngine(params, sampleRate, seed)` → engine object
- `engine.setParams(params)` — called on every knob change
- `engine.setClock(x)` — writes the current normalized time-to-singularity
- `engine.render(outL, outR, frames)` — fills buffers, advances internal state
- `engine.readMeters()` → `{ phase, D, chirpHz, eventRate, swarmCount, recentEvents }`
- `renderOffline(params, sampleRate, seed, durationSeconds)` → `{L, R}`
- `encodeWav(L, R, sampleRate, bitDepth)` → `Uint8Array`

Each voice is its own factory function with the same shape (`setParams`,
`render`, `reset`), so a voice can be understood and tested without reading the
others. The UI layer never touches voice internals; it only writes params and
reads meters.

The engine does not own the transport. The UI advances `x` and calls `setClock`;
`renderOffline` advances `x` itself from the same duration parameters. The engine
is stateless with respect to *why* `x` moved, which is what lets scrubbing,
playback, and offline rendering share one code path.

## The clock

Everything derives from one number: `x`, the normalized time to singularity.

- `x = 1` at the start of the approach
- `x = 0` at `t*`
- `x < 0` in the aftermath

From `x` comes the single divergence factor that every voice reads:

```
D(x) = max(|x|, ε) ^ (−p)
```

### Global clock parameters

| Parameter | Range | Default | Meaning |
|---|---|---|---|
| `T` approach duration | 0.5–60 s | 8 s | Wall-clock seconds from `x=1` to `x=0` |
| `p` approach exponent | 0.1–4 | 1.0 | Sharpness. Small `p` gathers slowly; large `p` means nothing happens, then everything at once |
| `ε` regularization floor | 1e−6 – 0.5, log slider | 1e−3 | Caps every infinity in the system |
| `aftermath length` | 0–20 s | 4 s | Post-`t*` time before the transport stops or loops |
| `merger width` | 1e−4 – 0.1 | 0.01 | Half-width in `x` of the MERGER phase |
| `master gain` | −60–0 dB | −6 dB | |
| `limiter` | on/off | on | Off requires confirming a warning |
| `seed` | integer | 1 | Drives the PRNG |

`ε` is displayed alongside its consequence: the resulting divergence ceiling
`ε^(−p)`, shown as `×N`. This is the headline knob. Every voice inherits it, so
"how gracefully does the model break" is one number, not five.

### Two time mappings, deliberately different

- **Play** sweeps `x` **linearly in real time**. That is the whole point of a
  *finite*-time singularity: it genuinely arrives, and the approach genuinely
  accelerates without the transport helping.
- **The scrub slider is log-mapped**, so most of its travel covers the last
  decade before `t*`. This is what makes hovering just shy of the edge
  controllable rather than impossible.

Both write the same `x`. Grabbing the scrub mid-flight overrides the transport
and pauses it; releasing leaves `x` where it was dropped.

### Phases

| Phase | Condition |
|---|---|
| `APPROACH` | `x > merger width` |
| `MERGER` | `|x| ≤ merger width` |
| `AFTERMATH` | `x < −merger width` |

Entering MERGER triggers Ringdown once and begins gating the Chirp. Voices read
the phase; the phase is derived from `x` alone, so scrubbing backward re-arms
cleanly (`engine.reset()` on backward crossing of MERGER).

## Voices

Five voices. Each reads `D(x)` and applies its own law. All levels are
independent, each has solo/mute.

### 1. Chirp — the black holes

Oscillator stack following the real inspiral law:

```
f = f₀ · max(|x|, ε) ^ (−3/8)
amplitude ∝ f ^ (2/3)
```

`f` is additionally clamped to `0.45 · sampleRate`.

| Parameter | Range | Default |
|---|---|---|
| base frequency `f₀` | 20–400 Hz | 55 Hz |
| exponent override | 0.05–1.5 | 0.375 |
| partial count | 1–12 | 4 |
| inharmonicity | 0–0.5 | 0.0 |
| sine↔saw morph | 0–1 | 0.15 |
| mass ratio | 1–10 | 1.4 |
| stereo detune | 0–30 cents | 6 |
| level | −60–0 dB | −10 dB |

Mass ratio weights the partial amplitudes: asymmetric binaries are harmonically
richer, so higher ratios push energy into higher partials. The exponent override
defaults to the physical 0.375 but is exposed so the physics can be broken on
purpose.

At MERGER the Chirp gates off over ~15 ms and hands its terminal frequency to
Ringdown.

### 2. Impacts — the ball and the disk

Event onsets form a geometric series accumulating at `t*`. Instantaneous rate:

```
R = R₀ · max(|x|, ε) ^ (−q)
```

The scheduler advances by `1/R` seconds per event, recomputing `R` at each onset.
`ε` is what makes the total event count finite. A hard cap of 4000 events/sec
backs it up so nothing can hang even at `ε = 1e−6`; when the cap binds, the UI
shows it.

Each event is an exponentially damped burst.

| Parameter | Range | Default |
|---|---|---|
| base rate `R₀` | 0.2–40 Hz | 2 Hz |
| rate exponent `q` | 0.2–3 | 1.0 |
| decay | 2–400 ms | 40 ms |
| burst pitch | 40–4000 Hz | 400 Hz |
| pitch drift per event | −24–+24 semitones over the run | +12 |
| noise↔tone mix | 0–1 | 0.5 |
| level | −60–0 dB | −8 dB |

Pitch drift is physical: as bounces shorten, contact time shortens and the
impact brightens.

Ball and disk are the same voice with different decay and tone — the disk simply
has a long resonant contact and a smaller pitch drift. They are preset
differences, not code differences.

**The rattle→pitch fusion is emergent.** As `R` climbs past roughly 20 Hz the
discrete rhythm becomes a perceived pitch with no special-casing anywhere in the
code. This is the single most important sound in the instrument and it must not
be faked.

### 3. Ringdown

Damped sinusoids, triggered once on entering MERGER, dominant in AFTERMATH.

| Parameter | Range | Default |
|---|---|---|
| fundamental ratio | 0.1–4 × chirp terminal freq | 0.7 |
| mode count | 1–8 | 3 |
| mode spacing | 1.0–3.0 | 1.6 |
| Q (damping) | 5–2000 | 120 |
| level | −60–0 dB | −8 dB |

Defaulting the fundamental to a ratio of the Chirp's terminal frequency mirrors
real quasinormal modes, which sit near the merger frequency.

### 4. Field

Filtered noise whose centre frequency and bandwidth track `D`.

| Parameter | Range | Default |
|---|---|---|
| base centre | 40–2000 Hz | 200 Hz |
| centre tracking | 0–1 | 0.6 |
| bandwidth | 0.1–4 octaves | 1.5 |
| bandwidth tracking | −1–1 | −0.3 |
| noise colour | white↔brown, 0–1 | 0.5 |
| level | −60–0 dB | −18 dB |

Negative bandwidth tracking narrows the band as the singularity nears, which
reads as focusing dread rather than growing noise.

### 5. Swarm — the AI one

Voice count grows with the divergence:

```
N = clamp(round(N₀ · D ^ k), 1, Nmax)
```

Each voice is a short ping at a random pitch within a band, retriggering on its
own independent clock, all drawn from the seeded PRNG.

| Parameter | Range | Default |
|---|---|---|
| initial count `N₀` | 1–16 | 2 |
| growth exponent `k` | 0–2 | 0.6 |
| max count `Nmax` | 1–64 | 48 |
| pitch band centre | 100–4000 Hz | 900 Hz |
| pitch band spread | 0–4 octaves | 2 |
| voice decay | 5–500 ms | 90 ms |
| retrigger jitter | 0–1 | 0.5 |
| level | −60–0 dB | −14 dB |

The distinguishing behaviour: not one thing getting louder, but more and more
things arriving at once until they smear into a single texture. Voices 1–4 are
the metaphors; voice 5 is the referent.

## Regularization

`ε` is the design's headline. Nature always regularizes: the ball's bounces
genuinely stop, the disk genuinely halts, the horizons genuinely merge into one
smooth object. `ε` controls how that happens across the whole instrument at once.

- **`ε` small (1e−6):** frequency ceiling effectively vanishes, event rate
  explodes into its hard cap, swarm saturates. The result is an infinity tearing
  itself apart in aliasing and clipping.
- **`ε` large (0.1–0.5):** the same event resolves into a clean bell tone.

The contrast between those two settings on an otherwise identical patch is the
answer to the question the project asks.

A master limiter (soft-knee, look-ahead-free, ~2 ms release) is on by default.
Switching it off requires confirming a warning dialog once per session, because
the instrument can produce genuinely hostile output.

## Visuals

Two canvases.

**Spectrogram** — scrolling, log-frequency vertical axis, fed by an
`AnalyserNode` on the live output. The log axis is what makes the
`(t*−t)^(−3/8)` law legible: the curve visibly bends upward and then flattens
against the regularization ceiling, which is drawn as a horizontal reference
line at `f₀ · ε^(−3/8)`.

**Singularity clock** — a horizontal log axis of `x` from 1 down to 1e−6, with:

- the playhead marker
- tick marks for recent impact events, so the crowding and fusion is visible
- the phase label (`APPROACH` / `MERGER` / `AFTERMATH`)
- live numeric readouts: `x`, `D`, chirp frequency, event rate, swarm count
- a warning indicator when the event-rate cap is binding

## UI

Layout, top to bottom:

1. Header — title, one-line premise
2. Transport — play/pause, loop, log-mapped scrub slider, duration
3. Preset row
4. Spectrogram canvas
5. Singularity clock canvas
6. Global panel
7. Five collapsible voice panels, each with solo/mute

Roughly 45 controls total. Space toggles play/pause. Every slider shows its
numeric value and updates the engine live.

### Presets

| Preset | Character |
|---|---|
| Black Hole Merger | Chirp-dominant, moderate `ε`, strong ringdown |
| Bouncing Ball | Impacts-dominant, short decay, high pitch drift |
| Euler's Disk | Impacts-dominant, long resonant decay, low pitch drift |
| AI Singularity | Swarm-dominant, field bed, large `p` |
| Hard Wall | `ε` at minimum — the ugly one |
| Gentle Landing | Heavy regularization, everything resolves |

## WAV export

Renders the full transport — approach `T` plus aftermath — offline at the
current knob state. Knobs are frozen during render; only the clock sweeps.

Options: sample rate (44100 / 48000) and bit depth (16-bit PCM / 32-bit float).
Output is deterministic given the seed. Filename carries the preset name and
seed, e.g. `audio-singularity-ai-singularity-seed1.wav`.

Export runs on the main thread in chunks with a progress indicator, since a
60 s + 20 s render at 48 kHz is a few million samples.

## Testing

`test.mjs` extracts the `shared-code` block and runs `SingularityTests.run()`,
exiting non-zero on failure — same harness shape as `game-snake/test.mjs`.

Assertions:

1. **Chirp power law** — `f(x)` matches `f₀·x^(−3/8)` within 0.1% at sampled `x`
   across three decades.
2. **Frequency cap** — with the default exponent, `f(0)` equals exactly
   `f₀·ε^(−3/8)`, further clamped to `0.45·sampleRate`.
3. **Event accumulation** — impact onsets form the expected geometric series;
   total event count over the full approach is finite for every `ε > 0`.
4. **Rate cap** — instantaneous event rate never exceeds 4000/sec at
   `ε = 1e−6`.
5. **Numerical safety** — offline render contains no `NaN` or `Infinity` for
   every preset, including Hard Wall.
6. **Limiter** — peak sample magnitude ≤ 1.0 with the limiter on, for every
   preset.
7. **Determinism** — same seed and params produce a byte-identical buffer across
   two runs.
8. **Phase boundaries** — phase transitions occur at exactly ±`merger width`.
9. **Reset on backward crossing** — scrubbing backward through MERGER re-arms
   Ringdown.
10. **WAV encoding** — header fields (`RIFF`, `WAVE`, `fmt `, `data`), byte
    length, channel count, and sample rate are correct for both bit depths.

## Risks

- **AudioWorklet under `file://`** — mitigated by the `ScriptProcessorNode`
  fallback. Both paths must be exercised manually before shipping.
- **CPU under Swarm at `Nmax = 64` plus a 4000/sec impact rate** — the hard caps
  bound the worst case; if the fallback `ScriptProcessorNode` path glitches on
  the main thread while the spectrogram draws, the spectrogram drops to a lower
  FFT rate rather than the audio dropping out.
- **Aliasing at extreme `ε`** — this is intentional and is part of what the
  instrument demonstrates. It must not be silently oversampled away, but it must
  also not be mistaken for a bug: the UI labels the state when the frequency
  ceiling is above Nyquist.
