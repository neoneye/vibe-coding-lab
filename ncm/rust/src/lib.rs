//! Next Concept Modeling in dependency-free Rust.
//! Follows github.com/HazyResearch/ncm (MIT) at toy size.

#[cfg(feature = "f64")]
pub type F = f64;
#[cfg(not(feature = "f64"))]
pub type F = f32;

pub mod block;
pub mod checkpoint;
pub mod data;
pub mod generator;
pub mod ops;
pub mod param;
pub mod quant;
pub mod tokenizer;
pub mod rng;
pub mod session;
pub mod tape;
pub mod ffi;
