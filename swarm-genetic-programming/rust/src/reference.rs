//! Hand-written reference programs: proof that every course is solvable,
//! and the baseline the tests compare against.

/// Walk to the nearest exit.
pub const EXIT: &str = "\
mov $10,5   ; walk_to_kind
mov $11,7   ; exit
f11 $0,$10
";

/// Try the exit; while it is out of reach, go to the problem station,
/// evaluate a0 + a1·x + a2·x² + a3·x³ by Horner's rule and submit.
pub const GATE: &str = "\
mov $10,5   ; walk_to_kind
mov $11,7   ; exit
f11 $0,$10
mov $1,$0
mul $1,-1   ; 1 when the exit is blocked
lpb $1
  mov $11,4   ; unsolved problem station
  f11 $2,$10
  mov $12,8   ; read_task -> $3 x, $4 a0, $5 a1, $6 a2, $7 a3
  f05 $3,$12
  mov $8,$7
  mul $8,$3
  add $8,$6
  mul $8,$3
  add $8,$5
  mul $8,$3
  add $8,$4
  mov $13,9   ; submit_answer
  mov $14,$8
  f11 $9,$13
lpe
";

/// Eat while energy is below 30, otherwise head for the exit.
pub const FOOD: &str = "\
mov $10,10  ; my_energy
f01 $0,$10
mov $1,30
sub $1,$0
max $1,0
min $1,1    ; 1 when hungry
mul $1,-4
add $1,7    ; kind: 3 food when hungry, else 7 exit
mov $10,5   ; walk_to_kind
mov $11,$1
f11 $2,$10
";

pub fn program_for(course: usize) -> Option<&'static str> {
    match course {
        0..=2 => Some(EXIT),
        3..=5 => Some(GATE),
        6 => Some(FOOD),
        _ => None,
    }
}
