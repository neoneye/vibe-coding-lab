#!/bin/zsh
# Batch e7: square torus swept along rows, columns and both diagonals ("4 of 4"), 4,000 steps × 3 seeds,
# on the same frozen text as e4–e6. sq4 = pairwise products, sq4c = triple products.
PY=${PY:-python}
for s in 0 1 2; do for k in sq4 sq4c; do echo "$k $s"; done; done |
  xargs -P 6 -L 1 zsh -c 'SHAPE_CORPUS=corpus_e4.txt SHAPE_THREADS=1 '"$PY"' shapellm.py $0 $1 4000 10 > logs/e7_$0_$1.log 2>&1'
