# riemann-stab Lab F — Implementation plan

Spec: `docs/superpowers/specs/2026-09-07-riemann-stab-lab-f-lamzouri-design.md`

1. **Guard.** Confirm `dev/core.js` is not hashed by `js_provenance.js` / `check_*.js` transcripts. Run the fast baseline (`test.js`, `labs_shipcheck.js`, `build.js`, `ui_dom_smoke.js`) — already green at 64/0.
2. **Core.** Add to `dev/core.js`: `lamzouriKernel`, `lamzouriKernelC`, `lamzouriMultiset`, `lamzouriZeroBound`, `montgomeryTaylorViaQ`, `randomLamzouriMultiset`; export them.
3. **Tests first.** Add the test block to `dev/test.js` per spec; run until green.
4. **Template.** Hero chip, nav, new section 9 markup, renumber old 9 → 10, section 7 pointer, ladder row, approaches row, survey panel, ecosystem sentence.
5. **UI.** Two self-test rows; Lab F IIFE (F·i, F·ii, what-if, F·iii).
6. **Smoke.** Update `ui_dom_smoke.js` (defaults, handlers, 10 rows, new assertions). Build, run smoke, ship-check, test.
7. **Look at it.** Open `index.html` in the Browser pane, run F·i and F·ii, read the numbers, fix layout.
8. **README** clause. Commit.
