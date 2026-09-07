//! tapecheck -- a compiled interval checker for the sweep's proof tapes.
//!
//! The same job as dev/sweep_proof_arb.py, in Rust with `inari` (an IEEE 1788
//! interval library with correctly rounded operations) instead of Python with
//! Arb balls.  The Python checker resolves every obligation it is given but at
//! two to three milliseconds each, which is thirty CPU-hours for the 48 million
//! obligations of the full `sharp` tape; the owner does not have a supercomputer.
//! This one does the same arithmetic in double-precision intervals, hundreds of
//! times faster, and subdivides (verified) what the coarser precision cannot
//! resolve at depth zero.
//!
//! What is trusted, and from where.
//!   * Rounding: `inari`, not this file.
//!   * Sine and cosine: argument reduction with the library's enclosure of pi,
//!     Taylor polynomials with the explicit Lagrange remainder |r|^(2N+1)/(2N+1)!
//!     at the endpoints, and the range over an interval as the hull of the
//!     endpoint values and of +-1 wherever a critical point pi/2 + n pi lies
//!     inside.  No hand-chosen error constants anywhere.
//!   * The monotone-piece breakpoints of w and w' (where the exact ranges come
//!     from): CONSUMED AS DATA from dev/kernel_pieces_arb.results.json, which
//!     certifies each by an interval Newton test in Arb and proves the table
//!     complete by interval bisection between consecutive balls.  This file
//!     re-checks every entry (w' or w'' vanishes on its ball, in these intervals)
//!     but takes completeness from that transcript, and hashes it as an input.
//!   * The tube exclusion of the pair tapes: bound to dev/tube_arb.results.json
//!     exactly as the Python checker binds it.
//!
//! Usage:
//!   cargo run --release -- --meta=sweep_proof_sharp_small.json [--refine=D]
//!       [--roots=a:b] [--threads=T] [--out=results.json] [--dump-unresolved=f.jsonl]
//! paths are relative to dev/ (the directory above this crate).

use inari::{interval, Interval};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::Instant;

type I = Interval;

const NPTS: usize = 7;
const SIGN_A: [i32; 6] = [1, 0, -1, -1, 0, 1];
const SIGN_B: [i32; 6] = [0, 1, -1, -1, 1, 0];
const LOW: f64 = 1.0416801034484870;
const HIGH: f64 = 1.9794672314032244;
const OP_LO: u8 = 0x08;
const OP_HI: u8 = 0x10;
const LEAF_BOUND: u8 = 0x20;
const LEAF_TUBE: u8 = 0x21;
const LEAF_OPEN: u8 = 0x22;
/// E_alt = 0.003957393309109343844588308250635018628261217786065732772034 (dev/tube_arb.py),
/// bracketed by two consecutive doubles.
const E_ALT_LO: f64 = 0.003957393309109343;
const E_ALT_HI: f64 = 0.003957393309109344;

// ---------------------------------------------------------------- intervals

fn pt(x: f64) -> I {
    interval!(x, x).expect("finite point")
}
fn iv(a: f64, b: f64) -> I {
    interval!(a, b).expect("ordered finite bounds")
}
fn hull(vals: &[I]) -> I {
    let mut h = vals[0];
    for v in &vals[1..] {
        h = h.convex_hull(*v);
    }
    h
}
fn two_pi() -> I {
    Interval::PI * pt(2.0)
}

/// (sin t, cos t) at a point t.  Reduce t = q (pi/2) + r with |r| <= pi/4 plus the width
/// of q times the library's enclosure of pi/2; Taylor polynomials with the Lagrange
/// remainder |r|^(2N+1)/(2N+1)! and |r|^(2N)/(2N)!, everything in intervals; then the
/// quadrant swap.  19! and 18! are exactly representable doubles.
fn sincos_at_slow(t: f64) -> (I, I) {
    let q = (t / std::f64::consts::FRAC_PI_2).round();
    let r = pt(t) - pt(q) * (Interval::PI * pt(0.5));
    let m = r.abs().sup();
    if m > 0.8 {
        return (iv(-1.0, 1.0), iv(-1.0, 1.0));
    }
    const SIN_D: [f64; 9] = [0.0, 6.0, 20.0, 42.0, 72.0, 110.0, 156.0, 210.0, 272.0]; // (2n)(2n+1)
    const COS_D: [f64; 9] = [0.0, 2.0, 12.0, 30.0, 56.0, 90.0, 132.0, 182.0, 240.0]; // (2n-1)(2n)
    let r2 = r.sqr();
    let one = pt(1.0);
    let mut sacc = one;
    let mut cacc = one;
    for n in (1..9).rev() {
        sacc = one - r2 * sacc / pt(SIN_D[n]);
        cacc = one - r2 * cacc / pt(COS_D[n]);
    }
    let rem_s = m.powi(19) / 121645100408832000.0 * (1.0 + 1e-13) + 1e-300;
    let rem_c = m.powi(18) / 6402373705728000.0 * (1.0 + 1e-13) + 1e-300;
    let s = (r * sacc + iv(-rem_s, rem_s)).intersection(iv(-1.0, 1.0));
    let c = (cacc + iv(-rem_c, rem_c)).intersection(iv(-1.0, 1.0));
    match (q as i64).rem_euclid(4) {
        0 => (s, c),
        1 => (c, -s),
        2 => (-s, -c),
        _ => (-c, s),
    }
}
/// (sin t, cos t) at a point t, fast: the same reduction in intervals, then the Taylor
/// polynomials evaluated by Horner in plain f64 at the midpoint m of the reduced
/// argument, enclosed by three explicit terms --
///   * the rounding error of Horner: Higham, Accuracy and Stability of Numerical
///     Algorithms, Thm 5.1: |fl(p(x)) - p(x)| <= gamma_{2n} * p~(|x|), with p~ the
///     polynomial of absolute coefficients (here <= cosh(0.8) = 1.34 for the cosine
///     series and <= sinh(0.8)/0.8 = 1.11 for the sine's), n = 9 coefficients, and
///     gamma_18 = 18u/(1-18u) = 2.0e-15 at u = 2^-53, coefficient rounding included
///     by taking gamma_19; the bound used is 4e-15, twice the worst case;
///   * the Lagrange remainder of the truncated series at |m| + rad;
///   * the width of the reduced argument, since |sin'|, |cos'| <= 1.
/// The pure-interval version above is kept as the oracle: at start-up the two are
/// compared at hundreds of thousands of points and must overlap, and both must
/// contain libm's value.
fn sincos_at(t: f64) -> (I, I) {
    let q = (t / std::f64::consts::FRAC_PI_2).round();
    let r = pt(t) - pt(q) * (Interval::PI * pt(0.5));
    let m = r.mid();
    let rad = (r.sup() - r.inf()) * 0.5 * (1.0 + 1e-15) + 1e-300;
    let mm = m.abs() + rad;
    if mm > 0.8 {
        return (iv(-1.0, 1.0), iv(-1.0, 1.0));
    }
    const SIN_D: [f64; 9] = [0.0, 6.0, 20.0, 42.0, 72.0, 110.0, 156.0, 210.0, 272.0];
    const COS_D: [f64; 9] = [0.0, 2.0, 12.0, 30.0, 56.0, 90.0, 132.0, 182.0, 240.0];
    let x2 = m * m;
    let mut sacc = 1.0f64;
    let mut cacc = 1.0f64;
    for n in (1..9).rev() {
        sacc = 1.0 - x2 * sacc / SIN_D[n];
        cacc = 1.0 - x2 * cacc / COS_D[n];
    }
    let sv = m * sacc;
    let cv = cacc;
    const HORNER: f64 = 4e-15;
    let rem_s = mm.powi(19) / 121645100408832000.0 * (1.0 + 1e-13);
    let rem_c = mm.powi(18) / 6402373705728000.0 * (1.0 + 1e-13);
    let es = HORNER + rem_s + rad + 1e-300;
    let ec = HORNER + rem_c + rad + 1e-300;
    let s = iv((sv - es).max(-1.0), (sv + es).min(1.0));
    let c = iv((cv - ec).max(-1.0), (cv + ec).min(1.0));
    match (q as i64).rem_euclid(4) {
        0 => (s, c),
        1 => (c, -s),
        2 => (-s, -c),
        _ => (-c, s),
    }
}
/// The ranges of sin and cos over an interval: the hull of the endpoint values and of
/// +-1 at every critical point (pi/2 + n pi for sin, n pi for cos) the interval can contain.
fn sincos_i(x: I) -> (I, I) {
    if x.wid() >= 6.4 {
        return (iv(-1.0, 1.0), iv(-1.0, 1.0));
    }
    let (a, b) = (x.inf(), x.sup());
    let (sa, ca) = sincos_at(a);
    let (sb, cb) = sincos_at(b);
    let mut s = sa.convex_hull(sb);
    let mut c = ca.convex_hull(cb);
    let n0 = (a / std::f64::consts::PI).floor() as i64 - 1;
    let n1 = (b / std::f64::consts::PI).ceil() as i64 + 1;
    let half = Interval::PI * pt(0.5);
    for n in n0..=n1 {
        let cn = Interval::PI * pt(n as f64); // cos critical: cos(n pi) = (-1)^n
        if cn.sup() >= a && cn.inf() <= b {
            c = c.convex_hull(pt(if n % 2 == 0 { 1.0 } else { -1.0 }));
        }
        let sn = cn + half; // sin critical: sin(pi/2 + n pi) = (-1)^n
        if sn.sup() >= a && sn.inf() <= b {
            s = s.convex_hull(pt(if n % 2 == 0 { 1.0 } else { -1.0 }));
        }
    }
    (s.intersection(iv(-1.0, 1.0)), c.intersection(iv(-1.0, 1.0)))
}
fn sin_i(x: I) -> I {
    sincos_i(x).0
}
fn cos_i(x: I) -> I {
    sincos_i(x).1
}

/// sinc, sinc' and (optionally) sinc'' at z.  Away from 0: from one (sin, cos) range.
/// Across 0: alternating series with the first omitted term as the remainder (the
/// terms decrease from there for the stated |z|), else crude global bounds.
fn sinc_all(z: I, want_dd: bool) -> (I, I, I) {
    let bound_s = iv(-0.2173, 1.0); // sinc >= -0.21723..., <= 1
    let bound_d = iv(-0.5, 0.5); // |sinc'| < 0.4362
    if !z.contains(0.0) {
        let (s, c) = sincos_i(z);
        let z2 = z.sqr();
        let sc = (s / z).intersection(bound_s);
        let sd = ((z * c - s) / z2).intersection(bound_d);
        let sdd = if want_dd { (pt(2.0) * s - pt(2.0) * z * c - z2 * s) / (z2 * z) } else { pt(0.0) };
        return (sc, sd, sdd);
    }
    let m = z.abs().sup();
    let z2 = z.sqr();
    let coef = |c: f64| iv(c - c.abs() * 1e-15, c + c.abs() * 1e-15);
    // sinc: sum (-1)^n z^{2n}/(2n+1)!  (remainder m^{24}/25! for N = 12)
    let sc = if m >= 3.0 {
        bound_s
    } else {
        let mut acc = pt(1.0);
        for n in (1..12).rev() {
            acc = pt(1.0) - z2 * acc / pt(((2 * n) * (2 * n + 1)) as f64);
        }
        let rem = m.powi(24) / 1.5511210043330986e25 * (1.0 + 1e-13) + 1e-300;
        (acc + iv(-rem, rem)).intersection(bound_s)
    };
    // sinc': z (-1/3 + z2/30 - z2^2/840 + z2^3/45360 - z2^4/3991680 + z2^5/518918400), next 14 m^13/15!
    let sd = if m >= 3.0 {
        bound_d
    } else {
        let c: [f64; 6] = [-1.0 / 3.0, 1.0 / 30.0, -1.0 / 840.0, 1.0 / 45360.0, -1.0 / 3991680.0, 1.0 / 518918400.0];
        let mut acc = pt(0.0);
        for k in (0..6).rev() {
            acc = acc * z2 + coef(c[k]);
        }
        let rem = m.powi(13) / 93405312000.0 * (1.0 + 1e-13) + 1e-300;
        (z * acc + iv(-rem, rem)).intersection(bound_d)
    };
    // sinc'': -1/3 + z2/10 - z2^2/168 + z2^3/6480 - z2^4/443520 + z2^5/47174400, next 182 m^12/15!
    let sdd = if !want_dd {
        pt(0.0)
    } else if m >= 1.0 {
        iv(-5.0, 5.0) // |sinc''| <= (2 + 2|z| + z^2)/|z|^3 <= 5 for |z| >= 1, and <= 0.45 below
    } else {
        let c: [f64; 6] = [-1.0 / 3.0, 1.0 / 10.0, -1.0 / 168.0, 1.0 / 6480.0, -1.0 / 443520.0, 1.0 / 47174400.0];
        let mut acc = pt(0.0);
        for k in (0..6).rev() {
            acc = acc * z2 + coef(c[k]);
        }
        let rem = m.powi(12) / 7185024000.0 * (1.0 + 1e-13) + 1e-300;
        acc + iv(-rem, rem)
    };
    (sc, sd, sdd)
}

struct Kernel {
    k0: I,
    k0sq: I,
    r: I,
    tp: I,
}
impl Kernel {
    fn new() -> Kernel {
        let r = pt(2.0).sqrt();
        let k0 = sinc_all(r * pt(0.5), false).0;
        Kernel { k0, k0sq: k0.sqr(), r, tp: two_pi() }
    }
    /// (w, w') at x, and w'' too when asked, from one pair of (sin, cos) evaluations.
    fn at(&self, x: I, want_dd: bool) -> (I, I, I) {
        let zl = (self.r - self.tp * x) * pt(0.5);
        let zr = (self.r + self.tp * x) * pt(0.5);
        let (sl, dl, ddl) = sinc_all(zl, want_dd);
        let (sr, dr, ddr) = sinc_all(zr, want_dd);
        let k = (sl + sr) * pt(0.5);
        let kp = Interval::PI * (dr - dl) * pt(0.5);
        let w = (k / self.k0).sqr();
        let wd = pt(2.0) * k * kp / self.k0sq;
        let wdd = if want_dd {
            let kpp = Interval::PI.sqr() * (ddr + ddl) * pt(0.5);
            pt(2.0) * (kp.sqr() + k * kpp) / self.k0sq
        } else {
            pt(0.0)
        };
        (w, wd, wdd)
    }
    fn w(&self, x: I) -> I {
        self.at(x, false).0
    }
    fn wd(&self, x: I) -> I {
        self.at(x, false).1
    }
    fn wdd(&self, x: I) -> I {
        self.at(x, true).2
    }
}

/// Exact ranges of w and w' over [a, b] from the certified breakpoint balls.
struct Tables {
    limit: f64,
    w_los: Vec<f64>,
    w_his: Vec<f64>,
    w_vals: Vec<I>,
    d_los: Vec<f64>,
    d_his: Vec<f64>,
    d_vals: Vec<I>,
}
impl Tables {
    fn load(kern: &Kernel, table: &Value) -> Result<Tables, String> {
        let limit = table["limit"].as_f64().ok_or("table has no limit")?;
        let mut w_balls = vec![pt(0.0)];
        for e in table["w_break_points"].as_array().ok_or("no w_break_points")? {
            let (m, r) = (e["mid"].as_f64().unwrap(), e["rad"].as_f64().unwrap());
            w_balls.push(pt(m) + iv(-r, r));
        }
        let mut d_balls = vec![];
        for e in table["wd_break_points"].as_array().ok_or("no wd_break_points")? {
            let (m, r) = (e["mid"].as_f64().unwrap(), e["rad"].as_f64().unwrap());
            d_balls.push(pt(m) + iv(-r, r));
        }
        // re-check every entry in these intervals: a root of w' / of w'' lies inside
        for b in &w_balls[1..] {
            if !kern.wd(*b).contains(0.0) {
                return Err(format!("w' does not vanish on the table ball {:?}", b));
            }
        }
        for b in &d_balls {
            if !kern.wdd(*b).contains(0.0) {
                return Err(format!("w'' does not vanish on the table ball {:?}", b));
            }
        }
        let sorted = |v: &Vec<I>| v.windows(2).all(|p| p[0].sup() < p[1].inf());
        if !sorted(&w_balls) || !sorted(&d_balls) {
            return Err("table balls are not disjoint and sorted".into());
        }
        Ok(Tables {
            limit,
            w_los: w_balls.iter().map(|b| b.inf()).collect(),
            w_his: w_balls.iter().map(|b| b.sup()).collect(),
            w_vals: w_balls.iter().map(|b| kern.w(*b)).collect(),
            d_los: d_balls.iter().map(|b| b.inf()).collect(),
            d_his: d_balls.iter().map(|b| b.sup()).collect(),
            d_vals: d_balls.iter().map(|b| kern.wd(*b)).collect(),
        })
    }
    /// (range of w, range of w') over [a, b], the endpoints evaluated once for both.
    fn ranges(&self, kern: &Kernel, a: f64, b: f64) -> (I, I) {
        assert!(0.0 <= a && a <= b && b <= self.limit, "range outside the certified table");
        let (wa, da, _) = kern.at(pt(a), false);
        let (wb, db, _) = kern.at(pt(b), false);
        let mut w = wa.convex_hull(wb);
        let i0 = self.w_his.partition_point(|&h| h <= a);
        let i1 = self.w_los.partition_point(|&l| l < b);
        for v in &self.w_vals[i0..i1.max(i0)] {
            w = w.convex_hull(*v);
        }
        let mut d = da.convex_hull(db);
        let j0 = self.d_his.partition_point(|&h| h <= a);
        let j1 = self.d_los.partition_point(|&l| l < b);
        for v in &self.d_vals[j0..j1.max(j0)] {
            d = d.convex_hull(*v);
        }
        (w, d)
    }
}

// ---------------------------------------------------------------- the certificate

fn cell(knots: &[f64], x: f64) -> usize {
    if x <= knots[0] {
        return 0;
    }
    if x >= knots[knots.len() - 1] {
        return knots.len() - 2;
    }
    let (mut i, mut j) = (0usize, knots.len() - 1);
    while j - i > 1 {
        let m = (i + j) / 2;
        if knots[m] <= x {
            i = m;
        } else {
            j = m;
        }
    }
    i
}
fn pl_at(knots: &[f64], c: &[f64], x: f64) -> I {
    if x <= knots[0] {
        return pt(c[0]);
    }
    if x >= knots[knots.len() - 1] {
        return pt(c[c.len() - 1]);
    }
    let i = cell(knots, x);
    let t = (pt(x) - pt(knots[i])) / (pt(knots[i + 1]) - pt(knots[i]));
    pt(c[i]) * (pt(1.0) - t) + pt(c[i + 1]) * t
}
fn pl_range(knots: &[f64], c: &[f64], lo: f64, hi: f64) -> I {
    let mut h = pl_at(knots, c, lo).convex_hull(pl_at(knots, c, hi));
    for i in 0..knots.len() {
        if lo < knots[i] && knots[i] < hi {
            h = h.convex_hull(pt(c[i]));
        }
    }
    h
}
fn pl_slope_range(knots: &[f64], c: &[f64], lo: f64, hi: f64) -> I {
    let n = knots.len();
    let slope = |i: usize| (pt(c[i + 1]) - pt(c[i])) / (pt(knots[i + 1]) - pt(knots[i]));
    let mut s: Vec<I> = (0..n - 1).filter(|&i| knots[i + 1] > lo && knots[i] < hi).map(slope).collect();
    if s.is_empty() {
        s = (0..n - 1).filter(|&i| knots[i + 1] >= lo && knots[i] <= hi).map(slope).collect();
    }
    if lo <= knots[0] || hi >= knots[n - 1] {
        s.push(pt(0.0));
    }
    if s.is_empty() {
        pt(0.0)
    } else {
        hull(&s)
    }
}
fn cells(knots: &[f64], lo: f64, hi: f64) -> Vec<usize> {
    let n = knots.len();
    let mut out: Vec<usize> = (0..n - 1).filter(|&i| knots[i + 1] > lo && knots[i] < hi).collect();
    if lo < knots[0] && !out.contains(&0) {
        out.push(0);
    }
    if hi > knots[n - 1] && !out.contains(&(n - 2)) {
        out.push(n - 2);
    }
    if out.is_empty() {
        out = (0..n - 1).filter(|&i| knots[i + 1] >= lo && knots[i] <= hi).collect();
    }
    out
}
fn clip(knots: &[f64], i: usize, lo: f64, hi: f64) -> [f64; 2] {
    let mut xs = [lo.max(knots[i]).clamp(knots[i], knots[i + 1]), hi.min(knots[i + 1]).clamp(knots[i], knots[i + 1])];
    if lo < knots[0] {
        xs[0] = knots[0];
    }
    if hi > knots[knots.len() - 1] {
        xs[1] = knots[knots.len() - 1];
    }
    xs
}
fn bilin(grid: &[f64], jn: usize, knots: &[f64], i: usize, j: usize, x: I, y: I) -> I {
    let fx = (x - pt(knots[i])) / (pt(knots[i + 1]) - pt(knots[i]));
    let fy = (y - pt(knots[j])) / (pt(knots[j + 1]) - pt(knots[j]));
    let (c00, c01) = (pt(grid[i * jn + j]), pt(grid[i * jn + j + 1]));
    let (c10, c11) = (pt(grid[(i + 1) * jn + j]), pt(grid[(i + 1) * jn + j + 1]));
    let one = pt(1.0);
    (one - fx) * ((one - fy) * c00 + fy * c01) + fx * ((one - fy) * c10 + fy * c11)
}
fn grid_range(grid: &[f64], jn: usize, knots: &[f64], alo: f64, ahi: f64, blo: f64, bhi: f64) -> I {
    let mut vals = vec![];
    for i in cells(knots, alo, ahi) {
        let xs = clip(knots, i, alo, ahi);
        for j in cells(knots, blo, bhi) {
            let ys = clip(knots, j, blo, bhi);
            for &x in &xs {
                for &y in &ys {
                    vals.push(bilin(grid, jn, knots, i, j, pt(x), pt(y)));
                }
            }
        }
    }
    hull(&vals)
}
fn grid_slopes(grid: &[f64], jn: usize, knots: &[f64], alo: f64, ahi: f64, blo: f64, bhi: f64) -> (I, I) {
    let (mut dxs, mut dys) = (vec![], vec![]);
    let n = knots.len();
    for i in cells(knots, alo, ahi) {
        let hx = pt(knots[i + 1]) - pt(knots[i]);
        let xs = [alo.max(knots[i]).clamp(knots[i], knots[i + 1]), ahi.min(knots[i + 1]).clamp(knots[i], knots[i + 1])];
        for j in cells(knots, blo, bhi) {
            let hy = pt(knots[j + 1]) - pt(knots[j]);
            let ys = [blo.max(knots[j]).clamp(knots[j], knots[j + 1]), bhi.min(knots[j + 1]).clamp(knots[j], knots[j + 1])];
            let (c00, c01) = (pt(grid[i * jn + j]), pt(grid[i * jn + j + 1]));
            let (c10, c11) = (pt(grid[(i + 1) * jn + j]), pt(grid[(i + 1) * jn + j + 1]));
            for &y in &ys {
                let fy = (pt(y) - pt(knots[j])) / hy;
                dxs.push(((pt(1.0) - fy) * (c10 - c00) + fy * (c11 - c01)) / hx);
            }
            for &x in &xs {
                let fx = (pt(x) - pt(knots[i])) / hx;
                dys.push(((pt(1.0) - fx) * (c01 - c00) + fx * (c11 - c10)) / hy);
            }
        }
    }
    if alo <= knots[0] || ahi >= knots[n - 1] {
        dxs.push(pt(0.0));
    }
    if blo <= knots[0] || bhi >= knots[n - 1] {
        dys.push(pt(0.0));
    }
    (hull(&dxs), hull(&dys))
}

struct Cert {
    base_knots: Vec<f64>,
    base_a: Vec<f64>,
    base_b: Vec<f64>,
    knots: Vec<f64>,
    jn: usize,
    mats: Vec<Vec<f64>>,
    kern: Kernel,
    tables: Tables,
    pairs: Vec<(usize, usize)>,
    conflicts: AtomicUsize,
}
impl Cert {
    fn bound_and_grad(&self, lo: &[f64; 6], hi: &[f64; 6]) -> (I, [I; 6]) {
        let mut val = pt(0.0);
        for k in 0..6 {
            val = val + iv(lo[k], hi[k]);
        }
        val = val / pt(3000.0);
        let mut grad = [pt(1.0) / pt(3000.0); 6];
        for &(i, j) in &self.pairs {
            let mut d = pt(0.0);
            for k in i..j {
                d = d + iv(lo[k], hi[k]);
            }
            let (dlo, dhi) = (d.inf().max(0.0), d.sup());
            let c = pt(2.0) / pt((NPTS - (j - i)) as f64);
            let (wr, dr) = self.tables.ranges(&self.kern, dlo, dhi);
            val = val + wr * c;
            let dw = dr * c;
            for k in i..j {
                grad[k] = grad[k] + dw;
            }
        }
        for i in 0..6 {
            if SIGN_A[i] != 0 {
                let s = pt(SIGN_A[i] as f64);
                val = val + s * pl_range(&self.base_knots, &self.base_a, lo[i], hi[i]);
                grad[i] = grad[i] + s * pl_slope_range(&self.base_knots, &self.base_a, lo[i], hi[i]);
            }
            if SIGN_B[i] != 0 {
                let s = pt(SIGN_B[i] as f64);
                val = val + s * pl_range(&self.base_knots, &self.base_b, lo[i], hi[i]);
                grad[i] = grad[i] + s * pl_slope_range(&self.base_knots, &self.base_b, lo[i], hi[i]);
            }
        }
        for k in 0..5 {
            val = val + grid_range(&self.mats[k], self.jn, &self.knots, lo[k], hi[k], lo[k + 1], hi[k + 1]);
            let (dx, dy) = grid_slopes(&self.mats[k], self.jn, &self.knots, lo[k], hi[k], lo[k + 1], hi[k + 1]);
            grad[k] = grad[k] + dx;
            grad[k + 1] = grad[k + 1] + dy;
        }
        (val, grad)
    }
    /// Centred forms: R(centre) + grad(box).(x - centre) for the value (second order in the
    /// width), and grad(centre) + H(box).(x - centre) for the smooth pair part of the
    /// gradient with exact slope hulls for the piecewise parts.  w and w' at each centre
    /// distance come from one evaluation.
    fn centered(&self, lo: &[f64; 6], hi: &[f64; 6], grad: &[I; 6]) -> (I, [I; 6]) {
        let c: Vec<I> = (0..6).map(|k| (pt(lo[k]) + pt(hi[k])) * pt(0.5)).collect();
        let rad: Vec<I> = (0..6).map(|k| iv(lo[k], hi[k]) - c[k]).collect();
        let mut pc = vec![pt(0.0)];
        for k in 0..6 {
            pc.push(pc[k] + c[k]);
        }
        let mut val = pt(0.0);
        for k in 0..6 {
            val = val + c[k];
        }
        val = val / pt(3000.0);
        let mut g = [pt(1.0) / pt(3000.0); 6];
        let mut h = [[pt(0.0); 6]; 6];
        for &(i, j) in &self.pairs {
            let coef = pt(2.0) / pt((NPTS - (j - i)) as f64);
            let (w, wd, _) = self.kern.at(pc[j] - pc[i], false);
            val = val + w * coef;
            let mut d = pt(0.0);
            for k in i..j {
                d = d + iv(lo[k], hi[k]);
            }
            let dbox = iv(d.inf().max(0.0), d.sup());
            let wdd = self.kern.wdd(dbox) * coef;
            let wdc = wd * coef;
            for k in i..j {
                g[k] = g[k] + wdc;
                for l in i..j {
                    h[k][l] = h[k][l] + wdd;
                }
            }
        }
        for i in 0..6 {
            if SIGN_A[i] != 0 {
                let s = pt(SIGN_A[i] as f64);
                val = val + s * pl_range(&self.base_knots, &self.base_a, c[i].inf(), c[i].sup());
                g[i] = g[i] + s * pl_slope_range(&self.base_knots, &self.base_a, lo[i], hi[i]);
            }
            if SIGN_B[i] != 0 {
                let s = pt(SIGN_B[i] as f64);
                val = val + s * pl_range(&self.base_knots, &self.base_b, c[i].inf(), c[i].sup());
                g[i] = g[i] + s * pl_slope_range(&self.base_knots, &self.base_b, lo[i], hi[i]);
            }
        }
        for k in 0..5 {
            val = val + grid_range(&self.mats[k], self.jn, &self.knots, c[k].inf(), c[k].sup(), c[k + 1].inf(), c[k + 1].sup());
            let (dx, dy) = grid_slopes(&self.mats[k], self.jn, &self.knots, lo[k], hi[k], lo[k + 1], hi[k + 1]);
            g[k] = g[k] + dx;
            g[k + 1] = g[k + 1] + dy;
        }
        for k in 0..6 {
            val = val + grad[k] * rad[k];
            for l in 0..6 {
                g[k] = g[k] + h[k][l] * rad[l];
            }
        }
        (val, g)
    }
    fn best_bound(&self, lo: &[f64; 6], hi: &[f64; 6]) -> (I, [I; 6]) {
        let (nat, mut grad) = self.bound_and_grad(lo, hi);
        let (cen, gcen) = self.centered(lo, hi, &grad);
        for k in 0..6 {
            let x = grad[k].intersection(gcen[k]);
            if x.is_empty() {
                self.conflicts.fetch_add(1, Ordering::Relaxed);
            } else {
                grad[k] = x;
            }
        }
        let v = nat.intersection(cen);
        if v.is_empty() {
            self.conflicts.fetch_add(1, Ordering::Relaxed);
            (nat, grad)
        } else {
            (v, grad)
        }
    }
}

// ---------------------------------------------------------------- verdicts

fn widest(lo: &[f64; 6], hi: &[f64; 6]) -> (usize, f64) {
    let (mut k, mut w) = (0usize, -1.0f64);
    for i in 0..6 {
        if hi[i] - lo[i] > w {
            k = i;
            w = hi[i] - lo[i];
        }
    }
    (k, w)
}
/// 0 confirmed, 1 unresolved, 2 refuted
fn verdict_leaf(cert: &Cert, lo: &[f64; 6], hi: &[f64; 6], target: f64, depth: u32, boxes: &mut u64) -> u8 {
    let (val, _) = cert.best_bound(lo, hi);
    *boxes += 1;
    if val.inf() >= target {
        return 0;
    }
    if val.sup() < target {
        return 2;
    }
    if depth == 0 {
        return 1;
    }
    let (k, w) = widest(lo, hi);
    if w <= 0.0 {
        return 1;
    }
    let mid = (lo[k] + hi[k]) / 2.0;
    let mut hi2 = *hi;
    hi2[k] = mid;
    let mut lo2 = *lo;
    lo2[k] = mid;
    let a = verdict_leaf(cert, lo, &hi2, target, depth - 1, boxes);
    if a == 2 {
        return 2;
    }
    let b = verdict_leaf(cert, &lo2, hi, target, depth - 1, boxes);
    if b == 2 {
        return 2;
    }
    if a == 0 && b == 0 {
        0
    } else {
        1
    }
}
fn verdict_coll(cert: &Cert, lo: &[f64; 6], hi: &[f64; 6], k: usize, side_lo: bool, depth: u32, boxes: &mut u64) -> u8 {
    let (_, grad) = cert.best_bound(lo, hi);
    *boxes += 1;
    let g = grad[k];
    if !side_lo && g.inf() > 0.0 {
        return 0;
    }
    if side_lo && g.sup() < 0.0 {
        return 0;
    }
    if (!side_lo && g.sup() <= 0.0) || (side_lo && g.inf() >= 0.0) {
        return 2;
    }
    if depth == 0 {
        return 1;
    }
    let (kk, w) = widest(lo, hi);
    if w <= 0.0 {
        return 1;
    }
    let mid = (lo[kk] + hi[kk]) / 2.0;
    let mut hi2 = *hi;
    hi2[kk] = mid;
    let mut lo2 = *lo;
    lo2[kk] = mid;
    let a = verdict_coll(cert, lo, &hi2, k, side_lo, depth - 1, boxes);
    if a == 2 {
        return 2;
    }
    let b = verdict_coll(cert, &lo2, hi, k, side_lo, depth - 1, boxes);
    if b == 2 {
        return 2;
    }
    if a == 0 && b == 0 {
        0
    } else {
        1
    }
}

// ---------------------------------------------------------------- partition and tape

fn centres(phase: usize) -> [f64; 6] {
    let mut c = [0.0; 6];
    for i in 0..6 {
        c[i] = if (i + phase) % 2 == 0 { LOW } else { HIGH };
    }
    c
}
type Box6 = ([f64; 6], [f64; 6]);
fn partition(cube: f64, rho: f64) -> (Vec<Box6>, Vec<(Box6, usize)>) {
    let mut cuts = vec![0.0, cube];
    for c in [LOW, HIGH] {
        for v in [c - rho, c + rho] {
            if 0.0 < v && v < cube && !cuts.contains(&v) {
                cuts.push(v);
            }
        }
    }
    cuts.sort_by(|a, b| a.partial_cmp(b).unwrap());
    cuts.dedup();
    let slabs: Vec<(f64, f64)> = cuts.windows(2).map(|p| (p[0], p[1])).collect();
    let mut out = vec![];
    let mut excluded = vec![];
    let mut idx = [0usize; 6];
    let n = slabs.len();
    let total = n.pow(6);
    for t in 0..total {
        let mut r = t;
        for k in (0..6).rev() {
            idx[k] = r % n;
            r /= n;
        }
        let mut lo = [0.0; 6];
        let mut hi = [0.0; 6];
        for k in 0..6 {
            lo[k] = slabs[idx[k]].0;
            hi[k] = slabs[idx[k]].1;
        }
        let mut skip = None;
        for phase in 0..2 {
            let c = centres(phase);
            if (0..6).all(|i| lo[i] >= c[i] - rho - 1e-15 && hi[i] <= c[i] + rho + 1e-15) {
                skip = Some(phase);
                break;
            }
        }
        match skip {
            Some(p) => excluded.push(((lo, hi), p)),
            None => out.push((lo, hi)),
        }
    }
    (out, excluded)
}

#[derive(Default, Clone)]
struct Tally {
    leaf: [u64; 3],
    coll: [u64; 3],
    shard_leaves: u64,
    shard_colls: u64,
    boxes: u64,
    unresolved: Vec<Value>,
}

struct Walk {
    leaves: u64,
    splits: u64,
    collapses: u64,
    open: u64,
    tube: u64,
    bad: u64,
    pos: usize,
}

/// One pass over the tape; arithmetic only under roots in [ra, rb).
/// `claim`: with a counter, roots in [ra, rb) are handed out one at a time across the
/// threads (each thread walks the whole tape, cheaply, and does arithmetic on the roots it
/// claimed); without one, every root in [ra, rb) is done here.
fn walk(tape: &[u8], roots: &[Box6], ra: usize, rb: usize, cert: Option<&Cert>, target: f64, refine: u32, tally: &mut Tally, progress: bool, claim: Option<&AtomicUsize>) -> Walk {
    let mut w = Walk { leaves: 0, splits: 0, collapses: 0, open: 0, tube: 0, bad: 0, pos: 0 };
    let started = Instant::now();
    let mut next_report = 200_000u64;
    let mut claimed = claim.map(|c| ra + c.fetch_add(1, Ordering::SeqCst)).unwrap_or(ra);
    'roots: for (ridx, (lo0, hi0)) in roots.iter().enumerate() {
        let in_shard = match claim {
            Some(c) => {
                if ridx == claimed && ridx < rb {
                    true
                } else {
                    false
                }
            }
            None => ra <= ridx && ridx < rb,
        };
        let _ = &claim;
        let mut claim_next = false;
        if in_shard && claim.is_some() {
            claim_next = true;
        }
        let mut stack: Vec<Box6> = vec![(*lo0, *hi0)];
        while let Some((mut lo, mut hi)) = stack.pop() {
            loop {
                if w.pos >= tape.len() {
                    w.bad += 1;
                    break 'roots;
                }
                let op = tape[w.pos];
                w.pos += 1;
                if op == LEAF_BOUND {
                    w.leaves += 1;
                    if in_shard {
                        tally.shard_leaves += 1;
                        if let Some(c) = cert {
                            let v = verdict_leaf(c, &lo, &hi, target, refine, &mut tally.boxes);
                            tally.leaf[v as usize] += 1;
                            if v == 1 {
                                tally.unresolved.push(json!({"kind": "leaf", "root": ridx, "pos": w.pos - 1, "lo": lo, "hi": hi}));
                            }
                        }
                    }
                    break;
                }
                if op == LEAF_OPEN {
                    w.leaves += 1;
                    w.open += 1;
                    break;
                }
                if op == LEAF_TUBE {
                    w.leaves += 1;
                    w.tube += 1;
                    w.bad += 1;
                    break 'roots;
                }
                let k = (op & 0x07) as usize;
                if k > 5 || op > LEAF_OPEN {
                    w.bad += 1;
                    break 'roots;
                }
                if op < OP_LO {
                    let mid = (lo[k] + hi[k]) / 2.0;
                    if !(hi[k] > lo[k] && lo[k] <= mid && mid <= hi[k]) {
                        w.bad += 1;
                        break 'roots;
                    }
                    w.splits += 1;
                    let mut rlo = lo;
                    rlo[k] = mid;
                    stack.push((rlo, hi));
                    hi[k] = mid;
                    continue;
                }
                // collapse
                if !(hi[k] > lo[k]) {
                    w.bad += 1;
                    break 'roots;
                }
                w.collapses += 1;
                let side_lo = op < OP_HI;
                if in_shard {
                    tally.shard_colls += 1;
                    if let Some(c) = cert {
                        let v = verdict_coll(c, &lo, &hi, k, side_lo, refine, &mut tally.boxes);
                        tally.coll[v as usize] += 1;
                        if v == 1 {
                            tally.unresolved.push(json!({"kind": "collapse", "root": ridx, "pos": w.pos - 1, "lo": lo, "hi": hi, "k": k, "side": if side_lo {"lo"} else {"hi"}}));
                        }
                    }
                }
                if side_lo {
                    lo[k] = hi[k];
                } else {
                    hi[k] = lo[k];
                }
                let done = tally.shard_leaves + tally.shard_colls;
                if progress && done >= next_report {
                    next_report += 200_000;
                    eprintln!("  {} obligations, leaves {:?}, collapses {:?}, {:.0} s", done, tally.leaf, tally.coll, started.elapsed().as_secs_f64());
                }
            }
        }
        if claim_next {
            claimed = ra + claim.unwrap().fetch_add(1, Ordering::SeqCst);
        }
    }
    w
}

// ---------------------------------------------------------------- provenance

fn canonical(raw: &[u8], is_json: bool) -> Vec<u8> {
    if !is_json {
        return raw.to_vec();
    }
    let text = String::from_utf8_lossy(raw);
    let keep: Vec<&str> = text
        .split('\n')
        .filter(|ln| {
            let t = ln.trim_start();
            !(t.starts_with("\"commit\":") || t.starts_with("\"seconds\":"))
        })
        .collect();
    keep.join("\n").into_bytes()
}
fn hash_inputs(dev: &Path, names: &[String]) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for n in names {
        let raw = fs::read(dev.join(n)).unwrap_or_else(|_| panic!("cannot read input {}", n));
        let bytes = canonical(&raw, n.ends_with(".json"));
        out.insert(n.clone(), format!("{:x}", Sha256::digest(&bytes)));
    }
    out
}

fn f64s(v: &Value) -> Vec<f64> {
    v.as_array().expect("array").iter().map(|x| x.as_f64().expect("number")).collect()
}

// ---------------------------------------------------------------- main

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let opt = |name: &str| -> Option<String> {
        let key = format!("--{}=", name);
        args.iter().find(|a| a.starts_with(&key)).map(|a| a[key.len()..].to_string())
    };
    let meta_name = opt("meta").unwrap_or_else(|| "sweep_proof.json".into());
    let refine: u32 = opt("refine").map(|s| s.parse().unwrap()).unwrap_or(6);
    let threads: usize = opt("threads").map(|s| s.parse().unwrap()).unwrap_or(8);
    let out_name = opt("out").unwrap_or_else(|| "tapecheck.results.json".into());
    let dump = opt("dump-unresolved");
    let (root_lo, root_hi): (usize, usize) = match opt("roots") {
        Some(s) => {
            let p: Vec<usize> = s.split(':').map(|t| t.parse().unwrap()).collect();
            (p[0], p[1])
        }
        None => (0, usize::MAX),
    };
    let dev: PathBuf = {
        let exe_dir = std::env::current_dir().unwrap();
        if exe_dir.join("sweep_proof.js").exists() {
            exe_dir
        } else if exe_dir.join("../sweep_proof.js").exists() {
            exe_dir.join("..")
        } else {
            exe_dir
        }
    };
    let meta: Value = serde_json::from_slice(&fs::read(dev.join(&meta_name)).expect("meta")).unwrap();
    let candidate = meta["candidate"].as_str().unwrap_or("tiling_pair.stationary.json").to_string();
    let tube_radius = meta["tubeRadius"].as_f64().unwrap();
    let has_tube = tube_radius > 0.0;
    let mut sources: Vec<String> = vec![
        "tapecheck/src/main.rs".into(),
        "tapecheck/Cargo.toml".into(),
        meta_name.clone(),
        candidate.clone(),
        "tiling_additive.certificate.json".into(),
        "kernel_pieces_arb.results.json".into(),
    ];
    if has_tube {
        sources.extend(["tube_arb.py", "tube_arb.results.json", "coercivity_arb.py", "arb_provenance.py"].map(String::from));
    }
    let inputs_start = hash_inputs(&dev, &sources);
    let started = Instant::now();
    let mut checks: Vec<(String, bool, String)> = vec![];
    let mut check = |name: &str, ok: bool, detail: String| {
        println!("{:<4} {}{}", if ok { "ok" } else { "FAIL" }, name, if detail.is_empty() { String::new() } else { format!("  -- {}", detail) });
        checks.push((name.to_string(), ok, detail));
    };

    // ---- primitives: the interval sine against libm at many points (containment), and the kernel
    let kern = Kernel::new();
    {
        let mut bad = 0;
        let mut worst = 0.0f64;
        let mut x = -600.0f64;
        let mut count = 0u64;
        while x < 600.0 {
            let (s, c) = sincos_at(x);
            let (so, co) = sincos_at_slow(x);
            if !s.contains(x.sin()) || !c.contains(x.cos()) || !so.contains(x.sin()) || !co.contains(x.cos())
                || s.intersection(so).is_empty() || c.intersection(co).is_empty() {
                bad += 1;
                if bad <= 3 {
                    eprintln!("  trig miss at x = {:.17}: fast sin [{:.17}, {:.17}] slow [{:.17}, {:.17}] libm {:.17}", x, s.inf(), s.sup(), so.inf(), so.sup(), x.sin());
                }
            }
            worst = worst.max(s.wid()).max(c.wid());
            x += 0.00173;
            count += 1;
        }
        // ranges over intervals contain sampled values
        let mut bad_r = 0;
        for t in 0..4000 {
            let a = -50.0 + 100.0 * ((t * 7919) % 4000) as f64 / 4000.0;
            let b = a + 0.001 + 8.0 * ((t * 104729) % 1000) as f64 / 1000.0;
            let r = sin_i(iv(a, b));
            for u in 0..7 {
                let xx = (a + (b - a) * u as f64 / 6.0).clamp(a, b);
                if !r.contains(xx.sin()) {
                    bad_r += 1;
                    if bad_r <= 3 {
                        eprintln!("  range miss: [{:.17}, {:.17}] sin range [{:.17}, {:.17}] at x = {:.17} libm {:.17}", a, b, r.inf(), r.sup(), xx, xx.sin());
                    }
                }
            }
        }
        check("the fast and the pure-interval sine/cosine both contain libm's values and overlap each other at every one of the sample points, and the ranges over 4000 intervals contain sampled values",
              bad == 0 && bad_r == 0, format!("{} points, {} misses, widest point enclosure {:.1e}", count, bad + bad_r, worst));
        let w0 = kern.w(pt(0.0));
        check("w(0) = 1 in these intervals, tightly",
              w0.contains(1.0) && w0.wid() < 1e-13, format!("w(0) = [{:.17}, {:.17}]", w0.inf(), w0.sup()));
    }
    let table_json: Value = serde_json::from_slice(&fs::read(dev.join("kernel_pieces_arb.results.json")).unwrap()).unwrap();
    let table_ok = table_json["checks"].as_array().map(|a| a.iter().all(|c| c["ok"].as_bool() == Some(true))).unwrap_or(false)
        && table_json["coverage_proved"].is_string();
    check("the breakpoint transcript passed all its checks and states its coverage proof", table_ok, String::new());
    let tables = match Tables::load(&kern, &table_json) {
        Ok(t) => t,
        Err(e) => {
            check("every table entry re-checks in these intervals (w' or w'' vanishes on its ball)", false, e);
            std::process::exit(1);
        }
    };
    check("every table entry re-checks in these intervals (w' or w'' vanishes on its ball)", true,
          format!("{} w balls, {} w' balls, limit {}", tables.w_vals.len(), tables.d_vals.len(), tables.limit));
    let cube = meta["cube"].as_f64().unwrap();
    check("the table covers six gaps of the tape's cube", 6.0 * cube <= tables.limit, format!("6 x {} <= {}", cube, tables.limit));

    // ---- the certificate
    let cand: Value = serde_json::from_slice(&fs::read(dev.join(&candidate)).unwrap()).unwrap();
    let bundle: Value = serde_json::from_slice(&fs::read(dev.join("tiling_additive.certificate.json")).unwrap()).unwrap();
    let base_name = cand["base"].as_str().unwrap();
    let certs = bundle["certificates"].as_array().unwrap();
    let base = certs.iter().find(|c| c["name"].as_str() == Some(base_name)).expect("base certificate");
    let knots = f64s(&cand["knots"]);
    let jn = knots.len();
    let free = cand["free"].as_u64().unwrap() as usize;
    let coefs = f64s(&cand["coefficients"]);
    let mut mats: Vec<Vec<f64>> = (0..free).map(|k| coefs[k * jn * jn..(k + 1) * jn * jn].to_vec()).collect();
    let last: Vec<f64> = (0..jn * jn).map(|i| -mats.iter().map(|m| m[i]).sum::<f64>()).collect();
    mats.push(last);
    let cert = Cert {
        base_knots: f64s(&base["knots"]),
        base_a: f64s(&base["a"]),
        base_b: f64s(&base["b"]),
        knots,
        jn,
        mats,
        kern,
        tables,
        pairs: (0..NPTS).flat_map(|i| (i + 1..NPTS).map(move |j| (i, j))).collect(),
        conflicts: AtomicUsize::new(0),
    };
    // the reduced functional at the alternating block, for the pair candidate: E_alt
    if cand["stationary"].as_bool() == Some(true) {
        let c = centres(0);
        let (v, _) = cert.best_bound(&c, &c);
        check("R at the alternating block encloses E_alt (the pair candidate's pinned value)",
              v.inf() <= E_ALT_HI && v.sup() >= E_ALT_LO, format!("[{:.17}, {:.17}]", v.inf(), v.sup()));
    }

    let tape = fs::read(dev.join(meta["tape"].as_str().unwrap())).expect("tape");
    let digest = format!("{:x}", Sha256::digest(&tape));
    check("the tape is the one the metadata describes", digest == meta["tape_sha256"].as_str().unwrap(), digest[..16].to_string());
    let (roots, excluded) = partition(cube, tube_radius);
    check("the root partition recomputed here matches the count the sweep used", roots.len() as u64 == meta["roots"].as_u64().unwrap(), format!("{} pieces", roots.len()));

    // ---- tube binding
    let mut tube_record = json!(null);
    if has_tube {
        let tube: Value = serde_json::from_slice(&fs::read(dev.join("tube_arb.results.json")).unwrap()).unwrap();
        let fresh = tube["inputs"].as_object().map(|m| m.iter().all(|(k, v)| inputs_start.get(k).map(|h| h == v.as_str().unwrap()).unwrap_or(false))).unwrap_or(false);
        let passed = tube["checks"].as_array().map(|a| a.iter().all(|c| c["ok"].as_bool() == Some(true))).unwrap_or(false);
        let bound = candidate == "tiling_pair.stationary.json" && cand["stationary"].as_bool() == Some(true) && fresh && passed;
        check("the tube theorem's transcript is about the candidate in use, was produced from the files in use, and passed", bound, format!("{} tube certificates", tube["tubes"].as_array().map(|a| a.len()).unwrap_or(0)));
        let mut need: BTreeMap<usize, f64> = BTreeMap::new();
        for ((lo, hi), phase) in &excluded {
            let c = centres(*phase);
            let mut exc = 0.0f64;
            for i in 0..6 {
                exc = exc.max((pt(c[i]) - pt(lo[i])).sup()).max((pt(hi[i]) - pt(c[i])).sup());
            }
            let e = need.entry(*phase).or_insert(0.0);
            *e = e.max(exc);
        }
        let mut used = serde_json::Map::new();
        let mut floor_in: Option<f64> = None;
        for (phase, exc) in &need {
            let fits: Vec<&Value> = tube["tubes"].as_array().unwrap().iter().filter(|t| t["phase"].as_u64().unwrap_or(0) as usize == *phase && t["radius"].as_f64().unwrap() >= *exc).collect();
            if let Some(t) = fits.iter().min_by(|a, b| a["radius"].as_f64().unwrap().partial_cmp(&b["radius"].as_f64().unwrap()).unwrap()) {
                used.insert(phase.to_string(), (*t).clone());
                let f = (iv(E_ALT_LO, E_ALT_HI) - pt(t["shortfall_upper"].as_f64().unwrap())).inf();
                floor_in = Some(floor_in.map_or(f, |x: f64| x.min(f)));
            }
        }
        check("every root piece excluded as a tube lies, exactly, inside a certified tube of its phase", bound && used.len() == need.len(), format!("{} pieces excluded, phases {:?}", excluded.len(), need.keys().collect::<Vec<_>>()));
        tube_record = json!({
            "excluded_root_pieces": excluded.len(), "phases": need.keys().collect::<Vec<_>>(), "certified_by": used,
            "floor_inside_tubes": floor_in,
            "statement": "inside the excluded tubes R >= E_alt - shortfall by dev/tube_arb.py, which is the number above, not the tape's target; the tape establishes R >= target on the complement only",
        });
    } else {
        check("no root piece is excluded, since the candidate has no tube theorem", excluded.is_empty(), format!("{} excluded", excluded.len()));
    }

    // ---- structural pass (no arithmetic), then the arithmetic in parallel over root ranges
    let target = meta["target"].as_f64().unwrap();
    let mut t0 = Tally::default();
    let w = walk(&tape, &roots, 0, 0, None, target, 0, &mut t0, false, None);
    check("the tape is consumed exactly, with nothing left over, every opcode known and no tube leaf claimed", w.pos == tape.len() && w.bad == 0 && w.tube == 0, format!("{} of {} bytes, {} structural faults, {} tube leaves", w.pos, tape.len(), w.bad, w.tube));
    check("the node counts agree with the metadata", w.leaves == meta["leaves"].as_u64().unwrap() && w.splits == meta["splits"].as_u64().unwrap() && w.collapses == meta["collapses"].as_u64().unwrap(), format!("{} leaves, {} splits, {} collapses", w.leaves, w.splits, w.collapses));
    check("no leaf was left open, so the subdivision terminated everywhere", w.open == 0, String::new());
    let structural_ok = w.pos == tape.len() && w.bad == 0 && w.tube == 0;

    let ra = root_lo.min(roots.len());
    let rb = root_hi.min(roots.len());
    let tallies: Mutex<Vec<Tally>> = Mutex::new(vec![]);
    if structural_ok && rb > ra {
        let nthreads = threads.max(1).min(rb - ra);
        let counter = AtomicUsize::new(0);
        std::thread::scope(|s| {
            for t in 0..nthreads {
                let (tape, roots, cert, tallies, counter) = (&tape, &roots, &cert, &tallies, &counter);
                s.spawn(move || {
                    let mut tally = Tally::default();
                    walk(tape, roots, ra, rb, Some(cert), target, refine, &mut tally, t == 0, Some(counter));
                    tallies.lock().unwrap().push(tally);
                });
            }
        });
    }
    let mut total = Tally::default();
    for t in tallies.into_inner().unwrap() {
        for i in 0..3 {
            total.leaf[i] += t.leaf[i];
            total.coll[i] += t.coll[i];
        }
        total.shard_leaves += t.shard_leaves;
        total.shard_colls += t.shard_colls;
        total.boxes += t.boxes;
        total.unresolved.extend(t.unresolved);
    }
    if let Some(d) = &dump {
        let mut f = String::new();
        for u in &total.unresolved {
            f.push_str(&u.to_string());
            f.push('\n');
        }
        fs::write(dev.join(d), f).unwrap();
    }
    check("no checked discharged leaf is refuted", total.leaf[2] == 0, format!("{} confirmed outright, {} beyond this checker's resolution at depth {}, {} refuted", total.leaf[0], total.leaf[1], refine, total.leaf[2]));
    check("no checked collapse is refuted", total.coll[2] == 0, format!("{} confirmed outright, {} beyond this checker's resolution at depth {}, {} refuted", total.coll[0], total.coll[1], refine, total.coll[2]));
    let conflicts = cert.conflicts.load(Ordering::Relaxed);
    check("no pair of enclosures of one quantity was disjoint (a disjoint pair means one is unsound)", conflicts == 0, format!("{} conflicts", conflicts));
    check("the verdicts account for exactly the shard's obligations", total.leaf.iter().sum::<u64>() == total.shard_leaves && total.coll.iter().sum::<u64>() == total.shard_colls, format!("{} leaves, {} collapses in roots {}:{}", total.shard_leaves, total.shard_colls, ra, rb));
    check("every obligation taken on is confirmed outright: none is beyond this checker's resolution", total.leaf[1] == 0 && total.coll[1] == 0, format!("{} leaves, {} collapses unresolved", total.leaf[1], total.coll[1]));
    let inputs_end = hash_inputs(&dev, &sources);
    check("no declared input changed while the run was in progress (hashes at start and end agree)", inputs_end == inputs_start, String::new());

    let bad: Vec<&(String, bool, String)> = checks.iter().filter(|c| !c.1).collect();
    println!("\n{} checks, {} failed", checks.len(), bad.len());
    let whole = ra == 0 && rb == roots.len();
    let status = if !bad.is_empty() {
        "incomplete".to_string()
    } else if whole {
        "complete".to_string()
    } else {
        format!("shard complete (roots {}:{} of {})", ra, rb, roots.len())
    };
    let secs = started.elapsed().as_secs_f64();
    println!("status: {}   ({:.1} s, {} boxes evaluated)", status, secs, total.boxes);
    let unresolved_keep: Vec<Value> = total.unresolved.iter().take(5000).cloned().collect();
    let rec = json!({
        "what": "independent replay and interval check of the sweep's subdivision proof (compiled checker, dev/tapecheck)",
        "status": status,
        "engine": format!("Rust, inari {} (IEEE 1788 intervals, double precision, correctly rounded); sine/cosine by reduction + Taylor with Lagrange remainder", "2"),
        "inputs": inputs_start,
        "inputs_hashed": "at start, before any work; re-hashed at the end and compared",
        "sources_unchanged_during_run": inputs_end == inputs_start,
        "options": {"meta": meta_name, "candidate": candidate, "refine": refine, "threads": threads, "roots": format!("{}:{}", ra, rb), "argv": args},
        "mode": "every node, inline",
        "candidate": candidate,
        "arithmetic_checked": total.shard_leaves + total.shard_colls,
        "refine_depth": refine,
        "sub_boxes_evaluated": total.boxes,
        "roots_shard": if whole { Value::Null } else { json!(format!("{}:{}", ra, rb)) },
        "roots_total": roots.len(),
        "shard_obligations": {"leaves": total.shard_leaves, "collapses": total.shard_colls, "skipped_leaves": 0, "skipped_collapses": 0},
        "unresolved_obligations": unresolved_keep,
        "tube": tube_record,
        "replay": format!("cd dev/tapecheck && cargo run --release -- {}", args.join(" ")),
        "tape_sha256": digest,
        "nodes": tape.len(), "leaves": w.leaves, "splits": w.splits, "collapses": w.collapses,
        "structure_checked": "all nodes",
        "leaf_sample": {"size": total.leaf.iter().sum::<u64>(), "confirmed": total.leaf[0], "beyond_resolution": total.leaf[1], "refuted": total.leaf[2]},
        "collapse_sample": {"size": total.coll.iter().sum::<u64>(), "confirmed": total.coll[0], "beyond_resolution": total.coll[1], "refuted": total.coll[2]},
        "breakpoint_tables": "consumed from kernel_pieces_arb.results.json (certified and proved complete in Arb), every entry re-checked here",
        "seconds": secs,
        "checks": checks.iter().map(|c| json!({"name": c.0, "ok": c.1})).collect::<Vec<_>>(),
    });
    fs::write(dev.join(&out_name), serde_json::to_string_pretty(&rec).unwrap()).unwrap();
    println!("wrote dev/{}", out_name);
    std::process::exit(if bad.is_empty() { 0 } else { 1 });
}
