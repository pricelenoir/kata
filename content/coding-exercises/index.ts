import type { CodingExercise } from "@/types/coding-exercise";
import { spinLock } from "./spin-lock";

// Public exercise statements only. Hidden tests and reference solutions are
// kept out of this (public) repository — see TestBundle in
// types/coding-exercise.ts.
export const CODING_EXERCISES: CodingExercise[] = [spinLock];
