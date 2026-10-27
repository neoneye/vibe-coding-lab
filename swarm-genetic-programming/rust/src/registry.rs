//! The registry of predefined functions a program calls with `f<in><out>`.

/// Move status codes returned by the movement functions.
pub const ARRIVED: i64 = 1;
pub const MOVED: i64 = 0;
pub const BLOCKED: i64 = -1;
pub const ALREADY_MOVED: i64 = -2;
/// `submit_answer` after this creature already answered this station wrong.
pub const LOCKED_OUT: i64 = -2;

#[derive(Clone, Copy, Debug)]
pub struct FnInfo {
    pub id: i64,
    pub inputs: u8,
    pub outputs: u8,
    pub name: &'static str,
    pub doc: &'static str,
}

pub const MY_POSITION: i64 = 0;
pub const STEP: i64 = 1;
pub const WALK_TO_XY: i64 = 2;
pub const WALK_TO_NEAREST_CREATURE: i64 = 3;
pub const WALK_FROM_NEAREST_CREATURE: i64 = 4;
pub const WALK_TO_KIND: i64 = 5;
pub const SENSE_NEAREST: i64 = 6;
pub const WALK_TO_ID: i64 = 7;
pub const READ_TASK: i64 = 8;
pub const SUBMIT_ANSWER: i64 = 9;
pub const MY_ENERGY: i64 = 10;
pub const GIVE_FOOD: i64 = 11;
pub const TELL: i64 = 12;
pub const MARK: i64 = 13;
pub const READ_MARK: i64 = 14;
pub const WALK_TO_LOWEST_MARK: i64 = 15;
pub const TEACH: i64 = 16;

pub const FUNCTIONS: &[FnInfo] = &[
    FnInfo { id: MY_POSITION, inputs: 0, outputs: 2, name: "my_position", doc: "outputs x, y" },
    FnInfo { id: STEP, inputs: 1, outputs: 1, name: "step", doc: "move 1 cell along heading d (0..15, 22.5° each); status" },
    FnInfo { id: WALK_TO_XY, inputs: 2, outputs: 1, name: "walk_to_xy", doc: "shortest path to (x, y) around walls and creatures; status" },
    FnInfo { id: WALK_TO_NEAREST_CREATURE, inputs: 0, outputs: 1, name: "walk_to_nearest_creature", doc: "status (arrived = adjacent)" },
    FnInfo { id: WALK_FROM_NEAREST_CREATURE, inputs: 0, outputs: 1, name: "walk_from_nearest_creature", doc: "status" },
    FnInfo { id: WALK_TO_KIND, inputs: 1, outputs: 1, name: "walk_to_kind", doc: "walk to the nearest thing of a kind (3 food, 4 problem, 5 solved, 7 exit); status" },
    FnInfo { id: SENSE_NEAREST, inputs: 1, outputs: 2, name: "sense_nearest", doc: "input kind; outputs id, distance (-1, -1 if none)" },
    FnInfo { id: WALK_TO_ID, inputs: 1, outputs: 1, name: "walk_to_id", doc: "walk toward a creature or thing by id; status" },
    FnInfo { id: READ_TASK, inputs: 0, outputs: 5, name: "read_task", doc: "outputs x, a0, a1, a2, a3 of an adjacent problem" },
    FnInfo { id: SUBMIT_ANSWER, inputs: 1, outputs: 1, name: "submit_answer", doc: "1 accepted, 0 wrong, -1 no adjacent problem, -2 locked out (one guess per creature)" },
    FnInfo { id: MY_ENERGY, inputs: 0, outputs: 1, name: "my_energy", doc: "outputs energy" },
    FnInfo { id: GIVE_FOOD, inputs: 1, outputs: 1, name: "give_food", doc: "give energy to the hungriest adjacent creature; outputs amount given" },
    FnInfo { id: TELL, inputs: 1, outputs: 1, name: "tell", doc: "write a value into $15 of every creature within 3 cells; outputs how many heard it" },
    FnInfo { id: MARK, inputs: 1, outputs: 1, name: "mark", doc: "write a value into the mark of my cell; outputs the previous mark" },
    FnInfo { id: READ_MARK, inputs: 2, outputs: 1, name: "read_mark", doc: "mark of the cell at offset (dx, dy), each clamped to -3..3" },
    FnInfo { id: WALK_TO_LOWEST_MARK, inputs: 0, outputs: 1, name: "walk_to_lowest_mark", doc: "step to the free neighbour with the lowest mark (unmarked = 0); status" },
    FnInfo { id: TEACH, inputs: 0, outputs: 1, name: "teach", doc: "copy my program to an adjacent creature running another one (costs 10 energy); 1 if taught" },
];

pub fn info(id: i64) -> Option<&'static FnInfo> {
    FUNCTIONS.iter().find(|f| f.id == id)
}

pub fn signature(id: i64) -> Option<(u8, u8)> {
    info(id).map(|f| (f.inputs, f.outputs))
}

pub fn name(id: i64) -> &'static str {
    info(id).map(|f| f.name).unwrap_or("?")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_unique_and_dense() {
        for (i, f) in FUNCTIONS.iter().enumerate() {
            assert_eq!(f.id, i as i64);
        }
    }

    #[test]
    fn signatures_match_the_spec_table() {
        assert_eq!(signature(WALK_TO_XY), Some((2, 1)));
        assert_eq!(signature(READ_TASK), Some((0, 5)));
        assert_eq!(signature(SENSE_NEAREST), Some((1, 2)));
        assert_eq!(signature(99), None);
    }
}
