"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Language, TestCase } from "@/types/coding-exercise";
import type { SubmissionKind, SubmissionRow } from "@/types/submission";

const COLUMNS = "id, exercise_id, language, kind, source, status, verdict, result, created_at, finished_at";
const POLL_MS = 1500;

export type SubmitState =
  | { phase: "idle" }
  | { phase: "sending"; kind: SubmissionKind }
  | { phase: "waiting"; kind: SubmissionKind; row: SubmissionRow | null }
  | { phase: "done"; row: SubmissionRow }
  | { phase: "failed"; message: string };

function finished(row: SubmissionRow): boolean {
  return row.status === "done" || row.status === "error";
}

/** Queues runs/submits and follows the newest one to completion: Realtime
 * for an instant update, with polling underneath in case the socket can't
 * connect. Only the most recent submission is tracked. */
export function useSubmission(exerciseId: string) {
  const [state, setState] = useState<SubmitState>({ phase: "idle" });
  const [history, setHistory] = useState<SubmissionRow[]>([]);
  const cleanup = useRef<() => void>(() => {});

  const loadHistory = useCallback(async () => {
    const { data } = await createClient()
      .from("submissions")
      .select(COLUMNS)
      .eq("exercise_id", exerciseId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setHistory(data as SubmissionRow[]);
  }, [exerciseId]);

  const follow = useCallback(
    (id: string, kind: SubmissionKind) => {
      cleanup.current();
      const supabase = createClient();
      let stopped = false;

      const accept = (row: SubmissionRow) => {
        if (stopped) return;
        if (finished(row)) {
          stop();
          setState({ phase: "done", row });
          void loadHistory();
        } else {
          setState({ phase: "waiting", kind, row });
        }
      };

      const channel = supabase
        .channel(`submission:${id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "submissions", filter: `id=eq.${id}` },
          (payload) => accept(payload.new as SubmissionRow),
        )
        .subscribe();

      const poll = async () => {
        const { data } = await supabase.from("submissions").select(COLUMNS).eq("id", id).maybeSingle();
        if (data) accept(data as SubmissionRow);
      };
      const timer = setInterval(poll, POLL_MS);
      void poll();

      function stop() {
        stopped = true;
        clearInterval(timer);
        void supabase.removeChannel(channel);
      }
      cleanup.current = stop;
    },
    [loadHistory],
  );

  useEffect(() => () => cleanup.current(), []);

  const submit = useCallback(
    async (args: { kind: SubmissionKind; language: Language; source: string; customInput?: Omit<TestCase, "expected"> }) => {
      setState({ phase: "sending", kind: args.kind });
      try {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exerciseId, ...args }),
        });
        const body = (await res.json()) as { id?: string; error?: string };
        if (!res.ok || !body.id) {
          setState({ phase: "failed", message: body.error ?? `Request failed (${res.status}).` });
          return;
        }
        setState({ phase: "waiting", kind: args.kind, row: null });
        follow(body.id, args.kind);
        void loadHistory();
      } catch {
        setState({ phase: "failed", message: "Couldn't reach the server." });
      }
    },
    [exerciseId, follow, loadHistory],
  );

  /** Shows a past submission's result (and returns its source). */
  const show = useCallback((row: SubmissionRow) => {
    cleanup.current();
    if (finished(row)) setState({ phase: "done", row });
    else follow(row.id, row.kind);
  }, [follow]);

  return { state, history, loadHistory, submit, show };
}
