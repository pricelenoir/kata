import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { CategoryProgressBar } from "@/components/progress/category-progress-bar";
import { MissedQuestionsList } from "@/components/progress/missed-questions-list";
import { OverallStats } from "@/components/progress/overall-stats";
import { ResetProgressDialog } from "@/components/progress/reset-progress-dialog";
import { WeakestCategoryCallout } from "@/components/progress/weakest-category-callout";
import { getAllQuestionSummaries } from "@/lib/questions";
import { CATEGORIES, CATEGORY_META } from "@/types/category";

export const metadata: Metadata = {
  title: "Progress",
};

export default function ProgressPage() {
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

        <OverallStats />

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
          <MissedQuestionsList questions={getAllQuestionSummaries()} />
        </section>
      </main>
    </div>
  );
}
