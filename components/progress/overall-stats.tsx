"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useProgress } from "@/lib/progress-store";

export function OverallStats() {
  const { getOverallStats, state, hydrated } = useProgress();

  if (!hydrated) {
    return <Skeleton className="h-24 w-full rounded-lg" />;
  }

  const stats = getOverallStats();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Answered" value={`${stats.answered}/${stats.total}`} />
      <StatCard
        label="Accuracy"
        value={stats.answered > 0 ? `${stats.accuracy}%` : "—"}
      />
      <StatCard label="Current streak" value={`${state.streak.current}d`} />
      <StatCard label="Best streak" value={`${state.streak.longest}d`} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-3">
      <div className="font-mono text-lg text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
