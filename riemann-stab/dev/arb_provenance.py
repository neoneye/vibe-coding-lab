"""Provenance for the Arb transcripts.

Each Arb script writes a transcript that the suite checks even on a machine with
no Arb, and that check is the only guard there.  It used to hash the script's own
source and nothing else -- so a change to coercivity_arb.py, which three of the
four import, left three transcripts reading as fresh.  A reviewer caught it: the
hashes omitted dependencies, so "suite green" overstated their freshness.

Every script now declares the full set of files its result depends on -- its own
source, the modules it imports, and the certificate data it reads -- and the
transcript carries a hash per file.  dev/check_arb.js verifies all of them and
refuses a transcript that carries no such map.

One wrinkle, found by the guard eating its own tail.  Some of those inputs are
themselves transcripts, and a transcript records the git commit it was emitted
at.  So a replay command that regenerates such an input changes its hash -- not
because anything determining the result moved, but because HEAD did -- and the
dependent transcript reads as stale forever after.  sweep_proof.json is the case
in point: its replay regenerates it, and check_arb.js runs that replay, so the
pair could never both be fresh across a commit.

Provenance LINES are therefore dropped before hashing a .json input.  `commit`
and `seconds` say where and how long, not what, and sweep.js already says of the
commit that it is "recorded, never compared".  Everything else in the file, the
tape digest included, still counts.
"""

import hashlib
import os

# Recorded for provenance and excluded from the hash: they move when HEAD moves
# or the machine is busy, neither of which changes a result.
VOLATILE = ('"commit":', '"seconds":')


def canonical(raw):
    """File bytes with provenance LINES removed.

    A line filter and not a JSON round trip, deliberately: dev/check_arb.js has
    to compute the identical digest with no Python available, and two languages
    agreeing on how to re-serialise floats is a much worse bet than two languages
    agreeing on how to drop a line.  Every transcript here is written with an
    indent of two, so each of these keys occupies exactly one line.
    """
    keep = [ln for ln in raw.split(b"\n")
            if not any(ln.strip().startswith(k) for k in
                       (v.encode() for v in VOLATILE))]
    return b"\n".join(keep)


def hash_inputs(sources):
    """{filename: sha256} for a declared dependency set, relative to dev/."""
    here = os.path.dirname(os.path.abspath(__file__))
    out = {}
    for name in sorted(sources):
        with open(os.path.join(here, name), "rb") as fh:
            raw = fh.read()
        out[name] = hashlib.sha256(
            canonical(raw) if name.endswith(".json") else raw).hexdigest()
    return out
