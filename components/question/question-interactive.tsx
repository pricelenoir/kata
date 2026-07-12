"use client";

import { useState } from "react";
import { TraceAnswer } from "@/components/question/trace-answer";
import { ExplanationPanel } from "@/components/question/explanation-panel";
import { useProgress } from "@/lib/progress-store";
import type { TraceQuestion } from "@/types/question";

export function QuestionInteractive({
  question,
}: {
  question: TraceQuestion;
}) {
  const [answered, setAnswered] = useState(false);
  const { recordAttempt } = useProgress();

  return (
    <div className="space-y-5">
      <TraceAnswer
        key={question.id}
        answerFormat={question.answerFormat}
        onAnswered={(status, selectedIndex) => {
          setAnswered(true);
          recordAttempt(question.id, status, selectedIndex);
        }}
      />
      {answered && (
        <ExplanationPanel
          explanation={question.explanation}
          references={question.references}
        />
      )}
    </div>
  );
}
