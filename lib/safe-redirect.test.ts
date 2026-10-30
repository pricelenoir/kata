import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

const FALLBACK = "/questions";

describe("safeRedirectPath", () => {
  it.each([
    ["/progress", "/progress"],
    ["/questions/cpp/cpp-rvo-01", "/questions/cpp/cpp-rvo-01"],
    ["/coding?difficulty=hard#top", "/coding?difficulty=hard#top"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(safeRedirectPath(input, FALLBACK)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "progress",
    "//evil.com",
    "//evil.com/path",
    "/\\evil.com",
    "/\t/evil.com",
    "@evil.com",
    ".evil.com",
    "https://evil.com",
    "javascript:alert(1)",
  ])("falls back for %j", (input) => {
    expect(safeRedirectPath(input, FALLBACK)).toBe(FALLBACK);
  });

  it("can't produce a userinfo URL when appended to an origin", () => {
    const next = safeRedirectPath("@evil.com", FALLBACK);
    expect(new URL(next, "https://kata.dev").host).toBe("kata.dev");
  });
});
