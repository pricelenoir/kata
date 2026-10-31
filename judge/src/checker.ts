import type { Checker, ExerciseMode, JsonValue } from "@/types/coding-exercise";

/** Trailing spaces on a line and trailing blank lines never matter — they're
 * invisible in a diff and an easy way to fail a correct program. */
export function normalizeStdout(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd());
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function deepEqual(a: JsonValue, b: JsonValue, numbersEqual: (x: number, y: number) => boolean): boolean {
  if (typeof a === "number" && typeof b === "number") return numbersEqual(a, b);
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i], numbersEqual));
  }
  return a === b;
}

const exactNumbers = (x: number, y: number) => x === y;

function sortedCopy(values: JsonValue[]): JsonValue[] {
  return values
    .map((v) => [JSON.stringify(v), v] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, v]) => v);
}

export function outputsMatch(
  mode: ExerciseMode,
  checker: Checker | undefined,
  expected: JsonValue,
  actual: JsonValue,
): boolean {
  if (mode === "stdio" || mode === "harness") {
    return (
      typeof expected === "string" &&
      typeof actual === "string" &&
      normalizeStdout(expected) === normalizeStdout(actual)
    );
  }
  const kind = checker ?? { kind: "exact" as const };
  switch (kind.kind) {
    case "exact":
      return deepEqual(expected, actual, exactNumbers);
    case "float": {
      const tol = kind.tolerance;
      // Absolute near zero, relative for large magnitudes.
      return deepEqual(expected, actual, (x, y) => Math.abs(x - y) <= tol * Math.max(1, Math.abs(x)));
    }
    case "unordered":
      if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
      return deepEqual(sortedCopy(expected), sortedCopy(actual), exactNumbers);
  }
}
