import type { Language } from "@/types/coding-exercise";
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
}

function image(id: Language): string {
  return process.env[`JUDGE_IMAGE_${id.toUpperCase()}`] ?? `kata-judge-${id}:latest`;
}

export const RUNTIMES: Record<Language, LanguageRuntime> = {
  cpp: {
    id: "cpp",
    image: image("cpp"),
    sourcePath: "/work/main.cpp",
    // Must match the flags kata_prelude.h.gch was built with in the image,
    // or GCC silently ignores the precompiled header.
    compile: [
      "g++",
      "-std=gnu++23",
      "-O2",
      "-pipe",
      "-fdiagnostics-color=never",
      "-fmax-errors=20",
      "-I/opt/kata",
      "-o",
      "/work/main",
      "/work/main.cpp",
    ],
    run: ["/work/main"],
    pool: "cpu",
    harness: HARNESSES.cpp,
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
