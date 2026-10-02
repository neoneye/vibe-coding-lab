#!/bin/zsh
# Batch e6: 2 of 3 triangle sweeps per training step (cyclic "-rot" or random "-rnd"), 4,000 steps × 3 seeds,
# on the same frozen text as e4/e5 so the transformer and the all-sweep triangles can serve as baselines.
PY=${PY:-python}
for s in 0 1 2; do for k in triW-rot triW-rnd tri-rot tri-rnd; do echo "$k $s"; done; done |
  xargs -P 12 -L 1 zsh -c 'SHAPE_CORPUS=corpus_e4.txt SHAPE_THREADS=1 '"$PY"' shapellm.py $0 $1 4000 10 > logs/e6_$0_$1.log 2>&1'
