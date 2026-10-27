//! Runs the GA on every course in order (library-seeded), printing when each
//! course is verified. Usage: cargo run --release --example evolve [max_generations] [seed]
use std::time::Instant;
use swarm_gp::{course::courses, ga::Evolver, library::Library};
fn main() {
    let args: Vec<String> = std::env::args().collect();
    let max_gen: u32 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(40);
    let seed: u64 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(1);
    let only: Option<usize> = args.get(3).and_then(|s| s.parse().ok());
    let mut lib = Library::new();
    for (i, c) in courses().iter().enumerate() {
        if only.map_or(false, |o| o != i) { continue; }
        let t = Instant::now();
        let mut ev = Evolver::new(i, seed, lib.seeds_for(i));
        while ev.generation < max_gen && ev.verified_best.is_none() { ev.step(&mut lib); }
        println!("{:>2} {:<18} gen {:>3} evals {:>6} {:>6.1}s best {:>7.1} verified {}", i, c.name, ev.generation, ev.evaluations, t.elapsed().as_secs_f64(), ev.best.1.fitness, ev.verified_best.is_some());
        match &ev.verified_best { Some((p, _)) => println!("{}", p.serialize()), None => println!("best (unverified):\n{}", ev.best.0.serialize()) }
    }
}
