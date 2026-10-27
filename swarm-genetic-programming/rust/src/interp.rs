//! Runs a program for one creature for one tick.
//!
//! There is exactly one control-flow construct: `lpb <count>` … `lpe`. The
//! count is read once when the loop starts, clamped to `0..=MAX_LOOP_COUNT`,
//! and the body runs exactly that many times. Together with the per-tick
//! instruction cap this makes every run terminate.

use crate::program::{Instruction, Op, Program, Src};

pub const MAX_LOOP_COUNT: i64 = 255;
pub const INSTRUCTION_CAP: u32 = 200;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EvalError {
    DivByZero,
    Overflow,
    UnknownFunction(i64),
    SignatureMismatch(i64),
    Host(&'static str),
}

/// What a program calls through `f<in><out>`.
pub trait Host {
    /// `args` holds `inputs` values; write `outputs` values into `out`.
    fn call(&mut self, id: i64, inputs: u8, outputs: u8, args: &[i64], out: &mut [i64]) -> Result<(), EvalError>;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RunOutcome {
    pub executed: u32,
    pub error: Option<EvalError>,
    pub hit_cap: bool,
}

fn calc(op: Op, a: i64, b: i64) -> Result<i64, EvalError> {
    let checked = |v: Option<i64>| v.ok_or(EvalError::Overflow);
    match op {
        Op::Mov => Ok(b),
        Op::Add => checked(a.checked_add(b)),
        Op::Sub => checked(a.checked_sub(b)),
        Op::Mul => checked(a.checked_mul(b)),
        Op::Div | Op::Mod if b == 0 => Err(EvalError::DivByZero),
        Op::Div => checked(a.checked_div(b)),
        Op::Mod => checked(a.checked_rem(b)),
        Op::Min => Ok(a.min(b)),
        Op::Max => Ok(a.max(b)),
    }
}

/// Index of the matching `lpe` for every `lpb` (programs are validated, so
/// loops are balanced).
fn loop_ends(p: &Program) -> Vec<usize> {
    let mut ends = vec![usize::MAX; p.instructions.len()];
    let mut stack = Vec::with_capacity(4);
    for (i, ins) in p.instructions.iter().enumerate() {
        match ins {
            Instruction::LoopBegin(_) => stack.push(i),
            Instruction::LoopEnd => {
                if let Some(b) = stack.pop() {
                    ends[b] = i;
                }
            }
            _ => {}
        }
    }
    ends
}

pub fn run(p: &Program, regs: &mut [i64; 16], host: &mut dyn Host, cap: u32) -> RunOutcome {
    let ends = loop_ends(p);
    let read = |regs: &[i64; 16], src: Src| match src {
        Src::Reg(r) => regs[r as usize],
        Src::Const(c) => c,
    };
    // (index of lpb, iterations left)
    let mut loops: Vec<(usize, i64)> = Vec::with_capacity(4);
    let mut outcome = RunOutcome { executed: 0, error: None, hit_cap: false };
    let mut pc = 0;
    while pc < p.instructions.len() {
        if outcome.executed >= cap {
            outcome.hit_cap = true;
            break;
        }
        outcome.executed += 1;
        let step: Result<(), EvalError> = match p.instructions[pc] {
            Instruction::Calc { op, target, src } => {
                let b = read(regs, src);
                calc(op, regs[target as usize], b).map(|v| regs[target as usize] = v)
            }
            Instruction::Call { inputs, outputs, target, source } => {
                let s = source as usize;
                let id = regs[s];
                let mut args = [0i64; 9];
                args[..inputs as usize].copy_from_slice(&regs[s + 1..s + 1 + inputs as usize]);
                let mut out = [0i64; 9];
                host.call(id, inputs, outputs, &args[..inputs as usize], &mut out[..outputs as usize]).map(|()| {
                    let t = target as usize;
                    regs[t..t + outputs as usize].copy_from_slice(&out[..outputs as usize]);
                })
            }
            Instruction::LoopBegin(src) => {
                let count = read(regs, src).clamp(0, MAX_LOOP_COUNT);
                if count == 0 {
                    pc = ends[pc];
                } else {
                    loops.push((pc, count));
                }
                Ok(())
            }
            Instruction::LoopEnd => {
                if let Some(top) = loops.last_mut() {
                    top.1 -= 1;
                    if top.1 > 0 {
                        pc = top.0;
                    } else {
                        loops.pop();
                    }
                }
                Ok(())
            }
        };
        if let Err(e) = step {
            outcome.error = Some(e);
            break;
        }
        pc += 1;
    }
    outcome
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Records the calls it gets; echoes `id + args[0]` into every output.
    #[derive(Default)]
    struct RecordingHost {
        calls: Vec<(i64, Vec<i64>)>,
    }

    impl Host for RecordingHost {
        fn call(&mut self, id: i64, _inputs: u8, _outputs: u8, args: &[i64], out: &mut [i64]) -> Result<(), EvalError> {
            self.calls.push((id, args.to_vec()));
            if id == 99 {
                return Err(EvalError::UnknownFunction(99));
            }
            for o in out.iter_mut() {
                *o = id + args.first().copied().unwrap_or(0);
            }
            Ok(())
        }
    }

    fn exec(text: &str, cap: u32) -> ([i64; 16], RunOutcome, RecordingHost) {
        let p = Program::parse(text).unwrap();
        let mut regs = [0i64; 16];
        let mut host = RecordingHost::default();
        let outcome = run(&p, &mut regs, &mut host, cap);
        (regs, outcome, host)
    }

    #[test]
    fn arithmetic_basics() {
        let (r, o, _) = exec("mov $1,7\nadd $1,5\nsub $1,2\nmul $1,3\nmov $2,$1", 200);
        assert_eq!((r[1], r[2]), (30, 30));
        assert_eq!(o.executed, 5);
        assert_eq!(o.error, None);
    }

    #[test]
    fn min_max_mod_semantics() {
        let (r, _, _) = exec("mov $1,-7\ndiv $1,2\nmov $2,-7\nmod $2,3\nmov $3,4\nmin $3,-1\nmov $4,4\nmax $4,9", 200);
        assert_eq!((r[1], r[2], r[3], r[4]), (-3, -1, -1, 9));
    }

    #[test]
    fn loop_count_captured_at_entry() {
        let (r, _, _) = exec("mov $0,3\nlpb $0\n add $1,1\n mov $0,100\nlpe", 200);
        assert_eq!(r[1], 3);
    }

    #[test]
    fn loop_count_clamped() {
        let (r, _, _) = exec("lpb -5\nadd $1,1\nlpe", 200);
        assert_eq!(r[1], 0);
        let (r, _, _) = exec("lpb 1000\nadd $1,1\nlpe", 10_000);
        assert_eq!(r[1], 255);
    }

    #[test]
    fn loop_zero_skips_body() {
        let (r, o, _) = exec("lpb 0\nadd $1,1\nlpb 3\nadd $1,1\nlpe\nlpe\nadd $2,1", 200);
        assert_eq!((r[1], r[2]), (0, 1));
        assert_eq!(o.executed, 2, "lpb + the instruction after the loop");
    }

    #[test]
    fn nested_loops_multiply() {
        let (r, _, _) = exec("lpb 3\nlpb 4\nadd $1,1\nlpe\nlpe", 1000);
        assert_eq!(r[1], 12);
    }

    #[test]
    fn nested_max_loops_hit_cap() {
        let (_, o, _) = exec("lpb 255\nlpb 255\nlpb 255\nlpb 255\nadd $1,1\nlpe\nlpe\nlpe\nlpe", 200);
        assert!(o.hit_cap);
        assert_eq!(o.executed, 200);
    }

    #[test]
    fn div_by_zero_error() {
        let (r, o, _) = exec("mov $1,5\ndiv $1,0\nmov $2,1", 200);
        assert_eq!(o.error, Some(EvalError::DivByZero));
        assert_eq!((r[1], r[2]), (5, 0));
        let (_, o, _) = exec("mod $1,0", 200);
        assert_eq!(o.error, Some(EvalError::DivByZero));
    }

    #[test]
    fn overflow_ends_tick_keeps_earlier_writes() {
        let (r, o, _) = exec("mov $1,7\nmov $2,9223372036854775807\nmul $2,2\nmov $1,8", 200);
        assert_eq!(o.error, Some(EvalError::Overflow));
        assert_eq!(r[1], 7);
        assert_eq!(r[2], i64::MAX);
        let (_, o, _) = exec("mov $1,-9223372036854775808\ndiv $1,-1", 200);
        assert_eq!(o.error, Some(EvalError::Overflow));
    }

    #[test]
    fn call_reads_id_and_inputs() {
        let (r, _, host) = exec("mov $4,9\nmov $5,10\nmov $6,11\nf21 $0,$4", 200);
        assert_eq!(host.calls, vec![(9, vec![10, 11])]);
        assert_eq!(r[0], 19);
        assert_eq!(r[1], 0, "only one output register written");
    }

    #[test]
    fn call_writes_all_outputs() {
        let (r, _, host) = exec("mov $10,3\nmov $11,4\nf13 $0,$10", 200);
        assert_eq!(host.calls, vec![(3, vec![4])]);
        assert_eq!(&r[0..3], &[7, 7, 7]);
    }

    #[test]
    fn host_error_ends_tick() {
        let (r, o, _) = exec("mov $4,99\nf01 $0,$4\nmov $1,1", 200);
        assert_eq!(o.error, Some(EvalError::UnknownFunction(99)));
        assert_eq!(r[1], 0);
    }
}
