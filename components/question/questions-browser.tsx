"use client";

import { NextQuestionCta } from "@/components/question/next-question-cta";
import { QuestionsTable } from "@/components/question/questions-table";
import { StatsSummary } from "@/components/progress/stats-summary";
import type { Category } from "@/types/category";
import type { QuestionSummary } from "@/types/question";

/** One client boundary for the /questions page, so the summary list crosses
 * from server to client once instead of once per component that reads it. */
export function QuestionsBrowser({
  questions,
  initialCategory,
}: {
  questions: QuestionSummary[];
  initialCategory: Category | "all";
}) {
  return (
    <>
      <div className="mb-6">
        <NextQuestionCta questions={questions} />
      </div>

      <div className="mb-8">
        <StatsSummary />
      </div>

      <QuestionsTable questions={questions} initialCategory={initialCategory} />
    </>
  );
}
