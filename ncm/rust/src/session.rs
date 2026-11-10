//! One training session: configuration, corpus, both models, optimisers and
//! the rules that keep the two stages consistent.

use crate::data::{Charset, Corpus, DataError};
use crate::generator::{GenConfig, GenStats, Generator, LevelOneDist};
use crate::param::{clip_grad_norm, lr_at, AdamW, Params};
use crate::quant::TokConfig;
use crate::rng::Rng;
use crate::tokenizer::{TokStats, Tokenizer};
use crate::F;

#[derive(Clone, Debug, PartialEq)]
pub struct Config {
    pub seed: u32,
    pub d: usize,
    pub codes: usize,
    pub dec_blocks: usize,
    pub dec_heads: usize,
    pub gen_blocks: usize,
    pub gen_width: usize,
    pub gen_heads: usize,
    pub levels: Vec<usize>,
}

impl Default for Config {
    fn default() -> Config {
        Config {
            seed: 1,
            d: 64,
            codes: 16,
            dec_blocks: 1,
            dec_heads: 4,
            gen_blocks: 4,
            gen_width: 128,
            gen_heads: 4,
            // The reference TinyStories schedule (1, 8, 16, ... 128) at half length.
            levels: vec![1, 4, 8, 12, 16, 20, 26, 32, 38, 46, 54, 64],
        }
    }
}

impl Config {
    pub fn l(&self) -> usize {
        *self.levels.last().unwrap()
    }
    /// Checks the shape constraints the models assert on.
    pub fn valid(&self) -> bool {
        let ok_heads = |w: usize, h: usize| h > 0 && w % h == 0 && (w / h) % 2 == 0;
        self.levels.len() >= 2
            && self.levels.windows(2).all(|w| w[0] < w[1])
            && self.levels[0] >= 1
            && self.l() % self.levels[0] == 0
            && self.d % 8 == 0
            && self.codes >= 2
            && self.dec_blocks >= 1
            && self.gen_blocks >= 1
            && ok_heads(self.d, self.dec_heads)
            && ok_heads(self.gen_width, self.gen_heads)
    }
    pub fn tok(&self, vocab: usize) -> TokConfig {
        TokConfig {
            vocab,
            l: self.l(),
            d: self.d,
            levels: self.levels.clone(),
            codes: self.codes,
            dec_blocks: self.dec_blocks,
            dec_heads: self.dec_heads,
            groups: 8,
        }
    }
    pub fn gen(&self) -> GenConfig {
        GenConfig { width: self.gen_width, blocks: self.gen_blocks, heads: self.gen_heads, rope_base: 10000.0 }
    }
}

#[derive(Clone, Debug)]
pub struct Hparams {
    pub lr_tok: F,
    pub lr_gen: F,
    pub batch: usize,
    pub fine_drop: F,
    pub alpha: F,
    pub corrupt_mean: F,
    pub corrupt_delta: F,
    pub warmup: u32,
    pub total_steps: u32,
}

impl Default for Hparams {
    fn default() -> Hparams {
        Hparams {
            lr_tok: 2e-3,
            lr_gen: 1e-3,
            batch: 32,
            fine_drop: 0.5,
            alpha: 0.0,
            corrupt_mean: 0.15,
            corrupt_delta: 0.1,
            warmup: 100,
            total_steps: 20_000,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Stage {
    Tokenizer,
    Generator,
}

#[derive(Debug, PartialEq)]
pub enum TrainError {
    NoCorpus,
    NoTokenizer,
    Diverged,
}

/// Averages over the steps of one `train` call.
#[derive(Clone, Debug, Default)]
pub struct TrainStats {
    pub steps: u32,
    pub tok: TokStats,
    pub gen: GenStats,
    /// Set when this call's tokenizer steps threw away a trained generator.
    pub generator_reset: bool,
}

#[derive(Clone, Debug, Default)]
pub struct TokEval {
    /// Held-out character accuracy when decoding from the first k levels.
    pub acc_per_cutoff: Vec<F>,
    /// Fraction of each level's codebook used on the held-out windows.
    pub util_per_level: Vec<F>,
}

#[derive(Clone, Debug, Default)]
pub struct GenEval {
    pub stats: GenStats,
    /// Cross-entropy of held-out codes under training code frequencies.
    pub unigram_per_level: Vec<F>,
}

/// Loss values above this count as divergence (healthy values are below 10).
const DIVERGED_ABOVE: F = 1e3;
const L1_WINDOWS: usize = 2000;

pub struct Session {
    pub cfg: Config,
    pub hp: Hparams,
    pub charset: Charset,
    pub corpus: Option<Corpus>,
    pub tok: Tokenizer,
    pub gen: Generator,
    opt_tok: AdamW,
    opt_gen: AdamW,
    pub l1: LevelOneDist,
    /// Training code frequencies for every level, [level][code].
    pub unigram: Vec<Vec<F>>,
    pub rng: Rng,
    pub tok_steps: u32,
    pub gen_steps: u32,
    /// Steps taken in this session per stage. The learning-rate schedule
    /// runs on these, so a loaded checkpoint warms up and decays afresh
    /// instead of continuing at the floor its saved step count implies.
    tok_sched: u32,
    gen_sched: u32,
    /// The code statistics (`l1`, `unigram`) match the current tokenizer.
    pub stats_fresh: bool,
    pub diverged: bool,
    /// Native threads for generator training (always 1 on wasm).
    pub threads: usize,
    verified: Option<Vec<Vec<F>>>,
}

impl Session {
    pub fn new(cfg: Config, charset: Charset) -> Session {
        assert!(cfg.valid(), "invalid model shape");
        let mut rng = Rng::new(cfg.seed as u64);
        let tok = Tokenizer::new(cfg.tok(charset.vocab()), &mut rng);
        let gen = Generator::new(cfg.gen(), &tok, &mut rng);
        let k = cfg.levels.len();
        let codes = cfg.codes;
        Session {
            hp: Hparams::default(),
            charset,
            corpus: None,
            tok,
            gen,
            opt_tok: AdamW::new(0.01),
            opt_gen: AdamW::new(0.01),
            l1: LevelOneDist::from_codes(&[], codes),
            unigram: vec![vec![1.0 / codes as F; codes]; k],
            rng,
            tok_steps: 0,
            gen_steps: 0,
            tok_sched: 0,
            gen_sched: 0,
            stats_fresh: false,
            diverged: false,
            threads: 1,
            verified: None,
            cfg,
        }
    }

    pub fn set_corpus(&mut self, text: &str) -> Result<(), DataError> {
        let corpus = Corpus::new(self.charset.encode(text), self.cfg.l(), 0.05)?;
        self.corpus = Some(corpus);
        self.stats_fresh = false;
        Ok(())
    }

    pub fn set_hparams(&mut self, hp: Hparams) {
        self.hp = hp;
        self.diverged = false;
    }

    /// Replaces the generator with a fresh, untrained one.
    pub fn reset_generator(&mut self) {
        self.gen = Generator::new(self.cfg.gen(), &self.tok, &mut self.rng);
        self.opt_gen = AdamW::new(0.01);
        self.gen_steps = 0;
        self.gen_sched = 0;
    }

    /// The learning rate the next step of `stage` will use.
    pub fn current_lr(&self, stage: Stage) -> F {
        let (step, peak) = match stage {
            Stage::Tokenizer => (self.tok_sched, self.hp.lr_tok),
            Stage::Generator => (self.gen_sched, self.hp.lr_gen),
        };
        lr_at(step, self.hp.warmup, self.hp.total_steps, peak, 0.1)
    }

    /// Everything a divergence must be able to roll back.
    fn snapshot(&mut self) -> Vec<Vec<F>> {
        let mut out = Vec::new();
        self.tok.visit(&mut |p| out.push(p.w.clone()));
        for s in self.tok.quant.state() {
            out.push(s.clone());
        }
        self.gen.visit(&mut |p| out.push(p.w.clone()));
        out
    }

    fn restore(&mut self, snap: &[Vec<F>]) {
        let mut i = 0;
        self.tok.visit(&mut |p| {
            p.w.copy_from_slice(&snap[i]);
            i += 1;
        });
        for s in self.tok.quant.state_mut() {
            s.copy_from_slice(&snap[i]);
            i += 1;
        }
        self.gen.visit(&mut |p| {
            p.w.copy_from_slice(&snap[i]);
            i += 1;
        });
        self.gen.bind(&self.tok);
        self.opt_tok.reset(&mut self.tok);
        self.opt_gen.reset(&mut self.gen);
    }

    /// Code frequencies of the training data under the current tokenizer.
    pub fn refresh_code_stats(&mut self) {
        let corpus = match &self.corpus {
            Some(c) => c,
            None => return,
        };
        let (k, codes) = (self.cfg.levels.len(), self.cfg.codes);
        let mut hist = vec![vec![0.5 as F; codes]; k];
        let mut level1 = Vec::new();
        let mut rng = Rng::new(self.cfg.seed as u64 ^ 0x5EED);
        let batch = 100;
        for _ in 0..L1_WINDOWS / batch {
            let tokens = corpus.sample_batch(&mut rng, batch);
            let c = self.tok.encode(&tokens, batch);
            for lv in 0..k {
                for &code in &self.tok.quant.level_codes(&c, batch, lv) {
                    hist[lv][code as usize] += 1.0;
                }
            }
            level1.extend(self.tok.quant.level_codes(&c, batch, 0));
        }
        for h in hist.iter_mut() {
            let s: F = h.iter().sum();
            h.iter_mut().for_each(|v| *v /= s);
        }
        self.unigram = hist;
        self.l1 = LevelOneDist::from_codes(&level1, codes);
        self.stats_fresh = true;
    }

    pub fn tokenizer_ready(&self) -> bool {
        self.tok_steps > 0
    }

    /// Runs `steps` optimiser steps of one stage.
    pub fn train(&mut self, stage: Stage, steps: u32) -> Result<TrainStats, TrainError> {
        if self.corpus.is_none() {
            return Err(TrainError::NoCorpus);
        }
        if self.diverged {
            return Err(TrainError::Diverged);
        }
        if stage == Stage::Generator && !self.tokenizer_ready() {
            return Err(TrainError::NoTokenizer);
        }
        let mut out = TrainStats::default();
        if stage == Stage::Tokenizer && self.gen_steps > 0 {
            self.reset_generator();
            out.generator_reset = true;
        }
        if stage == Stage::Generator && !self.stats_fresh {
            self.refresh_code_stats();
        }
        let pending = self.snapshot();
        let n = self.hp.batch;
        let (mut tok_acc, mut gen_acc) = (TokStats::default(), GenStats::default());
        for step in 0..steps {
            let tokens = self.corpus.as_ref().unwrap().sample_batch(&mut self.rng, n);
            let loss = match stage {
                Stage::Tokenizer => {
                    let s = self.tok.train_step(&tokens, n, &mut self.rng, self.hp.fine_drop);
                    tok_acc.loss += s.loss;
                    tok_acc.recon_loss += s.recon_loss;
                    tok_acc.vq_loss += s.vq_loss;
                    tok_acc.acc += s.acc;
                    s.loss
                }
                Stage::Generator => {
                    let codes = self.tok.encode(&tokens, n);
                    let s = self.gen.train_step(
                        &self.tok,
                        &codes,
                        n,
                        &mut self.rng,
                        self.hp.alpha,
                        self.hp.corrupt_mean,
                        self.hp.corrupt_delta,
                        self.threads,
                    );
                    if gen_acc.per_level_loss.is_empty() {
                        gen_acc.per_level_loss = vec![0.0 as F; s.per_level_loss.len()];
                        gen_acc.per_level_acc = vec![0.0 as F; s.per_level_acc.len()];
                    }
                    gen_acc.loss += s.loss;
                    for (a, b) in gen_acc.per_level_loss.iter_mut().zip(&s.per_level_loss) {
                        *a += b;
                    }
                    for (a, b) in gen_acc.per_level_acc.iter_mut().zip(&s.per_level_acc) {
                        *a += b;
                    }
                    s.loss
                }
            };
            if !loss.is_finite() || loss > DIVERGED_ABOVE {
                // The weights at the start of this call are only known good
                // once a loss has been computed from them.
                let good = if step == 0 { self.verified.take().unwrap_or(pending) } else { pending };
                self.restore(&good);
                self.verified = Some(good);
                self.diverged = true;
                return Err(TrainError::Diverged);
            }
            match stage {
                Stage::Tokenizer => {
                    clip_grad_norm(&mut self.tok, 1.0);
                    let lr = self.current_lr(stage);
                    self.opt_tok.step(&mut self.tok, lr);
                    self.tok_steps += 1;
                    self.tok_sched += 1;
                    self.stats_fresh = false;
                }
                Stage::Generator => {
                    clip_grad_norm(&mut self.gen, 1.0);
                    let lr = self.current_lr(stage);
                    self.opt_gen.step(&mut self.gen, lr);
                    self.gen_steps += 1;
                    self.gen_sched += 1;
                }
            }
            out.steps += 1;
        }
        if steps > 0 {
            self.verified = Some(pending);
        }
        if stage == Stage::Tokenizer {
            self.gen.bind(&self.tok);
        }
        let inv = 1.0 / out.steps.max(1) as F;
        tok_acc.loss *= inv;
        tok_acc.recon_loss *= inv;
        tok_acc.vq_loss *= inv;
        tok_acc.acc *= inv;
        gen_acc.loss *= inv;
        gen_acc.per_level_loss.iter_mut().for_each(|v| *v *= inv);
        gen_acc.per_level_acc.iter_mut().for_each(|v| *v *= inv);
        out.tok = tok_acc;
        out.gen = gen_acc;
        Ok(out)
    }

    /// Held-out tokenizer numbers over `batches` batches of `n` windows.
    pub fn eval_tokenizer(&self, batches: usize, n: usize) -> Option<TokEval> {
        let corpus = self.corpus.as_ref()?;
        let (k, codes) = (self.cfg.levels.len(), self.cfg.codes);
        let mut acc = vec![0.0 as F; k];
        let mut used = vec![vec![false; codes]; k];
        for b in 0..batches {
            let tokens = corpus.heldout_batch(b, n);
            for (a, v) in acc.iter_mut().zip(self.tok.cutoff_accuracy(&tokens, n)) {
                *a += v / batches as F;
            }
            let c = self.tok.encode(&tokens, n);
            for lv in 0..k {
                for &code in &self.tok.quant.level_codes(&c, n, lv) {
                    used[lv][code as usize] = true;
                }
            }
        }
        Some(TokEval {
            acc_per_cutoff: acc,
            util_per_level: used.iter().map(|u| u.iter().filter(|x| **x).count() as F / codes as F).collect(),
        })
    }

    /// Held-out generator numbers over `batches` batches of `n` windows.
    pub fn eval_generator(&mut self, batches: usize, n: usize) -> Option<GenEval> {
        if !self.stats_fresh {
            self.refresh_code_stats();
        }
        let corpus = self.corpus.as_ref()?;
        let k = self.cfg.levels.len();
        let mut stats = GenStats { loss: 0.0, per_level_loss: vec![0.0; k - 1], per_level_acc: vec![0.0; k - 1] };
        let mut uni = vec![0.0 as F; k - 1];
        for b in 0..batches {
            let tokens = corpus.heldout_batch(b, n);
            let c = self.tok.encode(&tokens, n);
            let s = self.gen.eval(&self.tok, &c, n, self.hp.alpha);
            stats.loss += s.loss / batches as F;
            for lv in 0..k - 1 {
                stats.per_level_loss[lv] += s.per_level_loss[lv] / batches as F;
                stats.per_level_acc[lv] += s.per_level_acc[lv] / batches as F;
                let lc = self.tok.quant.level_codes(&c, n, lv + 1);
                let ce: F = lc.iter().map(|&code| -self.unigram[lv + 1][code as usize].ln()).sum::<F>() / lc.len() as F;
                uni[lv] += ce / batches as F;
            }
        }
        Some(GenEval { stats, unigram_per_level: uni })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::checkpoint::tests::tiny_session;

    #[test]
    fn generator_needs_a_tokenizer() {
        let mut s = tiny_session();
        assert_eq!(s.train(Stage::Generator, 1).err(), Some(TrainError::NoTokenizer));
        s.train(Stage::Tokenizer, 1).unwrap();
        assert!(s.train(Stage::Generator, 1).is_ok());
    }

    #[test]
    fn schedule_restarts_for_a_loaded_checkpoint() {
        // total_steps is 50 in the tiny session; train past it so the
        // persisted counter sits on the schedule's floor.
        let mut s = tiny_session();
        s.train(Stage::Tokenizer, 60).unwrap();
        assert!((s.current_lr(Stage::Tokenizer) - 0.1 * s.hp.lr_tok).abs() < 1e-9);
        let mut t = crate::checkpoint::load(&crate::checkpoint::save(&mut s)).unwrap();
        t.set_hparams(s.hp.clone());
        assert_eq!(t.tok_steps, 60);
        // A loaded model starts its own schedule: warmup from zero, then the peak.
        assert_eq!(t.current_lr(Stage::Tokenizer), 0.0);
        t.set_corpus(&"the cat sat on a mat\n".repeat(400)).unwrap();
        t.train(Stage::Tokenizer, 2).unwrap();
        assert!((t.current_lr(Stage::Tokenizer) - t.hp.lr_tok).abs() < 1e-9);
        assert_eq!(t.tok_steps, 62);
    }

    #[test]
    fn no_corpus_is_refused() {
        let mut s = tiny_session();
        s.corpus = None;
        assert_eq!(s.train(Stage::Tokenizer, 1).err(), Some(TrainError::NoCorpus));
    }

    #[test]
    fn tokenizer_step_resets_trained_generator() {
        let mut s = tiny_session();
        s.train(Stage::Tokenizer, 2).unwrap();
        let st = s.train(Stage::Generator, 3).unwrap();
        assert!(!st.generator_reset);
        assert_eq!(s.gen_steps, 3);
        let st = s.train(Stage::Tokenizer, 1).unwrap();
        assert!(st.generator_reset);
        assert_eq!(s.gen_steps, 0);
        assert!(!s.stats_fresh);
        // Without generator steps there is nothing to reset.
        assert!(!s.train(Stage::Tokenizer, 1).unwrap().generator_reset);
    }

    #[test]
    fn divergence_is_reported_and_rolled_back() {
        for chunk in [1u32, 5] {
            let mut s = tiny_session();
            s.train(Stage::Tokenizer, 3).unwrap();
            s.set_hparams(Hparams { lr_tok: 1e6, warmup: 0, batch: 4, ..Hparams::default() });
            let mut result = Ok(TrainStats::default());
            for _ in 0..20 {
                result = s.train(Stage::Tokenizer, chunk);
                if result.is_err() {
                    break;
                }
            }
            assert_eq!(result.err(), Some(TrainError::Diverged), "chunk {}", chunk);
            assert!(s.diverged);
            assert_eq!(s.train(Stage::Tokenizer, 1).err(), Some(TrainError::Diverged));
            let mut finite = true;
            s.tok.visit(&mut |p| finite &= p.w.iter().all(|w| w.is_finite() && w.abs() < 1e3));
            assert!(finite, "weights must be rolled back to a healthy state");
            let ev = s.eval_tokenizer(1, 4).unwrap();
            assert!(ev.acc_per_cutoff.iter().all(|a| a.is_finite()));
            // A sane learning rate clears the flag and training continues.
            s.set_hparams(Hparams { batch: 4, ..Hparams::default() });
            assert!(s.train(Stage::Tokenizer, 2).is_ok());
        }
    }
}
