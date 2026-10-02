#!/bin/zsh
# Batch e22: the triangle feed-forward in all six blocks, three ways (local window, wrap, no wrap),
# 1,000 steps, seed 0, frozen text; one run at a time, 4 threads.
PY=${PY:-python}
for k in triL triW tri; do SHAPE_THREADS=4 SHAPE_CORPUS=corpus_e4.txt $PY shapellm.py $k 0 1000 5 > logs/e22_${k}_0.log 2>&1; done
