import { describe, expect, it } from "vitest";
import {
  computeStats,
  computeStreakFromDates,
  liveStreak,
  withStreakUpdate,
} from "@/lib/progress-logic";
import type { QuestionAttempt } from "@/types/progress";

function attempt(
  questionId: string,
  status: QuestionAttempt["status"],
): QuestionAttempt {
  return { questionId, status, attemptedAt: "2026-01-01T00:00:00Z" };
}

describe("computeStreakFromDates", () => {
  it("is empty for no activity", () => {
    expect(computeStreakFromDates([])).toEqual({
      current: 0,
      longest: 0,
      lastActiveDate: "",
    });
  });

  it("counts consecutive days, ignoring duplicates and order", () => {
    expect(
      computeStreakFromDates([
        "2026-03-03",
        "2026-03-01",
        "2026-03-02",
        "2026-03-02",
      ]),
    ).toEqual({ current: 3, longest: 3, lastActiveDate: "2026-03-03" });
  });

  it("tracks the longest run separately from the latest one", () => {
    expect(
      computeStreakFromDates([
        "2026-03-01",
        "2026-03-02",
        "2026-03-03",
        "2026-03-10",
        "2026-03-11",
      ]),
    ).toEqual({ current: 2, longest: 3, lastActiveDate: "2026-03-11" });
  });

  it("isn't thrown off by a DST transition", () => {
    // US DST starts 2026-03-08.
    expect(
      computeStreakFromDates(["2026-03-07", "2026-03-08", "2026-03-09"]).current,
    ).toBe(3);
  });
});

describe("withStreakUpdate", () => {
  const streak = { current: 4, longest: 6, lastActiveDate: "2026-05-10" };

  it("is a no-op for a second answer on the same day", () => {
    expect(withStreakUpdate(streak, "2026-05-10")).toBe(streak);
  });

  it("extends on the next day", () => {
    expect(withStreakUpdate(streak, "2026-05-11")).toEqual({
      current: 5,
      longest: 6,
      lastActiveDate: "2026-05-11",
    });
  });

  it("restarts after a gap", () => {
    expect(withStreakUpdate(streak, "2026-05-13").current).toBe(1);
  });

  it("starts from nothing", () => {
    expect(
      withStreakUpdate({ current: 0, longest: 0, lastActiveDate: "" }, "2026-05-13"),
    ).toEqual({ current: 1, longest: 1, lastActiveDate: "2026-05-13" });
  });
});

describe("liveStreak", () => {
  const streak = { current: 4, longest: 6, lastActiveDate: "2026-05-10" };

  it("keeps a streak that was active today or yesterday", () => {
    expect(liveStreak(streak, "2026-05-10").current).toBe(4);
    expect(liveStreak(streak, "2026-05-11").current).toBe(4);
  });

  it("zeroes the current (not longest) streak once it has lapsed", () => {
    expect(liveStreak(streak, "2026-05-12")).toEqual({ ...streak, current: 0 });
  });
});

describe("computeStats", () => {
  it("only counts attempts for questions that still exist", () => {
    const attempts = {
      a: attempt("a", "correct"),
      b: attempt("b", "incorrect"),
      deleted: attempt("deleted", "correct"),
    };
    expect(computeStats(attempts, ["a", "b", "c"])).toEqual({
      answered: 2,
      total: 3,
      correct: 1,
      accuracy: 50,
    });
  });

  it("reports 0% (not NaN) with nothing answered", () => {
    expect(computeStats({}, ["a"]).accuracy).toBe(0);
  });
});
