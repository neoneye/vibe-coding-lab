/-! Lean 4 (core only, no Mathlib) certificates for matrix-3way-multiplication.

1. `strassen_chain`: two chained Strassen multiplications compute `A*B*C` for 2×2
   integer matrices using 7 + 7 = 14 multiplications — the baseline any 3-way
   algorithm must beat.
2. `flatten_injective`: the combinatorial core of the N⁴ lower bound. The
   (A,C | B,D) flattening of trace(ABCD) maps the N⁴ index tuples (i,j,k,l)
   injectively to column (jk, li), so it is a partial permutation matrix of rank N⁴.
-/

structure M2 where (a b c d : Int)

def mul (x y : M2) : M2 := ⟨x.a*y.a + x.b*y.c, x.a*y.b + x.b*y.d, x.c*y.a + x.d*y.c, x.c*y.b + x.d*y.d⟩

/-- Strassen's 7-multiplication product. -/
def strassen (x y : M2) : M2 :=
  let m1 := (x.a + x.d) * (y.a + y.d)
  let m2 := (x.c + x.d) * y.a
  let m3 := x.a * (y.b - y.d)
  let m4 := x.d * (y.c - y.a)
  let m5 := (x.a + x.b) * y.d
  let m6 := (x.c - x.a) * (y.a + y.b)
  let m7 := (x.b - x.d) * (y.c + y.d)
  ⟨m1 + m4 - m5 + m7, m3 + m5, m2 + m4, m1 - m2 + m3 + m6⟩

theorem strassen_correct (x y : M2) : strassen x y = mul x y := by
  cases x; cases y; simp only [strassen, mul, M2.mk.injEq]; refine ⟨?_, ?_, ?_, ?_⟩ <;> grind

/-- 14 multiplications for `A*B*C`. -/
theorem strassen_chain (x y z : M2) : strassen (strassen x y) z = mul (mul x y) z := by
  rw [strassen_correct, strassen_correct]

/-- Associativity, so the chain really is `A*B*C`. -/
theorem mul_assoc' (x y z : M2) : mul (mul x y) z = mul x (mul y z) := by
  cases x; cases y; cases z; simp only [mul, M2.mk.injEq]; refine ⟨?_, ?_, ?_, ?_⟩ <;> grind

/-- The flattening map (A,C | B,D): tuple (i,j,k,l) ↦ column (j,k,l,i)-pair. Injective for
every N, proved for general N (index tuples over `Fin N`). -/
theorem flatten_injective (N : Nat) :
    Function.Injective (fun t : Fin N × Fin N × Fin N × Fin N => ((t.2.1, t.2.2.1), (t.2.2.2, t.1))) := by
  rintro ⟨i, j, k, l⟩ ⟨i', j', k', l'⟩ h
  simp only [Prod.mk.injEq] at h
  obtain ⟨⟨rfl, rfl⟩, rfl, rfl⟩ := h
  rfl
