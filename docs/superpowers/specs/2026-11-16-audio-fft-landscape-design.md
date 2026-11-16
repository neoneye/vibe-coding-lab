# audio-fft-landscape: design

Date: 2026-11-16

## Request

A standalone FFT visualiser that shows a landscape of the last 10 seconds, with
lots of parameters. The owner has a noise in the house near 5 kHz that comes
and goes; detecting persistent noise is the point. Replay the captured data
with the uninteresting part suppressed and the unusual sound amplified.

## Approach

One self-contained page, no libraries. Own radix-2 FFT (the replay needs raw
samples and an inverse transform, which AnalyserNode does not give).

- Capture: AudioWorklet from a Blob URL, ScriptProcessor fallback for file://.
  getUserMedia with echo cancellation, noise suppression and AGC off. Also an
  audio file source and a seeded synthetic demo room that starts at load.
- `StreamAnalyser`: STFT frames into rings (level, soft "tone", soft
  "unusual", on bits). Detector spectrum is averaged in dB with a fast release
  so loud transients do not linger. Prominence = level minus the median of the
  neighbourhood. A bin is on after the shortest-tone time (with the run-up
  credited back); presence = share of the window on, widened by a drift
  tolerance. Usual level per bin = slow asymmetric tracker, trusted only after
  a short settling time.
- Mask per time-frequency cell from mode (tones, unusual, either, tones while
  unusual, everything), optional watch-band restriction, time gate, spread.
  The same mask colours the landscape and drives the replay.
- Replay: Hann analysis and synthesis at hop N/4, per-bin gain between
  suppress and boost, fast-attack slow-release in time, make-up gain to -3 dB.
- Display: grid of time rows by frequency columns, max-pooled so narrow tones
  survive; RG32F texture, vertex texel fetch, camera auto-fitted to the stage
  so exports are centred. Overlay canvas for axes, tone flags, watch band.
- Watch band: per-second level and on-share for up to 12 h, start/stop events,
  CSV export, automatic capture of the window a few seconds after a tone
  starts (8 kept).

## Alternatives not taken

- AnalyserNode for the spectrum: simpler, but no raw samples for replay and no
  control of window or overlap.
- three.js for the landscape: not needed for one height field.
- Tracking tones as objects over time: per-bin statistics with a drift
  tolerance are simpler and enough for stationary tones.

## Not done

No SPL calibration. No live filtered monitoring (it would feed back through
the microphone). Real microphone, pointer dragging and touch not tested by a
person.
