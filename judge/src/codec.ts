import type { JsonValue, ScalarType, ValueType } from "@/types/coding-exercise";

// The wire format between the judge and a generated test driver. Every
// language's driver reads and writes exactly this, so test values stay plain
// JSON in content and the drivers stay tiny (no JSON parser in C++/Rust).
//
//   int, long   decimal integer
//   double      shortest round-trip decimal (may use exponent notation)
//   bool        0 or 1
//   string      <utf-8 byte length>:<raw bytes>   (raw may contain spaces)
//   T[]         <n> followed by n encoded elements
//
// Tokens are separated by ASCII whitespace. Arguments are one per line.

/** Separates a function driver's result from whatever the user's own code
 * printed to stdout. Drivers flush, print this, then the encoded result. */
export const RESULT_MARKER = "\x1eKATA-RESULT\x1e\n";

export interface ParsedType {
  scalar: ScalarType;
  /** 0 = scalar, 1 = T[], 2 = T[][] */
  depth: 0 | 1 | 2;
}

export function parseType(type: ValueType): ParsedType {
  const depth = (type.match(/\[\]/g) ?? []).length;
  return { scalar: type.replace(/\[\]/g, "") as ScalarType, depth: depth as 0 | 1 | 2 };
}

const INT_MIN = -(2 ** 31);
const INT_MAX = 2 ** 31 - 1;

/** Null when `value` is a valid `type`, otherwise what's wrong with it. */
export function validateValue(value: JsonValue, type: ValueType, path = "value"): string | null {
  const { scalar, depth } = parseType(type);
  if (depth > 0) {
    if (!Array.isArray(value)) return `${path}: expected ${type}`;
    const inner = (depth === 2 ? `${scalar}[]` : scalar) as ValueType;
    for (let i = 0; i < value.length; i++) {
      const err = validateValue(value[i], inner, `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  switch (scalar) {
    case "int":
      return Number.isInteger(value) && (value as number) >= INT_MIN && (value as number) <= INT_MAX
        ? null
        : `${path}: expected a 32-bit int`;
    case "long":
      return Number.isSafeInteger(value) ? null : `${path}: expected an integer within ±2^53`;
    case "double":
      return typeof value === "number" && Number.isFinite(value) ? null : `${path}: expected a finite number`;
    case "bool":
      return typeof value === "boolean" ? null : `${path}: expected a boolean`;
    case "string":
      return typeof value === "string" ? null : `${path}: expected a string`;
  }
}

export function encodeValue(value: JsonValue, type: ValueType): string {
  const { scalar, depth } = parseType(type);
  if (depth > 0) {
    const items = value as JsonValue[];
    const inner = (depth === 2 ? `${scalar}[]` : scalar) as ValueType;
    return [String(items.length), ...items.map((v) => encodeValue(v, inner))].join(" ");
  }
  switch (scalar) {
    case "int":
    case "long":
    case "double":
      return String(value);
    case "bool":
      return value ? "1" : "0";
    case "string": {
      const s = value as string;
      return `${Buffer.byteLength(s, "utf8")}:${s}`;
    }
  }
}

export class DecodeError extends Error {}

/** Reads encoded values back out of a driver's output. Works on bytes, not
 * a JS string, because string lengths on the wire are UTF-8 byte counts. */
export class Decoder {
  private pos = 0;

  constructor(private readonly buf: Buffer) {}

  private skipSpace(): void {
    while (this.pos < this.buf.length && isSpace(this.buf[this.pos])) this.pos++;
  }

  private token(): string {
    this.skipSpace();
    const start = this.pos;
    while (this.pos < this.buf.length && !isSpace(this.buf[this.pos])) this.pos++;
    if (start === this.pos) throw new DecodeError("unexpected end of output");
    return this.buf.toString("latin1", start, this.pos);
  }

  read(type: ValueType): JsonValue {
    const { scalar, depth } = parseType(type);
    if (depth > 0) {
      const n = this.count();
      const inner = (depth === 2 ? `${scalar}[]` : scalar) as ValueType;
      const out: JsonValue[] = [];
      for (let i = 0; i < n; i++) out.push(this.read(inner));
      return out;
    }
    switch (scalar) {
      case "int":
      case "long":
        return this.integer();
      case "double": {
        const t = this.token();
        const n = Number(t);
        // nan/inf from the program land here too — reported as malformed
        // output, which is more useful than a silent mismatch.
        if (Number.isNaN(n)) throw new DecodeError(`expected a number, got ${JSON.stringify(t)}`);
        return n;
      }
      case "bool": {
        const t = this.token();
        if (t !== "0" && t !== "1") throw new DecodeError(`expected 0 or 1, got ${JSON.stringify(t)}`);
        return t === "1";
      }
      case "string":
        return this.string();
    }
  }

  /** Integers beyond JS's safe range come back as their decimal string, so
   * they can never compare equal to a (safe) expected number by rounding. */
  private integer(): JsonValue {
    const t = this.token();
    if (!/^-?\d+$/.test(t)) throw new DecodeError(`expected an integer, got ${JSON.stringify(t)}`);
    const n = Number(t);
    return Number.isSafeInteger(n) ? n : t;
  }

  private count(): number {
    const t = this.token();
    if (!/^\d+$/.test(t)) throw new DecodeError(`expected a length, got ${JSON.stringify(t)}`);
    const n = Number(t);
    if (n > this.buf.length) throw new DecodeError(`length ${n} exceeds output size`);
    return n;
  }

  private string(): string {
    this.skipSpace();
    const colon = this.buf.indexOf(0x3a, this.pos);
    if (colon === -1) throw new DecodeError("expected <length>:<string>");
    const lenText = this.buf.toString("latin1", this.pos, colon);
    if (!/^\d+$/.test(lenText)) throw new DecodeError(`bad string length ${JSON.stringify(lenText)}`);
    const len = Number(lenText);
    const start = colon + 1;
    if (start + len > this.buf.length) throw new DecodeError("string runs past end of output");
    this.pos = start + len;
    return this.buf.toString("utf8", start, start + len);
  }

  /** True when only whitespace remains. */
  atEnd(): boolean {
    this.skipSpace();
    return this.pos >= this.buf.length;
  }
}

function isSpace(b: number): boolean {
  return b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09;
}

/** Splits a function/design driver's stdout into the user's own prints and
 * the encoded result. Null when the marker never appeared (the program died
 * or exited before the driver could report). */
export function splitResult(stdout: Buffer): { userOutput: Buffer; result: Buffer } | null {
  const marker = Buffer.from(RESULT_MARKER, "latin1");
  const at = stdout.lastIndexOf(marker);
  if (at === -1) return null;
  return { userOutput: stdout.subarray(0, at), result: stdout.subarray(at + marker.length) };
}
