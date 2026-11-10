//! Pre-norm transformer block: self-attention with QK norm and optional
//! RoPE, then a GELU MLP. Mirrors `Block` in the reference `models/common.py`.

use crate::ops::{Rope, Seg};
use crate::param::{Param, Params};
use crate::rng::Rng;
use crate::tape::{Id, Tape};
use crate::F;
use std::rc::Rc;

pub struct Block {
    pub width: usize,
    pub heads: usize,
    ln1g: Param,
    ln1b: Param,
    wq: Param,
    bq: Param,
    wk: Param,
    bk: Param,
    wv: Param,
    bv: Param,
    qn: Param,
    kn: Param,
    wo: Param,
    bo: Param,
    ln2g: Param,
    ln2b: Param,
    wfc: Param,
    bfc: Param,
    wpr: Param,
    bpr: Param,
}

impl Block {
    /// `n_layer` is the depth of the stack this block sits in; it scales the
    /// init of the two residual output projections.
    pub fn new(width: usize, heads: usize, n_layer: usize, rng: &mut Rng) -> Block {
        assert!(width % heads == 0 && (width / heads) % 2 == 0, "head dim must be even");
        let hd = width / heads;
        let std = 0.02 as F;
        let pstd = std / ((2 * n_layer.max(1)) as F).sqrt();
        let hidden = 4 * width;
        Block {
            width,
            heads,
            ln1g: Param::ones(width),
            ln1b: Param::zeros(width),
            wq: Param::normal(width * width, std, rng),
            bq: Param::zeros(width),
            wk: Param::normal(width * width, std, rng),
            bk: Param::zeros(width),
            wv: Param::normal(width * width, std, rng),
            bv: Param::zeros(width),
            qn: Param::ones(hd),
            kn: Param::ones(hd),
            wo: Param::normal(width * width, pstd, rng),
            bo: Param::zeros(width),
            ln2g: Param::ones(width),
            ln2b: Param::zeros(width),
            wfc: Param::normal(width * hidden, std, rng),
            bfc: Param::zeros(hidden),
            wpr: Param::normal(hidden * width, pstd, rng),
            bpr: Param::zeros(width),
        }
    }

    /// x is [n, t, width]. See `Seg` for the attention pattern.
    pub fn fwd(&self, t: &mut Tape, x: Id, n: usize, tlen: usize, segs: &Rc<Vec<Seg>>, rope: Option<&Rc<Rope>>) -> Id {
        let c = self.width;
        let hd = c / self.heads;
        let (g1, b1) = (t.param(&self.ln1g), t.param(&self.ln1b));
        let h = t.layernorm(x, g1, Some(b1), c);
        let (wq, bq) = (t.param(&self.wq), t.param(&self.bq));
        let (wk, bk) = (t.param(&self.wk), t.param(&self.bk));
        let (wv, bv) = (t.param(&self.wv), t.param(&self.bv));
        let q = t.linear(h, wq, Some(bq), c, c);
        let k = t.linear(h, wk, Some(bk), c, c);
        let v = t.linear(h, wv, Some(bv), c, c);
        let (qn, kn) = (t.param(&self.qn), t.param(&self.kn));
        let q = t.rmsnorm(q, qn, hd);
        let k = t.rmsnorm(k, kn, hd);
        let a = t.attn(q, k, v, n, tlen, self.heads, hd, segs, rope);
        let (wo, bo) = (t.param(&self.wo), t.param(&self.bo));
        let a = t.linear(a, wo, Some(bo), c, c);
        let x = t.add(x, a);
        let (g2, b2) = (t.param(&self.ln2g), t.param(&self.ln2b));
        let h = t.layernorm(x, g2, Some(b2), c);
        let (wfc, bfc) = (t.param(&self.wfc), t.param(&self.bfc));
        let h = t.linear(h, wfc, Some(bfc), c, 4 * c);
        let h = t.gelu(h);
        let (wpr, bpr) = (t.param(&self.wpr), t.param(&self.bpr));
        let h = t.linear(h, wpr, Some(bpr), 4 * c, c);
        t.add(x, h)
    }
}

impl Params for Block {
    fn visit(&mut self, f: &mut dyn FnMut(&mut Param)) {
        for p in [
            &mut self.ln1g, &mut self.ln1b, &mut self.wq, &mut self.bq, &mut self.wk, &mut self.bk,
            &mut self.wv, &mut self.bv, &mut self.qn, &mut self.kn, &mut self.wo, &mut self.bo,
            &mut self.ln2g, &mut self.ln2b, &mut self.wfc, &mut self.bfc, &mut self.wpr, &mut self.bpr,
        ] {
            f(p);
        }
    }
}

/// One full-attention segment over `t` positions.
pub fn full_seg(t: usize) -> Rc<Vec<Seg>> {
    Rc::new(vec![Seg { start: 0, len: t, prefix: 0 }])
}

#[cfg(all(test, feature = "f64"))]
mod tests {
    use super::*;
    use crate::param::{pull_grads, zero_grad};

    struct M {
        x: Param,
        b: Block,
    }
    impl Params for M {
        fn visit(&mut self, f: &mut dyn FnMut(&mut Param)) {
            f(&mut self.x);
            self.b.visit(f);
        }
    }

    fn make(n: usize, tl: usize) -> M {
        let mut r = Rng::new(3);
        let mut b = Block::new(8, 2, 1, &mut r);
        // Larger weights than the 0.02 init so every path matters in the check.
        b.visit(&mut |p| {
            if p.decay {
                p.w.iter_mut().for_each(|w| *w *= 20.0);
            }
        });
        M { x: Param::normal(n * tl * 8, 1.0, &mut r), b }
    }

    fn loss(m: &M, t: &mut Tape, n: usize, tl: usize, segs: &Rc<Vec<Seg>>, rope: Option<&Rc<Rope>>) -> Id {
        let x = t.param(&m.x);
        let y = m.b.fwd(t, x, n, tl, segs, rope);
        let mut r = Rng::new(5);
        let w = t.constant((0..n * tl * 8).map(|_| r.normal()).collect());
        t.linear(y, w, None, n * tl * 8, 1)
    }

    fn check(m: &mut M, n: usize, tl: usize, segs: &Rc<Vec<Seg>>, rope: Option<&Rc<Rope>>) -> F {
        zero_grad(m);
        let mut t = Tape::new();
        let r = loss(m, &mut t, n, tl, segs, rope);
        t.backward(r);
        pull_grads(m, &t);
        let mut ana = Vec::new();
        m.visit(&mut |p| ana.push(p.g.clone()));
        let eps = 1e-5;
        let mut worst: F = 0.0;
        for pi in 0..ana.len() {
            let len = ana[pi].len();
            for i in (0..len).step_by((len / 16).max(1)) {
                let mut vals = [0.0; 2];
                for (s, sign) in [1.0, -1.0].iter().enumerate() {
                    let mut k = 0;
                    m.visit(&mut |p| {
                        if k == pi {
                            p.w[i] += sign * eps;
                        }
                        k += 1;
                    });
                    let mut t = Tape::new();
                    let r = loss(m, &mut t, n, tl, segs, rope);
                    vals[s] = t.scalar(r);
                    let mut k = 0;
                    m.visit(&mut |p| {
                        if k == pi {
                            p.w[i] -= sign * eps;
                        }
                        k += 1;
                    });
                }
                let num = (vals[0] - vals[1]) / (2.0 * eps);
                let err = (num - ana[pi][i]).abs() / (num.abs() + ana[pi][i].abs() + 1e-6);
                worst = worst.max(err);
            }
        }
        worst
    }

    fn two_segs() -> (Rc<Vec<Seg>>, Rc<Rope>) {
        let segs = Rc::new(vec![
            Seg { start: 0, len: 1, prefix: 0 },
            Seg { start: 1, len: 2, prefix: 1 },
            Seg { start: 3, len: 3, prefix: 1 },
        ]);
        (segs, Rc::new(Rope::new(&[0, 0, 1, 0, 1, 2], 4, 10000.0)))
    }

    #[test]
    fn block_grad_full() {
        let mut m = make(2, 5);
        let rope = Rc::new(Rope::new(&[0, 1, 2, 3, 4], 4, 10000.0));
        let e = check(&mut m, 2, 5, &full_seg(5), Some(&rope));
        assert!(e < 1e-6, "{}", e);
    }

    #[test]
    fn block_grad_segments() {
        let mut m = make(2, 6);
        let (segs, rope) = two_segs();
        let e = check(&mut m, 2, 6, &segs, Some(&rope));
        assert!(e < 1e-6, "{}", e);
    }

    fn run(m: &M, n: usize, tl: usize, segs: &Rc<Vec<Seg>>, rope: &Rc<Rope>) -> Vec<F> {
        let mut t = Tape::new();
        let x = t.param(&m.x);
        let y = m.b.fwd(&mut t, x, n, tl, segs, Some(rope));
        t.val(y).to_vec()
    }

    #[test]
    fn segments_do_not_leak() {
        let mut m = make(1, 6);
        let (segs, rope) = two_segs();
        let base = run(&m, 1, 6, &segs, &rope);
        // position 1 is in segment A (1..3); segment B is 3..6; prefix is 0.
        m.x.w[1 * 8 + 2] += 0.5;
        let a = run(&m, 1, 6, &segs, &rope);
        assert_eq!(&a[3 * 8..], &base[3 * 8..], "segment B changed");
        assert_eq!(&a[..8], &base[..8], "prefix changed");
        assert_ne!(&a[8..3 * 8], &base[8..3 * 8]);
        m.x.w[1 * 8 + 2] -= 0.5;
        m.x.w[3] += 0.5;
        let p = run(&m, 1, 6, &segs, &rope);
        assert_ne!(&p[8..3 * 8], &base[8..3 * 8], "prefix must reach segment A");
        assert_ne!(&p[3 * 8..], &base[3 * 8..], "prefix must reach segment B");
    }

    #[test]
    fn segments_equal_separate_calls() {
        let m = make(1, 6);
        let (segs, rope) = two_segs();
        let all = run(&m, 1, 6, &segs, &rope);
        // [prefix + segment B] as its own sequence of 4 positions.
        let mut sub = make(1, 4);
        sub.x.w[..8].copy_from_slice(&m.x.w[..8]);
        sub.x.w[8..].copy_from_slice(&m.x.w[3 * 8..]);
        let segs_b = Rc::new(vec![Seg { start: 0, len: 1, prefix: 0 }, Seg { start: 1, len: 3, prefix: 1 }]);
        let rope_b = Rc::new(Rope::new(&[0, 0, 1, 2], 4, 10000.0));
        let b = run(&sub, 1, 4, &segs_b, &rope_b);
        for (x, y) in b[8..].iter().zip(&all[3 * 8..]) {
            assert!((x - y).abs() < 1e-12);
        }
    }
}
