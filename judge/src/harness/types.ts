import type { CodingExercise, DesignExercise, FunctionExercise } from "@/types/coding-exercise";

/** Per-language glue between a language-neutral exercise and real code. */
export interface Harness {
  /** What the editor starts with for function/design exercises. */
  starter(exercise: FunctionExercise | DesignExercise): string;
  /** The complete program to compile: the user's code plus a generated
   * driver that reads wire-format tests (see codec.ts) and reports results.
   * User code always comes first so compiler line numbers match the editor. */
  program(exercise: CodingExercise, userSource: string): string;
}
