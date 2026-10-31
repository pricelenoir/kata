"use client";

import { CheckIcon, LockIcon, XIcon } from "lucide-react";
import type { JsonValue, TestCase } from "@/types/coding-exercise";
import { VERDICT_LABEL, type JudgeResult, type TestOutcome, type Verdict } from "@/types/submission";

export const VERDICT_CLASS: Record<Verdict, string> = {
  accepted: "text-emerald-400",
  wrong_answer: "text-red-400",
  time_limit: "text-amber-400",
  memory_limit: "text-amber-400",
  output_limit: "text-amber-400",
  runtime_error: "text-red-400",
  compile_error: "text-red-400",
  internal_error: "text-muted-foreground",
};

function show(value: JsonValue | undefined): string {
  if (value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function inputText(input: TestCase | undefined): string {
  if (!input) return "";
  if ("stdin" in input) return input.stdin;
  return JSON.stringify(input, null, 1).replace(/\n\s*/g, " ");
}

function Pre({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border/60 bg-[oklch(0.13_0.006_250)] px-3 py-2 font-mono text-xs text-foreground">
        {text === "" ? <span className="text-muted-foreground">(empty)</span> : text}
      </pre>
    </div>
  );
}

function testTitle(t: TestOutcome, exampleNumber: number): string {
  if (t.custom) return "Custom input";
  if (t.hidden) return t.label ? `Hidden test: ${t.label}` : "Hidden test";
  return `Example ${exampleNumber}`;
}

function TestRow({ test, exampleNumber }: { test: TestOutcome; exampleNumber: number }) {
  const passed = test.verdict === "accepted";
  const Icon = test.hidden && passed ? LockIcon : passed ? CheckIcon : XIcon;
  const hasDetails = !test.hidden && (test.input || test.stdout || test.stderr || test.actual !== undefined);
  const summary = (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <Icon className={`size-3.5 shrink-0 ${passed ? "text-emerald-400" : VERDICT_CLASS[test.verdict]}`} />
        <span className="truncate text-foreground">{testTitle(test, exampleNumber)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3 text-xs tabular-nums text-muted-foreground">
        {!passed && <span className={VERDICT_CLASS[test.verdict]}>{VERDICT_LABEL[test.verdict]}</span>}
        <span>{test.timeMs} ms</span>
        <span>{(test.memoryKb / 1024).toFixed(1)} MB</span>
      </span>
    </div>
  );

  if (!hasDetails) return <li>{summary}</li>;
  return (
    <li>
      <details open={!passed}>
        <summary className="cursor-pointer list-none hover:bg-muted/40">{summary}</summary>
        <div className="space-y-3 px-3 pb-3">
          {test.message && <p className="text-xs text-muted-foreground">{test.message}</p>}
          <Pre label="Input" text={inputText(test.input)} />
          {!test.custom && <Pre label="Expected" text={show(test.expected)} />}
          {test.actual !== undefined && <Pre label={test.custom ? "Output" : "Your output"} text={show(test.actual)} />}
          {test.stdout && <Pre label="Printed" text={test.stdout} />}
          {test.stderr && <Pre label="stderr" text={test.stderr} />}
        </div>
      </details>
    </li>
  );
}

export function SubmissionResult({ result }: { result: JudgeResult }) {
  let example = 0;
  const notRun = result.total - result.tests.filter((t) => !t.custom).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={`text-lg font-semibold ${VERDICT_CLASS[result.verdict]}`}>{VERDICT_LABEL[result.verdict]}</h3>
        {result.verdict !== "compile_error" && result.total > 0 && (
          <span className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
            <span>
              {result.passed}/{result.total} passed
            </span>
            <span>{result.timeMs} ms</span>
            <span>{(result.memoryKb / 1024).toFixed(1)} MB</span>
          </span>
        )}
      </div>

      {result.message && <p className="text-sm text-muted-foreground">{result.message}</p>}

      {result.compileOutput && (
        <Pre label={result.verdict === "compile_error" ? "Compiler output" : "Compiler warnings"} text={result.compileOutput} />
      )}

      {result.tests.length > 0 && (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl surface">
          {result.tests.map((t) => (
            <TestRow key={t.index} test={t} exampleNumber={!t.hidden && !t.custom ? ++example : 0} />
          ))}
        </ul>
      )}

      {notRun > 0 && result.verdict !== "compile_error" && (
        <p className="text-xs text-muted-foreground">
          Stopped at the first failure; the remaining {notRun} test{notRun === 1 ? " was" : "s were"} not run.
        </p>
      )}
    </div>
  );
}
