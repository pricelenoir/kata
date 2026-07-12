"use client";

import Link from "next/link";
import { useProgress } from "@/lib/progress-store";
import { getQuestionById } from "@/lib/questions";
import { CATEGORY_META } from "@/types/category";

export function MissedQuestionsList() {
  const { state, hydrated } = useProgress();

  if (!hydrated) return null;

  const missed = Object.values(state.attempts)
    .filter((a) => a.status === "incorrect")
    .map((a) => getQuestionById(a.questionId))
    .filter((q): q is NonNullable<typeof q> => Boolean(q));

  if (missed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No missed questions yet — nice.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
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
