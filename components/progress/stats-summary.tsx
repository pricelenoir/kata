"use client";

import { useProgress } from "@/lib/progress-store";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatsSummary() {
  const { getOverallStats, state, hydrated } = useProgress();

  if (!hydrated) {
    return <Skeleton className="h-[74px] w-full rounded-xl" />;
  }

  const stats = getOverallStats();

  return (
    <dl className="grid grid-cols-2 divide-border overflow-hidden rounded-xl border border-border bg-card/40 sm:grid-cols-4 sm:divide-x">
      <Stat label="Answered" value={stats.answered} suffix={`/ ${stats.total}`} />
      <Stat label="Accuracy" value={stats.answered > 0 ? `${stats.accuracy}%` : "–"} />
      <Stat label="Current streak" value={state.streak.current} suffix="days" highlight={state.streak.current > 0} />
      <Stat label="Best streak" value={state.streak.longest} suffix="days" />
    </dl>
  );
}

function Stat({
  label,
  value,
  suffix,
  highlight,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div className="px-5 py-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("text-2xl font-semibold tabular-nums tracking-tight", highlight ? "text-brand-gradient" : "text-foreground")}>
          {value}
        </span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </dd>
    </div>
  );
}
