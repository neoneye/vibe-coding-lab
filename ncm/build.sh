#!/bin/sh
# Builds the Rust crate to wasm and copies it next to index.html.
set -e
cd "$(dirname "$0")"
RUSTFLAGS="-C target-feature=+simd128" cargo build --release --target wasm32-unknown-unknown --manifest-path rust/Cargo.toml
cp rust/target/wasm32-unknown-unknown/release/ncm.wasm ncm.wasm
ls -l ncm.wasm | awk '{print "ncm.wasm:", $5, "bytes"}'
