import "server-only";
import { ALL_QUESTIONS, QUESTIONS_BY_CATEGORY } from "@/content/questions";
import { seededShuffle } from "@/lib/shuffle";
import { CATEGORIES, type Category } from "@/types/category";
import {
  toQuestionSummary,
  type Question,
  type QuestionSummary,
} from "@/types/question";

export function getQuestionsByCategory(category: Category): Question[] {
  return QUESTIONS_BY_CATEGORY[category];
}

/** Interleaved across categories — content is authored grouped by category,
 * but the flat browse table shouldn't read as "all cpp, then all os, …". */
export function getAllQuestions(): Question[] {
  return seededShuffle(ALL_QUESTIONS, 1337);
}

/** Same order as getAllQuestions(), slimmed down for client components. */
export function getAllQuestionSummaries(): QuestionSummary[] {
  return getAllQuestions().map(toQuestionSummary);
}

/** Just the ids, per category — all the progress store needs to compute
 * answered/total stats without the question bank itself. */
export function getQuestionIdsByCategory(): Record<Category, string[]> {
  return Object.fromEntries(
    CATEGORIES.map((c) => [c, QUESTIONS_BY_CATEGORY[c].map((q) => q.id)]),
  ) as Record<Category, string[]>;
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
