import type {
  CodingExercise,
  DesignTest,
  FunctionTest,
  JsonValue,
  StdioTest,
  TestCase,
} from "@/types/coding-exercise";
import { Decoder, DecodeError, encodeValue, splitResult, validateValue } from "./codec";

// Test-case level framing on top of codec.ts: what goes on a program's stdin
// for one test, and how its stdout turns back into a comparable value.

export function encodeTestInput(exercise: CodingExercise, test: TestCase): Buffer {
  switch (exercise.mode) {
    case "stdio":
    case "harness":
      return Buffer.from((test as StdioTest).stdin, "utf8");
    case "function": {
      const { args } = test as FunctionTest;
      const lines = exercise.signature.params.map((p, i) => encodeValue(args[i], p.type));
      return Buffer.from(lines.join("\n") + "\n", "utf8");
    }
    case "design": {
      const t = test as DesignTest;
      const sig = exercise.signature;
      const lines = sig.constructorParams.map((p, i) => encodeValue(t.constructorArgs[i], p.type));
      lines.push(String(t.calls.length));
      for (const call of t.calls) {
        const index = sig.methods.findIndex((m) => m.name === call.method);
        const method = sig.methods[index];
        lines.push(
          [String(index), ...method.params.map((p, i) => encodeValue(call.args[i], p.type))].join(" "),
        );
      }
      return Buffer.from(lines.join("\n") + "\n", "utf8");
    }
  }
}

export type DecodedOutput =
  | { ok: true; actual: JsonValue; userOutput: string }
  | { ok: false; error: string; userOutput: string };

export function decodeTestOutput(exercise: CodingExercise, test: TestCase, stdout: Buffer): DecodedOutput {
  if (exercise.mode === "stdio" || exercise.mode === "harness") {
    return { ok: true, actual: stdout.toString("utf8"), userOutput: "" };
  }
  const split = splitResult(stdout);
  if (!split) {
    return {
      ok: false,
      error: "the program exited before returning a result",
      userOutput: stdout.toString("utf8"),
    };
  }
  const userOutput = split.userOutput.toString("utf8");
  try {
    const decoder = new Decoder(split.result);
    let actual: JsonValue;
    if (exercise.mode === "function") {
      actual = decoder.read(exercise.signature.returns);
    } else {
      const methods = exercise.signature.methods;
      actual = (test as DesignTest).calls.map((call) => {
        const m = methods.find((x) => x.name === call.method)!;
        return m.returns === "void" ? null : decoder.read(m.returns);
      });
    }
    if (!decoder.atEnd()) throw new DecodeError("unexpected extra output after the result");
    return { ok: true, actual, userOutput };
  } catch (err) {
    if (err instanceof DecodeError) {
      return { ok: false, error: `malformed result: ${err.message}`, userOutput };
    }
    throw err;
  }
}

/** Checks a test against the exercise's signature — used to validate
 * authored content and user-supplied custom input before it reaches a
 * sandbox. Returns a list of problems (empty when valid). */
export function validateTest(exercise: CodingExercise, test: TestCase, opts: { requireExpected: boolean }): string[] {
  const problems: string[] = [];
  const check = (value: JsonValue, type: Parameters<typeof validateValue>[1], path: string) => {
    const err = validateValue(value, type, path);
    if (err) problems.push(err);
  };
  switch (exercise.mode) {
    case "stdio":
    case "harness": {
      const t = test as StdioTest;
      if (typeof t.stdin !== "string") problems.push("stdin: expected a string");
      if (opts.requireExpected && typeof t.expected !== "string") problems.push("expected: expected a string");
      break;
    }
    case "function": {
      const t = test as FunctionTest;
      const params = exercise.signature.params;
      if (!Array.isArray(t.args) || t.args.length !== params.length) {
        problems.push(`args: expected ${params.length} arguments`);
        break;
      }
      params.forEach((p, i) => check(t.args[i], p.type, p.name));
      if (opts.requireExpected) check(t.expected, exercise.signature.returns, "expected");
      break;
    }
    case "design": {
      const t = test as DesignTest;
      const sig = exercise.signature;
      if (!Array.isArray(t.constructorArgs) || t.constructorArgs.length !== sig.constructorParams.length) {
        problems.push(`constructorArgs: expected ${sig.constructorParams.length} arguments`);
        break;
      }
      sig.constructorParams.forEach((p, i) => check(t.constructorArgs[i], p.type, p.name));
      if (!Array.isArray(t.calls)) {
        problems.push("calls: expected an array");
        break;
      }
      if (opts.requireExpected && (!Array.isArray(t.expected) || t.expected.length !== t.calls.length)) {
        problems.push("expected: need one entry per call");
      }
      t.calls.forEach((call, i) => {
        const m = sig.methods.find((x) => x.name === call?.method);
        if (!m) {
          problems.push(`calls[${i}]: unknown method ${JSON.stringify(call?.method)}`);
          return;
        }
        if (!Array.isArray(call.args) || call.args.length !== m.params.length) {
          problems.push(`calls[${i}]: ${m.name} takes ${m.params.length} arguments`);
          return;
        }
        m.params.forEach((p, j) => check(call.args[j], p.type, `calls[${i}].${p.name}`));
        if (opts.requireExpected && Array.isArray(t.expected)) {
          if (m.returns === "void") {
            if (t.expected[i] !== null) problems.push(`expected[${i}]: ${m.name} returns void, use null`);
          } else {
            check(t.expected[i], m.returns, `expected[${i}]`);
          }
        }
      });
      break;
    }
  }
  return problems;
}
