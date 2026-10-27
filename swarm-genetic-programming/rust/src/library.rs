//! The library of verified programs, kept per course (like LODA's mined
//! programs).

use crate::course::courses;
use crate::program::{ParseError, Program};

/// Programs kept per course.
pub const KEEP: usize = 5;

#[derive(Clone, Debug, PartialEq)]
pub struct Entry {
    pub program: Program,
    pub fitness: f64,
    pub generation: u32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Library {
    /// One list per course, best first.
    pub entries: Vec<Vec<Entry>>,
}

impl Default for Library {
    fn default() -> Self {
        Library::new()
    }
}

impl Library {
    pub fn new() -> Library {
        Library { entries: vec![Vec::new(); courses().len()] }
    }

    /// Adds a verified program if it ranks among the best `KEEP` (fitness
    /// first, shorter wins ties). Returns whether it was kept.
    pub fn offer(&mut self, course: usize, program: Program, fitness: f64, generation: u32) -> bool {
        let Some(list) = self.entries.get_mut(course) else { return false };
        if list.iter().any(|e| e.program == program) {
            return false;
        }
        list.push(Entry { program: program.clone(), fitness, generation });
        list.sort_by(|a, b| {
            b.fitness.total_cmp(&a.fitness).then(a.program.instructions.len().cmp(&b.program.instructions.len()))
        });
        list.truncate(KEEP);
        list.iter().any(|e| e.program == program)
    }

    pub fn to_text(&self) -> String {
        let mut out = String::new();
        for (course, list) in self.entries.iter().enumerate() {
            for e in list {
                out.push_str(&format!("; course {} {}\n", course, courses()[course].name));
                out.push_str(&format!("; fitness {} generation {}\n", e.fitness, e.generation));
                out.push_str(&e.program.serialize());
                out.push('\n');
            }
        }
        out
    }

    pub fn from_text(text: &str) -> Result<Library, ParseError> {
        struct Block {
            course: usize,
            fitness: f64,
            generation: u32,
            first_line: usize,
            code: String,
        }
        let mut blocks: Vec<Block> = Vec::new();
        for (i, raw) in text.lines().enumerate() {
            let line = i + 1;
            let err = |message: String| ParseError { line, message };
            let t = raw.trim();
            if let Some(rest) = t.strip_prefix("; course ") {
                let idx: usize = rest.split_whitespace().next().and_then(|s| s.parse().ok()).ok_or_else(|| err("bad course header".into()))?;
                if idx >= courses().len() {
                    return Err(err(format!("no course {}", idx)));
                }
                blocks.push(Block { course: idx, fitness: 0.0, generation: 0, first_line: line + 1, code: String::new() });
                continue;
            }
            if let Some(rest) = t.strip_prefix("; fitness ") {
                let b = blocks.last_mut().ok_or_else(|| err("fitness line before a course header".into()))?;
                let mut parts = rest.split_whitespace();
                b.fitness = parts.next().and_then(|s| s.parse().ok()).ok_or_else(|| err("bad fitness".into()))?;
                if parts.next() == Some("generation") {
                    b.generation = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
                }
                b.code.push('\n');
                continue;
            }
            let code = t.split(';').next().unwrap().trim();
            match blocks.last_mut() {
                Some(b) => {
                    b.code.push_str(raw);
                    b.code.push('\n');
                }
                None if !code.is_empty() => return Err(err("program text before any '; course N' header".into())),
                None => {}
            }
        }
        let mut lib = Library::new();
        for b in blocks {
            // `code` starts on the header's next line.
            let program = Program::parse(&b.code).map_err(|e| ParseError { line: e.line + b.first_line - 1, message: e.message })?;
            lib.offer(b.course, program, b.fitness, b.generation);
        }
        Ok(lib)
    }

    /// Programs from every other course, best first: seeds for evolving `course`.
    pub fn seeds_for(&self, course: usize) -> Vec<Program> {
        let mut all: Vec<&Entry> = self.entries.iter().enumerate().filter(|(c, _)| *c != course).flat_map(|(_, l)| l.iter()).collect();
        all.sort_by(|a, b| b.fitness.total_cmp(&a.fitness));
        all.into_iter().map(|e| e.program.clone()).collect()
    }
}
