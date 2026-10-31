import type { CodingExercise, TestBundle, TestCase } from "@/types/coding-exercise";
import type { SubmissionKind } from "@/types/submission";
import type { PlannedTest } from "./evaluate";
import { validateTest } from "./wire";

/** A user's custom test for a run: the test's input fields, no expected. */
export type CustomInput = Omit<TestCase, "expected">;

export type Plan = { ok: true; tests: PlannedTest[] } | { ok: false; error: string };

/** Which tests a submission runs. Runs: the public examples, plus the
 * user's custom input if any. Submits: the examples, then every hidden test
 * from the private bundle — refusing rather than silently judging against
 * examples alone when the bundle is missing. */
export function planTests(
  exercise: CodingExercise,
  opts: { kind: SubmissionKind; bundle: TestBundle | null; customInput?: unknown },
): Plan {
  const examples: PlannedTest[] = exercise.examples.map((test) => ({ test, hidden: false }));

  if (opts.kind === "run") {
    if (opts.customInput === undefined || opts.customInput === null) return { ok: true, tests: examples };
    const custom = opts.customInput as TestCase;
    const problems = validateTest(exercise, custom, { requireExpected: false });
    if (problems.length > 0) return { ok: false, error: `custom input: ${problems.join("; ")}` };
    return { ok: true, tests: [...examples, { test: custom, hidden: false, custom: true }] };
  }

  if (!opts.bundle) return { ok: false, error: "this exercise's hidden tests aren't published yet" };
  const hidden: PlannedTest[] = [];
  for (const [i, t] of opts.bundle.tests.entries()) {
    const problems = validateTest(exercise, t, { requireExpected: true });
    if (problems.length > 0) return { ok: false, error: `bundle test ${i}: ${problems.join("; ")}` };
    const { label, ...test } = t;
    hidden.push({ test: test as TestCase, hidden: true, ...(label ? { label } : {}) });
  }
  return { ok: true, tests: [...examples, ...hidden] };
}
