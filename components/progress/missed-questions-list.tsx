"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProgress } from "@/lib/progress-store";
import { cn } from "@/lib/utils";
import { CATEGORY_META } from "@/types/category";
import type { QuestionSummary } from "@/types/question";

const SHOWN = 8;

/** Questions whose latest answer was wrong, most recent first. */
export function MissedQuestionsList({ questions }: { questions: QuestionSummary[] }) {
  const { state, hydrated } = useProgress();
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  if (!hydrated) return null;

  const missed = Object.values(state.attempts)
    .filter((a) => a.status === "incorrect")
    .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
    .map((a) => ({ q: byId.get(a.questionId), at: a.attemptedAt }))
    .filter((m): m is { q: QuestionSummary; at: string } => Boolean(m.q));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Review queue</h2>
          <p className="text-sm text-muted-foreground">
            {missed.length === 0
              ? "Questions you miss land here."
              : `${missed.length} ${missed.length === 1 ? "question" : "questions"} you missed, most recent first.`}
          </p>
        </div>
        {missed.length > 0 && (
          <Button
            nativeButton={false}
            render={<Link href={`/questions/${missed[0].q.category}/${missed[0].q.id}`} />}
            className="glow-sky border-0 bg-brand-sky font-semibold text-background hover:bg-brand-sky/90"
          >
            Start review
            <ArrowRightIcon />
          </Button>
        )}
      </div>

      {missed.length === 0 && (
        <div className="surface flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-400">
            <CheckCheckIcon className="size-5" />
          </span>
          <p className="max-w-xs text-sm text-muted-foreground">
            You&apos;re all caught up. Missed questions show up here so you can come back to them.
          </p>
          <Link href="/questions?status=unanswered" className="text-sm font-medium text-brand-sky hover:underline underline-offset-4">
            Answer something new
          </Link>
        </div>
      )}

      {missed.length > 0 && (
        <ul className="surface divide-y divide-border/70 overflow-hidden rounded-2xl">
          {missed.slice(0, SHOWN).map(({ q, at }) => {
            const meta = CATEGORY_META[q.category];
            return (
              <li key={q.id}>
                <Link
                  href={`/questions/${q.category}/${q.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 transition-colors hover:bg-foreground/[0.03] sm:grid-cols-[1fr_9rem_4rem]"
                >
                  <span className="truncate text-sm text-foreground">{q.title}</span>
                  <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
                    <span className={cn("size-2 shrink-0 rounded-full", meta.dotClassName)} />
                    <span className="truncate">{meta.shortLabel}</span>
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    {new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </Link>
              </li>
            );
          })}
          {missed.length > SHOWN && (
            <li>
              <Link
                href="/questions?status=incorrect"
                className="block px-5 py-3 text-sm text-brand-sky transition-colors hover:bg-foreground/[0.03]"
              >
                See all {missed.length} missed questions
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
