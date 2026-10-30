"use client";

import { useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineText } from "@/components/question/inline-code";
import type { TraceAnswerFormat } from "@/types/question";

interface TraceAnswerProps {
  answerFormat: TraceAnswerFormat;
  onAnswered: (status: "correct" | "incorrect", selectedIndex?: number) => void;
}

export function TraceAnswer({ answerFormat, onAnswered }: TraceAnswerProps) {
  if (answerFormat.kind === "multiple-choice") {
    return (
      <MultipleChoiceAnswer format={answerFormat} onAnswered={onAnswered} />
    );
  }
  return <SelfAssessedAnswer format={answerFormat} onAnswered={onAnswered} />;
}

function MultipleChoiceAnswer({
  format,
  onAnswered,
}: {
  format: Extract<TraceAnswerFormat, { kind: "multiple-choice" }>;
  onAnswered: TraceAnswerProps["onAnswered"];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const locked = selected !== null;

  function pick(idx: number) {
    if (selected !== null) return;
    setSelected(idx);
    onAnswered(idx === format.correctIndex ? "correct" : "incorrect", idx);
  }

  return (
    <div className="space-y-2">
      {/* Announced to screen readers immediately on answer — the color-coded
       * choice states below aren't otherwise exposed to assistive tech, and
       * the choice buttons become natively disabled (removed from the tab
       * order) once locked. */}
      <p role="status" aria-live="polite" className="sr-only">
        {locked &&
          (selected === format.correctIndex
            ? "Correct!"
            : `Incorrect. The correct answer is ${String.fromCharCode(65 + format.correctIndex)}: ${format.choices[format.correctIndex]}`)}
      </p>

      {format.choices.map((choice, idx) => {
        const isCorrect = idx === format.correctIndex;
        const isPicked = idx === selected;

        let stateClass = "border-border/60 hover:border-border hover:bg-muted/50";
        let letterClass = "text-muted-foreground";
        if (locked && isCorrect) {
          stateClass = "!border-emerald-500 !bg-emerald-500/20 text-emerald-200";
          letterClass = "text-emerald-200";
        } else if (locked && isPicked && !isCorrect) {
          stateClass = "!border-red-500 !bg-red-500/20 text-red-200";
          letterClass = "text-red-200";
        } else if (locked) {
          stateClass = "border-border/40 opacity-50";
        }

        return (
          <Button
            key={idx}
            type="button"
            variant="outline"
            onClick={() => pick(idx)}
            disabled={locked}
            className={`h-auto w-full justify-start whitespace-normal rounded-lg border px-4 py-3 text-left text-sm font-normal disabled:opacity-100 ${stateClass}`}
          >
            <span className={`mr-2 font-mono text-xs ${letterClass}`}>
              {String.fromCharCode(65 + idx)}
            </span>
            <span className="flex-1">{choice}</span>
            {locked && isCorrect && (
              <CheckIcon
                aria-hidden="true"
                className="ml-2 size-4 shrink-0 text-emerald-300"
              />
            )}
            {locked && isPicked && !isCorrect && (
              <XIcon
                aria-hidden="true"
                className="ml-2 size-4 shrink-0 text-red-300"
              />
            )}
            {locked && isCorrect && (
              <span className="sr-only"> — correct answer</span>
            )}
            {locked && isPicked && !isCorrect && (
              <span className="sr-only"> — your answer, incorrect</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}

function SelfAssessedAnswer({
  format,
  onAnswered,
}: {
  format: Extract<TraceAnswerFormat, { kind: "self-assessed" }>;
  onAnswered: TraceAnswerProps["onAnswered"];
}) {
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [judged, setJudged] = useState(false);

  if (judged) {
    return (
      <p className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Recorded.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        placeholder="Type your prediction, then reveal the answer…"
        disabled={revealed}
        rows={3}
      />
      {!revealed ? (
        <Button type="button" variant="secondary" onClick={() => setRevealed(true)}>
          Reveal Answer
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
            <InlineText text={format.canonicalAnswer} />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-emerald-500/60 text-emerald-300 hover:bg-emerald-500/10"
              onClick={() => {
                setJudged(true);
                onAnswered("correct");
              }}
            >
              I was right
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-500/60 text-red-300 hover:bg-red-500/10"
              onClick={() => {
                setJudged(true);
                onAnswered("incorrect");
              }}
            >
              I was wrong
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
