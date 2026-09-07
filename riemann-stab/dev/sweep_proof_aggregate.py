"""Combine root-range shards of an all-nodes Arb check of one proof tape into one
verdict -- and refuse to call the combination complete unless it is.

    python3 dev/sweep_proof_aggregate.py <meta.json> <out.json> <shard result>...

A shard is one run of dev/sweep_proof_arb.py --all --roots=a:b.  The combination
is COMPLETE only if every shard ended "shard complete", the root ranges partition
[0, roots) exactly with no overlap, each shard's verdicts account for exactly its
obligations with nothing skipped and nothing unresolved, the shards all executed
the same declared inputs, those inputs are the files on disk NOW (so the record
is about the checker in the tree, not a previous one), no input changed during
any run, and the shards' obligations sum to the tape's leaves and collapses.

The previous, scratch version of this tool summed the shards' verdict totals and
compared them with the metadata; a review found those totals inflated by
out-of-shard samples, so equality was a coincidence it could not detect.
"""
import json
import os
import sys

import arb_provenance


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 2
    here = os.path.dirname(os.path.abspath(__file__))
    meta_path, out_path, files = sys.argv[1], sys.argv[2], sys.argv[3:]
    meta = json.load(open(os.path.join(here, meta_path)))
    problems = []
    ranges = []
    inputs = None
    leaves = collapses = 0
    seconds = 0.0
    unresolved = []
    for f in files:
        r = json.load(open(f))
        tag = os.path.basename(f)
        if r.get("mode") != "every node, inline":
            problems.append("%s: not an all-nodes run" % tag)
        if not str(r.get("status", "")).startswith(("shard complete", "complete")):
            problems.append("%s: status %r" % (tag, r.get("status")))
        if r.get("tape_sha256") != meta["tape_sha256"]:
            problems.append("%s: checked a different tape" % tag)
        if r.get("candidate") != meta.get("candidate", "tiling_pair.stationary.json"):
            problems.append("%s: checked a different candidate" % tag)
        if not r.get("sources_unchanged_during_run", False):
            problems.append("%s: its sources changed while it ran" % tag)
        if inputs is None:
            inputs = r.get("inputs")
        elif r.get("inputs") != inputs:
            problems.append("%s: executed different sources from the other shards" % tag)
        sh = r.get("shard_obligations") or {}
        if sh.get("skipped_leaves", 1) or sh.get("skipped_collapses", 1):
            problems.append("%s: obligations skipped" % tag)
        ls, cs = r.get("leaf_sample", {}), r.get("collapse_sample", {})
        if (ls.get("confirmed") != sh.get("leaves") or cs.get("confirmed") != sh.get("collapses")
                or ls.get("beyond_resolution") or ls.get("refuted")
                or cs.get("beyond_resolution") or cs.get("refuted")):
            problems.append("%s: verdicts do not account for its obligations as all confirmed" % tag)
        if r.get("unresolved_obligations"):
            unresolved += [dict(u, shard=tag) for u in r["unresolved_obligations"]]
        if not all(c["ok"] for c in r.get("checks", [])):
            problems.append("%s: a check failed" % tag)
        rs = r.get("roots_shard") or "0:%d" % r.get("roots_total", 0)
        a, b = [int(t) for t in rs.split(":")]
        b = min(b, r.get("roots_total", b))
        ranges.append((a, b, tag))
        leaves += sh.get("leaves", 0)
        collapses += sh.get("collapses", 0)
        seconds += float(r.get("seconds", 0) or 0)
    ranges.sort()
    total = None
    if files:
        total = json.load(open(files[0])).get("roots_total")
    if total is None or ranges[0][0] != 0 or ranges[-1][1] != total:
        problems.append("root ranges do not start at 0 and end at the root count")
    for i in range(len(ranges) - 1):
        if ranges[i][1] != ranges[i + 1][0]:
            problems.append("root ranges %s and %s do not abut" % (ranges[i][2], ranges[i + 1][2]))
    if leaves != meta["leaves"] or collapses != meta["collapses"]:
        problems.append("shard obligations sum to %d leaves, %d collapses; the tape has %d, %d"
                        % (leaves, collapses, meta["leaves"], meta["collapses"]))
    now = arb_provenance.hash_inputs(sorted(inputs)) if inputs else {}
    stale = [k for k in (inputs or {}) if now.get(k) != inputs[k]]
    if stale:
        problems.append("the shards executed sources that differ from the files on disk now: " + ", ".join(stale))
    status = "complete" if not problems else "incomplete"
    rec = {
        "what": "complete Arb check of every arithmetic obligation of a proof tape, in root-range shards",
        "status": status, "problems": problems,
        "tape": meta["tape"], "tape_sha256": meta["tape_sha256"], "candidate": meta.get("candidate"),
        "target": meta["target"], "cube": meta["cube"], "tubeRadius": meta["tubeRadius"],
        "nodes": meta["nodes"], "leaves": meta["leaves"], "collapses": meta["collapses"],
        "shards": len(files), "root_ranges": [[a, b] for a, b, _ in ranges], "roots": total,
        "obligations_confirmed": {"leaves": leaves, "collapses": collapses},
        "unresolved": unresolved,
        "inputs": inputs, "shard_seconds_total": round(seconds, 1),
        "replay": "python3 dev/sweep_proof_arb.py --all --meta=%s --roots=a:b --out=<shard>  for each range, then "
                  "python3 dev/sweep_proof_aggregate.py %s <out> <shards>" % (meta_path, meta_path),
    }
    json.dump(rec, open(os.path.join(here, out_path), "w"), indent=1)
    print(json.dumps({k: rec[k] for k in ["status", "problems", "shards", "root_ranges", "obligations_confirmed"]}, indent=1))
    return 0 if not problems else 1


if __name__ == "__main__":
    sys.exit(main())
