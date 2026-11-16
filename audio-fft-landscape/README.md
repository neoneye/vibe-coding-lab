# FFT landscape

A spectrum analyser that shows the last ten seconds of sound as a 3D landscape
(frequency across, time into the distance, loudness as height), finds tones
that persist, logs when they come and go, and replays the captured sound with
everything else turned down. Open `index.html` in a browser. It is one file,
uses no libraries and sends nothing over the network.

It was made to hunt a faint noise near 5 kHz in a house that comes and goes.

## What it does

- **Sources.** Microphone (echo cancellation, noise suppression and automatic
  gain are switched off, since noise suppression removes exactly the steady
  tones being looked for), an audio file, or a built-in demo: a quiet room with
  a 5 kHz tone that switches on and off, a steady 15.6 kHz whine, voices,
  clicks and thumps.
- **Landscape.** WebGL2 height field of the window, as a surface, ridge lines
  or both; orbit by dragging. Below it a flat spectrogram pair (as captured,
  and after the replay filter), the current spectrum with average, peak, usual
  level and detection threshold, and a long log of the watch band.
- **Persistent tones.** Each frequency is compared with the median of its
  neighbours, so broad noise does not count. A frequency that stands out for a
  set share of the window is listed with its frequency (to a fraction of a
  bin), level, prominence and presence. Clicks are too wide and voices move
  too much to qualify.
- **Unusual sounds.** The page also learns the usual quiet level of every
  frequency; anything well above it is unusual. A whine that never stops is
  persistent but not unusual; a tone that switches on is both.
- **Watch band.** One band (5 kHz by default; click the spectrogram or a tone
  to move it) is logged second by second for up to twelve hours, with a list
  of when a tone started and how long it lasted, saved as CSV. When a tone
  starts in the band the page keeps a capture of the window for later.
- **Replay.** A short-time Fourier filter turns the kept part up and the rest
  down, brings the result to full level, and plays it, looping, at any speed
  from a quarter to double. Original and filtered can be saved as WAV; the
  landscape as a 2400 × 1500 PNG.

62 parameters in six groups (replay, detector, watch band, analysis, landscape,
input) and eight presets.

## Limits

Levels are dB below digital full scale, not sound pressure. Laptop and phone
microphones are uneven and weak at high frequencies, and a tone can come from
the microphone or computer electronics instead of the air: if it does not
change as you move about, suspect the equipment. Nothing above half the sample
rate is visible. The detector's thresholds are this page's definitions and are
all adjustable. Real microphone use, mouse dragging and touch were not tested
by a person when the page was written; the microphone path was run against
Chrome's fake audio device.

## Tests and review aids

`node test.mjs` runs the engine tests embedded in the page (FFT against the
definition, window calibration, the detector on the demo signal, the replay
filter, WAV encoding, parameters).

URL parameters: `?preset=<name>`, `?p_<key>=<value>` for any parameter,
`?pump=<seconds>` of demo sound analysed at load, `?freeze`, `?src=mic`,
`?snap` (lays the exported PNG over the landscape). `window.__fft` exposes the
state, `pump()`, `frame()`, `freeze()`, `play()` and `exportPNG()`.
