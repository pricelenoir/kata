import type { Category } from "@/types/category";
import type { Question } from "@/types/question";
import { cppQuestions } from "./cpp";
import { osQuestions } from "./os";
import { concurrencyQuestions } from "./concurrency";
import { networkingQuestions } from "./networking";
import { computerArchitectureQuestions } from "./computer-architecture";
import { designPatternsQuestions } from "./design-patterns";
import { compilersQuestions } from "./compilers";
import { gpuCudaQuestions } from "./gpu-cuda";
import { dsaQuestions } from "./dsa";

export const QUESTIONS_BY_CATEGORY: Record<Category, Question[]> = {
  cpp: cppQuestions,
  os: osQuestions,
  concurrency: concurrencyQuestions,
  networking: networkingQuestions,
  "computer-architecture": computerArchitectureQuestions,
  "design-patterns": designPatternsQuestions,
  compilers: compilersQuestions,
  "gpu-cuda": gpuCudaQuestions,
  dsa: dsaQuestions,
};

export const ALL_QUESTIONS: Question[] = Object.values(
  QUESTIONS_BY_CATEGORY,
).flat();

if (process.env.NODE_ENV !== "production") {
  const seen = new Set<string>();
  for (const q of ALL_QUESTIONS) {
    if (seen.has(q.id)) {
      throw new Error(`Duplicate question id detected: "${q.id}"`);
    }
    seen.add(q.id);
  }
}
