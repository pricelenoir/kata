import { cn } from "@/lib/utils";
import { DIFFICULTY_CLASS } from "@/lib/difficulty";
import { CATEGORY_META, type Category } from "@/types/category";
import type { Difficulty } from "@/types/question";

/** Small colored label for metadata (topic, difficulty, language). */
export function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium leading-4",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function CategoryTag({ category, short = false }: { category: Category; short?: boolean }) {
  const meta = CATEGORY_META[category];
  return <Tag className={meta.badgeClassName}>{short ? meta.shortLabel : meta.label}</Tag>;
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export function DifficultyTag({ difficulty }: { difficulty: Difficulty }) {
  return <Tag className={DIFFICULTY_CLASS[difficulty]}>{DIFFICULTY_LABEL[difficulty]}</Tag>;
}
