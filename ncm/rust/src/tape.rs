//! A small reverse-mode tape over the kernels in `ops`. Each node is a flat
//! tensor; shapes travel as explicit arguments.

use crate::ops::*;
use crate::param::Param;
use crate::F;
use std::mem::take;
use std::rc::Rc;

pub type Id = usize;

enum Op {
    Leaf,
    Linear { x: Id, w: Id, b: Option<Id>, din: usize, dout: usize },
    Add(Id, Id),
    Sub(Id, Id),
    Scale(Id, F),
    MulScalar { a: Id, s: Id },
    Exp(Id),
    Tile { x: Id, reps: usize },
    Embed { table: Id, ids: Vec<u32>, c: usize },
    LayerNorm { x: Id, g: Id, b: Option<Id>, c: usize },
    RmsNorm { x: Id, w: Id, c: usize },
    GroupNorm { x: Id, n: usize, l: usize, c: usize, groups: usize },
    Gelu(Id),
    Conv3 { x: Id, w: Id, b: Id, n: usize, l: usize, c: usize },
    Down { x: Id, w: Id, b: Id, n: usize, lin: usize, stride: usize, c: usize },
    Up { x: Id, w: Id, b: Id, n: usize, lin: usize, stride: usize, c: usize },
    AreaPool { x: Id, n: usize, lin: usize, lout: usize, c: usize },
    LerpUp { x: Id, n: usize, lin: usize, lout: usize, c: usize },
    Attn {
        q: Id,
        k: Id,
        v: Id,
        n: usize,
        t: usize,
        heads: usize,
        hd: usize,
        segs: Rc<Vec<Seg>>,
        rope: Option<Rc<Rope>>,
        cache: AttnCache,
    },
    Xent { logits: Id, d: Vec<F> },
    Mse(Id, Id),
    Slice { x: Id, n: usize, t: usize, start: usize, len: usize, c: usize },
    Concat { parts: Vec<(Id, usize)>, n: usize, c: usize },
}

#[derive(Default)]
pub struct Tape {
    vals: Vec<Vec<F>>,
    grads: Vec<Vec<F>>,
    ops: Vec<Op>,
    need: Vec<bool>,
}

/// Takes the gradient buffer of `id` out of the table, allocating it on first use.
fn tk(grads: &mut [Vec<F>], id: Id, len: usize) -> Vec<F> {
    let g = take(&mut grads[id]);
    if g.is_empty() {
        vec![0.0 as F; len]
    } else {
        g
    }
}

impl Tape {
    pub fn new() -> Tape {
        Tape::default()
    }

    fn push(&mut self, val: Vec<F>, op: Op, need: bool) -> Id {
        self.vals.push(val);
        self.grads.push(Vec::new());
        self.ops.push(op);
        self.need.push(need);
        self.vals.len() - 1
    }

    pub fn val(&self, id: Id) -> &[F] {
        &self.vals[id]
    }
    pub fn grad(&self, id: Id) -> &[F] {
        &self.grads[id]
    }
    pub fn scalar(&self, id: Id) -> F {
        self.vals[id][0]
    }

    /// A value that receives no gradient.
    pub fn constant(&mut self, v: Vec<F>) -> Id {
        self.push(v, Op::Leaf, false)
    }
    /// A leaf whose gradient is kept (parameters, test inputs).
    pub fn leaf(&mut self, v: Vec<F>) -> Id {
        self.push(v, Op::Leaf, true)
    }
    pub fn param(&mut self, p: &Param) -> Id {
        let id = self.leaf(p.w.clone());
        p.id.set(id);
        id
    }
    pub fn detach(&mut self, a: Id) -> Id {
        let v = self.vals[a].clone();
        self.constant(v)
    }

    pub fn linear(&mut self, x: Id, w: Id, b: Option<Id>, din: usize, dout: usize) -> Id {
        let y = linear_fwd(&self.vals[x], &self.vals[w], b.map(|b| &self.vals[b][..]), din, dout);
        let need = self.need[x] || self.need[w] || b.map_or(false, |b| self.need[b]);
        self.push(y, Op::Linear { x, w, b, din, dout }, need)
    }
    pub fn add(&mut self, a: Id, b: Id) -> Id {
        let y = self.vals[a].iter().zip(&self.vals[b]).map(|(x, y)| x + y).collect();
        let need = self.need[a] || self.need[b];
        self.push(y, Op::Add(a, b), need)
    }
    pub fn sub(&mut self, a: Id, b: Id) -> Id {
        let y = self.vals[a].iter().zip(&self.vals[b]).map(|(x, y)| x - y).collect();
        let need = self.need[a] || self.need[b];
        self.push(y, Op::Sub(a, b), need)
    }
    pub fn scale(&mut self, a: Id, s: F) -> Id {
        let y = self.vals[a].iter().map(|x| x * s).collect();
        let need = self.need[a];
        self.push(y, Op::Scale(a, s), need)
    }
    /// Multiplies every element of `a` by the one-element node `s`.
    pub fn mul_scalar(&mut self, a: Id, s: Id) -> Id {
        let sv = self.vals[s][0];
        let y = self.vals[a].iter().map(|x| x * sv).collect();
        let need = self.need[a] || self.need[s];
        self.push(y, Op::MulScalar { a, s }, need)
    }
    pub fn exp(&mut self, a: Id) -> Id {
        let y = self.vals[a].iter().map(|x| x.exp()).collect();
        let need = self.need[a];
        self.push(y, Op::Exp(a), need)
    }
    pub fn tile(&mut self, x: Id, reps: usize) -> Id {
        let v = &self.vals[x];
        let mut y = Vec::with_capacity(v.len() * reps);
        for _ in 0..reps {
            y.extend_from_slice(v);
        }
        let need = self.need[x];
        self.push(y, Op::Tile { x, reps }, need)
    }
    pub fn embed(&mut self, table: Id, ids: &[u32], c: usize) -> Id {
        let tv = &self.vals[table];
        let mut y = Vec::with_capacity(ids.len() * c);
        for &i in ids {
            y.extend_from_slice(&tv[i as usize * c..(i as usize + 1) * c]);
        }
        let need = self.need[table];
        self.push(y, Op::Embed { table, ids: ids.to_vec(), c }, need)
    }
    pub fn layernorm(&mut self, x: Id, g: Id, b: Option<Id>, c: usize) -> Id {
        let y = layernorm_fwd(&self.vals[x], &self.vals[g], b.map(|b| &self.vals[b][..]), c);
        self.push(y, Op::LayerNorm { x, g, b, c }, true)
    }
    pub fn rmsnorm(&mut self, x: Id, w: Id, c: usize) -> Id {
        let y = rmsnorm_fwd(&self.vals[x], &self.vals[w], c);
        self.push(y, Op::RmsNorm { x, w, c }, true)
    }
    pub fn groupnorm(&mut self, x: Id, n: usize, l: usize, c: usize, groups: usize) -> Id {
        let y = groupnorm_fwd(&self.vals[x], n, l, c, groups);
        let need = self.need[x];
        self.push(y, Op::GroupNorm { x, n, l, c, groups }, need)
    }
    pub fn gelu(&mut self, x: Id) -> Id {
        let y = gelu_fwd(&self.vals[x]);
        let need = self.need[x];
        self.push(y, Op::Gelu(x), need)
    }
    pub fn conv3(&mut self, x: Id, w: Id, b: Id, n: usize, l: usize, c: usize) -> Id {
        let y = conv3_fwd(&self.vals[x], &self.vals[w], &self.vals[b], n, l, c);
        self.push(y, Op::Conv3 { x, w, b, n, l, c }, true)
    }
    pub fn down(&mut self, x: Id, w: Id, b: Id, n: usize, lin: usize, stride: usize, c: usize) -> Id {
        let y = strided_down_fwd(&self.vals[x], &self.vals[w], &self.vals[b], n, lin, stride, c);
        self.push(y, Op::Down { x, w, b, n, lin, stride, c }, true)
    }
    pub fn up(&mut self, x: Id, w: Id, b: Id, n: usize, lin: usize, stride: usize, c: usize) -> Id {
        let y = strided_up_fwd(&self.vals[x], &self.vals[w], &self.vals[b], n, lin, stride, c);
        self.push(y, Op::Up { x, w, b, n, lin, stride, c }, true)
    }
    pub fn area_pool(&mut self, x: Id, n: usize, lin: usize, lout: usize, c: usize) -> Id {
        let y = area_pool_fwd(&self.vals[x], n, lin, lout, c);
        let need = self.need[x];
        self.push(y, Op::AreaPool { x, n, lin, lout, c }, need)
    }
    pub fn lerp_up(&mut self, x: Id, n: usize, lin: usize, lout: usize, c: usize) -> Id {
        let y = lerp_up_fwd(&self.vals[x], n, lin, lout, c);
        let need = self.need[x];
        self.push(y, Op::LerpUp { x, n, lin, lout, c }, need)
    }
    #[allow(clippy::too_many_arguments)]
    pub fn attn(
        &mut self,
        q: Id,
        k: Id,
        v: Id,
        n: usize,
        t: usize,
        heads: usize,
        hd: usize,
        segs: &Rc<Vec<Seg>>,
        rope: Option<&Rc<Rope>>,
    ) -> Id {
        let (y, cache) = attn_fwd(
            &self.vals[q],
            &self.vals[k],
            &self.vals[v],
            n,
            t,
            heads,
            hd,
            segs,
            rope.map(|r| &**r),
        );
        self.push(
            y,
            Op::Attn { q, k, v, n, t, heads, hd, segs: segs.clone(), rope: rope.cloned(), cache },
            true,
        )
    }
    /// Weighted cross-entropy summed over rows; a one-element node.
    pub fn xent(&mut self, logits: Id, targets: &[u32], weights: &[F], v: usize) -> Id {
        let (loss, d) = softmax_xent(&self.vals[logits], targets, weights, v);
        let need = self.need[logits];
        self.push(vec![loss], Op::Xent { logits, d }, need)
    }
    /// Mean squared difference; a one-element node.
    pub fn mse(&mut self, a: Id, b: Id) -> Id {
        let (va, vb) = (&self.vals[a], &self.vals[b]);
        let s: F = va.iter().zip(vb).map(|(x, y)| (x - y) * (x - y)).sum();
        let y = vec![s / va.len() as F];
        let need = self.need[a] || self.need[b];
        self.push(y, Op::Mse(a, b), need)
    }
    /// Positions `start..start+len` of x[n, t, c].
    pub fn slice(&mut self, x: Id, n: usize, t: usize, start: usize, len: usize, c: usize) -> Id {
        let v = &self.vals[x];
        let mut y = Vec::with_capacity(n * len * c);
        for s in 0..n {
            y.extend_from_slice(&v[(s * t + start) * c..(s * t + start + len) * c]);
        }
        let need = self.need[x];
        self.push(y, Op::Slice { x, n, t, start, len, c }, need)
    }
    /// Concatenates parts [n, len_i, c] along the sequence.
    pub fn concat(&mut self, parts: &[(Id, usize)], n: usize, c: usize) -> Id {
        let total: usize = parts.iter().map(|p| p.1).sum();
        let mut y = Vec::with_capacity(n * total * c);
        for s in 0..n {
            for &(id, len) in parts {
                y.extend_from_slice(&self.vals[id][s * len * c..(s + 1) * len * c]);
            }
        }
        let need = parts.iter().any(|p| self.need[p.0]);
        self.push(y, Op::Concat { parts: parts.to_vec(), n, c }, need)
    }

    /// Back-propagates from the one-element node `root`.
    pub fn backward(&mut self, root: Id) {
        self.grads[root] = vec![1.0 as F];
        let Tape { vals, grads, ops, need } = self;
        for i in (0..=root).rev() {
            if matches!(ops[i], Op::Leaf) || grads[i].is_empty() || !need[i] {
                continue;
            }
            let g = take(&mut grads[i]);
            match &ops[i] {
                Op::Leaf => {}
                Op::Linear { x, w, b, din, dout } => {
                    let mut dx = if need[*x] { Some(tk(grads, *x, vals[*x].len())) } else { None };
                    let mut dw = if need[*w] { Some(tk(grads, *w, vals[*w].len())) } else { None };
                    let mut db = match b {
                        Some(b) if need[*b] => Some(tk(grads, *b, vals[*b].len())),
                        _ => None,
                    };
                    linear_bwd(&vals[*x], &vals[*w], &g, *din, *dout, dx.as_deref_mut(), dw.as_deref_mut(), db.as_deref_mut());
                    if let Some(d) = dx {
                        grads[*x] = d;
                    }
                    if let Some(d) = dw {
                        grads[*w] = d;
                    }
                    if let (Some(d), Some(b)) = (db, b) {
                        grads[*b] = d;
                    }
                }
                Op::Add(a, b) => {
                    for id in [*a, *b] {
                        if need[id] {
                            let mut d = tk(grads, id, g.len());
                            axpy(1.0 as F, &g, &mut d);
                            grads[id] = d;
                        }
                    }
                }
                Op::Sub(a, b) => {
                    for (id, s) in [(*a, 1.0 as F), (*b, -1.0 as F)] {
                        if need[id] {
                            let mut d = tk(grads, id, g.len());
                            axpy(s, &g, &mut d);
                            grads[id] = d;
                        }
                    }
                }
                Op::Scale(a, s) => {
                    if need[*a] {
                        let mut d = tk(grads, *a, g.len());
                        axpy(*s, &g, &mut d);
                        grads[*a] = d;
                    }
                }
                Op::MulScalar { a, s } => {
                    if need[*s] {
                        let mut d = tk(grads, *s, 1);
                        d[0] += dot(&g, &vals[*a]);
                        grads[*s] = d;
                    }
                    if need[*a] {
                        let mut d = tk(grads, *a, g.len());
                        axpy(vals[*s][0], &g, &mut d);
                        grads[*a] = d;
                    }
                }
                Op::Exp(a) => {
                    if need[*a] {
                        let mut d = tk(grads, *a, g.len());
                        for j in 0..g.len() {
                            d[j] += g[j] * vals[i][j];
                        }
                        grads[*a] = d;
                    }
                }
                Op::Tile { x, reps } => {
                    if need[*x] {
                        let len = vals[*x].len();
                        let mut d = tk(grads, *x, len);
                        for r in 0..*reps {
                            axpy(1.0 as F, &g[r * len..(r + 1) * len], &mut d);
                        }
                        grads[*x] = d;
                    }
                }
                Op::Embed { table, ids, c } => {
                    if need[*table] {
                        let mut d = tk(grads, *table, vals[*table].len());
                        for (r, &id) in ids.iter().enumerate() {
                            axpy(1.0 as F, &g[r * c..(r + 1) * c], &mut d[id as usize * c..(id as usize + 1) * c]);
                        }
                        grads[*table] = d;
                    }
                }
                Op::LayerNorm { x, g: gain, b, c } => {
                    let mut dx = if need[*x] { Some(tk(grads, *x, g.len())) } else { None };
                    let mut dg = tk(grads, *gain, *c);
                    let mut db = b.map(|b| tk(grads, b, *c));
                    layernorm_bwd(&vals[*x], &vals[*gain], &g, *c, dx.as_deref_mut(), &mut dg, db.as_deref_mut());
                    if let Some(d) = dx {
                        grads[*x] = d;
                    }
                    grads[*gain] = dg;
                    if let (Some(d), Some(b)) = (db, b) {
                        grads[*b] = d;
                    }
                }
                Op::RmsNorm { x, w, c } => {
                    let mut dx = tk(grads, *x, g.len());
                    let mut dw = tk(grads, *w, *c);
                    rmsnorm_bwd(&vals[*x], &vals[*w], &g, *c, &mut dx, &mut dw);
                    grads[*x] = dx;
                    grads[*w] = dw;
                }
                Op::GroupNorm { x, n, l, c, groups } => {
                    let mut dx = tk(grads, *x, g.len());
                    groupnorm_bwd(&vals[*x], &g, *n, *l, *c, *groups, &mut dx);
                    grads[*x] = dx;
                }
                Op::Gelu(x) => {
                    let mut dx = tk(grads, *x, g.len());
                    gelu_bwd(&vals[*x], &g, &mut dx);
                    grads[*x] = dx;
                }
                Op::Conv3 { x, w, b, n, l, c } => {
                    let mut dx = if need[*x] { Some(tk(grads, *x, vals[*x].len())) } else { None };
                    let mut dw = tk(grads, *w, vals[*w].len());
                    let mut db = tk(grads, *b, *c);
                    conv3_bwd(&vals[*x], &vals[*w], &g, *n, *l, *c, dx.as_deref_mut(), &mut dw, &mut db);
                    if let Some(d) = dx {
                        grads[*x] = d;
                    }
                    grads[*w] = dw;
                    grads[*b] = db;
                }
                Op::Down { x, w, b, n, lin, stride, c } => {
                    let mut dx = if need[*x] { Some(tk(grads, *x, vals[*x].len())) } else { None };
                    let mut dw = tk(grads, *w, vals[*w].len());
                    let mut db = tk(grads, *b, *c);
                    strided_down_bwd(&vals[*x], &vals[*w], &g, *n, *lin, *stride, *c, dx.as_deref_mut(), &mut dw, &mut db);
                    if let Some(d) = dx {
                        grads[*x] = d;
                    }
                    grads[*w] = dw;
                    grads[*b] = db;
                }
                Op::Up { x, w, b, n, lin, stride, c } => {
                    let mut dx = if need[*x] { Some(tk(grads, *x, vals[*x].len())) } else { None };
                    let mut dw = tk(grads, *w, vals[*w].len());
                    let mut db = tk(grads, *b, *c);
                    strided_up_bwd(&vals[*x], &vals[*w], &g, *n, *lin, *stride, *c, dx.as_deref_mut(), &mut dw, &mut db);
                    if let Some(d) = dx {
                        grads[*x] = d;
                    }
                    grads[*w] = dw;
                    grads[*b] = db;
                }
                Op::AreaPool { x, n, lin, lout, c } => {
                    let mut dx = tk(grads, *x, vals[*x].len());
                    area_pool_bwd(&g, *n, *lin, *lout, *c, &mut dx);
                    grads[*x] = dx;
                }
                Op::LerpUp { x, n, lin, lout, c } => {
                    let mut dx = tk(grads, *x, vals[*x].len());
                    lerp_up_bwd(&g, *n, *lin, *lout, *c, &mut dx);
                    grads[*x] = dx;
                }
                Op::Attn { q, k, v, n, t, heads, hd, segs, rope, cache } => {
                    // q, k and v are always distinct nodes (three separate projections).
                    let mut dq = tk(grads, *q, g.len());
                    let mut dk = tk(grads, *k, g.len());
                    let mut dv = tk(grads, *v, g.len());
                    attn_bwd(cache, &vals[*v], &g, *n, *t, *heads, *hd, segs, rope.as_deref(), &mut dq, &mut dk, &mut dv);
                    grads[*q] = dq;
                    grads[*k] = dk;
                    grads[*v] = dv;
                }
                Op::Xent { logits, d } => {
                    let mut dl = tk(grads, *logits, d.len());
                    axpy(g[0], d, &mut dl);
                    grads[*logits] = dl;
                }
                Op::Mse(a, b) => {
                    let len = vals[*a].len();
                    let s = 2.0 * g[0] / len as F;
                    for (id, sign) in [(*a, 1.0 as F), (*b, -1.0 as F)] {
                        if need[id] {
                            let mut d = tk(grads, id, len);
                            for j in 0..len {
                                d[j] += sign * s * (vals[*a][j] - vals[*b][j]);
                            }
                            grads[id] = d;
                        }
                    }
                }
                Op::Slice { x, n, t, start, len, c } => {
                    let mut dx = tk(grads, *x, vals[*x].len());
                    for s in 0..*n {
                        axpy(
                            1.0 as F,
                            &g[s * len * c..(s + 1) * len * c],
                            &mut dx[(s * t + start) * c..(s * t + start + len) * c],
                        );
                    }
                    grads[*x] = dx;
                }
                Op::Concat { parts, n, c } => {
                    let total: usize = parts.iter().map(|p| p.1).sum();
                    let mut off = 0;
                    for &(id, len) in parts {
                        if need[id] {
                            let mut d = tk(grads, id, n * len * c);
                            for s in 0..*n {
                                axpy(
                                    1.0 as F,
                                    &g[(s * total + off) * c..(s * total + off + len) * c],
                                    &mut d[s * len * c..(s + 1) * len * c],
                                );
                            }
                            grads[id] = d;
                        }
                        off += len;
                    }
                }
            }
        }
    }
}

/// Finite-difference check used by the test suites. `f` builds a tape from
/// the parameters and returns the loss node; the return value is the largest
/// relative error over a sample of parameter entries.
#[cfg(test)]
pub fn gradcheck(params: &mut Vec<Param>, f: &dyn Fn(&mut Tape, &[Param]) -> Id) -> F {
    use crate::param::{pull_grads, zero_grad};
    zero_grad(params);
    let mut t = Tape::new();
    let root = f(&mut t, params);
    t.backward(root);
    pull_grads(params, &t);
    let eps = 1e-5 as F;
    let mut worst = 0.0 as F;
    for pi in 0..params.len() {
        let n = params[pi].w.len();
        let stride = (n / 24).max(1);
        for i in (0..n).step_by(stride) {
            let orig = params[pi].w[i];
            params[pi].w[i] = orig + eps;
            let mut t = Tape::new();
            let r = f(&mut t, params);
            let up = t.scalar(r);
            params[pi].w[i] = orig - eps;
            let mut t = Tape::new();
            let r = f(&mut t, params);
            let dn = t.scalar(r);
            params[pi].w[i] = orig;
            let num = (up - dn) / (2.0 * eps);
            let ana = params[pi].g[i];
            let err = (num - ana).abs() / (num.abs() + ana.abs() + 1e-6);
            if err > worst {
                worst = err;
            }
        }
    }
    worst
}

#[cfg(all(test, feature = "f64"))]
mod tests {
    use super::*;
    use crate::rng::Rng;

    fn rnd(n: usize, rng: &mut Rng) -> Param {
        Param::normal(n, 1.0, rng)
    }

    /// Reduces a node to a scalar with fixed random weights.
    fn reduce(t: &mut Tape, y: Id) -> Id {
        let mut rng = Rng::new(99);
        let n = t.val(y).len();
        let r = t.constant((0..n).map(|_| rng.normal()).collect());
        let z = t.constant(vec![0.0; n]);
        let d = t.sub(y, z);
        // sum(y * r) written as a linear map to one output
        t.linear(d, r, None, n, 1)
    }

    fn check(params: Vec<Param>, f: &dyn Fn(&mut Tape, &[Id]) -> Id) {
        let mut params = params;
        let err = gradcheck(&mut params, &|t, ps| {
            let ids: Vec<Id> = ps.iter().map(|p| t.param(p)).collect();
            let y = f(t, &ids);
            reduce(t, y)
        });
        assert!(err < 1e-6, "max relative error {}", err);
    }

    #[test]
    fn linear_grad() {
        let mut r = Rng::new(1);
        check(vec![rnd(2 * 3, &mut r), rnd(3 * 4, &mut r), rnd(4, &mut r)], &|t, p| t.linear(p[0], p[1], Some(p[2]), 3, 4));
    }

    #[test]
    fn layernorm_grad() {
        let mut r = Rng::new(2);
        check(vec![rnd(3 * 5, &mut r), rnd(5, &mut r), rnd(5, &mut r)], &|t, p| t.layernorm(p[0], p[1], Some(p[2]), 5));
    }

    #[test]
    fn rmsnorm_grad() {
        let mut r = Rng::new(3);
        check(vec![rnd(3 * 4, &mut r), rnd(4, &mut r)], &|t, p| t.rmsnorm(p[0], p[1], 4));
    }

    #[test]
    fn groupnorm_grad() {
        let mut r = Rng::new(4);
        check(vec![rnd(2 * 3 * 4, &mut r)], &|t, p| t.groupnorm(p[0], 2, 3, 4, 2));
    }

    #[test]
    fn gelu_grad() {
        let mut r = Rng::new(5);
        check(vec![rnd(12, &mut r)], &|t, p| t.gelu(p[0]));
    }

    #[test]
    fn conv3_grad() {
        let mut r = Rng::new(6);
        check(vec![rnd(2 * 5 * 3, &mut r), rnd(3 * 3 * 3, &mut r), rnd(3, &mut r)], &|t, p| t.conv3(p[0], p[1], p[2], 2, 5, 3));
    }

    #[test]
    fn strided_down_grad() {
        let mut r = Rng::new(7);
        check(vec![rnd(2 * 6 * 2, &mut r), rnd(3 * 2 * 2, &mut r), rnd(2, &mut r)], &|t, p| t.down(p[0], p[1], p[2], 2, 6, 3, 2));
    }

    #[test]
    fn strided_up_grad() {
        let mut r = Rng::new(8);
        check(vec![rnd(2 * 2 * 2, &mut r), rnd(3 * 2 * 2, &mut r), rnd(2, &mut r)], &|t, p| t.up(p[0], p[1], p[2], 2, 2, 3, 2));
    }

    #[test]
    fn pool_and_lerp_grad() {
        let mut r = Rng::new(9);
        check(vec![rnd(2 * 6 * 2, &mut r)], &|t, p| {
            let a = t.area_pool(p[0], 2, 6, 4, 2);
            t.lerp_up(a, 2, 4, 7, 2)
        });
    }

    #[test]
    fn attn_grad_with_segments_and_rope() {
        let mut r = Rng::new(10);
        let (n, tl, heads, hd) = (2, 6, 2, 4);
        let len = n * tl * heads * hd;
        let segs = Rc::new(vec![
            Seg { start: 0, len: 1, prefix: 0 },
            Seg { start: 1, len: 2, prefix: 1 },
            Seg { start: 3, len: 3, prefix: 1 },
        ]);
        let rope = Rc::new(Rope::new(&[0, 0, 1, 0, 1, 2], hd, 100.0));
        check(vec![rnd(len, &mut r), rnd(len, &mut r), rnd(len, &mut r)], &|t, p| {
            t.attn(p[0], p[1], p[2], n, tl, heads, hd, &segs, Some(&rope))
        });
    }

    #[test]
    fn xent_and_mse_grad() {
        let mut r = Rng::new(11);
        check(vec![rnd(3 * 4, &mut r), rnd(12, &mut r)], &|t, p| {
            let x = t.xent(p[0], &[1, 3, 0], &[0.5, 0.2, 0.3], 4);
            let m = t.mse(p[0], p[1]);
            t.add(x, m)
        });
    }

    #[test]
    fn glue_ops_grad() {
        let mut r = Rng::new(12);
        // embed, tile, slice, concat, scale, exp, mul_scalar
        check(vec![rnd(5 * 3, &mut r), rnd(2 * 3, &mut r), rnd(1, &mut r)], &|t, p| {
            let e = t.embed(p[0], &[4, 0, 4, 2], 3); // [n=2, len=2, c=3]
            let pre = t.tile(p[1], 1); // [n=2, len=1, c=3]
            let cat = t.concat(&[(pre, 1), (e, 2)], 2, 3);
            let sl = t.slice(cat, 2, 3, 1, 2, 3);
            let s = t.exp(p[2]);
            let m = t.mul_scalar(sl, s);
            let sc = t.scale(m, 0.7);
            t.sub(sc, e)
        });
    }
}

/// Finite-difference check for a whole model. `f(model, true)` must zero the
/// gradients, compute the loss and fill them; `f(model, false)` only returns
/// the loss. Returning `None` skips that probe (used when a perturbation
/// changes a discrete choice). Returns the largest relative error.
#[cfg(test)]
pub fn gradcheck_model<M: crate::param::Params>(
    m: &mut M,
    f: &mut dyn FnMut(&mut M, bool) -> Option<F>,
    per_param: usize,
) -> F {
    f(m, true).expect("baseline");
    let mut ana: Vec<Vec<F>> = Vec::new();
    m.visit(&mut |p| ana.push(p.g.clone()));
    let eps = 1e-5 as F;
    let mut worst = 0.0 as F;
    let mut probes = 0;
    for pi in 0..ana.len() {
        let len = ana[pi].len();
        for i in (0..len).step_by((len / per_param).max(1)) {
            let mut vals = [None, None];
            for (s, sign) in [1.0 as F, -1.0 as F].iter().enumerate() {
                let mut k = 0;
                m.visit(&mut |p| {
                    if k == pi {
                        p.w[i] += sign * eps;
                    }
                    k += 1;
                });
                vals[s] = f(m, false);
                let mut k = 0;
                m.visit(&mut |p| {
                    if k == pi {
                        p.w[i] -= sign * eps;
                    }
                    k += 1;
                });
            }
            if let (Some(up), Some(dn)) = (vals[0], vals[1]) {
                let num = (up - dn) / (2.0 * eps);
                let err = (num - ana[pi][i]).abs() / (num.abs() + ana[pi][i].abs() + 1e-4);
                if err > worst {
                    worst = err;
                    if std::env::var("GRADCHECK_VERBOSE").is_ok() {
                        eprintln!("param {} index {} numeric {:e} analytic {:e} err {:e}", pi, i, num, ana[pi][i], err);
                    }
                }
                probes += 1;
            }
        }
    }
    assert!(probes > ana.len(), "too few probes survived: {}", probes);
    worst
}
