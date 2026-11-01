import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { InlineText } from "@/components/question/inline-code";
import { DifficultyLabel } from "@/components/ui/difficulty";
import { CATEGORY_META, type Category } from "@/types/category";
import type { Difficulty } from "@/types/question";

/** The top of a single question or coding exercise: breadcrumb and
 * difficulty, title, and prompt, identical on both so the two read as one
 * product. The topic lives in the breadcrumb, so it isn't repeated as a tag. */
export function DetailHeader({
  section,
  category,
  difficulty,
  title,
  prompt,
}: {
  section: { label: string; href: string };
  category: Category;
  difficulty: Difficulty;
  title: string;
  /** Paragraphs separated by blank lines; `inline code` supported. */
  prompt: string;
}) {
  return (
    <header className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <Link href={section.href} className="transition-colors hover:text-foreground">
            {section.label}
          </Link>
          <ChevronRightIcon className="size-3.5 shrink-0 opacity-60" aria-hidden />
          <Link
            href={`${section.href}?category=${category}`}
            className="truncate transition-colors hover:text-foreground"
          >
            {CATEGORY_META[category].label}
          </Link>
        </nav>
        <DifficultyLabel difficulty={difficulty} className="shrink-0" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-pretty text-foreground sm:text-[1.75rem] sm:leading-tight">
        {title}
      </h1>
      <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">
        {prompt.split(/\n\s*\n/).map((paragraph, i) => (
          <p key={i}>
            <InlineText text={paragraph} />
          </p>
        ))}
      </div>
    </header>
  );
}
