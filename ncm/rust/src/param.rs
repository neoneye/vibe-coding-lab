//! Trainable parameters and the AdamW optimiser.

use crate::rng::Rng;
use crate::tape::Tape;
use crate::F;

pub struct Param {
    pub w: Vec<F>,
    pub g: Vec<F>,
    pub m: Vec<F>,
    pub v: Vec<F>,
    /// Whether weight decay applies (matrices yes, gains and biases no).
    pub decay: bool,
}

impl Param {
    pub fn from_vec(w: Vec<F>, decay: bool) -> Param {
        let n = w.len();
        Param { w, g: vec![0.0 as F; n], m: vec![0.0 as F; n], v: vec![0.0 as F; n], decay }
    }
    pub fn normal(n: usize, std: F, rng: &mut Rng) -> Param {
        Param::from_vec((0..n).map(|_| rng.normal() * std).collect(), true)
    }
    pub fn zeros(n: usize) -> Param {
        Param::from_vec(vec![0.0 as F; n], false)
    }
    pub fn ones(n: usize) -> Param {
        Param::from_vec(vec![1.0 as F; n], false)
    }
}

pub trait Params {
    fn visit(&mut self, f: &mut dyn FnMut(&mut Param));
}

impl Params for Vec<Param> {
    fn visit(&mut self, f: &mut dyn FnMut(&mut Param)) {
        for p in self.iter_mut() {
            f(p);
        }
    }
}

pub fn zero_grad(model: &mut dyn Params) {
    model.visit(&mut |p| {
        p.g.iter_mut().for_each(|g| *g = 0.0 as F);
    });
}

/// Adds the tape's gradients into each parameter that was placed on it.
pub fn pull_grads(model: &mut dyn Params, tape: &Tape) {
    model.visit(&mut |p| {
        if let Some(g) = tape.param_grad(p) {
            for (a, b) in p.g.iter_mut().zip(g) {
                *a += b;
            }
        }
    });
}

pub fn count(model: &mut dyn Params) -> usize {
    let mut n = 0;
    model.visit(&mut |p| n += p.w.len());
    n
}

/// Scales gradients so their global norm is at most `max`. Returns the norm
/// before clipping.
pub fn clip_grad_norm(model: &mut dyn Params, max: F) -> F {
    let mut ss = 0.0 as F;
    model.visit(&mut |p| ss += p.g.iter().map(|g| g * g).sum::<F>());
    let norm = ss.sqrt();
    if norm > max {
        let s = max / norm;
        model.visit(&mut |p| p.g.iter_mut().for_each(|g| *g *= s));
    }
    norm
}

pub struct AdamW {
    pub beta1: F,
    pub beta2: F,
    pub eps: F,
    pub weight_decay: F,
    pub t: u32,
}

impl AdamW {
    pub fn new(weight_decay: F) -> AdamW {
        AdamW { beta1: 0.9, beta2: 0.95, eps: 1e-8, weight_decay, t: 0 }
    }
    pub fn step(&mut self, model: &mut dyn Params, lr: F) {
        self.t += 1;
        let (b1, b2, eps, wd) = (self.beta1, self.beta2, self.eps, self.weight_decay);
        let c1 = 1.0 - b1.powi(self.t as i32);
        let c2 = 1.0 - b2.powi(self.t as i32);
        model.visit(&mut |p| {
            let decay = if p.decay { wd } else { 0.0 as F };
            for i in 0..p.w.len() {
                let g = p.g[i];
                p.m[i] = b1 * p.m[i] + (1.0 - b1) * g;
                p.v[i] = b2 * p.v[i] + (1.0 - b2) * g * g;
                let mh = p.m[i] / c1;
                let vh = p.v[i] / c2;
                p.w[i] -= lr * (mh / (vh.sqrt() + eps) + decay * p.w[i]);
            }
        });
    }
    pub fn reset(&mut self, model: &mut dyn Params) {
        self.t = 0;
        model.visit(&mut |p| {
            p.m.iter_mut().for_each(|x| *x = 0.0 as F);
            p.v.iter_mut().for_each(|x| *x = 0.0 as F);
        });
    }
}

/// Linear warmup to `peak`, cosine to `floor_frac * peak` at `total`, then flat.
pub fn lr_at(step: u32, warmup: u32, total: u32, peak: F, floor_frac: F) -> F {
    if step < warmup {
        return peak * step as F / warmup as F;
    }
    if step >= total {
        return peak * floor_frac;
    }
    let p = (step - warmup) as F / (total - warmup).max(1) as F;
    let cos = 0.5 * (1.0 + (std::f64::consts::PI as F * p).cos());
    peak * (floor_frac + (1.0 - floor_frac) * cos)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adamw_minimises_quadratic() {
        let mut m = vec![Param::from_vec(vec![0.0, 10.0, -4.0], false)];
        let mut opt = AdamW::new(0.0);
        for step in 0..500 {
            zero_grad(&mut m);
            for i in 0..3 {
                m[0].g[i] = 2.0 * (m[0].w[i] - 3.0);
            }
            opt.step(&mut m, 0.05 * (1.0 - step as F / 500.0));
        }
        let loss: F = m[0].w.iter().map(|w| (w - 3.0) * (w - 3.0)).sum();
        assert!(loss < 1e-6, "loss {}", loss);
    }

    #[test]
    fn clip_scales_to_one() {
        let mut m = vec![Param::from_vec(vec![0.0; 2], false)];
        m[0].g = vec![6.0, 8.0];
        let before = clip_grad_norm(&mut m, 1.0);
        assert!((before - 10.0).abs() < 1e-5);
        let after = (m[0].g[0] * m[0].g[0] + m[0].g[1] * m[0].g[1]).sqrt();
        assert!((after - 1.0).abs() < 1e-6);
    }

    #[test]
    fn lr_schedule_shape() {
        assert_eq!(lr_at(0, 10, 100, 1.0, 0.1), 0.0);
        assert!((lr_at(10, 10, 100, 1.0, 0.1) - 1.0).abs() < 1e-6);
        assert!((lr_at(100, 10, 100, 1.0, 0.1) - 0.1).abs() < 1e-6);
        assert!((lr_at(5000, 10, 100, 1.0, 0.1) - 0.1).abs() < 1e-6);
        assert!(lr_at(55, 10, 100, 1.0, 0.1) < 1.0 && lr_at(55, 10, 100, 1.0, 0.1) > 0.1);
    }
}
