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
echo "== overlapping-block research checks ==" && node tiling_research_test.js
echo "== tiling Bellman/coboundary checks ==" && node tiling_bellman_test.js
echo "== additive coboundary certificate checks ==" && node tiling_additive_test.js
echo "== general block-size checks ==" && node tiling_blocks_test.js
echo "== local coercivity checks ==" && node tiling_coercivity_test.js
echo "== independent Arb certification (local coercivity) ==" && node check_arb.js
echo "== rigorous arithmetic checks ==" && node tiling_rigorous_test.js
echo "== pressure, mode locking, plateau edges ==" && node tiling_pressure_test.js
echo "== pair-state coboundary checks ==" && node tiling_pair_test.js
echo "== bilinear enclosures and the pair sweep ==" && node tiling_pair_interval_test.js
echo "== the tube a sweep cannot do ==" && node tiling_pair_local_test.js
echo "== pair sweep transcript ==" && node check_pair_sweep.js
echo "== tube-restricted block sweep checks ==" && node tiling_defect_test.js
echo "== interval sweep checks ==" && node tiling_interval_test.js

echo "== lean formalization =="
if lean "$PWD/lean/ZetaClaims.lean"; then echo "lean OK"; else echo "LEAN FAILED"; exit 1; fi

echo "== lean axiom audit (fail-closed, exact whitelist) =="
AXFILE="$(mktemp /tmp/zc_axioms_XXXXXX).lean"
cp "$PWD/lean/ZetaClaims.lean" "$AXFILE"
cat >> "$AXFILE" <<'LEANEOF'

#print axioms chain_inequality
#print axioms reversal_coboundary_symmetrization
#print axioms reversal_potential_antisymmetric
#print axioms binary_phase_defect_balance
#print axioms potential_telescopes
#print axioms coboundary_floor_telescopes
#print axioms cyclic_coboundary_floor
#print axioms assumed_floor_exceeds_local_certificate
#print axioms projection_at_assumed_floor_lower
#print axioms projection_at_assumed_floor_upper
#print axioms projection_at_assumed_floor_ordering
#print axioms montgomery_taylor_complement
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
