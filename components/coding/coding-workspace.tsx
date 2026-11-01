"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircleIcon, PlayIcon, RotateCcwIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditor } from "@/components/coding/code-editor";
import { SubmissionResult, VERDICT_CLASS } from "@/components/coding/submission-result";
import { useSupabaseUser } from "@/lib/supabase/use-user";
import { useSubmission } from "@/lib/use-submission";
import { LANGUAGES, LANGUAGE_META, type ExerciseMode, type Language, type TestCase } from "@/types/coding-exercise";
import { VERDICT_LABEL } from "@/types/submission";
import { cn } from "@/lib/utils";

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
    <div className="space-y-5">
      <div className="surface overflow-hidden rounded-xl focus-within:ring-1 focus-within:ring-brand-sky/40">
        <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
          <div className="flex items-center gap-0.5" role="tablist" aria-label="Language">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={language === l}
                onClick={() => changeLanguage(l)}
                className={cn(
                  "h-7 rounded-md px-2.5 text-sm transition-colors",
                  language === l ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {LANGUAGE_META[l].label}
              </button>
            ))}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={resetCode} className="text-muted-foreground">
            <RotateCcwIcon />
            Reset
          </Button>
        </div>

        <CodeEditor value={code[language]} language={language} onChange={changeCode} />

        {useCustom && (
          <div className="space-y-1.5 border-t border-border px-3 py-3">
            <label htmlFor="custom-input" className="text-xs font-medium text-muted-foreground">
              Custom input
            </label>
            <Textarea
              id="custom-input"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={3}
              spellCheck={false}
              className="font-mono text-xs"
            />
            {inputError && <p className="text-sm text-destructive">{inputError}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5">
          <Switch checked={useCustom} onChange={setUseCustom} label="Custom input" />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={cannotRun} onClick={() => send("run")}>
              {busy && state.kind === "run" ? <LoaderCircleIcon className="animate-spin" /> : <PlayIcon />}
              Run
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={cannotRun}
              onClick={() => send("submit")}
              className="glow-sky border-0 bg-brand-sky font-semibold text-background hover:bg-brand-sky/90 disabled:opacity-40 disabled:shadow-none"
            >
              {busy && state.kind === "submit" ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}
              Submit
            </Button>
          </div>
        </div>
      </div>

      {!judgeEnabled && (
        <p className="text-sm text-muted-foreground">Running code is coming soon. Your draft is saved in this browser.</p>
      )}
      {judgeEnabled && signedOut && (
        <p className="text-sm text-muted-foreground">
          <Link href={`/login?next=/coding/${exerciseId}`} className="text-brand-sky underline-offset-4 hover:underline">
            Log in
          </Link>{" "}
          to run your code. Drafts are saved in this browser either way.
        </p>
      )}

      <section aria-live="polite" className="empty:hidden">
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
          <h2 className="text-sm font-semibold text-foreground">Recent submissions</h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl surface">
            {history.map((row) => (
              <li key={row.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2 text-sm sm:grid-cols-[1fr_4rem_3rem_5.5rem_auto]">
                <button
                  type="button"
                  onClick={() => show(row)}
                  className={cn("min-w-0 truncate text-left hover:underline underline-offset-4", row.verdict ? VERDICT_CLASS[row.verdict] : "text-muted-foreground")}
                >
                  {row.verdict ? VERDICT_LABEL[row.verdict] : row.status === "queued" ? "Queued" : "Running"}
                </button>
                <span className="hidden text-muted-foreground capitalize sm:block">{row.kind}</span>
                <span className="hidden text-muted-foreground sm:block">{LANGUAGE_META[row.language].label}</span>
                <span className="hidden text-right tabular-nums text-muted-foreground sm:block">
                  {new Date(row.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    changeLanguage(row.language);
                    setCode((prev) => ({ ...prev, [row.language]: row.source }));
                    writeStorage(draftKey(exerciseId, row.language), row.source);
                  }}
                  className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Load code
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <span
        className={cn(
          "relative h-4 w-7 rounded-full transition-colors",
          checked ? "bg-brand-sky" : "bg-foreground/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-3 rounded-full bg-background transition-transform",
            checked ? "translate-x-3" : "bg-foreground/70",
          )}
        />
      </span>
      {label}
    </button>
  );
}
