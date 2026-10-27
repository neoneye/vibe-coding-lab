//! Tests for the genetic algorithm and the library.

use crate::course::courses;
use crate::fitness::{evaluate, verify, Score, TRAIN_SEEDS};
use crate::ga::*;
use crate::library::*;
use crate::program::{Instruction, Program};
use crate::rng::Rng;

#[test]
fn random_programs_valid_and_run() {
    let mut rng = Rng::new(1);
    for _ in 0..200 {
        let p = random_program(&mut rng, 8);
        assert!(p.validate().is_ok());
        assert!(!p.instructions.is_empty() && p.instructions.len() <= MAX_LEN);
    }
    for _ in 0..20 {
        let p = random_program(&mut rng, 8);
        evaluate(0, &[p], &TRAIN_SEEDS[..1]);
    }
}

#[test]
fn random_programs_contain_calls() {
    let mut rng = Rng::new(2);
    let calls = (0..100)
        .filter(|_| random_program(&mut rng, 8).instructions.iter().any(|i| matches!(i, Instruction::Call { .. })))
        .count();
    assert!(calls > 60, "{} of 100 random programs call a function", calls);
}

#[test]
fn mutation_always_valid() {
    let mut rng = Rng::new(3);
    let mut p = random_program(&mut rng, 8);
    let mut changed = 0;
    for _ in 0..10_000 {
        let q = mutate(&p, &mut rng);
        assert!(q.validate().is_ok(), "invalid mutant:\n{}", q.serialize());
        assert!(q.instructions.len() <= MAX_LEN);
        if q != p {
            changed += 1;
        }
        p = if q.instructions.is_empty() { random_program(&mut rng, 4) } else { q };
    }
    assert!(changed > 9000, "mutations mostly change the program ({})", changed);
}

#[test]
fn mutation_can_wrap_a_loop() {
    let mut rng = Rng::new(4);
    let p = Program::parse("mov $1,1\nadd $1,2\nmul $1,3").unwrap();
    let wrapped = (0..500).any(|_| mutate(&p, &mut rng).instructions.iter().any(|i| matches!(i, Instruction::LoopBegin(_))));
    assert!(wrapped);
}

#[test]
fn crossover_always_valid() {
    let mut rng = Rng::new(5);
    for _ in 0..2000 {
        let a = mutate(&random_program(&mut rng, 10), &mut rng);
        let b = mutate(&random_program(&mut rng, 10), &mut rng);
        let c = crossover(&a, &b, &mut rng);
        assert!(c.validate().is_ok(), "invalid child:\n{}", c.serialize());
        assert!(c.instructions.len() <= MAX_LEN);
    }
}

#[test]
fn repair_balances_loops() {
    use crate::program::Src;
    let raw = vec![
        Instruction::LoopEnd,
        Instruction::LoopBegin(Src::Const(2)),
        Instruction::LoopBegin(Src::Const(2)),
        Instruction::LoopBegin(Src::Const(2)),
        Instruction::LoopBegin(Src::Const(2)),
        Instruction::LoopBegin(Src::Const(2)),
        Instruction::LoopEnd,
    ];
    let p = repair(raw);
    assert!(p.validate().is_ok(), "{}", p.serialize());
    assert_eq!(p.instructions.iter().filter(|i| matches!(i, Instruction::LoopBegin(_))).count(), 4);
}

#[test]
fn ga_clears_course_0() {
    let mut lib = Library::new();
    let mut ev = Evolver::new(0, 7, vec![]);
    while ev.generation < 30 && ev.verified_best.is_none() {
        ev.step(&mut lib);
    }
    let (p, _) = ev.verified_best.clone().expect("open field verified within 30 generations");
    assert!(verify(0, &[p]));
    assert_eq!(lib.entries[0].len(), 1);
}

#[test]
fn evolver_is_deterministic() {
    let run = || {
        let mut lib = Library::new();
        let mut ev = Evolver::new(1, 3, vec![]);
        for _ in 0..300 {
            ev.step(&mut lib);
        }
        (ev.best.0.serialize(), ev.best.1.fitness)
    };
    assert_eq!(run(), run());
}

#[test]
fn evolver_seeds_population_from_library() {
    let p = Program::parse(crate::reference::EXIT).unwrap();
    let mut lib = Library::new();
    let mut ev = Evolver::new(1, 3, vec![p.clone()]);
    ev.step(&mut lib);
    assert_eq!(ev.population[0].0, p, "library programs are evaluated first");
}

#[test]
fn generations_and_history_advance() {
    let mut lib = Library::new();
    let mut ev = Evolver::new(0, 1, vec![]);
    for _ in 0..POPULATION * 2 {
        ev.step(&mut lib);
    }
    assert_eq!(ev.generation, 2);
    assert_eq!(ev.history.len(), 2);
    assert!(ev.history[1] >= ev.history[0], "best fitness never decreases");
}

fn score(f: f64) -> Score {
    Score { fitness: f, ..Score::default() }
}

#[test]
fn library_keeps_top5_sorted() {
    let mut lib = Library::new();
    for i in 0..8 {
        let p = Program::parse(&format!("mov $1,{}", i)).unwrap();
        lib.offer(2, p, score(i as f64 * 10.0).fitness, i);
    }
    let fits: Vec<f64> = lib.entries[2].iter().map(|e| e.fitness).collect();
    assert_eq!(fits, vec![70.0, 60.0, 50.0, 40.0, 30.0]);
    assert!(!lib.offer(2, Program::parse("mov $1,99").unwrap(), 5.0, 9), "worse than the worst kept");
}

#[test]
fn library_prefers_shorter_at_equal_fitness() {
    let mut lib = Library::new();
    lib.offer(0, Program::parse("mov $1,1\nmov $2,2").unwrap(), 50.0, 0);
    lib.offer(0, Program::parse("mov $1,1").unwrap(), 50.0, 1);
    assert_eq!(lib.entries[0][0].program.instructions.len(), 1);
}

#[test]
fn library_dedupes() {
    let mut lib = Library::new();
    let p = Program::parse("mov $1,1").unwrap();
    assert!(lib.offer(0, p.clone(), 10.0, 0));
    assert!(!lib.offer(0, p, 10.0, 1));
    assert_eq!(lib.entries[0].len(), 1);
}

#[test]
fn library_text_round_trip() {
    let mut lib = Library::new();
    lib.offer(0, Program::parse(crate::reference::EXIT).unwrap(), 1100.5, 3);
    lib.offer(5, Program::parse(crate::reference::GATE).unwrap(), 1290.25, 12);
    let text = lib.to_text();
    assert!(text.contains("; course 5 Gate: quadratic"));
    let back = Library::from_text(&text).unwrap();
    assert_eq!(back.to_text(), text);
    assert_eq!(back.entries[5][0].generation, 12);
}

#[test]
fn library_text_errors_have_whole_text_line_numbers() {
    let text = "; course 0 Open field\n; fitness 1 generation 0\nmov $1,1\n\n; course 1 Wall\nfoo $1\n";
    let e = Library::from_text(text).unwrap_err();
    assert_eq!(e.line, 6);
    assert!(Library::from_text("mov $1,1").is_err(), "code before any course header");
    assert!(Library::from_text("; course 99 Nope\nmov $1,1").is_err());
}

#[test]
fn seeds_for_skips_own_course() {
    let mut lib = Library::new();
    lib.offer(0, Program::parse("mov $1,1").unwrap(), 10.0, 0);
    lib.offer(1, Program::parse("mov $1,2").unwrap(), 10.0, 0);
    assert_eq!(lib.seeds_for(1).len(), 1);
    assert_eq!(lib.seeds_for(3).len(), 2);
    assert_eq!(Library::new().entries.len(), courses().len());
}

#[test]
fn mutation_can_chain_a_call_to_earlier_outputs() {
    // read_task writes x, a0.. to $4..$8; a chained call takes its id
    // register just below one of those outputs, so its first input is one.
    let p = Program::parse("mov $3,8\nf05 $4,$3").unwrap();
    let mut rng = Rng::new(9);
    let chained = (0..2000)
        .filter(|_| {
            let q = mutate(&p, &mut rng);
            q.instructions.iter().skip(2).any(|i| match *i {
                Instruction::Call { inputs, source, .. } => inputs >= 1 && (4..=8).contains(&(source + 1)),
                _ => false,
            })
        })
        .count();
    assert!(chained >= 60, "{} of 2000 mutations chain a call", chained);
}

#[test]
fn mutation_can_combine_call_outputs() {
    use crate::program::{Op, Src};
    let p = Program::parse("mov $3,8\nf05 $4,$3").unwrap();
    let mut rng = Rng::new(10);
    let combined = (0..2000)
        .filter(|_| {
            mutate(&p, &mut rng).instructions.iter().any(|i| match *i {
                Instruction::Calc { op: Op::Add | Op::Mul, target, src: Src::Reg(r) } => (4..=8).contains(&target) && (4..=8).contains(&r) && target != r,
                _ => false,
            })
        })
        .count();
    assert!(combined >= 60, "{} of 2000 mutations combine outputs", combined);
}

#[test]
fn a_generalising_program_is_verified_even_after_a_better_overfit_failed() {
    use crate::fitness::Score;
    let mut lib = Library::new();
    let mut ev = Evolver::new(3, 1, vec![]);
    // An overfit program with a high training score that fails verification.
    let overfit = Program::parse("mov $1,1").unwrap();
    ev.consider_best(&overfit, Score { fitness: 1400.0, arrived_frac: 1.0, solved_frac: 1.0, ticks_used: 40 }, &mut lib);
    assert!(ev.verified_best.is_none());
    let good = Program::parse(crate::reference::GATE).unwrap();
    let s = evaluate(3, &[good.clone()], &TRAIN_SEEDS);
    assert!(s.fitness < 1400.0 && s.fitness > 0.98 * 1400.0 - 100.0, "reference scores {}", s.fitness);
    ev.consider_best(&good, Score { fitness: 1390.0, ..s }, &mut lib);
    assert!(ev.verified_best.is_some(), "the slightly lower generalising program still gets verified");
}
