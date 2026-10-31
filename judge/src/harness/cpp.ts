import type { DesignExercise, FunctionExercise, Param, ScalarType, ValueType } from "@/types/coding-exercise";
import { parseType, RESULT_MARKER } from "../codec";
import type { Harness } from "./types";

/** Octal escapes for anything non-printable — unlike `\x`, they can't
 * swallow a following character that happens to be a hex digit. */
function cStringLiteral(s: string): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (ch === '"' || ch === "\\") out += `\\${ch}`;
    else if (code >= 0x20 && code < 0x7f) out += ch;
    else out += `\\${code.toString(8).padStart(3, "0")}`;
  }
  return out + '"';
}

const SCALARS: Record<ScalarType, string> = {
  int: "int",
  long: "long long",
  double: "double",
  bool: "bool",
  string: "string",
};

function cppType(type: ValueType, qualified = false): string {
  const { scalar, depth } = parseType(type);
  let t = SCALARS[scalar];
  if (qualified && scalar === "string") t = "std::string";
  for (let i = 0; i < depth; i++) t = qualified ? `std::vector<${t}>` : `vector<${t}>`;
  return t;
}

/** LeetCode conventions: containers by non-const reference, the rest by value. */
function paramDecl(p: Param): string {
  return parseType(p.type).depth > 0 ? `${cppType(p.type)}& ${p.name}` : `${cppType(p.type)} ${p.name}`;
}

const STARTER_NOTE = "// <bits/stdc++.h> is included and `using namespace std;` is in effect.";

function starter(exercise: FunctionExercise | DesignExercise): string {
  if (exercise.mode === "function") {
    const { name, params, returns } = exercise.signature;
    return `${STARTER_NOTE}

class Solution {
public:
    ${cppType(returns)} ${name}(${params.map(paramDecl).join(", ")}) {

    }
};
`;
  }
  const { className, constructorParams, methods } = exercise.signature;
  const members = [
    `    ${className}(${constructorParams.map(paramDecl).join(", ")}) {\n        \n    }`,
    ...methods.map(
      (m) =>
        `    ${m.returns === "void" ? "void" : cppType(m.returns)} ${m.name}(${m.params.map(paramDecl).join(", ")}) {\n        \n    }`,
    ),
  ];
  return `${STARTER_NOTE}

class ${className} {
public:
${members.join("\n\n")}
};
`;
}

const IO_LIBRARY = String.raw`
namespace kata_io {
[[noreturn]] inline void bad_input(const char* what) {
    std::fprintf(stderr, "kata driver: malformed test input (%s)\n", what);
    std::exit(97);
}
inline void read(int& v) { long long x; if (!(std::cin >> x)) bad_input("int"); v = static_cast<int>(x); }
inline void read(long long& v) { if (!(std::cin >> v)) bad_input("long"); }
inline void read(double& v) { if (!(std::cin >> v)) bad_input("double"); }
inline void read(bool& v) { int x; if (!(std::cin >> x)) bad_input("bool"); v = x != 0; }
inline void read(std::string& v) {
    std::size_t n;
    if (!(std::cin >> n) || std::cin.get() != ':') bad_input("string");
    v.assign(n, '\0');
    if (n && !std::cin.read(&v[0], static_cast<std::streamsize>(n))) bad_input("string");
}
template <class T> void read(std::vector<T>& v) {
    std::size_t n;
    if (!(std::cin >> n)) bad_input("array");
    v.resize(n);
    for (std::size_t i = 0; i < n; ++i) { T x; read(x); v[i] = std::move(x); }
}
inline void write(std::ostream& os, int v) { os << v; }
inline void write(std::ostream& os, long long v) { os << v; }
inline void write(std::ostream& os, double v) { os << std::setprecision(17) << v; }
inline void write(std::ostream& os, bool v) { os << (v ? '1' : '0'); }
inline void write(std::ostream& os, const std::string& v) {
    os << v.size() << ':';
    os.write(v.data(), static_cast<std::streamsize>(v.size()));
}
template <class T> void write(std::ostream& os, const std::vector<T>& v) {
    os << v.size();
    for (const auto& x : v) { os << ' '; write(os, x); }
}
inline void emit(const std::string& result) {
    std::cout.flush();
    std::fflush(stdout);
    std::cout << ${cStringLiteral(RESULT_MARKER)} << result << '\n';
    std::cout.flush();
}
}  // namespace kata_io
`;

function readArgs(params: Param[], prefix: string, indent: string): string[] {
  return params.map((p, i) => `${indent}${cppType(p.type, true)} ${prefix}${i}; kata_io::read(${prefix}${i});`);
}

function functionMain(exercise: FunctionExercise): string {
  const { name, params, returns } = exercise.signature;
  const args = params.map((_, i) => `a${i}`).join(", ");
  return [
    "int main() {",
    "    std::ios::sync_with_stdio(false);",
    "    std::cin.tie(nullptr);",
    ...readArgs(params, "a", "    "),
    "    Solution kata_solution;",
    `    ${cppType(returns, true)} kata_result = kata_solution.${name}(${args});`,
    "    std::ostringstream kata_out;",
    "    kata_io::write(kata_out, kata_result);",
    "    kata_io::emit(kata_out.str());",
    "    return 0;",
    "}",
  ].join("\n");
}

function designMain(exercise: DesignExercise): string {
  const { className, constructorParams, methods } = exercise.signature;
  const cases = methods.map((m, index) => {
    const args = m.params.map((_, i) => `a${i}`).join(", ");
    const call = `kata_obj->${m.name}(${args})`;
    const body =
      m.returns === "void"
        ? [`            ${call};`]
        : [
            `            ${cppType(m.returns, true)} r = ${call};`,
            "            kata_io::write(kata_out, r);",
            "            kata_out << '\\n';",
          ];
    return [`        case ${index}: {`, ...readArgs(m.params, "a", "            "), ...body, "            break;", "        }"].join(
      "\n",
    );
  });
  const ctorArgs = constructorParams.map((_, i) => `c${i}`).join(", ");
  return [
    "int main() {",
    "    std::ios::sync_with_stdio(false);",
    "    std::cin.tie(nullptr);",
    ...readArgs(constructorParams, "c", "    "),
    // Heap-allocated and never destroyed: destructor bugs aren't what's
    // being tested, and the object may be too big for the stack.
    `    auto* kata_obj = new ${className}(${ctorArgs});`,
    "    std::size_t kata_calls;",
    '    if (!(std::cin >> kata_calls)) kata_io::bad_input("call count");',
    "    std::ostringstream kata_out;",
    "    for (std::size_t kata_i = 0; kata_i < kata_calls; ++kata_i) {",
    "        int kata_m; kata_io::read(kata_m);",
    "        switch (kata_m) {",
    ...cases,
    '        default: kata_io::bad_input("method");',
    "        }",
    "    }",
    "    kata_io::emit(kata_out.str());",
    "    return 0;",
    "}",
  ].join("\n");
}

export const cppHarness: Harness = {
  starter,
  program(exercise, userSource) {
    if (exercise.mode === "stdio") return userSource;
    if (exercise.mode === "harness") {
      return [
        '#include "kata_prelude.h"',
        '#line 1 "solution.cpp"',
        userSource,
        '#line 1 "kata_driver.cpp"',
        exercise.driver.cpp,
        "",
      ].join("\n");
    }
    const main = exercise.mode === "function" ? functionMain(exercise) : designMain(exercise);
    return [
      // Precompiled in the judge image (judge/images/kata_prelude.h).
      '#include "kata_prelude.h"',
      "using namespace std;",
      '#line 1 "solution.cpp"',
      userSource,
      '#line 1 "kata_driver.cpp"',
      IO_LIBRARY,
      main,
      "",
    ].join("\n");
  },
};
