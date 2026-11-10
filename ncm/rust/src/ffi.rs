//! C-ABI exports for the wasm build.

use crate::ops;
use crate::F;

/// Quick fixed-value checks that also work in f32. Returns 0 when all pass.
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
