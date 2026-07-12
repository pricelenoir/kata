import type { Category } from "./category";

export type Difficulty = "easy" | "medium" | "hard";

export type CodeLanguage = "cpp" | "text" | "bash";

export interface CodeSnippet {
  language: CodeLanguage;
  code: string;
  /** Shown as a tab label above the block, e.g. "main.cpp" */
  filename?: string;
  highlightLines?: number[];
}

interface QuestionBase {
  /** Stable slug: "{category}-{topic}-{NN}", e.g. "cpp-dangling-ref-01" */
  id: string;
  category: Category;
  difficulty: Difficulty;
  /** Short label for list views */
  title: string;
  /** Free-form metadata for future search/filter — not navigational */
  tags?: string[];
  prompt: string;
  /** Optional — some questions are pure scenario, no code */
  snippet?: CodeSnippet;
  /** Revealed after answering */
  explanation: string;
  references?: string[];
}

export type TraceAnswerFormat =
  | { kind: "multiple-choice"; choices: string[]; correctIndex: number }
  | { kind: "self-assessed"; canonicalAnswer: string };

// "Trace" covers any question format where you read/reason about code
// without writing — multiple-choice today, with room for other formats
// (e.g. fill-in-the-blank) as a sibling `type` later without renaming
// anything that already exists.
export interface TraceQuestion extends QuestionBase {
  type: "trace";
  answerFormat: TraceAnswerFormat;
}

export interface FillInBlankBlank {
  /** Matches the `N` in the `/*BLANK_N*\/` marker in `snippet.code`. */
  id: string;
  /** Accepted answer(s) — compared with whitespace normalized, case-sensitive
   * (C++ identifiers are case-sensitive). List more than one when there's a
   * reasonable alternate phrasing (e.g. `this == &other` and `&other == this`). */
  acceptedAnswers: string[];
}

// Fill-in-the-blank: the same code-reading skill as a trace question, but
// you type short expressions/statements into blanks marked `/*BLANK_N*/`
// in `snippet.code` instead of picking a choice. There's no compiler behind
// this (see types/coding-exercise.ts for where that would eventually live),
// so grading is a normalized string comparison against `blanks`, not a real
// compile — each blank's input is marked correct/incorrect immediately,
// same visual language as a trace question's multiple-choice feedback.
export interface FillInBlankQuestion extends QuestionBase {
  type: "fill-in-blank";
  snippet: CodeSnippet;
  blanks: FillInBlankBlank[];
  /** The fully filled-in reference version, shown after checking. */
  canonicalCode: string;
}

// Coding exercises (browsed as a filterable table, not the per-category
// trace-question flow) are a separate content type — see
// types/coding-exercise.ts and content/coding-exercises/. The compile/run
// judging backend and editor are still a future phase; only the browse
// table + a read-only preview page exist so far.
export type Question = TraceQuestion | FillInBlankQuestion;
