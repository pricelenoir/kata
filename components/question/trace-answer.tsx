"use client";

import { useState } from "react";
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

  function pick(idx: number) {
    if (selected !== null) return;
    setSelected(idx);
    onAnswered(idx === format.correctIndex ? "correct" : "incorrect", idx);
  }

  return (
    <div className="space-y-2">
      {format.choices.map((choice, idx) => {
        const locked = selected !== null;
        const isCorrect = idx === format.correctIndex;
        const isPicked = idx === selected;

        let stateClass = "border-border/60 hover:border-border hover:bg-muted/50";
        if (locked && isCorrect) {
          stateClass = "border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
        } else if (locked && isPicked && !isCorrect) {
          stateClass = "border-red-500/60 bg-red-500/10 text-red-300";
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
            <span className="mr-2 font-mono text-xs text-muted-foreground">
              {String.fromCharCode(65 + idx)}
            </span>
            {choice}
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
