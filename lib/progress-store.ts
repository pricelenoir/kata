"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Category } from "@/types/category";
import type { ProgressState, QuestionAttempt } from "@/types/progress";
import { ALL_QUESTIONS } from "@/content/questions";
import { getQuestionsByCategory } from "@/lib/questions";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseUser } from "@/lib/supabase/use-user";

const STORAGE_KEY = "kata:progress:v1";

export interface Stats {
  answered: number;
  total: number;
  correct: number;
  /** 0-100, rounded. 0 (not NaN) when nothing has been answered yet. */
  accuracy: number;
}

function defaultState(): ProgressState {
  return {
    version: 1,
    attempts: {},
    streak: { current: 0, longest: 0, lastActiveDate: "" },
  };
}

function todayLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ---- External store: localStorage, subscribed to via useSyncExternalStore ----
// (rather than an effect that calls setState, which causes an avoidable
// double-render and trips react-hooks/set-state-in-effect)
//
// This is the anonymous/logged-out path. Signed-in users are backed by
// Supabase instead (see useRemoteProgress below) — the two never mix, and
// there is currently no migration of anonymous progress into an account on
// first sign-in.

let cachedState: ProgressState | undefined;
const listeners = new Set<() => void>();

function readFromStorage(): ProgressState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as ProgressState;
    return parsed.version === 1 ? parsed : defaultState();
  } catch {
    return defaultState();
  }
}

function getSnapshot(): ProgressState {
  if (!cachedState) cachedState = readFromStorage();
  return cachedState;
}

// Must be a stable reference — useSyncExternalStore re-invokes this on every
// render and will loop if it doesn't get the same object back.
const SERVER_SNAPSHOT: ProgressState = defaultState();

function getServerSnapshot(): ProgressState {
  return SERVER_SNAPSHOT;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function commit(next: ProgressState): void {
  cachedState = next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

/** Re-reads localStorage and notifies subscribers — used once per mount to
 * pick up real data after the SSR/hydration pass (which must render
 * `defaultState()` to match the server, since localStorage doesn't exist
 * there). */
function resync(): void {
  cachedState = readFromStorage();
  listeners.forEach((l) => l());
}

// A second tiny external store just for "have we mounted on the client
// yet?" — needed because `typeof window !== "undefined"` is already true
// during the client's *hydration* render (before `resync` has run), which
// would mismatch the server's render. Piggybacks on the same mount-time
// `resync()` notification above to force a re-check post-hydration.
function subscribeNever(): () => void {
  return () => {};
}
function getIsHydrated(): boolean {
  return true;
}
function getIsHydratedServer(): boolean {
  return false;
}

function withStreakUpdate(
  streak: ProgressState["streak"],
): ProgressState["streak"] {
  const today = todayLocal();
  if (streak.lastActiveDate === today) return streak;

  if (streak.lastActiveDate) {
    const prev = new Date(streak.lastActiveDate);
    const cur = new Date(today);
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / dayMs);
    const current = diffDays === 1 ? streak.current + 1 : 1;
    return {
      current,
      longest: Math.max(streak.longest, current),
      lastActiveDate: today,
    };
  }

  return { current: 1, longest: Math.max(streak.longest, 1), lastActiveDate: today };
}

/** Same semantics as withStreakUpdate, but derived from a full history of
 * distinct active dates instead of updated incrementally — the remote store
 * has no single "current session" to thread accumulator state through, so
 * it recomputes the streak from scratch on every read/write instead. */
function computeStreakFromDates(dates: string[]): ProgressState["streak"] {
  const uniqueSorted = Array.from(new Set(dates)).sort();
  if (uniqueSorted.length === 0) {
    return { current: 0, longest: 0, lastActiveDate: "" };
  }
  let current = 1;
  let longest = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    const prev = new Date(uniqueSorted[i - 1]);
    const cur = new Date(uniqueSorted[i]);
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / dayMs);
    current = diffDays === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return {
    current,
    longest,
    lastActiveDate: uniqueSorted[uniqueSorted.length - 1],
  };
}

function computeStats(
  attempts: Record<string, QuestionAttempt>,
  questionIds: string[],
): Stats {
  const total = questionIds.length;
  let answered = 0;
  let correct = 0;
  for (const id of questionIds) {
    const attempt = attempts[id];
    if (!attempt) continue;
    answered += 1;
    if (attempt.status === "correct") correct += 1;
  }
  const accuracy = answered === 0 ? 0 : Math.round((correct / answered) * 100);
  return { answered, total, correct, accuracy };
}

interface RemoteAttemptRow {
  question_id: string;
  status: "correct" | "incorrect";
  selected_index: number | null;
  attempted_at: string;
}

/** Supabase-backed mirror of the local store's shape, active only while a
 * user is signed in. Progress lives in the `question_attempts` table (see
 * supabase/migrations/0001_init.sql), scoped by row-level security to the
 * signed-in user — there is no separate server-side authorization check. */
interface RemoteResult {
  /** Which user `state` belongs to — `null` until the first fetch resolves.
   * Compared against the current `userId` on every render so a stale
   * result from a *previous* user can never be shown as this user's data
   * (e.g. sign out then immediately sign in as someone else in the same
   * tab): render-time derivation below falls back to `defaultState()`
   * instead of needing a synchronous reset inside the effect. */
  userId: string | null;
  state: ProgressState;
  loaded: boolean;
}

function useRemoteProgress(userId: string | null) {
  const [result, setResult] = useState<RemoteResult>({
    userId: null,
    state: defaultState(),
    loaded: false,
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    createClient()
      .from("question_attempts")
      .select("question_id, status, selected_index, attempted_at")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setResult({ userId, state: defaultState(), loaded: true });
          return;
        }
        const rows = data as RemoteAttemptRow[];
        const attempts: Record<string, QuestionAttempt> = {};
        for (const row of rows) {
          attempts[row.question_id] = {
            questionId: row.question_id,
            status: row.status,
            attemptedAt: row.attempted_at,
            selectedIndex: row.selected_index ?? undefined,
          };
        }
        setResult({
          userId,
          state: {
            version: 1,
            attempts,
            streak: computeStreakFromDates(
              rows.map((r) => toLocalDate(r.attempted_at)),
            ),
          },
          loaded: true,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const recordAttempt = useCallback(
    (
      questionId: string,
      status: "correct" | "incorrect",
      selectedIndex?: number,
    ) => {
      if (!userId) return;
      const attemptedAt = new Date().toISOString();

      setResult((prev) => {
        const base = prev.userId === userId ? prev.state : defaultState();
        const attempts = {
          ...base.attempts,
          [questionId]: { questionId, status, attemptedAt, selectedIndex },
        };
        return {
          userId,
          loaded: true,
          state: {
            ...base,
            attempts,
            streak: computeStreakFromDates(
              Object.values(attempts).map((a) => toLocalDate(a.attemptedAt)),
            ),
          },
        };
      });

      createClient()
        .from("question_attempts")
        .upsert({
          user_id: userId,
          question_id: questionId,
          status,
          selected_index: selectedIndex ?? null,
          attempted_at: attemptedAt,
        })
        .then(({ error }) => {
          if (error) console.error("Failed to save attempt:", error.message);
        });
    },
    [userId],
  );

  const resetProgress = useCallback(() => {
    if (!userId) return;
    setResult({ userId, state: defaultState(), loaded: true });
    createClient()
      .from("question_attempts")
      .delete()
      .eq("user_id", userId)
      .then(({ error }) => {
        if (error) console.error("Failed to reset progress:", error.message);
      });
  }, [userId]);

  /** One-time on first sign-in: pushes attempts that only exist in the
   * anonymous localStorage store up to the account. `ignoreDuplicates`
   * on the upsert means a question already answered under this account
   * always wins over the local copy, even under a race with another tab
   * running the same migration. Returns whether it's now safe to clear
   * the local copy (true also when there was nothing to migrate). */
  const migrateFromLocal = useCallback(
    async (localAttempts: QuestionAttempt[]): Promise<boolean> => {
      if (!userId || localAttempts.length === 0) return true;

      const existing = result.userId === userId ? result.state.attempts : {};
      const toInsert = localAttempts
        .filter((a) => !existing[a.questionId])
        .map((a) => ({
          user_id: userId,
          question_id: a.questionId,
          status: a.status,
          selected_index: a.selectedIndex ?? null,
          attempted_at: a.attemptedAt,
        }));
      if (toInsert.length === 0) return true;

      const { error } = await createClient()
        .from("question_attempts")
        .upsert(toInsert, {
          onConflict: "user_id,question_id",
          ignoreDuplicates: true,
        });
      if (error) {
        console.error("Failed to migrate local progress:", error.message);
        return false;
      }

      setResult((prev) => {
        const base = prev.userId === userId ? prev.state : defaultState();
        const attempts = { ...base.attempts };
        for (const row of toInsert) {
          if (attempts[row.question_id]) continue;
          attempts[row.question_id] = {
            questionId: row.question_id,
            status: row.status,
            attemptedAt: row.attempted_at,
            selectedIndex: row.selected_index ?? undefined,
          };
        }
        return {
          userId,
          loaded: true,
          state: {
            ...base,
            attempts,
            streak: computeStreakFromDates(
              Object.values(attempts).map((a) => toLocalDate(a.attemptedAt)),
            ),
          },
        };
      });
      return true;
    },
    [userId, result],
  );

  const state = result.userId === userId ? result.state : defaultState();
  const loaded = result.userId === userId && result.loaded;

  return { state, loaded, recordAttempt, resetProgress, migrateFromLocal };
}

export function useProgress() {
  const localState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const localHydrated = useSyncExternalStore(
    subscribeNever,
    getIsHydrated,
    getIsHydratedServer,
  );

  // Runs once per mounted consumer; a no-op after the first caller has
  // already resynced this render pass, since cachedState is module-level.
  useEffect(() => {
    resync();
  }, []);

  const localRecordAttempt = useCallback(
    (
      questionId: string,
      status: "correct" | "incorrect",
      selectedIndex?: number,
    ) => {
      const prev = getSnapshot();
      const attempt: QuestionAttempt = {
        questionId,
        status,
        attemptedAt: new Date().toISOString(),
        selectedIndex,
      };
      commit({
        ...prev,
        attempts: { ...prev.attempts, [questionId]: attempt },
        streak: withStreakUpdate(prev.streak),
      });
    },
    [],
  );

  const localResetProgress = useCallback(() => {
    commit(defaultState());
  }, []);

  // undefined = auth state not resolved yet, treated as signed-out so the
  // local store renders immediately instead of waiting on a network round
  // trip; it flips to the remote store as soon as a user is confirmed.
  const user = useSupabaseUser();
  const {
    state: remoteState,
    loaded: remoteLoaded,
    recordAttempt: recordRemoteAttempt,
    resetProgress: resetRemoteProgress,
    migrateFromLocal,
  } = useRemoteProgress(user ? user.id : null);

  const signedIn = Boolean(user);
  const state = signedIn ? remoteState : localState;
  const hydrated = signedIn ? remoteLoaded : localHydrated;

  // Runs once per signed-in user per mount: folds any anonymous progress
  // made on this device into the account, then clears the local copy so
  // it can't be migrated again (e.g. into a different account later).
  const migratedUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !remoteLoaded) return;
    if (migratedUserRef.current === user.id) return;
    migratedUserRef.current = user.id;

    const localAttempts = Object.values(localState.attempts);
    if (localAttempts.length === 0) return;

    migrateFromLocal(localAttempts).then((ok) => {
      if (ok) localResetProgress();
    });
  }, [user, remoteLoaded, localState.attempts, migrateFromLocal, localResetProgress]);

  const recordAttempt = useCallback(
    (
      questionId: string,
      status: "correct" | "incorrect",
      selectedIndex?: number,
    ) => {
      if (signedIn) {
        recordRemoteAttempt(questionId, status, selectedIndex);
      } else {
        localRecordAttempt(questionId, status, selectedIndex);
      }
    },
    [signedIn, recordRemoteAttempt, localRecordAttempt],
  );

  const resetProgress = useCallback(() => {
    if (signedIn) {
      resetRemoteProgress();
    } else {
      localResetProgress();
    }
  }, [signedIn, resetRemoteProgress, localResetProgress]);

  const getOverallStats = useCallback((): Stats => {
    return computeStats(
      state.attempts,
      ALL_QUESTIONS.map((q) => q.id),
    );
  }, [state.attempts]);

  const getCategoryStats = useCallback(
    (category: Category): Stats => {
      return computeStats(
        state.attempts,
        getQuestionsByCategory(category).map((q) => q.id),
      );
    },
    [state.attempts],
  );

  const getAttempt = useCallback(
    (questionId: string): QuestionAttempt | undefined => {
      return state.attempts[questionId];
    },
    [state.attempts],
  );

  return {
    state,
    hydrated,
    recordAttempt,
    resetProgress,
    getOverallStats,
    getCategoryStats,
    getAttempt,
  };
}
