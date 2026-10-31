"use client";

import Link from "next/link";
import { ArrowRightIcon, TargetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWeakestCategory } from "@/lib/progress-insights";
import { useProgress } from "@/lib/progress-store";
import { CATEGORIES, CATEGORY_META } from "@/types/category";

export function WeakestCategoryCallout() {
  const { getCategoryStats, hydrated } = useProgress();

  if (!hydrated) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  const entries = CATEGORIES.map((category) => ({
    category,
    stats: getCategoryStats(category),
  }));
  const weakest = getWeakestCategory(entries);

  if (!weakest) return null;

  const meta = CATEGORY_META[weakest.category];
  const description =
    weakest.reason === "accuracy"
      ? `${weakest.stats.correct} of ${weakest.stats.answered} correct (${weakest.stats.accuracy}%). Your lowest accuracy so far.`
      : `${weakest.stats.answered}/${weakest.stats.total} answered. Your least-practiced topic so far.`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-brand-gradient rounded-xl px-5 py-4">
      <div className="flex items-start gap-3">
        <TargetIcon className="mt-0.5 size-4 shrink-0 text-brand-orange" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-brand-orange">
            {weakest.reason === "accuracy" ? "Focus area" : "Start here"}
          </p>
          <p className="text-base font-semibold text-foreground">{meta.label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href={`/questions?category=${weakest.category}`} />}
      >
        Practice {meta.shortLabel}
        <ArrowRightIcon />
      </Button>
    </div>
  );
}
