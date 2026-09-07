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

Two things a review (COMMIT_REVIEW_69d3f99) found wanting, both repaired here.
The hull of the endpoint and breakpoint values used to be taken through Python
floats -- `float(v.lower())` rounds to NEAREST, so a range could exclude the
exact value by an ulp; the reported point w(0.5) sat 1.9e-17 ABOVE the true
one.  Hulls are now formed from the exact endpoints of the balls, and the
breakpoints enter as their certified balls, not their float midpoints.  And the
"exact range" argument needs every critical point to be in the table, which the
sign scan that finds the roots of w'' did not establish.  `coverage` now proves
it: the gaps between consecutive certified balls are shown zero-free by
interval bisection, and the piece touching a ball by strict monotonicity of the
function across the hull of ball and piece (its derivative excludes zero there,
so the ball's one certified zero is the only one).  A Pieces object refuses to
construct if either coverage proof fails.
"""

import bisect
import json
import math
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


def _sd(z):
    """sinc'(z) = (z cos z - sin z)/z^2, with the alternating series where the ball
    contains 0: -z/3 + z^3/30 - z^5/840 + ..., remainder bounded by the first
    omitted term (terms decrease for |z| < 6)."""
    if arb(0) in z:
        m = max(abs(float(z.lower())), abs(float(z.upper())))
        if m >= 4:
            raise ValueError("series branch of sinc' needs a small ball")
        return (-z / 3 + z ** 3 / 30 - z ** 5 / 840) + arb(0, m ** 7 / 45360)
    return (z * z.cos() - z.sin()) / (z * z)


def _sd2(z):
    """sinc''(z) = (2 sin z - 2 z cos z - z^2 sin z)/z^3; series near 0:
    -1/3 + z^2/10 - z^4/168 + z^6/6480 - z^8/443520 + ..."""
    if arb(0) in z:
        m = max(abs(float(z.lower())), abs(float(z.upper())))
        if m >= 4:
            raise ValueError("series branch of sinc'' needs a small ball")
        return ((-arb(1) / 3 + z ** 2 / 10 - z ** 4 / 168 + z ** 6 / 6480)
                + arb(0, m ** 8 / 443520))
    return (2 * z.sin() - 2 * z * z.cos() - z * z * z.sin()) / (z * z * z)


def _sinc_parts(x):
    _init()
    r = arb(2).sqrt()
    tp = 2 * arb.pi()
    zl = (r - tp * x) / 2
    zr = (r + tp * x) / 2
    return zl, zr


def weight_d(x):
    """w' = 2 K K' / K0^2 through the sinc form, enclosed at every x."""
    zl, zr = _sinc_parts(x)
    k = (zl.sinc() + zr.sinc()) / 2
    kp = arb.pi() * (_sd(zr) - _sd(zl)) / 2
    return 2 * k * kp / (K0 * K0)


def weight_dd(x):
    """w'' = 2 (K'^2 + K K'') / K0^2 through the sinc form -- defined and enclosed
    at every x, the removable singularity of the closed form included.  The jet
    version (`weight_dd_jet`) is kept for the Newton certification, which only
    ever runs at x >= 1.05."""
    zl, zr = _sinc_parts(x)
    k = (zl.sinc() + zr.sinc()) / 2
    kp = arb.pi() * (_sd(zr) - _sd(zl)) / 2
    kpp = arb.pi() ** 2 * (_sd2(zr) + _sd2(zl)) / 2
    return 2 * (kp * kp + k * kpp) / (K0 * K0)


def weight_ddd(x):
    return weight_jet(x, 4)[3]


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


def weight_dd_jet(x):
    return weight_jet(x, 3)[2]


def ball(lo, hi):
    """The interval [lo, hi] (exact arbs, lo <= hi) as a ball that contains it: the
    rounded midpoint keeps its own radius, and the half-width is rounded up."""
    m = (lo + hi) / 2
    r = (hi - lo) / 2
    return m + arb(0, float(r.upper()) * (1 + 1e-12) + 1e-300)


def hull(vals):
    """The hull of balls from their EXACT endpoints (arb.lower()/upper() are exact
    arbs and compare exactly).  No float conversion anywhere, so the result
    contains every point of every input -- the property the float version lacked."""
    if not vals:
        raise ValueError("hull of no balls")
    lo = hi = None
    for v in vals:
        a, b = v.lower(), v.upper()
        if lo is None or a < lo:
            lo = a
        if hi is None or b > hi:
            hi = b
    return ball(lo, hi)


def _split_point(lo, hi):
    m = arb(((lo + hi) / 2).mid())
    return m if (lo < m and m < hi) else None


def _no_zero(h, lo, hi, depth=0, max_depth=60):
    """h has no zero on [lo, hi]: its enclosure excludes 0, or both halves do."""
    try:
        if arb(0) not in h(ball(lo, hi)):
            return True
    except (ValueError, ZeroDivisionError):
        pass
    if depth >= max_depth:
        return False
    m = _split_point(lo, hi)
    if m is None:
        return False
    return (_no_zero(h, lo, m, depth + 1, max_depth)
            and _no_zero(h, m, hi, depth + 1, max_depth))


def _clear_beside(h, hp, X, lo, hi, left, depth=0, max_depth=60):
    """[lo, hi] touches the root ball X (X on the left if `left`).  It is zero-free
    if h' excludes 0 on hull(X, [lo, hi]): h is then strictly monotone across the
    hull, X holds one zero of h by its certification, and that zero is the only
    one.  Failing that, the half away from X is tried as an ordinary piece and the
    half touching X recurses."""
    H = hull([X, ball(lo, hi)])
    try:
        if arb(0) not in hp(H):
            return True
    except (ValueError, ZeroDivisionError):
        pass
    if depth >= max_depth:
        return False
    m = _split_point(lo, hi)
    if m is None:
        return False
    if left:
        return (_no_zero(h, m, hi)
                and _clear_beside(h, hp, X, lo, m, left, depth + 1, max_depth))
    return (_no_zero(h, lo, m)
            and _clear_beside(h, hp, X, m, hi, left, depth + 1, max_depth))


def coverage(h, hp, balls, limit):
    """Prove that every zero of h in [0, limit] lies in one of `balls`, each a
    certified enclosure of exactly one zero of h.  The balls must be disjoint and
    sorted; a gap between consecutive balls is split in three, the outer thirds
    handled by `_clear_beside` and the middle by `_no_zero`.  Returns None when the
    proof succeeds, else a description of the gap that failed."""
    limit = arb(limit)
    cur, curX = arb(0), None
    for X in balls:
        a, b = X.lower(), X.upper()
        if not (a > cur) and curX is not None:
            return "balls overlap or are unsorted at %s" % X.str(8)
        if a > cur:
            hi = a if a <= limit else limit
            if not _gap(h, hp, curX, cur, X if a <= limit else None, hi):
                return "zero-freeness not established on [%s, %s]" % (cur.str(8), hi.str(8))
        if a > limit:
            return None
        cur, curX = b, X
    if cur < limit:
        if not _gap(h, hp, curX, cur, None, limit):
            return "zero-freeness not established on [%s, %s]" % (cur.str(8), limit.str(8))
    return None


def _gap(h, hp, Xl, lo, Xr, hi):
    if not (lo < hi):
        return True
    t1 = _split_point(lo, hi)
    if t1 is None:
        return False
    # thirds: [lo, p], [p, q], [q, hi]
    p = arb((lo + (hi - lo) / 3).mid())
    q = arb((lo + 2 * (hi - lo) / 3).mid())
    if not (lo < p < q < hi):
        p = q = t1
    ok = True
    if Xl is not None:
        ok = ok and _clear_beside(h, hp, Xl, lo, p, True)
    else:
        ok = ok and _no_zero(h, lo, p)
    if p < q:
        ok = ok and _no_zero(h, p, q)
    if Xr is not None:
        ok = ok and _clear_beside(h, hp, Xr, q, hi, False)
    else:
        ok = ok and _no_zero(h, q, hi)
    return ok


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


_PIECES = {}


def pieces(limit=30.0):
    """One Pieces per limit per process: the coverage proofs take seconds and every
    checker run, control included, would otherwise repeat them."""
    if limit not in _PIECES:
        _PIECES[limit] = Pieces(limit)
    return _PIECES[limit]


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
        db = [t for t in wd_breaks(self.zs, self.ms) if t is not None]
        self.dbreaks_arb = sorted(db, key=lambda t: float(t.mid()))
        self.dbreaks = [float(t.mid()) for t in self.dbreaks_arb if float(t.mid()) <= limit]
        # The certified balls the ranges use: the zeros of w' (0 itself, since w is
        # even, then the zeros and maxima of K) and the zeros of w''.  Both lists are
        # proved complete on [0, limit] before any range is served.
        self.w_roots = sorted([arb(0)] + list(self.zs) + list(self.ms),
                              key=lambda t: float(t.mid()))
        self.w_coverage = coverage(weight_d, weight_dd, self.w_roots, limit)
        if self.w_coverage is not None:
            raise RuntimeError("monotone pieces of w not proved complete: " + self.w_coverage)
        self.wd_coverage = coverage(weight_dd, weight_ddd, self.dbreaks_arb, limit)
        if self.wd_coverage is not None:
            raise RuntimeError("monotone pieces of w' not proved complete: " + self.wd_coverage)
        # The value of f over each certified ball is a constant: evaluate it once.  The
        # lookup uses outward-rounded float bounds of the balls, so the set of balls
        # taken for an interval is a SUPERSET of those that meet it exactly -- a range
        # can only widen by that, never narrow.  This cut the cost of a box by 3x.
        self._w_tab = self._table(weight, self.w_roots)
        self._wd_tab = self._table(weight_d, self.dbreaks_arb)

    @staticmethod
    def _table(f, breaks):
        los = [math.nextafter(float(t.lower()), -math.inf) for t in breaks]
        his = [math.nextafter(float(t.upper()), math.inf) for t in breaks]
        assert los == sorted(los) and his == sorted(his)   # disjoint, sorted balls
        return los, his, [f(t) for t in breaks]

    @staticmethod
    def _hull(vals):
        return hull(vals)

    def _range(self, f, tab, a, b):
        """The range of f over [a, b], a <= b floats, f monotone between consecutive
        certified balls around its critical points: the hull of the endpoint values
        and of f over every ball that meets (a, b).  A ball that straddles an endpoint
        is included whole; that can only widen the result."""
        if not (0 <= a <= b <= self.limit):
            raise ValueError("range outside the certified table [0, %g]: [%r, %r]" % (self.limit, a, b))
        los, his, vals = tab
        i0 = bisect.bisect_right(his, a)      # balls with his > a ...
        i1 = bisect.bisect_left(los, b)       # ... and los < b
        return hull([f(arb(a)), f(arb(b))] + vals[i0:i1])

    def w_range(self, a, b):
        return self._range(weight, self._w_tab, a, b)

    def wd_range(self, a, b):
        return self._range(weight_d, self._wd_tab, a, b)


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
    # Completeness, which the sign scan does not give: the gaps between consecutive
    # certified balls are proved zero-free, so the tables hold EVERY critical point
    # and the hull over endpoints and table entries is the exact range.
    check("every zero of w' in [0, 30] lies in a certified ball, so the monotone "
          "pieces of w are complete", P.w_coverage is None,
          "%d balls" % len([t for t in P.w_roots if float(t.mid()) <= P.limit]))
    check("every zero of w'' in [0, 30] lies in a certified ball, so the monotone "
          "pieces of w' are complete", P.wd_coverage is None,
          "%d balls" % len(P.dbreaks))
    # A review found w_range(0.5, 0.5) sitting 1.9e-17 ABOVE the direct evaluation:
    # the hull went through nearest-rounded floats.  The direct evaluation is now
    # contained, as a ball, in the point range.
    pts = [0.5, 1.0, 1.85, 2.5, 7.25, 12.0, 29.5]
    check("a point range contains the direct Arb evaluation there, as a ball",
          all(weight(arb(x)) in P.w_range(x, x) and weight_d(arb(x)) in P.wd_range(x, x)
              for x in pts), "%d points" % len(pts))
    check("and the sinc form of w'' agrees with the series-jet form away from the "
          "singularity", all(weight_dd(arb(x)).overlaps(weight_dd_jet(arb(x)))
                             for x in (0.05, 1.3, 4.7, 21.2)))

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
            "coverage_proved": "every zero of w' and of w'' on [0, limit] lies in a "
                               "certified ball; gaps proved zero-free by interval bisection",
            # The certified positions themselves, so a consumer without Arb can
            # check its own breakpoints against them.  Each w' breakpoint also
            # carries a certified bound on |w'''| over a 1e-6 neighbourhood: at a
            # stationary point w'' vanishes, so displacing the breakpoint by d
            # costs at most w3/2 * d^2 of w' value, and that is the shortfall a
            # tabulated derivative range has to be widened to cover.
            "w_break_points": [{"mid": float(t.mid()), "rad": float(t.rad())}
                               for t in P.zs + P.ms if float(t.mid()) <= P.limit],
            "wd_break_points": [
                {"mid": float(t.mid()), "rad": float(t.rad()),
                 "w3": float(abs(weight_jet(arb(float(t.mid()), 1e-6), 4)[3]).upper())}
                for t in P.dbreaks_arb],
            "limit": P.limit,
            "checks": [{"name": n, "ok": ok} for n, ok in CHECKS],
        }, open(os.path.join(here, "kernel_pieces_arb.results.json"), "w"),
            indent=2, sort_keys=True)
        print("wrote dev/kernel_pieces_arb.results.json")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
