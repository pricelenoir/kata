import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getAdjacentQuestionId, getQuestionIndex, getQuestionsByCategory } from "@/lib/questions";
import type { Category } from "@/types/category";

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

  return (
    <div className="flex items-center justify-between border-t border-border/60 pt-4">
      {prevId ? (
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/questions/${category}/${prevId}`} />}
        >
          &larr; Prev
        </Button>
      ) : (
        <Button variant="outline" disabled>
          &larr; Prev
        </Button>
      )}

      <Link
        href={`/questions/${category}`}
        className="font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        {index + 1} / {total}
      </Link>

      {nextId ? (
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/questions/${category}/${nextId}`} />}
        >
          Next &rarr;
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Next &rarr;
        </Button>
      )}
    </div>
  );
}
