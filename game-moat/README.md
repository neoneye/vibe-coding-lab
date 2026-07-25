# MOAT

A facility-management game about keeping twelve crocodiles alive and everybody
else out.

You are the facility manager for a firm that installs live-crocodile security
moats for clients with more money than judgement. You did not design the
product. You did not sell it. You are the person standing beside it at 6 a.m.
with a clipboard, counting.

Three obligations fight each other: the animals must stay well, the perimeter
must work, and the accident must not happen.

Crocodile activity is one derived value. Warm, hungry animals guard a perimeter
and endanger your staff; cold, well-fed ones are safe to work around and stop
nobody. You never set that value directly — you set heaters, shade, depth,
filtration and the feed schedule, and it falls out of them. There is no setting
that is safe in both directions, only a setting that is correct for what is
about to happen, and you do not always know what is about to happen.

The morning census is an observation, not a fact. Murky water is better for the
animals and better for deterrence, and it is exactly why you cannot count them.
A short count is always ambiguous, and every decision that follows is made on
incomplete information.

Open `index.html`. Each day opens with a briefing where you spend a fixed pool
of handler-hours — a thorough count is three hours not spent inspecting culvert
4. Then time runs at 1×/4×/16× and you react. Six contracts, unlocked in order.

A perfect run is one where the log is empty and the client is faintly
disappointed that nothing exciting happened.

Spec: `../docs/superpowers/specs/2026-07-25-moat-design.md`.
Plan: `../docs/superpowers/plans/2026-07-25-moat.md`.
Tests: `node test.mjs`.
