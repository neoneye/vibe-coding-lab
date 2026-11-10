//! Numeric kernels: each forward has a matching backward that accumulates
//! into the gradient slices it is given. Tensors are flat, row-major.

use crate::F;

#[inline]
pub fn dot(a: &[F], b: &[F]) -> F {
    let mut acc = [0.0 as F; 8];
    let ca = a.chunks_exact(8);
    let cb = b.chunks_exact(8);
    let (ra, rb) = (ca.remainder(), cb.remainder());
    for (x, y) in ca.zip(cb) {
        for i in 0..8 {
            acc[i] += x[i] * y[i];
        }
    }
    let mut s = 0.0 as F;
    for i in 0..8 {
        s += acc[i];
    }
    for (x, y) in ra.iter().zip(rb) {
        s += x * y;
    }
    s
}

#[inline]
pub fn axpy(a: F, x: &[F], y: &mut [F]) {
    for (yi, xi) in y.iter_mut().zip(x) {
        *yi += a * xi;
    }
}

/// yrow[dout] += xrow[din] . w[din, dout]
#[inline]
fn tap_fwd(xrow: &[F], w: &[F], yrow: &mut [F]) {
    let dout = yrow.len();
    let din = xrow.len();
    let mut k = 0;
    // Four input channels per pass: one load/store of y for four products.
    while k + 4 <= din {
        let (x0, x1, x2, x3) = (xrow[k], xrow[k + 1], xrow[k + 2], xrow[k + 3]);
        let w0 = &w[k * dout..(k + 1) * dout];
        let w1 = &w[(k + 1) * dout..(k + 2) * dout];
        let w2 = &w[(k + 2) * dout..(k + 3) * dout];
        let w3 = &w[(k + 3) * dout..(k + 4) * dout];
        for j in 0..dout {
            yrow[j] += x0 * w0[j] + x1 * w1[j] + x2 * w2[j] + x3 * w3[j];
        }
        k += 4;
    }
    while k < din {
        axpy(xrow[k], &w[k * dout..(k + 1) * dout], yrow);
        k += 1;
    }
}

#[inline]
fn tap_bwd(xrow: &[F], w: &[F], dyrow: &[F], dxrow: Option<&mut [F]>, dw: Option<&mut [F]>) {
    let dout = dyrow.len();
    if let Some(dx) = dxrow {
        for (k, d) in dx.iter_mut().enumerate() {
            *d += dot(dyrow, &w[k * dout..(k + 1) * dout]);
        }
    }
    if let Some(dw) = dw {
        for (k, &xk) in xrow.iter().enumerate() {
            axpy(xk, dyrow, &mut dw[k * dout..(k + 1) * dout]);
        }
    }
}

/// y[rows, dout] += x[rows, din] . w[din, dout]
pub fn lin_acc(x: &[F], w: &[F], din: usize, dout: usize, y: &mut [F]) {
    for (xr, yr) in x.chunks_exact(din).zip(y.chunks_exact_mut(dout)) {
        tap_fwd(xr, w, yr);
    }
}

/// w[din, dout] -> [dout, din]
pub fn transpose(w: &[F], din: usize, dout: usize) -> Vec<F> {
    let mut t = vec![0.0 as F; w.len()];
    for k in 0..din {
        for j in 0..dout {
            t[j * din + k] = w[k * dout + j];
        }
    }
    t
}

/// Backward of `lin_acc`: dx += dy . w^T and dw += x^T . dy.
pub fn lin_bwd(x: &[F], w: &[F], dy: &[F], din: usize, dout: usize, dx: Option<&mut [F]>, dw: Option<&mut [F]>) {
    let rows = x.len() / din;
    if let Some(dx) = dx {
        let wt = transpose(w, din, dout);
        lin_acc(dy, &wt, dout, din, dx);
    }
    if let Some(dw) = dw {
        // dW[k, :] += sum_i x[i, k] * dy[i, :], four rows of the batch per pass.
        let mut i = 0;
        while i + 4 <= rows {
            let d0 = &dy[i * dout..(i + 1) * dout];
            let d1 = &dy[(i + 1) * dout..(i + 2) * dout];
            let d2 = &dy[(i + 2) * dout..(i + 3) * dout];
            let d3 = &dy[(i + 3) * dout..(i + 4) * dout];
            for k in 0..din {
                let (x0, x1, x2, x3) = (x[i * din + k], x[(i + 1) * din + k], x[(i + 2) * din + k], x[(i + 3) * din + k]);
                let dwr = &mut dw[k * dout..(k + 1) * dout];
                for j in 0..dout {
                    dwr[j] += x0 * d0[j] + x1 * d1[j] + x2 * d2[j] + x3 * d3[j];
                }
            }
            i += 4;
        }
        while i < rows {
            let dyr = &dy[i * dout..(i + 1) * dout];
            for k in 0..din {
                axpy(x[i * din + k], dyr, &mut dw[k * dout..(k + 1) * dout]);
            }
            i += 1;
        }
    }
}

/// y[rows, dout] = x[rows, din] . w[din, dout] + b
pub fn linear_fwd(x: &[F], w: &[F], b: Option<&[F]>, din: usize, dout: usize) -> Vec<F> {
    let rows = x.len() / din;
    let mut y = vec![0.0 as F; rows * dout];
    if let Some(b) = b {
        for yr in y.chunks_exact_mut(dout) {
            yr.copy_from_slice(b);
        }
    }
    lin_acc(x, w, din, dout, &mut y);
    y
}

pub fn linear_bwd(
    x: &[F],
    w: &[F],
    dy: &[F],
    din: usize,
    dout: usize,
    dx: Option<&mut [F]>,
    dw: Option<&mut [F]>,
    db: Option<&mut [F]>,
) {
    lin_bwd(x, w, dy, din, dout, dx, dw);
    if let Some(db) = db {
        for dyr in dy.chunks_exact(dout) {
            axpy(1.0 as F, dyr, db);
        }
    }
}

/// Layer norm over the last dimension `c`, learned gain and optional bias.
pub const LN_EPS: F = 1e-6;

pub fn layernorm_fwd(x: &[F], g: &[F], b: Option<&[F]>, c: usize) -> Vec<F> {
    let mut y = vec![0.0 as F; x.len()];
    for (xr, yr) in x.chunks_exact(c).zip(y.chunks_exact_mut(c)) {
        let mean = xr.iter().sum::<F>() / c as F;
        let var = xr.iter().map(|v| (v - mean) * (v - mean)).sum::<F>() / c as F;
        let inv = 1.0 / (var + LN_EPS).sqrt();
        for i in 0..c {
            yr[i] = (xr[i] - mean) * inv * g[i] + b.map_or(0.0 as F, |b| b[i]);
        }
    }
    y
}

pub fn layernorm_bwd(
    x: &[F],
    g: &[F],
    dy: &[F],
    c: usize,
    mut dx: Option<&mut [F]>,
    dg: &mut [F],
    mut db: Option<&mut [F]>,
) {
    let mut xh = vec![0.0 as F; c];
    let mut dxh = vec![0.0 as F; c];
    for (r, (xr, dyr)) in x.chunks_exact(c).zip(dy.chunks_exact(c)).enumerate() {
        let mean = xr.iter().sum::<F>() / c as F;
        let var = xr.iter().map(|v| (v - mean) * (v - mean)).sum::<F>() / c as F;
        let inv = 1.0 / (var + LN_EPS).sqrt();
        let (mut m1, mut m2) = (0.0 as F, 0.0 as F);
        for i in 0..c {
            xh[i] = (xr[i] - mean) * inv;
            dxh[i] = dyr[i] * g[i];
            dg[i] += dyr[i] * xh[i];
            m1 += dxh[i];
            m2 += dxh[i] * xh[i];
        }
        if let Some(db) = db.as_deref_mut() {
            axpy(1.0 as F, dyr, db);
        }
        if let Some(dx) = dx.as_deref_mut() {
            let (m1, m2) = (m1 / c as F, m2 / c as F);
            let dxr = &mut dx[r * c..(r + 1) * c];
            for i in 0..c {
                dxr[i] += (dxh[i] - m1 - xh[i] * m2) * inv;
            }
        }
    }
}

/// RMS norm over the last dimension `c` with a learned weight (QK norm).
pub fn rmsnorm_fwd(x: &[F], w: &[F], c: usize) -> Vec<F> {
    let mut y = vec![0.0 as F; x.len()];
    for (xr, yr) in x.chunks_exact(c).zip(y.chunks_exact_mut(c)) {
        let r = 1.0 / (dot(xr, xr) / c as F + LN_EPS).sqrt();
        for i in 0..c {
            yr[i] = xr[i] * r * w[i];
        }
    }
    y
}

pub fn rmsnorm_bwd(x: &[F], w: &[F], dy: &[F], c: usize, dx: &mut [F], dw: &mut [F]) {
    for (r_i, (xr, dyr)) in x.chunks_exact(c).zip(dy.chunks_exact(c)).enumerate() {
        let r = 1.0 / (dot(xr, xr) / c as F + LN_EPS).sqrt();
        let mut ux = 0.0 as F;
        for i in 0..c {
            dw[i] += dyr[i] * xr[i] * r;
            ux += dyr[i] * w[i] * xr[i];
        }
        let k = r * r * r * ux / c as F;
        let dxr = &mut dx[r_i * c..(r_i + 1) * c];
        for i in 0..c {
            dxr[i] += dyr[i] * w[i] * r - xr[i] * k;
        }
    }
}

/// Group norm without affine over x[n, l, c]: each sample's channel group is
/// normalised across all positions (nn.GroupNorm on [B, C, L]).
pub const GN_EPS: F = 1e-5;

fn gn_stats(xs: &[F], l: usize, c: usize, g0: usize, gc: usize) -> (F, F) {
    let m = (l * gc) as F;
    let mut mean = 0.0 as F;
    for t in 0..l {
        for ch in g0..g0 + gc {
            mean += xs[t * c + ch];
        }
    }
    mean /= m;
    let mut var = 0.0 as F;
    for t in 0..l {
        for ch in g0..g0 + gc {
            let d = xs[t * c + ch] - mean;
            var += d * d;
        }
    }
    (mean, 1.0 / (var / m + GN_EPS).sqrt())
}

pub fn groupnorm_fwd(x: &[F], n: usize, l: usize, c: usize, groups: usize) -> Vec<F> {
    let gc = c / groups;
    let mut y = vec![0.0 as F; x.len()];
    for s in 0..n {
        let xs = &x[s * l * c..(s + 1) * l * c];
        let ys = &mut y[s * l * c..(s + 1) * l * c];
        for g in 0..groups {
            let (mean, inv) = gn_stats(xs, l, c, g * gc, gc);
            for t in 0..l {
                for ch in g * gc..(g + 1) * gc {
                    ys[t * c + ch] = (xs[t * c + ch] - mean) * inv;
                }
            }
        }
    }
    y
}

pub fn groupnorm_bwd(x: &[F], dy: &[F], n: usize, l: usize, c: usize, groups: usize, dx: &mut [F]) {
    let gc = c / groups;
    let m = (l * gc) as F;
    for s in 0..n {
        let xs = &x[s * l * c..(s + 1) * l * c];
        let dys = &dy[s * l * c..(s + 1) * l * c];
        let dxs = &mut dx[s * l * c..(s + 1) * l * c];
        for g in 0..groups {
            let (mean, inv) = gn_stats(xs, l, c, g * gc, gc);
            let (mut m1, mut m2) = (0.0 as F, 0.0 as F);
            for t in 0..l {
                for ch in g * gc..(g + 1) * gc {
                    let i = t * c + ch;
                    m1 += dys[i];
                    m2 += dys[i] * (xs[i] - mean) * inv;
                }
            }
            let (m1, m2) = (m1 / m, m2 / m);
            for t in 0..l {
                for ch in g * gc..(g + 1) * gc {
                    let i = t * c + ch;
                    dxs[i] += (dys[i] - m1 - (xs[i] - mean) * inv * m2) * inv;
                }
            }
        }
    }
}

/// GELU, tanh approximation.
const GELU_A: F = 0.797_884_560_802_865_4; // sqrt(2/pi)
const GELU_B: F = 0.044715;

pub fn gelu_fwd(x: &[F]) -> Vec<F> {
    x.iter()
        .map(|&v| 0.5 * v * (1.0 + (GELU_A * (v + GELU_B * v * v * v)).tanh()))
        .collect()
}

pub fn gelu_bwd(x: &[F], dy: &[F], dx: &mut [F]) {
    for i in 0..x.len() {
        let v = x[i];
        let th = (GELU_A * (v + GELU_B * v * v * v)).tanh();
        let d = 0.5 * (1.0 + th) + 0.5 * v * (1.0 - th * th) * GELU_A * (1.0 + 3.0 * GELU_B * v * v);
        dx[i] += dy[i] * d;
    }
}

/// Conv1d, kernel 3, same padding, over x[n, l, c]. w is [3, c, c] as
/// (tap, in, out); tap 0 reads position t-1.
pub fn conv3_fwd(x: &[F], w: &[F], b: &[F], n: usize, l: usize, c: usize) -> Vec<F> {
    let mut y = vec![0.0 as F; x.len()];
    for yr in y.chunks_exact_mut(c) {
        yr.copy_from_slice(b);
    }
    for s in 0..n {
        for tap in 0..3 {
            let (xa, ya, len) = conv3_range(tap, l);
            let (xo, yo) = ((s * l + xa) * c, (s * l + ya) * c);
            lin_acc(&x[xo..xo + len * c], &w[tap * c * c..(tap + 1) * c * c], c, c, &mut y[yo..yo + len * c]);
        }
    }
    y
}

/// For a tap: first input position, first output position, run length.
fn conv3_range(tap: usize, l: usize) -> (usize, usize, usize) {
    match tap {
        0 => (0, 1, l - 1),
        1 => (0, 0, l),
        _ => (1, 0, l - 1),
    }
}

pub fn conv3_bwd(
    x: &[F],
    w: &[F],
    dy: &[F],
    n: usize,
    l: usize,
    c: usize,
    mut dx: Option<&mut [F]>,
    dw: &mut [F],
    db: &mut [F],
) {
    for dyr in dy.chunks_exact(c) {
        axpy(1.0 as F, dyr, db);
    }
    for s in 0..n {
        for tap in 0..3 {
            let (xa, ya, len) = conv3_range(tap, l);
            let (xo, yo) = ((s * l + xa) * c, (s * l + ya) * c);
            lin_bwd(
                &x[xo..xo + len * c],
                &w[tap * c * c..(tap + 1) * c * c],
                &dy[yo..yo + len * c],
                c,
                c,
                dx.as_deref_mut().map(|d| &mut d[xo..xo + len * c]),
                Some(&mut dw[tap * c * c..(tap + 1) * c * c]),
            );
        }
    }
}

/// Strided conv with kernel = stride: x[n, lin, c] -> y[n, lin/stride, c].
/// w is [stride, c, c] as (tap, in, out).
pub fn strided_down_fwd(x: &[F], w: &[F], b: &[F], n: usize, lin: usize, stride: usize, c: usize) -> Vec<F> {
    let lout = lin / stride;
    let mut y = vec![0.0 as F; n * lout * c];
    for s in 0..n {
        for j in 0..lout {
            let yr = &mut y[(s * lout + j) * c..(s * lout + j + 1) * c];
            yr.copy_from_slice(b);
            for tap in 0..stride {
                let xi = (s * lin + j * stride + tap) * c;
                tap_fwd(&x[xi..xi + c], &w[tap * c * c..(tap + 1) * c * c], yr);
            }
        }
    }
    y
}

pub fn strided_down_bwd(
    x: &[F],
    w: &[F],
    dy: &[F],
    n: usize,
    lin: usize,
    stride: usize,
    c: usize,
    mut dx: Option<&mut [F]>,
    dw: &mut [F],
    db: &mut [F],
) {
    let lout = lin / stride;
    for s in 0..n {
        for j in 0..lout {
            let dyr = &dy[(s * lout + j) * c..(s * lout + j + 1) * c];
            axpy(1.0 as F, dyr, db);
            for tap in 0..stride {
                let xi = (s * lin + j * stride + tap) * c;
                tap_bwd(
                    &x[xi..xi + c],
                    &w[tap * c * c..(tap + 1) * c * c],
                    dyr,
                    dx.as_deref_mut().map(|d| &mut d[xi..xi + c]),
                    Some(&mut dw[tap * c * c..(tap + 1) * c * c]),
                );
            }
        }
    }
}

/// Transposed conv with kernel = stride: x[n, lin, c] -> y[n, lin*stride, c].
pub fn strided_up_fwd(x: &[F], w: &[F], b: &[F], n: usize, lin: usize, stride: usize, c: usize) -> Vec<F> {
    let lout = lin * stride;
    let mut y = vec![0.0 as F; n * lout * c];
    for s in 0..n {
        for j in 0..lin {
            let xi = (s * lin + j) * c;
            for tap in 0..stride {
                let yi = (s * lout + j * stride + tap) * c;
                let yr = &mut y[yi..yi + c];
                yr.copy_from_slice(b);
                tap_fwd(&x[xi..xi + c], &w[tap * c * c..(tap + 1) * c * c], yr);
            }
        }
    }
    y
}

pub fn strided_up_bwd(
    x: &[F],
    w: &[F],
    dy: &[F],
    n: usize,
    lin: usize,
    stride: usize,
    c: usize,
    mut dx: Option<&mut [F]>,
    dw: &mut [F],
    db: &mut [F],
) {
    let lout = lin * stride;
    for s in 0..n {
        for j in 0..lin {
            let xi = (s * lin + j) * c;
            for tap in 0..stride {
                let yi = (s * lout + j * stride + tap) * c;
                let dyr = &dy[yi..yi + c];
                axpy(1.0 as F, dyr, db);
                tap_bwd(
                    &x[xi..xi + c],
                    &w[tap * c * c..(tap + 1) * c * c],
                    dyr,
                    dx.as_deref_mut().map(|d| &mut d[xi..xi + c]),
                    Some(&mut dw[tap * c * c..(tap + 1) * c * c]),
                );
            }
        }
    }
}

/// F.interpolate(mode="area"): adaptive average pooling along the sequence.
fn area_bin(i: usize, lin: usize, lout: usize) -> (usize, usize) {
    let a = i * lin / lout;
    let b = ((i + 1) * lin + lout - 1) / lout;
    (a, b)
}

pub fn area_pool_fwd(x: &[F], n: usize, lin: usize, lout: usize, c: usize) -> Vec<F> {
    let mut y = vec![0.0 as F; n * lout * c];
    for s in 0..n {
        for i in 0..lout {
            let (a, b) = area_bin(i, lin, lout);
            let inv = 1.0 / (b - a) as F;
            let yr = &mut y[(s * lout + i) * c..(s * lout + i + 1) * c];
            for t in a..b {
                axpy(inv, &x[(s * lin + t) * c..(s * lin + t + 1) * c], yr);
            }
        }
    }
    y
}

pub fn area_pool_bwd(dy: &[F], n: usize, lin: usize, lout: usize, c: usize, dx: &mut [F]) {
    for s in 0..n {
        for i in 0..lout {
            let (a, b) = area_bin(i, lin, lout);
            let inv = 1.0 / (b - a) as F;
            let dyr = &dy[(s * lout + i) * c..(s * lout + i + 1) * c];
            for t in a..b {
                axpy(inv, dyr, &mut dx[(s * lin + t) * c..(s * lin + t + 1) * c]);
            }
        }
    }
}

/// F.interpolate(mode="linear", align_corners=False) along the sequence.
fn lerp_src(i: usize, lin: usize, lout: usize) -> (usize, usize, F) {
    let src = ((i as f64 + 0.5) * lin as f64 / lout as f64 - 0.5).max(0.0);
    let i0 = (src.floor() as usize).min(lin - 1);
    let i1 = (i0 + 1).min(lin - 1);
    (i0, i1, (src - i0 as f64) as F)
}

pub fn lerp_up_fwd(x: &[F], n: usize, lin: usize, lout: usize, c: usize) -> Vec<F> {
    let mut y = vec![0.0 as F; n * lout * c];
    for s in 0..n {
        for i in 0..lout {
            let (i0, i1, w) = lerp_src(i, lin, lout);
            let yr = &mut y[(s * lout + i) * c..(s * lout + i + 1) * c];
            axpy(1.0 - w, &x[(s * lin + i0) * c..(s * lin + i0 + 1) * c], yr);
            axpy(w, &x[(s * lin + i1) * c..(s * lin + i1 + 1) * c], yr);
        }
    }
    y
}

pub fn lerp_up_bwd(dy: &[F], n: usize, lin: usize, lout: usize, c: usize, dx: &mut [F]) {
    for s in 0..n {
        for i in 0..lout {
            let (i0, i1, w) = lerp_src(i, lin, lout);
            let dyr = &dy[(s * lout + i) * c..(s * lout + i + 1) * c];
            axpy(1.0 - w, dyr, &mut dx[(s * lin + i0) * c..(s * lin + i0 + 1) * c]);
            axpy(w, dyr, &mut dx[(s * lin + i1) * c..(s * lin + i1 + 1) * c]);
        }
    }
}

/// Queries in `start..start+len` attend to keys in `0..prefix` and in
/// `start..start+len`. Positions covered by no segment output zero.
#[derive(Clone, Copy, Debug)]
pub struct Seg {
    pub start: usize,
    pub len: usize,
    pub prefix: usize,
}

/// Rotary position tables, one row per sequence index.
pub struct Rope {
    pub cos: Vec<F>,
    pub sin: Vec<F>,
    pub half: usize,
}

impl Rope {
    pub fn new(positions: &[usize], head_dim: usize, base: f64) -> Rope {
        let half = head_dim / 2;
        let mut cos = Vec::with_capacity(positions.len() * half);
        let mut sin = Vec::with_capacity(positions.len() * half);
        for &p in positions {
            for i in 0..half {
                let f = p as f64 / base.powf(i as f64 / half as f64);
                cos.push(f.cos() as F);
                sin.push(f.sin() as F);
            }
        }
        Rope { cos, sin, half }
    }
    fn rotate(&self, x: &mut [F], t: usize, heads: usize) {
        let h = self.half;
        for (pos, row) in x.chunks_exact_mut(heads * 2 * h).enumerate() {
            let p = pos % t;
            for head in row.chunks_exact_mut(2 * h) {
                for i in 0..h {
                    let (c, s) = (self.cos[p * h + i], self.sin[p * h + i]);
                    let (a, b) = (head[i], head[i + h]);
                    head[i] = a * c - b * s;
                    head[i + h] = b * c + a * s;
                }
            }
        }
    }
    fn unrotate(&self, x: &mut [F], t: usize, heads: usize) {
        let h = self.half;
        for (pos, row) in x.chunks_exact_mut(heads * 2 * h).enumerate() {
            let p = pos % t;
            for head in row.chunks_exact_mut(2 * h) {
                for i in 0..h {
                    let (c, s) = (self.cos[p * h + i], self.sin[p * h + i]);
                    let (a, b) = (head[i], head[i + h]);
                    head[i] = a * c + b * s;
                    head[i + h] = b * c - a * s;
                }
            }
        }
    }
}

/// What the attention backward needs from the forward.
pub struct AttnCache {
    pub qr: Vec<F>,
    pub kr: Vec<F>,
    pub probs: Vec<F>,
}

#[inline]
fn seg_key(seg: &Seg, j: usize) -> usize {
    if j < seg.prefix {
        j
    } else {
        seg.start + j - seg.prefix
    }
}

/// Scaled dot-product attention over q, k, v of shape [n, t, heads*hd].
pub fn attn_fwd(
    q: &[F],
    k: &[F],
    v: &[F],
    n: usize,
    t: usize,
    heads: usize,
    hd: usize,
    segs: &[Seg],
    rope: Option<&Rope>,
) -> (Vec<F>, AttnCache) {
    let c = heads * hd;
    let mut qr = q.to_vec();
    let mut kr = k.to_vec();
    if let Some(r) = rope {
        r.rotate(&mut qr, t, heads);
        r.rotate(&mut kr, t, heads);
    }
    let scale = 1.0 / (hd as F).sqrt();
    let mut out = vec![0.0 as F; n * t * c];
    let mut probs = Vec::new();
    let mut sc = Vec::new();
    for b in 0..n {
        for seg in segs {
            let nk = seg.prefix + seg.len;
            sc.resize(nk, 0.0 as F);
            for h in 0..heads {
                for qi in seg.start..seg.start + seg.len {
                    let qo = (b * t + qi) * c + h * hd;
                    let qv = &qr[qo..qo + hd];
                    let mut mx = F::NEG_INFINITY;
                    for j in 0..nk {
                        let ko = (b * t + seg_key(seg, j)) * c + h * hd;
                        sc[j] = dot(qv, &kr[ko..ko + hd]) * scale;
                        mx = mx.max(sc[j]);
                    }
                    let mut sum = 0.0 as F;
                    for s in sc.iter_mut() {
                        *s = (*s - mx).exp();
                        sum += *s;
                    }
                    let o = &mut out[qo..qo + hd];
                    for j in 0..nk {
                        let p = sc[j] / sum;
                        probs.push(p);
                        let vo = (b * t + seg_key(seg, j)) * c + h * hd;
                        axpy(p, &v[vo..vo + hd], o);
                    }
                }
            }
        }
    }
    (out, AttnCache { qr, kr, probs })
}

pub fn attn_bwd(
    cache: &AttnCache,
    v: &[F],
    dout: &[F],
    n: usize,
    t: usize,
    heads: usize,
    hd: usize,
    segs: &[Seg],
    rope: Option<&Rope>,
    dq: &mut [F],
    dk: &mut [F],
    dv: &mut [F],
) {
    let c = heads * hd;
    let scale = 1.0 / (hd as F).sqrt();
    let mut dqr = vec![0.0 as F; n * t * c];
    let mut dkr = vec![0.0 as F; n * t * c];
    let mut dp = Vec::new();
    let mut pi = 0;
    for b in 0..n {
        for seg in segs {
            let nk = seg.prefix + seg.len;
            dp.resize(nk, 0.0 as F);
            for h in 0..heads {
                for qi in seg.start..seg.start + seg.len {
                    let qo = (b * t + qi) * c + h * hd;
                    let d = &dout[qo..qo + hd];
                    let p = &cache.probs[pi..pi + nk];
                    pi += nk;
                    let mut mean = 0.0 as F;
                    for j in 0..nk {
                        let vo = (b * t + seg_key(seg, j)) * c + h * hd;
                        dp[j] = dot(d, &v[vo..vo + hd]);
                        mean += p[j] * dp[j];
                        axpy(p[j], d, &mut dv[vo..vo + hd]);
                    }
                    for j in 0..nk {
                        let ds = p[j] * (dp[j] - mean) * scale;
                        let ko = (b * t + seg_key(seg, j)) * c + h * hd;
                        // dqr and dkr are separate buffers, so these never alias.
                        axpy(ds, &cache.kr[ko..ko + hd], &mut dqr[qo..qo + hd]);
                        axpy(ds, &cache.qr[qo..qo + hd], &mut dkr[ko..ko + hd]);
                    }
                }
            }
        }
    }
    if let Some(r) = rope {
        r.unrotate(&mut dqr, t, heads);
        r.unrotate(&mut dkr, t, heads);
    }
    axpy(1.0 as F, &dqr, dq);
    axpy(1.0 as F, &dkr, dk);
}

/// Weighted softmax cross-entropy over rows of `v` logits. Returns the loss
/// and d(loss)/d(logits).
pub fn softmax_xent(logits: &[F], targets: &[u32], weights: &[F], v: usize) -> (F, Vec<F>) {
    let mut d = vec![0.0 as F; logits.len()];
    let mut loss = 0.0 as F;
    for (i, (lr, dr)) in logits.chunks_exact(v).zip(d.chunks_exact_mut(v)).enumerate() {
        let mx = lr.iter().cloned().fold(F::NEG_INFINITY, F::max);
        let mut sum = 0.0 as F;
        for j in 0..v {
            dr[j] = (lr[j] - mx).exp();
            sum += dr[j];
        }
        let tg = targets[i] as usize;
        let w = weights[i];
        loss += w * (sum.ln() - (lr[tg] - mx));
        for j in 0..v {
            dr[j] = w * dr[j] / sum;
        }
        dr[tg] -= w;
    }
    (loss, d)
}

/// Index of the largest entry in each row of `v`.
pub fn argmax_rows(x: &[F], v: usize) -> Vec<u32> {
    x.chunks_exact(v)
        .map(|r| {
            let mut best = 0;
            for j in 1..v {
                if r[j] > r[best] {
                    best = j;
                }
            }
            best as u32
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: &[F], b: &[F]) {
        assert_eq!(a.len(), b.len());
        for (x, y) in a.iter().zip(b) {
            assert!((x - y).abs() < 1e-5, "{:?} vs {:?}", a, b);
        }
    }

    #[test]
    fn area_pool_values() {
        let x: Vec<F> = vec![1., 2., 3., 4., 5., 6.];
        close(&area_pool_fwd(&x, 1, 6, 3, 1), &[1.5, 3.5, 5.5]);
        close(&area_pool_fwd(&x, 1, 6, 4, 1), &[1.5, 2.5, 4.5, 5.5]);
    }

    #[test]
    fn lerp_up_values() {
        close(&lerp_up_fwd(&[0., 1.], 1, 2, 4, 1), &[0., 0.25, 0.75, 1.]);
    }

    #[test]
    fn strided_down_avg_init_equals_area_pool() {
        let (c, stride, lin) = (2, 4, 8);
        let mut w = vec![0.0 as F; stride * c * c];
        for tap in 0..stride {
            for ch in 0..c {
                w[tap * c * c + ch * c + ch] = 1.0 / stride as F;
            }
        }
        let x: Vec<F> = (0..lin * c).map(|i| (i * i % 7) as F).collect();
        let y = strided_down_fwd(&x, &w, &[0., 0.], 1, lin, stride, c);
        close(&y, &area_pool_fwd(&x, 1, lin, lin / stride, c));
    }

    #[test]
    fn strided_up_identity_init_equals_repeat() {
        let (c, stride, lin) = (2, 3, 2);
        let mut w = vec![0.0 as F; stride * c * c];
        for tap in 0..stride {
            for ch in 0..c {
                w[tap * c * c + ch * c + ch] = 1.0;
            }
        }
        let x: Vec<F> = vec![1., 2., 3., 4.];
        let y = strided_up_fwd(&x, &w, &[0., 0.], 1, lin, stride, c);
        close(&y, &[1., 2., 1., 2., 1., 2., 3., 4., 3., 4., 3., 4.]);
    }

    #[test]
    fn xent_uniform_logits() {
        let (loss, d) = softmax_xent(&[0., 0., 0., 0.], &[2], &[1.0], 4);
        assert!((loss - (4.0 as F).ln()).abs() < 1e-6);
        close(&d, &[0.25, 0.25, -0.75, 0.25]);
    }
}
