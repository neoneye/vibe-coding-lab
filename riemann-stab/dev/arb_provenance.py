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
"""

import hashlib
import os


def hash_inputs(sources):
    """{filename: sha256} for a declared dependency set, relative to dev/."""
    here = os.path.dirname(os.path.abspath(__file__))
    out = {}
    for name in sorted(sources):
        with open(os.path.join(here, name), "rb") as fh:
            out[name] = hashlib.sha256(fh.read()).hexdigest()
    return out
