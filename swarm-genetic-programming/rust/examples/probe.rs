use swarm_gp::{course::courses, fitness::*, program::Program, reference};
fn main() {
    for i in 0..courses().len() {
        let p = Program::parse(reference::program_for(i).unwrap()).unwrap();
        let per: Vec<String> = VALIDATION_SEEDS.iter().map(|&s| { let w = run_world(i, &[p.clone()], s); format!("{}/{}@{}", w.arrived(), w.creatures.len(), w.tick) }).collect();
        println!("{} {}: {}", i, courses()[i].name, per.join(" "));
    }
}
