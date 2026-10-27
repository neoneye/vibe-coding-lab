//! Obstacle courses: ASCII maps plus parameters.
//!
//! Map characters: `#` wall, `.` empty, `S` spawn cell, `E` exit, `F` food,
//! `P` problem station, `G` gate (linked to the nearest `P`), `T` tablet
//! (shows the task of the nearest `P`).

use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TaskSpec {
    /// Highest power of x in `a0 + a1·x + a2·x² + a3·x³`.
    pub degree: u8,
    /// Inclusive coefficient range.
    pub coef: (i64, i64),
    /// Inclusive range for x.
    pub x: (i64, i64),
    /// Accepted when `|answer − truth| ≤ tol`.
    pub tol: i64,
}

pub const NO_TASK: TaskSpec = TaskSpec { degree: 0, coef: (0, 0), x: (0, 0), tol: 0 };

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CourseParams {
    pub swarm: usize,
    pub energy: i64,
    pub food_energy: i64,
    pub ticks: u32,
    pub task: TaskSpec,
    /// When set, pathfinding and sensing only see this far (Chebyshev).
    pub sense_radius: Option<u16>,
    /// When set, odd-indexed creatures run this fixed program instead of the
    /// candidate (exchange iteration 3).
    pub mix: Option<&'static str>,
}

pub const DEFAULT_PARAMS: CourseParams = CourseParams {
    swarm: 12,
    energy: 10_000,
    food_energy: 60,
    ticks: 100,
    task: NO_TASK,
    sense_radius: None,
    mix: None,
};

#[derive(Clone, Debug)]
pub struct Course {
    pub name: &'static str,
    pub description: &'static str,
    /// How far evolution gets on this course (measured with
    /// `examples/evolve`, library-seeded, courses in order).
    pub evolution: &'static str,
    pub map: &'static str,
    pub params: CourseParams,
}

const OPEN_FIELD: &str = "\
################################
#..............................#
#..............................#
#SSSS..........................#
#SSSS..........................#
#SSSS..........................#
#SSSS.........................E#
#SSSS..........................#
#SSSS..........................#
#..............................#
#..............................#
################################";

const WALL: &str = "\
################################
#..............................#
#SSSS..........#...............#
#SSSS..........#...............#
#SSSS..........#...............#
#SSSS..........#...............#
#SSSS..........#...............#
#SSSS..........#...............#
#..............#...............#
#..............#..............E#
#..............#...............#
################################";

const CORRIDOR: &str = "\
################################
#........#############.........#
#SSSS....#############.........#
#SSSS....#############.........#
#SSSS....#############.........#
#SSSS..........................#
#SSSS....#############........E#
#SSSS....#############.........#
#........#############.........#
#........#############.........#
#........#############.........#
################################";

const GATE: &str = "\
################################
#..................#...........#
#SSSS..............#...........#
#SSSS..............#...........#
#SSSS..............#...........#
#SSSS.......P......G..........E#
#SSSS..............G...........#
#SSSS..............#...........#
#..................#...........#
#..................#...........#
#..................#...........#
################################";

const FOOD: &str = "\
########################################
#.....FFFFFFFF.........................#
#.....FFFFFFFF.........................#
#......................................#
#......................................#
#SSSS..................................#
#SSSS..................................#
#SSSS.................................E#
#SSSS..................................#
#SSSS..................................#
#......................................#
########################################";

const RELAY: &str = "\
################################
#SSSS...#...SSSS.....#.........#
#SSSS...#...SSSS.....#.........#
#SSSS...#...SSSS.....#.........#
#.......#............#.........#
#......T#P...........G........E#
#.......#............G.........#
#.......#............#.........#
#.......##############.........#
#.......G......................#
######################.........#
################################";

const FOG_MAZE: &str = "\
###############################
#SSSS.....#.....#.....#.#.....#
#SSSS.###.###.#.###.#.#.#.#.#.#
#SSSS...#...........#.#.....#.#
#.###.#.#####.###.###.#####.#.#
#.#...#.....#.......#.....#.#.#
#.###.#.#.#.#.#.###.#####.#.###
#.#...#...#...#.....#.....#...#
#.#.###.#########.#.#.#####.#.#
#...#........................E#
###############################";

fn build_courses() -> Vec<Course> {
    let gate_task = |degree, coef, x| TaskSpec { degree, coef, x, tol: 0 };
    vec![
        Course {
            name: "Open field",
            description: "Get the swarm from the spawn area to the exit.",
            evolution: "Evolution verifies this in the first generation.",
            map: OPEN_FIELD,
            params: DEFAULT_PARAMS,
        },
        Course {
            name: "Wall",
            description: "The exit is behind a wall with one opening.",
            evolution: "Evolution verifies this within a few generations.",
            map: WALL,
            params: DEFAULT_PARAMS,
        },
        Course {
            name: "Corridor",
            description: "A one-cell corridor: the swarm has to queue without jamming.",
            evolution: "Evolution verifies this within a few generations.",
            map: CORRIDOR,
            params: DEFAULT_PARAMS,
        },
        Course {
            name: "Gate: sum",
            description: "A gate blocks the exit. Solve the station's task a0 + a1 (x = 1) to open it.",
            evolution: "Evolution verifies this in roughly 10–70 generations.",
            map: GATE,
            params: CourseParams { task: gate_task(1, (0, 99), (1, 1)), ..DEFAULT_PARAMS },
        },
        Course {
            name: "Gate: line",
            description: "Open the gate by evaluating a0 + a1·x.",
            evolution: "Evolution has not verified this yet (600 generations): its best program multiplies by repeated addition, which only works for x ≥ 0. The reference program shows it is solvable.",
            map: GATE,
            params: CourseParams { task: gate_task(1, (-9, 9), (-9, 9)), ..DEFAULT_PARAMS },
        },
        Course {
            name: "Gate: quadratic",
            description: "Open the gate by evaluating a0 + a1·x + a2·x².",
            evolution: "Evolution has not verified this yet; the reference program shows it is solvable.",
            map: GATE,
            params: CourseParams { task: gate_task(2, (-9, 9), (-9, 9)), ..DEFAULT_PARAMS },
        },
        Course {
            name: "Food",
            description: "Too little energy to reach the exit: eat on the way (or be fed).",
            evolution: "Evolution verifies this in roughly 2–60 generations.",
            map: FOOD,
            params: CourseParams { energy: 25, food_energy: 60, ..DEFAULT_PARAMS },
        },
        Course {
            name: "Relay",
            description: "The task is on a tablet (≡) in the left chamber; the station that takes the answer is behind the wall. Tell the answer across.",
            evolution: "Evolution has not verified this yet; the reference program shows it is solvable.",
            map: RELAY,
            params: CourseParams { task: TaskSpec { degree: 2, coef: (1, 9), x: (1, 9), tol: 0 }, ..DEFAULT_PARAMS },
        },
        Course {
            name: "Fog maze",
            description: "Creatures only see what they could walk to in 4 steps. Marks left on cells are the swarm's shared memory of where it has been.",
            evolution: "Evolution sometimes verifies this (seen at generation 10 when seeded from the library), but not in every run.",
            map: FOG_MAZE,
            params: CourseParams { sense_radius: Some(4), ticks: 400, ..DEFAULT_PARAMS },
        },
        Course {
            name: "Teach",
            description: "Half the swarm runs a fixed program that wanders and never eats. Teach them your program before they run out of energy.",
            evolution: "Evolution verifies this within a few generations when seeded from the library.",
            map: FOOD,
            params: CourseParams { energy: 25, food_energy: 60, mix: Some(crate::reference::WANDERER), ..DEFAULT_PARAMS },
        },
    ]
}

pub fn courses() -> &'static [Course] {
    static COURSES: OnceLock<Vec<Course>> = OnceLock::new();
    COURSES.get_or_init(build_courses)
}
