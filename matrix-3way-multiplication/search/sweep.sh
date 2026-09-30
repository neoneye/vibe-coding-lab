#!/bin/bash
# usage: sweep.sh TOTAL SEEDS_PER_JOB  -- all splits s+t=TOTAL with t>=4, s>=4, two jobs per split
P=/private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/04623c75-f5d0-4529-a9fb-b362a4465780/scratchpad/venv/bin/python
TOTAL=$1; N=$2
for s in 5 6 7 8 9; do
  t=$((TOTAL - s))
  for j in 0 1; do
    $P deg3h.py $s $t $N $((j*1000)) > logs/sum${TOTAL}_s${s}_t${t}_j${j}.log 2>/dev/null &
  done
done
wait
