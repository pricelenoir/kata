"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircleIcon, PlayIcon, RotateCcwIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditor } from "@/components/coding/code-editor";
import { SubmissionResult } from "@/components/coding/submission-result";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { useSubmission } from "@/lib/use-submission";
import { LANGUAGES, LANGUAGE_META, type ExerciseMode, type Language, type TestCase } from "@/types/coding-exercise";
import { VERDICT_LABEL } from "@/types/submission";

// Client-only (loaded with ssr: false), so reading localStorage while
// initializing state is safe — there's no server render to mismatch.

const LANGUAGE_KEY = "kata:language";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private mode or full storage: drafts just won't persist.
  }
}

const draftKey = (exerciseId: string, language: Language) => `kata:draft:${exerciseId}:${language}`;

export interface WorkspaceProps {
  exerciseId: string;
  mode: ExerciseMode;
  starter: Record<Language, string>;
  /** Prefill for the custom-input box: raw stdin for program-style
   * exercises, the JSON test shape for function/design ones. */
  customInputTemplate: string;
  /** False until a judge worker is deployed (JUDGE_ENABLED). */
  judgeEnabled: boolean;
}

function parseCustomInput(mode: ExerciseMode, text: string): Omit<TestCase, "expected"> | string {
  if (mode === "stdio" || mode === "harness") return { stdin: text } as Omit<TestCase, "expected">;
  try {
    return JSON.parse(text);
  } catch {
    return "Custom input must be valid JSON.";
  }
}

export function CodingWorkspace({ exerciseId, mode, starter, customInputTemplate, judgeEnabled }: WorkspaceProps) {
  const user = useSupabaseUser();
  const [language, setLanguage] = useState<Language>(() => {
    const saved = readStorage(LANGUAGE_KEY) as Language | null;
    return saved && LANGUAGES.includes(saved) ? saved : "cpp";
  });
  const [code, setCode] = useState<Record<Language, string>>(() =>
    Object.fromEntries(
      LANGUAGES.map((l) => [l, readStorage(draftKey(exerciseId, l)) ?? starter[l]]),
    ) as Record<Language, string>,
  );
  const [useCustom, setUseCustom] = useState(false);
  const [customText, setCustomText] = useState(customInputTemplate);
  const [inputError, setInputError] = useState<string | null>(null);
  const { state, history, loadHistory, submit, show } = useSubmission(exerciseId);

  useEffect(() => {
    if (user) void loadHistory();
  }, [user, loadHistory]);

  function changeLanguage(next: Language) {
    setLanguage(next);
    writeStorage(LANGUAGE_KEY, next);
  }

  function changeCode(next: string) {
    setCode((prev) => ({ ...prev, [language]: next }));
    writeStorage(draftKey(exerciseId, language), next === starter[language] ? null : next);
  }

  function resetCode() {
    changeCode(starter[language]);
  }

  function send(kind: "run" | "submit") {
    setInputError(null);
    let customInput: Omit<TestCase, "expected"> | undefined;
    if (kind === "run" && useCustom) {
      const parsed = parseCustomInput(mode, customText);
      if (typeof parsed === "string") {
        setInputError(parsed);
        return;
      }
      customInput = parsed;
    }
    void submit({ kind, language, source: code[language], customInput });
  }

  const busy = state.phase === "sending" || state.phase === "waiting";
  const signedOut = user === null;
  const cannotRun = busy || signedOut || !judgeEnabled;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="tablist" aria-label="Language">
          {LANGUAGES.map((l) => (
            <Button
              key={l}
              type="button"
              size="sm"
              role="tab"
              aria-selected={language === l}
              variant={language === l ? "secondary" : "ghost"}
              onClick={() => changeLanguage(l)}
              className="text-sm"
            >
              {LANGUAGE_META[l].label}
            </Button>
          ))}
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={resetCode} className="text-sm">
          <RotateCcwIcon />
          Reset
        </Button>
      </div>

      <CodeEditor value={code[language]} language={language} onChange={changeCode} />

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} />
          Run with custom input too
        </label>
        {useCustom && (
          <Textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={4}
            spellCheck={false}
            className="text-sm"
            aria-label="Custom input"
          />
        )}
        {inputError && <p className="text-sm text-destructive">{inputError}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={cannotRun} onClick={() => send("run")}>
          {busy && state.kind === "run" ? <LoaderCircleIcon className="animate-spin" /> : <PlayIcon />}
          Run examples
        </Button>
        <Button
          type="button"
          disabled={cannotRun}
          onClick={() => send("submit")}
          className="glow-sky border-0 bg-brand-sky font-semibold text-background hover:bg-brand-sky/90 disabled:opacity-40"
        >
          {busy && state.kind === "submit" ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}
          Submit
        </Button>
        {!judgeEnabled && (
          <span className="text-sm text-muted-foreground">
            Running code is coming soon. Your draft is saved in this browser.
          </span>
        )}
        {judgeEnabled && signedOut && (
          <span className="text-sm text-muted-foreground">
            <Link href={`/login?next=/coding/${exerciseId}`} className="text-brand-sky hover:underline underline-offset-4">
              Log in
            </Link>{" "}
            to run your code. Drafts are saved in this browser either way.
          </span>
        )}
      </div>

      <section aria-live="polite" className="min-h-8">
        {state.phase === "sending" && <p className="text-sm text-muted-foreground">Queuing…</p>}
        {state.phase === "waiting" && (
          <p className="text-sm text-muted-foreground">
            {state.row?.status === "running" ? "Compiling and running…" : "Waiting for a judge…"}
          </p>
        )}
        {state.phase === "failed" && <p className="text-sm text-destructive">{state.message}</p>}
        {state.phase === "done" && state.row.result && <SubmissionResult result={state.row.result} />}
      </section>

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Recent</h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl surface">
            {history.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <button type="button" onClick={() => show(row)} className="min-w-0 truncate text-left hover:text-brand-sky">
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleTimeString()} · {row.kind} · {LANGUAGE_META[row.language].label}
                  </span>{" "}
                  <span className="text-foreground">
                    {row.verdict ? VERDICT_LABEL[row.verdict] : row.status === "queued" ? "Queued" : "Running"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    changeLanguage(row.language);
                    setCode((prev) => ({ ...prev, [row.language]: row.source }));
                    writeStorage(draftKey(exerciseId, row.language), row.source);
                  }}
                  className="shrink-0 font-mono text-xs text-muted-foreground hover:text-foreground"
                >
                  load code
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
