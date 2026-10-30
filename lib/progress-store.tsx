"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CATEGORIES, type Category } from "@/types/category";
import type { ProgressState, QuestionAttempt } from "@/types/progress";
import {
  computeStats,
  computeStreakFromDates,
  defaultState,
  liveStreak,
  toLocalDate,
  withStreakUpdate,
  type Stats,
} from "@/lib/progress-logic";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseUser } from "@/lib/supabase/use-user";

export type { Stats } from "@/lib/progress-logic";

const STORAGE_KEY = "kata:progress:v1";

// ---- External store: localStorage, subscribed to via useSyncExternalStore ----
// (rather than an effect that calls setState, which causes an avoidable
// double-render and trips react-hooks/set-state-in-effect)
//
// This is the anonymous/logged-out path. Signed-in users are backed by
// Supabase instead (see useRemoteProgress below) — the two never mix; local
// progress is folded into the account once, on first sign-in.

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
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (private mode) — progress still works for
    // this page load, it just won't persist.
  }
  listeners.forEach((l) => l());
}

/** Re-reads localStorage and notifies subscribers — used once on mount to
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
// would mismatch the server's render.
function subscribeNever(): () => void {
  return () => {};
}
function getIsHydrated(): boolean {
  return true;
}
function getIsHydratedServer(): boolean {
  return false;
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

interface RemoteAttemptRow {
  question_id: string;
  status: "correct" | "incorrect";
  selected_index: number | null;
  attempted_at: string;
}

function rowToAttempt(row: RemoteAttemptRow): QuestionAttempt {
  return {
    questionId: row.question_id,
    status: row.status,
    attemptedAt: row.attempted_at,
    selectedIndex: row.selected_index ?? undefined,
  };
}

/** Supabase-backed mirror of the local store's shape, active only while a
 * user is signed in. Writes go to the append-only `question_attempt_events`
 * table; a trigger keeps `question_attempts` (latest attempt per question)
 * in sync, and RLS scopes both to the signed-in user (see
 * supabase/migrations/0002_attempt_events.sql). */
interface RemoteResult {
  /** Which user this result belongs to — `null` until the first fetch
   * resolves. Compared against the current `userId` on every render so a
   * stale result from a *previous* user can never be shown as this user's
   * data (e.g. sign out then immediately sign in as someone else in the same
   * tab). */
  userId: string | null;
  attempts: Record<string, QuestionAttempt>;
  /** Distinct local dates with any activity, from the full event history —
   * the latest-attempt table alone would lose days whenever an old question
   * is re-answered. */
  activityDates: string[];
  loaded: boolean;
}

const EMPTY_REMOTE: Omit<RemoteResult, "userId"> = {
  attempts: {},
  activityDates: [],
  loaded: false,
};

function useRemoteProgress(userId: string | null) {
  const [result, setResult] = useState<RemoteResult>({
    userId: null,
    ...EMPTY_REMOTE,
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      supabase
        .from("question_attempts")
        .select("question_id, status, selected_index, attempted_at")
        .eq("user_id", userId),
      supabase.rpc("activity_dates", { tz: browserTimeZone() }),
    ]).then(([attemptsRes, datesRes]) => {
      if (cancelled) return;
      const rows = (attemptsRes.data ?? []) as RemoteAttemptRow[];
      if (attemptsRes.error) {
        console.error("Failed to load progress:", attemptsRes.error.message);
      }
      const attempts: Record<string, QuestionAttempt> = {};
      for (const row of rows) attempts[row.question_id] = rowToAttempt(row);
      const activityDates = datesRes.error
        ? rows.map((r) => toLocalDate(r.attempted_at))
        : (datesRes.data as string[]);
      setResult({ userId, attempts, activityDates, loaded: true });
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
        const base = prev.userId === userId ? prev : { ...EMPTY_REMOTE };
        return {
          userId,
          loaded: true,
          attempts: {
            ...base.attempts,
            [questionId]: { questionId, status, attemptedAt, selectedIndex },
          },
          activityDates: [...base.activityDates, toLocalDate(attemptedAt)],
        };
      });

      createClient()
        .from("question_attempt_events")
        .insert({
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
    setResult({ userId, ...EMPTY_REMOTE, loaded: true });
    createClient()
      .rpc("reset_my_progress")
      .then(({ error }) => {
        if (error) console.error("Failed to reset progress:", error.message);
      });
  }, [userId]);

  /** One-time on first sign-in: pushes attempts that only exist in the
   * anonymous localStorage store up to the account. Questions already
   * answered under this account are skipped, so the account's own history
   * always wins over the local copy. Returns whether it's now safe to clear
   * the local copy (true also when there was nothing to migrate). */
  const migrateFromLocal = useCallback(
    async (localAttempts: QuestionAttempt[]): Promise<boolean> => {
      if (!userId || localAttempts.length === 0) return true;

      const existing = result.userId === userId ? result.attempts : {};
      const toInsert = localAttempts.filter((a) => !existing[a.questionId]);
      if (toInsert.length === 0) return true;

      const { error } = await createClient()
        .from("question_attempt_events")
        .insert(
          toInsert.map((a) => ({
            user_id: userId,
            question_id: a.questionId,
            status: a.status,
            selected_index: a.selectedIndex ?? null,
            attempted_at: a.attemptedAt,
          })),
        );
      if (error) {
        console.error("Failed to migrate local progress:", error.message);
        return false;
      }

      setResult((prev) => {
        const base = prev.userId === userId ? prev : { ...EMPTY_REMOTE };
        const attempts = { ...base.attempts };
        for (const a of toInsert) attempts[a.questionId] ??= a;
        return {
          userId,
          loaded: true,
          attempts,
          activityDates: [
            ...base.activityDates,
            ...toInsert.map((a) => toLocalDate(a.attemptedAt)),
          ],
        };
      });
      return true;
    },
    [userId, result],
  );

  const current = result.userId === userId ? result : null;
  const state = useMemo<ProgressState>(
    () =>
      current
        ? {
            version: 1,
            attempts: current.attempts,
            streak: computeStreakFromDates(current.activityDates),
          }
        : defaultState(),
    [current],
  );
  const loaded = Boolean(current?.loaded);

  return { state, loaded, recordAttempt, resetProgress, migrateFromLocal };
}

export interface ProgressApi {
  state: ProgressState;
  hydrated: boolean;
  recordAttempt: (
    questionId: string,
    status: "correct" | "incorrect",
    selectedIndex?: number,
  ) => void;
  resetProgress: () => void;
  getOverallStats: () => Stats;
  getCategoryStats: (category: Category) => Stats;
  getAttempt: (questionId: string) => QuestionAttempt | undefined;
}

const ProgressContext = createContext<ProgressApi | null>(null);

/** Owns all progress state for the page — mounted once in the root layout so
 * every consumer shares one localStorage subscription, one auth listener,
 * and one Supabase fetch, and sees each recorded attempt immediately.
 * `questionIds` comes from the server so stats can be computed without
 * shipping the question bank itself to the browser. */
export function ProgressProvider({
  questionIds,
  children,
}: {
  questionIds: Record<Category, string[]>;
  children: React.ReactNode;
}) {
  const localState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const localHydrated = useSyncExternalStore(
    subscribeNever,
    getIsHydrated,
    getIsHydratedServer,
  );

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
        streak: withStreakUpdate(prev.streak, toLocalDate(new Date())),
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
  const rawState = signedIn ? remoteState : localState;
  const hydrated = signedIn ? remoteLoaded : localHydrated;

  // Today is read during render on purpose: it's what makes a streak that
  // lapsed while the tab sat open stop counting as current. Hydration-safe
  // because the server snapshot has no lastActiveDate to compare against.
  const today = toLocalDate(new Date());
  const state = useMemo<ProgressState>(
    () => ({ ...rawState, streak: liveStreak(rawState.streak, today) }),
    [rawState, today],
  );

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

  const recordAttempt = useCallback<ProgressApi["recordAttempt"]>(
    (questionId, status, selectedIndex) => {
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

  const allQuestionIds = useMemo(
    () => CATEGORIES.flatMap((c) => questionIds[c] ?? []),
    [questionIds],
  );

  const value = useMemo<ProgressApi>(
    () => ({
      state,
      hydrated,
      recordAttempt,
      resetProgress,
      getOverallStats: () => computeStats(state.attempts, allQuestionIds),
      getCategoryStats: (category) =>
        computeStats(state.attempts, questionIds[category] ?? []),
      getAttempt: (questionId) => state.attempts[questionId],
    }),
    [state, hydrated, recordAttempt, resetProgress, allQuestionIds, questionIds],
  );

  return <ProgressContext value={value}>{children}</ProgressContext>;
}

export function useProgress(): ProgressApi {
  const ctx = use(ProgressContext);
  if (!ctx) {
    throw new Error("useProgress() must be used inside <ProgressProvider>");
  }
  return ctx;
}
