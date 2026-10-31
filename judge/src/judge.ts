import type { CodingExercise, Language } from "@/types/coding-exercise";
import { MAX_SOURCE_BYTES, type JudgeResult, type TestOutcome } from "@/types/submission";
import { evaluateTest, truncate, type PlannedTest } from "./evaluate";
import { RUNTIMES } from "./languages";
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
 * sandbox's final state instead of throwing. */
async function unlessKilled<T>(sandbox: Sandbox, op: () => Promise<T>): Promise<{ value: T } | { killed: SandboxState }> {
  try {
    return { value: await op() };
  } catch (err) {
    if (err instanceof SandboxError) {
      const state = await sandbox.state();
      if (!state.running) return { killed: state };
    }
    throw err;
  }
}

export async function judge(req: JudgeRequest, opts: JudgeOptions): Promise<JudgeResult> {
  const { exercise, language } = req;
  const runtime = RUNTIMES[language];
  const total = req.tests.filter((t) => !t.custom).length;
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
    const runBox = await open(limits.memoryMb + RUN_OVERHEAD_MB, limits.cpus ?? 1);
    await runBox.putFile(BINARY_PATH, binary, MAX_BINARY_BYTES, "0755");
    const session = runBox.batch(runtime.run, {
      cpuMs: limits.timeMs,
      wallMs: Math.ceil((limits.timeMs * 3) / Math.max(1, limits.cpus ?? 1)) + 1000,
      memoryMb: limits.memoryMb,
      stdoutMax: 16 << 20,
      stderrMax: 64 << 10,
      env: { RUST_BACKTRACE: "0", LD_PRELOAD: THREAD_STACK_PRELOAD },
    });
    // gVisor reports thread stack reservations as resident memory, so peak
    // RSS can't decide MLE there; the run sandbox's cgroup limit does.
    const rssReliable = opts.runtime !== "runsc";

    const outcomes: TestOutcome[] = [];
    try {
      for (const [index, planned] of req.tests.entries()) {
        const ran = await unlessKilled(runBox, () => session.run(encodeTestInput(exercise, planned.test)));
        if ("killed" in ran) {
          outcomes.push(sandboxKilled(planned, index, ran.killed));
          break;
        }
        const outcome = evaluateTest(exercise, planned, index, ran.value, { rssReliable });
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
    await Promise.all(sandboxes.map((box) => box.destroy().catch(() => {})));
  }
}
