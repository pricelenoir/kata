import type { JsonValue, Language, TestCase } from "./coding-exercise";

/** Matches the check constraint on public.submissions.source. */
export const MAX_SOURCE_BYTES = 64 * 1024;

export const VERDICTS = [
  "accepted",
  "wrong_answer",
  "time_limit",
  "memory_limit",
  "runtime_error",
  "compile_error",
  "output_limit",
  "internal_error",
] as const;

export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABEL: Record<Verdict, string> = {
  accepted: "Accepted",
  wrong_answer: "Wrong answer",
  time_limit: "Time limit exceeded",
  memory_limit: "Memory limit exceeded",
  runtime_error: "Runtime error",
  compile_error: "Compile error",
  output_limit: "Output limit exceeded",
  internal_error: "Judge error",
};

/** "run" judges the examples (plus optional custom input) and shows
 * everything; "submit" adds the hidden tests and stops at the first
 * failure. */
export type SubmissionKind = "run" | "submit";

/** One test's outcome as stored and shown. Hidden tests only ever carry the
 * verdict, measurements, and their label — never input, expected output, or
 * anything the program printed (which could echo the input back). */
export interface TestOutcome {
  index: number;
  hidden: boolean;
  /** Custom input supplied by the user on a run (no expected output). */
  custom?: boolean;
  label?: string;
  verdict: Verdict;
  timeMs: number;
  memoryKb: number;
  input?: TestCase;
  expected?: JsonValue;
  actual?: JsonValue;
  /** What the user's own code printed (function/design drivers separate it
   * from the result). */
  stdout?: string;
  stderr?: string;
  message?: string;
}

export interface JudgeResult {
  verdict: Verdict;
  passed: number;
  total: number;
  /** Slowest test, and peak memory across tests. */
  timeMs: number;
  memoryKb: number;
  compileOutput?: string;
  message?: string;
  tests: TestOutcome[];
}

export type SubmissionStatus = "queued" | "running" | "done" | "error";

/** A row of public.submissions as the browser reads it. */
export interface SubmissionRow {
  id: string;
  exercise_id: string;
  language: Language;
  kind: SubmissionKind;
  source: string;
  status: SubmissionStatus;
  verdict: Verdict | null;
  result: JudgeResult | null;
  created_at: string;
  finished_at: string | null;
}
