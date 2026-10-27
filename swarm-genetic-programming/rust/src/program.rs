//! The swarm DSL: parsing and serializing programs.
//!
//! ```text
//! mov $4,2        ; function id 2 = walk_to_xy
//! f21 $0,$4       ; id in $4, inputs $5,$6, output $0
//! lpb $3          ; body runs $3 times (count read once at entry)
//!   sub $1,1
//! lpe
//! ```

use std::fmt;

pub const REGISTER_COUNT: usize = 16;
pub const MAX_LOOP_DEPTH: usize = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Src {
    Reg(u8),
    Const(i64),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Op {
    Mov,
    Add,
    Sub,
    Mul,
    Div,
    Mod,
    Min,
    Max,
}

pub const ALL_OPS: [Op; 8] = [Op::Mov, Op::Add, Op::Sub, Op::Mul, Op::Div, Op::Mod, Op::Min, Op::Max];

impl Op {
    pub fn name(self) -> &'static str {
        match self {
            Op::Mov => "mov",
            Op::Add => "add",
            Op::Sub => "sub",
            Op::Mul => "mul",
            Op::Div => "div",
            Op::Mod => "mod",
            Op::Min => "min",
            Op::Max => "max",
        }
    }

    fn from_name(s: &str) -> Option<Op> {
        ALL_OPS.iter().copied().find(|op| op.name() == s)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Instruction {
    Calc { op: Op, target: u8, src: Src },
    /// `f<inputs><outputs> $target,$source`: the function id is the value of
    /// `$source`, inputs are `$source+1 ..= $source+inputs`, outputs go to
    /// `$target .. $target+outputs`.
    Call { inputs: u8, outputs: u8, target: u8, source: u8 },
    LoopBegin(Src),
    LoopEnd,
}

#[derive(Clone, Debug, PartialEq, Eq, Default)]
pub struct Program {
    pub instructions: Vec<Instruction>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ParseError {
    pub line: usize,
    pub message: String,
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "line {}: {}", self.line, self.message)
    }
}

fn parse_register(s: &str) -> Result<u8, String> {
    let digits = s.strip_prefix('$').ok_or_else(|| format!("expected a register, got '{}'", s))?;
    let n: usize = digits.parse().map_err(|_| format!("bad register '{}'", s))?;
    if n >= REGISTER_COUNT {
        return Err(format!("register '{}' out of range $0..$15", s));
    }
    Ok(n as u8)
}

fn parse_src(s: &str) -> Result<Src, String> {
    if s.starts_with('$') {
        return parse_register(s).map(Src::Reg);
    }
    s.parse::<i64>().map(Src::Const).map_err(|_| format!("bad operand '{}'", s))
}

fn fmt_src(src: Src) -> String {
    match src {
        Src::Reg(r) => format!("${}", r),
        Src::Const(c) => c.to_string(),
    }
}

/// Register-range check for a call; shared by the parser and `validate`.
fn check_call(inputs: u8, outputs: u8, target: u8, source: u8) -> Result<(), String> {
    if target as usize + outputs as usize > REGISTER_COUNT {
        return Err(format!("outputs ${}..${} run past $15", target, target as usize + outputs as usize - 1));
    }
    if source as usize + inputs as usize >= REGISTER_COUNT {
        return Err(format!("inputs after id ${} run past $15", source));
    }
    Ok(())
}

fn parse_line(code: &str) -> Result<Instruction, String> {
    let (mnemonic, rest) = match code.find(char::is_whitespace) {
        Some(i) => (&code[..i], code[i..].trim()),
        None => (code, ""),
    };
    let operands: Vec<&str> = if rest.is_empty() { vec![] } else { rest.split(',').map(|s| s.trim()).collect() };
    let expect = |n: usize| -> Result<(), String> {
        if operands.len() != n || operands.iter().any(|s| s.is_empty()) {
            return Err(format!("'{}' takes {} operand(s)", mnemonic, n));
        }
        Ok(())
    };
    if let Some(op) = Op::from_name(mnemonic) {
        expect(2)?;
        return Ok(Instruction::Calc { op, target: parse_register(operands[0])?, src: parse_src(operands[1])? });
    }
    match mnemonic {
        "lpb" => {
            expect(1)?;
            Ok(Instruction::LoopBegin(parse_src(operands[0])?))
        }
        "lpe" => {
            expect(0)?;
            Ok(Instruction::LoopEnd)
        }
        m if m.len() == 3 && m.starts_with('f') && m[1..].bytes().all(|b| b.is_ascii_digit()) => {
            expect(2)?;
            let b = m.as_bytes();
            let (inputs, outputs) = (b[1] - b'0', b[2] - b'0');
            let target = parse_register(operands[0])?;
            let source = parse_register(operands[1]).map_err(|_| format!("the function id must be a register, got '{}'", operands[1]))?;
            check_call(inputs, outputs, target, source)?;
            Ok(Instruction::Call { inputs, outputs, target, source })
        }
        _ => Err(format!("unknown instruction '{}'", mnemonic)),
    }
}

impl Program {
    pub fn parse(text: &str) -> Result<Program, ParseError> {
        let mut instructions = Vec::new();
        let mut depth = 0usize;
        let mut last_line = 0;
        for (i, raw) in text.lines().enumerate() {
            let line = i + 1;
            last_line = line;
            let code = raw.split(';').next().unwrap().trim();
            if code.is_empty() {
                continue;
            }
            let ins = parse_line(code).map_err(|message| ParseError { line, message })?;
            match ins {
                Instruction::LoopBegin(_) => {
                    depth += 1;
                    if depth > MAX_LOOP_DEPTH {
                        return Err(ParseError { line, message: format!("loops nest at most {} deep", MAX_LOOP_DEPTH) });
                    }
                }
                Instruction::LoopEnd => {
                    if depth == 0 {
                        return Err(ParseError { line, message: "'lpe' without 'lpb'".into() });
                    }
                    depth -= 1;
                }
                _ => {}
            }
            instructions.push(ins);
        }
        if depth > 0 {
            return Err(ParseError { line: last_line, message: "'lpb' without 'lpe'".into() });
        }
        Ok(Program { instructions })
    }

    pub fn serialize(&self) -> String {
        let mut out = String::new();
        let mut depth = 0usize;
        for ins in &self.instructions {
            if let Instruction::LoopEnd = ins {
                depth = depth.saturating_sub(1);
            }
            out.push_str(&"  ".repeat(depth));
            match *ins {
                Instruction::Calc { op, target, src } => out.push_str(&format!("{} ${},{}", op.name(), target, fmt_src(src))),
                Instruction::Call { inputs, outputs, target, source } => {
                    out.push_str(&format!("f{}{} ${},${}", inputs, outputs, target, source))
                }
                Instruction::LoopBegin(src) => {
                    out.push_str(&format!("lpb {}", fmt_src(src)));
                    depth += 1;
                }
                Instruction::LoopEnd => out.push_str("lpe"),
            }
            out.push('\n');
        }
        out
    }

    pub fn validate(&self) -> Result<(), String> {
        let mut depth = 0usize;
        for (i, ins) in self.instructions.iter().enumerate() {
            let at = |m: String| format!("instruction {}: {}", i, m);
            match *ins {
                Instruction::Calc { target, src, .. } => {
                    if target as usize >= REGISTER_COUNT || matches!(src, Src::Reg(r) if r as usize >= REGISTER_COUNT) {
                        return Err(at("register out of range".into()));
                    }
                }
                Instruction::Call { inputs, outputs, target, source } => {
                    if inputs > 9 || outputs > 9 {
                        return Err(at("bad signature".into()));
                    }
                    check_call(inputs, outputs, target, source).map_err(at)?;
                }
                Instruction::LoopBegin(src) => {
                    if matches!(src, Src::Reg(r) if r as usize >= REGISTER_COUNT) {
                        return Err(at("register out of range".into()));
                    }
                    depth += 1;
                    if depth > MAX_LOOP_DEPTH {
                        return Err(at("loops nested too deep".into()));
                    }
                }
                Instruction::LoopEnd => {
                    if depth == 0 {
                        return Err(at("'lpe' without 'lpb'".into()));
                    }
                    depth -= 1;
                }
            }
        }
        if depth > 0 {
            return Err("'lpb' without 'lpe'".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXAMPLE: &str = "\
mov $4,2        ; function id 2 = walk_to_xy
f21 $0,$4       ; id in $4, inputs $5,$6, output $0

lpb $3          ; loop body runs $3 times
  sub $1,1
lpe
";

    const EXAMPLE_CANONICAL: &str = "mov $4,2\nf21 $0,$4\nlpb $3\n  sub $1,1\nlpe\n";

    #[test]
    fn round_trip_canonical() {
        let p = Program::parse(EXAMPLE).unwrap();
        assert_eq!(p.serialize(), EXAMPLE_CANONICAL);
        assert_eq!(Program::parse(&p.serialize()).unwrap(), p);
        assert_eq!(p.instructions.len(), 5);
        assert_eq!(p.instructions[1], Instruction::Call { inputs: 2, outputs: 1, target: 0, source: 4 });
    }

    #[test]
    fn constants_and_negative_numbers() {
        let p = Program::parse("add $1,-7\nlpb 3\nlpe").unwrap();
        assert_eq!(p.instructions[0], Instruction::Calc { op: Op::Add, target: 1, src: Src::Const(-7) });
        assert_eq!(p.instructions[1], Instruction::LoopBegin(Src::Const(3)));
        assert_eq!(p.serialize(), "add $1,-7\nlpb 3\nlpe\n");
    }

    #[test]
    fn comments_and_blank_lines_ignored() {
        let p = Program::parse("; header\n\n   \nmov $1,1 ; set\n; end").unwrap();
        assert_eq!(p.instructions.len(), 1);
        assert_eq!(Program::parse("").unwrap().instructions.len(), 0);
    }

    #[test]
    fn parse_errors_have_line_numbers() {
        let e = Program::parse("mov $1,2\nfoo $1").unwrap_err();
        assert_eq!(e.line, 2);
        assert!(e.to_string().starts_with("line 2:"));
        assert_eq!(Program::parse("mov $1,").unwrap_err().line, 1);
        assert_eq!(Program::parse("mov $16,1").unwrap_err().line, 1);
        assert_eq!(Program::parse("mov $1,2,3").unwrap_err().line, 1);
        assert_eq!(Program::parse("add $1,99999999999999999999").unwrap_err().line, 1);
    }

    #[test]
    fn unbalanced_loops_rejected() {
        assert_eq!(Program::parse("mov $0,1\nlpe").unwrap_err().line, 2);
        assert!(Program::parse("lpb $0\nmov $0,1").is_err());
    }

    #[test]
    fn loop_depth_5_rejected() {
        let four = "lpb 2\nlpb 2\nlpb 2\nlpb 2\nlpe\nlpe\nlpe\nlpe";
        assert!(Program::parse(four).is_ok());
        let five = "lpb 2\nlpb 2\nlpb 2\nlpb 2\nlpb 2\nlpe\nlpe\nlpe\nlpe\nlpe";
        assert_eq!(Program::parse(five).unwrap_err().line, 5);
    }

    #[test]
    fn call_register_range_checked() {
        assert!(Program::parse("f13 $14,$0").is_err());
        assert!(Program::parse("f21 $0,$14").is_err());
        assert!(Program::parse("f13 $13,$0").is_ok());
        assert!(Program::parse("f21 $0,$13").is_ok());
        assert!(Program::parse("f05 $11,$15").is_ok());
        assert!(Program::parse("f21 $0,5").is_err(), "function id must come from a register");
    }

    #[test]
    fn constants_not_allowed_as_target() {
        assert!(Program::parse("mov 3,$1").is_err());
        assert!(Program::parse("f11 3,$1").is_err());
    }

    #[test]
    fn validate_checks_what_parse_checks() {
        let bad = Program { instructions: vec![Instruction::LoopEnd] };
        assert!(bad.validate().is_err());
        let range = Program { instructions: vec![Instruction::Call { inputs: 2, outputs: 1, target: 0, source: 14 }] };
        assert!(range.validate().is_err());
        assert!(Program::parse(EXAMPLE).unwrap().validate().is_ok());
    }
}
