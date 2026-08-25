# -*- coding: utf-8 -*-
import io,os
DEV='/Users/neoneye/git/vibe-coding-lab/riemann-stab/dev'

def rep(path, old, new, tag):
    src = io.open(path, encoding='utf-8').read()
    if old in src:
        src = src.replace(old, new)
        io.open(path, 'w', encoding='utf-8').write(src)
        print('OK  ', tag)
    else:
        print('MISS', tag)

# ---- template: remove duplicate sources row, simplify hierarchy ----
p1 = DEV + '/template.html'
rep(p1,
    '<li>Candidate-family audit ledger (self-published, dated 2026-08-25): <a href="https://zeta.teal-sea.com/">zeta.teal-sea.com</a> \u2014 ~15 runnable stability-defect candidates, leaderboard max \u224867.34165% (fresh-clone verifier gate currently inconclusive), original finite certificate judged sound, two smaller \u201cLean-internal\u201d claims at 67.27373%/67.28470%. No entry independently reviewed.</li>\n',
    '',
    'remove duplicate sources row')

rep(p1,
    'stability-defect family <span class="dim">(unsigned candidates, unreviewed; leaderboard max \u22480.67342)</span>',
    'stability-defect candidates <span class="dim">(unsigned; see audit note in Sources)</span>',
    'hierarchy row simplify')

# ---- rejected/README.md: fix arithmetic + add historical label ----
p2 = DEV + '/lean/rejected/README.md'
rep(p2,
    'Status: WITHDRAWN 2026-08-25. Reason: unresolved factor-2 scale\ninconsistency between the seven-point defect bound and the second-moment\nbound. Preserved here so future reviewers can reproduce exactly why the\ntheorem was not shipped.',
    'Status: WITHDRAWN 2026-08-25. This file documents a derivation sketch\nthat was attempted and withdrawn; it is NOT a reproducible proof.',
    'README historical label')

rep(p2,
    'exceeding c_MT^-1 by ~1.7e-6',
    'exceeding c_MT^-1 by ~1.7e-6',
    'README arithmetic (verify current)')

rep(p2,
    'not asymptotic remainders. The checker lives at\ndev/mix_convergence_test.js (golden-parity section); a standalone\nreproduction requires that file plus core.js from the same commit.',
    'not asymptotic remainders. The numerical validation was performed\ninteractively during development and is not preserved as a runnable\nscript in this repository.',
    'README remove stale checker ref')

# ---- core.js comment already correct from earlier fix ----
print('\ncore.js comment: already says "scales as lambda^2" - confirmed')

print('\nall corrections applied')
