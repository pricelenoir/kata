import { ALL_QUESTIONS, QUESTIONS_BY_CATEGORY } from "@/content/questions";
import { seededShuffle } from "@/lib/shuffle";
import type { Category } from "@/types/category";
import type { Question } from "@/types/question";
import type { QuestionAttempt } from "@/types/progress";

export function getQuestionsByCategory(category: Category): Question[] {
  return QUESTIONS_BY_CATEGORY[category];
}

/** Interleaved across categories — content is authored grouped by category,
 * but the flat browse table shouldn't read as "all cpp, then all os, …". */
export function getAllQuestions(): Question[] {
  return seededShuffle(ALL_QUESTIONS, 1337);
}

export function getQuestionById(id: string): Question | undefined {
  return ALL_QUESTIONS.find((q) => q.id === id);
}

export function getAdjacentQuestionId(
  category: Category,
  currentId: string,
  direction: "next" | "prev",
): string | undefined {
  const list = getQuestionsByCategory(category);
  const idx = list.findIndex((q) => q.id === currentId);
  if (idx === -1) return undefined;
  const delta = direction === "next" ? 1 : -1;
  return list[idx + delta]?.id;
}

export function getQuestionIndex(category: Category, id: string): number {
  return getQuestionsByCategory(category).findIndex((q) => q.id === id);
}

export function getTotalQuestionCount(): number {
  return ALL_QUESTIONS.length;
}

export interface RecommendedQuestion {
  question: Question;
  /** "retry" when it was previously answered wrong, "unanswered" when it's
   * never been attempted. Retries take priority — a known gap is more
   * valuable to close than fresh material. */
  reason: "retry" | "unanswered";
}

/** Walks `questions` in the given order (typically the same interleaved
 * order the browse table renders, so "first" matches what a user actually
 * sees) and returns the single question most worth doing next: the first
 * incorrectly-answered one, or otherwise the first never-attempted one.
 * Returns undefined once every question has been answered correctly. */
export function getRecommendedQuestion(
  questions: Question[],
  attempts: Record<string, QuestionAttempt>,
): RecommendedQuestion | undefined {
  for (const question of questions) {
    if (attempts[question.id]?.status === "incorrect") {
      return { question, reason: "retry" };
    }
  }
  for (const question of questions) {
    if (!attempts[question.id]) {
      return { question, reason: "unanswered" };
    }
  }
  return undefined;
}
