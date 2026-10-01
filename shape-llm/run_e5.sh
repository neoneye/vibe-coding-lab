#!/bin/zsh
# Batch e5: the remaining triangle variants at 4,000 steps × 3 seeds, on the same frozen text as e4.
PY=${PY:-python}
for s in 0 1 2; do for k in tri triW triR triS triSN; do echo "$k $s"; done; done |
  xargs -P 10 -L 1 zsh -c 'SHAPE_CORPUS=corpus_e4.txt SHAPE_THREADS=1 '"$PY"' shapellm.py $0 $1 4000 10 > logs/e5_$0_$1.log 2>&1'
