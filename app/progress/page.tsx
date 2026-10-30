"use client";

import { SiteHeader } from "@/components/layout/site-header";
import { CategoryProgressBar } from "@/components/progress/category-progress-bar";
import { MissedQuestionsList } from "@/components/progress/missed-questions-list";
import { ResetProgressDialog } from "@/components/progress/reset-progress-dialog";
import { WeakestCategoryCallout } from "@/components/progress/weakest-category-callout";
import { Skeleton } from "@/components/ui/skeleton";
import { useProgress } from "@/lib/progress-store";
import { CATEGORIES, CATEGORY_META } from "@/types/category";

export default function ProgressPage() {
  const { getOverallStats, state, hydrated } = useProgress();

  return (
    <div className="flex flex-1 flex-col animate-in fade-in-0 duration-300">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Progress
            </h1>
            <p className="text-sm text-muted-foreground">
              Answer history syncs to your account when signed in, or stays
              local to this browser otherwise.
            </p>
          </div>
          <ResetProgressDialog />
        </div>

        {!hydrated ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : (
          <OverallStats
            stats={getOverallStats()}
            current={state.streak.current}
            longest={state.streak.longest}
          />
        )}

        <div className="mt-6">
          <WeakestCategoryCallout />
        </div>

        <section className="mt-10 space-y-5">
          <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            By category
          </h2>
          <div className="space-y-5">
            {CATEGORIES.map((id) => (
              <CategoryProgressBar key={id} meta={CATEGORY_META[id]} />
            ))}
          </div>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Review missed questions
          </h2>
          <MissedQuestionsList />
        </section>
      </main>
    </div>
  );
}

function OverallStats({
  stats,
  current,
  longest,
}: {
  stats: { answered: number; total: number; accuracy: number };
  current: number;
  longest: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Answered" value={`${stats.answered}/${stats.total}`} />
      <StatCard
        label="Accuracy"
        value={stats.answered > 0 ? `${stats.accuracy}%` : "—"}
      />
      <StatCard label="Current streak" value={`${current}d`} />
      <StatCard label="Best streak" value={`${longest}d`} />
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
