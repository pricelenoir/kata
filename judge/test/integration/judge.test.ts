// End-to-end judge tests against real Docker sandboxes. Needs the judge
// images (`npm run judge:images`); run with `npm run test:judge`.
// JUDGE_RUNTIME=runsc runs them under gVisor, as CI and production do.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@/types/coding-exercise";
import type { Verdict } from "@/types/submission";
import { judge } from "../../src/judge";
import { planTests } from "../../src/plan";
import { FIXTURES, PROBE } from "../fixtures";

const opts = { runtime: process.env.JUDGE_RUNTIME || undefined, owner: "integration-test" };

describe.each(FIXTURES.map((f) => [f.exercise.id, f] as const))("%s", (_id, fixture) => {
  it.each(LANGUAGES)("accepts the %s solution", async (language) => {
    const plan = planTests(fixture.exercise, { kind: "run", bundle: null });
    if (!plan.ok) throw new Error(plan.error);
    const result = await judge(
      { exercise: fixture.exercise, language, source: fixture.solutions[language], tests: plan.tests, stopOnFirstFailure: false },
      opts,
    );
    expect(result.compileOutput ?? "", JSON.stringify(result, null, 2)).not.toMatch(/error/i);
    expect(result.verdict, JSON.stringify(result, null, 2)).toBe("accepted");
    expect(result.passed).toBe(fixture.exercise.examples.length);
  });
});

it("reports what a function's own code printed, separately from its result", async () => {
  const fixture = FIXTURES.find((f) => f.exercise.id === "fixture-function")!;
  const plan = planTests(fixture.exercise, { kind: "run", bundle: null });
  if (!plan.ok) throw new Error(plan.error);
  const result = await judge(
    { exercise: fixture.exercise, language: "cpp", source: fixture.solutions.cpp, tests: plan.tests, stopOnFirstFailure: false },
    opts,
  );
  expect(result.tests[0].stdout).toBe("debug: summed 3 values\n");
  expect(result.tests[0].actual).toBe(16);
});

const HOSTILE: [file: string, expected: Verdict[]][] = [
  ["infinite-loop.cpp", ["time_limit"]],
  ["sleep-forever.cpp", ["time_limit"]],
  ["fork-bomb.cpp", ["time_limit", "runtime_error"]],
  ["memory-bomb.cpp", ["memory_limit"]],
  ["output-flood.cpp", ["output_limit"]],
  ["stack-overflow.cpp", ["runtime_error"]],
  ["lingering-daemon.cpp", ["accepted"]],
  ["disk-fill.cpp", ["accepted"]],
  ["thread-explosion.cpp", ["accepted"]],
  ["escape-probes.cpp", ["accepted"]],
  ["compile-bomb-include.cpp", ["compile_error"]],
  ["compile-bomb-templates.cpp", ["compile_error"]],
];

describe("hostile programs", () => {
  it.each(HOSTILE)("%s is contained (%j)", async (file, expected) => {
    const source = await readFile(join(__dirname, "hostile", file), "utf8");
    const started = Date.now();
    const result = await judge(
      { exercise: PROBE, language: "cpp", source, tests: [{ test: PROBE.examples[0], hidden: false }], stopOnFirstFailure: true },
      opts,
    );
    expect(expected, JSON.stringify(result, null, 2)).toContain(result.verdict);
    // Nothing should be able to hold a judge past its limits.
    expect(Date.now() - started).toBeLessThan(60_000);
  });

  it("leaves the host able to judge normally afterwards", async () => {
    const fixture = FIXTURES.find((f) => f.exercise.id === "fixture-stdio")!;
    const plan = planTests(fixture.exercise, { kind: "run", bundle: null });
    if (!plan.ok) throw new Error(plan.error);
    const result = await judge(
      { exercise: fixture.exercise, language: "cpp", source: fixture.solutions.cpp, tests: plan.tests, stopOnFirstFailure: false },
      opts,
    );
    expect(result.verdict).toBe("accepted");
  });
});
