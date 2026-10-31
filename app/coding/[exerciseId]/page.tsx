import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { ChevronRightIcon } from "lucide-react";
import { CodeBlock } from "@/components/question/code-block";
import { InlineText } from "@/components/question/inline-code";
import { CodingWorkspaceLoader } from "@/components/coding/coding-workspace-loader";
import { DetailHeader } from "@/components/layout/detail-header";
import { LANGUAGES, LANGUAGE_META, type CodingExercise, type Language } from "@/types/coding-exercise";
import { getAllCodingExercises, getCodingExerciseById } from "@/lib/coding-exercises";
import { starterCode } from "@/judge/src/harness";
import { isJudgeEnabled } from "@/lib/judge-config";

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

  const starter = Object.fromEntries(LANGUAGES.map((l) => [l, starterCode(exercise, l)])) as Record<Language, string>;
  const { limits } = exercise;

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2">
        <article className="min-w-0 space-y-8">
          <DetailHeader
            section={{ label: "Coding", href: "/coding" }}
            category={exercise.category}
            difficulty={exercise.difficulty}
            title={exercise.title}
            prompt={exercise.prompt}
          />

          {exercise.constraints && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Constraints</h2>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {exercise.constraints.map((c) => (
                  <li key={c} className="flex gap-2.5">
                    <span aria-hidden className="mt-[0.55rem] size-1 shrink-0 rounded-full bg-foreground/30" />
                    <span>
                      <InlineText text={c} />
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="grid grid-cols-3 overflow-hidden rounded-xl surface text-sm">
                <Limit label="CPU time" value={`${limits.timeMs} ms`} />
                <Limit label="Memory" value={`${limits.memoryMb} MB`} />
                <Limit label="CPUs" value={String(limits.cpus ?? 1)} />
              </dl>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Examples</h2>
            {exercise.examples.map((_, i) => {
              const { input, expected } = exampleText(exercise, i);
              return (
                <div
                  key={i}
                  className="grid overflow-hidden rounded-xl border border-border bg-[oklch(0.13_0.006_250)] sm:grid-cols-2 sm:divide-x divide-border max-sm:divide-y"
                >
                  <ExampleBlock label="Input" text={input} />
                  <ExampleBlock label="Expected output" text={expected} />
                </div>
              );
            })}
          </section>

          {exercise.mode === "harness" && (
            <details className="group overflow-hidden rounded-xl surface">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-foreground transition-colors hover:bg-foreground/[0.03] [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
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
            judgeEnabled={isJudgeEnabled()}
          />
        </div>
      </main>
    </div>
  );
}

function ExampleBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0 space-y-1.5 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-all text-foreground">{text}</pre>
    </div>
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5 px-4 py-3 not-first:border-l not-first:border-border">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
