import type { CodingExercise, Language } from "@/types/coding-exercise";
import { cppHarness } from "./cpp";
import { rustHarness } from "./rust";
import type { Harness } from "./types";

export const HARNESSES: Record<Language, Harness> = {
  cpp: cppHarness,
  rust: rustHarness,
};

export function starterCode(exercise: CodingExercise, language: Language): string {
  return exercise.mode === "stdio" || exercise.mode === "harness"
    ? exercise.starterCode[language]
    : HARNESSES[language].starter(exercise);
}
