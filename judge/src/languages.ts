import type { Language, Sanitizer } from "@/types/coding-exercise";
import { HARNESSES } from "./harness";
import type { Harness } from "./harness/types";

/** Everything the judge needs to build and run one language. Adding a
 * language means: a harness (starter + driver), an image target in
 * judge/images/Dockerfile, and an entry here.
 *
 * Planned beyond C++/Rust, and what each needs on top of this shape:
 * - CUDA: runs on the "gpu" pool (separate runner hosts with NVIDIA GPUs and
 *   gVisor's nvproxy), so `pool` routes jobs; timing is noisier, so float
 *   checkers and generous limits. Compile-only exercises (inspect PTX/SASS)
 *   can stay on the CPU pool.
 * - LLVM/MLIR: submissions are often IR or a pass plugin rather than a
 *   program reading stdin, so they need a different exercise mode — a
 *   toolchain pipeline (`opt -passes=…`, `mlir-opt …`) whose output is
 *   checked with FileCheck patterns or by executing the result (`lli`,
 *   `mlir-cpu-runner`). The sandbox, wrapper, and verdicts carry over; the
 *   harness/checker layer is what changes. */
/** An instrumented build of the same program (see SanitizerCheck). */
export interface SanitizerBuild {
  compile: string[];
  /** Runtime options for the sanitizer. Every build reports by exiting
   * with SANITIZER_EXIT, which no driver uses. */
  env: Record<string, string>;
}

/** Exit status sanitizers are configured to use when they report. */
export const SANITIZER_EXIT = 66;

export interface LanguageRuntime {
  id: Language;
  image: string;
  /** Where the generated program is written inside the sandbox. */
  sourcePath: string;
  compile: string[];
  run: string[];
  /** Runner pool that can execute it; workers only claim their own pool. */
  pool: "cpu";
  harness: Harness;
  /** Sanitizers this language can build with. Languages without an entry
   * skip an exercise's sanitizer checks. Rust is absent for now: its
   * sanitizers need a nightly toolchain and a rebuilt std, and safe Rust
   * already rules out data races. */
  sanitize?: Partial<Record<Sanitizer, SanitizerBuild>>;
}

/** Every C++ build. The precompiled header in the image was built with
 * exactly these flags (plus each flavor's extras), per judge/images/Dockerfile,
 * or GCC silently ignores it. */
function cppCompile(output: string, extra: string[] = []): string[] {
  return [
    "g++",
    "-std=gnu++23",
    "-O2",
    ...extra,
    "-pipe",
    "-fdiagnostics-color=never",
    "-fmax-errors=20",
    "-I/opt/kata",
    "-o",
    output,
    "/work/main.cpp",
  ];
}

const SANITIZER_REPORT_OPTIONS = `halt_on_error=1:exitcode=${SANITIZER_EXIT}`;

function image(id: Language): string {
  return process.env[`JUDGE_IMAGE_${id.toUpperCase()}`] ?? `kata-judge-${id}:latest`;
}

export const RUNTIMES: Record<Language, LanguageRuntime> = {
  cpp: {
    id: "cpp",
    image: image("cpp"),
    sourcePath: "/work/main.cpp",
    compile: cppCompile("/work/main"),
    run: ["/work/main"],
    pool: "cpu",
    harness: HARNESSES.cpp,
    sanitize: {
      thread: {
        compile: cppCompile("/work/main-thread", ["-g", "-fno-omit-frame-pointer", "-fsanitize=thread"]),
        env: {
          TSAN_OPTIONS: `${SANITIZER_REPORT_OPTIONS}:second_deadlock_stack=1:report_signal_unsafe=0`,
        },
      },
      address: {
        compile: cppCompile("/work/main-address", [
          "-g",
          "-fno-omit-frame-pointer",
          "-fsanitize=address,undefined",
          "-fno-sanitize-recover=all",
        ]),
        env: {
          // verify_asan_link_order: the judge LD_PRELOADs libkata_threads
          // ahead of the ASan runtime, which is harmless but trips the check.
          ASAN_OPTIONS: `${SANITIZER_REPORT_OPTIONS}:detect_leaks=1:detect_stack_use_after_return=1:verify_asan_link_order=0`,
          LSAN_OPTIONS: `exitcode=${SANITIZER_EXIT}`,
          UBSAN_OPTIONS: `${SANITIZER_REPORT_OPTIONS}:print_stacktrace=1`,
        },
      },
    },
  },
  rust: {
    id: "rust",
    image: image("rust"),
    sourcePath: "/work/solution.rs",
    compile: [
      "rustc",
      "--edition=2024",
      "--color=never",
      "-C",
      "opt-level=2",
      // Integer overflow panics instead of wrapping — the bug is the
      // lesson, so surface it.
      "-C",
      "overflow-checks=on",
      "-o",
      "/work/main",
      "/work/solution.rs",
    ],
    run: ["/work/main"],
    pool: "cpu",
    harness: HARNESSES.rust,
  },
};
