"use client";

import { NextQuestionCta } from "@/components/question/next-question-cta";
import { QuestionsTable, type StatusFilter } from "@/components/question/questions-table";
import { CompactStats } from "@/components/progress/compact-stats";
import type { Category } from "@/types/category";
import type { QuestionSummary } from "@/types/question";

/** One client boundary for the /questions page, so the summary list crosses
 * from server to client once instead of once per component that reads it. */
export function QuestionsBrowser({
  questions,
  initialCategory,
  initialStatus,
}: {
  questions: QuestionSummary[];
  initialCategory: Category | "all";
  initialStatus: StatusFilter;
}) {
  return (
    <>
      <div className="mb-10 grid gap-4 lg:grid-cols-[1fr_auto]">
        <NextQuestionCta questions={questions} />
        <CompactStats />
      </div>

      <QuestionsTable questions={questions} initialCategory={initialCategory} initialStatus={initialStatus} />
    </>
  );
}
