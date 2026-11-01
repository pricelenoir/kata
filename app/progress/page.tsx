import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SiteHeader } from "@/components/layout/site-header";
import { CategoryTable } from "@/components/progress/category-table";
import { MissedQuestionsList } from "@/components/progress/missed-questions-list";
import { ProgressOverview } from "@/components/progress/progress-overview";
import { ResetProgressDialog } from "@/components/progress/reset-progress-dialog";
import { getAllQuestionSummaries } from "@/lib/questions";

export const metadata: Metadata = {
  title: "Progress",
};

export default function ProgressPage() {
  return (
    <div className="flex flex-1 flex-col animate-in fade-in-0 duration-300">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-12 px-4 py-12 sm:px-6">
        <PageHeader
          title="Progress"
          description="Answers sync to your account when you're signed in, and stay in this browser otherwise."
        />
        <ProgressOverview />
        <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr]">
          <CategoryTable />
          <MissedQuestionsList questions={getAllQuestionSummaries()} />
        </div>
        <section className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
          <div>
            <h2 className="text-sm font-medium text-foreground">Start over</h2>
            <p className="text-sm text-muted-foreground">Clears every answer, your accuracy, and your streaks.</p>
          </div>
          <ResetProgressDialog />
        </section>
      </main>
    </div>
  );
}
