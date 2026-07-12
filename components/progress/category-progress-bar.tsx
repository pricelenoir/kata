"use client";

import { useProgress } from "@/lib/progress-store";
import type { CategoryMeta } from "@/types/category";

export function CategoryProgressBar({ meta }: { meta: CategoryMeta }) {
  const { getCategoryStats } = useProgress();
  const stats = getCategoryStats(meta.id);
  const correctPct = stats.total === 0 ? 0 : (stats.correct / stats.total) * 100;
  const attemptedPct = stats.total === 0 ? 0 : (stats.answered / stats.total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{meta.label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {stats.correct} correct · {stats.answered}/{stats.total} answered
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-sky-500/10"
          style={{ width: `${attemptedPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-sky-400"
          style={{ width: `${correctPct}%` }}
        />
      </div>
    </div>
  );
}
