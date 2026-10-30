import type { QuestionAttempt } from "@/types/progress";
import type { QuestionSummary } from "@/types/question";

export interface RecommendedQuestion {
  question: QuestionSummary;
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
  questions: QuestionSummary[],
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
