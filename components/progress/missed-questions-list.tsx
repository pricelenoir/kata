"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useProgress } from "@/lib/progress-store";
import { CATEGORY_META } from "@/types/category";
import type { QuestionSummary } from "@/types/question";

export function MissedQuestionsList({
  questions,
}: {
  questions: QuestionSummary[];
}) {
  const { state, hydrated } = useProgress();
  const byId = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );

  if (!hydrated) return null;

  const missed = Object.values(state.attempts)
    .filter((a) => a.status === "incorrect")
    .map((a) => byId.get(a.questionId))
    .filter((q): q is QuestionSummary => Boolean(q));

  if (missed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No missed questions yet — nice.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl surface">
      {missed.map((q) => (
        <li key={q.id}>
          <Link
            href={`/questions/${q.category}/${q.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
          >
            <span className="truncate text-foreground">{q.title}</span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {CATEGORY_META[q.category].label}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
