import type { Stats } from "@/lib/progress-logic";
import type { Category } from "@/types/category";

export interface CategoryStatsEntry {
  category: Category;
  stats: Stats;
}

export interface WeakestCategoryResult {
  category: Category;
  stats: Stats;
  /** "accuracy" when this is the lowest-accuracy category among ones with
   * at least one answered question — a genuine weak spot. "unstarted" when
   * nothing has been attempted anywhere yet (or everything attempted is
   * already perfect), so this is just the least-practiced category —
   * presented as "start here" rather than "you're bad at this." */
  reason: "accuracy" | "unstarted";
}

/**
 * Picks the single category most worth focusing on next, out of per-category
 * stats.
 *
 * Heuristic: among categories with at least one answered question, the
 * lowest accuracy wins — ties broken toward whichever has more unanswered
 * questions left, since there's more ground left to cover there. If nothing
 * has been attempted anywhere, or everything attempted so far is already
 * 100% correct, falls back to the least-practiced category (fewest answered)
 * so there's still a sensible pointer for a brand-new or high-performing
 * user. Returns undefined only when every category is fully and correctly
 * answered.
 */
export function getWeakestCategory(
  entries: CategoryStatsEntry[],
): WeakestCategoryResult | undefined {
  if (entries.length === 0) return undefined;

  const attempted = entries.filter((e) => e.stats.answered > 0);
  if (attempted.length > 0) {
    const allPerfect = attempted.every(
      (e) => e.stats.accuracy === 100 && e.stats.answered === e.stats.total,
    );
    if (!allPerfect) {
      const [worst] = [...attempted].sort((a, b) => {
        if (a.stats.accuracy !== b.stats.accuracy) {
          return a.stats.accuracy - b.stats.accuracy;
        }
        const aRemaining = a.stats.total - a.stats.answered;
        const bRemaining = b.stats.total - b.stats.answered;
        return bRemaining - aRemaining;
      });
      return { category: worst.category, stats: worst.stats, reason: "accuracy" };
    }
  }

  const [leastStarted] = [...entries].sort(
    (a, b) => a.stats.answered - b.stats.answered,
  );
  if (leastStarted.stats.answered === leastStarted.stats.total) return undefined;
  return {
    category: leastStarted.category,
    stats: leastStarted.stats,
    reason: "unstarted",
  };
}
