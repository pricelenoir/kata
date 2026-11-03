import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSanitizerReport } from "./sanitizer";

// Real stderr from the judge image (judge/test/integration/sanitizers/*.cpp).
const sample = (name: string) => readFileSync(join(__dirname, "../test/sanitizer-reports", `${name}.txt`), "utf8");

describe("parseSanitizerReport", () => {
  it("returns null when there's no report", () => {
    expect(parseSanitizerReport("")).toBeNull();
    expect(parseSanitizerReport("debug: 3 items\nWARNING: low on coffee\n")).toBeNull();
  });

  it("trims a ThreadSanitizer data race to the user's frames", () => {
    const parsed = parseSanitizerReport(sample("race"))!;
    expect(parsed.summary).toMatch(/^ThreadSanitizer: data race solution\.cpp:\d+ in work\(\)$/);
    expect(parsed.report).toMatch(/^WARNING: ThreadSanitizer: data race\n/);
    expect(parsed.report).toContain("work() solution.cpp:");
    expect(parsed.report).not.toMatch(/BuildId|\/usr\/include\/|libsanitizer|libtsan|pid=|\/work\/|<null>|={5,}/);
    // Thread creation stacks keep only the user's frame that spawned it.
    expect(parsed.report).toMatch(/created by main thread at:\n {4}#\d+ main solution\.cpp:\d+$/m);
    expect(parsed.rest).toBe("");
  });

  it("keeps an AddressSanitizer report up to its summary, not the shadow map", () => {
    const parsed = parseSanitizerReport(sample("heap-overflow"))!;
    expect(parsed.summary).toMatch(/^AddressSanitizer: heap-buffer-overflow solution\.cpp:\d+ in main$/);
    expect(parsed.report).toMatch(/^ERROR: AddressSanitizer: heap-buffer-overflow/);
    expect(parsed.report).toContain("main solution.cpp:");
    expect(parsed.report).not.toContain("Shadow bytes");
    expect(parsed.report).not.toMatch(/0x[0-9a-f]+ in |BuildId|_start|__libc_start_main/);
  });

  it("reports leaks with the allocating frames", () => {
    const parsed = parseSanitizerReport(sample("leak"))!;
    expect(parsed.summary).toBe("AddressSanitizer: 64 byte(s) leaked in 1 allocation(s).");
    expect(parsed.report).toContain("make() solution.cpp:3");
    expect(parsed.report).not.toContain("operator new[]");
  });

  it("drops a stack that's all plumbing, and its heading stops promising one", () => {
    const parsed = parseSanitizerReport(
      [
        "WARNING: ThreadSanitizer: data race (pid=12)",
        "  Thread T1 (tid=14, running) created by main thread at:",
        "    #0 pthread_create ../../../../src/libsanitizer/tsan/tsan_interceptors_posix.cpp:1022 (libtsan.so.2+0x5bbbc)",
        "    #1 <null> <null> (libc.so.6+0x22258)",
        "SUMMARY: ThreadSanitizer: data race solution.cpp:9 in f()",
      ].join("\n"),
    )!;
    expect(parsed.report).toContain("  Thread T1 (tid=14, running) created by main thread.\n");
    expect(parsed.report).not.toContain("pthread_create");
  });

  it("summarizes UBSan by its first line, and separates the program's own output", () => {
    const stderr = [
      "debug: before",
      "solution.cpp:6:7: runtime error: signed integer overflow: 1 + 2147483647 cannot be represented in type 'int'",
      "    #0 0xaaaab0000d10 in main /work/solution.cpp:6",
      "    #1 0xffffb3f42258  (/lib/aarch64-linux-gnu/libc.so.6+0x22258) (BuildId: 5f39)",
      "    #2 0xaaaab0000dec in _start (/work/main-address+0xdec) (BuildId: 635c)",
    ].join("\n");
    const parsed = parseSanitizerReport(stderr)!;
    expect(parsed.summary).toBe(
      "UndefinedBehaviorSanitizer: signed integer overflow: 1 + 2147483647 cannot be represented in type 'int' (solution.cpp:6:7)",
    );
    expect(parsed.report.split("\n")).toEqual([
      "solution.cpp:6:7: runtime error: signed integer overflow: 1 + 2147483647 cannot be represented in type 'int'",
      "    #0 main solution.cpp:6",
    ]);
    expect(parsed.rest).toBe("debug: before");
  });
});
