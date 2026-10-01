#!/bin/bash
# 3D-shape comparison: five sequential lanes, each line "variant seed steps"
P=/private/tmp/claude-501/-Users-neoneye-git-vibe-coding-lab/04623c75-f5d0-4529-a9fb-b362a4465780/scratchpad/venv/bin/python
lane() { while read v s n; do $P triangle_ffn.py $v $s $n > logs/${v}_${s}_${n}.log 2>&1; done; }
printf "tet4 0 500\n" | lane &
printf "tet4 1 500\n" | lane &
printf "cube3 0 1500\ncube3 1 1500\ncube3 0 500\ncube3 1 500\n" | lane &
printf "mlp 0 500\nmlp 1 500\nglu 0 500\nglu 1 500\ntri3 0 500\n" | lane &
printf "tri3 1 500\n" | lane &
wait
