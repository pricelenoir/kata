import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { CodeBlock } from "@/components/question/code-block";
import { InlineText } from "@/components/question/inline-code";
import { CodingWorkspaceLoader } from "@/components/coding/coding-workspace-loader";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_META } from "@/types/category";
import { LANGUAGES, LANGUAGE_META, type CodingExercise, type Language } from "@/types/coding-exercise";
import { DIFFICULTY_CLASS } from "@/lib/difficulty";
import { getAllCodingExercises, getCodingExerciseById } from "@/lib/coding-exercises";
import { starterCode } from "@/judge/src/harness";

type Params = Promise<{ exerciseId: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllCodingExercises().map((e) => ({ exerciseId: e.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const exercise = getCodingExerciseById((await params).exerciseId);
  return exercise ? { title: exercise.title } : {};
}

function exampleText(exercise: CodingExercise, index: number): { input: string; expected: string } {
  const example = exercise.examples[index];
  if ("stdin" in example) return { input: example.stdin, expected: example.expected };
  const { expected, ...input } = example;
  return { input: JSON.stringify(input), expected: JSON.stringify(expected) };
}

function customInputTemplate(exercise: CodingExercise): string {
  const { input } = exampleText(exercise, 0);
  return input;
}

const DRIVER_FILENAME: Record<Language, string> = { cpp: "kata_driver.cpp", rust: "kata_driver.rs" };

export default async function CodingExercisePage({ params }: { params: Params }) {
  const exercise = getCodingExerciseById((await params).exerciseId);
  if (!exercise) notFound();

  const categoryMeta = CATEGORY_META[exercise.category];
  const starter = Object.fromEntries(LANGUAGES.map((l) => [l, starterCode(exercise, l)])) as Record<Language, string>;
  const { limits } = exercise;

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-2">
        <article className="min-w-0 space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`font-mono text-xs ${categoryMeta.badgeClassName}`}>
                {categoryMeta.label}
              </Badge>
              <Badge variant="outline" className={`font-mono text-[10px] uppercase ${DIFFICULTY_CLASS[exercise.difficulty]}`}>
                {exercise.difficulty}
              </Badge>
              {exercise.tags?.map((tag) => (
                <span key={tag} className="font-mono text-xs text-muted-foreground">
                  #{tag}
                </span>
              ))}
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{exercise.title}</h1>
          </div>

          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {exercise.prompt.split(/\n\s*\n/).map((paragraph, i) => (
              <p key={i}>
                <InlineText text={paragraph} />
              </p>
            ))}
          </div>

          {exercise.constraints && (
            <section className="space-y-2">
              <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Constraints</h2>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {exercise.constraints.map((c) => (
                  <li key={c}>
                    <InlineText text={c} />
                  </li>
                ))}
              </ul>
              <p className="font-mono text-xs text-muted-foreground">
                {limits.timeMs} ms CPU per test · {limits.memoryMb} MB · {limits.cpus ?? 1} CPU
                {(limits.cpus ?? 1) === 1 ? "" : "s"}
              </p>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Examples</h2>
            {exercise.examples.map((_, i) => {
              const { input, expected } = exampleText(exercise, i);
              return (
                <div key={i} className="grid gap-2 sm:grid-cols-2">
                  <ExampleBlock label="Input" text={input} />
                  <ExampleBlock label="Expected output" text={expected} />
                </div>
              );
            })}
          </section>

          {exercise.mode === "harness" && (
            <details className="group rounded-lg border border-border/60">
              <summary className="cursor-pointer px-4 py-3 text-sm text-foreground hover:bg-muted/40">
                How your code is tested
              </summary>
              <div className="space-y-3 px-4 pb-4">
                <p className="text-sm text-muted-foreground">
                  Your code is compiled together with this driver, which reads each test&apos;s input from stdin
                  and prints what it observed. Hidden tests use the same driver with different inputs.
                </p>
                {LANGUAGES.map((l) => (
                  <CodeBlock
                    key={l}
                    snippet={{ language: l, code: exercise.driver[l], filename: `${DRIVER_FILENAME[l]} (${LANGUAGE_META[l].label})` }}
                  />
                ))}
              </div>
            </details>
          )}
        </article>

        <div className="min-w-0">
          <CodingWorkspaceLoader
            exerciseId={exercise.id}
            mode={exercise.mode}
            starter={starter}
            customInputTemplate={customInputTemplate(exercise)}
          />
        </div>
      </main>
    </div>
  );
}

function ExampleBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-border/60 bg-[#121212] px-3 py-2 font-mono text-xs text-foreground">
        {text}
      </pre>
    </div>
  );
}
