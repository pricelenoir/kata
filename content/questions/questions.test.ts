import { describe, expect, it } from "vitest";
import { ALL_QUESTIONS, QUESTIONS_BY_CATEGORY } from "@/content/questions";
import { CATEGORIES } from "@/types/category";

// Structural checks over the hand-written question bank — the kind of
// mistake that's easy to make in a 100 KB content file and only shows up
// as a broken page (or a silently wrong answer key) in production.

const BLANK_MARKER = /\/\*BLANK_(\d+)\*\//g;

describe("question bank", () => {
  it("has unique ids", () => {
    const seen = new Set<string>();
    const dupes = ALL_QUESTIONS.filter((q) => {
      if (seen.has(q.id)) return true;
      seen.add(q.id);
      return false;
    }).map((q) => q.id);
    expect(dupes).toEqual([]);
  });

  it("files every question under its own category", () => {
    for (const category of CATEGORIES) {
      const misfiled = QUESTIONS_BY_CATEGORY[category]
        .filter((q) => q.category !== category)
        .map((q) => q.id);
      expect(misfiled, category).toEqual([]);
    }
  });

  it("uses URL-safe ids", () => {
    const bad = ALL_QUESTIONS.filter((q) => !/^[a-z0-9-]+$/.test(q.id)).map(
      (q) => q.id,
    );
    expect(bad).toEqual([]);
  });

  it("has non-empty title, prompt, and explanation", () => {
    const bad = ALL_QUESTIONS.filter(
      (q) => !q.title.trim() || !q.prompt.trim() || !q.explanation.trim(),
    ).map((q) => q.id);
    expect(bad).toEqual([]);
  });

  it("has a valid answer key for every multiple-choice question", () => {
    const problems: string[] = [];
    for (const q of ALL_QUESTIONS) {
      if (q.type !== "trace" || q.answerFormat.kind !== "multiple-choice") {
        continue;
      }
      const { choices, correctIndex } = q.answerFormat;
      if (choices.length < 2) problems.push(`${q.id}: fewer than 2 choices`);
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= choices.length) {
        problems.push(`${q.id}: correctIndex ${correctIndex} out of range`);
      }
      const normalized = choices.map((c) => c.trim());
      if (new Set(normalized).size !== normalized.length) {
        problems.push(`${q.id}: duplicate choices`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("matches fill-in-blank markers to declared blanks", () => {
    const problems: string[] = [];
    for (const q of ALL_QUESTIONS) {
      if (q.type !== "fill-in-blank") continue;
      const markerIds = [...q.snippet.code.matchAll(BLANK_MARKER)].map((m) => m[1]);
      const blankIds = q.blanks.map((b) => b.id);
      if ([...markerIds].sort().join() !== [...blankIds].sort().join()) {
        problems.push(`${q.id}: markers [${markerIds}] vs blanks [${blankIds}]`);
      }
      if (q.blanks.some((b) => b.acceptedAnswers.length === 0)) {
        problems.push(`${q.id}: blank with no accepted answers`);
      }
      // The reveal highlights blank lines by line number, which only works
      // if filling a blank never adds or removes a line.
      const templateLines = q.snippet.code.split("\n").length;
      const canonicalLines = q.canonicalCode.split("\n").length;
      if (templateLines !== canonicalLines) {
        problems.push(
          `${q.id}: template has ${templateLines} lines, canonical has ${canonicalLines}`,
        );
      }
    }
    expect(problems).toEqual([]);
  });

  it("only highlights lines that exist", () => {
    const problems: string[] = [];
    for (const q of ALL_QUESTIONS) {
      const lines = q.snippet?.code.split("\n").length ?? 0;
      for (const n of q.snippet?.highlightLines ?? []) {
        if (n < 1 || n > lines) problems.push(`${q.id}: line ${n} of ${lines}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
