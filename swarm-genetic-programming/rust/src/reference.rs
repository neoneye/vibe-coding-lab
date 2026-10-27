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

/// Exchange 1 (tell): whoever can read the tablet computes the answer and
/// tells it; whoever stands at the station submits what it heard ($15).
pub const RELAY: &str = "\
mov $10,5   ; walk_to_kind
mov $11,7   ; exit
f11 $0,$10
mov $1,$0
mul $1,-1   ; 1 when the exit is blocked
lpb $1
  mov $11,8   ; the tablet (only reachable on its side)
  f11 $2,$10
  mov $11,4   ; the station (only reachable on its side)
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
  mov $13,12  ; tell, only when a task was read (x >= 1)
  mov $14,$8
  lpb $3
    f11 $9,$13
  lpe
  mov $2,$15  ; heard something? submit it
  min $2,1
  max $2,0
  mov $13,9
  mov $14,$15
  lpb $2
    f11 $9,$13
  lpe
lpe
";

/// Exchange 2 (marks): head for the exit when it is in sight (and mark the
/// cell -100, which pulls explorers in); otherwise count a visit on this
/// cell and move to the least visited neighbour.
pub const FOG: &str = "\
mov $10,5   ; walk_to_kind
mov $11,7   ; exit (only seen within 4 cells)
f11 $0,$10
mov $1,$0
add $1,1
min $1,1    ; 1 when the exit is in sight
mov $12,13  ; mark this cell -100: the exit is near
mov $13,-100
lpb $1
  f11 $3,$12
lpe
mov $1,$0
mul $1,-1   ; 1 when the exit is out of sight
lpb $1
  mov $12,14  ; read_mark here
  mov $13,0
  mov $14,0
  f21 $2,$12
  add $2,1    ; one more visit
  mov $12,13  ; mark
  mov $13,$2
  f11 $3,$12
  mov $12,15  ; walk_to_lowest_mark
  f01 $3,$12
lpe
";

/// The fixed partner program on the Teach course: wanders along a heading
/// derived from its position, never eats.
pub const WANDERER: &str = "\
mov $10,0   ; my_position
f02 $2,$10
mul $2,3
mul $3,5
add $2,$3
mod $2,16   ; heading from x, y
mov $11,1   ; step
mov $12,$2
f11 $0,$11
";

/// Exchange 3 (teach): teach any neighbour running another program, then
/// behave like the food program.
pub const TEACH: &str = "\
mov $10,16  ; teach
f01 $0,$10
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
        7 => Some(RELAY),
        8 => Some(FOG),
        9 => Some(TEACH),
        _ => None,
    }
}
