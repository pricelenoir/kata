"use client";

import { useProgress } from "@/lib/progress-store";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsSummary() {
  const { getOverallStats, state, hydrated } = useProgress();

  if (!hydrated) {
    return <Skeleton className="h-16 w-full rounded-lg" />;
  }

  const stats = getOverallStats();

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border border-border/60 bg-card/50 px-5 py-4 font-mono text-sm">
      <Stat label="answered" value={`${stats.answered}/${stats.total}`} />
      <Stat
        label="accuracy"
        value={stats.answered > 0 ? `${stats.accuracy}%` : "—"}
      />
      <Stat
        label="streak"
        value={`${state.streak.current}d`}
        accent={state.streak.current > 0}
      />
      <Stat label="best streak" value={`${state.streak.longest}d`} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={
          accent ? "text-sky-400" : "text-foreground"
        }
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
