//! Versioned binary checkpoint: configuration, character table, both
//! models' weights, codebooks and code statistics. Little-endian.
//!
//! Layout: "NCM1", version u32, config (see `write_config`), character
//! table (u32 byte length + UTF-8), tok_steps u32, gen_steps u32,
//! stats_fresh u32, then length-prefixed f32 tensors: tokenizer parameters
//! in visit order, codebooks, EMA counts, generator parameters, the level-1
//! code distribution and the per-level code frequencies. Optimiser moments
//! are not saved.

use crate::data::Charset;
use crate::param::Params;
use crate::session::{Config, Session};
use crate::F;

pub const MAGIC: &[u8; 4] = b"NCM1";
pub const VERSION: u32 = 1;

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum LoadError {
    BadMagic = 1,
    BadVersion = 2,
    Truncated = 3,
    ShapeMismatch = 4,
}

pub fn config_words(cfg: &Config) -> Vec<u32> {
    let mut w = vec![
        cfg.seed,
        cfg.d as u32,
        cfg.codes as u32,
        cfg.dec_blocks as u32,
        cfg.dec_heads as u32,
        cfg.gen_blocks as u32,
        cfg.gen_width as u32,
        cfg.gen_heads as u32,
        cfg.levels.len() as u32,
    ];
    w.extend(cfg.levels.iter().map(|&l| l as u32));
    w
}

/// Parses the word layout of `config_words`, rejecting shapes the models
/// cannot be built with (or that are implausibly large).
pub fn config_from_words(w: &[u32]) -> Option<Config> {
    if w.len() < 9 {
        return None;
    }
    let k = w[8] as usize;
    if k > 64 || w.len() != 9 + k {
        return None;
    }
    let cfg = Config {
        seed: w[0],
        d: w[1] as usize,
        codes: w[2] as usize,
        dec_blocks: w[3] as usize,
        dec_heads: w[4] as usize,
        gen_blocks: w[5] as usize,
        gen_width: w[6] as usize,
        gen_heads: w[7] as usize,
        levels: w[9..].iter().map(|&l| l as usize).collect(),
    };
    let sane = cfg.d <= 1024
        && cfg.codes <= 65536
        && cfg.gen_width <= 2048
        && cfg.dec_blocks <= 32
        && cfg.gen_blocks <= 64
        && cfg.levels.iter().all(|&l| l <= 4096);
    if sane && cfg.valid() {
        Some(cfg)
    } else {
        None
    }
}

fn put_u32(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn put_tensor(out: &mut Vec<u8>, t: &[F]) {
    put_u32(out, t.len() as u32);
    for &v in t {
        out.extend_from_slice(&(v as f32).to_le_bytes());
    }
}

pub fn save(s: &mut Session) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(MAGIC);
    put_u32(&mut out, VERSION);
    for w in config_words(&s.cfg) {
        put_u32(&mut out, w);
    }
    let chars: String = s.charset.chars.iter().collect();
    put_u32(&mut out, chars.len() as u32);
    out.extend_from_slice(chars.as_bytes());
    put_u32(&mut out, s.tok_steps);
    put_u32(&mut out, s.gen_steps);
    put_u32(&mut out, s.stats_fresh as u32);
    s.tok.visit(&mut |p| put_tensor(&mut out, &p.w));
    for e in &s.tok.quant.emb {
        put_tensor(&mut out, e);
    }
    for c in &s.tok.quant.ema_cs {
        put_tensor(&mut out, c);
    }
    s.gen.visit(&mut |p| put_tensor(&mut out, &p.w));
    put_tensor(&mut out, &s.l1.probs);
    for u in &s.unigram {
        put_tensor(&mut out, u);
    }
    out
}

struct Reader<'a> {
    b: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], LoadError> {
        if self.b.len() - self.at < n {
            return Err(LoadError::Truncated);
        }
        let s = &self.b[self.at..self.at + n];
        self.at += n;
        Ok(s)
    }
    fn u32(&mut self) -> Result<u32, LoadError> {
        let s = self.take(4)?;
        Ok(u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
    }
    /// Reads a tensor that must have exactly `dst.len()` entries.
    fn tensor(&mut self, dst: &mut [F]) -> Result<(), LoadError> {
        let len = self.u32()? as usize;
        if len != dst.len() {
            // A wrong length with too little data left is a cut file.
            if self.b.len() - self.at < len.saturating_mul(4) {
                return Err(LoadError::Truncated);
            }
            return Err(LoadError::ShapeMismatch);
        }
        let raw = self.take(len * 4)?;
        for (d, c) in dst.iter_mut().zip(raw.chunks_exact(4)) {
            let v = f32::from_le_bytes([c[0], c[1], c[2], c[3]]);
            if !v.is_finite() {
                return Err(LoadError::ShapeMismatch);
            }
            *d = v as F;
        }
        Ok(())
    }
}

/// Builds a fresh session from checkpoint bytes. The caller sets the corpus
/// and hyperparameters afterwards.
pub fn load(bytes: &[u8]) -> Result<Session, LoadError> {
    let mut r = Reader { b: bytes, at: 0 };
    if r.take(4).map_err(|_| if bytes.is_empty() { LoadError::Truncated } else { LoadError::BadMagic })? != MAGIC {
        return Err(LoadError::BadMagic);
    }
    if r.u32()? != VERSION {
        return Err(LoadError::BadVersion);
    }
    let mut words = Vec::new();
    for _ in 0..9 {
        words.push(r.u32()?);
    }
    let k = words[8] as usize;
    if k > 64 {
        return Err(LoadError::ShapeMismatch);
    }
    for _ in 0..k {
        words.push(r.u32()?);
    }
    let cfg = config_from_words(&words).ok_or(LoadError::ShapeMismatch)?;
    let clen = r.u32()? as usize;
    let chars = std::str::from_utf8(r.take(clen)?).map_err(|_| LoadError::ShapeMismatch)?;
    let charset = Charset::from_text(chars);
    if charset.chars.len() > 4096 {
        return Err(LoadError::ShapeMismatch);
    }
    let tok_steps = r.u32()?;
    let gen_steps = r.u32()?;
    let stats_fresh = r.u32()? != 0;

    let mut s = Session::new(cfg, charset);
    let mut err = None;
    s.tok.visit(&mut |p| {
        if err.is_none() {
            err = r.tensor(&mut p.w).err();
        }
    });
    if let Some(e) = err {
        return Err(e);
    }
    for e in s.tok.quant.emb.iter_mut() {
        r.tensor(e)?;
    }
    for c in s.tok.quant.ema_cs.iter_mut() {
        r.tensor(c)?;
    }
    s.tok.quant.rebuild_ema_sums();
    let mut err = None;
    s.gen.visit(&mut |p| {
        if err.is_none() {
            err = r.tensor(&mut p.w).err();
        }
    });
    if let Some(e) = err {
        return Err(e);
    }
    r.tensor(&mut s.l1.probs)?;
    for u in s.unigram.iter_mut() {
        r.tensor(u)?;
    }
    if r.at != bytes.len() {
        return Err(LoadError::ShapeMismatch);
    }
    s.gen.bind(&s.tok);
    s.tok_steps = tok_steps;
    s.gen_steps = gen_steps;
    s.stats_fresh = stats_fresh;
    Ok(s)
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::rng::Rng;
    use crate::session::{Hparams, Stage};

    pub fn tiny_session() -> Session {
        let text: String = (0..3000).map(|i| ["the ", "cat ", "sat ", "on ", "a mat\n"][(i * 7 + i / 3) % 5]).collect();
        let cfg = Config {
            seed: 3,
            d: 16,
            codes: 12,
            dec_blocks: 1,
            dec_heads: 2,
            gen_blocks: 1,
            gen_width: 16,
            gen_heads: 2,
            levels: vec![1, 4, 16],
        };
        let mut s = Session::new(cfg, Charset::from_text(&text));
        s.set_corpus(&text).unwrap();
        s.set_hparams(Hparams { batch: 4, warmup: 2, total_steps: 50, ..Hparams::default() });
        s
    }

    fn sample(s: &Session) -> (Vec<u32>, Vec<u32>) {
        let tokens = s.corpus.as_ref().unwrap().heldout_batch(0, 2);
        let codes = s.tok.encode(&tokens, 2);
        let out = s.gen.generate(&s.tok, &s.l1, 2, &mut Rng::new(9), 1.0, 0, None);
        (codes, out.texts)
    }

    #[test]
    fn save_load_round_trip() {
        let mut s = tiny_session();
        s.train(Stage::Tokenizer, 5).unwrap();
        s.train(Stage::Generator, 5).unwrap();
        let bytes = save(&mut s);
        let mut t = load(&bytes).unwrap();
        assert_eq!(t.cfg, s.cfg);
        assert_eq!(t.charset, s.charset);
        assert_eq!((t.tok_steps, t.gen_steps), (5, 5));
        // Saving the loaded session gives the same bytes.
        assert!(save(&mut t) == bytes, "re-saved checkpoint differs");
        t.set_corpus(&"the cat sat on a mat\n".repeat(400)).unwrap();
        s.set_corpus(&"the cat sat on a mat\n".repeat(400)).unwrap();
        assert_eq!(sample(&s), sample(&t));
    }

    #[test]
    fn bad_files_are_refused() {
        let mut s = tiny_session();
        s.train(Stage::Tokenizer, 2).unwrap();
        let bytes = save(&mut s);
        assert_eq!(load(&[]).err(), Some(LoadError::Truncated));
        assert_eq!(load(&[7, 1, 2, 3, 4, 5, 6, 7, 8, 9]).err(), Some(LoadError::BadMagic));
        assert_eq!(load(b"hello world, this is a text file").err(), Some(LoadError::BadMagic));
        assert_eq!(load(&bytes[..bytes.len() / 2]).err(), Some(LoadError::Truncated));
        assert_eq!(load(&bytes[..bytes.len() - 1]).err(), Some(LoadError::Truncated));
        let mut v = bytes.clone();
        v[4] = 99;
        assert_eq!(load(&v).err(), Some(LoadError::BadVersion));
        // A different latent width in the header no longer matches the tensors.
        let mut v = bytes.clone();
        v[12..16].copy_from_slice(&32u32.to_le_bytes());
        assert_eq!(load(&v).err(), Some(LoadError::ShapeMismatch));
        // A shape the models cannot be built with.
        let mut v = bytes.clone();
        v[12..16].copy_from_slice(&7u32.to_le_bytes());
        assert_eq!(load(&v).err(), Some(LoadError::ShapeMismatch));
        let mut v = bytes.clone();
        v.push(0);
        assert_eq!(load(&v).err(), Some(LoadError::ShapeMismatch));
    }
}
