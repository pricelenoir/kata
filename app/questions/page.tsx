import { SiteHeader } from "@/components/layout/site-header";
import { QuestionsTable } from "@/components/question/questions-table";
import { NextQuestionCta } from "@/components/question/next-question-cta";
import { StatsSummary } from "@/components/progress/stats-summary";
import { getAllQuestions } from "@/lib/questions";
import { CATEGORIES, type Category } from "@/types/category";

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const questions = getAllQuestions();
  const { category: rawCategory } = await searchParams;
  const initialCategory = CATEGORIES.includes(rawCategory as Category)
    ? (rawCategory as Category)
    : "all";

  return (
    <div className="flex flex-1 flex-col animate-in fade-in-0 duration-300">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-10 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Prove you know it.
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Trace C++ and systems code like the compiler would.
          </p>
        </div>

        <div className="mb-6">
          <NextQuestionCta questions={questions} />
        </div>

        <div className="mb-8">
          <StatsSummary />
        </div>

        <QuestionsTable questions={questions} initialCategory={initialCategory} />
      </main>
    </div>
  );
}
