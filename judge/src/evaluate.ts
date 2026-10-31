import type { CodingExercise, JsonValue, TestCase } from "@/types/coding-exercise";
import type { TestOutcome, Verdict } from "@/types/submission";
import { outputsMatch } from "./checker";
import type { RunRecord } from "./sandbox";
import { decodeTestOutput } from "./wire";

const SIGNAL_NAMES: Record<number, string> = {
  4: "SIGILL (illegal instruction)",
  6: "SIGABRT (aborted)",
  7: "SIGBUS (bus error)",
  8: "SIGFPE (arithmetic exception, e.g. division by zero)",
  9: "SIGKILL",
  11: "SIGSEGV (segmentation fault)",
  24: "SIGXCPU (CPU time limit)",
  25: "SIGXFSZ (file size limit)",
};

/** Exit code the generated drivers use for unparseable test input — a
 * judge-side problem, not the user's. */
export const DRIVER_BAD_INPUT = 97;

const TEXT_LIMIT = 8 * 1024;

export function truncate(text: string, max = TEXT_LIMIT): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n… (${text.length - max} more characters)`;
}

/** Why a run failed before its output could even be compared, or null if it
 * ran to completion within limits. */
export function classifyRun(
  record: RunRecord,
  limits: { timeMs: number; memoryMb: number },
): { verdict: Verdict; message: string } | null {
  if (record.outputLimit) {
    return { verdict: "output_limit", message: `printed ${record.stdoutBytes + record.stderrBytes} bytes` };
  }
  if (record.timedOut || record.cpuMs > limits.timeMs || record.signal === 24) {
    return {
      verdict: "time_limit",
      message: record.timedOut
        ? `killed after ${record.wallMs} ms of wall time`
        : `used ${record.cpuMs} ms of CPU time (limit ${limits.timeMs} ms)`,
    };
  }
  const memoryLimitKb = limits.memoryMb * 1024;
  // The stack may grow up to the memory limit, so blowing it shows up as a
  // segfault at peak memory — a recursion bug, not a memory budget problem.
  if (record.signal === 11 && record.rssKb >= memoryLimitKb * 0.9) {
    return {
      verdict: "runtime_error",
      message: `killed by SIGSEGV — likely a stack overflow (the stack shares the ${limits.memoryMb} MB limit)`,
    };
  }
  const stderr = record.stderr.toString("utf8");
  const allocationFailed = /std::bad_alloc|memory allocation of \d+ bytes failed/.test(stderr);
  // SIGKILL that kata-run didn't send is the cgroup OOM killer.
  if (record.rssKb > memoryLimitKb || allocationFailed || record.signal === 9) {
    return {
      verdict: "memory_limit",
      message: `peak ${Math.round(record.rssKb / 1024)} MB (limit ${limits.memoryMb} MB)`,
    };
  }
  if (record.signal !== null) {
    return { verdict: "runtime_error", message: `killed by ${SIGNAL_NAMES[record.signal] ?? `signal ${record.signal}`}` };
  }
  if (record.exit !== 0) {
    return { verdict: "runtime_error", message: `exited with code ${record.exit}` };
  }
  return null;
}

export interface PlannedTest {
  test: TestCase;
  hidden: boolean;
  custom?: boolean;
  label?: string;
}

export function evaluateTest(
  exercise: CodingExercise,
  planned: PlannedTest,
  index: number,
  record: RunRecord,
): TestOutcome {
  const base = {
    index,
    hidden: planned.hidden,
    ...(planned.custom ? { custom: true } : {}),
    ...(planned.label ? { label: planned.label } : {}),
    timeMs: record.cpuMs,
    memoryKb: record.rssKb,
  };
  const reveal = (outcome: Omit<TestOutcome, keyof typeof base>): TestOutcome => {
    if (planned.hidden) {
      return { ...base, verdict: outcome.verdict };
    }
    return { ...base, ...outcome };
  };

  const stderr = truncate(record.stderr.toString("utf8"));
  const failure = classifyRun(record, exercise.limits);
  if (record.exit === DRIVER_BAD_INPUT && exercise.mode !== "stdio" && exercise.mode !== "harness") {
    return { ...base, verdict: "internal_error", message: "the test driver couldn't read this test's input" };
  }

  const decoded = decodeTestOutput(exercise, planned.test, record.stdout);
  const stdout = truncate(decoded.userOutput);
  // Every TestCase variant has `expected` (string | value | value[]).
  const { expected, ...input } = planned.test as TestCase & { expected: JsonValue };
  const visible = {
    input: input as TestCase,
    ...(planned.custom ? {} : { expected }),
    ...(stdout ? { stdout } : {}),
    ...(stderr ? { stderr } : {}),
  };

  if (failure) {
    return reveal({ verdict: failure.verdict, message: failure.message, ...visible });
  }
  if (!decoded.ok) {
    return reveal({ verdict: "wrong_answer", message: decoded.error, ...visible });
  }
  const actual = typeof decoded.actual === "string" ? truncate(decoded.actual, 64 * 1024) : decoded.actual;
  if (planned.custom) {
    // Nothing to compare against: a custom run just shows the output.
    return reveal({ verdict: "accepted", ...visible, actual });
  }
  const ok = outputsMatch(exercise.mode, exercise.checker, expected, decoded.actual);
  return reveal({ verdict: ok ? "accepted" : "wrong_answer", ...visible, actual });
}
