# matrix-polygon-shapes

**Question.** Matrices are rectangles of numbers. Are there other shapes (triangles, pentagons,
hexagons, n-gons) with interesting properties under multiplication? Pros and cons of each, and can
square matrices be replaced by n-gons?

"Shape" can mean three different, precise things. Each is investigated separately:

1. **Shape = nonzero pattern inside an ordinary square matrix.** Multiplication is the usual matrix
   product. Which shapes are preserved, how fast do they fill in, and what does a product cost?
   (`sparsity/`)
2. **Shape = index set of a number array, multiplied by convolution.** This is how non-rectangular
   arrays naturally multiply (polynomials, image filters, hexagonal grids): supports add as Minkowski
   sums. Which shapes are closed, and what is the exact number of multiplications? (`convolution/`)
3. **Shape = the contraction pattern.** A ring of n matrices, trace(A₁A₂···Aₙ), is an n-gon tensor
   network. The triangle is ordinary matrix multiplication; the square is the four-way form studied in
   `../matrix-3way-multiplication`. What is the rank, i.e. the cost of a fused algorithm, for each n?
   (`rings/`)

Results accumulate in `FINDINGS.md`. The interactive page is `index.html`.
