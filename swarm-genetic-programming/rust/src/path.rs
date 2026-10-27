//! Breadth-first pathfinding on the 8-connected grid.
//!
//! Every move costs one unit (diagonals too), so BFS finds shortest paths.
//! A diagonal move may not squeeze between two blocked orthogonal cells.

use std::collections::VecDeque;

use crate::world::{CREATURE, EMPTY, EXIT, FOOD, GATE, WALL};

pub const NODE_BUDGET: usize = 4096;

pub const NEIGHBOURS: [(i32, i32); 8] = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PathResult {
    Arrived,
    Step(u16, u16),
    Blocked,
    OverBudget,
}

/// Cells a creature can step onto.
pub fn passable(kind: u8) -> bool {
    kind == EMPTY || kind == FOOD || kind == EXIT
}

fn hard(kind: u8) -> bool {
    kind == WALL || kind == GATE
}

/// Grid view used by the searches.
pub struct Grid<'a> {
    pub w: u16,
    pub h: u16,
    pub kind: &'a [u8],
}

impl Grid<'_> {
    pub fn at(&self, x: i32, y: i32) -> Option<u8> {
        if x < 0 || y < 0 || x >= self.w as i32 || y >= self.h as i32 {
            return None;
        }
        Some(self.kind[y as usize * self.w as usize + x as usize])
    }

    /// Can a creature move from (x, y) by (dx, dy)? Checks the corner rule
    /// and that the destination is passable.
    pub fn can_move(&self, x: i32, y: i32, dx: i32, dy: i32) -> bool {
        self.can_move_through(x, y, dx, dy, false)
    }

    /// Like `can_move`, but with `through_creatures` a creature's cell counts
    /// as passable (for planning a queue, never for moving).
    pub fn can_move_through(&self, x: i32, y: i32, dx: i32, dy: i32, through_creatures: bool) -> bool {
        match self.at(x + dx, y + dy) {
            Some(k) if passable(k) || (through_creatures && k == CREATURE) => {}
            _ => return false,
        }
        if dx != 0 && dy != 0 {
            let a = self.at(x + dx, y).map_or(true, hard);
            let b = self.at(x, y + dy).map_or(true, hard);
            if a || b {
                return false;
            }
        }
        true
    }
}

#[derive(Clone, Default)]
pub struct Scratch {
    stamp: Vec<u32>,
    first: Vec<u32>,
    g: Vec<i32>,
    gen: u32,
    queue: VecDeque<u32>,
}

impl Scratch {
    fn reset(&mut self, cells: usize) {
        if self.stamp.len() != cells {
            self.stamp = vec![0; cells];
            self.first = vec![0; cells];
            self.gen = 0;
        }
        self.gen = self.gen.wrapping_add(1);
        if self.gen == 0 {
            self.stamp.iter_mut().for_each(|s| *s = 0);
            self.gen = 1;
        }
        self.queue.clear();
    }
}

/// First move of a shortest path from `from` to any cell where `goal(index)`
/// holds. `radius` limits the search to cells within that Chebyshev distance.
/// With `through_creatures`, other creatures don't block the search (the
/// first step may then be into a creature's cell; the caller waits).
pub fn first_step(
    grid: &Grid,
    scratch: &mut Scratch,
    from: (u16, u16),
    goal: &dyn Fn(usize) -> bool,
    radius: Option<u16>,
    through_creatures: bool,
) -> PathResult {
    let w = grid.w as usize;
    let start = from.1 as usize * w + from.0 as usize;
    if goal(start) {
        return PathResult::Arrived;
    }
    scratch.reset(grid.kind.len());
    let gen = scratch.gen;
    scratch.stamp[start] = gen;
    scratch.queue.push_back(start as u32);
    let mut expanded = 0;
    while let Some(cur) = scratch.queue.pop_front() {
        expanded += 1;
        if expanded > NODE_BUDGET {
            return PathResult::OverBudget;
        }
        let (cx, cy) = ((cur as usize % w) as i32, (cur as usize / w) as i32);
        for &(dx, dy) in &NEIGHBOURS {
            let (nx, ny) = (cx + dx, cy + dy);
            if let Some(r) = radius {
                let d = (nx - from.0 as i32).abs().max((ny - from.1 as i32).abs());
                if d > r as i32 {
                    continue;
                }
            }
            if !grid.can_move_through(cx, cy, dx, dy, through_creatures) {
                continue;
            }
            let ni = ny as usize * w + nx as usize;
            if scratch.stamp[ni] == gen {
                continue;
            }
            scratch.stamp[ni] = gen;
            scratch.first[ni] = if cur as usize == start { ni as u32 } else { scratch.first[cur as usize] };
            if goal(ni) {
                let f = scratch.first[ni] as usize;
                return PathResult::Step((f % w) as u16, (f / w) as u16);
            }
            // Food and exits end a path: stepping on them eats / leaves.
            if grid.kind[ni] == EMPTY || (through_creatures && grid.kind[ni] == CREATURE) {
                scratch.queue.push_back(ni as u32);
            }
        }
    }
    PathResult::Blocked
}

/// Path distance from every cell to the nearest source cell, treating only
/// walls as obstacles (gates and creatures are ignored). -1 = unreachable.
pub fn distance_field(grid: &Grid, sources: &[usize]) -> Vec<i32> {
    let w = grid.w as usize;
    let mut dist = vec![-1; grid.kind.len()];
    let mut queue = VecDeque::new();
    for &s in sources {
        dist[s] = 0;
        queue.push_back(s);
    }
    while let Some(cur) = queue.pop_front() {
        let (cx, cy) = ((cur % w) as i32, (cur / w) as i32);
        for &(dx, dy) in &NEIGHBOURS {
            let (nx, ny) = (cx + dx, cy + dy);
            match grid.at(nx, ny) {
                Some(k) if k != WALL => {}
                _ => continue,
            }
            if dx != 0 && dy != 0 && (grid.at(cx + dx, cy) == Some(WALL) || grid.at(cx, cy + dy) == Some(WALL)) {
                continue;
            }
            let ni = ny as usize * w + nx as usize;
            if dist[ni] < 0 {
                dist[ni] = dist[cur] + 1;
                queue.push_back(ni);
            }
        }
    }
    dist
}

/// Distance from every cell to the nearest source cell for a walking
/// creature: paths run through empty cells only (or creature cells too with
/// `through_creatures`), and every source must be passable. -1 = no path.
/// One field serves every creature walking to the same goal.
pub fn goal_field(grid: &Grid, sources: &[usize], through_creatures: bool) -> Vec<i32> {
    let w = grid.w as usize;
    let mut dist = vec![-1; grid.kind.len()];
    let mut queue = VecDeque::with_capacity(grid.kind.len());
    for &s in sources {
        if dist[s] < 0 {
            dist[s] = 0;
            queue.push_back(s);
        }
    }
    while let Some(cur) = queue.pop_front() {
        let (cx, cy) = ((cur % w) as i32, (cur / w) as i32);
        for &(dx, dy) in &NEIGHBOURS {
            let (nx, ny) = (cx + dx, cy + dy);
            match grid.at(nx, ny) {
                Some(k) if k == EMPTY || (through_creatures && k == CREATURE) => {}
                _ => continue,
            }
            if dx != 0 && dy != 0 && (grid.at(nx, cy).map_or(true, hard) || grid.at(cx, ny).map_or(true, hard)) {
                continue;
            }
            let ni = ny as usize * w + nx as usize;
            if dist[ni] < 0 {
                dist[ni] = dist[cur] + 1;
                queue.push_back(ni);
            }
        }
    }
    dist
}

/// A* from `from` to any cell where `goal` holds, avoiding creatures.
/// `h` is a goal field computed through creatures: a consistent lower bound
/// that is exact when no creature is in the way, so unobstructed walks only
/// expand cells along their path. Cells with `h < 0` can't reach the goal.
pub fn astar_first_step(grid: &Grid, scratch: &mut Scratch, from: (u16, u16), goal: &dyn Fn(usize) -> bool, h: &[i32]) -> PathResult {
    use std::cmp::Reverse;
    use std::collections::BinaryHeap;
    let w = grid.w as usize;
    let start = from.1 as usize * w + from.0 as usize;
    if goal(start) {
        return PathResult::Arrived;
    }
    scratch.reset(grid.kind.len());
    if scratch.g.len() != grid.kind.len() {
        scratch.g = vec![0; grid.kind.len()];
    }
    let gen = scratch.gen;
    scratch.stamp[start] = gen;
    scratch.g[start] = 0;
    // (f, -g, cell): lowest f first, deeper first on ties
    let mut open = BinaryHeap::new();
    open.push(Reverse((0i32, 0i32, start as u32)));
    let mut expanded = 0;
    while let Some(Reverse((_, neg_g, cur))) = open.pop() {
        let cur = cur as usize;
        let g = -neg_g;
        if g > scratch.g[cur] {
            continue; // stale entry
        }
        if cur != start && goal(cur) {
            let f = scratch.first[cur] as usize;
            return PathResult::Step((f % w) as u16, (f / w) as u16);
        }
        if cur != start && grid.kind[cur] != EMPTY {
            continue; // food and exits end a path
        }
        expanded += 1;
        if expanded > NODE_BUDGET {
            return PathResult::OverBudget;
        }
        let (cx, cy) = ((cur % w) as i32, (cur / w) as i32);
        for &(dx, dy) in &NEIGHBOURS {
            if !grid.can_move(cx, cy, dx, dy) {
                continue;
            }
            let ni = (cy + dy) as usize * w + (cx + dx) as usize;
            if h[ni] < 0 {
                continue;
            }
            let ng = g + 1;
            if scratch.stamp[ni] == gen && scratch.g[ni] <= ng {
                continue;
            }
            scratch.stamp[ni] = gen;
            scratch.g[ni] = ng;
            scratch.first[ni] = if cur == start { ni as u32 } else { scratch.first[cur] };
            open.push(Reverse((ng + h[ni], -ng, ni as u32)));
        }
    }
    PathResult::Blocked
}
