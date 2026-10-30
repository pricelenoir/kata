"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ExplanationPanel } from "@/components/question/explanation-panel";
import { useProgress } from "@/lib/progress-store";
import type { HighlightedToken } from "@/lib/code-highlight";
import type { FillInBlankQuestion } from "@/types/question";

const BLANK_RE = /\/\*BLANK_(\d+)\*\//;

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

interface FillInBlankInteractiveProps {
  question: FillInBlankQuestion;
  templateTokens: HighlightedToken[][];
  /** The reference-solution CodeBlock, pre-rendered server-side (an async
   * Server Component can't be imported/called from inside a Client
   * Component — it has to be composed in as an already-rendered child). */
  canonicalBlock: ReactNode;
}

export function FillInBlankInteractive({
  question,
  templateTokens,
  canonicalBlock,
}: FillInBlankInteractiveProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const { recordAttempt } = useProgress();

  function isBlankCorrect(id: string): boolean {
    const blank = question.blanks.find((b) => b.id === id);
    if (!blank) return false;
    const userAnswer = normalize(values[id] ?? "");
    return blank.acceptedAnswers.some((a) => normalize(a) === userAnswer);
  }

  function handleCheck() {
    setChecked(true);
    const allCorrect = question.blanks.every((b) => isBlankCorrect(b.id));
    recordAttempt(question.id, allCorrect ? "correct" : "incorrect");
  }

  const correctCount = checked
    ? question.blanks.filter((b) => isBlankCorrect(b.id)).length
    : 0;

  return (
    <div className="space-y-5">
      {/* Announced to screen readers immediately on check — the per-blank
       * color coding below isn't otherwise exposed to assistive tech. */}
      <p role="status" aria-live="polite" className="sr-only">
        {checked &&
          (correctCount === question.blanks.length
            ? `All ${question.blanks.length} blanks correct!`
            : `${correctCount} of ${question.blanks.length} blanks correct.`)}
      </p>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-[#121212]">
        {question.snippet.filename && (
          <div className="border-b border-border/60 px-4 py-2 font-mono text-xs text-muted-foreground">
            {question.snippet.filename}
          </div>
        )}
        <pre
          tabIndex={0}
          className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:-outline-offset-2"
        >
          <code>
            {templateTokens.map((line, lineIdx) => (
              <div key={lineIdx}>
                {line.map((token, tokenIdx) => {
                  const match = token.content.match(BLANK_RE);
                  if (!match) {
                    return (
                      <span key={tokenIdx} style={{ color: token.color }}>
                        {token.content}
                      </span>
                    );
                  }
                  const id = match[1];
                  const before = token.content.slice(0, match.index);
                  const after = token.content.slice(
                    (match.index ?? 0) + match[0].length,
                  );
                  const correct = checked ? isBlankCorrect(id) : null;
                  const blankNumber =
                    question.blanks.findIndex((b) => b.id === id) + 1;
                  const stateClass =
                    correct === null
                      ? "border-dashed border-sky-400/60 bg-sky-500/10 text-sky-300 placeholder:text-sky-400/40 focus:border-solid focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                      : correct
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                        : "border-red-500/60 bg-red-500/10 text-red-300";
                  return (
                    <span key={tokenIdx} style={{ color: token.color }}>
                      {before}
                      <input
                        value={values[id] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [id]: e.target.value }))
                        }
                        disabled={checked}
                        placeholder="answer"
                        aria-label={`Blank ${blankNumber} of ${question.blanks.length}`}
                        style={{
                          width: `${Math.max(7, (values[id]?.length ?? 0) + 1)}ch`,
                        }}
                        className={`mx-0.5 rounded border px-1 py-0.5 font-mono text-[13px] outline-none disabled:opacity-100 ${stateClass}`}
                      />
                      {correct !== null && (
                        <span className="sr-only">
                          {correct
                            ? ` (blank ${blankNumber} correct)`
                            : ` (blank ${blankNumber} incorrect)`}
                        </span>
                      )}
                      {after}
                    </span>
                  );
                })}
              </div>
            ))}
          </code>
        </pre>
      </div>

      {!checked ? (
        <Button type="button" variant="secondary" onClick={handleCheck}>
          Check Answer
        </Button>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="font-mono text-xs text-muted-foreground">
              Reference solution
            </p>
            {canonicalBlock}
          </div>

          <ExplanationPanel
            explanation={question.explanation}
            references={question.references}
          />
        </div>
      )}
    </div>
  );
}
