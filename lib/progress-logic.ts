import type { ProgressState, QuestionAttempt } from "@/types/progress";

// Pure progress math, kept separate from the React store in
// progress-store.tsx so it can be unit tested without a DOM.

export interface Stats {
  answered: number;
  total: number;
  correct: number;
  /** 0-100, rounded. 0 (not NaN) when nothing has been answered yet. */
  accuracy: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function defaultState(): ProgressState {
  return {
    version: 1,
    attempts: {},
    streak: { current: 0, longest: 0, lastActiveDate: "" },
  };
}

/** YYYY-MM-DD in the viewer's local timezone. */
export function toLocalDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Whole days between two YYYY-MM-DD strings. Both parse as UTC midnight,
 * so DST shifts in the local timezone can't skew the difference. */
function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS,
  );
}

export function withStreakUpdate(
  streak: ProgressState["streak"],
  today: string,
): ProgressState["streak"] {
  if (streak.lastActiveDate === today) return streak;

  if (streak.lastActiveDate) {
    const current =
      daysBetween(streak.lastActiveDate, today) === 1 ? streak.current + 1 : 1;
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
export function computeStreakFromDates(
  dates: string[],
): ProgressState["streak"] {
  const uniqueSorted = Array.from(new Set(dates)).sort();
  if (uniqueSorted.length === 0) {
    return { current: 0, longest: 0, lastActiveDate: "" };
  }
  let current = 1;
  let longest = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    current =
      daysBetween(uniqueSorted[i - 1], uniqueSorted[i]) === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return {
    current,
    longest,
    lastActiveDate: uniqueSorted[uniqueSorted.length - 1],
  };
}

/** A stored streak only counts as "current" while it's still alive: active
 * today, or yesterday (today's practice just hasn't happened yet). Both
 * stores only touch the streak on activity, so without this a run that
 * ended a week ago would keep displaying as the current streak. */
export function liveStreak(
  streak: ProgressState["streak"],
  today: string,
): ProgressState["streak"] {
  if (!streak.lastActiveDate) return streak;
  const gap = daysBetween(streak.lastActiveDate, today);
  return gap <= 1 ? streak : { ...streak, current: 0 };
}

export function computeStats(
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
