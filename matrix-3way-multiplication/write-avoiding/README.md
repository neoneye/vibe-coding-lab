# 3-way matrix multiplication when writes are expensive and reads are cheap

**Cost model.**
- Reading inputs or stored values is free.
- Every word written to memory costs 1.
- A scratch area of S registers is not memory, but S is reported as the resource being traded.

The output `D = A·B·C` must be written, so **W ≥ N² is a hard lower bound**.

`schedules.py` runs each schedule on an instrumented machine, checks it against numpy, and
counts writes, multiplications (or exp/ln in log domain), additions and peak registers.
Full table: `results.txt`.

## Results (N=2 / N=8)

| schedule | writes | mul (or exp) | regs |
|---|---|---|---|
| chain: T = AB stored, D = TC | 8 / 128 | 16 / 1024 | 1 |
| fused column: hold column l of BC, D[:,l] = A·(BC)[:,l] | **4 / 64** | 16 / 1024 | N+1 |
| fused tiled, S output accumulators | **4 / 64** | N³ + N⁴/S | S+1 |
| fused triple-sum Σⱼₖ AᵢⱼBⱼₖCₖₗ | **4 / 64** | 32 / 8192 | 1 |
| fused triple-sum, e/ln (one exp per triple) | **4 / 64** | **16** / 4096 | 1 |
| Strassen chain, temporaries spilled | 42 / 3290 | 14 / 686 | 0 |
| Strassen chain, temporaries in registers | **4 / 64** | 14 / 686 | ≤38 / ≤3226 |

## Answers

1. **Writes: N² is achievable, and costs nothing extra.**
   - Fusing the two products drops the intermediate `AB` entirely.
   - With N registers holding one column of `BC`, the schedule writes only the output and still does exactly the chain's 2N³ multiplications.
   - That halves the writes of the textbook chain (2N² → N²) for free.
2. **Scratch vs arithmetic trade-off.** With S < N registers, `BC` entries are recomputed:
   - multiplications = **N³ + N⁴/S** at W = N², which runs from 2N³ at S = N up to N⁴ + N³ at S = 1;
   - so with S registers the fused schedule beats the chain whenever the write cost ω satisfies ω > N²/S − N.
3. **Fast algorithms and writes do not mix at scale.** Strassen with temporaries in memory writes far more (42 vs 8 at N=2, 3290 vs 128 at N=8). This matches the theorem that Strassen-like algorithms cannot be write-avoiding (Carson, Demmel et al., *Write-Avoiding Algorithms*, 2015). They only reach W = N² when all temporaries fit in scratch. Without register reuse that is 38 registers at N=2 and 3226 at N=8, so the requirement grows faster than N².
4. **e/ln decomposition.**
   - In log space a product of any number of factors is one `exp` of a sum of logs. That is the same compression as the EML trees in `../eml/`.
   - So the fully fused triple-sum costs **N⁴ exps** (not 2N⁴ multiplications) with a single register and W = N².
   - At **N = 2 that ties the chain (16 = 2·2³)** while halving its writes and needing no scratch.
   - For N > 2, N⁴ > 2N³, so the column-fused schedule is better.
   - Two caveats:
     - Logs of inputs are recomputed on every read here (free under the model). Precomputing them would cost 3N² writes.
     - Negative entries need complex logs (principal branch), as in EML.

**Bottom line.** Under "writes expensive, reads cheap", the 3-way view really does help: fusing
`A·B·C` writes only the N² outputs, versus 2N² for two separate multiplications, with no extra
arithmetic as long as N registers are available. The log-domain version makes the triple product
a single exp. That gives a scratch-free schedule that ties the chain's operation count at N = 2.
