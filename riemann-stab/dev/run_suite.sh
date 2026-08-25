#!/bin/sh
# Full verification suite for the riemann-stab laboratory.
# Usage: sh dev/run_suite.sh   (from repository root riemann-stab/)
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.elan/bin:$PATH"

echo "== core numerical tests ==" && node test.js
echo "== ship checks =="           && node labs_shipcheck.js
echo "== chain checks =="          && node labE_chain_test.js
echo "== mixture/golden checks ==" && node mix_convergence_test.js
echo "== lean formalization =="
if lean "$PWD/lean/ZetaClaims.lean"; then echo "lean OK"; else echo "LEAN FAILED"; exit 1; fi
echo "== build =="                 && node build.js
echo "== DOM smoke (browser parity vs golden) ==" && node ui_dom_smoke.js
echo "=== SUITE GREEN ==="
