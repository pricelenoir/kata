// End-to-end sanitizer checks: each program here passes the regular tests
// (it prints "ok"), so whatever the verdict is comes from the instrumented
// build. Needs the judge images; run with `npm run test:judge`.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Sanitizer, StdioExercise } from "@/types/coding-exercise";
import type { Verdict } from "@/types/submission";
import { judge } from "../../src/judge";

const opts = { runtime: process.env.JUDGE_RUNTIME || undefined, owner: "integration-test" };

function exercise(sanitizer: Sanitizer): StdioExercise {
  const test = { stdin: "1\n", expected: "ok\n" };
  return {
    id: `fixture-sanitizer-${sanitizer}`,
    title: `Fixture: ${sanitizer} sanitizer`,
    category: "concurrency",
    difficulty: "easy",
    mode: "stdio",
    prompt: "Print ok.",
    limits: { timeMs: 2000, memoryMb: 256, cpus: 2 },
    starterCode: { cpp: "", rust: "" },
    examples: [test],
    sanitizers: [{ sanitizer, tests: [test] }],
  };
}

const CASES: [file: string, sanitizer: Sanitizer, verdict: Verdict, summary?: RegExp][] = [
  ["race.cpp", "thread", "sanitizer", /^ThreadSanitizer: data race solution\.cpp:\d+ in work\(\)/],
  ["race-free.cpp", "thread", "accepted"],
  ["heap-overflow.cpp", "address", "sanitizer", /^AddressSanitizer: heap-buffer-overflow solution\.cpp:\d+ in main/],
  ["use-after-free.cpp", "address", "sanitizer", /^AddressSanitizer: heap-use-after-free/],
  ["leak.cpp", "address", "sanitizer", /^AddressSanitizer: \d+ byte\(s\) leaked/],
  ["signed-overflow.cpp", "address", "sanitizer", /^UndefinedBehaviorSanitizer: signed integer overflow: .* \(solution\.cpp:\d+:\d+\)$/],
  ["memory-clean.cpp", "address", "accepted"],
];

describe("sanitizer checks", () => {
  it.each(CASES)("%s under %s: %s", async (file, sanitizer, verdict, summary) => {
    const source = await readFile(join(__dirname, "sanitizers", file), "utf8");
    const ex = exercise(sanitizer);
    // stdio programs are compiled as written, so name the file the way the
    // harness does for the other modes.
    const result = await judge(
      {
        exercise: ex,
        language: "cpp",
        source: `#line 1 "solution.cpp"\n${source}`,
        tests: [{ test: ex.examples[0], hidden: false }],
        stopOnFirstFailure: true,
      },
      opts,
    );
    const dump = JSON.stringify(result, null, 2);
    expect(result.verdict, dump).toBe(verdict);
    expect(result.total).toBe(2);
    expect(result.tests[0].verdict, dump).toBe("accepted");
    const checked = result.tests[1];
    expect(checked.sanitizer).toBe(sanitizer);
    if (summary) {
      expect(checked.message, dump).toMatch(summary);
      expect(checked.report, dump).toContain("solution.cpp:");
      // Plumbing and build noise is trimmed out of the report.
      expect(checked.report).not.toMatch(/BuildId|\/usr\/include\/|libsanitizer|\/work\//);
    }
  });

  it("skips the check when the regular tests fail", async () => {
    const ex = exercise("thread");
    const result = await judge(
      {
        exercise: ex,
        language: "cpp",
        source: '#include <bits/stdc++.h>\nint main() { std::cout << "nope\\n"; }\n',
        tests: [{ test: ex.examples[0], hidden: false }],
        stopOnFirstFailure: false,
      },
      opts,
    );
    expect(result.verdict).toBe("wrong_answer");
    expect(result.tests.map((t) => t.sanitizer)).toEqual([undefined]);
    expect(result.total).toBe(2);
  });

  it("skips languages without sanitizer support", async () => {
    const ex = exercise("thread");
    const result = await judge(
      {
        exercise: ex,
        language: "rust",
        source: 'fn main() { println!("ok"); }\n',
        tests: [{ test: ex.examples[0], hidden: false }],
        stopOnFirstFailure: false,
      },
      opts,
    );
    expect(result.verdict).toBe("accepted");
    expect(result.total).toBe(1);
  });
});
