"""Independent Arb reimplementation of the local coercivity theorem.

The JavaScript proof of this theorem rests on a home-grown interval base:
hand-written sine and cosine with hand-derived error constants, hand-derived
first and second derivatives of the weight, and a hand-written outward-rounding
convention.  Every one of those has already produced at least one unsoundness
in this directory.  A theorem whose base is that thin is not a theorem worth
quoting, however green the suite is.

This file proves the same three statements again with none of that base:

  * arithmetic is Arb (python-flint), midpoint-radius balls with proved
    enclosures, at 200 bits -- not doubles with a hand-picked epsilon;
  * sine is Arb's, with Arb's error bound -- not a Cody-Waite reduction and a
    TRIG_ERROR constant I chose;
  * the first and second derivatives of the weight come from Taylor-series
    arithmetic on the definition -- not from formulas I differentiated by hand
    and typed in.

What is deliberately shared with the JavaScript is only the mathematics: the
definition of the weight, the chain energy, and the shape of the Krawczyk and
Bloch arguments.  If the two agree, the local theorem does not depend on my
arithmetic; if they disagree, the JavaScript is wrong.

    w(x) = (K(x)/K(0))^2,  K(x) = [sinc((r-2 pi x)/2) + sinc((r+2 pi x)/2)]/2,
    r = sqrt 2,  sinc(z) = sin(z)/z

    E(L,H) = alpha (L+H)/2 + sum_{s=1..6} [ w(D_s^0) + w(D_s^1) ],  alpha = 6/3000

Run:  python3 dev/coercivity_arb.py
"""

import hashlib
import json
import os
import sys

from flint import arb, arb_series, ctx

ctx.prec = 200

LAGS = 6
ALPHA = arb(6) / 3000


# --------------------------------------------------------------- the weight
def _sinc_series(z, n):
    """sinc as a Taylor series in the perturbation, valid for z away from 0."""
    s = arb_series([z, 1], n)
    return s.sin() / s


def weight_jet(x, n=3):
    """[w(x), w'(x), w''(x), ...] as balls, by series arithmetic on w itself.

    x may be a wide ball, in which case each entry encloses the corresponding
    derivative over the whole ball -- which is what the Krawczyk and Bloch
    arguments need.  Nothing here is differentiated by hand.
    """
    r = arb(2).sqrt()
    two_pi = 2 * arb.pi()
    xs = arb_series([x, 1], n)
    left = (r - two_pi * xs) / 2
    right = (r + two_pi * xs) / 2
    # sinc of a series whose constant term is bounded away from zero
    for name, u in (("left", left), ("right", right)):
        if arb(0) in u[0]:
            raise ValueError("sinc argument (%s) straddles zero at x=%s" % (name, x))
    K = (left.sin() / left + right.sin() / right) / 2
    K0 = _sinc_series(r / 2, 1)[0]
    W = (K / K0) ** 2
    fact = arb(1)
    out = []
    for k in range(n):
        if k:
            fact *= k
        out.append(W[k] * fact)
    return out


# ------------------------------------------------------- chain at period two
def lag_distance(s, parity, L, H):
    P = L + H
    if s % 2 == 0:
        return P * (s // 2)
    return P * ((s - 1) // 2) + (L if parity == 0 else H)


def energy(L, H):
    total = (L + H) * (ALPHA / 2)
    for s in range(1, LAGS + 1):
        for parity in (0, 1):
            total += weight_jet(lag_distance(s, parity, L, H), 1)[0]
    return total


def gradient(L, H):
    """dE/dL, dE/dH.  d(D_s^p)/dL and /dH are integers, read off lag_distance."""
    dL = ALPHA / 2
    dH = ALPHA / 2
    for s in range(1, LAGS + 1):
        for parity in (0, 1):
            d = lag_distance(s, parity, L, H)
            wp = weight_jet(d, 2)[1]
            if s % 2 == 0:
                cL = cH = s // 2
            else:
                half = (s - 1) // 2
                cL = half + (1 if parity == 0 else 0)
                cH = half + (0 if parity == 0 else 1)
            dL += wp * cL
            dH += wp * cH
    return dL, dH


def jacobian(L, H):
    LL = arb(0)
    LH = arb(0)
    HH = arb(0)
    for s in range(1, LAGS + 1):
        for parity in (0, 1):
            d = lag_distance(s, parity, L, H)
            wpp = weight_jet(d, 3)[2]
            if s % 2 == 0:
                cL = cH = s // 2
            else:
                half = (s - 1) // 2
                cL = half + (1 if parity == 0 else 0)
                cH = half + (0 if parity == 0 else 1)
            LL += wpp * cL * cL
            HH += wpp * cH * cH
            LH += wpp * cL * cH
    return [[LL, LH], [LH, HH]]


# ------------------------------------------------------------------ Krawczyk
def ball(lo, hi):
    mid = (arb(lo) + arb(hi)) / 2
    rad = (arb(hi) - arb(lo)) / 2
    return arb(mid, rad) if rad > 0 else mid


def strictly_inside(k, x):
    return (arb(k.lower()) > arb(x.lower())) and (arb(k.upper()) < arb(x.upper()))


def krawczyk(L, H):
    mL = arb(L.mid())
    mH = arb(H.mid())
    FmL, FmH = gradient(mL, mH)
    Jm = jacobian(mL, mH)
    a, b, d = Jm[0][0], Jm[0][1], Jm[1][1]
    det = a * d - b * b
    if arb(0) in det:
        return {"proved": False, "reason": "Jacobian determinant not certainly nonzero"}
    # C is an approximate inverse; it need not be exact, only invertible-ish.
    C = [[arb(( d / det).mid()), arb((-b / det).mid())],
         [arb((-b / det).mid()), arb(( a / det).mid())]]
    J = jacobian(L, H)
    E = [[None, None], [None, None]]
    for i in range(2):
        for j in range(2):
            acc = arb(1 if i == j else 0)
            for k in range(2):
                acc -= C[i][k] * J[k][j]
            E[i][j] = acc
    rL = L - mL
    rH = H - mH
    CF = [C[0][0] * FmL + C[0][1] * FmH,
          C[1][0] * FmL + C[1][1] * FmH]
    KL = mL - CF[0] + E[0][0] * rL + E[0][1] * rH
    KH = mH - CF[1] + E[1][0] * rL + E[1][1] * rH
    return {"proved": strictly_inside(KL, L) and strictly_inside(KH, H),
            "K": (KL, KH)}


def refine(L, H, steps=12):
    best = (L, H, False)
    for _ in range(steps):
        r = krawczyk(L, H)
        if not r["proved"]:
            break
        KL, KH = r["K"]
        # Intersect in Arb.  Rounding the endpoints to doubles here would
        # throw away exactly the precision this file exists to supply, and
        # would silently cap the enclosure at the double grid.
        nL = L.intersection(KL)
        nH = H.intersection(KH)
        shrank = (nL.rad() < L.rad()) or (nH.rad() < H.rad())
        L, H = nL, nH
        best = (L, H, True)
        if not shrank:
            break
    return best


# ------------------------------------------------------------ Bloch symbol
def hessian_entry(a, b, L, H):
    """Hhat_{ab} = 2 sum_{s=|a-b|+1}^{6} sum_{i=max-s+1}^{min} w''(D_{i,s})."""
    acc = arb(0)
    lo, hi = min(a, b), max(a, b)
    for s in range(abs(a - b) + 1, LAGS + 1):
        for i in range(hi - s + 1, lo + 1):
            parity = i % 2
            acc += weight_jet(lag_distance(s, parity, L, H), 3)[2]
    return acc * 2


def smallest_eigenvalue_lower(qL, qH, L, H):
    q = ball(qL, qH)
    re = [[arb(0), arb(0)], [arb(0), arb(0)]]
    im = [[arb(0), arb(0)], [arb(0), arb(0)]]
    for alpha in range(2):
        for beta in range(2):
            for cell in range(-4, 5):
                e = hessian_entry(alpha, 2 * cell + beta, L, H)
                if e.is_zero():
                    continue
                theta = q * cell
                re[alpha][beta] += e * theta.cos()
                im[alpha][beta] -= e * theta.sin()
    a, d = re[0][0], re[1][1]
    off2 = re[0][1] ** 2 + im[0][1] ** 2
    disc = (((a - d) / 2) ** 2 + off2).sqrt()
    return (a + d) / 2 - disc


def certify_gap(L, H, target, min_width=1e-9, budget=200000):
    pi = arb.pi()
    stack = [(0.0, float(pi.upper()))]
    processed = 0
    worst = None
    worst_at = None
    while stack:
        if processed >= budget:
            return {"complete": False, "reason": "budget", "processed": processed}
        qL, qH = stack.pop()
        processed += 1
        low = smallest_eigenvalue_lower(qL, qH, L, H)
        if arb(low.lower()) >= arb(target):
            continue
        v = float(low.lower())
        if worst is None or v < worst:
            worst, worst_at = v, (qL, qH)
        if qH - qL <= min_width:
            return {"complete": False, "reason": "stalled", "at": (qL, qH),
                    "lower": v, "processed": processed}
        mid = (qL + qH) / 2
        stack.append((qL, mid))
        stack.append((mid, qH))
    return {"complete": True, "processed": processed, "target": target}


def certify_minimiser_window(L, H, w_lo, w_hi, upper, min_width=1e-11,
                             budget=200000):
    """Certify that the eigenvalue exceeds `upper` outside [w_lo, w_hi]*pi."""
    pil = float(arb.pi().upper())
    stack = [(0.0, w_lo * pil), (w_hi * pil, pil)]
    processed = 0
    while stack:
        a, b = stack.pop()
        processed += 1
        if processed > budget:
            return {"complete": False, "reason": "budget", "processed": processed}
        low = smallest_eigenvalue_lower(a, b, L, H)
        if arb(low.lower()) > arb(upper):
            continue
        if b - a <= min_width:
            return {"complete": False, "reason": "stalled",
                    "at": (a / pil, b / pil), "processed": processed}
        m = (a + b) / 2
        stack.append((a, m))
        stack.append((m, b))
    return {"complete": True, "processed": processed}


# ------------------------------------------------- a radius for the theorem
# A spectral gap AT the alternating state says the energy is convex there and
# nothing about how far that persists.  "Strict local minimum" with no radius is
# a statement no global argument can use.  The radius is a finite computation.
#
# For g in the ell-infinity tube of radius r about the alternating state, every
# distance D_{i,s} lies within s*r of its crystal value, so the interval Hessian
# over the tube is a finite object.  Write H(g) = M + Delta with M the crystal
# Hessian.  Delta is symmetric and banded with range five, so
#
#   ||Delta||_2 <= ||Delta||_inf = max_a sum_b |Delta_ab|,
#
# and the bound is attained by the majorant (all entries positive, symbol
# maximal at q = 0), so nothing is lost by using it.  Hence
#
#   lambda_min(H(g)) >= lambda - drift(r)   for every g in the tube,
#
# and by Taylor with integral remainder along the segment -- which stays in the
# tube, the tube being convex --
#
#   E(g_alt + u) - E_alt >= (lambda - drift(r))/2 * ||u||_2^2   for ||u||_inf <= r.
def hessian_entry_tube(a, b, L, H, r):
    """H_ab over the ell-infinity tube of radius r, off the two-periodic slice."""
    acc = arb(0)
    lo, hi = min(a, b), max(a, b)
    for s in range(abs(a - b) + 1, LAGS + 1):
        for i in range(hi - s + 1, lo + 1):
            d = lag_distance(s, i % 2, L, H)
            acc += weight_jet(arb(d.mid(), float(d.rad()) + s * r), 3)[2]
    return acc * 2


def hessian_drift(L, H, r):
    """max_a sum_b |H_ab(g) - H_ab(g_alt)| over the tube.  Two parities suffice."""
    worst = arb(0)
    for a in (0, 1):
        total = arb(0)
        for b in range(a - 5, a + 6):
            wide = hessian_entry_tube(a, b, L, H, r)
            point = hessian_entry_tube(a, b, L, H, 0.0)
            total += (arb(wide.rad()) + arb(point.rad())
                      + abs(arb(wide.mid()) - arb(point.mid())))
        if total > worst:
            worst = total
    return worst


def growth_constant(L, H, r, gap=None):
    """Certified c with E(g_alt+u) - E_alt >= (c/2) ||u||_2^2 for ||u||_inf <= r."""
    return arb(SHARP_TARGET if gap is None else gap) - hessian_drift(L, H, r)


def certified_radius(L, H, lo=0.0, hi=0.05, steps=40):
    for _ in range(steps):
        m = (lo + hi) / 2
        if growth_constant(L, H, m) > 0:
            lo = m
        else:
            hi = m
    return lo


# ---------------------------------------------------------------- the checks
SHARP_TARGET = 1.6612
NUMERICAL_MIN = 1.66128101824067719861
NUMERICAL_ARGMIN = 0.929045114103617
WINDOW = (0.925, 0.933)
RADII = (0.001, 0.003, 0.005, 0.006)

CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, ok, detail))
    print("%-4s %s%s" % ("ok" if ok else "FAIL", name, ("  -- " + detail) if detail else ""))


def fmt(x):
    """Print enough digits that an Arb enclosure narrower than a double is visible."""
    return "%s (radius %.3g)" % (x.str(30, radius=False), float(x.rad()))


def main():
    # The JavaScript answers, quoted so a divergence is loud.
    JS_L = (1.0416801034484717, 1.0416801034485021)
    JS_H = (1.9794672314032040, 1.9794672314032447)
    JS_E = (0.003957393309106188, 0.003957393309112507)
    JS_CEILING = 0.003957393309209766

    print("Arb, %d bits.  Independent of tiling_rigorous.js.\n" % ctx.prec)

    L0 = ball(1.0416801034484717 - 1e-6, 1.0416801034484717 + 1e-6)
    H0 = ball(1.9794672314032040 - 1e-6, 1.9794672314032040 + 1e-6)

    r = krawczyk(L0, H0)
    check("a unique critical point exists in the 1e-6 box", r["proved"])

    for hw in (1e-5, 1e-4, 1e-3):
        L = ball(1.0416801034484717 - hw, 1.0416801034484717 + hw)
        H = ball(1.9794672314032040 - hw, 1.9794672314032040 + hw)
        check("existence and uniqueness at halfwidth %g" % hw, krawczyk(L, H)["proved"])

    L, H, proved = refine(L0, H0)
    check("the enclosure refines", proved,
          "L in %s (width %.3g)\n         H in %s (width %.3g)"
          % (fmt(L), float(L.upper()) - float(L.lower()),
             fmt(H), float(H.upper()) - float(H.lower())))

    # Agreement with the JavaScript, which is the whole point of this file.
    agreeL = float(L.lower()) <= JS_L[1] and float(L.upper()) >= JS_L[0]
    agreeH = float(H.lower()) <= JS_H[1] and float(H.upper()) >= JS_H[0]
    check("Arb and the JavaScript enclose the same L", agreeL,
          "js %s" % ("[%.17g, %.17g]" % JS_L))
    check("Arb and the JavaScript enclose the same H", agreeH,
          "js %s" % ("[%.17g, %.17g]" % JS_H))

    # The strong direction: the double-precision interval the page quotes must
    # CONTAIN the true value.  Arb pins that value far below the double grid, so
    # this is a real test of the JavaScript, not a restatement of it.
    check("the quoted L interval contains the true L",
          arb(JS_L[0]) < L and L < arb(JS_L[1]),
          "true L is %.3g into a %.3g-wide interval"
          % (float(L.mid()) - JS_L[0], JS_L[1] - JS_L[0]))
    check("the quoted H interval contains the true H",
          arb(JS_H[0]) < H and H < arb(JS_H[1]),
          "true H is %.3g into a %.3g-wide interval"
          % (float(H.mid()) - JS_H[0], JS_H[1] - JS_H[0]))
    check("Arb resolves the critical point far below the double grid",
          float(L.rad()) < 1e-25 and float(H.rad()) < 1e-25,
          "radii %.3g and %.3g" % (float(L.rad()), float(H.rad())))

    E = energy(L, H)
    check("the energy at the critical point is enclosed", True, fmt(E))
    check("Arb agrees with the JavaScript energy enclosure",
          float(E.lower()) <= JS_E[1] and float(E.upper()) >= JS_E[0],
          "js [%.17g, %.17g]" % JS_E)
    check("the quoted energy interval contains the true energy",
          arb(JS_E[0]) < E and E < arb(JS_E[1]))
    check("the ceiling quoted elsewhere is strictly above the true energy",
          arb(JS_CEILING) > E,
          "high by %.4g, which is the cost of the six-decimal rounding"
          % (JS_CEILING - float(E.mid())))

    g = certify_gap(L, H, 1.6)
    check("the Bloch gap is at least 1.6 at the certified point", g["complete"],
          "%d momentum intervals" % g["processed"])

    Lb = ball(1.0416801034484717 - 1e-4, 1.0416801034484717 + 1e-4)
    Hb = ball(1.9794672314032040 - 1e-4, 1.9794672314032040 + 1e-4)
    gb = certify_gap(Lb, Hb, 1.6)
    check("the gap holds over the whole halfwidth-1e-4 box", gb["complete"],
          "%d momentum intervals" % gb["processed"])

    # How sharp is 1.6?  Not very: the true minimum is near 1.66128101824, and
    # bisection certifies most of the way there before the first-order slack in
    # the interval evaluation starts costing exponentially many subdivisions.
    sharp = certify_gap(L, H, SHARP_TARGET, min_width=1e-11, budget=40000)
    check("the gap is in fact at least %g" % SHARP_TARGET, sharp["complete"],
          "%d momentum intervals; numerically the minimum is %.12f"
          % (sharp["processed"], NUMERICAL_MIN))

    # The minimising momentum.  A gap certificate proves a lower bound and says
    # nothing about where the minimum sits, which is why q/pi = 0.929 was
    # withdrawn as a certified claim.  It can be certified, by a different
    # argument: one point evaluation bounds the minimum from ABOVE, and the
    # eigenvalue is then certified to exceed that bound everywhere outside a
    # window.  Whatever is left inside the window contains the minimiser.
    qstar = float(arb.pi().upper()) * NUMERICAL_ARGMIN
    upper = float(smallest_eigenvalue_lower(qstar, qstar, L, H).upper())
    window = certify_minimiser_window(L, H, WINDOW[0], WINDOW[1], upper)
    check("the minimising momentum lies in q/pi in [%g, %g]" % WINDOW,
          window["complete"],
          "%d momentum intervals; the point bound is %.12f, numerically the "
          "minimiser is at q/pi = %.12f" % (window["processed"], upper,
                                            NUMERICAL_ARGMIN))

    # The radius.  Until now this file said "strict local minimum" and admitted
    # in the same breath that it had no radius, which is a statement no global
    # argument can use.
    radius = certified_radius(L, H)
    check("the local theorem has a certified radius", radius > 0.006,
          "r* = %.8f in the sup norm" % radius)
    quoted = []
    for r in RADII:
        c = growth_constant(L, H, r)
        quoted.append((r, float(c.lower())))
        check("quadratic growth at radius %g" % r, c > 0,
              "E(g_alt+u) - E_alt >= %.6f ||u||_2^2 for ||u||_inf <= %g"
              % (float(c.lower()) / 2, r))
    check("the drift bound degrades monotonically, so r* is where it says",
          all(quoted[i][1] > quoted[i + 1][1] for i in range(len(quoted) - 1)))

    bad = [c for c in CHECKS if not c[1]]
    print("\n%d checks, %d failed" % (len(CHECKS), len(bad)))

    if not bad:
        write_transcript(L, H, E, g, gb, sharp, window, upper, radius, quoted)
    return 1 if bad else 0


def write_transcript(L, H, E, g, gb, sharp, window, upper, radius, quoted):
    """Record what ran, hashed to this source.

    Nothing in this directory should quote a computed number that cannot be
    traced to the code that produced it.  The suite checks this hash even on a
    machine with no Arb, so a stale transcript is loud rather than silent -- but
    a matching hash is not a rerun, and the suite says so.
    """
    here = os.path.dirname(os.path.abspath(__file__))
    src = open(os.path.abspath(__file__), "rb").read()
    payload = {
        "what": "independent Arb certification of the local coercivity theorem",
        "engine": "python-flint / Arb, %d bits" % ctx.prec,
        "source_sha256": hashlib.sha256(src).hexdigest(),
        "replay": "python3 dev/coercivity_arb.py   (needs python-flint)",
        "critical_point": {
            "L": L.str(30, radius=False), "L_radius": "%.3g" % float(L.rad()),
            "H": H.str(30, radius=False), "H_radius": "%.3g" % float(H.rad()),
        },
        "energy": {"value": E.str(30, radius=False),
                   "radius": "%.3g" % float(E.rad())},
        "gap": {"certified": 1.6, "intervals": g["processed"],
                "certified_over_1e-4_box": 1.6, "intervals_box": gb["processed"],
                "sharp_certified": SHARP_TARGET,
                "intervals_sharp": sharp["processed"],
                "numerical_minimum": NUMERICAL_MIN},
        "minimiser": {"window_over_pi": list(WINDOW),
                      "intervals": window["processed"],
                      "point_upper_bound": upper,
                      "numerical_argmin_over_pi": NUMERICAL_ARGMIN},
        "quadratic_growth": {"certified_radius_sup_norm": radius,
                             "constant_at_radius":
                                 {str(r): c for r, c in quoted}},
        "checks": [{"name": n, "ok": ok} for n, ok, _ in CHECKS],
    }
    out = os.path.join(here, "coercivity_arb.results.json")
    with open(out, "w") as fh:
        json.dump(payload, fh, indent=2, sort_keys=True)
        fh.write("\n")
    print("wrote %s" % os.path.relpath(out, os.path.dirname(here)))


if __name__ == "__main__":
    sys.exit(main())
