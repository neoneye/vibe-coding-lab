//! The tokenizer (VQ-VAE): embedding-only encoder, multiscale residual
//! quantiser, one-block transformer decoder. After `models/vqvae.py` and
//! `models/vae.py` in the reference with `enc_layers=0, dec_layers=1`.

use crate::block::{full_seg, Block};
use crate::ops::argmax_rows;
use crate::param::{pull_grads, zero_grad, Param, Params};
use crate::quant::{Quant, TokConfig};
use crate::rng::Rng;
use crate::tape::{Id, Tape};
use crate::F;

pub struct Tokenizer {
    pub cfg: TokConfig,
    wte: Param,
    wpe: Param,
    pub quant: Quant,
    blocks: Vec<Block>,
    lnf: Param,
    out: Param,
}

#[derive(Clone, Debug, Default)]
pub struct TokStats {
    pub loss: F,
    pub recon_loss: F,
    pub vq_loss: F,
    /// Character accuracy of this step's reconstruction (at the kept depth).
    pub acc: F,
    pub kept_levels: usize,
}

impl Tokenizer {
    pub fn new(cfg: TokConfig, rng: &mut Rng) -> Tokenizer {
        let d = cfg.d;
        Tokenizer {
            wte: Param::normal(cfg.vocab * d, 0.02, rng),
            wpe: Param::normal(cfg.l * d, 0.02, rng),
            quant: Quant::new(&cfg, rng),
            blocks: (0..cfg.dec_blocks).map(|_| Block::new(d, cfg.dec_heads, cfg.dec_blocks, rng)).collect(),
            lnf: Param::ones(d),
            out: Param::normal(d * cfg.vocab, 0.02, rng),
            cfg,
        }
    }

    /// Encoder: token + position embedding, then group norm. [n, L, d].
    fn encode_z(&self, t: &mut Tape, tokens: &[u32], n: usize) -> Id {
        let (l, d) = (self.cfg.l, self.cfg.d);
        let wte = t.param(&self.wte);
        let wpe = t.param(&self.wpe);
        let e = t.embed(wte, tokens, d);
        let p = t.tile(wpe, n);
        let x = t.add(e, p);
        t.groupnorm(x, n, l, d, self.cfg.groups)
    }

    /// Decoder: blocks, final norm, linear to character logits. [n*L, vocab].
    fn decode_logits(&self, t: &mut Tape, z: Id, n: usize) -> Id {
        let (l, d) = (self.cfg.l, self.cfg.d);
        let segs = full_seg(l);
        let mut x = z;
        for b in &self.blocks {
            x = b.fwd(t, x, n, l, &segs, None);
        }
        let g = t.param(&self.lnf);
        let x = t.layernorm(x, g, None, d);
        let w = t.param(&self.out);
        t.linear(x, w, None, d, self.cfg.vocab)
    }

    /// The loss on the tape; shared by training and the gradient check.
    fn loss(&mut self, t: &mut Tape, tokens: &[u32], n: usize, rng: &mut Rng, fine_drop: F) -> (Id, TokStats, Vec<u32>) {
        let l = self.cfg.l;
        let z = self.encode_z(t, tokens, n);
        let q = self.quant.fwd_train(t, z, n, rng, fine_drop);
        let logits = self.decode_logits(t, q.z_dec, n);
        let w = vec![1.0 / (n * l) as F; n * l];
        let recon = t.xent(logits, tokens, &w, self.cfg.vocab);
        let total = t.add(recon, q.vq_loss);
        let pred = argmax_rows(t.val(logits), self.cfg.vocab);
        let hits = pred.iter().zip(tokens).filter(|(a, b)| a == b).count();
        let stats = TokStats {
            loss: t.scalar(total),
            recon_loss: t.scalar(recon),
            vq_loss: t.scalar(q.vq_loss),
            acc: hits as F / (n * l) as F,
            kept_levels: q.kept_levels,
        };
        (total, stats, q.codes)
    }

    /// One training step's forward and backward. Gradients are left in the
    /// parameters; the caller clips and steps the optimiser.
    pub fn train_step(&mut self, tokens: &[u32], n: usize, rng: &mut Rng, fine_drop: F) -> TokStats {
        zero_grad(self);
        let mut t = Tape::new();
        let (root, stats, _) = self.loss(&mut t, tokens, n, rng, fine_drop);
        t.backward(root);
        pull_grads(self, &t);
        stats
    }

    /// Encoder output as plain values.
    pub fn latents(&self, tokens: &[u32], n: usize) -> Vec<F> {
        let mut t = Tape::new();
        let z = self.encode_z(&mut t, tokens, n);
        t.val(z).to_vec()
    }

    /// Codes for `n` windows of tokens, [n, total].
    pub fn encode(&self, tokens: &[u32], n: usize) -> Vec<u32> {
        self.quant.encode(&self.latents(tokens, n), n)
    }

    /// Characters (argmax) for a latent reconstruction z_hat[n, L, d].
    pub fn decode_z(&self, z_hat: &[F], n: usize) -> Vec<u32> {
        let mut t = Tape::new();
        let z = t.constant(z_hat.to_vec());
        let logits = self.decode_logits(&mut t, z, n);
        argmax_rows(t.val(logits), self.cfg.vocab)
    }

    /// Characters decoded from the first `upto` levels of `codes`.
    pub fn decode(&self, codes: &[u32], n: usize, upto: usize) -> Vec<u32> {
        self.decode_z(&self.quant.partial(codes, n, upto), n)
    }

    /// Reconstruction accuracy at every level cutoff 1..=K for `n` windows.
    pub fn cutoff_accuracy(&self, tokens: &[u32], n: usize) -> Vec<F> {
        let codes = self.encode(tokens, n);
        let k = self.quant.n_levels();
        let mut z_hat = vec![0.0 as F; n * self.cfg.l * self.cfg.d];
        let mut out = Vec::with_capacity(k);
        for i in 0..k {
            let c = self.quant.level_contrib(i, &self.quant.level_codes(&codes, n, i), n);
            crate::ops::axpy(1.0 as F, &c, &mut z_hat);
            let pred = self.decode_z(&z_hat, n);
            let hits = pred.iter().zip(tokens).filter(|(a, b)| a == b).count();
            out.push(hits as F / tokens.len() as F);
        }
        out
    }
}

impl Params for Tokenizer {
    fn visit(&mut self, f: &mut dyn FnMut(&mut Param)) {
        f(&mut self.wte);
        f(&mut self.wpe);
        self.quant.visit(f);
        for b in self.blocks.iter_mut() {
            b.visit(f);
        }
        f(&mut self.lnf);
        f(&mut self.out);
    }
}

#[cfg(test)]
pub fn tiny_config() -> TokConfig {
    TokConfig { vocab: 7, l: 8, d: 8, levels: vec![1, 2, 4, 8], codes: 5, dec_blocks: 1, dec_heads: 2, groups: 2 }
}

#[cfg(test)]
pub fn tiny_tokens(n: usize, rng: &mut Rng) -> Vec<u32> {
    (0..n * 8).map(|_| rng.below(7) as u32).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::param::{clip_grad_norm, AdamW};

    #[cfg(feature = "f64")]
    #[test]
    fn tokenizer_grad() {
        use crate::tape::gradcheck_model;
        for fine_drop in [0.0, 1.0] {
            let mut r = Rng::new(7);
            let mut tok = Tokenizer::new(tiny_config(), &mut r);
            tok.quant.ema = false;
            // Scale weights up so that every path carries signal.
            tok.visit(&mut |p| {
                if p.decay {
                    p.w.iter_mut().for_each(|w| *w *= 10.0);
                }
            });
            let tokens = tiny_tokens(2, &mut r);
            let mut base: Option<Vec<u32>> = None;
            let err = gradcheck_model(
                &mut tok,
                &mut |m, grads| {
                    let mut rng = Rng::new(11);
                    if grads {
                        zero_grad(m);
                        m.quant.sg = crate::quant::Sg::Record(Vec::new());
                    }
                    let mut t = Tape::new();
                    let (root, stats, codes) = m.loss(&mut t, &tokens, 2, &mut rng, fine_drop);
                    if grads {
                        t.backward(root);
                        pull_grads(m, &t);
                        base = Some(codes);
                        if let crate::quant::Sg::Record(store) = std::mem::replace(&mut m.quant.sg, crate::quant::Sg::Live) {
                            m.quant.sg = crate::quant::Sg::Replay(store, 0);
                        }
                        return Some(stats.loss);
                    }
                    // A perturbation that changes a code choice is not differentiable.
                    if base.as_ref() != Some(&codes) {
                        return None;
                    }
                    Some(stats.loss)
                },
                12,
            );
            assert!(err < 1e-5, "fine_drop {}: max relative error {}", fine_drop, err);
        }
    }

    #[test]
    fn encode_matches_training_codes() {
        let mut r = Rng::new(1);
        let mut tok = Tokenizer::new(tiny_config(), &mut r);
        tok.quant.ema = false;
        let tokens = tiny_tokens(3, &mut r);
        let mut t = Tape::new();
        let (_, _, codes) = tok.loss(&mut t, &tokens, 3, &mut r, 0.0);
        assert_eq!(codes, tok.encode(&tokens, 3));
    }

    #[test]
    fn partial_all_levels_equals_training_z_hat() {
        let mut r = Rng::new(2);
        let mut tok = Tokenizer::new(tiny_config(), &mut r);
        tok.quant.ema = false;
        let tokens = tiny_tokens(2, &mut r);
        let mut t = Tape::new();
        let z = tok.encode_z(&mut t, &tokens, 2);
        let q = tok.quant.fwd_train(&mut t, z, 2, &mut r, 0.0);
        // The decoder input z + sg(z_hat - z) has the value of z_hat.
        let z_hat = tok.quant.partial(&q.codes, 2, 4);
        for (a, b) in t.val(q.z_dec).iter().zip(&z_hat) {
            assert!((a - b).abs() < 1e-5, "{} vs {}", a, b);
        }
    }

    #[test]
    fn decode_full_equals_training_argmax() {
        let mut r = Rng::new(3);
        let mut tok = Tokenizer::new(tiny_config(), &mut r);
        tok.quant.ema = false;
        let tokens = tiny_tokens(2, &mut r);
        let mut t = Tape::new();
        let z = tok.encode_z(&mut t, &tokens, 2);
        let q = tok.quant.fwd_train(&mut t, z, 2, &mut r, 0.0);
        let logits = tok.decode_logits(&mut t, q.z_dec, 2);
        let train_pred = argmax_rows(t.val(logits), 7);
        assert_eq!(train_pred, tok.decode(&q.codes, 2, 4));
    }

    fn train(tok: &mut Tokenizer, tokens: &[u32], n: usize, steps: usize, r: &mut Rng) {
        let mut opt = AdamW::new(0.0);
        for _ in 0..steps {
            tok.train_step(tokens, n, r, 0.0);
            clip_grad_norm(tok, 1.0);
            opt.step(tok, 3e-3);
        }
    }

    #[test]
    fn overfits_one_batch() {
        let mut r = Rng::new(4);
        let mut tok = Tokenizer::new(tiny_config(), &mut r);
        let tokens = tiny_tokens(4, &mut r);
        train(&mut tok, &tokens, 4, 300, &mut r);
        let acc = tok.cutoff_accuracy(&tokens, 4);
        assert!((acc[3] - 1.0).abs() < 1e-6, "accuracy per cutoff {:?}", acc);
    }

    #[test]
    fn ema_keeps_codebook_finite() {
        let mut r = Rng::new(5);
        let mut tok = Tokenizer::new(tiny_config(), &mut r);
        let tokens = tiny_tokens(8, &mut r);
        train(&mut tok, &tokens, 8, 200, &mut r);
        for e in &tok.quant.emb {
            assert!(e.iter().all(|v| v.is_finite()));
        }
        let codes = tok.encode(&tokens, 8);
        let last = tok.quant.level_codes(&codes, 8, 3);
        let mut seen = [false; 5];
        last.iter().for_each(|&c| seen[c as usize] = true);
        assert!(seen.iter().filter(|s| **s).count() >= 3, "finest level uses {:?}", seen);
    }
}
