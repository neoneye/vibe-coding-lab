//! Swarm genetic programming engine.
//!
//! A swarm of creatures lives on a grid. Every creature runs the same small
//! assembly-like program once per tick. A genetic algorithm evolves programs
//! that get the swarm through obstacle courses, and verified programs are kept
//! in a library, like LODA's mined programs.

pub mod course;
pub mod interp;
pub mod path;
pub mod program;
pub mod registry;
pub mod rng;
pub mod world;

#[cfg(test)]
mod world_tests;
