//! The grid world: cells, creatures, stations, and one tick of simulation.

use crate::course::{courses, CourseParams, TaskSpec};
use crate::interp::{self, EvalError, Host, INSTRUCTION_CAP};
use crate::path::{self, Grid, PathResult, Scratch, NEIGHBOURS};
use crate::program::Program;
use crate::registry::*;
use crate::rng::Rng;

pub const EMPTY: u8 = 0;
pub const WALL: u8 = 1;
pub const CREATURE: u8 = 2;
pub const FOOD: u8 = 3;
pub const STATION: u8 = 4;
pub const STATION_SOLVED: u8 = 5;
pub const GATE: u8 = 6;
pub const EXIT: u8 = 7;
/// Shows the task of the nearest station (which then shows nothing itself).
pub const TABLET: u8 = 8;
/// Radius of `tell`.
pub const TELL_RADIUS: i32 = 3;

/// A world where nothing changed (no move, no cell, no register) for this
/// many ticks in a row is stalled: it can't change again, so it ends early
/// and is scored as if it ran to the tick limit.
pub const IDLE_LIMIT: u32 = 25;

/// What a cached distance field leads to.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum FieldKey {
    /// onto this cell
    Cell(usize),
    /// next to this cell
    Near(usize),
    /// onto any cell of this kind
    Kind(u8),
    /// next to any cell of this kind
    NearKind(u8),
}

/// Unit vectors ×1024 for headings 0..15 (22.5° steps, counter-clockwise,
/// 0 = +x, 4 = up on screen).
const HEADINGS: [(i32, i32); 16] = [
    (1024, 0),
    (946, -392),
    (724, -724),
    (392, -946),
    (0, -1024),
    (-392, -946),
    (-724, -724),
    (-946, -392),
    (-1024, 0),
    (-946, 392),
    (-724, 724),
    (-392, 946),
    (0, 1024),
    (392, 946),
    (724, 724),
    (946, 392),
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CreatureState {
    Active,
    /// Left through an exit.
    Out,
    /// Ran out of energy; stays on its cell as an obstacle.
    Exhausted,
}

#[derive(Clone, Debug)]
pub struct Creature {
    pub id: u32,
    pub x: u16,
    pub y: u16,
    pub regs: [i64; 16],
    pub energy: i64,
    pub state: CreatureState,
    pub moved: bool,
    /// Sub-cell offset from the cell centre, ×1024, used by `step`.
    pub acc: (i32, i32),
    /// Index into `World::programs`.
    pub prog: usize,
    pub last_status: i64,
    pub last_error: Option<EvalError>,
    /// Path distance to the exit at spawn (walls only).
    pub start_dist: i32,
}

#[derive(Clone, Debug)]
pub struct Station {
    pub id: u32,
    pub x: u16,
    pub y: u16,
    /// x, a0, a1, a2, a3
    pub params: [i64; 5],
    pub tol: i64,
    pub solved: bool,
    /// Smallest |answer − truth| submitted so far (i64::MAX = none).
    pub best_err: i64,
    /// Cell indices of the gates this station opens.
    pub gates: Vec<usize>,
    /// Creatures that answered wrong; each creature gets one guess.
    pub locked: Vec<u32>,
    /// Some creature has read the task.
    pub read: bool,
    /// The task is shown on a tablet, not at the station.
    pub has_tablet: bool,
}

impl Station {
    pub fn truth(&self) -> Option<i64> {
        let [x, a0, a1, a2, a3] = self.params;
        let x2 = x.checked_mul(x)?;
        let x3 = x2.checked_mul(x)?;
        a0.checked_add(a1.checked_mul(x)?)?.checked_add(a2.checked_mul(x2)?)?.checked_add(a3.checked_mul(x3)?)
    }
}

/// Switches for the exchange mechanisms, so tests can compare a program with
/// and without one.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Flags {
    pub tell: bool,
    pub marks: bool,
    pub teach: bool,
}

impl Default for Flags {
    fn default() -> Self {
        Flags { tell: true, marks: true, teach: true }
    }
}

/// A non-creature thing with an id: food, station, gate, exit.
#[derive(Clone, Debug)]
pub struct Thing {
    pub x: u16,
    pub y: u16,
    pub present: bool,
}

#[derive(Clone)]
pub struct World {
    pub w: u16,
    pub h: u16,
    pub kind: Vec<u8>,
    /// Id of the creature or thing in each cell (0 = none).
    pub ids: Vec<u32>,
    pub marks: Vec<i64>,
    pub creatures: Vec<Creature>,
    pub stations: Vec<Station>,
    /// Tablets: position and the index of the station whose task they show.
    pub tablets: Vec<(u16, u16, usize)>,
    /// Things by id; thing id = creatures.len() + 1 + index.
    pub things: Vec<Thing>,
    pub programs: Vec<Program>,
    pub params: CourseParams,
    pub flags: Flags,
    pub rng: Rng,
    pub tick: u32,
    pub food_total: u32,
    pub food_eaten: u32,
    /// Ended early because nothing could change any more.
    pub stalled: bool,
    /// Use cached distance fields for fixed goals (false = search per
    /// creature; kept for tests that compare the two).
    pub use_fields: bool,
    idle_ticks: u32,
    /// Bumped whenever a non-creature cell changes (food eaten, gate
    /// opened); goal fields are valid for one version.
    version: u64,
    /// Bumped on every creature move (for stall detection).
    moves: u64,
    fields: Vec<(FieldKey, u64, Vec<i32>)>,
    exit_dist: Vec<i32>,
    scratch: Scratch,
}

fn cheb(ax: i32, ay: i32, bx: i32, by: i32) -> i32 {
    (ax - bx).abs().max((ay - by).abs())
}

fn round_unit(v: i32) -> i32 {
    let r = (v.abs() + 512) / 1024;
    (r * v.signum()).clamp(-1, 1)
}

fn draw_task(rng: &mut Rng, t: &TaskSpec) -> [i64; 5] {
    let mut p = [0i64; 5];
    p[0] = rng.range_i64(t.x.0, t.x.1);
    for i in 0..=t.degree.min(3) as usize {
        p[1 + i] = rng.range_i64(t.coef.0, t.coef.1);
    }
    p
}

impl World {
    /// A world for course `course` (index into `courses()`).
    pub fn new(course: usize, seed: u64, programs: Vec<Program>) -> World {
        let c = &courses()[course];
        World::from_map(c.map, c.params, seed, programs).expect("course maps are valid")
    }

    pub fn from_map(map: &str, params: CourseParams, seed: u64, mut programs: Vec<Program>) -> Result<World, String> {
        let rows: Vec<&str> = map.lines().map(|l| l.trim_end_matches('\r')).collect();
        let h = rows.len();
        let w = rows.first().map_or(0, |r| r.len());
        if w == 0 || h == 0 || w > u16::MAX as usize || h > u16::MAX as usize {
            return Err("map size out of range".into());
        }
        if rows.iter().any(|r| r.len() != w) {
            return Err("map rows differ in length".into());
        }
        let mut kind = vec![EMPTY; w * h];
        let mut spawn = Vec::new();
        for (y, row) in rows.iter().enumerate() {
            for (x, ch) in row.bytes().enumerate() {
                let i = y * w + x;
                kind[i] = match ch {
                    b'#' => WALL,
                    b'.' => EMPTY,
                    b'S' => {
                        spawn.push(i);
                        EMPTY
                    }
                    b'E' => EXIT,
                    b'F' => FOOD,
                    b'P' => STATION,
                    b'G' => GATE,
                    b'T' => TABLET,
                    _ => return Err(format!("unknown map character '{}' at {},{}", ch as char, x, y)),
                };
            }
        }
        if spawn.is_empty() {
            return Err("map has no spawn cells".into());
        }
        if programs.is_empty() {
            programs.push(Program::default());
        }
        if let Some(mix) = params.mix {
            if programs.len() < 2 {
                programs.push(Program::parse(mix).map_err(|e| format!("mix program: {}", e))?);
            }
        }
        let mut rng = Rng::new(seed);
        rng.shuffle(&mut spawn);
        spawn.truncate(params.swarm);
        let n = spawn.len();
        let grid = Grid { w: w as u16, h: h as u16, kind: &kind };
        let exits: Vec<usize> = (0..kind.len()).filter(|&i| kind[i] == EXIT).collect();
        let exit_dist = path::distance_field(&grid, &exits);

        let mut ids = vec![0u32; w * h];
        let mut creatures = Vec::with_capacity(n);
        for (k, &i) in spawn.iter().enumerate() {
            let id = k as u32 + 1;
            kind[i] = CREATURE;
            ids[i] = id;
            creatures.push(Creature {
                id,
                x: (i % w) as u16,
                y: (i / w) as u16,
                regs: [0; 16],
                energy: params.energy,
                state: CreatureState::Active,
                moved: false,
                acc: (0, 0),
                prog: if params.mix.is_some() { k % 2 } else { 0 },
                last_status: 0,
                last_error: None,
                start_dist: exit_dist[i],
            });
        }
        let mut things = Vec::new();
        let mut stations = Vec::new();
        let mut gates = Vec::new();
        let mut tablet_cells = Vec::new();
        let mut food_total = 0;
        for i in 0..kind.len() {
            let k = kind[i];
            if !matches!(k, FOOD | STATION | GATE | EXIT | TABLET) {
                continue;
            }
            let id = (n + 1 + things.len()) as u32;
            let (x, y) = ((i % w) as u16, (i / w) as u16);
            ids[i] = id;
            things.push(Thing { x, y, present: true });
            match k {
                FOOD => food_total += 1,
                STATION => stations.push(Station {
                    id,
                    x,
                    y,
                    params: draw_task(&mut rng, &params.task),
                    tol: params.task.tol,
                    solved: false,
                    best_err: i64::MAX,
                    gates: Vec::new(),
                    locked: Vec::new(),
                    read: false,
                    has_tablet: false,
                }),
                GATE => gates.push(i),
                TABLET => tablet_cells.push(i),
                _ => {}
            }
        }
        let nearest_station = |stations: &[Station], i: usize| {
            let (x, y) = ((i % w) as i32, (i / w) as i32);
            (0..stations.len()).min_by_key(|&s| (cheb(x, y, stations[s].x as i32, stations[s].y as i32), s))
        };
        for g in gates {
            if let Some(s) = nearest_station(&stations, g) {
                stations[s].gates.push(g);
            }
        }
        let mut tablets = Vec::new();
        for t in tablet_cells {
            if let Some(s) = nearest_station(&stations, t) {
                stations[s].has_tablet = true;
                tablets.push(((t % w) as u16, (t / w) as u16, s));
            }
        }
        Ok(World {
            w: w as u16,
            h: h as u16,
            kind,
            ids,
            marks: vec![0; w * h],
            creatures,
            stations,
            tablets,
            things,
            programs,
            params,
            flags: Flags::default(),
            rng,
            tick: 0,
            food_total,
            food_eaten: 0,
            stalled: false,
            use_fields: true,
            idle_ticks: 0,
            version: 0,
            moves: 0,
            fields: Vec::new(),
            exit_dist,
            scratch: Scratch::default(),
        })
    }

    fn idx(&self, x: u16, y: u16) -> usize {
        y as usize * self.w as usize + x as usize
    }

    pub fn kind_at(&self, x: u16, y: u16) -> u8 {
        self.kind[self.idx(x, y)]
    }

    pub fn id_at(&self, x: u16, y: u16) -> u32 {
        self.ids[self.idx(x, y)]
    }

    /// Path distance to the nearest exit counting walls only (-1 = none).
    pub fn exit_distance(&self, x: u16, y: u16) -> i32 {
        self.exit_dist[self.idx(x, y)]
    }

    pub fn arrived(&self) -> usize {
        self.creatures.iter().filter(|c| c.state == CreatureState::Out).count()
    }

    pub fn done(&self) -> bool {
        self.stalled || self.tick >= self.params.ticks || !self.creatures.iter().any(|c| c.state == CreatureState::Active)
    }

    /// Current position of a creature on the grid or a present thing.
    pub fn position_of(&self, id: i64) -> Option<(u16, u16)> {
        let n = self.creatures.len() as i64;
        if id >= 1 && id <= n {
            let c = &self.creatures[(id - 1) as usize];
            return (c.state != CreatureState::Out).then_some((c.x, c.y));
        }
        let t = self.things.get(usize::try_from(id - n - 1).ok()?)?;
        (t.present && self.kind_at(t.x, t.y) != EMPTY).then_some((t.x, t.y))
    }

    /// One tick: every active creature runs its program once, in shuffled order.
    pub fn step(&mut self) {
        let mut order: Vec<usize> = (0..self.creatures.len()).filter(|&i| self.creatures[i].state == CreatureState::Active).collect();
        self.rng.shuffle(&mut order);
        let programs = std::mem::take(&mut self.programs);
        let version_before = (self.version, self.moves);
        let mut registers_changed = false;
        for ci in order {
            let c = &mut self.creatures[ci];
            if c.state != CreatureState::Active {
                continue;
            }
            c.energy -= 1;
            if c.energy <= 0 {
                c.energy = 0;
                c.state = CreatureState::Exhausted;
                continue;
            }
            c.moved = false;
            let mut regs = c.regs;
            let program = &programs[c.prog.min(programs.len() - 1)];
            let outcome = interp::run(program, &mut regs, &mut Ctx { world: self, me: ci }, INSTRUCTION_CAP);
            let c = &mut self.creatures[ci];
            registers_changed |= c.regs != regs;
            c.regs = regs;
            c.last_error = outcome.error;
        }
        self.programs = programs;
        self.tick += 1;
        let changed = registers_changed || (self.version, self.moves) != version_before;
        self.idle_ticks = if changed { 0 } else { self.idle_ticks + 1 };
        if self.idle_ticks >= IDLE_LIMIT && self.tick < self.params.ticks {
            self.stalled = true;
        }
    }

    /// Calls a registry function on behalf of creature `ci`.
    pub fn call_function(&mut self, ci: usize, id: i64, args: &[i64]) -> Result<Vec<i64>, EvalError> {
        let (inputs, outputs) = signature(id).ok_or(EvalError::UnknownFunction(id))?;
        if inputs as usize != args.len() {
            return Err(EvalError::SignatureMismatch(id));
        }
        let mut out = vec![0; outputs as usize];
        self.dispatch(ci, id, args, &mut out)?;
        Ok(out)
    }

    fn dispatch(&mut self, ci: usize, id: i64, args: &[i64], out: &mut [i64]) -> Result<(), EvalError> {
        if self.creatures[ci].state != CreatureState::Active {
            return Err(EvalError::Host("creature is not on the grid"));
        }
        let c = &self.creatures[ci];
        match id {
            MY_POSITION => {
                out[0] = c.x as i64;
                out[1] = c.y as i64;
            }
            MY_ENERGY => out[0] = c.energy,
            STEP => out[0] = self.do_step(ci, args[0]),
            WALK_TO_XY => out[0] = self.walk_to_xy(ci, args[0], args[1]),
            WALK_TO_NEAREST_CREATURE => out[0] = self.walk_to_kind(ci, CREATURE as i64),
            WALK_FROM_NEAREST_CREATURE => out[0] = self.walk_from_nearest_creature(ci),
            WALK_TO_KIND => out[0] = self.walk_to_kind(ci, args[0]),
            SENSE_NEAREST => {
                let (id, d) = self.sense_nearest(ci, args[0]);
                out[0] = id;
                out[1] = d;
            }
            WALK_TO_ID => {
                out[0] = match self.position_of(args[0]) {
                    Some((x, y)) => self.walk_to_xy(ci, x as i64, y as i64),
                    None => BLOCKED,
                }
            }
            READ_TASK => {
                if let Some(s) = self.readable_station(ci) {
                    self.stations[s].read = true;
                    out.copy_from_slice(&self.stations[s].params);
                }
            }
            TELL => out[0] = self.tell(ci, args[0]),
            SUBMIT_ANSWER => out[0] = self.submit_answer(ci, args[0]),
            GIVE_FOOD => out[0] = self.give_food(ci, args[0]),
            _ => return Err(EvalError::UnknownFunction(id)),
        }
        if matches!(id, STEP | WALK_TO_XY | WALK_TO_NEAREST_CREATURE | WALK_FROM_NEAREST_CREATURE | WALK_TO_KIND | WALK_TO_ID) {
            self.creatures[ci].last_status = out[0];
        }
        Ok(())
    }

    fn grid(&self) -> Grid<'_> {
        Grid { w: self.w, h: self.h, kind: &self.kind }
    }

    fn in_radius(&self, ci: usize, x: u16, y: u16) -> bool {
        let c = &self.creatures[ci];
        self.params.sense_radius.map_or(true, |r| cheb(c.x as i32, c.y as i32, x as i32, y as i32) <= r as i32)
    }

    /// Moves creature `ci` to an adjacent passable cell, eating food or
    /// leaving through an exit.
    fn move_to(&mut self, ci: usize, nx: u16, ny: u16) {
        let from = self.idx(self.creatures[ci].x, self.creatures[ci].y);
        let to = self.idx(nx, ny);
        self.kind[from] = EMPTY;
        self.ids[from] = 0;
        let food_energy = self.params.food_energy;
        let id = self.creatures[ci].id;
        let target_kind = self.kind[to];
        self.moves += 1;
        let c = &mut self.creatures[ci];
        c.moved = true;
        c.x = nx;
        c.y = ny;
        if target_kind == EXIT {
            c.state = CreatureState::Out;
            return;
        }
        if target_kind == FOOD {
            self.version += 1;
            c.energy += food_energy;
            self.food_eaten += 1;
            let n = self.creatures.len();
            let thing = self.ids[to] as usize - n - 1;
            self.things[thing].present = false;
        }
        self.kind[to] = CREATURE;
        self.ids[to] = id;
    }

    fn do_step(&mut self, ci: usize, d: i64) -> i64 {
        if self.creatures[ci].moved {
            return ALREADY_MOVED;
        }
        let (vx, vy) = HEADINGS[d.rem_euclid(16) as usize];
        let c = &self.creatures[ci];
        let (ax, ay) = (c.acc.0 + vx, c.acc.1 + vy);
        let (dx, dy) = (round_unit(ax), round_unit(ay));
        let (x, y) = (c.x as i32, c.y as i32);
        if !self.grid().can_move(x, y, dx, dy) {
            return BLOCKED;
        }
        self.move_to(ci, (x + dx) as u16, (y + dy) as u16);
        let c = &mut self.creatures[ci];
        c.acc = (ax - dx * 1024, ay - dy * 1024);
        if c.state == CreatureState::Out {
            ARRIVED
        } else {
            MOVED
        }
    }

    /// Cells where a walker arrives for `key`, counting cells that a
    /// creature stands on (it may move away).
    fn field_sources(&self, key: FieldKey) -> Vec<usize> {
        let w = self.w as usize;
        let near = |i: usize, pred: &dyn Fn(usize) -> bool| {
            let (x, y) = ((i % w) as i32, (i / w) as i32);
            NEIGHBOURS.iter().any(|&(dx, dy)| match self.grid().at(x + dx, y + dy) {
                Some(_) => pred((y + dy) as usize * w + (x + dx) as usize),
                None => false,
            })
        };
        (0..self.kind.len())
            .filter(|&i| path::passable(self.kind[i]) || self.kind[i] == CREATURE)
            .filter(|&i| match key {
                FieldKey::Cell(t) => i == t,
                FieldKey::Near(t) => i == t || near(i, &|j| j == t),
                FieldKey::Kind(k) => self.kind[i] == k,
                FieldKey::NearKind(k) => near(i, &|j| self.kind[j] == k),
            })
            .collect()
    }

    /// Index into `fields` of an up-to-date goal field (through creatures)
    /// for `key`.
    fn field(&mut self, key: FieldKey) -> usize {
        if let Some(i) = self.fields.iter().position(|f| f.0 == key && f.1 == self.version) {
            return i;
        }
        let sources = self.field_sources(key);
        let field = path::goal_field(&self.grid(), &sources, true);
        let entry = (key, self.version, field);
        if let Some(i) = self.fields.iter().position(|f| f.1 != self.version) {
            self.fields[i] = entry;
            return i;
        }
        if self.fields.len() >= 8 {
            self.fields.remove(0);
        }
        self.fields.push(entry);
        self.fields.len() - 1
    }

    /// A* guided by the goal field; queues behind other creatures when the
    /// only routes run through them.
    fn walk_field(&mut self, ci: usize, key: FieldKey, goal: &dyn Fn(&World, usize) -> bool) -> i64 {
        let f = self.field(key);
        let (x, y) = (self.creatures[ci].x as i32, self.creatures[ci].y as i32);
        let w = self.w as usize;
        let start = y as usize * w + x as usize;
        let mut scratch = std::mem::take(&mut self.scratch);
        let result = path::astar_first_step(&self.grid(), &mut scratch, (x as u16, y as u16), &|i| goal(self, i), &self.fields[f].2);
        self.scratch = scratch;
        match result {
            PathResult::Arrived => ARRIVED,
            PathResult::Step(nx, ny) => {
                let reached = goal(self, self.idx(nx, ny));
                self.move_to(ci, nx, ny);
                if reached || self.creatures[ci].state == CreatureState::Out {
                    ARRIVED
                } else {
                    MOVED
                }
            }
            PathResult::Blocked | PathResult::OverBudget => {
                // Queue: the downhill neighbour ignoring creatures, if free.
                let field = &self.fields[f].2;
                let here = field[start];
                let grid = self.grid();
                let best = NEIGHBOURS
                    .iter()
                    .filter(|&&(dx, dy)| grid.can_move_through(x, y, dx, dy, true))
                    .map(|&(dx, dy)| (field[(y + dy) as usize * w + (x + dx) as usize], dx, dy))
                    .filter(|&(d, _, _)| d >= 0 && (here < 0 || d < here))
                    .min_by_key(|&(d, _, _)| d);
                match best {
                    Some((d, dx, dy)) if self.kind_at((x + dx) as u16, (y + dy) as u16) != CREATURE => {
                        self.move_to(ci, (x + dx) as u16, (y + dy) as u16);
                        if d == 0 || self.creatures[ci].state == CreatureState::Out {
                            ARRIVED
                        } else {
                            MOVED
                        }
                    }
                    _ => BLOCKED,
                }
            }
        }
    }

    /// One step along a shortest path to a cell where `goal` holds. With a
    /// `key` (a goal that doesn't depend on who walks) and no sense radius,
    /// a cached distance field is used instead of a search.
    fn walk(&mut self, ci: usize, goal: &dyn Fn(&World, usize) -> bool, target: Option<(i32, i32)>, key: Option<FieldKey>) -> i64 {
        if self.creatures[ci].moved {
            return ALREADY_MOVED;
        }
        if let (Some(key), true, None) = (key, self.use_fields, self.params.sense_radius) {
            return self.walk_field(ci, key, goal);
        }
        let from = (self.creatures[ci].x, self.creatures[ci].y);
        let mut scratch = std::mem::take(&mut self.scratch);
        let radius = self.params.sense_radius;
        let mut result = path::first_step(&self.grid(), &mut scratch, from, &|i| goal(self, i), radius, false);
        if result == PathResult::Blocked {
            // No free path: plan through the other creatures and queue
            // behind them, moving only when the next cell is free.
            result = match path::first_step(&self.grid(), &mut scratch, from, &|i| goal(self, i), radius, true) {
                PathResult::Step(nx, ny) if self.kind_at(nx, ny) == CREATURE => PathResult::Blocked,
                PathResult::Arrived => PathResult::Blocked,
                r => r,
            };
        }
        self.scratch = scratch;
        match result {
            PathResult::Arrived => ARRIVED,
            PathResult::Step(nx, ny) => {
                let reached = goal(self, self.idx(nx, ny));
                self.move_to(ci, nx, ny);
                if reached || self.creatures[ci].state == CreatureState::Out {
                    ARRIVED
                } else {
                    MOVED
                }
            }
            PathResult::Blocked => BLOCKED,
            PathResult::OverBudget => match target {
                Some((tx, ty)) => self.greedy_step(ci, tx, ty),
                None => BLOCKED,
            },
        }
    }

    /// Fallback when the search budget runs out: any step that gets closer.
    fn greedy_step(&mut self, ci: usize, tx: i32, ty: i32) -> i64 {
        let (x, y) = (self.creatures[ci].x as i32, self.creatures[ci].y as i32);
        let here = cheb(x, y, tx, ty);
        let grid = self.grid();
        let best = NEIGHBOURS
            .iter()
            .filter(|&&(dx, dy)| grid.can_move(x, y, dx, dy))
            .map(|&(dx, dy)| (cheb(x + dx, y + dy, tx, ty), dx, dy))
            .min();
        match best {
            Some((d, dx, dy)) if d < here => {
                self.move_to(ci, (x + dx) as u16, (y + dy) as u16);
                if self.creatures[ci].state == CreatureState::Out || d == 0 {
                    ARRIVED
                } else {
                    MOVED
                }
            }
            _ => BLOCKED,
        }
    }

    fn walk_to_xy(&mut self, ci: usize, tx: i64, ty: i64) -> i64 {
        if tx < 0 || ty < 0 || tx >= self.w as i64 || ty >= self.h as i64 {
            return BLOCKED;
        }
        let (tx, ty) = (tx as i32, ty as i32);
        let ti = ty as usize * self.w as usize + tx as usize;
        let w = self.w as usize;
        if path::passable(self.kind[ti]) {
            self.walk(ci, &move |_, i| i == ti, Some((tx, ty)), Some(FieldKey::Cell(ti)))
        } else {
            self.walk(ci, &move |_, i| cheb((i % w) as i32, (i / w) as i32, tx, ty) <= 1, Some((tx, ty)), Some(FieldKey::Near(ti)))
        }
    }

    /// Walks to the nearest food/exit (onto it) or to the nearest
    /// station/creature (next to it).
    fn walk_to_kind(&mut self, ci: usize, k: i64) -> i64 {
        let start = self.idx(self.creatures[ci].x, self.creatures[ci].y);
        let w = self.w as usize;
        match k {
            k if k == FOOD as i64 || k == EXIT as i64 => {
                let k = k as u8;
                self.walk(ci, &move |world, i| world.kind[i] == k, None, Some(FieldKey::Kind(k)))
            }
            k if k == STATION as i64 || k == STATION_SOLVED as i64 || k == TABLET as i64 || k == CREATURE as i64 => {
                let k = k as u8;
                let goal = move |world: &World, i: usize| {
                    let (x, y) = ((i % w) as i32, (i / w) as i32);
                    NEIGHBOURS.iter().any(|&(dx, dy)| match world.grid().at(x + dx, y + dy) {
                        Some(kk) => kk == k && (y + dy) as usize * w + (x + dx) as usize != start,
                        None => false,
                    })
                };
                let key = if k == CREATURE { None } else { Some(FieldKey::NearKind(k)) };
                self.walk(ci, &goal, None, key)
            }
            _ => BLOCKED,
        }
    }

    fn other_creatures_on_grid(&self, ci: usize) -> impl Iterator<Item = &Creature> + '_ {
        self.creatures.iter().enumerate().filter(move |(j, c)| *j != ci && c.state != CreatureState::Out).map(|(_, c)| c)
    }

    fn walk_from_nearest_creature(&mut self, ci: usize) -> i64 {
        if self.creatures[ci].moved {
            return ALREADY_MOVED;
        }
        let (x, y) = (self.creatures[ci].x as i32, self.creatures[ci].y as i32);
        let dist = |ax: i32, ay: i32, bx: i32, by: i32| (cheb(ax, ay, bx, by), (ax - bx).pow(2) + (ay - by).pow(2));
        let nearest = self
            .other_creatures_on_grid(ci)
            .filter(|o| self.in_radius(ci, o.x, o.y))
            .min_by_key(|o| (dist(x, y, o.x as i32, o.y as i32), o.id))
            .map(|o| (o.x as i32, o.y as i32));
        let Some((ox, oy)) = nearest else { return BLOCKED };
        let grid = self.grid();
        let here = dist(x, y, ox, oy);
        let best = NEIGHBOURS
            .iter()
            .filter(|&&(dx, dy)| grid.can_move(x, y, dx, dy))
            .map(|&(dx, dy)| (dist(x + dx, y + dy, ox, oy), dx, dy))
            .max();
        match best {
            Some((d, dx, dy)) if d > here => {
                self.move_to(ci, (x + dx) as u16, (y + dy) as u16);
                if self.creatures[ci].state == CreatureState::Out {
                    ARRIVED
                } else {
                    MOVED
                }
            }
            _ => BLOCKED,
        }
    }

    fn sense_nearest(&self, ci: usize, k: i64) -> (i64, i64) {
        let c = &self.creatures[ci];
        let (x, y) = (c.x as i32, c.y as i32);
        let mut best: Option<(i32, u32)> = None;
        let mut consider = |px: u16, py: u16, id: u32| {
            if !self.in_radius(ci, px, py) {
                return;
            }
            let d = cheb(x, y, px as i32, py as i32);
            if best.map_or(true, |b| (d, id) < b) {
                best = Some((d, id));
            }
        };
        if k == CREATURE as i64 {
            for o in self.other_creatures_on_grid(ci) {
                consider(o.x, o.y, o.id);
            }
        } else if (0..=255).contains(&k) && k != EMPTY as i64 && k != WALL as i64 {
            let n = self.creatures.len() as u32;
            for (t, thing) in self.things.iter().enumerate() {
                if thing.present && self.kind_at(thing.x, thing.y) == k as u8 {
                    consider(thing.x, thing.y, n + 1 + t as u32);
                }
            }
        }
        best.map_or((-1, -1), |(d, id)| (id as i64, d as i64))
    }

    fn adjacent_station(&self, ci: usize) -> Option<usize> {
        let c = &self.creatures[ci];
        self.stations.iter().position(|s| !s.solved && cheb(c.x as i32, c.y as i32, s.x as i32, s.y as i32) <= 1)
    }

    /// The unsolved station whose task this creature can read: through an
    /// adjacent tablet, or at an adjacent station without a tablet.
    fn readable_station(&self, ci: usize) -> Option<usize> {
        let c = &self.creatures[ci];
        let (x, y) = (c.x as i32, c.y as i32);
        let via_tablet = self.tablets.iter().find(|&&(tx, ty, s)| !self.stations[s].solved && cheb(x, y, tx as i32, ty as i32) <= 1).map(|t| t.2);
        via_tablet.or_else(|| self.adjacent_station(ci).filter(|&s| !self.stations[s].has_tablet))
    }

    fn tell(&mut self, ci: usize, value: i64) -> i64 {
        if !self.flags.tell {
            return 0;
        }
        let (x, y) = (self.creatures[ci].x as i32, self.creatures[ci].y as i32);
        let mut heard = 0;
        for (j, o) in self.creatures.iter_mut().enumerate() {
            if j != ci && o.state == CreatureState::Active && cheb(x, y, o.x as i32, o.y as i32) <= TELL_RADIUS {
                o.regs[15] = value;
                heard += 1;
            }
        }
        heard
    }

    fn submit_answer(&mut self, ci: usize, answer: i64) -> i64 {
        let Some(s) = self.adjacent_station(ci) else { return -1 };
        let me = self.creatures[ci].id;
        let station = &mut self.stations[s];
        if station.locked.contains(&me) {
            return LOCKED_OUT;
        }
        let err = match station.truth() {
            Some(t) => (answer as i128 - t as i128).unsigned_abs().min(i64::MAX as u128) as i64,
            None => i64::MAX,
        };
        station.best_err = station.best_err.min(err);
        if err > station.tol {
            station.locked.push(me);
            return 0;
        }
        station.solved = true;
        self.version += 1;
        let (sx, sy) = (station.x, station.y);
        let gates = station.gates.clone();
        let i = self.idx(sx, sy);
        self.kind[i] = STATION_SOLVED;
        for g in gates {
            self.kind[g] = EMPTY;
            self.ids[g] = 0;
        }
        1
    }

    fn give_food(&mut self, ci: usize, amount: i64) -> i64 {
        let (x, y) = (self.creatures[ci].x as i32, self.creatures[ci].y as i32);
        let receiver = (0..self.creatures.len())
            .filter(|&j| j != ci)
            .filter(|&j| {
                let o = &self.creatures[j];
                o.state == CreatureState::Active && cheb(x, y, o.x as i32, o.y as i32) <= 1
            })
            .min_by_key(|&j| (self.creatures[j].energy, self.creatures[j].id));
        let Some(r) = receiver else { return 0 };
        let amount = amount.clamp(0, (self.creatures[ci].energy - 1).max(0));
        self.creatures[ci].energy -= amount;
        self.creatures[r].energy += amount;
        amount
    }
}

/// The interpreter's view of the world while creature `me` runs.
struct Ctx<'a> {
    world: &'a mut World,
    me: usize,
}

impl Host for Ctx<'_> {
    fn call(&mut self, id: i64, inputs: u8, outputs: u8, args: &[i64], out: &mut [i64]) -> Result<(), EvalError> {
        match signature(id) {
            None => Err(EvalError::UnknownFunction(id)),
            Some(sig) if sig != (inputs, outputs) => Err(EvalError::SignatureMismatch(id)),
            Some(_) => self.world.dispatch(self.me, id, args, out),
        }
    }
}
