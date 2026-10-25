# Sound Ribbons: design

Date: 2026-10-25. Directory: `audio-sound-ribbons/`.

## Intent

The owner asked for a standalone page that visualizes audio from the microphone or from uploaded files (ogg, mp3, wav). They attached a poster as the model: "Four classical pieces drawn by their sound". In it each recording is a mirrored ribbon, height = RMS loudness, color = spectral centroid on a log scale, spanning the 2nd–98th percentile of that recording. All rows share one seconds-per-pixel scale. They also linked two Wikimedia Commons recordings, Für Elise and the Moonlight Sonata 1st movement. Everything beyond that was my call.

## Shape

- **Poster first.** One canvas draws the whole poster (title, subtitle, one ribbon per recording, time axis, legend, notes), so **Save PNG** gives exactly what is on screen, at 2×. Title and subtitle are editable and default to text generated from the settings.
- **Inputs:**
  - files: picker or drag and drop; any format the browser decodes
  - microphone
  - an example dropdown: Für Elise, the Moonlight 1st movement, Danse macabre (Stokowski, 1925) and Ride of the Valkyries (Edison, 1921), which are the reference poster's four recordings, plus "All four". Files are fetched directly from upload.wikimedia.org, which sends `Access-Control-Allow-Origin: *`. `?examples=all` loads all four.
  - a box for any Commons file link, resolved through the Commons API with `origin=*`, or any direct CORS-enabled URL
- **Microphone:** a live preview from an AnalyserNode, using the same `spectrumFeatures` code on its spectrum with timestamped frames. When you stop, the MediaRecorder recording is decoded and re-analyzed with the file pipeline, so it can be played back like any file.
- **Saving recordings** (owner request, after their first microphone take):
  - every row with audio has **Save WAV** (16-bit PCM, plays everywhere)
  - microphone rows also offer the original recording as the browser encoded it: WebM/Opus in Chrome, Ogg/Opus in Firefox. The extension comes from the file's first bytes, because Firefox's MediaRecorder reports an empty MIME type.
  - a microphone row shows "not saved yet" until saved. Leaving the page or removing the row asks first.
  - verified with fake microphones in headless Chrome (CDP) and Firefox 158 (WebDriver BiDi): real downloads, WAV checked with `afinfo`, original files by signature.
- **Interaction:**
  - hover readout: time, dBFS, centroid, rolloff, dominant note
  - click a ribbon to play from that point, with a playhead; Space plays or pauses, Esc stops
  - the side list can rename, reorder and remove rows
- **Settings:**
  - color: centroid (default), 85% rolloff, flatness, or pitch class (hue walks the circle of fifths)
  - color range: per recording or shared
  - palette: dusk, which matches the reference, or viridis, magma, ink
  - height: linear RMS or dB, per recording or shared
  - time axis: shared seconds per pixel, or each row fills the width
  - smoothing and row height

## Engine

The engine is the `shared-code` block, tested from Node by `test.mjs` (53 tests).

- Mono mix, 2048-point Hann FFT, hop 1024.
- Per-frame RMS, centroid (magnitude-weighted), 85% rolloff, flatness (geometric/arithmetic mean of power), and a 12-bin chroma over 55 Hz–4.2 kHz.
- Columns are aggregated per device pixel. Loudness is the energy mean. Color is the energy-weighted mean of the log value, with silent frames excluded. Columns finer than the frame rate are interpolated. Smoothing is Gaussian.
- In pitch-class mode, each class's energy is smoothed over time before the argmax. Without that, the dominant note flickers column to column and the ribbon turns to stripes.
- The color range is the 2nd–98th percentile over 0.25 s bins, each bin an energy-weighted mean, the same weighting the drawn columns use. A per-frame percentile let quiet frames stretch the range past anything visible.
- Flatness is shown in dB, with no clamp. Piano frames sit around 1e-9…1e-7 (−90 to −70 dB). An early 1e-6 floor flattened the whole ribbon to one color (reported from Firefox, 2026-10-25, together with an overlapping legend; the legend now wraps by measured width in two columns).

## Pitch lines and roughness (owner request, 2026-10-25)

The owner asked for sparklines of "the 3 most significant FFT components" that rise and fall with pitch inside a moving window rather than on a fixed 0–22 kHz axis, and for a harmony ↔ disharmony measure. They then chose this design from a list of options.

- **Peaks** come from a second, 8192-point FFT per frame (5.4 Hz bins). At 2048 points a semitone at A4 (26 Hz) merges into one peak, and all close-interval roughness disappeared; tests caught it. A peak is a local maximum over ±2 bins, at most 50 dB under the frame's loudest, refined by a parabola on log magnitude (3 cents on test tones). Analysis costs about 1 s per minute of audio.
- **Roughness:** Plomp–Levelt in Sethares' parametrisation, summed over pairs of the 20 strongest peaks and divided by their total power, so loudness has no effect. Tests: minor 2nd ≫ major 3rd ≫ fifth ≈ octave ≈ 0, and the tritone is rougher than the fifth for complex tones. Available as a color option and as a red line. The line is smoothed ~0.5 s, scaled to the 5th–95th percentile, and gated.
- **Notes:** iterative harmonic salience (weights 1/h, 8 harmonics, 3% tolerance). It prefers the fundamental when a 2nd or 3rd harmonic outscores it. From h = 3 up, a harmonic louder than 1.5× its neighbours' mean keeps the excess for another note (G4 on C3's 3rd harmonic). Applying that to h = 2 would make ghost octaves on every piano note. On the real Für Elise opening the strongest notes read E5 E♭5 E5 E♭5 E5 B4 D5 C5 A.
- **Voices:** notes are tracked frame to frame (nearest pitch, ≤ max jump), then the note-sized segments are linked. A new note hands over from a fading one in its register; a louder held note keeps its own line (test: a held C3 under E4 F4 G4).
- **Gate:** frames more than 36 dB under the recording's 99th-percentile RMS are ignored. Room hum before Für Elise sits at −41 dB, while 95% of the music is above −29 dB.
- **Display:** semitones relative to the moving median of all note pitches (window 1–12 s, default 4), range ±6/12/24 (default 24, because piano bass and melody are often more than an octave from the median). Out-of-range stretches are left undrawn, not pinned to the edge.
  - At the 1× poster scale a pixel holds a dozen notes, and per-voice lines were unreadable scribble (seen in the first screenshot). So when zoomed out, the strip draws per-column loudness-weighted 85th/50th/15th percentiles: the contour of the upper voice, the middle and the bass.
  - A zoom control (1×–16×, horizontal scroll, canvas capped at 30k device px) reaches the per-voice view, colored by salience rank.
- **Live microphone:** a second AnalyserNode (fftSize 8192) feeds the peaks.

## Key figures table (owner request, 2026-10-25)

The owner asked for "KPIs" and picked a per-recording panel. It is drawn on the poster canvas under the legend (so Save PNG includes it), with a faint bar per numeric cell comparing recordings within the column. Columns split into stacked tables when narrow.

- **Loudness:** ITU-R BS.1770-4 integrated loudness, using K-weighting derived for any sample rate, 400 ms blocks every 100 ms, gates at −70 LUFS and −10 LU. Loudness range follows EBU Tech 3342 (3 s windows, gates −70/−20, p95 − p10). Also sample peak and peak-to-loudness.
  - Tests: the 48 kHz coefficient table to 1e-15, the EBU −23 dBFS stereo tone at −23.00 LUFS, mono −20 dBFS at −23.01, and LRA case 1 at exactly 10.00 LU.
  - On the four Commons files it agrees with pyloudnorm to +0.046 LU every time. That constant offset is pyloudnorm's: its default K-filter uses rounded parameters (shelf at 1500 Hz) and reads −23.04 on the EBU tone.
  - Measured values: −24.0 / −32.4 / −17.3 / −17.7 LUFS. The Valkyries file peaks at +0.6 dBFS, so it is clipped, and the table flags it.
- **Onsets:** peaks of log-compressed spectral flux (2048 FFT, ≤ 11 kHz), local max ±2 frames, above the local mean + 0.12 after normalising by the 95th percentile. In testing, an abrupt synthetic note end is a click and counts as a real onset; the test notes now fade out.
- **Tempo:** autocorrelation of the onset envelope, 40–220 BPM, log-Gaussian prior at 120 BPM (σ = 1 octave). The envelope is smoothed ~20 ms first; without that, a 120 BPM train (21.5-frame period) read 60 BPM. The beat-strength label comes from the autocorrelation at the chosen lag relative to lag 0. On rubato or triplet classical music expect multiples or fractions of the written beat.
- **Key:** Krumhansl–Kessler correlation on a salience-weighted pitch-class profile of the detected notes. A runner-up within 0.06 is named. Real files: Für Elise A minor, Moonlight C♯ minor, Valkyries B minor (B major close), all correct. Danse macabre reads D minor (r 0.63) against its written G minor; kept as measured and explained on the page.
- **Also:** pitch range (5th–95th percentile of the notes; the 1921 acoustic Valkyries has no bass, so it starts at G3), median brightness, median roughness, onsets per playing second, % quiet (below the −36 dB note gate).

## Notes

- With all four loaded, the low ends of the color scales match the poster closely: Danse macabre 615 vs 612 Hz, Valkyries 878 vs 881 Hz. The top ends run 10–20% higher here.
- The top of the centroid range is higher than the reference poster's: Für Elise is 679 Hz – 2.6 kHz here, 652 Hz – 1.6 kHz there. Measured on the same file, capping the spectrum at 11 kHz (librosa's default 22.05 kHz resampling) gives 625 Hz – 2.0 kHz. That accounts for most of the gap. The rest probably comes from the reference averaging brightness per bar (duration/800) before taking percentiles. This page keeps the full band at the file's own rate.
- The microphone was verified with headless Chrome using `--use-fake-device-for-media-stream` over CDP (its fake beeps show as evenly spaced bursts). It has not been tried with a real microphone.
- Ogg decoding depends on the browser. Chrome, Edge and Firefox handle it; recent Safari does too.
