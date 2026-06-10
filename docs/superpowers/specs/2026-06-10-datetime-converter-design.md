# Datetime Converter (worldtimebuddy-style) — Design

**Date:** 2026-06-10
**Project:** `datetime-converter/`
**Status:** Approved by user

## Purpose

A standalone HTML page in the style of worldtimebuddy's UTC-to-CET converter. It shows
24 hours on the x-axis with one row per timezone, so the user (in Denmark, 24-hour
clock) can compare times with friends in the USA (AM/PM) and with computer programs
that run on UTC.

## Requirements

- Single self-contained `index.html` (repo convention), no network dependencies.
- 24 hour-cells per row, columns aligned by absolute time.
- Default rows on first visit: `UTC`, `Europe/Copenhagen`, `America/Los_Angeles`.
- User can add, remove, and reorder timezone rows.
- Hover highlights a full hour column; click pins it; click again or Esc unpins.
- Time format per row decided automatically: 12-hour countries (US, Canada,
  Australia, Philippines, India, …) show AM/PM, everything else 24h. A global
  header toggle overrides: Auto / 24h / AM-PM.
- Timezone list, order, and format override persist in `localStorage`.
- Today only — no date navigation. DST is still computed correctly for the current
  date via the `Intl` API.

## Approach

Vanilla JS using the browser's `Intl` API:

- `Intl.DateTimeFormat` with the `timeZone` option for correct local hours, dates,
  offsets, and DST handling for every IANA zone.
- `Intl.supportedValuesOf('timeZone')` for the searchable add-timezone list.

Alternatives rejected: Luxon via CDN (breaks self-containment), hardcoded offset
table (wrong across DST transitions).

## Layout

- Header: title, global format toggle (Auto / 24h / AM-PM), "+ Add" button.
- One row per timezone:
  - Left label block: city name, zone abbreviation + UTC offset, current local
    time ticking live (updates every minute).
  - 24 hour cells.
- The **first row is the reference zone**: its cells are hours 0–23 of its current
  day. Other rows show whatever local hour falls in each absolute-time column,
  possibly crossing into another date; the cell where a row's local date changes
  shows a small date label (e.g. "Jun 11").
- Cells tinted by time of day: night (0–6, 22–23) dark, morning/evening (7, 18–21)
  medium, working hours (8–17) light.
- The column containing the current time gets a "now" highlight, updated every
  minute.

## Interaction

- Hover: highlight the hovered column across all rows.
- Click: pin the column (sticky highlight); each row's pinned cell shows that
  zone's time in its own format. Click again or press Esc to unpin.
- Add: search box filtering all IANA zones by city or zone name.
- Remove: × button per row.
- Reorder: drag handle per row, plus ▲/▼ buttons as fallback. Moving a row to
  position 0 makes it the reference zone and re-anchors the grid.

## Persistence

`localStorage` key `datetime-converter-v1` storing `{ zones: [ids…], format:
"auto"|"24h"|"ampm" }`. Corrupt or missing data falls back to defaults.

## Testing

Following the `game-snake` pattern: the pure grid logic lives in a marked
shared-code `<script>` block inside `index.html`, and `test.mjs` extracts and runs
it in Node. Covered logic:

- Computing each row's 24 (hour, date-label) cells given a reference zone and a
  reference instant, including rows offset by fractional hours (e.g. Asia/Kolkata)
  and date-boundary labels.
- DST-transition days (23- and 25-hour days) produce correct cell sequences.
- Format selection: 12-hour vs 24-hour zone classification and the global override.
- Persistence serialization round-trip and fallback on corrupt data.

## Error handling

- Unknown/renamed zone ids loaded from localStorage are dropped silently.
- Browsers without `Intl.supportedValuesOf` fall back to a built-in list of
  common zones for the add-search (display logic only needs `Intl.DateTimeFormat`,
  which is universal).
