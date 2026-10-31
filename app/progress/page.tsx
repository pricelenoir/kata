import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SiteHeader } from "@/components/layout/site-header";
import { CategoryProgressBar } from "@/components/progress/category-progress-bar";
import { MissedQuestionsList } from "@/components/progress/missed-questions-list";
import { StatsSummary } from "@/components/progress/stats-summary";
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
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <PageHeader
          title="Progress"
          description="Answers sync to your account when you're signed in, and stay in this browser otherwise."
          actions={<ResetProgressDialog />}
        />

        <StatsSummary />

        <div className="mt-6">
          <WeakestCategoryCallout />
        </div>

        <section className="mt-12 space-y-5 rounded-xl surface p-6">
          <h2 className="text-base font-semibold text-foreground">
            By category
          </h2>
          <div className="space-y-5">
            {CATEGORIES.map((id) => (
              <CategoryProgressBar key={id} meta={CATEGORY_META[id]} />
            ))}
          </div>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Review missed questions
          </h2>
          <MissedQuestionsList questions={getAllQuestionSummaries()} />
        </section>
      </main>
    </div>
  );
}
