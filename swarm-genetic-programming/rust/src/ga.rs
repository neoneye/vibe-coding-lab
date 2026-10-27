//! The genetic algorithm: random programs, mutation, crossover and a
//! steady-state evolver.

use crate::fitness::{evaluate, verify, Score, TRAIN_SEEDS, VERIFY_ARRIVED};
use crate::interp::MAX_LOOP_COUNT;
use crate::library::Library;
use crate::program::{Instruction, Op, Program, Src, ALL_OPS, MAX_LOOP_DEPTH, REGISTER_COUNT};
use crate::registry::FUNCTIONS;
use crate::rng::Rng;

pub const POPULATION: usize = 200;
pub const MAX_LEN: usize = 40;
const TOURNAMENT: usize = 4;
const CROSSOVER_RATE: f64 = 0.3;

/// Constants that mean something to the registry: function ids, kinds and
/// headings all live in 0..16.
fn random_constant(rng: &mut Rng) -> i64 {
    match rng.below(4) {
        0 => rng.range_i64(-2, 2),
        1 => rng.range_i64(0, 15),
        2 => rng.range_i64(3, 7),
        _ => rng.range_i64(-10, 40),
    }
}

fn random_reg(rng: &mut Rng) -> u8 {
    rng.below(REGISTER_COUNT as u64) as u8
}

fn random_src(rng: &mut Rng) -> Src {
    if rng.chance(0.5) {
        Src::Reg(random_reg(rng))
    } else {
        Src::Const(random_constant(rng))
    }
}

fn random_op(rng: &mut Rng) -> Op {
    // mov/add/sub/mul twice as likely as the rest
    let weighted = [Op::Mov, Op::Mov, Op::Add, Op::Add, Op::Sub, Op::Sub, Op::Mul, Op::Mul, Op::Div, Op::Mod, Op::Min, Op::Max];
    weighted[rng.below(weighted.len() as u64) as usize]
}

/// `mov $s,<id>`, optional input setup, then `f<in><out> $t,$s`.
fn random_call(rng: &mut Rng) -> Vec<Instruction> {
    let f = &FUNCTIONS[rng.below(FUNCTIONS.len() as u64) as usize];
    let s = rng.below((REGISTER_COUNT - f.inputs as usize) as u64) as u8;
    let t = rng.below((REGISTER_COUNT - f.outputs as usize + 1) as u64) as u8;
    let mut out = vec![Instruction::Calc { op: Op::Mov, target: s, src: Src::Const(f.id) }];
    for k in 1..=f.inputs {
        match rng.below(5) {
            0 | 1 => out.push(Instruction::Calc { op: Op::Mov, target: s + k, src: Src::Const(random_constant(rng)) }),
            2 | 3 => out.push(Instruction::Calc { op: Op::Mov, target: s + k, src: Src::Reg(random_reg(rng)) }),
            _ => {}
        }
    }
    out.push(Instruction::Call { inputs: f.inputs, outputs: f.outputs, target: t, source: s });
    out
}

fn random_instructions(rng: &mut Rng) -> Vec<Instruction> {
    if rng.chance(0.4) {
        random_call(rng)
    } else {
        vec![Instruction::Calc { op: random_op(rng), target: random_reg(rng), src: random_src(rng) }]
    }
}

pub fn random_program(rng: &mut Rng, len: usize) -> Program {
    let mut ins = Vec::new();
    while ins.len() < len.max(1) {
        ins.extend(random_instructions(rng));
    }
    repair(ins)
}

/// Makes any instruction list valid: drops unmatched `lpe`, drops `lpb`s
/// nested too deep (with their `lpe`), closes open loops, caps the length,
/// and drops calls whose register ranges don't fit.
pub fn repair(ins: Vec<Instruction>) -> Program {
    fn balance(ins: Vec<Instruction>) -> Vec<Instruction> {
        let mut out = Vec::with_capacity(ins.len() + MAX_LOOP_DEPTH);
        // true = this lpb was kept
        let mut stack: Vec<bool> = Vec::new();
        let mut depth = 0;
        for i in ins {
            match i {
                Instruction::LoopBegin(_) => {
                    let keep = depth < MAX_LOOP_DEPTH;
                    stack.push(keep);
                    if keep {
                        depth += 1;
                        out.push(i);
                    }
                }
                Instruction::LoopEnd => match stack.pop() {
                    Some(true) => {
                        depth -= 1;
                        out.push(i);
                    }
                    _ => {}
                },
                Instruction::Call { .. } => {
                    if (Program { instructions: vec![i] }).validate().is_ok() {
                        out.push(i);
                    }
                }
                _ => out.push(i),
            }
        }
        for _ in 0..depth {
            out.push(Instruction::LoopEnd);
        }
        out
    }
    let mut out = balance(ins);
    if out.len() > MAX_LEN {
        out.truncate(MAX_LEN - MAX_LOOP_DEPTH);
        out = balance(out);
    }
    Program { instructions: out }
}

/// Index of the instruction that matches the loop instruction at `i`.
fn loop_partner(ins: &[Instruction], i: usize) -> Option<usize> {
    match ins[i] {
        Instruction::LoopBegin(_) => {
            let mut depth = 0;
            for (j, x) in ins.iter().enumerate().skip(i) {
                match x {
                    Instruction::LoopBegin(_) => depth += 1,
                    Instruction::LoopEnd => {
                        depth -= 1;
                        if depth == 0 {
                            return Some(j);
                        }
                    }
                    _ => {}
                }
            }
            None
        }
        Instruction::LoopEnd => {
            let mut depth = 0;
            for j in (0..=i).rev() {
                match ins[j] {
                    Instruction::LoopEnd => depth += 1,
                    Instruction::LoopBegin(_) => {
                        depth -= 1;
                        if depth == 0 {
                            return Some(j);
                        }
                    }
                    _ => {}
                }
            }
            None
        }
        _ => None,
    }
}

fn tweak_constant(c: i64, rng: &mut Rng) -> i64 {
    match rng.below(4) {
        0 => c.saturating_add(if rng.chance(0.5) { 1 } else { -1 }),
        1 => c.saturating_add(rng.range_i64(-5, 5)),
        2 => -c,
        _ => random_constant(rng),
    }
}

/// One random edit. Always returns a valid program.
pub fn mutate(p: &Program, rng: &mut Rng) -> Program {
    for _ in 0..20 {
        let mut ins = p.instructions.clone();
        let n = ins.len();
        let pick = |rng: &mut Rng| rng.below(n.max(1) as u64) as usize;
        let calls: Vec<usize> = (0..n).filter(|&i| matches!(ins[i], Instruction::Call { outputs: 1.., .. })).collect();
        match rng.below(13) {
            // change a constant
            0 | 1 => {
                let consts: Vec<usize> = (0..n)
                    .filter(|&i| matches!(ins[i], Instruction::Calc { src: Src::Const(_), .. } | Instruction::LoopBegin(Src::Const(_))))
                    .collect();
                if consts.is_empty() {
                    continue;
                }
                let i = consts[rng.below(consts.len() as u64) as usize];
                match &mut ins[i] {
                    Instruction::Calc { src: Src::Const(c), .. } => *c = tweak_constant(*c, rng),
                    Instruction::LoopBegin(Src::Const(c)) => *c = tweak_constant(*c, rng).clamp(0, MAX_LOOP_COUNT),
                    _ => unreachable!(),
                }
            }
            // change a register
            2 => {
                if n == 0 {
                    continue;
                }
                let i = pick(rng);
                let r = random_reg(rng);
                match &mut ins[i] {
                    Instruction::Calc { target, src, .. } => {
                        if rng.chance(0.5) {
                            *target = r;
                        } else {
                            *src = Src::Reg(r);
                        }
                    }
                    Instruction::Call { target, source, .. } => {
                        if rng.chance(0.5) {
                            *target = r;
                        } else {
                            *source = r;
                        }
                    }
                    Instruction::LoopBegin(src) => *src = Src::Reg(r),
                    Instruction::LoopEnd => continue,
                }
            }
            // change an operation, or flip register/constant source
            3 => {
                if n == 0 {
                    continue;
                }
                let i = pick(rng);
                match &mut ins[i] {
                    Instruction::Calc { op, src, .. } => {
                        if rng.chance(0.6) {
                            *op = ALL_OPS[rng.below(ALL_OPS.len() as u64) as usize];
                        } else {
                            *src = random_src(rng);
                        }
                    }
                    Instruction::Call { inputs, outputs, .. } => {
                        let f = &FUNCTIONS[rng.below(FUNCTIONS.len() as u64) as usize];
                        *inputs = f.inputs;
                        *outputs = f.outputs;
                    }
                    _ => continue,
                }
            }
            // insert an instruction or a call pair
            4 | 5 => {
                let at = rng.below(n as u64 + 1) as usize;
                let new = if rng.chance(0.5) { random_call(rng) } else { random_instructions(rng) };
                ins.splice(at..at, new);
            }
            // delete (a loop instruction takes its partner with it)
            6 | 7 => {
                if n == 0 {
                    continue;
                }
                let i = pick(rng);
                match loop_partner(&ins, i) {
                    Some(j) => {
                        let (a, b) = (i.max(j), i.min(j));
                        ins.remove(a);
                        ins.remove(b);
                    }
                    None => {
                        ins.remove(i);
                    }
                }
            }
            // swap two neighbours
            8 => {
                if n < 2 {
                    continue;
                }
                let i = rng.below(n as u64 - 1) as usize;
                ins.swap(i, i + 1);
            }
            // wrap a range in a loop
            9 => {
                if n == 0 {
                    continue;
                }
                let a = pick(rng);
                let b = a + 1 + rng.below((n - a).min(6) as u64) as usize;
                let count = if rng.chance(0.5) { Src::Reg(random_reg(rng)) } else { Src::Const(rng.range_i64(0, 4)) };
                ins.insert(b, Instruction::LoopEnd);
                ins.insert(a, Instruction::LoopBegin(count));
            }
            // chain: a new call after an earlier one, reading its outputs
            11 => {
                if calls.is_empty() {
                    continue;
                }
                let c = calls[rng.below(calls.len() as u64) as usize];
                let Instruction::Call { outputs, target, .. } = ins[c] else { unreachable!() };
                let f = &FUNCTIONS[rng.below(FUNCTIONS.len() as u64) as usize];
                if f.inputs == 0 {
                    continue;
                }
                // first input = output k of the earlier call
                let k = rng.below(outputs as u64) as i64;
                let src = target as i64 + k - 1;
                if src < 0 || src as usize + f.inputs as usize >= REGISTER_COUNT {
                    continue;
                }
                let t = rng.below((REGISTER_COUNT - f.outputs as usize + 1) as u64) as u8;
                let at = c + 1 + rng.below((n - c) as u64) as usize;
                let new = [
                    Instruction::Calc { op: Op::Mov, target: src as u8, src: Src::Const(f.id) },
                    Instruction::Call { inputs: f.inputs, outputs: f.outputs, target: t, source: src as u8 },
                ];
                ins.splice(at..at, new);
            }
            // combine two outputs of a call
            12 => {
                let multi: Vec<usize> = calls.iter().copied().filter(|&i| matches!(ins[i], Instruction::Call { outputs: 2.., .. })).collect();
                if multi.is_empty() {
                    continue;
                }
                let c = multi[rng.below(multi.len() as u64) as usize];
                let Instruction::Call { outputs, target, .. } = ins[c] else { unreachable!() };
                let a = target + rng.below(outputs as u64) as u8;
                let b = target + rng.below(outputs as u64) as u8;
                if a == b {
                    continue;
                }
                let op = [Op::Add, Op::Mul, Op::Sub][rng.below(3) as usize];
                ins.insert(c + 1, Instruction::Calc { op, target: a, src: Src::Reg(b) });
            }
            // unwrap a loop
            _ => {
                let loops: Vec<usize> = (0..n).filter(|&i| matches!(ins[i], Instruction::LoopBegin(_))).collect();
                if loops.is_empty() {
                    continue;
                }
                let i = loops[rng.below(loops.len() as u64) as usize];
                if let Some(j) = loop_partner(&ins, i) {
                    ins.remove(j);
                    ins.remove(i);
                }
            }
        }
        let q = repair(ins);
        if &q != p && q.validate().is_ok() {
            return q;
        }
    }
    p.clone()
}

/// Single-point crossover: the head of `a` and the tail of `b`, repaired.
pub fn crossover(a: &Program, b: &Program, rng: &mut Rng) -> Program {
    let i = rng.below(a.instructions.len() as u64 + 1) as usize;
    let j = rng.below(b.instructions.len() as u64 + 1) as usize;
    let mut ins = a.instructions[..i].to_vec();
    ins.extend_from_slice(&b.instructions[j..]);
    repair(ins)
}

fn program_hash(p: &Program) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    p.serialize().hash(&mut h);
    h.finish()
}

pub struct Evolver {
    pub course: usize,
    rng: Rng,
    pub population: Vec<(Program, Score)>,
    /// Programs still to be evaluated into the population (library seeds,
    /// then random programs).
    pending: Vec<Program>,
    pub generation: u32,
    /// Best fitness at the end of every generation.
    pub history: Vec<f64>,
    pub best: (Program, Score),
    pub verified_best: Option<(Program, Score)>,
    /// Programs already sent to verification (by serialized text hash).
    tried_verify: std::collections::HashSet<u64>,
    steps_in_generation: usize,
    pub evaluations: u64,
}

impl Evolver {
    pub fn new(course: usize, seed: u64, library_seeds: Vec<Program>) -> Evolver {
        let mut rng = Rng::new(seed ^ 0x5EED_0000 ^ ((course as u64) << 32));
        let mut pending: Vec<Program> = library_seeds.into_iter().take(POPULATION / 4).collect();
        while pending.len() < POPULATION {
            let len = rng.range_i64(2, 10) as usize;
            pending.push(random_program(&mut rng, len));
        }
        pending.reverse(); // pop() takes library seeds first
        Evolver {
            course,
            rng,
            population: Vec::with_capacity(POPULATION),
            pending,
            generation: 0,
            history: Vec::new(),
            best: (Program::default(), Score { fitness: f64::NEG_INFINITY, ..Score::default() }),
            verified_best: None,
            tried_verify: std::collections::HashSet::new(),
            steps_in_generation: 0,
            evaluations: 0,
        }
    }

    fn evaluate(&mut self, p: &Program) -> Score {
        self.evaluations += 1;
        evaluate(self.course, std::slice::from_ref(p), &TRAIN_SEEDS)
    }

    fn tournament(&mut self, best: bool) -> usize {
        let mut pick = self.rng.below(self.population.len() as u64) as usize;
        for _ in 1..TOURNAMENT {
            let j = self.rng.below(self.population.len() as u64) as usize;
            let better = self.population[j].1.fitness > self.population[pick].1.fitness;
            if better == best {
                pick = j;
            }
        }
        pick
    }

    pub fn consider_best(&mut self, p: &Program, s: Score, library: &mut Library) {
        if s.fitness > self.best.1.fitness {
            self.best = (p.clone(), s);
        }
        // Verify any new candidate close to the best: a program that
        // generalises may score a little below one that overfits.
        let improves_verified = self.verified_best.as_ref().map_or(true, |(_, v)| s.fitness > v.fitness);
        let near_best = s.fitness >= self.best.1.fitness - 0.02 * self.best.1.fitness.abs();
        if s.arrived_frac >= VERIFY_ARRIVED && near_best && improves_verified && self.tried_verify.insert(program_hash(p)) {
            if verify(self.course, std::slice::from_ref(p)) {
                self.verified_best = Some((p.clone(), s));
                library.offer(self.course, p.clone(), s.fitness, self.generation);
            }
        }
    }

    /// Evaluates one program: a pending seed, or a new child.
    pub fn step(&mut self, library: &mut Library) {
        if let Some(p) = self.pending.pop() {
            let s = self.evaluate(&p);
            self.population.push((p.clone(), s));
            self.consider_best(&p, s, library);
        } else {
            let a = self.tournament(true);
            let child = if self.rng.chance(CROSSOVER_RATE) {
                let b = self.tournament(true);
                let c = crossover(&self.population[a].0, &self.population[b].0, &mut self.rng);
                mutate(&c, &mut self.rng)
            } else {
                mutate(&self.population[a].0, &mut self.rng)
            };
            let s = self.evaluate(&child);
            let loser = self.tournament(false);
            if s.fitness >= self.population[loser].1.fitness {
                self.population[loser] = (child.clone(), s);
            }
            self.consider_best(&child, s, library);
        }
        self.steps_in_generation += 1;
        if self.steps_in_generation >= POPULATION {
            self.steps_in_generation = 0;
            self.generation += 1;
            self.history.push(self.best.1.fitness);
        }
    }
}
