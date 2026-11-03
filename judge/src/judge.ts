import { SANITIZER_LABEL, type CodingExercise, type Language, type Limits, type SanitizerCheck } from "@/types/coding-exercise";
import { MAX_SOURCE_BYTES, type JudgeResult, type TestOutcome } from "@/types/submission";
import { evaluateTest, truncate, type PlannedTest } from "./evaluate";
import { RUNTIMES, type LanguageRuntime, type SanitizerBuild } from "./languages";
import { Sandbox, SandboxError, type SandboxState } from "./sandbox";
import { encodeTestInput } from "./wire";

const COMPILE_LIMITS = {
  cpuMs: 20_000,
  wallMs: 40_000,
  fsizeMb: 64,
  stdoutMax: 1 << 20,
  stderrMax: 64 << 10,
};

/** Compilers (C++ templates, rustc) need far more memory than most
 * solutions, so compilation gets its own sandbox. */
const COMPILE_MEMORY_MB = 1536;

/** Room on top of an exercise's memory limit in the run sandbox: tmpfs
 * contents, kata-run, and under gVisor the sandbox's own kernel. The
 * container's cgroup is the hard memory limit there, so it's kept tight. */
const RUN_OVERHEAD_MB = 192;

const BINARY_PATH = "/work/main";
const MAX_BINARY_BYTES = 64 << 20;

/** Sizes every thread's default stack at 8 MB (see judge/images/kata-threads.c). */
const THREAD_STACK_PRELOAD = "/usr/local/lib/libkata_threads.so";

/** Instrumented builds run several times slower and use several times the
 * memory (shadow memory, redzones, quarantine), so unless a check sets its
 * own limits they scale the exercise's. */
export function sanitizerLimits(exercise: CodingExercise, check: SanitizerCheck): Limits {
  const base = exercise.limits;
  return {
    timeMs: check.limits?.timeMs ?? base.timeMs * 4,
    memoryMb: check.limits?.memoryMb ?? Math.min(2048, Math.max(1024, base.memoryMb * 4)),
    cpus: check.limits?.cpus ?? base.cpus,
  };
}

export interface PlannedCheck {
  check: SanitizerCheck;
  build: SanitizerBuild;
  tests: PlannedTest[];
}

/** The exercise's sanitizer checks that this language can build. Their
 * tests are public, so they run on both runs and submits. */
export function plannedChecks(exercise: CodingExercise, runtime: LanguageRuntime): PlannedCheck[] {
  return (exercise.sanitizers ?? []).flatMap((check) => {
    const build = runtime.sanitize?.[check.sanitizer];
    if (!build) return [];
    return [{ check, build, tests: check.tests.map((test) => ({ test, hidden: false, sanitizer: check.sanitizer })) }];
  });
}

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

function compileError(output: string, total: number): JudgeResult {
  return { ...summarize([], total), verdict: "compile_error", compileOutput: truncate(output, 16 * 1024) };
}

/** A test during which the runtime killed the whole sandbox. */
function sandboxKilled(planned: PlannedTest, index: number, state: SandboxState): TestOutcome {
  const verdict = state.oomKilled ? "memory_limit" : "runtime_error";
  return {
    index,
    hidden: planned.hidden,
    ...(planned.custom ? { custom: true } : {}),
    ...(planned.sanitizer ? { sanitizer: planned.sanitizer } : {}),
    ...(planned.label ? { label: planned.label } : {}),
    verdict,
    timeMs: 0,
    memoryKb: 0,
    ...(planned.hidden
      ? {}
      : {
          message: state.oomKilled
            ? "the sandbox ran out of memory"
            : "the sandbox was stopped after the program exceeded its process or resource limits",
        }),
  };
}

/** Runs `op`; if it fails because the sandbox itself died, returns the
 * sandbox's final state instead of throwing. The exec can fail a moment
 * before Docker records the container as stopped, so the state is polled
 * briefly before deciding it was some other failure. */
async function unlessKilled<T>(sandbox: Sandbox, op: () => Promise<T>): Promise<{ value: T } | { killed: SandboxState }> {
  try {
    return { value: await op() };
  } catch (err) {
    if (err instanceof SandboxError) {
      for (let i = 0; i < 20; i++) {
        const state = await sandbox.state();
        if (!state.running) return { killed: state };
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    throw err;
  }
}

export async function judge(req: JudgeRequest, opts: JudgeOptions): Promise<JudgeResult> {
  const { exercise, language } = req;
  const runtime = RUNTIMES[language];
  const checks = plannedChecks(exercise, runtime);
  const total = req.tests.filter((t) => !t.custom).length + checks.reduce((n, c) => n + c.tests.length, 0);
  const limits = exercise.limits;

  if (Buffer.byteLength(req.source, "utf8") > MAX_SOURCE_BYTES) {
    return compileError("Source exceeds 64 KB.", total);
  }

  const sandboxes: Sandbox[] = [];
  const open = async (memoryMb: number, cpus: number) => {
    const box = await Sandbox.create({ image: runtime.image, runtime: opts.runtime, memoryMb, cpus, owner: opts.owner });
    sandboxes.push(box);
    return box;
  };

  try {
    // ---- compile ----
    const compileBox = await open(COMPILE_MEMORY_MB, 1);
    const program = runtime.harness.program(exercise, req.source);
    await compileBox.putFile(runtime.sourcePath, Buffer.from(program, "utf8"), MAX_SOURCE_BYTES * 4);

    const compiled = await unlessKilled(compileBox, () => compileBox.runOnce(runtime.compile, COMPILE_LIMITS));
    if ("killed" in compiled) {
      return compileError("The compiler ran out of memory or other resources.", total);
    }
    const c = compiled.value;
    if (c.timedOut) return compileError("Compilation timed out.", total);
    if (c.exit !== 0) {
      const output = [c.stdout.toString("utf8"), c.stderr.toString("utf8")].filter(Boolean).join("\n").trim();
      return compileError(output || `compiler exited with ${c.exit ?? `signal ${c.signal}`}`, total);
    }
    const compileWarnings = c.stderr.toString("utf8").trim();
    const binary = await compileBox.readFile(BINARY_PATH);

    // ---- run ----
    // gVisor reports thread stack reservations as resident memory, so peak
    // RSS can't decide MLE there; the run sandbox's cgroup limit does.
    const rssReliable = opts.runtime !== "runsc";
    const outcomes: TestOutcome[] = [];

    /** Runs `tests` against `binary` in a fresh sandbox sized for `limits`,
     * appending to `outcomes`. Returns false if a graded test failed. */
    const runPhase = async (
      bin: Buffer,
      tests: PlannedTest[],
      runLimits: Limits,
      env: Record<string, string>,
    ): Promise<boolean> => {
      const box = await open(runLimits.memoryMb + RUN_OVERHEAD_MB, runLimits.cpus ?? 1);
      let ok = true;
      try {
        await box.putFile(BINARY_PATH, bin, MAX_BINARY_BYTES, "0755");
        const session = box.batch(runtime.run, {
          cpuMs: runLimits.timeMs,
          wallMs: Math.ceil((runLimits.timeMs * 3) / Math.max(1, runLimits.cpus ?? 1)) + 1000,
          memoryMb: runLimits.memoryMb,
          stdoutMax: 16 << 20,
          stderrMax: 64 << 10,
          env: { RUST_BACKTRACE: "0", LD_PRELOAD: THREAD_STACK_PRELOAD, ...env },
        });
        try {
          for (const planned of tests) {
            const index = outcomes.length;
            const ran = await unlessKilled(box, () => session.run(encodeTestInput(exercise, planned.test)));
            if ("killed" in ran) {
              outcomes.push(sandboxKilled(planned, index, ran.killed));
              if (!planned.custom) ok = false;
              break;
            }
            const outcome = evaluateTest(exercise, planned, index, ran.value, { rssReliable, limits: runLimits });
            outcomes.push(outcome);
            if (outcome.verdict !== "accepted" && !planned.custom) {
              ok = false;
              if (req.stopOnFirstFailure) break;
            }
          }
        } finally {
          session.close();
        }
      } finally {
        // Sandboxes are heavy; don't hold this one while the next phase runs.
        await box.destroy().catch(() => {});
      }
      return ok;
    };

    // The compile sandbox is the biggest one; it's only kept through the
    // regular tests when instrumented builds may still be needed.
    if (checks.length === 0) await compileBox.destroy().catch(() => {});
    const passed = await runPhase(binary, req.tests, limits, {});

    // ---- sanitizers ----
    // Only once the regular tests pass: a sanitizer report about a solution
    // that's already wrong is noise. Every instrumented build is made first,
    // so the compile sandbox is gone before any instrumented run starts.
    if (passed && checks.length > 0) {
      const builds: { check: PlannedCheck; binary: Buffer }[] = [];
      for (const planned of checks) {
        const built = await unlessKilled(compileBox, () => compileBox.runOnce(planned.build.compile, COMPILE_LIMITS));
        if ("killed" in built || built.value.timedOut || built.value.exit !== 0) {
          // The same source already compiled, so this is the judge's problem
          // (instrumented builds are slower and bigger), not the user's.
          const output =
            "killed" in built ? "the compiler ran out of resources" : built.value.timedOut ? "timed out" : built.value.stderr.toString("utf8");
          return {
            ...internalError(`The ${SANITIZER_LABEL[planned.check.sanitizer]} build failed: ${truncate(output.trim(), 2048)}`, total),
            passed: outcomes.filter((t) => !t.custom && t.verdict === "accepted").length,
            tests: outcomes,
          };
        }
        builds.push({ check: planned, binary: await compileBox.readFile(planned.build.compile[planned.build.compile.indexOf("-o") + 1]) });
      }
      await compileBox.destroy().catch(() => {});

      for (const { check, binary: instrumented } of builds) {
        const ok = await runPhase(instrumented, check.tests, sanitizerLimits(exercise, check.check), check.build.env);
        if (!ok && req.stopOnFirstFailure) break;
      }
    }

    const result = summarize(outcomes, total);
    return compileWarnings ? { ...result, compileOutput: truncate(compileWarnings, 16 * 1024) } : result;
  } catch (err) {
    if (err instanceof SandboxError) return internalError(err.message, total);
    throw err;
  } finally {
    await Promise.all(sandboxes.map((box) => box.destroy().catch(() => {})));
  }
}
