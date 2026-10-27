//! Plain `extern "C"` exports for the page (no wasm-bindgen).
//!
//! Text goes in through `buf_alloc` (the page writes UTF-8 there and passes
//! the length) and comes out through `out_ptr`/`out_len`. Functions that
//! produce text return its length. Grid and creature data are read straight
//! from wasm memory through the `*_ptr` functions.

use std::cell::RefCell;

use crate::course::courses;
use crate::fitness::{evaluate, verify, TRAIN_SEEDS};
use crate::ga::Evolver;
use crate::library::Library;
use crate::program::Program;
use crate::reference;
use crate::registry::FUNCTIONS;
use crate::world::World;

#[derive(Default)]
struct State {
    evolver: Option<Evolver>,
    library: Option<Library>,
    replay: Option<World>,
    input: Vec<u8>,
    out: Vec<u8>,
    creatures: Vec<i32>,
    stations: Vec<i32>,
    marks: Vec<i32>,
    regs: Vec<i64>,
}

impl State {
    fn library(&mut self) -> &mut Library {
        self.library.get_or_insert_with(Library::new)
    }

    fn set_out(&mut self, s: &str) -> u32 {
        self.out.clear();
        self.out.extend_from_slice(s.as_bytes());
        self.out.len() as u32
    }

    fn input_text(&self, len: u32) -> String {
        String::from_utf8_lossy(&self.input[..(len as usize).min(self.input.len())]).into_owned()
    }
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default());
}

fn with<R>(f: impl FnOnce(&mut State) -> R) -> R {
    STATE.with(|s| f(&mut s.borrow_mut()))
}

#[no_mangle]
pub extern "C" fn buf_alloc(len: u32) -> *mut u8 {
    with(|s| {
        s.input.resize(len as usize, 0);
        s.input.as_mut_ptr()
    })
}

#[no_mangle]
pub extern "C" fn out_ptr() -> *const u8 {
    with(|s| s.out.as_ptr())
}

#[no_mangle]
pub extern "C" fn out_len() -> u32 {
    with(|s| s.out.len() as u32)
}

#[no_mangle]
pub extern "C" fn course_count() -> u32 {
    courses().len() as u32
}

/// `name\ndescription\nwidth\nheight\nswarm\nticks\nevolution note`
#[no_mangle]
pub extern "C" fn course_info(i: u32) -> u32 {
    let Some(c) = courses().get(i as usize) else { return with(|s| s.set_out("")) };
    let w = World::new(i as usize, 1, vec![Program::default()]);
    let text = format!("{}\n{}\n{}\n{}\n{}\n{}\n{}", c.name, c.description, w.w, w.h, c.params.swarm, c.params.ticks, c.evolution);
    with(|s| s.set_out(&text))
}

/// One line per registry function: `id\tf<in><out>\tname\tdoc`
#[no_mangle]
pub extern "C" fn function_info() -> u32 {
    let text: Vec<String> = FUNCTIONS.iter().map(|f| format!("{}\tf{}{}\t{}\t{}", f.id, f.inputs, f.outputs, f.name, f.doc)).collect();
    with(|s| s.set_out(&text.join("\n")))
}

#[no_mangle]
pub extern "C" fn reference_text(course: u32) -> u32 {
    let text = reference::program_for(course as usize).unwrap_or("");
    with(|s| s.set_out(text))
}

#[no_mangle]
pub extern "C" fn ga_new(course: u32, seed: u32) {
    with(|s| {
        let course = (course as usize).min(courses().len() - 1);
        let seeds = s.library().seeds_for(course);
        s.evolver = Some(Evolver::new(course, seed as u64, seeds));
    })
}

#[no_mangle]
pub extern "C" fn ga_steps(n: u32) {
    with(|s| {
        let mut library = s.library.take().unwrap_or_default();
        if let Some(ev) = s.evolver.as_mut() {
            for _ in 0..n {
                ev.step(&mut library);
            }
        }
        s.library = Some(library);
    })
}

#[no_mangle]
pub extern "C" fn ga_generation() -> u32 {
    with(|s| s.evolver.as_ref().map_or(0, |e| e.generation))
}

#[no_mangle]
pub extern "C" fn ga_evaluations() -> f64 {
    with(|s| s.evolver.as_ref().map_or(0.0, |e| e.evaluations as f64))
}

#[no_mangle]
pub extern "C" fn ga_best_fitness() -> f64 {
    with(|s| s.evolver.as_ref().map_or(0.0, |e| e.best.1.fitness))
}

#[no_mangle]
pub extern "C" fn ga_best_arrived() -> f64 {
    with(|s| s.evolver.as_ref().map_or(0.0, |e| e.best.1.arrived_frac))
}

#[no_mangle]
pub extern "C" fn ga_best_text() -> u32 {
    with(|s| {
        let text = s.evolver.as_ref().map_or(String::new(), |e| e.best.0.serialize());
        s.set_out(&text)
    })
}

#[no_mangle]
pub extern "C" fn ga_has_verified() -> u32 {
    with(|s| s.evolver.as_ref().map_or(0, |e| e.verified_best.is_some() as u32))
}

#[no_mangle]
pub extern "C" fn ga_history_ptr() -> *const f64 {
    with(|s| s.evolver.as_ref().map_or(std::ptr::null(), |e| e.history.as_ptr()))
}

#[no_mangle]
pub extern "C" fn ga_history_len() -> u32 {
    with(|s| s.evolver.as_ref().map_or(0, |e| e.history.len() as u32))
}

/// Number of verified programs kept for `course`.
#[no_mangle]
pub extern "C" fn library_count(course: u32) -> u32 {
    with(|s| s.library().entries.get(course as usize).map_or(0, |l| l.len() as u32))
}

#[no_mangle]
pub extern "C" fn library_text() -> u32 {
    with(|s| {
        let text = s.library().to_text();
        s.set_out(&text)
    })
}

/// Merges a pasted library. Every program is re-verified and re-scored;
/// unverified ones are rejected. Returns 0 (out: "kept N, rejected M") or
/// the line of the first parse error (out: the message).
#[no_mangle]
pub extern "C" fn library_load(len: u32) -> i32 {
    with(|s| {
        let text = s.input_text(len);
        match Library::from_text(&text) {
            Err(e) => {
                s.set_out(&e.to_string());
                e.line.max(1) as i32
            }
            Ok(pasted) => {
                let (mut kept, mut rejected) = (0, 0);
                for (course, list) in pasted.entries.into_iter().enumerate() {
                    for entry in list {
                        let p = std::slice::from_ref(&entry.program);
                        if verify(course, p) {
                            let fitness = evaluate(course, p, &TRAIN_SEEDS).fitness;
                            s.library().offer(course, entry.program, fitness, entry.generation);
                            kept += 1;
                        } else {
                            rejected += 1;
                        }
                    }
                }
                s.set_out(&format!("kept {}, rejected {}", kept, rejected));
                0
            }
        }
    })
}

/// Starts a replay. `text_len` 0 = the evolver's best program, else the
/// program text in the input buffer. Returns 0 or the line of a parse error
/// (message in out).
#[no_mangle]
pub extern "C" fn replay_new(course: u32, seed: u32, text_len: u32) -> i32 {
    with(|s| {
        let course = (course as usize).min(courses().len() - 1);
        let program = if text_len == 0 {
            s.evolver.as_ref().map(|e| e.best.0.clone()).unwrap_or_default()
        } else {
            match Program::parse(&s.input_text(text_len)) {
                Ok(p) => p,
                Err(e) => {
                    s.set_out(&e.to_string());
                    return e.line.max(1) as i32;
                }
            }
        };
        s.replay = Some(World::new(course, seed as u64, vec![program]));
        0
    })
}

/// Advances the replay one tick; returns 1 when it is finished.
#[no_mangle]
pub extern "C" fn replay_step() -> u32 {
    with(|s| match s.replay.as_mut() {
        Some(w) if !w.done() => {
            w.step();
            w.done() as u32
        }
        _ => 1,
    })
}

fn replay_u32(f: impl FnOnce(&World) -> u32) -> u32 {
    with(|s| s.replay.as_ref().map_or(0, f))
}

#[no_mangle]
pub extern "C" fn replay_tick() -> u32 {
    replay_u32(|w| w.tick)
}

#[no_mangle]
pub extern "C" fn replay_w() -> u32 {
    replay_u32(|w| w.w as u32)
}

#[no_mangle]
pub extern "C" fn replay_h() -> u32 {
    replay_u32(|w| w.h as u32)
}

#[no_mangle]
pub extern "C" fn replay_arrived() -> u32 {
    replay_u32(|w| w.arrived() as u32)
}

#[no_mangle]
pub extern "C" fn replay_creature_count() -> u32 {
    replay_u32(|w| w.creatures.len() as u32)
}

#[no_mangle]
pub extern "C" fn replay_station_count() -> u32 {
    replay_u32(|w| w.stations.len() as u32)
}

#[no_mangle]
pub extern "C" fn replay_cells_ptr() -> *const u8 {
    with(|s| s.replay.as_ref().map_or(std::ptr::null(), |w| w.kind.as_ptr()))
}

/// 8 × i32 per creature: id, x, y, state (0 active, 1 out, 2 exhausted),
/// energy, program index, last move status, error flag.
#[no_mangle]
pub extern "C" fn replay_creatures_ptr() -> *const i32 {
    use crate::world::CreatureState;
    with(|s| {
        let Some(w) = s.replay.as_ref() else { return std::ptr::null() };
        let mut buf = Vec::with_capacity(w.creatures.len() * 8);
        for c in &w.creatures {
            let state = match c.state {
                CreatureState::Active => 0,
                CreatureState::Out => 1,
                CreatureState::Exhausted => 2,
            };
            buf.extend_from_slice(&[
                c.id as i32,
                c.x as i32,
                c.y as i32,
                state,
                c.energy.clamp(i32::MIN as i64, i32::MAX as i64) as i32,
                c.prog as i32,
                c.last_status as i32,
                c.last_error.is_some() as i32,
            ]);
        }
        s.creatures = buf;
        s.creatures.as_ptr()
    })
}

/// The 16 registers of creature `index`.
#[no_mangle]
pub extern "C" fn replay_regs_ptr(index: u32) -> *const i64 {
    with(|s| {
        let regs = s.replay.as_ref().and_then(|w| w.creatures.get(index as usize)).map(|c| c.regs);
        s.regs = regs.map_or(vec![0; 16], |r| r.to_vec());
        s.regs.as_ptr()
    })
}

/// 4 × i32 per station: x, y, solved, best error (−1 = no answer yet,
/// clamped to i32::MAX).
#[no_mangle]
pub extern "C" fn replay_stations_ptr() -> *const i32 {
    with(|s| {
        let Some(w) = s.replay.as_ref() else { return std::ptr::null() };
        let mut buf = Vec::with_capacity(w.stations.len() * 4);
        for st in &w.stations {
            let err = if st.best_err == i64::MAX { -1 } else { st.best_err.min(i32::MAX as i64) as i32 };
            buf.extend_from_slice(&[st.x as i32, st.y as i32, st.solved as i32, err]);
        }
        s.stations = buf;
        s.stations.as_ptr()
    })
}

/// Cell marks (exchange iteration 2), clamped to i32.
#[no_mangle]
pub extern "C" fn replay_marks_ptr() -> *const i32 {
    with(|s| {
        let Some(w) = s.replay.as_ref() else { return std::ptr::null() };
        s.marks = w.marks.iter().map(|&m| m.clamp(i32::MIN as i64, i32::MAX as i64) as i32).collect();
        s.marks.as_ptr()
    })
}
