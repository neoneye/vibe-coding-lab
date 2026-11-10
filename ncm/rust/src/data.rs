//! Character table and training windows.

use crate::rng::Rng;

/// Maps characters to token ids. Id 0 is the fallback for characters that
/// are not in the table and decodes to '?'.
#[derive(Clone, Debug, PartialEq)]
pub struct Charset {
    pub chars: Vec<char>,
}

impl Charset {
    pub fn from_text(text: &str) -> Charset {
        let mut chars: Vec<char> = text.chars().collect();
        chars.sort_unstable();
        chars.dedup();
        Charset { chars }
    }
    /// Number of token ids, including the fallback.
    pub fn vocab(&self) -> usize {
        self.chars.len() + 1
    }
    pub fn encode(&self, text: &str) -> Vec<u32> {
        text.chars()
            .map(|c| match self.chars.binary_search(&c) {
                Ok(i) => i as u32 + 1,
                Err(_) => 0,
            })
            .collect()
    }
    pub fn decode(&self, ids: &[u32]) -> String {
        ids.iter()
            .map(|&i| if i == 0 || i as usize > self.chars.len() { '?' } else { self.chars[i as usize - 1] })
            .collect()
    }
}

#[derive(Debug, PartialEq)]
pub enum DataError {
    TooShort,
}

/// Tokens split into a training part and a held-out tail.
pub struct Corpus {
    pub train: Vec<u32>,
    pub held: Vec<u32>,
    pub l: usize,
}

impl Corpus {
    pub fn new(tokens: Vec<u32>, l: usize, heldout_frac: f64) -> Result<Corpus, DataError> {
        let split = ((tokens.len() as f64) * (1.0 - heldout_frac)) as usize;
        if split < 4 * l || tokens.len() - split < 4 * l {
            return Err(DataError::TooShort);
        }
        let held = tokens[split..].to_vec();
        let mut train = tokens;
        train.truncate(split);
        Ok(Corpus { train, held, l })
    }
    /// `n` windows at random starts in the training part.
    pub fn sample_batch(&self, rng: &mut Rng, n: usize) -> Vec<u32> {
        let mut out = Vec::with_capacity(n * self.l);
        for _ in 0..n {
            let s = rng.below(self.train.len() - self.l + 1);
            out.extend_from_slice(&self.train[s..s + self.l]);
        }
        out
    }
    pub fn heldout_windows(&self) -> usize {
        self.held.len() / self.l
    }
    /// Batch `i` of `n` fixed, non-overlapping held-out windows (wraps).
    pub fn heldout_batch(&self, i: usize, n: usize) -> Vec<u32> {
        let count = self.heldout_windows();
        let mut out = Vec::with_capacity(n * self.l);
        for j in 0..n {
            let w = (i * n + j) % count;
            out.extend_from_slice(&self.held[w * self.l..(w + 1) * self.l]);
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn charset_round_trip() {
        let cs = Charset::from_text("hello, world\n");
        assert_eq!(cs.decode(&cs.encode("hello, world\n")), "hello, world\n");
        assert_eq!(cs.vocab(), 11);
    }

    #[test]
    fn unknown_character_is_fallback() {
        let cs = Charset::from_text("abc");
        assert_eq!(cs.encode("aXc\u{e9}"), vec![1, 0, 3, 0]);
        assert_eq!(cs.decode(&[1, 0, 3, 99]), "a?c?");
    }

    #[test]
    fn too_short_corpus_is_refused() {
        assert_eq!(Corpus::new(vec![1; 100], 64, 0.05).err(), Some(DataError::TooShort));
        assert_eq!(Corpus::new(vec![1; 5000], 64, 0.05).err(), Some(DataError::TooShort));
        assert!(Corpus::new(vec![1; 6000], 64, 0.05).is_ok());
    }

    #[test]
    fn heldout_never_overlaps_training() {
        let tokens: Vec<u32> = (0..10_000).collect();
        let c = Corpus::new(tokens, 64, 0.05).unwrap();
        let max_train = *c.train.iter().max().unwrap();
        let mut r = Rng::new(1);
        for _ in 0..50 {
            assert!(c.sample_batch(&mut r, 8).iter().all(|t| *t <= max_train));
        }
        for i in 0..5 {
            let b = c.heldout_batch(i, 4);
            assert_eq!(b.len(), 4 * 64);
            assert!(b.iter().all(|t| *t > max_train));
        }
        // Windows inside a batch do not overlap.
        let b = c.heldout_batch(0, 2);
        assert_eq!(b[64], b[63] + 1);
        assert_eq!(b[0] + 64, b[64]);
    }
}
