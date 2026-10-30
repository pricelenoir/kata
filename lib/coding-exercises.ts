import "server-only";
import { CODING_EXERCISES } from "@/content/coding-exercises";
import { seededShuffle } from "@/lib/shuffle";
import type {
  CodingExercise,
  CodingExerciseSummary,
} from "@/types/coding-exercise";

/** Interleaved across categories — same reasoning as getAllQuestions(). */
export function getAllCodingExercises(): CodingExercise[] {
  return seededShuffle(CODING_EXERCISES, 1337);
}

export function getAllCodingExerciseSummaries(): CodingExerciseSummary[] {
  return getAllCodingExercises().map(
    ({ id, title, category, difficulty, language, tags }) => ({
      id,
      title,
      category,
      difficulty,
      language,
      ...(tags ? { tags } : {}),
    }),
  );
}

export function getCodingExerciseById(id: string): CodingExercise | undefined {
  return CODING_EXERCISES.find((e) => e.id === id);
}

export function getAllCodingExerciseTags(): string[] {
  const tags = new Set<string>();
  for (const exercise of CODING_EXERCISES) {
    exercise.tags?.forEach((tag) => tags.add(tag));
  }
  return Array.from(tags).sort();
}
