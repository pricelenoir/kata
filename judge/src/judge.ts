import type { CodingExercise, Language } from "@/types/coding-exercise";
import { MAX_SOURCE_BYTES, type JudgeResult, type TestOutcome } from "@/types/submission";
import { evaluateTest, truncate, type PlannedTest } from "./evaluate";
import { RUNTIMES } from "./languages";
import { Sandbox, SandboxError } from "./sandbox";
import { encodeTestInput } from "./wire";

const COMPILE_LIMITS = {
  cpuMs: 20_000,
  wallMs: 40_000,
  fsizeMb: 64,
  stdoutMax: 1 << 20,
  stderrMax: 64 << 10,
};

export interface JudgeRequest {
  exercise: CodingExercise;
  language: Language;
  source: string;
  tests: PlannedTest[];
  /** Submit mode: skip the remaining tests after the first failure. */
  stopOnFirstFailure: boolean;
}

export interface JudgeOptions {
  /** OCI runtime for sandboxes (JUDGE_RUNTIME); undefined = Docker default. */
  runtime?: string;
  /** Identifies this worker's containers for orphan cleanup. */
  owner: string;
}

/** Custom-input runs have nothing to be judged against, so they're shown
 * but never counted toward the verdict or the pass count. */
function summarize(tests: TestOutcome[], total: number): JudgeResult {
  const graded = tests.filter((t) => !t.custom);
  const failed = graded.find((t) => t.verdict !== "accepted") ?? tests.find((t) => t.custom && t.verdict !== "accepted");
  return {
    verdict: failed?.verdict ?? "accepted",
    passed: graded.filter((t) => t.verdict === "accepted").length,
    total,
    timeMs: Math.max(0, ...tests.map((t) => t.timeMs)),
    memoryKb: Math.max(0, ...tests.map((t) => t.memoryKb)),
    tests,
  };
}

export function internalError(message: string, total = 0): JudgeResult {
  return { verdict: "internal_error", passed: 0, total, timeMs: 0, memoryKb: 0, message, tests: [] };
}

export async function judge(req: JudgeRequest, opts: JudgeOptions): Promise<JudgeResult> {
  const { exercise, language } = req;
  const runtime = RUNTIMES[language];
  const total = req.tests.filter((t) => !t.custom).length;

  if (Buffer.byteLength(req.source, "utf8") > MAX_SOURCE_BYTES) {
    return { ...internalError("", total), verdict: "compile_error", compileOutput: "Source exceeds 64 KB." };
  }

  const limits = exercise.limits;
  let sandbox: Sandbox | undefined;
  try {
    sandbox = await Sandbox.create({
      image: runtime.image,
      runtime: opts.runtime,
      // Headroom over the per-test limit for the compiler, which runs in
      // the same container first.
      memoryMb: Math.max(1024, limits.memoryMb * 2 + 256),
      cpus: limits.cpus ?? 1,
      owner: opts.owner,
    });

    const program = runtime.harness.program(exercise, req.source);
    await sandbox.putFile(runtime.sourcePath, Buffer.from(program, "utf8"), MAX_SOURCE_BYTES * 4);

    const compiled = await sandbox.runOnce(runtime.compile, COMPILE_LIMITS);
    if (compiled.timedOut || compiled.exit !== 0) {
      const output = [compiled.stdout.toString("utf8"), compiled.stderr.toString("utf8")]
        .filter(Boolean)
        .join("\n");
      return {
        ...summarize([], total),
        verdict: "compile_error",
        compileOutput: compiled.timedOut
          ? "Compilation timed out."
          : truncate(output.trim() || `compiler exited with ${compiled.exit ?? `signal ${compiled.signal}`}`, 16 * 1024),
      };
    }
    const compileWarnings = compiled.stderr.toString("utf8").trim();

    const session = sandbox.batch(runtime.run, {
      cpuMs: limits.timeMs,
      wallMs: Math.ceil((limits.timeMs * 3) / Math.max(1, limits.cpus ?? 1)) + 1000,
      memoryMb: limits.memoryMb,
      stdoutMax: 16 << 20,
      stderrMax: 64 << 10,
      env: { RUST_BACKTRACE: "0" },
    });
    const outcomes: TestOutcome[] = [];
    try {
      for (const [index, planned] of req.tests.entries()) {
        const record = await session.run(encodeTestInput(exercise, planned.test));
        const outcome = evaluateTest(exercise, planned, index, record);
        outcomes.push(outcome);
        if (req.stopOnFirstFailure && outcome.verdict !== "accepted") break;
      }
    } finally {
      session.close();
    }

    const result = summarize(outcomes, total);
    return compileWarnings ? { ...result, compileOutput: truncate(compileWarnings, 16 * 1024) } : result;
  } catch (err) {
    if (err instanceof SandboxError) return internalError(err.message, total);
    throw err;
  } finally {
    await sandbox?.destroy().catch(() => {});
  }
}
