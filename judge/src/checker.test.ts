import { describe, expect, it } from "vitest";
import { normalizeStdout, outputsMatch } from "./checker";

describe("outputsMatch", () => {
  it("ignores trailing whitespace and blank lines for program output", () => {
    expect(outputsMatch("stdio", undefined, "a 1\nb 2\n", "a 1  \nb 2\n\n\n")).toBe(true);
    expect(outputsMatch("harness", undefined, "a 1\n", "a 2\n")).toBe(false);
    expect(normalizeStdout("x\r\ny  \n")).toBe("x\ny");
  });

  it("compares values exactly by default", () => {
    expect(outputsMatch("function", undefined, [1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(outputsMatch("function", undefined, [1, 2], [2, 1])).toBe(false);
    expect(outputsMatch("design", undefined, [null, 1, true], [null, 1, true])).toBe(true);
  });

  it("allows any order with the unordered checker", () => {
    const unordered = { kind: "unordered" } as const;
    expect(outputsMatch("function", unordered, [3, 1, 2], [1, 2, 3])).toBe(true);
    expect(outputsMatch("function", unordered, [1, 1, 2], [1, 2, 2])).toBe(false);
  });

  it("uses relative tolerance for large floats and absolute near zero", () => {
    const float = { kind: "float", tolerance: 1e-6 } as const;
    expect(outputsMatch("function", float, 1e9, 1e9 + 100)).toBe(true);
    expect(outputsMatch("function", float, 0, 5e-7)).toBe(true);
    expect(outputsMatch("function", float, 1, 1.01)).toBe(false);
  });
});
