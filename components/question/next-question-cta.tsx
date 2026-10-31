"use client";

import Link from "next/link";
import { ArrowRightIcon, PartyPopperIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DIFFICULTY_CLASS } from "@/lib/difficulty";
import { useProgress } from "@/lib/progress-store";
import { getRecommendedQuestion } from "@/lib/recommendation";
import { CATEGORY_META } from "@/types/category";
import type { QuestionSummary } from "@/types/question";

export function NextQuestionCta({
  questions,
}: {
  questions: QuestionSummary[];
}) {
  const { state, hydrated } = useProgress();

  if (!hydrated) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  const recommended = getRecommendedQuestion(questions, state.attempts);

  if (!recommended) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 px-5 py-4">
        <PartyPopperIcon className="size-5 shrink-0 text-emerald-400" />
        <p className="text-sm text-foreground">
          You&apos;ve answered every question correctly. Nice work — check{" "}
          <Link href="/progress" className="text-sky-400 hover:text-sky-300">
            your progress
          </Link>{" "}
          or reset to drill again.
        </p>
      </div>
    );
  }

  const { question, reason } = recommended;
  const meta = CATEGORY_META[question.category];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-sky-500/30 bg-sky-500/5 px-5 py-4">
      <div className="space-y-1.5">
        <p className="font-mono text-xs uppercase tracking-wide text-sky-400">
          {reason === "retry" ? "Retry — missed last time" : "Up next"}
        </p>
        <p className="text-sm font-medium text-foreground">{question.title}</p>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`font-mono text-[10px] ${meta.badgeClassName}`}
          >
            {meta.shortLabel}
          </Badge>
          <Badge
            variant="outline"
            className={`font-mono text-[10px] uppercase ${DIFFICULTY_CLASS[question.difficulty]}`}
          >
            {question.difficulty}
          </Badge>
        </div>
      </div>
      <Button
        nativeButton={false}
        render={<Link href={`/questions/${question.category}/${question.id}`} />}
      >
        Jump in
        <ArrowRightIcon />
      </Button>
    </div>
  );
}
