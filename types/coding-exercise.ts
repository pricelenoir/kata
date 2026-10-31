import type { Category } from "./category";
import type { Difficulty } from "./question";

export const LANGUAGES = ["cpp", "rust"] as const;

export type Language = (typeof LANGUAGES)[number];

export interface LanguageMeta {
  id: Language;
  label: string;
  /** Editor/download filename for the user's solution. */
  filename: string;
  badgeClassName: string;
}

export const LANGUAGE_META: Record<Language, LanguageMeta> = {
  cpp: {
    id: "cpp",
    label: "C++",
    filename: "solution.cpp",
    badgeClassName: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  },
  rust: {
    id: "rust",
    label: "Rust",
    filename: "solution.rs",
    badgeClassName: "bg-red-500/10 text-red-400 border-red-500/30",
  },
};

// ---- Values and signatures ----
//
// Function and design exercises are language-neutral: a signature in these
// types is turned into starter code and a test driver per language (see
// judge/src/harness/), and test values are plain JSON.

export type JsonValue = null | boolean | number | string | JsonValue[];

export const SCALAR_TYPES = ["int", "long", "double", "bool", "string"] as const;
export type ScalarType = (typeof SCALAR_TYPES)[number];
export type ValueType = ScalarType | `${ScalarType}[]` | `${ScalarType}[][]`;

export interface Param {
  name: string;
  type: ValueType;
}

export interface FunctionSignature {
  name: string;
  params: Param[];
  returns: ValueType;
}

export interface MethodSignature {
  name: string;
  params: Param[];
  returns: ValueType | "void";
}

export interface DesignSignature {
  className: string;
  constructorParams: Param[];
  methods: MethodSignature[];
}

// ---- Tests ----

export interface FunctionTest {
  args: JsonValue[];
  expected: JsonValue;
}

export interface DesignCall {
  method: string;
  args: JsonValue[];
}

/** One object, constructed with `constructorArgs`, then driven through
 * `calls` in order. `expected[i]` is the return value of `calls[i]` (null
 * for void methods). */
export interface DesignTest {
  constructorArgs: JsonValue[];
  calls: DesignCall[];
  expected: JsonValue[];
}

export interface StdioTest {
  stdin: string;
  expected: string;
}

export type TestCase = FunctionTest | DesignTest | StdioTest;

/** How actual output is compared to expected. Defaults to "exact": deep
 * equality for values; for stdio, equality after trimming trailing
 * whitespace on each line and trailing blank lines. */
export type Checker =
  | { kind: "exact" }
  | { kind: "float"; tolerance: number }
  /** Order of the top-level array doesn't matter. */
  | { kind: "unordered" };

export interface Limits {
  /** CPU time per test case, summed across threads. */
  timeMs: number;
  memoryMb: number;
  /** CPUs available to the program (default 1). Concurrency exercises need
   * more than one for threads to actually run in parallel. */
  cpus?: number;
}

// ---- Exercises ----
//
// This is the public half of an exercise: everything here is shown on the
// site. Hidden tests, their expected outputs, and reference solutions live
// in a separate private repository and reach the judge as a test bundle
// (see TestBundle) — never in this codebase or the web bundle.

interface ExerciseBase {
  /** Stable URL slug. */
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  tags?: string[];
  /** Paragraphs separated by blank lines; `inline code` like questions. */
  prompt: string;
  constraints?: string[];
  limits: Limits;
  checker?: Checker;
}

export interface FunctionExercise extends ExerciseBase {
  mode: "function";
  signature: FunctionSignature;
  examples: FunctionTest[];
}

export interface DesignExercise extends ExerciseBase {
  mode: "design";
  signature: DesignSignature;
  examples: DesignTest[];
}

export interface StdioExercise extends ExerciseBase {
  mode: "stdio";
  starterCode: Record<Language, string>;
  examples: StdioTest[];
}

/** Systems exercises with their own test program: the user implements an
 * interface (a lock, an allocator, a queue…) and a per-language driver
 * exercises it — spawning threads, checking invariants — with parameters
 * read from stdin, printing what it observed. The driver is public and shown
 * on the page; tests are stdin/stdout pairs, like stdio exercises. */
export interface HarnessExercise extends ExerciseBase {
  mode: "harness";
  starterCode: Record<Language, string>;
  driver: Record<Language, string>;
  examples: StdioTest[];
}

export type CodingExercise =
  | FunctionExercise
  | DesignExercise
  | StdioExercise
  | HarnessExercise;

export type ExerciseMode = CodingExercise["mode"];

/** A hidden test as published to the judge. `label` is the only thing a
 * user ever sees about it, and only when it fails — e.g. "empty input" or
 * "n = 200,000" — so a failure is still instructive without giving away
 * the data. */
export type HiddenTest = TestCase & { label?: string };

export interface TestBundle {
  exerciseId: string;
  tests: HiddenTest[];
}

/** What the browse table gets. */
export type CodingExerciseSummary = Pick<
  CodingExercise,
  "id" | "title" | "category" | "difficulty" | "tags" | "mode"
> & { languages: Language[] };
