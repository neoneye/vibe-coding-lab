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

echo "== lean axiom audit (fail-closed) =="
AXFILE="$(mktemp /tmp/zc_axioms_XXXXXX).lean"
cp "$PWD/lean/ZetaClaims.lean" "$AXFILE"
cat >> "$AXFILE" <<'LEANEOF'

#print axioms chain_inequality
#print axioms indicator_stability_chain
#print axioms headline_fraction_floor
#print axioms headline_fraction_ceiling
#print axioms improvement_direction
#print axioms mixture_snapshot
LEANEOF
AXOUT=$(lean "$AXFILE" 2>&1)
AXRC=$?
echo "$AXOUT"
rm -f "$AXFILE"
if [ "$AXRC" -ne 0 ]; then echo "AXIOM AUDIT FAILED: lean errored"; exit 1; fi
# fail on forbidden axioms or unexpected compile diagnostics
if echo "$AXOUT" | grep -Eq "sorryAx|native_decide.ax|error"; then
  echo "AXIOM AUDIT FAILED: forbidden axiom or error present"; exit 1
fi
echo "axiom audit OK (standard axioms only)"

echo "== snapshot <-> golden coupling =="
node check_snapshot.js

echo "== build =="                 && node build.js
echo "== DOM smoke (browser parity vs golden) ==" && node ui_dom_smoke.js
echo "=== SUITE GREEN ==="
