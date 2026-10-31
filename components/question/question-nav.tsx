import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdjacentQuestionId, getQuestionIndex, getQuestionsByCategory } from "@/lib/questions";
import { CATEGORY_META, type Category } from "@/types/category";

export function QuestionNav({
  category,
  questionId,
}: {
  category: Category;
  questionId: string;
}) {
  const prevId = getAdjacentQuestionId(category, questionId, "prev");
  const nextId = getAdjacentQuestionId(category, questionId, "next");
  const index = getQuestionIndex(category, questionId);
  const total = getQuestionsByCategory(category).length;
  const percent = ((index + 1) / total) * 100;

  return (
    <div className="space-y-4 border-t border-border pt-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {index + 1} of {total} in {CATEGORY_META[category].label}
        </span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]" aria-hidden>
          <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        {prevId ? (
          <Button variant="outline" nativeButton={false} render={<Link href={`/questions/${category}/${prevId}`} />}>
            <ArrowLeftIcon />
            Previous
          </Button>
        ) : (
          <Button variant="outline" disabled>
            <ArrowLeftIcon />
            Previous
          </Button>
        )}
        {nextId ? (
          <Button nativeButton={false} render={<Link href={`/questions/${category}/${nextId}`} />}>
            Next question
            <ArrowRightIcon />
          </Button>
        ) : (
          <Button nativeButton={false} render={<Link href={`/questions?category=${category}`} />}>
            Back to {CATEGORY_META[category].shortLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
