# Reverse Polish Notation: design

Date: 2026-10-25. Directory: `education-reverse-polish-notation/`.

## Intent

The owner met RPN calculators as a kid in the late 80s, with no internet and no one to explain them, and never got it. Now they have 30 years as a developer and want the notation explained. Not calculators: no HP keyboards, no stack-shuffling keys. Interactive, organised in levels (1 = the most basic operation, 2 = another operation, 3 = combining them, …), with the syntax tree visualised.

## Shape (owner's)

- Levels that build on each other.
- Interactive elements.
- A visualised syntax tree.

## My calls

- **One picture, three views.** Every RPN expression is shown as a token strip, a stack and a tree, stepped one token at a time (forward/back/play, click a token to jump). The stack is drawn horizontally, bottom left, top right, and each stack slot is a card that holds its subtree. A number pushes a one-node tree. An operator merges the top cards into one card with a new root. So the stack is visibly a forest that becomes one tree. A trace table (token, action, stack after) sits underneath.
- **Levels:**
  1. Operands first.
  2. Order matters for − and ÷.
  3. Chaining.
  4. Operands that wait, and why no parentheses are needed.
  5. Two branches.
  6. Powers and one-operand operators (`neg`, `sqrt`).
  7. Variables and real formulas, ending with the quadratic formula.
  8. The algorithm: post-order traversal, reading RPN back into infix, and where developers have already met it (JVM, Wasm, CPython bytecode, PostScript, Forth).

  A playground follows the levels.
- **Exercises in every level.** *Write* exercises give infix and you type RPN. While you type, your input is drawn live as stack and tree. *Read* exercises give RPN and you answer with a number or an infix expression. The checker accepts the exact tree, then swapped operands of + and ×, then any numerically equivalent tree, saying which one it matched. Hints go in a ladder: the target tree, then the next token, then the full answer.
- **Post-order demo** in level 8: the full tree, walked in post-order and emitting the tokens.
- No stack-manipulation words (swap, dup, roll): they belong to calculators and Forth, not the notation.
- Unary minus is the separate token `neg`, because in RPN `-` is always binary. Negative literals are not lexed.
- Progress is ticked off per exercise in localStorage, wrapped in try/catch. Navigation uses the URL hash.
- Light and dark themes. No dependencies; works from file://.

## Engine

The engine lives in `<script id="shared-code">` and is tested by `test.mjs`. It has:

- an RPN lexer (spaces are optional around operators)
- a stack-machine trace that builds tree nodes as it goes
- a Pratt infix parser (implicit multiplication; `^` right-associative; unary minus below `^`, so −3^2 = −(3^2); √ binds like a function call)
- post-order RPN emission
- minimal-parentheses infix printing
- the exercise checkers and the hint function

The tests also check that every lesson's stored RPN matches the RPN emitted from its infix.
