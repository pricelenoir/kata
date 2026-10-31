import { describe, expect, it } from "vitest";
import type { JsonValue, ValueType } from "@/types/coding-exercise";
import { Decoder, encodeValue, RESULT_MARKER, splitResult, validateValue } from "./codec";

function roundTrip(value: JsonValue, type: ValueType): JsonValue {
  return new Decoder(Buffer.from(encodeValue(value, type), "utf8")).read(type);
}

describe("codec", () => {
  it.each<[JsonValue, ValueType]>([
    [42, "int"],
    [-(2 ** 31), "int"],
    [2 ** 53 - 1, "long"],
    [0.1, "double"],
    [-1.5e-300, "double"],
    [true, "bool"],
    ["", "string"],
    ["has spaces\nand newlines: 3:abc", "string"],
    ["ünïcødé ✓", "string"],
    [[], "int[]"],
    [[1, -2, 3], "int[]"],
    [[["a b", ""], [], ["x"]], "string[][]"],
    [[[true], [false, true]], "bool[][]"],
  ])("round-trips %j as %s", (value, type) => {
    expect(roundTrip(value, type)).toEqual(value);
  });

  it("measures string length in UTF-8 bytes", () => {
    expect(encodeValue("é", "string")).toBe("2:é");
  });

  it("keeps out-of-range integers from rounding into a match", () => {
    const decoded = new Decoder(Buffer.from("9007199254740993")).read("long");
    expect(decoded).toBe("9007199254740993");
  });

  it("rejects malformed output", () => {
    expect(() => new Decoder(Buffer.from("abc")).read("int")).toThrow(/expected an integer/);
    expect(() => new Decoder(Buffer.from("5:ab")).read("string")).toThrow(/past end/);
    expect(() => new Decoder(Buffer.from("nan")).read("double")).toThrow(/expected a number/);
    expect(() => new Decoder(Buffer.from("")).read("int[]")).toThrow(/end of output/);
  });

  it("validates values against types", () => {
    expect(validateValue(2 ** 31, "int")).toMatch(/32-bit/);
    expect(validateValue(1.5, "long")).toMatch(/integer/);
    expect(validateValue([1, "x"], "int[]", "xs")).toBe("xs[1]: expected a 32-bit int");
    expect(validateValue([[1]], "int[][]")).toBeNull();
  });

  it("separates user prints from the driver's result", () => {
    const out = Buffer.from(`debug line\n${RESULT_MARKER}7\n`, "latin1");
    const split = splitResult(out)!;
    expect(split.userOutput.toString()).toBe("debug line\n");
    expect(split.result.toString()).toBe("7\n");
    expect(splitResult(Buffer.from("no marker"))).toBeNull();
  });
});
