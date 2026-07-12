import type { Category } from "./category";
import type { Difficulty } from "./question";

export const LANGUAGES = ["cpp"] as const;

export type Language = (typeof LANGUAGES)[number];

export interface LanguageMeta {
  id: Language;
  label: string;
  badgeClassName: string;
}

export const LANGUAGE_META: Record<Language, LanguageMeta> = {
  cpp: {
    id: "cpp",
    label: "C++",
    badgeClassName: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  },
};

export interface TestCase {
  input: string;
  expectedOutput: string;
  /** Hidden test cases run at submit time but aren't shown to the user. */
  hidden?: boolean;
}

export interface CodingExercise {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  language: Language;
  tags?: string[];
  prompt: string;
  starterCode: string;
  testCases: TestCase[];
  timeLimitMs: number;
}
