"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Category } from "@/types/category";
import type { ProgressState, QuestionAttempt } from "@/types/progress";
import { ALL_QUESTIONS } from "@/content/questions";
import { getQuestionsByCategory } from "@/lib/questions";

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

// ---- External store: localStorage, subscribed to via useSyncExternalStore ----
// (rather than an effect that calls setState, which causes an avoidable
// double-render and trips react-hooks/set-state-in-effect)

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

export function useProgress() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribeNever,
    getIsHydrated,
    getIsHydratedServer,
  );

  // Runs once per mounted consumer; a no-op after the first caller has
  // already resynced this render pass, since cachedState is module-level.
  useEffect(() => {
    resync();
  }, []);

  const recordAttempt = useCallback(
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

  const resetProgress = useCallback(() => {
    commit(defaultState());
  }, []);

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
