//! Scoring a program on a course, and verifying it on held-out seeds.

use crate::course::courses;
use crate::program::Program;
use crate::world::{CreatureState, World};

/// Seeds the GA evolves against.
pub const TRAIN_SEEDS: [u64; 4] = [11, 22, 33, 44];
/// Held-out seeds a program must pass to be verified (the OEIS analogue).
pub const VALIDATION_SEEDS: [u64; 8] = [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008];
/// Fraction of the swarm that must leave through the exit on every
/// validation seed.
pub const VERIFY_ARRIVED: f64 = 0.8;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Score {
    pub fitness: f64,
    pub arrived_frac: f64,
    pub solved_frac: f64,
    pub ticks_used: u32,
}

/// Runs a fresh world until it is done.
pub fn run_world(course: usize, programs: &[Program], seed: u64) -> World {
    let mut w = World::new(course, seed, programs.to_vec());
    while !w.done() {
        w.step();
    }
    w
}

/// Fitness of one finished world.
///
/// Weights, largest first:
/// - 1000 × fraction of the swarm out of the exit
/// - 200 × fraction of stations solved
/// - 100 × mean progress toward the exit (1 − path distance now / at spawn;
///   arrived creatures count 1)
/// - 50 × closeness of the best answer at each unsolved station,
///   1 / (1 + log2(1 + error)), solved stations count 1
/// - 50 × food eaten per swarm member (capped at 1)
/// - 30 × fraction of stations whose task was read (a stepping stone)
/// - −20 × fraction of the tick limit used
/// - −0.5 per instruction of the candidate program
pub fn score_world(w: &World, program_len: usize) -> Score {
    let n = w.creatures.len().max(1) as f64;
    let arrived = w.arrived() as f64 / n;
    let progress = w
        .creatures
        .iter()
        .map(|c| {
            if c.state == CreatureState::Out {
                return 1.0;
            }
            let now = w.exit_distance(c.x, c.y);
            if c.start_dist <= 0 || now < 0 {
                return 0.0;
            }
            (1.0 - now as f64 / c.start_dist as f64).clamp(0.0, 1.0)
        })
        .sum::<f64>()
        / n;
    let stations = w.stations.len();
    let (solved, closeness, read) = if stations == 0 {
        (0.0, 0.0, 0.0)
    } else {
        let read = w.stations.iter().filter(|s| s.read).count() as f64 / stations as f64;
        let solved = w.stations.iter().filter(|s| s.solved).count() as f64 / stations as f64;
        let closeness = w
            .stations
            .iter()
            .map(|s| match (s.solved, s.best_err) {
                (true, _) => 1.0,
                (false, i64::MAX) => 0.0,
                (false, e) => 1.0 / (1.0 + (1.0 + e as f64).log2()),
            })
            .sum::<f64>()
            / stations as f64;
        (solved, closeness, read)
    };
    let food = (w.food_eaten as f64 / n).min(1.0);
    // A stalled world ended early only to save time: score the full limit.
    let ticks = if w.stalled { w.params.ticks } else { w.tick };
    let ticks_frac = ticks as f64 / w.params.ticks.max(1) as f64;
    let fitness = 1000.0 * arrived + 200.0 * solved + 100.0 * progress + 50.0 * closeness + 50.0 * food
        + 30.0 * read
        - 20.0 * ticks_frac
        - 0.5 * program_len as f64;
    Score { fitness, arrived_frac: arrived, solved_frac: solved, ticks_used: ticks }
}

/// Mean score over `seeds`. `programs[0]` is the candidate; a mixed course
/// adds its fixed partner program itself.
pub fn evaluate(course: usize, programs: &[Program], seeds: &[u64]) -> Score {
    let len = programs.first().map_or(0, |p| p.instructions.len());
    let mut total = Score::default();
    for &seed in seeds {
        let s = score_world(&run_world(course, programs, seed), len);
        total.fitness += s.fitness;
        total.arrived_frac += s.arrived_frac;
        total.solved_frac += s.solved_frac;
        total.ticks_used += s.ticks_used;
    }
    let k = seeds.len().max(1) as f64;
    Score {
        fitness: total.fitness / k,
        arrived_frac: total.arrived_frac / k,
        solved_frac: total.solved_frac / k,
        ticks_used: (total.ticks_used as f64 / k).round() as u32,
    }
}

/// Verified: at least 80% of the swarm out on every validation seed.
pub fn verify(course: usize, programs: &[Program]) -> bool {
    let _ = courses();
    VALIDATION_SEEDS.iter().all(|&seed| {
        let w = run_world(course, programs, seed);
        w.arrived() as f64 >= VERIFY_ARRIVED * w.creatures.len() as f64
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::reference;

    fn reference(course: usize) -> Program {
        Program::parse(reference::program_for(course).expect("every course has a reference program")).unwrap()
    }

    #[test]
    fn reference_programs_parse() {
        for i in 0..courses().len() {
            reference(i);
        }
    }

    #[test]
    fn reference_programs_verify_every_course() {
        for (i, c) in courses().iter().enumerate() {
            assert!(verify(i, &[reference(i)]), "reference program for '{}' does not verify", c.name);
        }
    }

    #[test]
    fn empty_program_scores_below_reference() {
        for i in 0..courses().len() {
            let empty = evaluate(i, &[Program::default()], &TRAIN_SEEDS);
            let good = evaluate(i, &[reference(i)], &TRAIN_SEEDS);
            assert!(good.fitness > empty.fitness + 500.0, "course {}: {} vs {}", i, good.fitness, empty.fitness);
            assert_eq!(empty.arrived_frac, 0.0);
        }
    }

    #[test]
    fn relay_reference_fails_without_tell() {
        let course = courses().iter().position(|c| c.name == "Relay").expect("relay course");
        let p = reference(course);
        assert!(verify(course, &[p.clone()]));
        let with = evaluate(course, &[p.clone()], &TRAIN_SEEDS);
        let without = TRAIN_SEEDS
            .iter()
            .map(|&seed| {
                let mut w = World::new(course, seed, vec![p.clone()]);
                w.flags.tell = false;
                while !w.done() {
                    w.step();
                }
                w.arrived()
            })
            .sum::<usize>();
        assert_eq!(without, 0, "nobody gets out when the answer can't be told");
        assert!(with.arrived_frac >= 0.8);
    }

    #[test]
    fn progress_rewards_getting_closer() {
        // Walk toward the exit for 5 ticks, then stop (the loop count runs out).
        let partial = Program::parse("mov $10,5\nmov $11,7\nmov $1,5\nsub $1,$2\nmax $1,0\nmin $1,1\nlpb $1\n  f11 $0,$10\n  add $2,1\nlpe").unwrap();
        let empty = evaluate(0, &[Program::default()], &TRAIN_SEEDS);
        let some = evaluate(0, &[partial], &TRAIN_SEEDS);
        assert_eq!(some.arrived_frac, 0.0);
        assert!(some.fitness > empty.fitness + 5.0, "{} vs {}", some.fitness, empty.fitness);
    }

    #[test]
    fn reading_the_task_scores_higher_than_standing_there() {
        let stand = Program::parse("mov $10,5\nmov $11,4\nf11 $0,$10").unwrap();
        let read = Program::parse("mov $10,5\nmov $11,4\nf11 $0,$10\nmov $12,8\nf05 $1,$12").unwrap();
        let a = evaluate(3, &[stand], &TRAIN_SEEDS);
        let b = evaluate(3, &[read], &TRAIN_SEEDS);
        assert!(b.fitness > a.fitness + 10.0, "{} vs {}", b.fitness, a.fitness);
    }

    #[test]
    fn closer_answers_score_higher() {
        let w0 = World::new(3, TRAIN_SEEDS[0], vec![Program::default()]);
        let truth = w0.stations[0].truth().unwrap();
        let submit = |answer: i64| {
            Program::parse(&format!("mov $10,5\nmov $11,4\nf11 $0,$10\nmov $12,9\nmov $13,{}\nf11 $1,$12", answer)).unwrap()
        };
        let near = evaluate(3, &[submit(truth + 1)], &TRAIN_SEEDS[..1]);
        let far = evaluate(3, &[submit(truth + 1000)], &TRAIN_SEEDS[..1]);
        assert!(near.fitness > far.fitness);
    }

    #[test]
    fn memorised_answer_fails_validation() {
        let w0 = World::new(4, TRAIN_SEEDS[0], vec![Program::default()]);
        let truth = w0.stations[0].truth().unwrap();
        // Solve with a constant, then head for the exit.
        let text = format!(
            "mov $10,5\nmov $11,7\nf11 $0,$10\nmov $1,$0\nmul $1,-1\nlpb $1\n  mov $11,4\n  f11 $2,$10\n  mov $12,9\n  mov $13,{}\n  f11 $3,$12\nlpe",
            truth
        );
        let p = Program::parse(&text).unwrap();
        let trained = evaluate(4, &[p.clone()], &TRAIN_SEEDS[..1]);
        assert!(trained.arrived_frac >= VERIFY_ARRIVED, "solves the seed it memorised");
        assert!(!verify(4, &[p]), "but not the held-out seeds");
    }
}
