import { cn } from "@/lib/utils";
import type { Difficulty } from "@/types/question";

export const DIFFICULTY_LEVEL: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
const LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** Three ascending bars, filled up to the level. Monochrome on purpose:
 * difficulty reads from the shape, so no color is spent on it. */
export function DifficultyMeter({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  const level = DIFFICULTY_LEVEL[difficulty];
  return (
    <span aria-hidden className={cn("inline-flex h-3 items-end gap-[2px]", className)}>
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn("w-[3px] rounded-[1px]", bar <= level ? "bg-current" : "bg-current opacity-20")}
          style={{ height: `${4 + bar * 2.5}px` }}
        />
      ))}
    </span>
  );
}

/** Meter plus label, the one way difficulty is shown across the site. */
export function DifficultyLabel({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <DifficultyMeter difficulty={difficulty} className="text-foreground/70" />
      {LABEL[difficulty]}
    </span>
  );
}
