#!/bin/zsh
# Batch e23: triangle in all six blocks with rotating sweep strengths ("-une": 3/6, 2/6, 1/6, ×3) and with 2 of 3 sweeps ("-rot"),
# wrap and no wrap, 1,000 steps, seed 0, frozen text; one run at a time, 4 threads. Compare with e22 (all three sweeps, equal).
PY=${PY:-python}
for k in triW-une tri-une triW-rot tri-rot; do SHAPE_THREADS=4 SHAPE_CORPUS=corpus_e4.txt $PY shapellm.py $k 0 1000 5 > logs/e23_${k}_0.log 2>&1; done
