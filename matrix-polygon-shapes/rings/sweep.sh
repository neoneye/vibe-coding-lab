#!/bin/bash
# background rank sweep for the pentagon ring T_2(C_5)
P=/private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/04623c75-f5d0-4529-a9fb-b362a4465780/scratchpad/venv/bin/python
$P ring_rank.py 5 2 31 20 0    > logs/c5_R31_a.log 2>&1 &
$P ring_rank.py 5 2 30 40 0    > logs/c5_R30_a.log 2>&1 &
$P ring_rank.py 5 2 30 40 1000 > logs/c5_R30_b.log 2>&1 &
$P ring_rank.py 5 2 29 40 0    > logs/c5_R29_a.log 2>&1 &
$P ring_rank.py 5 2 28 40 0    > logs/c5_R28_a.log 2>&1 &
wait
