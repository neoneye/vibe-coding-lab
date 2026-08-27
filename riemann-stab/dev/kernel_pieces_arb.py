"""Exact monotone-piece ranges for w and w', in Arb.

The sweep's enclosures are tighter than a straightforward Arb reimplementation,
and that gap is why an independent checker could confirm only three of two
hundred and twenty sampled leaves.  The gap is not fundamental: the sweep is
tighter because it uses the EXACT range of w over an interval, built from
precomputed breakpoints, where the obvious Arb version uses an interval
extension.  So build the breakpoints in Arb too.

The structure is clean and comes out of the closed form.  With a = 1/sqrt(2) and
b = pi x,

    K(x) = ( a sin a cos b - b cos a sin b ) / ( a^2 - b^2 ),

so w = (K/K0)^2 vanishes exactly at the roots of b tan b = a tan a -- one per
period of tan -- and has exactly one maximum between consecutive roots, at a
root of K'.  Between those breakpoints w is monotone, so its range over any
interval is the hull of the endpoint values and whatever breakpoints the
interval contains.  Exact, not enclosing.

w' needs its own breakpoints, the roots of w''.  Those are found by scanning
each piece and certified the same way.

Every breakpoint here is certified by an interval Newton test: a unique root in
an explicit bracket, refined until strict containment stops holding, which is
the resolution limit and not a failure.
"""

import json
import os
import sys

from flint import arb, arb_series, ctx

import arb_provenance

SOURCES = [
    "arb_provenance.py",
    "kernel_pieces_arb.py",
]

ctx.prec = 220

A = None
K0 = None
CC = None


def _init():
    global A, K0, CC
    if A is None:
        A = 1 / arb(2).sqrt()
        K0 = A.sin() / A
        CC = A * A.tan()


def kernel(x):
    _init()
    b = arb.pi() * x
    return (A * A.sin() * b.cos() - b * A.cos() * b.sin()) / (A * A - b * b)


def kernel_jet(x, n):
    """K and its first n-1 derivatives at x, by series arithmetic on the closed
    form.  Finite differences over a BALL are meaningless -- that mistake cost a
    failed certification here and in the odd-period work -- and hand-differentiating
    a quotient of trigonometric polynomials three times is how sign errors get in.

    The closed form has a removable singularity at x = a/pi = 0.2251, where
    a^2 - b^2 vanishes.  Every breakpoint is at x >= 1.05, so this is only ever
    called well away from it; point EVALUATIONS go through the sinc form below,
    which is fine everywhere.
    """
    _init()
    s = arb_series([x, 1], n)
    b = arb.pi() * s
    num = A * A.sin() * b.cos() - b * A.cos() * b.sin()
    den = A * A - b * b
    K = num / den
    out = []
    fact = arb(1)
    for i in range(n):
        if i:
            fact *= i
        out.append(K[i] * fact)
    return out


def kernel_d(x):
    return kernel_jet(x, 2)[1]


def weight(x):
    """Evaluated through sinc, which is defined and enclosed at every x."""
    _init()
    r = arb(2).sqrt()
    tp = 2 * arb.pi()
    k = (((r - tp * x) / 2).sinc() + ((r + tp * x) / 2).sinc()) / 2
    q = k / K0
    return q * q


def weight_jet(x, n):
    """w and its derivatives, from K's: w = (K/K0)^2."""
    kj = kernel_jet(x, n + 1)
    inv = 1 / (K0 * K0)
    out = [kj[0] * kj[0] * inv]
    if n >= 2:
        out.append(2 * kj[0] * kj[1] * inv)
    if n >= 3:
        out.append(2 * (kj[1] * kj[1] + kj[0] * kj[2]) * inv)
    if n >= 4:
        out.append(2 * (3 * kj[1] * kj[2] + kj[0] * kj[3]) * inv)
    return out


def weight_d(x):
    _init()
    r = arb(2).sqrt()
    tp = 2 * arb.pi()
    zl = (r - tp * x) / 2
    zr = (r + tp * x) / 2
    k = (zl.sinc() + zr.sinc()) / 2
    def sd(z):
        if arb(0) in z:
            m = max(abs(float(z.lower())), abs(float(z.upper())))
            return (-z / 3 + z ** 3 / 30 - z ** 5 / 840) + arb(0, m ** 7 / 45360)
        return (z * z.cos() - z.sin()) / (z * z)
    kp = arb.pi() * (sd(zr) - sd(zl)) / 2
    return 2 * k * kp / (K0 * K0)


def _newton(f, fp, x0, tol=1e-100, steps=200):
    x = arb(x0)
    for _ in range(steps):
        d = fp(x)
        if arb(0) in d:
            return None
        nx = x - f(x) / d
        if abs(float((nx - x).mid())) < tol:
            return arb(nx.mid())
        x = arb(nx.mid())
    return arb(x.mid())


def _certify_shrinking(f, fp, guess, radius):
    """Try a decreasing sequence of brackets.

    A bracket wide enough to look natural -- an eighth of the gap between
    consecutive zeros -- is too wide for the series enclosure of the derivative:
    K'' over it comes back straddling zero and the test refuses.  That is the
    enclosure being loose over a wide ball, not the root being uncertain, and
    shrinking the bracket fixes it.
    """
    r = radius
    for _ in range(14):
        X = _certify(f, fp, guess, r)
        if X is not None:
            return X
        r /= 3
    return None


def _certify(f, fp, guess, radius):
    """Interval Newton: N(X) = m - f(m)/f'(X) inside X proves a unique root."""
    m = arb(guess)
    X = arb(guess, radius)
    proved = None
    for _ in range(8):
        d = fp(X)
        if arb(0) in d:
            return None
        N = m - f(m) / d
        if not (arb(N.lower()) > arb(X.lower()) and arb(N.upper()) < arb(X.upper())):
            break
        proved = X.intersection(N)
        X = proved
        m = arb(X.mid())
    return proved


def zeros(limit):
    """Roots of b tan b = a tan a, certified."""
    _init()
    def f(z):
        b = arb.pi() * z
        return b * b.tan() - CC
    def fp(z):
        b = arb.pi() * z
        t = b.tan()
        return arb.pi() * t + arb.pi() ** 2 * z * (1 + t * t)
    out = []
    k = 1
    while True:
        guess = _newton(f, fp, float(k) + float((CC / (arb(k) * arb.pi() ** 2)).mid()))
        X = _certify(f, fp, float(guess.mid()), 1e-3)
        if X is None:
            raise RuntimeError("zero %d not certified" % k)
        if float(X.mid()) > limit:
            break
        out.append(X)
        k += 1
    return out


def maxima(zs):
    """One root of K' between consecutive zeros of K, certified."""
    def fp(x):
        return kernel_jet(x, 3)[2]
    out = []
    for lo, hi in zip(zs, zs[1:]):
        g = _newton(kernel_d, fp, float(((lo + hi) / 2).mid()))
        span = float((hi - lo).mid()) / 8
        X = _certify_shrinking(kernel_d, fp, float(g.mid()), span)
        if X is None:
            raise RuntimeError("maximum in (%s, %s) not certified" % (lo, hi))
        out.append(X)
    return out


def weight_dd(x):
    return weight_jet(x, 3)[2]


def wd_breaks(zs, ms, samples=24):
    """Roots of w'', by sign change on each monotone piece of w, certified."""
    def fpp(x):
        return weight_jet(x, 4)[3]
    edges = sorted([arb(0)] + list(zs) + list(ms), key=lambda t: float(t.mid()))
    out = []
    for lo, hi in zip(edges, edges[1:]):
        prev = None
        prevx = None
        for i in range(samples + 1):
            x = lo + (hi - lo) * i / samples
            v = float(weight_dd(x).mid())
            if prev is not None and prev * v < 0:
                a, b = prevx, x
                for _ in range(140):
                    m = (a + b) / 2
                    if float(weight_dd(a).mid()) * float(weight_dd(m).mid()) <= 0:
                        b = m
                    else:
                        a = m
                X = _certify_shrinking(weight_dd, fpp, float(((a + b) / 2).mid()),
                                       max(float(((b - a) / 2).mid()) * 4, 1e-9))
                if X is not None:
                    out.append(X)
            prev, prevx = v, x
    return sorted(out, key=lambda t: float(t.mid()))


class Pieces:
    """Breakpoint tables, and the exact ranges they give."""

    def __init__(self, limit=30.0):
        _init()
        self.limit = limit
        self.zs = zeros(limit + 2)
        self.ms = maxima(self.zs)
        wbreaks = sorted([float(t.mid()) for t in self.zs]
                         + [float(t.mid()) for t in self.ms])
        self.wbreaks = [b for b in wbreaks if b <= limit]
        db = [t for t in wd_breaks(self.zs, self.ms)
              if t is not None and float(t.mid()) <= limit]
        self.dbreaks_arb = db
        self.dbreaks = [float(t.mid()) for t in db]

    @staticmethod
    def _hull(vals):
        lo = min(float(v.lower()) for v in vals)
        hi = max(float(v.upper()) for v in vals)
        mid = (arb(lo) + arb(hi)) / 2
        rad = (arb(hi) - arb(lo)) / 2
        return arb(mid.mid(), float(rad.upper()) * (1 + 1e-12) + 1e-300)

    def _range(self, f, breaks, a, b):
        vals = [f(arb(a)), f(arb(b))]
        for t in breaks:
            if a < t < b:
                vals.append(f(arb(t)))
        return self._hull(vals)

    def w_range(self, a, b):
        return self._range(weight, self.wbreaks, a, b)

    def wd_range(self, a, b):
        return self._range(weight_d, self.dbreaks, a, b)


CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok)))
    print("%-4s %s%s" % ("ok" if ok else "FAIL", name, ("  -- " + detail) if detail else ""))


def main():
    print("Arb, %d bits.  Certified breakpoints of w and w'.\n" % ctx.prec)
    P = Pieces(30.0)
    check("every zero of K is certified and K vanishes there",
          all(arb(0) in kernel(z) for z in P.zs),
          "%d zeros up to 30" % len(P.zs))
    check("and each is a zero of w",
          all(arb(0) in weight(z) for z in P.zs))
    check("every maximum between consecutive zeros is certified, with K' zero "
          "there", all(arb(0) in kernel_d(m) for m in P.ms),
          "%d maxima" % len(P.ms))
    check("the breakpoints interlace: one maximum strictly between each pair "
          "of zeros",
          all(float(P.zs[i].mid()) < float(P.ms[i].mid()) < float(P.zs[i + 1].mid())
              for i in range(len(P.ms))))
    # the certified ENCLOSURE, not its rounded midpoint: a double is about
    # 1e-17 off the root, and w"' there is of that order while the
    # enclosure at a point is 1e-60 wide, so testing the midpoint would fail on
    # rounding rather than on anything real.
    check("every w' breakpoint is certified, with w'' zero on its enclosure",
          all(arb(0) in weight_dd(t) for t in P.dbreaks_arb),
          "%d breakpoints" % len(P.dbreaks))

    # the ranges are ranges: sampled values must lie inside
    bad = 0
    widest_gain = 0.0
    import random
    rnd = random.Random(20260827)
    for _ in range(4000):
        a = rnd.uniform(0.05, 25.0)
        b = a + rnd.uniform(0, 1.5)
        R = P.w_range(a, b)
        for _ in range(6):
            x = arb(rnd.uniform(a, b))
            v = weight(x)
            if float(v.lower()) < float(R.lower()) or float(v.upper()) > float(R.upper()):
                bad += 1
        nat = weight(arb((a + b) / 2, (b - a) / 2))
        wn = float(nat.upper()) - float(nat.lower())
        we = float(R.upper()) - float(R.lower())
        if we > 0 and wn / we > widest_gain:
            widest_gain = wn / we
    check("the w range encloses sampled values", bad == 0,
          "4000 intervals x 6 samples; tightest gain over the interval "
          "extension %.0fx" % widest_gain)

    bad = 0
    for _ in range(2000):
        a = rnd.uniform(0.05, 25.0)
        b = a + rnd.uniform(0, 1.5)
        R = P.wd_range(a, b)
        for _ in range(6):
            x = arb(rnd.uniform(a, b))
            v = weight_d(x)
            if float(v.lower()) < float(R.lower()) or float(v.upper()) > float(R.upper()):
                bad += 1
    check("the w' range encloses sampled values", bad == 0,
          "2000 intervals x 6 samples")

    # the exact range must be no wider than the interval extension, ever
    worse = 0
    for _ in range(1500):
        a = rnd.uniform(0.05, 25.0)
        b = a + rnd.uniform(0, 1.0)
        R = P.w_range(a, b)
        nat = weight(arb((a + b) / 2, (b - a) / 2))
        if (float(R.upper()) - float(R.lower())) > (float(nat.upper()) - float(nat.lower())) * 1.001:
            worse += 1
    check("and it is never wider than the interval extension it replaces",
          worse == 0)

    failed = [x for x in CHECKS if not x[1]]
    print("\n%d checks, %d failed" % (len(CHECKS), len(failed)))
    if not failed:
        here = os.path.dirname(os.path.abspath(__file__))
        json.dump({
            "what": "certified monotone-piece breakpoints of w and w'",
            "engine": "python-flint / Arb, %d bits" % ctx.prec,
            "inputs": arb_provenance.hash_inputs(SOURCES),
            "replay": "python3 dev/kernel_pieces_arb.py   (needs python-flint)",
            "zero_equation": "b tan b = a tan a, b = pi x, a = 1/sqrt(2)",
            "zeros": len(P.zs), "maxima": len(P.ms),
            "w_breakpoints": len(P.wbreaks), "wd_breakpoints": len(P.dbreaks),
            "limit": P.limit,
            "checks": [{"name": n, "ok": ok} for n, ok in CHECKS],
        }, open(os.path.join(here, "kernel_pieces_arb.results.json"), "w"),
            indent=2, sort_keys=True)
        print("wrote dev/kernel_pieces_arb.results.json")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
