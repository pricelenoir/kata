import { describe, expect, it } from "vitest";
import { CODING_EXERCISES } from "@/content/coding-exercises";
import { LANGUAGES } from "@/types/coding-exercise";
import { starterCode } from "@/judge/src/harness";
import { validateTest } from "@/judge/src/wire";

describe("coding exercise statements", () => {
  it("have unique, URL-safe ids", () => {
    const ids = CODING_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !/^[a-z0-9-]+$/.test(id))).toEqual([]);
  });

  it.each(CODING_EXERCISES.map((e) => [e.id, e] as const))("%s has valid examples", (_id, exercise) => {
    expect(exercise.examples.length).toBeGreaterThan(0);
    const problems = exercise.examples.flatMap((t, i) =>
      validateTest(exercise, t, { requireExpected: true }).map((p) => `example ${i}: ${p}`),
    );
    expect(problems).toEqual([]);
  });

  it.each(CODING_EXERCISES.map((e) => [e.id, e] as const))("%s has starter code (and a driver) for every language", (_id, exercise) => {
    for (const language of LANGUAGES) {
      expect(starterCode(exercise, language).trim(), language).not.toBe("");
      if (exercise.mode === "harness") expect(exercise.driver[language].trim(), language).not.toBe("");
    }
  });
});
