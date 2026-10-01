"""Hexagonal convolution via FFT.

A hexagon of radius R wrapped on a torus (tiling translations (2R+1, −R), (R, R+1)) is the cyclic group Z_N,
N = 3R² + 3R + 1, through φ(q, r) = ((R+1)·q − R·r) mod N. So hexagonal cyclic convolution = 1-D cyclic
convolution of length N. The non-wrapped product of two radius-R hexagons is a radius-2R hexagon, which fits
inside a torus of radius 2R without aliasing."""
import torch

def hex_cells(R):
    return [(q, r) for q in range(-R, R + 1) for r in range(-R, R + 1) if abs(q + r) <= R]

def phi(R):
    N = 3 * R * R + 3 * R + 1
    return N, lambda q, r: ((R + 1) * q - R * r) % N

class HexConv(torch.nn.Module):
    """(a ∗ b) for a, b on a hexagon of radius R; wrap=True keeps the output on the radius-R torus,
    wrap=False returns the full radius-2R product (centre-heavy fan-in)."""
    def __init__(s, R, wrap):
        super().__init__(); s.R, s.wrap = R, wrap
        Rt = R if wrap else 2 * R
        s.N, f = phi(Rt)
        s.register_buffer("inp", torch.tensor([f(q, r) for q, r in hex_cells(R)]))
        out = hex_cells(Rt)
        s.register_buffer("out", torch.tensor([f(q, r) for q, r in out]))
        s.register_buffer("ring", torch.tensor([(abs(q) + abs(r) + abs(q + r)) // 2 for q, r in out]))
        s.n_in, s.n_out = len(hex_cells(R)), len(out)
    def place(s, a):
        z = a.new_zeros(*a.shape[:-1], s.N); z[..., s.inp] = a; return z
    def forward(s, a, b):
        A, B = torch.fft.rfft(s.place(a)), torch.fft.rfft(s.place(b))
        return torch.fft.irfft(A * B, n=s.N)[..., s.out]

if __name__ == "__main__":
    torch.set_default_dtype(torch.float64)
    for R in (2, 3, 5):
        for wrap in (True, False):
            Rt = R if wrap else 2 * R; N, f = phi(Rt)
            assert len({f(q, r) for q, r in hex_cells(Rt)}) == N, "φ must be a bijection on the hexagon"
            hc = HexConv(R, wrap); P = hex_cells(R); a, b = torch.randn(len(P)), torch.randn(len(P))
            out = {c: i for i, c in enumerate(hex_cells(Rt))}
            ref = torch.zeros(len(out))
            # direct pair sum; wrapping by the tiling translations when wrap=True
            T1, T2 = (2 * R + 1, -R), (R, R + 1)
            def wrapc(q, r):
                for x in range(-3, 4):
                    for y in range(-3, 4):
                        p = (q - x * T1[0] - y * T2[0], r - x * T1[1] - y * T2[1])
                        if p in out: return p
            for i, p in enumerate(P):
                for j, q in enumerate(P):
                    s = (p[0] + q[0], p[1] + q[1]); s = wrapc(*s) if wrap else s
                    ref[out[s]] += a[i] * b[j]
            err = (hc(a, b) - ref).abs().max().item()
            print(f"R={R} wrap={wrap}: N={N}, outputs {hc.n_out}, FFT vs direct max error {err:.1e}")
