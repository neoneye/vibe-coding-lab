//! Tests for the world, pathfinding and the function registry.

use crate::course::{courses, CourseParams, TaskSpec, DEFAULT_PARAMS};
use crate::interp::EvalError;
use crate::program::Program;
use crate::registry::*;
use crate::rng::Rng;
use crate::world::*;

fn params(swarm: usize) -> CourseParams {
    CourseParams { swarm, ..DEFAULT_PARAMS }
}

fn world(map: &str, swarm: usize) -> World {
    World::from_map(map, params(swarm), 1, vec![Program::default()]).unwrap()
}

fn pos(w: &World, ci: usize) -> (u16, u16) {
    (w.creatures[ci].x, w.creatures[ci].y)
}

/// Calls a registry function for creature `ci`, as a fresh tick would.
fn call(w: &mut World, ci: usize, id: i64, args: &[i64]) -> Vec<i64> {
    w.creatures[ci].moved = false;
    w.call_function(ci, id, args).unwrap()
}

/// Returns the number of calls it took (the last one reports ARRIVED).
fn walk_until_arrived(w: &mut World, ci: usize, id: i64, args: &[i64], max: usize) -> usize {
    for i in 0..max {
        let s = call(w, ci, id, args)[0];
        if s == ARRIVED {
            return i + 1;
        }
        assert_ne!(s, BLOCKED, "blocked after {} steps at {:?}", i, pos(w, ci));
    }
    panic!("did not arrive within {} calls", max);
}

#[test]
fn bfs_goes_around_wall() {
    let map = "\
#######
#S.#..#
#..#..#
#.....#
#######";
    let mut w = world(map, 1);
    let steps = walk_until_arrived(&mut w, 0, WALK_TO_XY, &[5, 1], 20);
    assert_eq!(pos(&w, 0), (5, 1));
    assert_eq!(steps, 6, "around the wall through (3,3), no corner cutting at (3,2)");
}

#[test]
fn bfs_goes_around_creature() {
    let map = "\
#######
#.....#
#S.S..#
#.....#
#######";
    let mut w = world(map, 2);
    // creature ids follow the shuffled spawn order; find the one on the left.
    let left = if w.creatures[0].x == 1 { 0 } else { 1 };
    let right = 1 - left;
    assert_eq!(pos(&w, right), (3, 2));
    walk_until_arrived(&mut w, left, WALK_TO_XY, &[5, 2], 20);
    assert_eq!(pos(&w, left), (5, 2));
    assert_eq!(pos(&w, right), (3, 2), "the other creature never moved");
}

#[test]
fn walk_to_occupied_target_arrives_adjacent() {
    let map = "\
#######
#S...S#
#######";
    let mut w = world(map, 2);
    let (tx, ty) = pos(&w, 1);
    walk_until_arrived(&mut w, 0, WALK_TO_XY, &[tx as i64, ty as i64], 10);
    let (x, _) = pos(&w, 0);
    assert_eq!((x as i64 - tx as i64).abs(), 1);
}

#[test]
fn no_corner_cutting() {
    let map = "\
####
#S.#
##.#
####";
    let mut w = world(map, 1);
    // (1,1) -> (2,2) diagonally would squeeze past the wall at (1,2).
    let s = call(&mut w, 0, STEP, &[14]); // heading 315° = down-right
    assert_eq!(s[0], BLOCKED);
    assert_eq!(pos(&w, 0), (1, 1));
    let steps = walk_until_arrived(&mut w, 0, WALK_TO_XY, &[2, 2], 5);
    assert_eq!(steps, 2, "goes right then down");
}

#[test]
fn walk_to_xy_unreachable_is_blocked() {
    let map = "\
#######
#S.#..#
#######";
    let mut w = world(map, 1);
    assert_eq!(call(&mut w, 0, WALK_TO_XY, &[4, 1])[0], BLOCKED);
    assert_eq!(call(&mut w, 0, WALK_TO_XY, &[-5, 70000])[0], BLOCKED, "off-grid targets are blocked, not errors");
}

#[test]
fn step_heading_1_averages_22_5_degrees() {
    let map = format!("{}\n{}\n{}", "#".repeat(24), (0..12).map(|_| format!("#{}#", ".".repeat(22))).collect::<Vec<_>>().join("\n"), "#".repeat(24));
    let mut map = map.into_bytes();
    // spawn at (1, 10)
    let row_len = 25;
    map[10 * row_len + 1] = b'S';
    let mut w = world(std::str::from_utf8(&map).unwrap(), 1);
    for _ in 0..16 {
        assert_eq!(call(&mut w, 0, STEP, &[1])[0], MOVED);
    }
    let (x, y) = pos(&w, 0);
    let (dx, dy) = (x as i64 - 1, y as i64 - 10);
    assert!((dx - 15).abs() <= 1, "dx {}", dx);
    assert!((dy + 6).abs() <= 1, "dy {}", dy);
}

#[test]
fn step_heading_4_moves_up() {
    let map = "\
###
#.#
#S#
###";
    let mut w = world(map, 1);
    assert_eq!(call(&mut w, 0, STEP, &[4])[0], MOVED);
    assert_eq!(pos(&w, 0), (1, 1));
    assert_eq!(call(&mut w, 0, STEP, &[20])[0], BLOCKED, "20 mod 16 = 4, wall above");
}

#[test]
fn step_blocked_returns_minus_1() {
    let map = "\
###
#S#
###";
    let mut w = world(map, 1);
    for d in 0..16 {
        assert_eq!(call(&mut w, 0, STEP, &[d])[0], BLOCKED);
    }
}

#[test]
fn second_move_returns_minus_2() {
    let map = "\
#####
#S..#
#####";
    let mut w = world(map, 1);
    w.creatures[0].moved = false;
    assert_eq!(w.call_function(0, STEP, &[0]).unwrap()[0], MOVED);
    assert_eq!(w.call_function(0, STEP, &[0]).unwrap()[0], ALREADY_MOVED);
    assert_eq!(w.call_function(0, WALK_TO_XY, &[3, 1]).unwrap()[0], ALREADY_MOVED);
    assert_eq!(pos(&w, 0), (2, 1));
}

#[test]
fn exit_frees_cell_and_counts() {
    let map = "\
#####
#S.E#
#####";
    let mut w = world(map, 1);
    walk_until_arrived(&mut w, 0, WALK_TO_KIND, &[EXIT as i64], 5);
    assert_eq!(w.creatures[0].state, CreatureState::Out);
    assert_eq!(w.arrived(), 1);
    assert_eq!(w.kind_at(3, 1), EXIT);
    assert_eq!(w.kind_at(1, 1), EMPTY);
    assert_eq!(w.kind_at(2, 1), EMPTY);
}

#[test]
fn food_eaten_adds_energy() {
    let map = "\
#####
#SF.#
#####";
    let mut w = world(map, 1);
    let before = w.creatures[0].energy;
    assert_eq!(call(&mut w, 0, WALK_TO_KIND, &[FOOD as i64])[0], ARRIVED);
    assert_eq!(w.creatures[0].energy, before + DEFAULT_PARAMS.food_energy);
    assert_eq!(w.kind_at(2, 1), CREATURE);
    assert_eq!(w.food_eaten, 1);
    assert_eq!(call(&mut w, 0, WALK_TO_KIND, &[FOOD as i64])[0], BLOCKED, "no food left");
}

#[test]
fn exhausted_creature_blocks() {
    let map = "\
#######
#S.S..#
#######";
    let p = CourseParams { swarm: 2, energy: 3, ..DEFAULT_PARAMS };
    let mut w = World::from_map(map, p, 1, vec![Program::default()]).unwrap();
    for _ in 0..3 {
        w.step();
    }
    assert!(w.creatures.iter().all(|c| c.state == CreatureState::Exhausted));
    assert!(w.done());
    let left = if w.creatures[0].x == 1 { 0 } else { 1 };
    w.creatures[left].state = CreatureState::Active;
    w.creatures[left].energy = 100;
    assert_eq!(call(&mut w, left, WALK_TO_XY, &[5, 1])[0], MOVED, "queues up behind it");
    assert_eq!(call(&mut w, left, WALK_TO_XY, &[5, 1])[0], BLOCKED, "the exhausted creature still fills the corridor");
    assert_eq!(pos(&w, left), (2, 1));
}

#[test]
fn walk_to_kind_station_arrives_adjacent() {
    let map = "\
#######
#S...P#
#######";
    let p = CourseParams { swarm: 1, task: TaskSpec { degree: 1, coef: (0, 9), x: (1, 1), tol: 0 }, ..DEFAULT_PARAMS };
    let mut w = World::from_map(map, p, 1, vec![Program::default()]).unwrap();
    walk_until_arrived(&mut w, 0, WALK_TO_KIND, &[STATION as i64], 10);
    assert_eq!(pos(&w, 0), (4, 1));
}

#[test]
fn walk_from_nearest_creature_increases_distance() {
    let map = "\
#######
#.SS..#
#######";
    let mut w = world(map, 2);
    let right = if w.creatures[0].x == 3 { 0 } else { 1 };
    assert_eq!(call(&mut w, right, WALK_FROM_NEAREST_CREATURE, &[])[0], MOVED);
    assert_eq!(pos(&w, right), (4, 1));
    call(&mut w, right, WALK_FROM_NEAREST_CREATURE, &[]);
    assert_eq!(pos(&w, right), (5, 1));
    assert_eq!(call(&mut w, right, WALK_FROM_NEAREST_CREATURE, &[])[0], BLOCKED, "cornered");
}

#[test]
fn walk_to_nearest_creature_arrives_adjacent() {
    let map = "\
########
#S....S#
########";
    let mut w = world(map, 2);
    walk_until_arrived(&mut w, 0, WALK_TO_NEAREST_CREATURE, &[], 10);
    let d = (w.creatures[0].x as i64 - w.creatures[1].x as i64).abs();
    assert_eq!(d, 1);
}

#[test]
fn sense_nearest_returns_id_and_distance() {
    let map = "\
#########
#S..F..E#
#########";
    let mut w = world(map, 1);
    let out = call(&mut w, 0, SENSE_NEAREST, &[FOOD as i64]);
    assert_eq!(out[1], 3);
    assert_eq!(w.position_of(out[0]), Some((4, 1)));
    let out = call(&mut w, 0, SENSE_NEAREST, &[EXIT as i64]);
    assert_eq!(out[1], 6);
    assert_eq!(call(&mut w, 0, SENSE_NEAREST, &[CREATURE as i64]), vec![-1, -1], "no other creature");
    assert_eq!(call(&mut w, 0, SENSE_NEAREST, &[42]), vec![-1, -1]);
}

#[test]
fn walk_to_id_follows_creature() {
    let map = "\
########
#S....S#
########";
    let mut w = world(map, 2);
    let target = w.creatures[1].id as i64;
    walk_until_arrived(&mut w, 0, WALK_TO_ID, &[target], 10);
    assert_eq!((w.creatures[0].x as i64 - w.creatures[1].x as i64).abs(), 1);
    assert_eq!(call(&mut w, 0, WALK_TO_ID, &[12345])[0], BLOCKED);
    let me = w.creatures[0].id as i64;
    assert_eq!(call(&mut w, 0, WALK_TO_ID, &[me])[0], ARRIVED, "walking to yourself");
}

fn gate_world(task: TaskSpec, seed: u64) -> World {
    let map = "\
#######
#S.P.G#
#....GE
#######";
    let p = CourseParams { swarm: 1, task, ..DEFAULT_PARAMS };
    World::from_map(map, p, seed, vec![Program::default()]).unwrap()
}

#[test]
fn read_task_and_submit_open_gate() {
    let mut w = gate_world(TaskSpec { degree: 2, coef: (-9, 9), x: (-9, 9), tol: 0 }, 5);
    assert_eq!(call(&mut w, 0, READ_TASK, &[]), vec![0, 0, 0, 0, 0], "not adjacent yet");
    assert_eq!(call(&mut w, 0, SUBMIT_ANSWER, &[0])[0], -1);
    call(&mut w, 0, STEP, &[0]);
    let t = call(&mut w, 0, READ_TASK, &[]);
    assert_eq!(t[4], 0, "degree 2 leaves a3 = 0");
    let truth = t[1] + t[2] * t[0] + t[3] * t[0] * t[0];
    assert_eq!(call(&mut w, 0, READ_TASK, &[]), t, "the task is fixed for the seed");
    assert_eq!(call(&mut w, 0, SUBMIT_ANSWER, &[truth + 1])[0], 0);
    assert_eq!(w.kind_at(5, 1), GATE);
    assert_eq!(call(&mut w, 0, SUBMIT_ANSWER, &[truth])[0], 1);
    assert_eq!(w.kind_at(3, 1), STATION_SOLVED);
    assert_eq!(w.kind_at(5, 1), EMPTY);
    assert_eq!(w.kind_at(5, 2), EMPTY);
    assert_eq!(call(&mut w, 0, SUBMIT_ANSWER, &[truth])[0], -1, "solved stations take no answers");
}

#[test]
fn submit_outside_tolerance_records_best_err() {
    let mut w = gate_world(TaskSpec { degree: 1, coef: (0, 9), x: (1, 1), tol: 2 }, 3);
    call(&mut w, 0, STEP, &[0]);
    let t = call(&mut w, 0, READ_TASK, &[]);
    let truth = t[1] + t[2];
    assert_eq!(call(&mut w, 0, SUBMIT_ANSWER, &[truth + 10])[0], 0);
    assert_eq!(w.stations[0].best_err, 10);
    assert_eq!(call(&mut w, 0, SUBMIT_ANSWER, &[truth + 5])[0], 0);
    assert_eq!(w.stations[0].best_err, 5);
    assert_eq!(call(&mut w, 0, SUBMIT_ANSWER, &[truth - 2])[0], 1, "within tolerance 2");
    assert_eq!(w.stations[0].best_err, 2);
}

#[test]
fn stations_differ_between_seeds() {
    let spec = TaskSpec { degree: 2, coef: (-9, 9), x: (-9, 9), tol: 0 };
    let params: Vec<[i64; 5]> = (0..8).map(|s| gate_world(spec, s).stations[0].params).collect();
    assert!(params.windows(2).any(|p| p[0] != p[1]));
}

#[test]
fn give_food_transfers_energy() {
    let map = "\
######
#SS..#
######";
    let mut w = world(map, 2);
    w.creatures[0].energy = 50;
    w.creatures[1].energy = 10;
    assert_eq!(call(&mut w, 0, GIVE_FOOD, &[20]), vec![20]);
    assert_eq!((w.creatures[0].energy, w.creatures[1].energy), (30, 30));
    assert_eq!(call(&mut w, 0, GIVE_FOOD, &[1000]), vec![29], "keeps 1 for itself");
    assert_eq!(call(&mut w, 0, GIVE_FOOD, &[-5]), vec![0]);
}

#[test]
fn energy_and_position_functions() {
    let map = "\
#####
#..S#
#####";
    let mut w = world(map, 1);
    assert_eq!(call(&mut w, 0, MY_POSITION, &[]), vec![3, 1]);
    assert_eq!(call(&mut w, 0, MY_ENERGY, &[]), vec![DEFAULT_PARAMS.energy]);
}

#[test]
fn unknown_function_ends_tick() {
    let map = "\
#####
#S..#
#####";
    let mut w = world(map, 1);
    assert_eq!(w.call_function(0, 999, &[]), Err(EvalError::UnknownFunction(999)));
    // f11 calling my_position (an f02) is a signature mismatch
    let p = Program::parse("mov $10,0\nf11 $0,$10\nmov $1,1").unwrap();
    let mut w = World::from_map(map, params(1), 1, vec![p]).unwrap();
    w.step();
    assert_eq!(w.creatures[0].regs[1], 0);
    assert_eq!(w.creatures[0].last_error, Some(EvalError::SignatureMismatch(0)));
}

#[test]
fn programs_drive_creatures_through_step() {
    let p = Program::parse("mov $10,5\nmov $11,7\nf11 $0,$10").unwrap();
    let mut w = World::new(0, 1, vec![p]);
    while !w.done() {
        w.step();
    }
    assert_eq!(w.arrived(), w.creatures.len());
    assert!(w.tick < 60);
}

#[test]
fn spawn_capped_to_spawn_cells() {
    let map = "\
#####
#SS.#
#####";
    let w = world(map, 12);
    assert_eq!(w.creatures.len(), 2);
}

#[test]
fn bad_maps_rejected() {
    assert!(World::from_map("###\n#S\n###", params(1), 1, vec![Program::default()]).is_err(), "ragged rows");
    assert!(World::from_map("###\n#X#\n###", params(1), 1, vec![Program::default()]).is_err(), "unknown char");
    assert!(World::from_map("###\n#.#\n###", params(1), 1, vec![Program::default()]).is_err(), "no spawn");
}

/// A random (valid) program biased toward registry calls.
fn random_program_for_tests(rng: &mut Rng) -> Program {
    let mut lines = Vec::new();
    for _ in 0..rng.range_i64(2, 12) {
        let r = rng.range_i64(0, 9);
        let line = match rng.below(4) {
            0 => format!("mov ${},{}", r, rng.range_i64(0, 11)),
            1 => format!("add ${},{}", r, rng.range_i64(-3, 16)),
            2 => {
                let f = &FUNCTIONS[rng.below(FUNCTIONS.len() as u64) as usize];
                let src = rng.range_i64(0, 5);
                lines.push(format!("mov ${},{}", src, f.id));
                for k in 1..=f.inputs as i64 {
                    lines.push(format!("mov ${},{}", src + k, rng.range_i64(-2, 16)));
                }
                format!("f{}{} ${},${}", f.inputs, f.outputs, rng.range_i64(0, 6), src)
            }
            _ => format!("mul ${},{}", r, rng.range_i64(-2, 3)),
        };
        lines.push(line);
    }
    Program::parse(&lines.join("\n")).unwrap()
}

fn check_cells(w: &World) {
    let mut seen = std::collections::HashSet::new();
    for c in &w.creatures {
        if c.state == CreatureState::Out {
            continue;
        }
        assert!(seen.insert((c.x, c.y)), "two creatures at {:?}", (c.x, c.y));
        assert_eq!(w.kind_at(c.x, c.y), CREATURE);
        assert_eq!(w.id_at(c.x, c.y), c.id);
    }
    let creature_cells = w.kind.iter().filter(|&&k| k == CREATURE).count();
    assert_eq!(creature_cells, seen.len());
}

#[test]
fn no_shared_cells_random_programs() {
    let mut rng = Rng::new(99);
    for course in [2usize, 3, 6] {
        for _ in 0..30 {
            let p = random_program_for_tests(&mut rng);
            for seed in 0..2 {
                let mut w = World::new(course, seed, vec![p.clone()]);
                while !w.done() {
                    w.step();
                    check_cells(&w);
                }
            }
        }
    }
}

#[test]
fn deterministic_for_seed() {
    let p = Program::parse("mov $10,1\nmov $11,$0\nadd $11,3\nmod $11,16\nf11 $0,$10\nmov $10,4\nf01 $1,$10").unwrap();
    let run = |seed| {
        let mut w = World::new(1, seed, vec![p.clone()]);
        for _ in 0..100 {
            w.step();
        }
        w.creatures.iter().map(|c| (c.x, c.y, c.state)).collect::<Vec<_>>()
    };
    assert_eq!(run(7), run(7));
    assert_ne!(run(7), run(8));
}

#[test]
fn every_course_map_parses() {
    for (i, c) in courses().iter().enumerate() {
        let w = World::new(i, 1, vec![Program::default(), Program::default()]);
        assert_eq!(w.creatures.len(), c.params.swarm, "{}: swarm fits spawn cells", c.name);
        assert!(w.kind.contains(&EXIT), "{}: has an exit", c.name);
        for s in &w.stations {
            assert!(!s.gates.is_empty() || !w.kind.contains(&GATE), "{}: gates linked", c.name);
        }
        assert!(w.creatures.iter().all(|cr| w.exit_distance(cr.x, cr.y) > 0), "{}: exit reachable ignoring gates", c.name);
    }
}

#[test]
fn creatures_queue_through_a_one_cell_corridor() {
    // Without queueing, the follower sees no path while the leader is in the
    // corridor and only starts once it has left.
    let map = "\
###########
#SS......E#
###########";
    let p = Program::parse(crate::reference::EXIT).unwrap();
    let mut w = World::from_map(map, params(2), 1, vec![p]).unwrap();
    for _ in 0..10 {
        w.step();
    }
    assert_eq!(w.arrived(), 2);
}

#[test]
fn queueing_never_steps_into_a_creature() {
    let map = "\
#####
#SSE#
#####";
    let mut w = world(map, 2);
    let back = if w.creatures[0].x == 1 { 0 } else { 1 };
    assert_eq!(call(&mut w, back, WALK_TO_KIND, &[EXIT as i64])[0], BLOCKED, "waits behind the leader");
    assert_eq!(pos(&w, back), (1, 1));
}
