import type { DesignExercise, FunctionExercise, Param, ScalarType, ValueType } from "@/types/coding-exercise";
import { parseType, RESULT_MARKER } from "../codec";
import { toSnakeCase } from "./names";
import type { Harness } from "./types";

const SCALARS: Record<ScalarType, string> = {
  int: "i32",
  long: "i64",
  double: "f64",
  bool: "bool",
  string: "String",
};

function rustType(type: ValueType): string {
  const { scalar, depth } = parseType(type);
  let t = SCALARS[scalar];
  for (let i = 0; i < depth; i++) t = `Vec<${t}>`;
  return t;
}

function paramDecl(p: Param): string {
  return `${toSnakeCase(p.name)}: ${rustType(p.type)}`;
}

function rustByteString(s: string): string {
  let out = 'b"';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (ch === '"' || ch === "\\") out += `\\${ch}`;
    else if (code >= 0x20 && code < 0x7f) out += ch;
    else out += `\\x${code.toString(16).padStart(2, "0")}`;
  }
  return out + '"';
}

function starter(exercise: FunctionExercise | DesignExercise): string {
  if (exercise.mode === "function") {
    const { name, params, returns } = exercise.signature;
    return `// \`struct Solution;\` is provided.
impl Solution {
    pub fn ${toSnakeCase(name)}(${params.map(paramDecl).join(", ")}) -> ${rustType(returns)} {
        todo!()
    }
}
`;
  }
  const { className, constructorParams, methods } = exercise.signature;
  const fns = [
    `    fn new(${constructorParams.map(paramDecl).join(", ")}) -> Self {\n        todo!()\n    }`,
    ...methods.map((m) => {
      const params = ["&mut self", ...m.params.map(paramDecl)].join(", ");
      const ret = m.returns === "void" ? "" : ` -> ${rustType(m.returns)}`;
      return `    fn ${toSnakeCase(m.name)}(${params})${ret} {\n        todo!()\n    }`;
    }),
  ];
  return `struct ${className} {
}

impl ${className} {
${fns.join("\n\n")}
}
`;
}

const IO_LIBRARY = String.raw`
#[allow(dead_code)]
mod kata_io {
    use std::io::{Read, Write};

    pub fn bad_input(what: &str) -> ! {
        eprintln!("kata driver: malformed test input ({what})");
        std::process::exit(97)
    }

    pub struct Reader {
        buf: Vec<u8>,
        pos: usize,
    }

    impl Reader {
        pub fn from_stdin() -> Self {
            let mut buf = Vec::new();
            if std::io::stdin().read_to_end(&mut buf).is_err() {
                bad_input("stdin");
            }
            Reader { buf, pos: 0 }
        }
        fn skip(&mut self) {
            while self.pos < self.buf.len() && self.buf[self.pos].is_ascii_whitespace() {
                self.pos += 1;
            }
        }
        fn token(&mut self) -> &str {
            self.skip();
            let start = self.pos;
            while self.pos < self.buf.len() && !self.buf[self.pos].is_ascii_whitespace() {
                self.pos += 1;
            }
            std::str::from_utf8(&self.buf[start..self.pos]).unwrap_or_else(|_| bad_input("token"))
        }
        pub fn read<T: Decode>(&mut self) -> T {
            T::decode(self)
        }
    }

    pub trait Decode: Sized {
        fn decode(r: &mut Reader) -> Self;
    }
    impl Decode for i32 {
        fn decode(r: &mut Reader) -> Self { r.token().parse().unwrap_or_else(|_| bad_input("int")) }
    }
    impl Decode for i64 {
        fn decode(r: &mut Reader) -> Self { r.token().parse().unwrap_or_else(|_| bad_input("long")) }
    }
    impl Decode for usize {
        fn decode(r: &mut Reader) -> Self { r.token().parse().unwrap_or_else(|_| bad_input("count")) }
    }
    impl Decode for f64 {
        fn decode(r: &mut Reader) -> Self { r.token().parse().unwrap_or_else(|_| bad_input("double")) }
    }
    impl Decode for bool {
        fn decode(r: &mut Reader) -> Self { r.token() == "1" }
    }
    impl Decode for String {
        fn decode(r: &mut Reader) -> Self {
            r.skip();
            let colon = r.buf[r.pos..].iter().position(|&b| b == b':').unwrap_or_else(|| bad_input("string"));
            let n: usize = std::str::from_utf8(&r.buf[r.pos..r.pos + colon])
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or_else(|| bad_input("string"));
            let start = r.pos + colon + 1;
            if start + n > r.buf.len() {
                bad_input("string");
            }
            r.pos = start + n;
            String::from_utf8(r.buf[start..start + n].to_vec()).unwrap_or_else(|_| bad_input("string"))
        }
    }
    impl<T: Decode> Decode for Vec<T> {
        fn decode(r: &mut Reader) -> Self {
            let n: usize = r.read();
            (0..n).map(|_| T::decode(r)).collect()
        }
    }

    pub trait Encode {
        fn encode(&self, out: &mut Vec<u8>);
    }
    impl Encode for i32 {
        fn encode(&self, out: &mut Vec<u8>) { out.extend_from_slice(self.to_string().as_bytes()); }
    }
    impl Encode for i64 {
        fn encode(&self, out: &mut Vec<u8>) { out.extend_from_slice(self.to_string().as_bytes()); }
    }
    impl Encode for f64 {
        // Debug formatting is shortest round-trip, with an exponent for very
        // large/small values.
        fn encode(&self, out: &mut Vec<u8>) { out.extend_from_slice(format!("{:?}", self).as_bytes()); }
    }
    impl Encode for bool {
        fn encode(&self, out: &mut Vec<u8>) { out.push(if *self { b'1' } else { b'0' }); }
    }
    impl Encode for String {
        fn encode(&self, out: &mut Vec<u8>) {
            out.extend_from_slice(format!("{}:", self.len()).as_bytes());
            out.extend_from_slice(self.as_bytes());
        }
    }
    impl<T: Encode> Encode for Vec<T> {
        fn encode(&self, out: &mut Vec<u8>) {
            out.extend_from_slice(self.len().to_string().as_bytes());
            for x in self {
                out.push(b' ');
                x.encode(out);
            }
        }
    }

    pub fn emit(result: &[u8]) {
        let stdout = std::io::stdout();
        let mut lock = stdout.lock();
        let _ = lock.flush();
        let _ = lock.write_all(${rustByteString(RESULT_MARKER)});
        let _ = lock.write_all(result);
        let _ = lock.write_all(b"\n");
        let _ = lock.flush();
    }
}
`;

function readArgs(params: Param[], prefix: string, indent: string): string[] {
  return params.map((p, i) => `${indent}let ${prefix}${i}: ${rustType(p.type)} = kata_in.read();`);
}

function functionMain(exercise: FunctionExercise): string {
  const { name, params, returns } = exercise.signature;
  const args = params.map((_, i) => `a${i}`).join(", ");
  return [
    "#[allow(dead_code)]",
    "struct Solution;",
    "",
    "fn main() {",
    "    let mut kata_in = kata_io::Reader::from_stdin();",
    ...readArgs(params, "a", "    "),
    `    let kata_result: ${rustType(returns)} = Solution::${toSnakeCase(name)}(${args});`,
    "    let mut kata_out: Vec<u8> = Vec::new();",
    "    kata_io::Encode::encode(&kata_result, &mut kata_out);",
    "    kata_io::emit(&kata_out);",
    "}",
  ].join("\n");
}

function designMain(exercise: DesignExercise): string {
  const { className, constructorParams, methods } = exercise.signature;
  const arms = methods.map((m, index) => {
    const args = m.params.map((_, i) => `a${i}`).join(", ");
    const call = `kata_obj.${toSnakeCase(m.name)}(${args})`;
    const body =
      m.returns === "void"
        ? [`                ${call};`]
        : [
            `                let r: ${rustType(m.returns)} = ${call};`,
            "                kata_io::Encode::encode(&r, &mut kata_out);",
            "                kata_out.push(b'\\n');",
          ];
    return [`            ${index} => {`, ...readArgs(m.params, "a", "                "), ...body, "            }"].join("\n");
  });
  const ctorArgs = constructorParams.map((_, i) => `c${i}`).join(", ");
  return [
    "#[allow(unused_mut)]",
    "fn main() {",
    "    let mut kata_in = kata_io::Reader::from_stdin();",
    ...readArgs(constructorParams, "c", "    "),
    `    let mut kata_obj = ${className}::new(${ctorArgs});`,
    "    let kata_calls: usize = kata_in.read();",
    "    let mut kata_out: Vec<u8> = Vec::new();",
    "    for _ in 0..kata_calls {",
    "        let kata_m: i32 = kata_in.read();",
    "        match kata_m {",
    ...arms,
    '            _ => kata_io::bad_input("method"),',
    "        }",
    "    }",
    "    kata_io::emit(&kata_out);",
    "}",
  ].join("\n");
}

export const rustHarness: Harness = {
  starter,
  program(exercise, userSource) {
    if (exercise.mode === "stdio") return userSource;
    if (exercise.mode === "harness") return [userSource, exercise.driver.rust, ""].join("\n");
    const main = exercise.mode === "function" ? functionMain(exercise) : designMain(exercise);
    return [userSource, IO_LIBRARY, main, ""].join("\n");
  },
};
