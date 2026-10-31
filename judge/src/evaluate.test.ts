import { describe, expect, it } from "vitest";
import { FIXTURES, PROBE } from "../test/fixtures";
import { classifyRun, evaluateTest } from "./evaluate";
import { planTests } from "./plan";
import type { RunRecord } from "./sandbox";
import { RESULT_MARKER } from "./codec";

function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    exit: 0,
    signal: null,
    timedOut: false,
    outputLimit: false,
    cpuMs: 5,
    wallMs: 6,
    rssKb: 2048,
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    stdoutBytes: 0,
    stderrBytes: 0,
    ...overrides,
  };
}

const limits = { timeMs: 1000, memoryMb: 128 };

describe("classifyRun", () => {
  it.each<[Partial<RunRecord>, string | null]>([
    [{}, null],
    [{ outputLimit: true, signal: 9 }, "output_limit"],
    [{ timedOut: true, signal: 9 }, "time_limit"],
    [{ cpuMs: 1500 }, "time_limit"],
    [{ signal: 24 }, "time_limit"],
    [{ rssKb: 200 * 1024 }, "memory_limit"],
    [{ signal: 9 }, "memory_limit"],
    [{ signal: 6, exit: null, stderr: Buffer.from("std::bad_alloc") }, "memory_limit"],
    [{ signal: 11, rssKb: 128 * 1024 }, "runtime_error"],
    [{ signal: 11 }, "runtime_error"],
    [{ exit: 101 }, "runtime_error"],
  ])("%j → %s", (overrides, verdict) => {
    expect(classifyRun(record(overrides), limits)?.verdict ?? null).toBe(verdict);
  });

  it("ignores peak RSS for MLE where it isn't reliable (gVisor)", () => {
    const opts = { rssReliable: false };
    expect(classifyRun(record({ rssKb: 4000 * 1024 }), limits, opts)).toBeNull();
    expect(classifyRun(record({ signal: 9 }), limits, opts)?.verdict).toBe("memory_limit");
  });

  it("explains a segfault at the memory ceiling as a likely stack overflow", () => {
    expect(classifyRun(record({ signal: 11, rssKb: 127 * 1024 }), limits)?.message).toMatch(/stack overflow/);
  });
});

describe("evaluateTest", () => {
  const fn = FIXTURES.find((f) => f.exercise.id === "fixture-function")!.exercise;
  const example = { test: fn.examples[0], hidden: false };

  it("accepts a matching result and keeps the user's prints separate", () => {
    const out = record({ stdout: Buffer.from(`hello\n${RESULT_MARKER}16\n`, "latin1") });
    const outcome = evaluateTest(fn, example, 0, out);
    expect(outcome.verdict).toBe("accepted");
    expect(outcome.stdout).toBe("hello\n");
    expect(outcome.actual).toBe(16);
  });

  it("calls a missing result marker a wrong answer with an explanation", () => {
    const outcome = evaluateTest(fn, example, 0, record({ stdout: Buffer.from("oops") }));
    expect(outcome.verdict).toBe("wrong_answer");
    expect(outcome.message).toMatch(/exited before returning/);
  });

  it("reveals nothing about hidden tests beyond verdict, label, and measurements", () => {
    const hidden = { test: fn.examples[0], hidden: true, label: "big input" };
    const out = record({ stdout: Buffer.from(`leak ${JSON.stringify(fn.examples[0])}\n${RESULT_MARKER}1\n`, "latin1"), stderr: Buffer.from("leak") });
    const outcome = evaluateTest(fn, hidden, 3, out);
    expect(Object.keys(outcome).sort()).toEqual(["hidden", "index", "label", "memoryKb", "timeMs", "verdict"]);
    expect(outcome.verdict).toBe("wrong_answer");
  });
});

describe("planTests", () => {
  const exercise = PROBE;

  it("runs examples, plus validated custom input", () => {
    const plan = planTests(exercise, { kind: "run", bundle: null, customInput: { stdin: "x" } });
    expect(plan.ok && plan.tests.map((t) => t.custom ?? false)).toEqual([false, true]);
  });

  it("rejects malformed custom input", () => {
    const fn = FIXTURES.find((f) => f.exercise.id === "fixture-function")!.exercise;
    const plan = planTests(fn, { kind: "run", bundle: null, customInput: { args: ["nope", 1] } });
    expect(plan.ok).toBe(false);
  });

  it("refuses to submit without hidden tests instead of judging examples alone", () => {
    expect(planTests(exercise, { kind: "submit", bundle: null })).toEqual({
      ok: false,
      error: "this exercise's hidden tests aren't published yet",
    });
  });

  it("appends hidden tests after the examples, with labels split off", () => {
    const plan = planTests(exercise, {
      kind: "submit",
      bundle: { exerciseId: exercise.id, tests: [{ stdin: "", expected: "x\n", label: "edge" }] },
    });
    expect(plan.ok && plan.tests.at(-1)).toEqual({ test: { stdin: "", expected: "x\n" }, hidden: true, label: "edge" });
  });
});
