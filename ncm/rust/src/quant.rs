//! Multiscale residual vector quantiser, after
//! `MultiscaleResidualVectorQuantizer` in the reference `models/quant.py`.
//!
//! A latent z[n, L, d] becomes K levels of codes. Level k works on what the
//! earlier levels left over: pool the residual down to l_k positions, pick
//! the nearest codebook entry per position, bring that back up to length L,
//! pass it through a small conv, add it to the running reconstruction.

use crate::ops::*;
use crate::param::{Param, Params};
use crate::rng::Rng;
use crate::tape::{Id, Tape};
use crate::F;

#[derive(Clone, Debug, PartialEq)]
pub struct TokConfig {
    pub vocab: usize,
    pub l: usize,
    pub d: usize,
    pub levels: Vec<usize>,
    pub codes: usize,
    pub dec_blocks: usize,
    pub dec_heads: usize,
    pub groups: usize,
}

pub struct Quant {
    pub d: usize,
    pub l: usize,
    pub levels: Vec<usize>,
    pub codes: usize,
    /// Codebooks, one per level, [codes, d]. Updated by EMA, not gradients.
    pub emb: Vec<Vec<F>>,
    pub ema_cs: Vec<Vec<F>>,
    pub ema_w: Vec<Vec<F>>,
    /// Learned down / up sampler for level 1, as a cascade of strides.
    pub strides: Vec<usize>,
    down_w: Vec<Param>,
    down_b: Vec<Param>,
    up_w: Vec<Param>,
    up_b: Vec<Param>,
    /// Per-level conv applied after upsampling: 0.5*h + 0.5*conv3(h).
    phi_w: Vec<Param>,
    phi_b: Vec<Param>,
    pub decay: F,
    pub commitment: F,
    /// EMA codebook updates happen only while this is set.
    pub ema: bool,
    /// Re-seed codes whose EMA count fell below this from the current batch.
    pub restart_below: F,
    /// Stop-gradient values: live in normal use; tests record them once and
    /// replay them so finite differences see the same frozen values the
    /// analytic gradient assumes.
    pub sg: Sg,
}

pub enum Sg {
    Live,
    Record(Vec<Vec<F>>),
    Replay(Vec<Vec<F>>, usize),
}

pub struct QuantOut {
    /// What the decoder receives: z + sg(z_hat - z).
    pub z_dec: Id,
    pub vq_loss: Id,
    pub codes: Vec<u32>,
    /// Number of levels the decoder input was built from.
    pub kept_levels: usize,
}

const EMA_EPS: F = 1e-5;
const RESI: F = 0.5;

/// Splits a total stride into factors of at most `base` (reference
/// `_plan_cascade_strides`).
pub fn plan_strides(total: usize, base: usize) -> Vec<usize> {
    let mut s = total;
    let mut out = Vec::new();
    while s > 1 {
        let mut f = base.min(s);
        while f > 1 && s % f != 0 {
            f -= 1;
        }
        if f <= 1 {
            out.push(s);
            s = 1;
        } else {
            out.push(f);
            s /= f;
        }
    }
    if out.is_empty() {
        out.push(1);
    }
    out
}

/// Nearest codebook row for each row of `x`.
pub fn nearest(x: &[F], emb: &[F], d: usize) -> Vec<u32> {
    let sq: Vec<F> = emb.chunks_exact(d).map(|e| dot(e, e)).collect();
    x.chunks_exact(d)
        .map(|xr| {
            let mut best = 0;
            let mut bd = F::INFINITY;
            for (j, e) in emb.chunks_exact(d).enumerate() {
                let dist = sq[j] - 2.0 * dot(xr, e);
                if dist < bd {
                    bd = dist;
                    best = j;
                }
            }
            best as u32
        })
        .collect()
}

fn lookup(emb: &[F], idx: &[u32], d: usize) -> Vec<F> {
    let mut out = Vec::with_capacity(idx.len() * d);
    for &i in idx {
        out.extend_from_slice(&emb[i as usize * d..(i as usize + 1) * d]);
    }
    out
}

impl Quant {
    pub fn new(cfg: &TokConfig, rng: &mut Rng) -> Quant {
        let (d, l, k) = (cfg.d, cfg.l, cfg.levels.len());
        assert!(k >= 2, "need at least two levels");
        assert_eq!(*cfg.levels.last().unwrap(), l, "last level must have length L");
        assert!(l % cfg.levels[0] == 0, "L must be divisible by the first level length");
        let strides = plan_strides(l / cfg.levels[0], 4);
        let ident = |s: usize, v: F| {
            let mut w = vec![0.0 as F; s * d * d];
            for tap in 0..s {
                for ch in 0..d {
                    w[tap * d * d + ch * d + ch] = v;
                }
            }
            Param::from_vec(w, false)
        };
        let emb: Vec<Vec<F>> = (0..k).map(|_| (0..cfg.codes * d).map(|_| rng.normal()).collect()).collect();
        let bound = 1.0 / ((3 * d) as F).sqrt();
        Quant {
            d,
            l,
            levels: cfg.levels.clone(),
            codes: cfg.codes,
            ema_cs: vec![vec![1.0 as F; cfg.codes]; k],
            ema_w: emb.clone(),
            emb,
            down_w: strides.iter().map(|&s| ident(s, 1.0 / s as F)).collect(),
            down_b: strides.iter().map(|_| Param::zeros(d)).collect(),
            up_w: strides.iter().rev().map(|&s| ident(s, 1.0)).collect(),
            up_b: strides.iter().map(|_| Param::zeros(d)).collect(),
            strides,
            phi_w: (0..k)
                .map(|_| Param::from_vec((0..3 * d * d).map(|_| (rng.uniform() * 2.0 - 1.0) * bound).collect(), true))
                .collect(),
            phi_b: (0..k).map(|_| Param::zeros(d)).collect(),
            decay: 0.95,
            commitment: 0.25,
            ema: true,
            restart_below: 0.01,
            sg: Sg::Live,
        }
    }

    pub fn n_levels(&self) -> usize {
        self.levels.len()
    }
    /// Codes per window over all levels.
    pub fn total(&self) -> usize {
        self.levels.iter().sum()
    }
    /// Start of each level inside one window's flat code vector.
    pub fn offsets(&self) -> Vec<usize> {
        let mut o = Vec::with_capacity(self.levels.len());
        let mut a = 0;
        for &l in &self.levels {
            o.push(a);
            a += l;
        }
        o
    }

    fn ema_update(&mut self, i: usize, flat: &[F], idx: &[u32], rng: &mut Rng) {
        let (d, v) = (self.d, self.codes);
        let decay = self.decay;
        let mut counts = vec![0.0 as F; v];
        let mut dw = vec![0.0 as F; v * d];
        for (r, &c) in idx.iter().enumerate() {
            counts[c as usize] += 1.0;
            axpy(1.0 as F, &flat[r * d..(r + 1) * d], &mut dw[c as usize * d..(c as usize + 1) * d]);
        }
        let cs = &mut self.ema_cs[i];
        let ew = &mut self.ema_w[i];
        for j in 0..v {
            cs[j] = decay * cs[j] + (1.0 - decay) * counts[j];
        }
        for j in 0..v * d {
            ew[j] = decay * ew[j] + (1.0 - decay) * dw[j];
        }
        let rows = idx.len();
        for j in 0..v {
            if self.restart_below > 0.0 && cs[j] < self.restart_below && rows > 0 {
                let r = rng.below(rows);
                ew[j * d..(j + 1) * d].copy_from_slice(&flat[r * d..(r + 1) * d]);
                cs[j] = 1.0;
            }
        }
        let n: F = cs.iter().sum();
        let emb = &mut self.emb[i];
        for j in 0..v {
            let smoothed = (cs[j] + EMA_EPS) / (n + v as F * EMA_EPS) * n;
            for ch in 0..d {
                emb[j * d + ch] = ew[j * d + ch] / smoothed;
            }
        }
    }

    /// Passes a stop-gradient value through the record / replay switch.
    fn stop(&mut self, v: Vec<F>) -> Vec<F> {
        match &mut self.sg {
            Sg::Live => v,
            Sg::Record(store) => {
                store.push(v.clone());
                v
            }
            Sg::Replay(store, cursor) => {
                *cursor += 1;
                store[*cursor - 1].clone()
            }
        }
    }

    /// Training forward on the tape. `z` is [n, L, d].
    pub fn fwd_train(&mut self, t: &mut Tape, z: Id, n: usize, rng: &mut Rng, fine_drop: F) -> QuantOut {
        let (d, l, k) = (self.d, self.l, self.levels.len());
        if let Sg::Replay(_, cursor) = &mut self.sg {
            *cursor = 0;
        }
        let z_val = self.stop(t.val(z).to_vec());
        let z_ng = t.constant(z_val.clone());
        let mut z_rest = z_val.clone();
        let total = self.total();
        let offs = self.offsets();
        let mut codes = vec![0u32; n * total];
        let mut z_hat: Option<Id> = None;
        let mut keep = Vec::with_capacity(k);
        let mut loss: Option<Id> = None;
        for i in 0..k {
            let lk = self.levels[i];
            // Down to the level's length.
            let (flat, flat_id) = if i == 0 {
                let mut h = z_ng;
                let mut len = l;
                for (s, &stride) in self.strides.iter().enumerate() {
                    let (w, b) = (t.param(&self.down_w[s]), t.param(&self.down_b[s]));
                    h = t.down(h, w, b, n, len, stride, d);
                    len /= stride;
                }
                (t.val(h).to_vec(), Some(h))
            } else if i < k - 1 {
                (area_pool_fwd(&z_rest, n, l, lk, d), None)
            } else {
                (z_rest.clone(), None)
            };
            let idx = nearest(&flat, &self.emb[i], d);
            if self.ema {
                self.ema_update(i, &flat, &idx, rng);
            }
            for s in 0..n {
                codes[s * total + offs[i]..s * total + offs[i] + lk].copy_from_slice(&idx[s * lk..(s + 1) * lk]);
            }
            let q = lookup(&self.emb[i], &idx, d);
            // Back up to length L.
            let up = if let Some(fid) = flat_id {
                // Straight-through estimator at level 1 only.
                let delta: Vec<F> = q.iter().zip(&flat).map(|(a, b)| a - b).collect();
                let delta = self.stop(delta);
                let dc = t.constant(delta);
                let mut h = t.add(fid, dc);
                let mut len = lk;
                for (s, &stride) in self.strides.iter().rev().enumerate() {
                    let (w, b) = (t.param(&self.up_w[s]), t.param(&self.up_b[s]));
                    h = t.up(h, w, b, n, len, stride, d);
                    len *= stride;
                }
                h
            } else if i < k - 1 {
                t.constant(lerp_up_fwd(&q, n, lk, l, d))
            } else {
                t.constant(q)
            };
            let (pw, pb) = (t.param(&self.phi_w[i]), t.param(&self.phi_b[i]));
            let conv = t.conv3(up, pw, pb, n, l, d);
            let a = t.scale(up, 1.0 - RESI);
            let b = t.scale(conv, RESI);
            let quantized = t.add(a, b);
            let zh = match z_hat {
                Some(prev) => t.add(prev, quantized),
                None => quantized,
            };
            z_hat = Some(zh);
            keep.push(zh);
            for (r, qv) in z_rest.iter_mut().zip(t.val(quantized)) {
                *r -= qv;
            }
            let zh_val = self.stop(t.val(zh).to_vec());
            let zh_ng = t.constant(zh_val);
            let commit = t.mse(zh_ng, z);
            let commit = t.scale(commit, self.commitment);
            let book = t.mse(zh, z_ng);
            let li = t.add(commit, book);
            loss = Some(match loss {
                Some(prev) => t.add(prev, li),
                None => li,
            });
        }
        let vq_loss = t.scale(loss.unwrap(), 1.0 / k as F);
        // Nested dropout: hand the decoder a reconstruction cut at a random level.
        let mut kept = k;
        if fine_drop > 0.0 && rng.uniform() < fine_drop {
            kept = 1 + rng.below(k - 1);
        }
        let zh = keep[kept - 1];
        let delta: Vec<F> = t.val(zh).iter().zip(&z_val).map(|(a, b)| a - b).collect();
        let delta = self.stop(delta);
        let dc = t.constant(delta);
        let z_dec = t.add(z, dc);
        QuantOut { z_dec, vq_loss, codes, kept_levels: kept }
    }

    /// The length-L contribution of one level's codes: codebook lookup,
    /// upsample, conv. `idx` is [n, l_level].
    pub fn level_contrib(&self, level: usize, idx: &[u32], n: usize) -> Vec<F> {
        let (d, l, k) = (self.d, self.l, self.levels.len());
        let lk = self.levels[level];
        let q = lookup(&self.emb[level], idx, d);
        let up = if level == 0 {
            let mut h = q;
            let mut len = lk;
            for (s, &stride) in self.strides.iter().rev().enumerate() {
                h = strided_up_fwd(&h, &self.up_w[s].w, &self.up_b[s].w, n, len, stride, d);
                len *= stride;
            }
            h
        } else if level < k - 1 {
            lerp_up_fwd(&q, n, lk, l, d)
        } else {
            q
        };
        let conv = conv3_fwd(&up, &self.phi_w[level].w, &self.phi_b[level].w, n, l, d);
        up.iter().zip(&conv).map(|(a, b)| (1.0 - RESI) * a + RESI * b).collect()
    }

    /// Codes for z[n, L, d], [n, total] with levels back to back.
    pub fn encode(&self, z: &[F], n: usize) -> Vec<u32> {
        let (d, l, k) = (self.d, self.l, self.levels.len());
        let total = self.total();
        let offs = self.offsets();
        let mut codes = vec![0u32; n * total];
        let mut z_rest = z.to_vec();
        for i in 0..k {
            let lk = self.levels[i];
            let flat = if i == 0 {
                let mut h = z_rest.clone();
                let mut len = l;
                for (s, &stride) in self.strides.iter().enumerate() {
                    h = strided_down_fwd(&h, &self.down_w[s].w, &self.down_b[s].w, n, len, stride, d);
                    len /= stride;
                }
                h
            } else if i < k - 1 {
                area_pool_fwd(&z_rest, n, l, lk, d)
            } else {
                z_rest.clone()
            };
            let idx = nearest(&flat, &self.emb[i], d);
            for s in 0..n {
                codes[s * total + offs[i]..s * total + offs[i] + lk].copy_from_slice(&idx[s * lk..(s + 1) * lk]);
            }
            let c = self.level_contrib(i, &idx, n);
            for (r, cv) in z_rest.iter_mut().zip(&c) {
                *r -= cv;
            }
        }
        codes
    }

    /// One level's codes out of a flat [n, total] code array, as [n, l_level].
    pub fn level_codes(&self, codes: &[u32], n: usize, level: usize) -> Vec<u32> {
        let total = self.total();
        let off = self.offsets()[level];
        let lk = self.levels[level];
        let mut out = Vec::with_capacity(n * lk);
        for s in 0..n {
            out.extend_from_slice(&codes[s * total + off..s * total + off + lk]);
        }
        out
    }

    /// Cumulative reconstruction from the first `upto` levels, [n, L, d].
    pub fn partial(&self, codes: &[u32], n: usize, upto: usize) -> Vec<F> {
        let mut z_hat = vec![0.0 as F; n * self.l * self.d];
        for i in 0..upto {
            let c = self.level_contrib(i, &self.level_codes(codes, n, i), n);
            axpy(1.0 as F, &c, &mut z_hat);
        }
        z_hat
    }

    /// The raw state that a checkpoint must carry besides the parameters.
    pub fn state(&self) -> Vec<&Vec<F>> {
        self.emb.iter().chain(self.ema_cs.iter()).chain(self.ema_w.iter()).collect()
    }
    pub fn state_mut(&mut self) -> Vec<&mut Vec<F>> {
        self.emb.iter_mut().chain(self.ema_cs.iter_mut()).chain(self.ema_w.iter_mut()).collect()
    }
}

impl Params for Quant {
    fn visit(&mut self, f: &mut dyn FnMut(&mut Param)) {
        for group in [&mut self.down_w, &mut self.down_b, &mut self.up_w, &mut self.up_b, &mut self.phi_w, &mut self.phi_b] {
            for p in group.iter_mut() {
                f(p);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stride_plan_matches_reference() {
        assert_eq!(plan_strides(64, 4), vec![4, 4, 4]);
        assert_eq!(plan_strides(8, 4), vec![4, 2]);
        assert_eq!(plan_strides(6, 4), vec![3, 2]);
        assert_eq!(plan_strides(1, 4), vec![1]);
    }

    #[test]
    fn nearest_picks_closest_row() {
        let emb: Vec<F> = vec![0., 0., 10., 10., -5., 5.];
        assert_eq!(nearest(&[9., 9., -4., 4., 0.1, 0.], &emb, 2), vec![1, 2, 0]);
    }
}
