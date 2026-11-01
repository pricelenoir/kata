import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { CodeBlock } from "@/components/question/code-block";
import { FillInBlankInteractive } from "@/components/question/fill-in-blank-interactive";
import { QuestionInteractive } from "@/components/question/question-interactive";
import { QuestionNav } from "@/components/question/question-nav";
import { DetailHeader } from "@/components/layout/detail-header";
import { CATEGORIES, CATEGORY_META, type Category } from "@/types/category";
import { getAllQuestions, getQuestionById } from "@/lib/questions";
import { tokenizeCode } from "@/lib/code-highlight";
import type { FillInBlankQuestion } from "@/types/question";

type Params = Promise<{ category: string; questionId: string }>;

// Every question is known at build time, so all of them are prerendered
// (syntax highlighting included) and anything else is a static 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllQuestions().map((q) => ({
    category: q.category,
    questionId: q.id,
  }));
}

function resolveQuestion(raw: string, questionId: string) {
  if (!CATEGORIES.includes(raw as Category)) return undefined;
  const question = getQuestionById(questionId);
  if (!question || question.category !== raw) return undefined;
  return question;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { category, questionId } = await params;
  const question = resolveQuestion(category, questionId);
  if (!question) return {};
  return {
    title: question.title,
    description: `${CATEGORY_META[question.category].label} · ${question.difficulty} — ${question.prompt.replace(/`/g, "").slice(0, 150)}`,
  };
}

export default async function QuestionPage({ params }: { params: Params }) {
  const { category: raw, questionId } = await params;
  const question = resolveQuestion(raw, questionId);
  if (!question) notFound();
  const category = question.category;


  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <DetailHeader
          section={{ label: "Questions", href: "/questions" }}
          category={category}
          difficulty={question.difficulty}
          title={question.title}
          prompt={question.prompt}
        />

        <div className="mt-8 space-y-6">
          {question.type === "fill-in-blank" ? (
            <FillInBlankQuestionBlock question={question} />
          ) : (
            <>
              {question.snippet && <CodeBlock snippet={question.snippet} />}
              <QuestionInteractive question={question} />
            </>
          )}
        </div>

        <div className="mt-10">
          <QuestionNav category={category} questionId={question.id} />
        </div>
      </main>
    </div>
  );
}

async function FillInBlankQuestionBlock({
  question,
}: {
  question: FillInBlankQuestion;
}) {
  const templateTokens = await tokenizeCode(question.snippet);

  // Blanks land on the same line numbers in canonicalCode as in the
  // template (a blank never adds/removes a line), so scanning the template
  // for marker lines tells us which lines to highlight in the reveal.
  const blankLines = question.snippet.code
    .split("\n")
    .map((line, i) => (/\/\*BLANK_\d+\*\//.test(line) ? i + 1 : null))
    .filter((n): n is number => n !== null);

  return (
    <FillInBlankInteractive
      question={question}
      templateTokens={templateTokens}
      canonicalBlock={
        <CodeBlock
          snippet={{
            language: question.snippet.language,
            code: question.canonicalCode,
            highlightLines: blankLines,
          }}
        />
      }
    />
  );
}
