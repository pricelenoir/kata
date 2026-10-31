"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useProgress } from "@/lib/progress-store";
import { toLocalDate } from "@/lib/progress-logic";
import { cn } from "@/lib/utils";

const WEEKS = 53;

/** Headline numbers: an accuracy ring, coverage, and streaks, with the
 * activity heatmap underneath. */
export function ProgressOverview() {
  const { getOverallStats, state, hydrated, activityDays } = useProgress();

  if (!hydrated) return <Skeleton className="h-[19rem] w-full rounded-2xl" />;

  const stats = getOverallStats();
  const coverageRaw = stats.total === 0 ? 0 : (stats.answered / stats.total) * 100;
  const coverage = stats.answered > 0 && coverageRaw < 1 ? "<1" : String(Math.round(coverageRaw));

  return (
    <section className="surface rounded-2xl p-6 sm:p-8">
      <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <AccuracyRing value={stats.answered > 0 ? stats.accuracy : null} />
        <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          <Stat label="Answered" value={stats.answered} detail={`of ${stats.total}, ${coverage}% covered`} />
          <Stat label="Correct" value={stats.correct} detail={stats.answered > 0 ? `${stats.answered - stats.correct} missed` : "Nothing answered yet"} />
          <Stat
            label="Current streak"
            value={state.streak.current}
            detail={state.streak.current === 1 ? "day" : "days"}
            highlight={state.streak.current > 0}
          />
          <Stat label="Best streak" value={state.streak.longest} detail={state.streak.longest === 1 ? "day" : "days"} />
        </dl>
      </div>
      <div className="mt-8 border-t border-border pt-6">
        <ActivityHeatmap days={activityDays} />
      </div>
    </section>
  );
}

function Stat({ label, value, detail, highlight }: { label: string; value: number; detail: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-3xl font-semibold tabular-nums tracking-tight", highlight ? "text-brand-sky" : "text-foreground")}>
        {value}
      </dd>
      <dd className="mt-0.5 text-xs text-muted-foreground">{detail}</dd>
    </div>
  );
}

function AccuracyRing({ value }: { value: number | null }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = value === null ? 0 : (value / 100) * c;
  return (
    <div className="relative mx-auto size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-sky)" />
            <stop offset="100%" stopColor="var(--color-brand-orange)" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-foreground/[0.07]" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#ring)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{value === null ? "–" : `${value}%`}</div>
          <div className="text-xs text-muted-foreground">accuracy</div>
        </div>
      </div>
    </div>
  );
}

/** The last year as a grid of days, Sunday at the top of each column,
 * stretched to the card's width. */
function ActivityHeatmap({ days }: { days: string[] }) {
  const active = new Set(days);
  const today = new Date();
  const todayKey = toLocalDate(today);
  // Start on the Sunday WEEKS-1 weeks before this week's Sunday.
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7);

  const columns: { key: string; on: boolean; future: boolean }[][] = [];
  const months: { col: number; label: string }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = toLocalDate(date);
      if (d === 0 && date.getDate() <= 7) {
        months.push({ col: w, label: date.toLocaleDateString(undefined, { month: "short" }) });
      }
      col.push({ key, on: active.has(key), future: key > todayKey });
    }
    columns.push(col);
  }
  const recent = days.filter((d) => d >= toLocalDate(start)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">Activity</h2>
        <p className="text-sm text-muted-foreground">
          {recent} active {recent === 1 ? "day" : "days"} in the last year
        </p>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[640px]">
          <div className="relative mb-1.5 h-4">
            {months.map((m) => (
              <span
                key={m.col}
                className="absolute top-0 text-xs text-muted-foreground"
                style={{ left: `${(m.col / WEEKS) * 100}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
            {columns.flat().map((cell) => (
              <span
                key={cell.key}
                title={cell.future ? undefined : `${cell.key}${cell.on ? ": practiced" : ""}`}
                className={cn(
                  "aspect-square w-full rounded-[3px]",
                  cell.future
                    ? "bg-transparent"
                    : cell.on
                      ? "bg-brand-sky shadow-[0_0_8px_-1px] shadow-brand-sky/60"
                      : "bg-foreground/[0.06]",
                  cell.key === todayKey && "ring-1 ring-foreground/40",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
