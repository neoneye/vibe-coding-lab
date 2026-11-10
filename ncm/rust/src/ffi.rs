//! C-ABI exports for the wasm build. One global session.
//!
//! Calls return a status code; results are left in an output buffer read
//! through `ncm_out_ptr` / `ncm_out_len`. Unless noted the buffer holds
//! little-endian f32 (statistics) or u32 (codes, characters as Unicode
//! scalar values, configuration).
//!
//! Output layouts (K = number of levels, L = window length):
//!   ncm_info / ncm_init / ncm_import  u32: seed, d, codes, dec_blocks, dec_heads,
//!       gen_blocks, gen_width, gen_heads, K, l_1..l_K, tok_steps, gen_steps,
//!       tok_params, codebook_floats, gen_params, vocab, diverged
//!   ncm_train   f32: steps, tok_steps, gen_steps, generator_stale,
//!       tok loss, tok recon loss, tok vq loss, tok accuracy,
//!       gen loss, (K-1) per-level loss, (K-1) per-level accuracy
//!   ncm_eval(0) f32: K accuracy per cutoff, K codebook utilisation
//!   ncm_eval(1) f32: loss, (K-1) loss, (K-1) accuracy, (K-1) unigram baseline
//!   ncm_encode  u32: sum(levels) codes, K*L reconstructed characters,
//!       L input characters as tokenised
//!   ncm_generate u32: per window: sum(levels) codes, K*L characters
//!   ncm_complete u32: the requested number of continuation characters
//!   ncm_usage   u32: K*codes histogram of codes over held-out windows
//!   ncm_heldout u32: L characters
//!   ncm_export  bytes of a checkpoint

use crate::checkpoint::{self, config_from_words, config_words};
use crate::data::Charset;
use crate::ops;
use crate::param::count;
use crate::rng::Rng;
use crate::session::{Hparams, Session, Stage, TrainError};
use crate::F;
use std::cell::RefCell;

#[derive(Default)]
struct State {
    session: Option<Session>,
    charset: String,
    corpus: String,
    hp: Option<Hparams>,
    out: Vec<u8>,
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default());
}

fn with<R>(f: impl FnOnce(&mut State) -> R) -> R {
    STATE.with(|s| f(&mut s.borrow_mut()))
}

fn put_f32(out: &mut Vec<u8>, v: F) {
    out.extend_from_slice(&(v as f32).to_le_bytes());
}
fn put_u32(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes());
}

unsafe fn bytes<'a>(ptr: *const u8, len: u32) -> &'a [u8] {
    if len == 0 {
        &[]
    } else {
        std::slice::from_raw_parts(ptr, len as usize)
    }
}

fn info(st: &mut State) {
    let mut out = Vec::new();
    if let Some(s) = st.session.as_mut() {
        for w in config_words(&s.cfg) {
            put_u32(&mut out, w);
        }
        put_u32(&mut out, s.tok_steps);
        put_u32(&mut out, s.gen_steps);
        put_u32(&mut out, count(&mut s.tok) as u32);
        put_u32(&mut out, (s.cfg.codes * s.cfg.d * s.cfg.levels.len()) as u32);
        put_u32(&mut out, count(&mut s.gen) as u32);
        put_u32(&mut out, s.charset.vocab() as u32);
        put_u32(&mut out, s.diverged as u32);
    }
    st.out = out;
}

/// Re-applies the stored corpus text and hyperparameters to a new session.
fn adopt(st: &mut State, mut s: Session) {
    if !st.corpus.is_empty() {
        let _ = s.set_corpus(&st.corpus);
    }
    if let Some(hp) = &st.hp {
        s.set_hparams(hp.clone());
    }
    st.session = Some(s);
}

#[no_mangle]
pub extern "C" fn ncm_alloc(len: u32) -> *mut u8 {
    let mut v = Vec::<u8>::with_capacity(len.max(1) as usize);
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

/// # Safety
/// `ptr` and `len` must come from `ncm_alloc(len)`.
#[no_mangle]
pub unsafe extern "C" fn ncm_free(ptr: *mut u8, len: u32) {
    drop(Vec::from_raw_parts(ptr, 0, len.max(1) as usize));
}

#[no_mangle]
pub extern "C" fn ncm_out_ptr() -> *const u8 {
    with(|st| st.out.as_ptr())
}

#[no_mangle]
pub extern "C" fn ncm_out_len() -> u32 {
    with(|st| st.out.len() as u32)
}

/// The characters the model knows (UTF-8). Takes effect at the next `ncm_init`.
/// # Safety
/// `ptr` must point to `len` readable bytes.
#[no_mangle]
pub unsafe extern "C" fn ncm_set_charset(ptr: *const u8, len: u32) -> u32 {
    match std::str::from_utf8(bytes(ptr, len)) {
        Ok(text) => {
            with(|st| st.charset = text.to_string());
            0
        }
        Err(_) => 1,
    }
}

/// Creates a fresh, untrained model. `cfg` is the u32 layout of `ncm_info`
/// up to and including the level lengths. Returns 1 for an invalid shape.
/// # Safety
/// `cfg` must point to `n` readable u32.
#[no_mangle]
pub unsafe extern "C" fn ncm_init(cfg: *const u32, n: u32) -> u32 {
    let words = std::slice::from_raw_parts(cfg, n as usize);
    let cfg = match config_from_words(words) {
        Some(c) => c,
        None => return 1,
    };
    with(|st| {
        let s = Session::new(cfg, Charset::from_text(&st.charset));
        adopt(st, s);
        info(st);
    });
    0
}

#[no_mangle]
pub extern "C" fn ncm_info() -> u32 {
    with(|st| {
        info(st);
        st.session.is_none() as u32
    })
}

/// Training text (UTF-8). Returns 1 when it is too short (the previous
/// corpus stays), 2 when there is no model or the bytes are not UTF-8.
/// # Safety
/// `ptr` must point to `len` readable bytes.
#[no_mangle]
pub unsafe extern "C" fn ncm_set_corpus(ptr: *const u8, len: u32) -> u32 {
    let text = match std::str::from_utf8(bytes(ptr, len)) {
        Ok(t) => t,
        Err(_) => return 2,
    };
    with(|st| match st.session.as_mut() {
        None => 2,
        Some(s) => match s.set_corpus(text) {
            Ok(()) => {
                st.corpus = text.to_string();
                0
            }
            Err(_) => 1,
        },
    })
}

/// f32 values: lr_tok, lr_gen, batch, fine_drop, alpha, corrupt_mean,
/// corrupt_delta, warmup, total_steps.
/// # Safety
/// `ptr` must point to `n` readable f32.
#[no_mangle]
pub unsafe extern "C" fn ncm_set_hparams(ptr: *const f32, n: u32) -> u32 {
    if n < 9 {
        return 1;
    }
    let v = std::slice::from_raw_parts(ptr, n as usize);
    if v.iter().any(|x| !x.is_finite()) {
        return 1;
    }
    let hp = Hparams {
        lr_tok: v[0].max(0.0) as F,
        lr_gen: v[1].max(0.0) as F,
        batch: (v[2] as usize).clamp(1, 512),
        fine_drop: v[3].clamp(0.0, 1.0) as F,
        alpha: v[4].clamp(0.0, 4.0) as F,
        corrupt_mean: v[5].clamp(0.0, 0.95) as F,
        corrupt_delta: v[6].clamp(0.0, 0.95) as F,
        warmup: v[7].max(0.0) as u32,
        total_steps: v[8].max(1.0) as u32,
    };
    with(|st| {
        if let Some(s) = st.session.as_mut() {
            s.set_hparams(hp.clone());
        }
        st.hp = Some(hp);
    });
    0
}

/// Trains `steps` steps of stage 0 (tokenizer) or 1 (generator).
/// Returns 0 ok, 1 no tokenizer yet, 2 diverged, 3 no model or corpus.
#[no_mangle]
pub extern "C" fn ncm_train(stage: u32, steps: u32) -> u32 {
    with(|st| {
        let s = match st.session.as_mut() {
            Some(s) => s,
            None => return 3,
        };
        let stage = if stage == 0 { Stage::Tokenizer } else { Stage::Generator };
        match s.train(stage, steps) {
            Ok(r) => {
                let mut out = Vec::new();
                let k = s.cfg.levels.len();
                for v in [r.steps as F, s.tok_steps as F, s.gen_steps as F, r.generator_stale as u32 as F] {
                    put_f32(&mut out, v);
                }
                for v in [r.tok.loss, r.tok.recon_loss, r.tok.vq_loss, r.tok.acc, r.gen.loss] {
                    put_f32(&mut out, v);
                }
                for i in 0..k - 1 {
                    put_f32(&mut out, r.gen.per_level_loss.get(i).copied().unwrap_or(0.0));
                }
                for i in 0..k - 1 {
                    put_f32(&mut out, r.gen.per_level_acc.get(i).copied().unwrap_or(0.0));
                }
                st.out = out;
                0
            }
            Err(TrainError::NoTokenizer) => 1,
            Err(TrainError::Diverged) => 2,
            Err(TrainError::NoCorpus) => 3,
        }
    })
}

/// Held-out numbers for stage 0 or 1 over `batches` batches of 32 windows.
/// Returns 0 ok, 1 no tokenizer yet (stage 1), 3 no model or corpus.
#[no_mangle]
pub extern "C" fn ncm_eval(stage: u32, batches: u32) -> u32 {
    with(|st| {
        let s = match st.session.as_mut() {
            Some(s) if s.corpus.is_some() => s,
            _ => return 3,
        };
        let batches = batches.clamp(1, 64) as usize;
        let mut out = Vec::new();
        if stage == 0 {
            let ev = s.eval_tokenizer(batches, 32).unwrap();
            for v in ev.acc_per_cutoff.iter().chain(&ev.util_per_level) {
                put_f32(&mut out, *v);
            }
        } else {
            if !s.tokenizer_ready() {
                return 1;
            }
            let ev = s.eval_generator(batches, 32).unwrap();
            put_f32(&mut out, ev.stats.loss);
            for v in ev.stats.per_level_loss.iter().chain(&ev.stats.per_level_acc).chain(&ev.unigram_per_level) {
                put_f32(&mut out, *v);
            }
        }
        st.out = out;
        0
    })
}

fn put_text(out: &mut Vec<u8>, cs: &Charset, ids: &[u32]) {
    for c in cs.decode(ids).chars() {
        put_u32(out, c as u32);
    }
}

/// Encodes one window of text (UTF-8, padded with spaces or cut to L
/// characters). Returns 3 without a model.
/// # Safety
/// `ptr` must point to `len` readable bytes.
#[no_mangle]
pub unsafe extern "C" fn ncm_encode(ptr: *const u8, len: u32) -> u32 {
    let text = String::from_utf8_lossy(bytes(ptr, len)).into_owned();
    with(|st| {
        let s = match st.session.as_ref() {
            Some(s) => s,
            None => return 3,
        };
        let l = s.cfg.l();
        let mut chars: Vec<char> = text.chars().take(l).collect();
        chars.resize(l, ' ');
        let tokens = s.charset.encode(&chars.iter().collect::<String>());
        let codes = s.tok.encode(&tokens, 1);
        let mut out = Vec::new();
        for &c in &codes {
            put_u32(&mut out, c);
        }
        for upto in 1..=s.cfg.levels.len() {
            put_text(&mut out, &s.charset, &s.tok.decode(&codes, 1, upto));
        }
        put_text(&mut out, &s.charset, &tokens);
        st.out = out;
        0
    })
}

/// Generates `n` windows. Returns 1 when no tokenizer has been trained,
/// 3 without a model.
#[no_mangle]
pub extern "C" fn ncm_generate(seed: u32, temperature: f32, top_k: u32, n: u32) -> u32 {
    with(|st| {
        let s = match st.session.as_ref() {
            Some(s) => s,
            None => return 3,
        };
        if !s.tokenizer_ready() {
            return 1;
        }
        let n = n.clamp(1, 64) as usize;
        let temperature = if temperature.is_finite() { temperature.clamp(0.0, 10.0) } else { 1.0 };
        let mut rng = Rng::new(seed as u64 ^ 0x6E63_6D00);
        let g = s.gen.generate(&s.tok, &s.l1, n, &mut rng, temperature as F, top_k as usize, None);
        let (k, l) = (s.cfg.levels.len(), s.cfg.l());
        let total = g.codes.len() / n;
        let mut out = Vec::new();
        for i in 0..n {
            for &c in &g.codes[i * total..(i + 1) * total] {
                put_u32(&mut out, c);
            }
            put_text(&mut out, &s.charset, &g.texts[i * k * l..(i + 1) * k * l]);
        }
        st.out = out;
        0
    })
}

/// Continues a prompt (UTF-8) by `n_chars` characters. Returns 1 when no
/// tokenizer has been trained, 3 without a model.
/// # Safety
/// `ptr` must point to `len` readable bytes.
#[no_mangle]
pub unsafe extern "C" fn ncm_complete(seed: u32, temperature: f32, top_k: u32, ptr: *const u8, len: u32, n_chars: u32) -> u32 {
    let text = String::from_utf8_lossy(bytes(ptr, len)).into_owned();
    with(|st| {
        let s = match st.session.as_ref() {
            Some(s) => s,
            None => return 3,
        };
        if !s.tokenizer_ready() {
            return 1;
        }
        let temperature = if temperature.is_finite() { temperature.clamp(0.0, 10.0) } else { 1.0 };
        let mut rng = Rng::new(seed as u64 ^ 0x6E63_6D01);
        let prompt = s.charset.encode(&text);
        let n_chars = n_chars.clamp(1, 4096) as usize;
        let ids = s.gen.complete(&s.tok, &s.l1, &prompt, n_chars, &mut rng, temperature as F, top_k as usize);
        let mut out = Vec::new();
        put_text(&mut out, &s.charset, &ids);
        st.out = out;
        0
    })
}

/// Histogram of codes per level over `windows` held-out windows.
#[no_mangle]
pub extern "C" fn ncm_usage(windows: u32) -> u32 {
    with(|st| {
        let s = match st.session.as_ref() {
            Some(s) if s.corpus.is_some() => s,
            _ => return 3,
        };
        let corpus = s.corpus.as_ref().unwrap();
        let (k, codes) = (s.cfg.levels.len(), s.cfg.codes);
        let mut hist = vec![0u32; k * codes];
        let n = 32;
        for b in 0..(windows.clamp(32, 2048) as usize / n) {
            let c = s.tok.encode(&corpus.heldout_batch(b, n), n);
            for lv in 0..k {
                for &code in &s.tok.quant.level_codes(&c, n, lv) {
                    hist[lv * codes + code as usize] += 1;
                }
            }
        }
        st.out = hist.iter().flat_map(|v| v.to_le_bytes()).collect();
        0
    })
}

/// Held-out window `i` as characters.
#[no_mangle]
pub extern "C" fn ncm_heldout(i: u32) -> u32 {
    with(|st| {
        let s = match st.session.as_ref() {
            Some(s) if s.corpus.is_some() => s,
            _ => return 3,
        };
        let tokens = s.corpus.as_ref().unwrap().heldout_batch(i as usize, 1);
        let mut out = Vec::new();
        put_text(&mut out, &s.charset, &tokens);
        st.out = out;
        0
    })
}

#[no_mangle]
pub extern "C" fn ncm_export() -> u32 {
    with(|st| match st.session.as_mut() {
        Some(s) => {
            st.out = checkpoint::save(s);
            0
        }
        None => 3,
    })
}

/// Replaces the model with a checkpoint. Returns 0 ok, 1 not a checkpoint,
/// 2 unknown version, 3 truncated, 4 inconsistent shapes. On failure the
/// current model is left as it was.
/// # Safety
/// `ptr` must point to `len` readable bytes.
#[no_mangle]
pub unsafe extern "C" fn ncm_import(ptr: *const u8, len: u32) -> u32 {
    match checkpoint::load(bytes(ptr, len)) {
        Ok(s) => {
            with(|st| {
                st.charset = s.charset.chars.iter().collect();
                adopt(st, s);
                info(st);
            });
            0
        }
        Err(e) => e as u32,
    }
}

/// Quick fixed-value checks. Returns 0 when all pass.
#[no_mangle]
pub extern "C" fn ncm_selftest() -> u32 {
    let x: [F; 6] = [1., 2., 3., 4., 5., 6.];
    let p = ops::area_pool_fwd(&x, 1, 6, 4, 1);
    if p.iter().zip([1.5, 2.5, 4.5, 5.5]).any(|(a, b)| (a - b as F).abs() > 1e-5) {
        return 1;
    }
    let u = ops::lerp_up_fwd(&[0., 1.], 1, 2, 4, 1);
    if u.iter().zip([0., 0.25, 0.75, 1.]).any(|(a, b)| (a - b as F).abs() > 1e-5) {
        return 2;
    }
    let (loss, _) = ops::softmax_xent(&[0., 0., 0., 0.], &[2], &[1.0], 4);
    if (loss - (4.0 as F).ln()).abs() > 1e-5 {
        return 3;
    }
    0
}
