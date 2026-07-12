import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { CodeBlock } from "@/components/question/code-block";
import { InlineText } from "@/components/question/inline-code";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_META } from "@/types/category";
import { LANGUAGE_META } from "@/types/coding-exercise";
import { DIFFICULTY_CLASS } from "@/lib/difficulty";
import { getCodingExerciseById } from "@/lib/coding-exercises";

export default async function CodingExercisePage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;
  const exercise = getCodingExerciseById(exerciseId);
  if (!exercise) notFound();

  const categoryMeta = CATEGORY_META[exercise.category];
  const languageMeta = LANGUAGE_META[exercise.language];

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`font-mono text-xs ${categoryMeta.badgeClassName}`}
            >
              {categoryMeta.label}
            </Badge>
            <Badge
              variant="outline"
              className={`font-mono text-[10px] uppercase ${DIFFICULTY_CLASS[exercise.difficulty]}`}
            >
              {exercise.difficulty}
            </Badge>
            <Badge
              variant="outline"
              className={`font-mono text-xs ${languageMeta.badgeClassName}`}
            >
              {languageMeta.label}
            </Badge>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {exercise.title}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <InlineText text={exercise.prompt} />
          </p>
        </div>

        <div className="space-y-6">
          <CodeBlock
            snippet={{
              language: exercise.language,
              code: exercise.starterCode,
              filename: "solution.cpp",
            }}
          />

          <div className="rounded-lg border border-dashed border-border/60 px-5 py-8 text-center text-sm text-muted-foreground">
            The in-browser editor and test runner aren&apos;t wired up yet —
            for now this is a read-only preview of the exercise.
          </div>
        </div>
      </main>
    </div>
  );
}
