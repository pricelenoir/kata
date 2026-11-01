"use client";

import Link from "next/link";
import { ArrowRightIcon, PartyPopperIcon } from "lucide-react";
import { DifficultyLabel } from "@/components/ui/difficulty";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
      <div className="flex items-center gap-3 rounded-lg surface px-5 py-4">
        <PartyPopperIcon className="size-5 shrink-0 text-emerald-400" />
        <p className="text-sm text-foreground">
          You&apos;ve answered every question correctly. Nice work — check{" "}
          <Link href="/progress" className="text-brand-sky hover:underline underline-offset-4">
            your progress
          </Link>{" "}
          or reset to drill again.
        </p>
      </div>
    );
  }

  const { question, reason } = recommended;

  return (
    <div className="relative flex h-full flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl border border-brand-sky/30 bg-brand-sky/[0.05] px-5 py-4">
      <div className="relative space-y-2">
        <p className="text-sm font-medium text-brand-sky">
          {reason === "retry" ? "Missed last time, try it again" : "Up next"}
        </p>
        <p className="text-base font-medium text-foreground">{question.title}</p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{CATEGORY_META[question.category].label}</span>
          <DifficultyLabel difficulty={question.difficulty} />
        </div>
      </div>
      <Button
        nativeButton={false}
        render={<Link href={`/questions/${question.category}/${question.id}`} />}
        className="relative glow-sky border-0 bg-brand-sky font-semibold text-background hover:bg-brand-sky/90"
      >
        {reason === "retry" ? "Retry" : "Start"}
        <ArrowRightIcon />
      </Button>
    </div>
  );
}
