import type { Difficulty } from "@/types/question";

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export const DIFFICULTY_CLASS: Record<Difficulty, string> = {
  easy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  hard: "bg-red-500/10 text-red-400 border-red-500/30",
};
