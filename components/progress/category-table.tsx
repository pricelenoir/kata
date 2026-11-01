"use client";

import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getWeakestCategory } from "@/lib/progress-insights";
import { useProgress } from "@/lib/progress-store";
import { cn } from "@/lib/utils";
import { CATEGORIES, CATEGORY_META } from "@/types/category";

/** Every topic, weakest first: topics you've tried by lowest accuracy, then
 * untouched ones. Each row jumps into practicing that topic. */
export function CategoryTable() {
  const { getCategoryStats, hydrated } = useProgress();
  if (!hydrated) return <Skeleton className="h-96 w-full rounded-2xl" />;

  const rows = CATEGORIES.map((category) => ({ category, stats: getCategoryStats(category) }));
  const focus = getWeakestCategory(rows);
  rows.sort((a, b) => {
    const aTried = a.stats.answered > 0;
    const bTried = b.stats.answered > 0;
    if (aTried !== bTried) return aTried ? -1 : 1;
    if (aTried) return a.stats.accuracy - b.stats.accuracy || b.stats.answered - a.stats.answered;
    return a.stats.answered - b.stats.answered;
  });

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-foreground">By topic</h2>
        <p className="text-sm text-muted-foreground">Weakest first</p>
      </div>
      <div className="surface overflow-hidden rounded-2xl">
        <div className="hidden grid-cols-[minmax(10rem,14rem)_1fr_5.5rem_5.5rem_1rem] gap-4 border-b border-border px-5 py-2.5 text-xs text-muted-foreground sm:grid">
          <span>Topic</span>
          <span>Progress</span>
          <span className="text-right">Covered</span>
          <span className="text-right">Accuracy</span>
          <span />
        </div>
        <ul className="divide-y divide-border/70">
          {rows.map(({ category, stats }) => {
            const meta = CATEGORY_META[category];
            const answeredPct = stats.total ? (stats.answered / stats.total) * 100 : 0;
            const correctPct = stats.total ? (stats.correct / stats.total) * 100 : 0;
            const isFocus = focus?.category === category && focus.reason === "accuracy" && stats.accuracy < 100;
            return (
              <li key={category}>
                <Link
                  href={`/questions?category=${category}`}
                  className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-foreground/[0.03] sm:grid-cols-[minmax(10rem,14rem)_1fr_5.5rem_5.5rem_1rem]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className={cn("size-2 shrink-0 rounded-full", meta.dotClassName)} />
                    <span className="truncate text-sm font-medium text-foreground">{meta.label}</span>
                    {isFocus && (
                      <span className="shrink-0 rounded-full bg-brand-orange/15 px-2 py-0.5 text-xs font-medium text-brand-orange">
                        Focus
                      </span>
                    )}
                  </span>
                  <span className="text-right text-sm tabular-nums text-muted-foreground sm:hidden">
                    {stats.answered}/{stats.total}
                  </span>
                  <span
                    className="col-span-2 h-2 overflow-hidden rounded-full bg-foreground/[0.07] sm:col-span-1"
                    role="img"
                    aria-label={`${stats.correct} correct and ${stats.answered - stats.correct} missed of ${stats.total}`}
                  >
                    <span className="relative block h-full" style={{ width: `${answeredPct}%` }}>
                      <span className="absolute inset-0 rounded-full bg-red-400/50" />
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-brand-sky"
                        style={{ width: answeredPct ? `${(correctPct / answeredPct) * 100}%` : 0 }}
                      />
                    </span>
                  </span>
                  <span className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
                    {stats.answered > 0 && answeredPct < 1 ? "<1" : Math.round(answeredPct)}%
                  </span>
                  <span className="hidden text-right text-sm tabular-nums text-foreground sm:block">
                    {stats.answered ? `${stats.accuracy}%` : "–"}
                  </span>
                  <ChevronRightIcon className="hidden size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex items-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-brand-sky" /> Correct
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-red-400/50" /> Missed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-foreground/15" /> Not answered
        </span>
      </div>
    </section>
  );
}
