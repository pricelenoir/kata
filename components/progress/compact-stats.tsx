"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useProgress } from "@/lib/progress-store";

/** Three numbers beside the "up next" card. The full picture lives on
 * /progress. */
export function CompactStats() {
  const { getOverallStats, state, hydrated } = useProgress();

  if (!hydrated) return <Skeleton className="h-full min-h-24 w-full rounded-xl lg:w-80" />;

  const stats = getOverallStats();
  const items = [
    { label: "Answered", value: stats.answered, suffix: `/ ${stats.total}` },
    { label: "Accuracy", value: stats.answered > 0 ? `${stats.accuracy}%` : "–" },
    { label: "Streak", value: state.streak.current, suffix: state.streak.current === 1 ? "day" : "days" },
  ];

  return (
    <dl className="surface grid grid-cols-3 divide-x divide-border rounded-xl lg:w-80">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col justify-center px-4 py-4">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-semibold tabular-nums tracking-tight text-foreground">{item.value}</span>
            {item.suffix && <span className="text-xs text-muted-foreground">{item.suffix}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
