//! The next-concept generator, after `NextConceptTransformer` in the
//! reference `models/next_concept.py`.
//!
//! Level k's codes are predicted, all at once, from the reconstruction built
//! out of levels 1..k-1. Level 1 (a single code) is not predicted; it is
//! sampled from how often each code occurs in the training data.

use crate::block::Block;
use crate::ops::{area_pool_fwd, argmax_rows, axpy, dot, softmax_xent, Rope, Seg};
use crate::param::{pull_grads, zero_grad, Param, Params};
use crate::rng::Rng;
use crate::tape::{Id, Tape};
use crate::tokenizer::Tokenizer;
use crate::F;
use std::rc::Rc;

#[derive(Clone, Debug, PartialEq)]
pub struct GenConfig {
    pub width: usize,
    pub blocks: usize,
    pub heads: usize,
    pub rope_base: f64,
}

pub struct Generator {
    pub cfg: GenConfig,
    d: usize,
    codes: usize,
    /// Lengths of all tokenizer levels; the generator predicts levels 1..K-1.
    levels: Vec<usize>,
    wte_w: Param,
    wte_b: Param,
    prefix: Param,
    wle: Param,
    blocks: Vec<Block>,
    lnf_g: Param,
    lnf_b: Param,
    proj: Vec<Param>,
    log_inv_t: Vec<Param>,
    /// Frozen codebooks in head form, per predicted level:
    /// (2 E^T / scale as [d, codes], -|E|^2 / scale as [codes]).
    heads: Vec<(Vec<F>, Vec<F>)>,
}

#[derive(Clone, Debug, Default)]
pub struct GenStats {
    pub loss: F,
    /// Mean cross-entropy per code (nats) for each predicted level.
    pub per_level_loss: Vec<F>,
    pub per_level_acc: Vec<F>,
}

pub struct GenOut {
    /// [n, total] codes, all levels.
    pub codes: Vec<u32>,
    /// [n, K, L] characters decoded after each level.
    pub texts: Vec<u32>,
}

/// How often each level-1 code occurs in the training data.
#[derive(Clone, Debug, PartialEq)]
pub struct LevelOneDist {
    pub probs: Vec<F>,
}

impl LevelOneDist {
    pub fn from_codes(level1: &[u32], n_codes: usize) -> LevelOneDist {
        let mut probs = vec![0.0 as F; n_codes];
        for &c in level1 {
            probs[c as usize] += 1.0;
        }
        let s: F = probs.iter().sum();
        if s > 0.0 {
            probs.iter_mut().for_each(|p| *p /= s);
        } else {
            probs.iter_mut().for_each(|p| *p = 1.0 / n_codes as F);
        }
        LevelOneDist { probs }
    }
    pub fn sample(&self, rng: &mut Rng) -> u32 {
        sample_probs(&self.probs, rng)
    }
}

fn sample_probs(probs: &[F], rng: &mut Rng) -> u32 {
    let u = rng.uniform();
    let mut acc = 0.0 as F;
    let mut last = 0;
    for (i, &p) in probs.iter().enumerate() {
        if p > 0.0 {
            acc += p;
            last = i;
            if u < acc {
                return i as u32;
            }
        }
    }
    last as u32
}

/// Samples one code from a row of logits. Temperature 0 is argmax; top_k 0
/// (or anything at least the row length) keeps every code.
pub fn sample_logits(row: &[F], temperature: F, top_k: usize, rng: &mut Rng) -> u32 {
    if temperature <= 0.0 {
        return argmax_rows(row, row.len())[0];
    }
    let mut cut = F::NEG_INFINITY;
    if top_k > 0 && top_k < row.len() {
        let mut sorted = row.to_vec();
        sorted.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
        cut = sorted[top_k - 1];
    }
    let mx = row.iter().cloned().fold(F::NEG_INFINITY, F::max);
    let mut probs: Vec<F> = row
        .iter()
        .map(|&v| if v >= cut { ((v - mx) / temperature).exp() } else { 0.0 })
        .collect();
    let s: F = probs.iter().sum();
    probs.iter_mut().for_each(|p| *p /= s);
    sample_probs(&probs, rng)
}

/// Per-code loss weights: w_k = l_k^(-alpha) / sum_j l_j^(1-alpha).
pub fn level_weights(levels: &[usize], alpha: F) -> Vec<F> {
    let denom: F = levels.iter().map(|&l| (l as F).powf(1.0 - alpha)).sum();
    levels.iter().map(|&l| (l as F).powf(-alpha) / denom).collect()
}

/// Corruption rate for each conditioning level (the first K-1 levels):
/// linear from mean+delta at the coarsest to mean-delta at the finest.
pub fn corruption_rates(n_cond: usize, mean: F, delta: F) -> Vec<F> {
    (0..n_cond)
        .map(|j| {
            let pos = if n_cond > 1 { j as F / (n_cond - 1) as F } else { 0.5 };
            (mean + delta * (1.0 - 2.0 * pos)).clamp(0.0, 0.95)
        })
        .collect()
}

impl Generator {
    pub fn new(cfg: GenConfig, tok: &Tokenizer, rng: &mut Rng) -> Generator {
        let (d, w) = (tok.cfg.d, cfg.width);
        let levels = tok.quant.levels.clone();
        let np = levels.len() - 1;
        let mut g = Generator {
            d,
            codes: tok.cfg.codes,
            wte_w: Param::normal(d * w, 0.02, rng),
            wte_b: Param::zeros(w),
            prefix: Param::normal(w, 0.02, rng),
            wle: Param::normal(np * w, 0.02, rng),
            blocks: (0..cfg.blocks).map(|_| Block::new(w, cfg.heads, cfg.blocks, rng)).collect(),
            lnf_g: Param::ones(w),
            lnf_b: Param::zeros(w),
            proj: (0..np).map(|_| Param::normal(w * d, 0.02, rng)).collect(),
            log_inv_t: (0..np).map(|_| Param::zeros(1)).collect(),
            heads: Vec::new(),
            levels,
            cfg,
        };
        g.bind(tok);
        g
    }

    /// Rebuilds the tied output heads from the tokenizer's codebooks. Call
    /// after loading weights.
    pub fn bind(&mut self, tok: &Tokenizer) {
        let (d, v) = (self.d, self.codes);
        self.heads = (1..self.levels.len())
            .map(|k| {
                let e = &tok.quant.emb[k];
                let sq: Vec<F> = e.chunks_exact(d).map(|r| dot(r, r)).collect();
                let scale = (sq.iter().sum::<F>() / v as F).max(1e-12);
                let mut et = vec![0.0 as F; d * v];
                for j in 0..v {
                    for ch in 0..d {
                        et[ch * v + j] = 2.0 * e[j * d + ch] / scale;
                    }
                }
                (et, sq.iter().map(|s| -s / scale).collect())
            })
            .collect();
    }

    /// The transformer input for target level `k` given the reconstruction
    /// from the levels before it: z_hat pooled to the level's length.
    pub fn level_input(&self, z_hat: &[F], n: usize, k: usize) -> Vec<F> {
        let l = *self.levels.last().unwrap();
        if self.levels[k] == l {
            z_hat.to_vec()
        } else {
            area_pool_fwd(z_hat, n, l, self.levels[k], self.d)
        }
    }

    /// Inputs for every predicted level, each [n, l_k, d], built from the
    /// conditioning codes (reference `idx_to_ncm_input`).
    pub fn build_inputs(&self, tok: &Tokenizer, cond: &[u32], n: usize) -> Vec<Vec<F>> {
        let l = *self.levels.last().unwrap();
        let mut z_hat = vec![0.0 as F; n * l * self.d];
        let mut out = Vec::with_capacity(self.levels.len() - 1);
        for k in 1..self.levels.len() {
            let c = tok.quant.level_contrib(k - 1, &tok.quant.level_codes(cond, n, k - 1), n);
            axpy(1.0 as F, &c, &mut z_hat);
            out.push(self.level_input(&z_hat, n, k));
        }
        out
    }

    /// Runs the transformer over `[prefix, level a, level b, ...]` and
    /// returns logits [n * l_k, codes] for each given level. `inputs[i]`
    /// belongs to target level `targets[i]` (1-based level index).
    pub fn forward(&self, t: &mut Tape, inputs: &[Vec<F>], targets: &[usize], n: usize) -> Vec<Id> {
        let (d, w, v) = (self.d, self.cfg.width, self.codes);
        let hd = w / self.cfg.heads;
        let lens: Vec<usize> = targets.iter().map(|&k| self.levels[k]).collect();
        let tt: usize = lens.iter().sum();
        // Interleave the per-level inputs into [n, tt, d].
        let mut x = Vec::with_capacity(n * tt * d);
        for s in 0..n {
            for (inp, &len) in inputs.iter().zip(&lens) {
                x.extend_from_slice(&inp[s * len * d..(s + 1) * len * d]);
            }
        }
        let mut level_ids = Vec::with_capacity(tt);
        let mut positions = vec![0usize];
        let mut segs = vec![Seg { start: 0, len: 1, prefix: 0 }];
        let mut off = 1;
        for (&k, &len) in targets.iter().zip(&lens) {
            level_ids.extend(std::iter::repeat((k - 1) as u32).take(len));
            positions.extend(0..len);
            segs.push(Seg { start: off, len, prefix: 1 });
            off += len;
        }
        let segs = Rc::new(segs);
        let rope = Rc::new(Rope::new(&positions, hd, self.cfg.rope_base));

        let xin = t.constant(x);
        let (ww, wb) = (t.param(&self.wte_w), t.param(&self.wte_b));
        let h = t.linear(xin, ww, Some(wb), d, w);
        let wle = t.param(&self.wle);
        let le = t.embed(wle, &level_ids, w);
        let le = t.tile(le, n);
        let h = t.add(h, le);
        let pre = t.param(&self.prefix);
        let pre = t.tile(pre, n);
        let mut h = t.concat(&[(pre, 1), (h, tt)], n, w);
        for b in &self.blocks {
            h = b.fwd(t, h, n, tt + 1, &segs, Some(&rope));
        }
        let (g, b) = (t.param(&self.lnf_g), t.param(&self.lnf_b));
        let h = t.layernorm(h, g, Some(b), w);
        let mut out = Vec::with_capacity(targets.len());
        let mut off = 1;
        for (&k, &len) in targets.iter().zip(&lens) {
            let hk = t.slice(h, n, tt + 1, off, len, w);
            off += len;
            let pj = t.param(&self.proj[k - 1]);
            let z = t.linear(hk, pj, None, w, d);
            let (et, bias) = &self.heads[k - 1];
            let (et, bias) = (t.constant(et.clone()), t.constant(bias.clone()));
            let logits = t.linear(z, et, Some(bias), d, v);
            let lt = t.param(&self.log_inv_t[k - 1]);
            let inv_t = t.exp(lt);
            out.push(t.mul_scalar(logits, inv_t));
        }
        out
    }

    /// The weighted loss on the tape. `cond` are the (possibly corrupted)
    /// codes the inputs are built from; `codes` are the clean targets.
    fn loss(&self, t: &mut Tape, tok: &Tokenizer, cond: &[u32], codes: &[u32], n: usize, alpha: F) -> (Id, GenStats) {
        let k = self.levels.len();
        let targets: Vec<usize> = (1..k).collect();
        let inputs = self.build_inputs(tok, cond, n);
        let logits = self.forward(t, &inputs, &targets, n);
        let weights = level_weights(&self.levels[1..], alpha);
        let mut total: Option<Id> = None;
        let mut stats = GenStats::default();
        for (i, &lv) in targets.iter().enumerate() {
            let tg = tok.quant.level_codes(codes, n, lv);
            let w = vec![weights[i] / n as F; tg.len()];
            let x = t.xent(logits[i], &tg, &w, self.codes);
            total = Some(match total {
                Some(p) => t.add(p, x),
                None => x,
            });
            let unit = vec![1.0 / tg.len() as F; tg.len()];
            stats.per_level_loss.push(softmax_xent(t.val(logits[i]), &tg, &unit, self.codes).0);
            let pred = argmax_rows(t.val(logits[i]), self.codes);
            let hits = pred.iter().zip(&tg).filter(|(a, b)| a == b).count();
            stats.per_level_acc.push(hits as F / tg.len() as F);
        }
        let total = total.unwrap();
        stats.loss = t.scalar(total);
        (total, stats)
    }

    /// Replaces conditioning codes at random, per level, leaving the last
    /// level (never an input) alone.
    pub fn corrupt(&self, codes: &[u32], n: usize, rng: &mut Rng, mean: F, delta: F) -> Vec<u32> {
        let mut out = codes.to_vec();
        let total: usize = self.levels.iter().sum();
        let rates = corruption_rates(self.levels.len() - 1, mean, delta);
        for s in 0..n {
            let mut off = 0;
            for (j, &len) in self.levels[..self.levels.len() - 1].iter().enumerate() {
                for i in 0..len {
                    if rates[j] > 0.0 && rng.uniform() < rates[j] {
                        out[s * total + off + i] = rng.below(self.codes) as u32;
                    }
                }
                off += len;
            }
        }
        out
    }

    /// One training step's forward and backward; the caller clips and steps.
    /// `threads` above 1 splits the batch across native threads (ignored on wasm).
    #[allow(clippy::too_many_arguments)]
    pub fn train_step(
        &mut self,
        tok: &Tokenizer,
        codes: &[u32],
        n: usize,
        rng: &mut Rng,
        alpha: F,
        corrupt_mean: F,
        corrupt_delta: F,
        threads: usize,
    ) -> GenStats {
        zero_grad(self);
        let cond = if corrupt_mean > 0.0 || corrupt_delta > 0.0 {
            self.corrupt(codes, n, rng, corrupt_mean, corrupt_delta)
        } else {
            codes.to_vec()
        };
        let shards = if cfg!(target_arch = "wasm32") { 1 } else { threads.clamp(1, n) };
        if shards == 1 {
            let mut t = Tape::new();
            let (root, stats) = self.loss(&mut t, tok, &cond, codes, n, alpha);
            t.backward(root);
            pull_grads(self, &t);
            return stats;
        }
        // Each shard computes the mean loss over its own windows; weighting
        // by shard size gives the gradient of the mean over the whole batch.
        let total: usize = self.levels.iter().sum();
        let mut bounds = Vec::with_capacity(shards);
        let mut start = 0;
        for i in 0..shards {
            let len = n / shards + usize::from(i < n % shards);
            bounds.push((start, len));
            start += len;
        }
        let this: &Generator = self;
        let results: Vec<(usize, GenStats, Vec<(usize, Vec<F>)>)> = std::thread::scope(|sc| {
            let handles: Vec<_> = bounds
                .iter()
                .map(|&(a, len)| {
                    let (cond, codes) = (&cond[a * total..(a + len) * total], &codes[a * total..(a + len) * total]);
                    sc.spawn(move || {
                        let mut t = Tape::new();
                        let (root, stats) = this.loss(&mut t, tok, cond, codes, len, alpha);
                        t.backward(root);
                        (len, stats, t.take_param_grads())
                    })
                })
                .collect();
            handles.into_iter().map(|h| h.join().expect("shard panicked")).collect()
        });
        let np = self.levels.len() - 1;
        let mut stats = GenStats { loss: 0.0, per_level_loss: vec![0.0; np], per_level_acc: vec![0.0; np] };
        let mut merged: std::collections::HashMap<usize, Vec<F>> = std::collections::HashMap::new();
        for (len, s, grads) in results {
            let w = len as F / n as F;
            stats.loss += w * s.loss;
            for i in 0..np {
                stats.per_level_loss[i] += w * s.per_level_loss[i];
                stats.per_level_acc[i] += w * s.per_level_acc[i];
            }
            for (key, g) in grads {
                match merged.get_mut(&key) {
                    Some(acc) => axpy(w, &g, acc),
                    None => {
                        merged.insert(key, g.iter().map(|v| v * w).collect());
                    }
                }
            }
        }
        self.visit(&mut |p| {
            if let Some(g) = merged.get(&(p.w.as_ptr() as usize)) {
                p.g.copy_from_slice(g);
            }
        });
        stats
    }

    /// Loss and accuracy with clean inputs and no gradient.
    pub fn eval(&self, tok: &Tokenizer, codes: &[u32], n: usize, alpha: F) -> GenStats {
        let mut t = Tape::new();
        self.loss(&mut t, tok, codes, codes, n, alpha).1
    }

    /// Generates `n` windows level by level. `forced_l1`, when given, fixes
    /// the level-1 codes instead of sampling them.
    #[allow(clippy::too_many_arguments)]
    pub fn generate(
        &self,
        tok: &Tokenizer,
        l1: &LevelOneDist,
        n: usize,
        rng: &mut Rng,
        temperature: F,
        top_k: usize,
        forced_l1: Option<&[u32]>,
    ) -> GenOut {
        let k = self.levels.len();
        let l = self.levels[k - 1];
        let total: usize = self.levels.iter().sum();
        let offs = tok.quant.offsets();
        let mut codes = vec![0u32; n * total];
        let mut texts = vec![0u32; n * k * l];
        let mut z_hat = vec![0.0 as F; n * l * self.d];
        for lv in 0..k {
            let len = self.levels[lv];
            let idx: Vec<u32> = if lv == 0 {
                match forced_l1 {
                    Some(f) => f.to_vec(),
                    None => (0..n * len).map(|_| l1.sample(rng)).collect(),
                }
            } else {
                let mut t = Tape::new();
                let input = self.level_input(&z_hat, n, lv);
                let logits = self.forward(&mut t, &[input], &[lv], n)[0];
                t.val(logits).chunks_exact(self.codes).map(|row| sample_logits(row, temperature, top_k, rng)).collect()
            };
            for s in 0..n {
                codes[s * total + offs[lv]..s * total + offs[lv] + len].copy_from_slice(&idx[s * len..(s + 1) * len]);
            }
            axpy(1.0 as F, &tok.quant.level_contrib(lv, &idx, n), &mut z_hat);
            let text = tok.decode_z(&z_hat, n);
            for s in 0..n {
                texts[(s * k + lv) * l..(s * k + lv + 1) * l].copy_from_slice(&text[s * l..(s + 1) * l]);
            }
        }
        GenOut { codes, texts }
    }

    /// Generates one window whose first `known` characters are given.
    /// `tokens` is [L]: the known characters followed by any filler.
    ///
    /// The paper only generates unconditionally; this is the page's own
    /// conditioning. At every level, a code whose span lies entirely inside
    /// the known characters is not sampled: it is the code the tokenizer
    /// would pick there, measured against the reconstruction built so far.
    /// The single level-1 code is taken from the encoded window too. All
    /// other codes are sampled from the generator as usual. Returns the L
    /// characters decoded from all levels.
    #[allow(clippy::too_many_arguments)]
    pub fn complete_window(
        &self,
        tok: &Tokenizer,
        l1: &LevelOneDist,
        tokens: &[u32],
        known: usize,
        rng: &mut Rng,
        temperature: F,
        top_k: usize,
    ) -> Vec<u32> {
        let k = self.levels.len();
        let l = self.levels[k - 1];
        let known = known.min(l);
        let z = tok.latents(tokens, 1);
        let mut z_hat = vec![0.0 as F; l * self.d];
        for lv in 0..k {
            let len = self.levels[lv];
            let rest: Vec<F> = z.iter().zip(&z_hat).map(|(a, b)| a - b).collect();
            let enc = tok.quant.nearest_at(lv, &rest, 1);
            let idx: Vec<u32> = if lv == 0 {
                if known > 0 {
                    enc
                } else {
                    (0..len).map(|_| l1.sample(rng)).collect()
                }
            } else {
                let mut t = Tape::new();
                let input = self.level_input(&z_hat, 1, lv);
                let logits = self.forward(&mut t, &[input], &[lv], 1)[0];
                t.val(logits)
                    .chunks_exact(self.codes)
                    .enumerate()
                    .map(|(j, row)| {
                        // Sample every position so the random stream does not
                        // depend on the prompt length.
                        let c = sample_logits(row, temperature, top_k, rng);
                        if (j + 1) * l <= known * len {
                            enc[j]
                        } else {
                            c
                        }
                    })
                    .collect()
            };
            axpy(1.0 as F, &tok.quant.level_contrib(lv, &idx, 1), &mut z_hat);
        }
        tok.decode_z(&z_hat, 1)
    }

    /// Continues `prompt` by `n_chars` characters. Each window holds up to
    /// L/2 characters of context (the end of the prompt plus what has been
    /// written so far) and the rest is generated; the window then slides.
    /// Every window is generated twice: the first pass fills the unknown
    /// part, and the second re-reads the window with that filling in place,
    /// so that the known codes are measured in a realistic context.
    #[allow(clippy::too_many_arguments)]
    pub fn complete(
        &self,
        tok: &Tokenizer,
        l1: &LevelOneDist,
        prompt: &[u32],
        n_chars: usize,
        rng: &mut Rng,
        temperature: F,
        top_k: usize,
    ) -> Vec<u32> {
        let l = self.levels[self.levels.len() - 1];
        let ctx = (l / 2).max(1);
        let mut text = prompt.to_vec();
        let mut out = Vec::with_capacity(n_chars + l);
        while out.len() < n_chars {
            let known = text.len().min(ctx);
            let prefix = &text[text.len() - known..];
            let mut window: Vec<u32> = if known > 0 { (0..l).map(|i| prefix[i % known]).collect() } else { vec![0; l] };
            for _ in 0..if known > 0 { 2 } else { 1 } {
                let w = self.complete_window(tok, l1, &window, known, rng, temperature, top_k);
                window[known..].copy_from_slice(&w[known..]);
            }
            out.extend_from_slice(&window[known..]);
            text.extend_from_slice(&window[known..]);
        }
        out.truncate(n_chars);
        out
    }
}

impl Params for Generator {
    fn visit(&mut self, f: &mut dyn FnMut(&mut Param)) {
        f(&mut self.wte_w);
        f(&mut self.wte_b);
        f(&mut self.prefix);
        f(&mut self.wle);
        for b in self.blocks.iter_mut() {
            b.visit(f);
        }
        f(&mut self.lnf_g);
        f(&mut self.lnf_b);
        for p in self.proj.iter_mut() {
            f(p);
        }
        for p in self.log_inv_t.iter_mut() {
            f(p);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::param::{clip_grad_norm, AdamW};
    use crate::tokenizer::{tiny_config, tiny_tokens};

    #[test]
    fn completing_a_fully_known_window_is_reconstruction() {
        let (tok, gen, mut r) = setup(16, 1);
        let l1 = LevelOneDist::from_codes(&[], 5);
        let tokens = tiny_tokens(1, &mut r);
        let out = gen.complete_window(&tok, &l1, &tokens, 8, &mut r, 1.0, 0);
        assert_eq!(out, tok.decode(&tok.encode(&tokens, 1), 1, 4));
    }

    #[test]
    fn complete_returns_the_requested_length_and_is_seeded() {
        let (tok, gen, _) = setup(16, 1);
        let l1 = LevelOneDist::from_codes(&[], 5);
        for prompt in [vec![], vec![1u32, 2, 3], (0..20).map(|i| i % 7).collect::<Vec<u32>>()] {
            let a = gen.complete(&tok, &l1, &prompt, 21, &mut Rng::new(3), 1.0, 0);
            let b = gen.complete(&tok, &l1, &prompt, 21, &mut Rng::new(3), 1.0, 0);
            assert_eq!(a.len(), 21);
            assert_eq!(a, b);
            assert!(a.iter().all(|&c| c < 7));
        }
    }

    fn setup(width: usize, blocks: usize) -> (Tokenizer, Generator, Rng) {
        let mut r = Rng::new(21);
        let tok = Tokenizer::new(tiny_config(), &mut r);
        let gen = Generator::new(GenConfig { width, blocks, heads: 2, rope_base: 10000.0 }, &tok, &mut r);
        (tok, gen, r)
    }

    #[cfg(feature = "f64")]
    #[test]
    fn generator_grad() {
        use crate::tape::gradcheck_model;
        let (mut tok, mut gen, mut r) = setup(8, 1);
        gen.visit(&mut |p| {
            if p.decay {
                p.w.iter_mut().for_each(|w| *w *= 10.0);
            }
        });
        let codes = tok.encode(&tiny_tokens(2, &mut r), 2);
        let err = gradcheck_model(
            &mut gen,
            &mut |m, grads| {
                if grads {
                    zero_grad(m);
                }
                let mut t = Tape::new();
                let (root, stats) = m.loss(&mut t, &tok, &codes, &codes, 2, 0.5);
                if grads {
                    t.backward(root);
                    pull_grads(m, &t);
                }
                Some(stats.loss)
            },
            12,
        );
        assert!(err < 1e-5, "max relative error {}", err);
        // The frozen tokenizer gets no gradient.
        zero_grad(&mut tok);
        gen.train_step(&tok, &codes, 2, &mut r, 0.0, 0.0, 0.0, 1);
        tok.visit(&mut |p| assert!(p.g.iter().all(|g| *g == 0.0)));
    }

    #[test]
    fn threaded_step_matches_single() {
        let (tok, mut gen, mut r) = setup(8, 1);
        let codes = tok.encode(&tiny_tokens(5, &mut r), 5);
        let a = gen.train_step(&tok, &codes, 5, &mut r, 0.0, 0.0, 0.0, 1);
        let mut single = Vec::new();
        gen.visit(&mut |p| single.push(p.g.clone()));
        let b = gen.train_step(&tok, &codes, 5, &mut r, 0.0, 0.0, 0.0, 3);
        let mut multi = Vec::new();
        gen.visit(&mut |p| multi.push(p.g.clone()));
        assert!((a.loss - b.loss).abs() < 1e-5);
        for (x, y) in single.iter().flatten().zip(multi.iter().flatten()) {
            assert!((x - y).abs() < 1e-5, "{} vs {}", x, y);
        }
        assert!(single.iter().flatten().any(|g| g.abs() > 1e-6));
    }

    #[test]
    fn loss_weights_sum() {
        let levels = [2usize, 4, 8];
        for alpha in [0.0, 1.0] {
            let w = level_weights(&levels, alpha);
            let s: F = w.iter().zip(&levels).map(|(w, &l)| w * l as F).sum();
            assert!((s - 1.0).abs() < 1e-6);
        }
        let w = level_weights(&levels, 1.0);
        for (wk, &l) in w.iter().zip(&levels) {
            assert!((wk * l as F - 1.0 / 3.0).abs() < 1e-6);
        }
        let w0 = level_weights(&levels, 0.0);
        assert!(w0.iter().all(|w| (w - 1.0 / 14.0).abs() < 1e-6));
    }

    #[test]
    fn corruption_rate_schedule() {
        let r = corruption_rates(8, 0.5, 0.3);
        assert!((r[0] - 0.8).abs() < 1e-6 && (r[7] - 0.2).abs() < 1e-6);
        assert!((r.iter().sum::<F>() / 8.0 - 0.5).abs() < 1e-6);
        assert!(r.windows(2).all(|w| w[0] > w[1]));
        assert!((corruption_rates(8, 0.9, 0.3)[0] - 0.95).abs() < 1e-6);
        assert_eq!(corruption_rates(8, 0.0, 0.0), vec![0.0; 8]);
    }

    #[test]
    fn corruption_observed_rate() {
        let (_tok, gen, mut r) = setup(8, 1);
        // levels [1, 2, 4, 8], 5 codes; all codes start at 0.
        let n = 4000;
        let codes = vec![0u32; n * 15];
        let out = gen.corrupt(&codes, n, &mut r, 0.5, 0.3);
        let rates = corruption_rates(3, 0.5, 0.3);
        let (offs, lens) = ([0usize, 1, 3], [1usize, 2, 4]);
        for j in 0..3 {
            let mut changed = 0;
            for s in 0..n {
                changed += out[s * 15 + offs[j]..s * 15 + offs[j] + lens[j]].iter().filter(|c| **c != 0).count();
            }
            let observed = changed as F / (n * lens[j]) as F;
            let expected = rates[j] * (1.0 - 1.0 / 5.0);
            assert!((observed - expected).abs() < 0.03, "level {}: {} vs {}", j, observed, expected);
        }
        // The finest level is never an input and is left alone.
        assert!((0..n).all(|s| out[s * 15 + 7..s * 15 + 15].iter().all(|c| *c == 0)));
    }

    #[test]
    fn train_inputs_match_generation() {
        let (tok, gen, mut r) = setup(8, 1);
        let codes = tok.encode(&tiny_tokens(2, &mut r), 2);
        let inputs = gen.build_inputs(&tok, &codes, 2);
        let mut t = Tape::new();
        let all = gen.forward(&mut t, &inputs, &[1, 2, 3], 2);
        let mut z_hat = vec![0.0 as F; 2 * 8 * 8];
        for lv in 1..4 {
            axpy(1.0 as F, &tok.quant.level_contrib(lv - 1, &tok.quant.level_codes(&codes, 2, lv - 1), 2), &mut z_hat);
            let single = gen.level_input(&z_hat, 2, lv);
            for (a, b) in single.iter().zip(&inputs[lv - 1]) {
                assert!((a - b).abs() < 1e-6);
            }
            let mut t2 = Tape::new();
            let one = gen.forward(&mut t2, &[single], &[lv], 2)[0];
            for (a, b) in t2.val(one).iter().zip(t.val(all[lv - 1])) {
                assert!((a - b).abs() < 1e-4, "level {}: {} vs {}", lv, a, b);
            }
        }
    }

    #[test]
    fn overfits_and_regenerates() {
        let (tok, mut gen, mut r) = setup(16, 2);
        // Four windows with distinct level-1 codes so the chain is determined.
        let mut codes = vec![0u32; 4 * 15];
        for s in 0..4 {
            codes[s * 15] = s as u32;
            for i in 1..15 {
                codes[s * 15 + i] = r.below(5) as u32;
            }
        }
        let mut opt = AdamW::new(0.0);
        for _ in 0..600 {
            gen.train_step(&tok, &codes, 4, &mut r, 0.0, 0.0, 0.0, 1);
            clip_grad_norm(&mut gen, 1.0);
            opt.step(&mut gen, 3e-3);
        }
        let stats = gen.eval(&tok, &codes, 4, 0.0);
        assert!(stats.per_level_acc.iter().all(|a| (*a - 1.0).abs() < 1e-6), "{:?}", stats.per_level_acc);
        let l1 = LevelOneDist::from_codes(&[0, 1, 2, 3], 5);
        let out = gen.generate(&tok, &l1, 4, &mut r, 0.0, 0, Some(&[0, 1, 2, 3]));
        assert_eq!(out.codes, codes);
        assert_eq!(out.texts.len(), 4 * 4 * 8);
        // The text after the last level is the decoder's reading of all codes.
        let full = tok.decode(&codes, 4, 4);
        for s in 0..4 {
            assert_eq!(&out.texts[(s * 4 + 3) * 8..(s * 4 + 4) * 8], &full[s * 8..(s + 1) * 8]);
        }
    }

    #[test]
    fn sampling_extremes() {
        let mut r = Rng::new(1);
        let row: Vec<F> = vec![0.1, 2.0, -1.0, 1.9, 0.0];
        for seed in 0..5 {
            assert_eq!(sample_logits(&row, 0.0, 0, &mut Rng::new(seed)), 1);
        }
        let mut seen = [false; 5];
        for _ in 0..400 {
            seen[sample_logits(&row, 1.0, 0, &mut r) as usize] = true;
            assert!(sample_logits(&row, 1.0, 10_000, &mut r) < 5);
        }
        assert!(seen.iter().all(|s| *s), "top_k 0 must keep every code");
        for _ in 0..200 {
            let c = sample_logits(&row, 1.0, 2, &mut r);
            assert!(c == 1 || c == 3, "top_k 2 picked {}", c);
        }
        // An all-zero codebook row gives finite logits.
        let (mut tok, mut gen, mut r) = setup(8, 1);
        tok.quant.emb[2][..8].iter_mut().for_each(|v| *v = 0.0);
        gen.bind(&tok);
        let l1 = LevelOneDist::from_codes(&[], 5);
        let out = gen.generate(&tok, &l1, 2, &mut r, 1.0, 0, None);
        assert!(out.codes.iter().all(|c| *c < 5));
        let codes = out.codes.clone();
        assert!(gen.eval(&tok, &codes, 2, 0.0).loss.is_finite());
    }

    #[test]
    fn generation_deterministic() {
        let (tok, gen, _) = setup(8, 1);
        let l1 = LevelOneDist::from_codes(&[0, 1, 1, 4], 5);
        let a = gen.generate(&tok, &l1, 3, &mut Rng::new(5), 1.0, 0, None);
        let b = gen.generate(&tok, &l1, 3, &mut Rng::new(5), 1.0, 0, None);
        let c = gen.generate(&tok, &l1, 3, &mut Rng::new(6), 1.0, 0, None);
        assert_eq!(a.codes, b.codes);
        assert_eq!(a.texts, b.texts);
        assert_ne!(a.codes, c.codes);
    }
}
