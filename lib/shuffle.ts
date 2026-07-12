/**
 * Deterministic Fisher-Yates shuffle (seeded LCG) — same input + seed always
 * produces the same order. Used to interleave content that's authored/stored
 * grouped by category so browse tables don't read as "all cpp, then all os, …".
 */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
