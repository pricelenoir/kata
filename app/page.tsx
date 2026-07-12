import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { CodeBlock } from "@/components/question/code-block";
import { getQuestionById, getTotalQuestionCount } from "@/lib/questions";
import { getAllCodingExercises } from "@/lib/coding-exercises";
import { CATEGORIES } from "@/types/category";

const FEATURED_QUESTION_ID = "cpp-const-pointer-02";

export default function LandingPage() {
  const questionCount = getTotalQuestionCount();
  const codingCount = getAllCodingExercises().length;
  const featured = getQuestionById(FEATURED_QUESTION_ID);

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <section className="mb-16 grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <div
              aria-hidden
              className="animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both font-mono text-6xl font-semibold tracking-tight text-foreground duration-700 sm:text-7xl"
            >
              kata
              <span
                className="text-sky-400"
                style={{ animation: "cursor-blink 1s step-end 0.7s infinite" }}
              >
                /
              </span>
            </div>
            <h1 className="animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both text-4xl font-semibold tracking-tight text-foreground delay-150 duration-700">
              Train like it&apos;s the interview.
            </h1>
            <p className="animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both text-base leading-relaxed text-muted-foreground delay-300 duration-700">
              A personal prep ground for deep C++ and systems interviews.
              Trace code like the compiler would, then write and run real
              solutions.
            </p>
          </div>

          {featured?.snippet && (
            <div className="animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both space-y-2 delay-500 duration-700">
              <p className="font-mono text-xs text-muted-foreground">
                {featured.prompt}
              </p>
              <CodeBlock snippet={featured.snippet} />
              <Link
                href={`/questions/${featured.category}/${featured.id}`}
                className="inline-flex items-center gap-1 font-mono text-xs text-sky-400 transition-colors hover:text-sky-300"
              >
                trace it yourself &rarr;
              </Link>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NavCard
            href="/questions"
            accent="text-sky-400"
            title="Questions"
            description="Predict-the-output trace questions across C++, OS, concurrency, networking, and more."
            meta={`${questionCount} questions · ${CATEGORIES.length} categories`}
            delay="delay-500"
          />
          <NavCard
            href="/coding"
            accent="text-emerald-400"
            title="Coding Exercises"
            description="Write and run real solutions, judged against test cases. Filter by language, difficulty, or topic."
            meta={`${codingCount} exercises`}
            delay="delay-700"
          />
          <NavCard
            href="/progress"
            accent="text-amber-400"
            title="Progress"
            description="Track your accuracy, your streak, and what to review next."
            meta="Your stats"
            delay="delay-1000"
          />
        </section>
      </main>
    </div>
  );
}

function NavCard({
  href,
  accent,
  title,
  description,
  meta,
  delay,
}: {
  href: string;
  accent: string;
  title: string;
  description: string;
  meta: string;
  delay: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex h-full flex-col justify-between gap-6 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-colors animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-700 ${delay} hover:ring-foreground/20`}
    >
      <div className="space-y-2">
        <h2 className={`font-mono text-sm font-medium ${accent}`}>
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{meta}</span>
        <span className="transition-transform group-hover:translate-x-0.5">
          &rarr;
        </span>
      </div>
    </Link>
  );
}
