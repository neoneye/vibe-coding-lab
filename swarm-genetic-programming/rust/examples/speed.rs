use std::time::Instant;
use swarm_gp::{fitness::*, ga::random_program, rng::Rng, program::Program, reference};
fn main() {
    let mut rng = Rng::new(1);
    for course in 0..7 {
        let progs: Vec<Program> = (0..200).map(|_| random_program(&mut rng, 6)).collect();
        let t = Instant::now();
        for p in &progs { evaluate(course, &[p.clone()], &TRAIN_SEEDS); }
        let r = Program::parse(reference::program_for(course).unwrap()).unwrap();
        let t2 = Instant::now();
        for _ in 0..20 { evaluate(course, &[r.clone()], &TRAIN_SEEDS); }
        println!("course {} random: {:.2} ms/eval   reference: {:.2} ms/eval", course, t.elapsed().as_secs_f64()*1000.0/200.0, t2.elapsed().as_secs_f64()*1000.0/20.0);
    }
}
