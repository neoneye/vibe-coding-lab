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

fn build_courses() -> Vec<Course> {
    let gate_task = |degree, coef, x| TaskSpec { degree, coef, x, tol: 0 };
    vec![
        Course {
            name: "Open field",
            description: "Get the swarm from the spawn area to the exit.",
            map: OPEN_FIELD,
            params: DEFAULT_PARAMS,
        },
        Course {
            name: "Wall",
            description: "The exit is behind a wall with one opening.",
            map: WALL,
            params: DEFAULT_PARAMS,
        },
        Course {
            name: "Corridor",
            description: "A one-cell corridor: the swarm has to queue without jamming.",
            map: CORRIDOR,
            params: DEFAULT_PARAMS,
        },
        Course {
            name: "Gate: sum",
            description: "A gate blocks the exit. Solve the station's task a0 + a1 (x = 1) to open it.",
            map: GATE,
            params: CourseParams { task: gate_task(1, (0, 9), (1, 1)), ..DEFAULT_PARAMS },
        },
        Course {
            name: "Gate: line",
            description: "Open the gate by evaluating a0 + a1·x.",
            map: GATE,
            params: CourseParams { task: gate_task(1, (-9, 9), (-9, 9)), ..DEFAULT_PARAMS },
        },
        Course {
            name: "Gate: quadratic",
            description: "Open the gate by evaluating a0 + a1·x + a2·x².",
            map: GATE,
            params: CourseParams { task: gate_task(2, (-9, 9), (-9, 9)), ..DEFAULT_PARAMS },
        },
        Course {
            name: "Food",
            description: "Too little energy to reach the exit: eat on the way (or be fed).",
            map: FOOD,
            params: CourseParams { energy: 25, food_energy: 60, ..DEFAULT_PARAMS },
        },
    ]
}

pub fn courses() -> &'static [Course] {
    static COURSES: OnceLock<Vec<Course>> = OnceLock::new();
    COURSES.get_or_init(build_courses)
}
