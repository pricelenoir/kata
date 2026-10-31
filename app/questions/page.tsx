import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SiteHeader } from "@/components/layout/site-header";
import { QuestionsBrowser } from "@/components/question/questions-browser";
import type { StatusFilter } from "@/components/question/questions-table";

const STATUSES: StatusFilter[] = ["all", "unanswered", "correct", "incorrect"];
import { getAllQuestionSummaries } from "@/lib/questions";
import { CATEGORIES, type Category } from "@/types/category";

export const metadata: Metadata = {
  title: "Questions",
};

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const questions = getAllQuestionSummaries();
  const { category: rawCategory, status: rawStatus } = await searchParams;
  const initialStatus = STATUSES.includes(rawStatus as StatusFilter) ? (rawStatus as StatusFilter) : "all";
  const initialCategory = CATEGORIES.includes(rawCategory as Category)
    ? (rawCategory as Category)
    : "all";

  return (
    <div className="flex flex-1 flex-col animate-in fade-in-0 duration-300">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <PageHeader
          title="Questions"
          description="Read the code, predict what happens, then see why. Hand-written questions on C++, Rust, and the systems underneath them."
        />

        <QuestionsBrowser
          questions={questions}
          initialCategory={initialCategory}
          initialStatus={initialStatus}
        />
      </main>
    </div>
  );
}
