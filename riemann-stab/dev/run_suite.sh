#!/bin/sh
# Full verification suite for the riemann-stab laboratory.
# Usage: sh dev/run_suite.sh   (from repository root)
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.elan/bin:$PATH"

echo "== core numerical tests ==" && node test.js
echo "== ship checks =="           && node labs_shipcheck.js
echo "== chain checks =="          && node labE_chain_test.js
echo "== mixture/golden checks ==" && node mix_convergence_test.js

echo "== lean formalization =="
if lean "$PWD/lean/ZetaClaims.lean"; then echo "lean OK"; else echo "LEAN FAILED"; exit 1; fi

echo "== lean axiom audit (fail-closed, exact whitelist) =="
AXFILE="$(mktemp /tmp/zc_axioms_XXXXXX).lean"
cp "$PWD/lean/ZetaClaims.lean" "$AXFILE"
cat >> "$AXFILE" <<'LEANEOF'

#print axioms chain_inequality
#print axioms headline_fraction_floor
#print axioms headline_fraction_ceiling
#print axioms improvement_direction
#print axioms mixture_snapshot
LEANEOF
AXOUT_FILE="$(mktemp /tmp/zc_axout_XXXXXX)"
lean "$AXFILE" > "$AXOUT_FILE" 2>&1
AXRC=$?
cat "$AXOUT_FILE"
if [ "$AXRC" -ne 0 ]; then rm -f "$AXOUT_FILE"; echo "AUDIT FAILED: lean errored"; exit 1; fi
node check_axioms_strict.js "$AXOUT_FILE"
CRC=$?
rm -f "$AXFILE" "$AXOUT_FILE"
[ "$CRC" -ne 0 ] && { echo "AXIOM WHITELIST FAILED"; exit 1; }
echo "axiom audit OK"

echo "== snapshot <-> golden coupling =="
node check_snapshot.js

echo "== build =="                 && node build.js
echo "== DOM smoke =="             && node ui_dom_smoke.js
echo "=== SUITE GREEN ==="
