import type { TraceQuestion } from "@/types/question";

export const compilersQuestions: TraceQuestion[] = [
  {
    id: "compilers-ub-optimizer-01",
    category: "compilers",
    difficulty: "hard",
    title: "An overflow guard written in pointer arithmetic",
    tags: ["undefined-behavior", "optimizer", "pointer-arithmetic"],
    type: "trace",
    prompt:
      "Compiled with -O2, is this a reliable way to detect that buf + len wrapped around the end of the address space?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstddef>

bool bufferFits(char* buf, size_t len) {
    char* end = buf + len;
    // meant to catch pointer-arithmetic overflow
    if (end < buf) {
        return false;
    }
    return true;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes. end < buf is true exactly when buf + len wraps, and the guard returns false in that case.",
        "No. The optimizer may treat end < buf as always false and fold the guard away.",
        "No. Comparing pointers into unrelated objects gives an unspecified result, fixed arbitrarily at link time.",
        "Yes at -O0, where the comparison is emitted literally, but not at -O2, where the branch gets folded.",
      ],
      correctIndex: 1,
    },
    explanation:
      "Forming `buf + len` when the result lands outside the array `buf` points into (or more than one past its end) is undefined behavior per [expr.add]; pointer arithmetic is only defined within an array object plus one past-the-end position. The optimizer is entitled to assume the program never executes UB, so it reasons backward: `end < buf` can only be true if the addition overflowed, overflow here is UB, therefore `end < buf` is false. GCC and Clang have both been observed compiling guards of this shape into an unconditional `return true`. On other targets the fold is subtler but no more useful: Clang on arm64 rewrites the whole function into a test of the sign bit of `len`, which reports overflow for any `len` above SIZE_MAX/2 and misses the actual wraparound entirely. Either way the guard does not do what it looks like it does, and this is not something -O0 rescues you from, since the same source is UB at every optimization level. Do the check in unsigned integer arithmetic, which has defined wraparound: compare `len > SIZE_MAX - reinterpret_cast<uintptr_t>(buf)`.",
    references: [
      "https://en.cppreference.com/w/cpp/language/operator_arithmetic",
      "https://blog.llvm.org/2011/05/what-every-c-programmer-should-know.html",
    ],
  },
  {
    id: "compilers-strict-aliasing-01",
    category: "compilers",
    difficulty: "hard",
    title: "Type punning through reinterpret_cast",
    tags: ["strict-aliasing", "undefined-behavior", "type-punning"],
    type: "trace",
    prompt:
      "Compiled with -O2 (strict aliasing on, the GCC/Clang default at that level), what does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdio>

float reinterpretAsFloat(int* ip) {
    float* fp = reinterpret_cast<float*>(ip);
    *ip = 0x3F800000;   // bit pattern for 1.0f
    return *fp;         // read back through an incompatible pointer type
}

int main() {
    int x = 0;
    printf("%f\\n", reinterpretAsFloat(&x));
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Always 1.000000. The bit pattern sitting in that storage is the same whichever pointer type reads it back.",
        "Always 0.000000: the load through fp is scheduled ahead of the store through ip committing to memory.",
        "Undefined behavior. It may well print 1.000000, but no particular output is guaranteed.",
        "Well-defined but implementation-defined: the result depends on the platform's float representation, which the ABI documents.",
      ],
      correctIndex: 2,
    },
    explanation:
      "The strict aliasing rule ([basic.lval]p11) says an object may only be accessed through a glvalue of its own type, a similar type, or one of a few exempted types (`char`, `unsigned char`, `std::byte`). `int` and `float` are neither the same nor 'similar', so reading the `int` object `x` through the `float*` `fp` is undefined behavior, not merely implementation-defined. Because the optimizer is allowed to assume `*ip` and `*fp` never refer to the same storage, it may schedule the store and the load in either order, or reuse a previously loaded value instead of re-reading. The trap is that in a small program like this one, both Clang at -O0 and Clang at -O2 do happen to print 1.000000, which is exactly the kind of evidence that convinces people the code is fine. The behavior can change the moment the function is inlined into a larger caller with more scheduling freedom, or on the next compiler release. The conforming spellings are `std::memcpy(&f, &i, sizeof f)` or, since C++20, `std::bit_cast<float>(i)`.",
    references: [
      "https://en.cppreference.com/w/cpp/language/reinterpret_cast",
      "https://en.cppreference.com/w/cpp/numeric/bit_cast",
    ],
  },
  {
    id: "compilers-strict-aliasing-02",
    category: "compilers",
    difficulty: "medium",
    title: "Type punning through memcpy",
    tags: ["strict-aliasing", "memcpy", "type-punning"],
    type: "trace",
    prompt:
      "Contrast this with the reinterpret_cast version of the same bit reinterpretation. What does the compiler make of it at -O2, and does it cost a runtime memory copy?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstring>

float bitsToFloat(int bits) {
    float f;
    std::memcpy(&f, &bits, sizeof(f));
    return f;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Well-defined, and at -O2 it compiles to one register move, the same instruction the reinterpret_cast version emits.",
        "Well-defined, but it costs a real call into the C library at every optimization level; memcpy is opaque to the front end.",
        "Still undefined behavior: memcpy reads the object representation of an int and writes those bytes into a float object.",
        "Compile error: memcpy's source and destination must have the same type for the copy to be well-formed.",
      ],
      correctIndex: 0,
    },
    explanation:
      "`std::memcpy` copies `sizeof(f)` bytes of the object representation, and byte-wise access through `unsigned char` is one of the accesses strict aliasing explicitly exempts. That makes it (along with `std::bit_cast` since C++20) the standard-sanctioned way to reinterpret bits between two same-sized types. The worry about paying for a library call is the usual misconception here: both GCC and Clang recognize a `memcpy` whose size is a small compile-time constant between scalar-sized objects and expand it inline. Compiling this on arm64, Clang at -O2 emits a single `fmov s0, w0`, the same instruction the unsafe `reinterpret_cast` version produces, so you get defined behavior at identical cost.",
    references: ["https://en.cppreference.com/w/cpp/numeric/bit_cast"],
  },
  {
    id: "compilers-as-if-rule-01",
    category: "compilers",
    difficulty: "medium",
    title: "A loop that accumulates squares",
    tags: ["as-if-rule", "dead-code-elimination", "optimizer"],
    type: "trace",
    prompt:
      "Compiled with -O2, what shape does the generated code for sumSquares take?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `long sumSquares(int n) {
    long total = 0;
    for (int i = 0; i < n; ++i) {
        total += static_cast<long>(i) * i;
    }
    return total;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "A tight machine-code loop that squares i and accumulates it n times, with n known only at runtime.",
        "The loop is left intact: replacing it with a formula is a source-level rewrite, which the as-if rule does not cover.",
        "A vectorized loop adding four squares per iteration, which is as far as the as-if rule lets the compiler take this.",
        "No loop at all. GCC and Clang replace it with a short closed-form arithmetic sequence that has no backward branch.",
      ],
      correctIndex: 3,
    },
    explanation:
      "The as-if rule ([intro.abstract]) permits any transformation whatsoever as long as the program's observable behavior (its output, its volatile accesses, its I/O) matches what the abstract machine would have produced. The loop body has no side effects, and the sum has a closed form: the total after n iterations is (n-1)n(2n-1)/6. Scalar-evolution analysis recognizes the induction variable and the polynomial recurrence, and final-value replacement substitutes the closed form for the loop. This is not hypothetical: Clang at -O2 on arm64 compiles sumSquares into a branch-free sequence of about ten arithmetic instructions with no backward branch at all, and GCC does the same class of transformation. Vectorizing the loop would also be legal, but it is not the ceiling; the rule is about preserving the result, not about preserving the loop.",
    references: ["https://en.cppreference.com/w/cpp/language/as_if"],
  },
  {
    id: "compilers-const-fold-01",
    category: "compilers",
    difficulty: "easy",
    title: "Two constexpr calls in one initializer",
    tags: ["constant-folding", "constexpr", "compile-time"],
    type: "trace",
    prompt:
      "What does the generated code for main contain, and at which optimization levels?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdio>

constexpr int square(int x) { return x * x; }

int main() {
    constexpr int a = square(7) + square(3);
    printf("%d\\n", a);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing but the literal 58 handed to printf, and that holds at every optimization level, -O0 included.",
        "A runtime call to square(7), a runtime call to square(3), an addition, and then the call to printf.",
        "The folding happens at -O1 and above; at -O0 both calls to square are emitted and run at runtime.",
        "Undefined behavior: square is constexpr but not consteval, and the two calls in one initializer are unsequenced.",
      ],
      correctIndex: 0,
    },
    explanation:
      "`square` is `constexpr` and both calls take literal arguments, so `square(7) + square(3)` is a valid constant expression. The decisive detail is that `a` itself is declared `constexpr`: [dcl.constexpr] requires a constexpr variable's initializer to be a constant expression, which means the evaluation happens during translation. That is a language guarantee rather than an optimizer courtesy, so it survives -O0. Compiling this with Clang at -O0 and dumping the assembly shows a bare `mov w8, #58` feeding the `printf` call, with no trace of `square`. Contrast this with the sibling question on an ordinary non-constexpr expression, where folding is best-effort and can be blocked outright.",
    references: ["https://en.cppreference.com/w/cpp/language/constexpr"],
  },
  {
    id: "compilers-const-fold-02",
    category: "compilers",
    difficulty: "medium",
    title: "Arithmetic around an opaque function call",
    tags: ["constant-folding", "optimizer", "constexpr"],
    type: "trace",
    prompt:
      "getConfigValue() is defined in a separate translation unit the compiler cannot see (no LTO). What does the compiler do with the expression `getConfigValue() * 2 + 1` in this TU?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int getConfigValue(); // defined in another .cpp, not visible here

int computeLimit() {
    return getConfigValue() * 2 + 1;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It folds to a constant at compile time; *2 + 1 is pure arithmetic the optimizer can always evaluate.",
        "The whole function is deleted as dead code; nothing in this translation unit calls computeLimit.",
        "No folding. The call is emitted, though *2 can still become a shift or lea with the +1 folded in.",
        "Compile error: a call to a function that is not constexpr may not appear inside a returned arithmetic expression.",
      ],
      correctIndex: 2,
    },
    explanation:
      "Constant folding requires every operand to be known during translation. `getConfigValue()` is an ordinary non-constexpr function whose definition is not even visible here, so its return value is entirely opaque and the compiler has to emit a real `call`. What it can still do is clean up the parts it owns: multiplying by 2 is strength-reduced to a left shift, an `lea`, or an add-with-itself, and the `+1` becomes an add against whatever register the call returned in. That distinction is worth holding onto. Constant folding needs compile-time-known operands; strength reduction works fine on runtime values, since it only swaps an expensive operation for a cheaper one that computes the same thing. Note also that `computeLimit` has external linkage, so it cannot be deleted for lack of a caller in this TU.",
  },
  {
    id: "compilers-dce-01",
    category: "compilers",
    difficulty: "medium",
    title: "A diagnostic behind a compile-time flag",
    tags: ["dead-code-elimination", "optimizer", "branch-elimination"],
    type: "trace",
    prompt:
      "expensiveDiagnostic() is declared here but never defined anywhere in the program. Compiled with -O2, what happens to the call and its surrounding branch?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `void expensiveDiagnostic();

int compute(int x) {
    constexpr bool DEBUG = false;
    if (DEBUG) {
        expensiveDiagnostic();
    }
    return x * x;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The branch and the call are both removed, and the program links even with no definition of expensiveDiagnostic.",
        "expensiveDiagnostic() is still called at runtime from a reachable if statement inside the emitted function.",
        "The branch survives but the call is replaced by a nop, keeping compute's code layout stable for the debugger.",
        "Link error: naming expensiveDiagnostic in the body odr-uses it, and no definition exists anywhere in the program.",
      ],
      correctIndex: 0,
    },
    explanation:
      "`DEBUG` is a `constexpr bool` initialized to `false`, so `if (DEBUG)` has a provably false condition. Dead code elimination removes the unreachable basic block, and the call to `expensiveDiagnostic()` goes with it, leaving `compute` as a single multiply. Because no call survives to codegen, no relocation is emitted and the program links with no definition of `expensiveDiagnostic` anywhere. In fact this is not even an -O2 effect: Clang's front end already skips emitting a branch whose condition is a constant, so the -O0 build links cleanly too. The same reasoning is what makes compile-time debug flags free at runtime. `if constexpr` is still stronger, because it discards the untaken branch before instantiation rather than after code generation, which matters when the dead branch would not even compile for the current template arguments.",
  },
  {
    id: "compilers-dce-02",
    category: "compilers",
    difficulty: "hard",
    title: "An out-of-bounds array write and the code after it",
    tags: ["dead-code-elimination", "undefined-behavior", "optimizer"],
    type: "trace",
    prompt:
      "arr has four elements. Compiled with -O2, what happens to the write on the line marked (1) and to everything after it?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdio>

void run(bool trigger) {
    int arr[4] = {1, 2, 3, 4};
    if (trigger) {
        arr[10] = 99;          // (1) out-of-bounds write, UB
        printf("after write\\n"); // (2)
    }
    printf("done\\n");
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'The write quietly corrupts adjacent stack memory, then "after write" and "done" both print as usual.',
        'The write is bounds-checked against the array\'s known extent and discarded, and only "done" prints.',
        "Compile error: arr[10] is a constant subscript outside a declared 4-element array and must be diagnosed.",
        "Anything: the compiler may drop the write, drop the printf at (2), or delete the trigger==true branch entirely.",
      ],
      correctIndex: 3,
    },
    explanation:
      "Subscripting `arr[10]` on a four-element array is undefined behavior per [expr.sub]; plain array subscripting carries no bounds check. Once the optimizer can prove a path necessarily executes UB, [intro.abstract] imposes no requirements on that path at all, so it may be treated as unreachable. The naive model, that the write simply clobbers whatever happens to sit next on the stack, is only one of the possible outcomes. Compilers have been observed deleting the code that follows, sinking or hoisting instructions across the UB point, and folding the enclosing condition to false so the branch disappears wholesale. Note that this is a diagnosable case in practice (Clang emits an -Warray-bounds warning) but a warning is not a required diagnostic, and the program still compiles. The practical consequence is that observing the 'expected' output once proves nothing: the same source can change behavior with a new compiler release, a different flag, or an unrelated edit elsewhere in the function that shifts an inlining decision.",
  },
  {
    id: "compilers-cse-01",
    category: "compilers",
    difficulty: "medium",
    title: "The same product, written twice",
    tags: ["cse", "optimizer", "codegen"],
    type: "trace",
    prompt:
      "Compiled with -O2, how many multiply instructions computing a * b end up in the generated machine code?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int f(int a, int b, int c) {
    int x = a * b + c;
    int y = a * b - c;
    return x * y;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Once. One register holds the product, feeding both the add for x and the sub for y.",
        "Twice: x and y are separate statements initializing separate variables, with one multiply each.",
        "Three times: once for x, once for y, and once more for the multiplication in the return statement.",
        "Zero times: reassociation collapses (a*b+c)*(a*b-c) into a form that no longer contains the product a * b.",
      ],
      correctIndex: 0,
    },
    explanation:
      "Common subexpression elimination finds expressions that compute the same value more than once and rewrites the later occurrences to reuse the first result. `a * b` appears identically in the initializers of `x` and `y`, neither `a` nor `b` is modified in between, and `int` multiplication has no observable side effect, so the two occurrences are provably equivalent and one multiply suffices. Compiling this with Clang at -O2 on arm64 gives exactly `mul w8, w1, w0`, then `add`, then `sub`, then a final `mul` for `x * y`, so `a * b` is computed once and `x * y` once. Reassociating into (a*b)^2 - c^2 is legal for signed `int`, since overflow is UB, but it would not remove the product either. This is a local, provably safe rewrite, unlike the opaque-call case in the sibling CSE question.",
  },
  {
    id: "compilers-cse-02",
    category: "compilers",
    difficulty: "easy",
    title: "The same call, written twice",
    tags: ["cse", "optimizer", "aliasing"],
    type: "trace",
    prompt:
      "getValue() is an ordinary external function: not const, not pure, and its body is not visible here. Compiled with -O2, how many calls to it appear in the generated code for f?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int getValue(); // opaque external function, may have side effects

int f() {
    int x = getValue() + 1;
    int y = getValue() + 1;
    return x + y;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Once: a nullary function returning int is treated as pure by default, and the first result is reused for both x and y.",
        "Zero: x and y feed only into the returned sum, and both calls are eliminated together as dead code.",
        "Twice. Both calls are emitted, at -O2 and at every other optimization level.",
        "Twice at -O2 and once at -O3, where interprocedural analysis switches to assuming external functions are pure.",
      ],
      correctIndex: 2,
    },
    explanation:
      "CSE is legal only when the compiler can prove the two occurrences are referentially transparent: same inputs, same result, no observable side effect in between. An ordinary external call is opaque. Without the definition in hand, the compiler has to assume `getValue()` might return a different value on each call, might write a global, or might perform I/O, and the as-if rule requires each of those effects to happen exactly as written. So both calls survive. Three things can unblock this: an attribute that promises more than the type system does (`[[gnu::const]]` or `[[gnu::pure]]`), LTO exposing the body at link time so the optimizer can derive purity itself, or simply moving the definition into a header. Note that the compiler never assumes purity from a signature alone, at any optimization level.",
  },
  {
    id: "compilers-vectorization-01",
    category: "compilers",
    difficulty: "hard",
    title: "Three float pointers and a loop",
    tags: ["vectorization", "aliasing", "restrict", "simd"],
    type: "trace",
    prompt:
      "Compiled with -O3 and auto-vectorization on, what does the compiler have to do about the possibility that out overlaps a or b?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `void addArrays(float* a, float* b, float* out, int n) {
    for (int i = 0; i < n; ++i) {
        out[i] = a[i] + b[i];
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing. Elementwise float arithmetic reads and writes one lane at a time, and overlap cannot change the result.",
        "It either skips vectorization or versions the loop behind a runtime overlap check with a scalar fallback.",
        "It vectorizes unconditionally: -O3 turns off alias analysis in favor of assuming distinct pointer arguments.",
        "It never vectorizes: only restrict-qualified pointers make a loop containing a store a legal vectorization candidate.",
      ],
      correctIndex: 1,
    },
    explanation:
      "Vectorizing means executing several iterations of `out[i] = a[i] + b[i]` together in SIMD lanes, which reorders the individual scalar loads and stores relative to strict program order. That is only safe if `out` does not overlap `a` or `b` in a way that would let a load in one iteration observe a store from a different iteration. With three plain pointers the compiler has no static guarantee of distinctness, since a caller may legally pass `out == a + 1`. The usual resolution is a versioned loop: the compiler emits a runtime comparison of the pointer ranges and branches to a vectorized body when they provably do not overlap, falling back to a scalar body when they might. Compiling this with Clang at -O3 on arm64 bears that out: the loop reports as vectorized with width 4 and interleave 4, guarded by pointer-range tests. Annotating the parameters `float* __restrict` moves the promise from the compiler's runtime check to the programmer, letting it vectorize without the guard.",
    references: ["https://en.cppreference.com/w/c/language/restrict"],
  },
  {
    id: "compilers-vectorization-02",
    category: "compilers",
    difficulty: "medium",
    title: "A loop with a runtime trip count",
    tags: ["vectorization", "loop-unrolling", "simd"],
    type: "trace",
    prompt:
      "n is a runtime parameter, unknown at compile time. Does that alone stop the compiler from vectorizing this loop at -O3?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `void scale(float* __restrict a, float factor, int n) {
    for (int i = 0; i < n; ++i) {
        a[i] *= factor;
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No, but only thanks to __restrict; without it, a loop that stores through a pointer is never vectorized.",
        "Yes: SIMD requires a compile-time-constant trip count to know how many lanes each iteration will fill.",
        "Yes, unless n is provably a multiple of the target's vector width, which the compiler cannot establish from a parameter.",
        "No. The main body is vectorized in fixed-width chunks and a scalar remainder loop mops up the leftover elements.",
      ],
      correctIndex: 3,
    },
    explanation:
      "A runtime trip count does not block vectorization; a compile-time-constant count enables full unrolling, which is a different optimization entirely. The compiler emits a main loop that handles one vector's worth of elements per iteration (four floats with NEON, eight with AVX) for floor(n / width) iterations, followed by a scalar epilogue for the remaining n % width elements. On ISAs with predication (AVX-512, SVE) the epilogue can instead be a single masked vector iteration. All of that is generated once at compile time and dispatches correctly for whatever n turns out to be. Clang at -O3 reports this loop as vectorized with width 4 and interleave 4. The `__restrict` here is doing very little work: with a single pointer parameter there is no second array to overlap with, so the loop would vectorize without it. Its real value shows up in the sibling question, where three pointers create a genuine overlap hazard.",
  },
  {
    id: "compilers-inlining-01",
    category: "compilers",
    difficulty: "easy",
    title: "A thousand-iteration body marked inline",
    tags: ["inlining", "odr", "linkage"],
    type: "trace",
    prompt:
      "This header is included by several .cpp files. What does marking the function inline guarantee?",
    snippet: {
      language: "cpp",
      filename: "util.h",
      code: `inline int addOne(int x) {
    // large body, unlikely to be actually inlined by the compiler's heuristics
    for (int i = 0; i < 1000; ++i) { x = x + 1 - 1; }
    return x + 1;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing about inlining. It lets the identical definition appear in many translation units without an ODR violation.",
        "That the compiler substitutes the body at every call site rather than emitting a call instruction.",
        "That the body is pasted in during preprocessing, the way a function-like macro would be expanded.",
        "Nothing at all in modern C++; the keyword is a C compatibility artifact the front end discards.",
      ],
      correctIndex: 0,
    },
    explanation:
      "The keyword is a historical misnomer. Per [dcl.inline] its normative effect is on linkage: a function marked `inline` may have its definition appear, identically, in more than one translation unit without violating the One Definition Rule, which is precisely what a header-defined function needs. Whether the body actually gets substituted at a call site is a separate heuristic decision the inliner makes from estimated cost (code growth, register pressure) against estimated benefit (call overhead removed, further optimization unlocked). A function marked `inline` frequently is not inlined, as here, where a 1000-iteration loop puts the body well over any default size threshold. The converse holds too: a function not marked `inline` but defined in the same TU, or reachable through LTO, gets inlined whenever the compiler judges it worthwhile. If you need to force the decision you reach for `[[gnu::always_inline]]` or `[[gnu::noinline]]`, which are compiler extensions rather than standard C++.",
  },
  {
    id: "compilers-regalloc-01",
    category: "compilers",
    difficulty: "hard",
    title: "Twelve live values on an eight-register target",
    tags: ["register-allocation", "graph-coloring", "spilling"],
    type: "trace",
    prompt:
      "Suppose the target has 8 allocatable general-purpose integer registers. All 12 parameters are live at the marked point and every one of them is used again afterward. What does the register allocator do?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `long compute(long a, long b, long c, long d, long e, long f,
             long g, long h, long i, long j, long k, long l) {
    long sum = a + b + c + d + e + f + g + h + i + j + k + l;
    // all 12 parameters plus 'sum' are simultaneously live here
    return sum * (a - l) + b * (c - k) + d * (e - j) + f * (g - h) + i;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: the function has more simultaneously-live values than the target has allocatable registers.",
        "It widens the pool by parking the surplus scalar values in otherwise unused SIMD registers for the duration.",
        "It spills some live ranges to stack slots, with stores after their definitions and reloads before their uses.",
        "It rematerializes each surplus value at every use, recomputing it from its operands rather than touching memory at all.",
      ],
      correctIndex: 2,
    },
    explanation:
      "Graph-coloring allocation (the Chaitin-Briggs family, used in various forms by GCC and LLVM) builds an interference graph with a node per live range and an edge between any two ranges that are live at the same time, then tries to color it with k colors where k is the number of physical registers. Here the 12 parameter live ranges all interfere at the `sum` computation and beyond, forming a clique larger than 8, so no 8-coloring exists. The resolution is spilling: the allocator picks victims using a spill-cost heuristic that weighs how often a range is accessed against how much it constrains the graph, stores those values to stack slots after their definitions, and reloads them before each use. Removing them shrinks the interference graph until the remainder is colorable. Rematerialization is a real technique the allocator also uses, but it only applies to values cheap to recompute (a constant, an address) rather than arbitrary incoming parameters. Spilling is ordinary behavior under pressure, not a failure mode; it just means the generated code carries more memory traffic than a function with fewer overlapping live ranges.",
  },
  {
    id: "compilers-tco-01",
    category: "compilers",
    difficulty: "medium",
    title: "Deep recursion with an accumulator parameter",
    tags: ["tail-call-optimization", "recursion", "stack"],
    type: "trace",
    prompt: "Compiled with -O2, what happens when you call sumTo(1000000, 0)?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `long sumTo(long n, long acc) {
    if (n == 0) return acc;
    return sumTo(n - 1, acc + n);  // recursive call is the entire return expression
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Stack overflow: one million recursive calls each push a frame that is only popped on the way back out.",
        "No overflow. The frame is reused on each call, and the recursion runs in O(1) stack like a loop.",
        "No overflow: past a depth threshold, GCC and Clang move deep recursion onto a heap-allocated frame chain.",
        "Stack overflow anyway: the standard offers no tail-call guarantee, and no C++ compiler performs the transformation.",
      ],
      correctIndex: 1,
    },
    explanation:
      "`return sumTo(n - 1, acc + n);` is a tail call: the result of the recursive call is returned immediately with no pending work afterward. That shape lets the compiler overwrite the current frame's arguments in place and jump back to the top of the function instead of pushing a new frame, which is equivalent to rewriting the whole thing as a loop, so stack usage stays O(1) no matter how large n is. GCC and Clang both do this at -O2. It is quality of implementation rather than a language guarantee (C++ has nothing like Scheme's mandated proper tail calls), and it generally requires optimization to be on, so the same source can still overflow at -O0. Clang actually goes further here: after eliminating the recursion it recognizes the resulting loop's closed form and compiles sumTo into a dozen branch-free arithmetic instructions. Compare the sibling question, where the accumulator is removed and the call is no longer in tail position.",
    references: ["https://en.wikipedia.org/wiki/Tail_call"],
  },
  {
    id: "compilers-tco-02",
    category: "compilers",
    difficulty: "hard",
    title: "The same recursive sum without the accumulator",
    tags: ["tail-call-optimization", "recursion", "stack-overflow"],
    type: "trace",
    prompt:
      "The recursive call here is not in tail position: the addition of n happens after it returns. Built at -O0, calling sumTo(1000000) segfaults. Built at -O2 with GCC or Clang, it returns 500000500000 promptly. What accounts for the difference?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `long sumTo(long n) {
    if (n == 0) return 0;
    return n + sumTo(n - 1);  // addition happens AFTER the recursive call returns
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "At -O2 the compiler records a larger stack size in the binary's headers, enough for a million frames.",
        "The frames still exist at -O2 but are far smaller, and a million of them fit inside the default thread stack.",
        "At -O2, GCC and Clang turn every self-recursive function into a loop, whatever the shape of the recursion.",
        "The tail-recursion pass introduces an accumulator itself, turning the call into a tail call and then a loop.",
      ],
      correctIndex: 3,
    },
    explanation:
      "As written, `return n + sumTo(n - 1);` is genuinely not a tail call: the caller's frame has to stay alive to apply the pending `n +` once the callee returns. That is why -O0 recurses a million frames deep and segfaults on a typical 1MB to 8MB thread stack. What rescues the -O2 build is a stronger transformation than plain TCO, usually called accumulator recursion elimination, implemented in LLVM's TailRecursionElimination pass and in GCC's tree-tailcall. When the only pending operation is an associative one (addition or multiplication over integers), the pass can synthesize the accumulator the programmer did not write, rewriting the body into the tail-recursive shape and then into a loop. Clang at -O2 does exactly this here and then goes one further, applying final-value replacement so sumTo becomes a branch-free closed-form expression. The lesson is not that non-tail recursion is safe; the rewrite is limited to recognizable associative accumulations and evaporates the moment the pending work is something the pass cannot reassociate, such as a call to another function or a floating-point add without -ffast-math.",
  },
  {
    id: "compilers-lto-01",
    category: "compilers",
    difficulty: "medium",
    title: "A function defined in another translation unit",
    tags: ["lto", "linkage", "inlining"],
    type: "trace",
    prompt:
      "square is a non-inline function defined in math.cpp and declared in math.h; caller.cpp calls it in a hot loop. Compare an ordinary build (each .cpp compiled separately, then linked) with a -flto build. Can square be inlined into that loop?",
    snippet: {
      language: "cpp",
      filename: "math.cpp",
      code: `// math.h: int square(int x);
int square(int x) { return x * x; }`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Only with LTO. The ordinary build has to emit a call; the -flto build can inline square straight into the loop.",
        "There is no difference: the compiler resolves declarations against definitions in other objects during ordinary compilation.",
        "It is inlined either way: square is trivially small, and LTO only widens inlining for large function bodies.",
        "LTO changes only symbol resolution and debug info layout, and the call instruction survives in both builds.",
      ],
      correctIndex: 0,
    },
    explanation:
      "Non-LTO compilation handles each translation unit essentially in isolation. When `caller.cpp` is compiled, all the front end has is `int square(int x);` from the header, and `square`'s body lives in a separate object file that will not exist until later, so a real `call` instruction is the only option no matter how trivial the callee is. Link-time optimization defers code generation instead: each TU is compiled to an intermediate representation (LLVM bitcode, or GCC's GIMPLE) rather than machine code, and the link step re-invokes the optimizer with every TU's IR present at once. That is what makes cross-TU inlining possible, along with whole-program devirtualization and interprocedural constant propagation, none of which any amount of per-TU -O3 can reach. The cost is build time and memory at the link step, which is why ThinLTO exists as a partitioned, parallelizable variant.",
  },
  {
    id: "compilers-lto-02",
    category: "compilers",
    difficulty: "medium",
    title: "The same function defined in the header",
    tags: ["lto", "inlining", "headers"],
    type: "trace",
    prompt:
      "Here square's definition, not just its declaration, lives directly in math.h. Without LTO, can the compilation of caller.cpp inline it?",
    snippet: {
      language: "cpp",
      filename: "math.h",
      code: `inline int square(int x) { return x * x; }`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No: inlining across any file boundary requires LTO, wherever the definition physically lives.",
        "Only if math.cpp is also compiled at -O2; the inliner needs matching optimization levels on both sides.",
        "Yes. The ordinary per-TU inliner can act on it while compiling caller.cpp, with no LTO involved.",
        "Link error: a function defined in a header included by several .cpp files ends up with multiple definitions.",
      ],
      correctIndex: 2,
    },
    explanation:
      "What matters is where the definition is visible, not whether the function carries the `inline` keyword. Because `square`'s body is written directly in `math.h`, the preprocessor pastes it into `caller.cpp` before the front end ever runs, so that translation unit genuinely contains the complete definition and the ordinary per-TU inliner can act on it. No cross-TU visibility and no LTO are involved. The `inline` keyword is still load-bearing, just for a different reason: without it, the identical definition landing in every TU that includes the header would be a multiple-definition error at link time. That is the ODR exemption covered in the inline-keyword question. This pairing is why small hot functions are conventionally defined in headers, or as in-class member functions, which are implicitly `inline`: it puts the inlining opportunity in front of every caller without anyone having to enable LTO.",
  },
  {
    id: "compilers-name-mangling-01",
    category: "compilers",
    difficulty: "medium",
    title: "Calling a C library from C++",
    tags: ["name-mangling", "linkage", "extern-c"],
    type: "trace",
    prompt:
      'This C++ file declares `void process(int x);` and links against a C library object file that exports a symbol literally named `process`. With no extern "C" on the declaration, does the link succeed?',
    snippet: {
      language: "cpp",
      filename: "caller.cpp",
      code: `void process(int x); // C++ declaration, no extern "C"

int main() {
    process(42);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: both compilers write the plain source name into the symbol table, and the linker pairs them up directly.",
        "No. The link fails with an undefined reference to a mangled symbol such as _Z7processi.",
        "Yes. Modern linkers demangle C++ references before matching them against undecorated symbols.",
        "No, and the failure is at compile time: caller.cpp may not declare a function whose definition comes from a C object.",
      ],
      correctIndex: 1,
    },
    explanation:
      'C has no overloading, so a C compiler emits the symbol table entry under the plain source name `process`. C++ has overloading, namespaces, and templates, so the compiler must encode enough to distinguish `process(int)` from `process(double)` and from `ns::process(int)`. That encoding is name mangling, and under the Itanium C++ ABI a global `process(int)` becomes `_Z7processi`. The C++ TU therefore emits a relocation against `_Z7processi`, the C object exports `process`, and nothing resolves, so the link fails with an undefined reference or unresolved external symbol. Nothing here is diagnosable at compile time, since the declaration is perfectly well-formed. Wrapping the declaration in `extern "C"` gives it C language linkage: no mangling, and no overloading permitted on that name, so the emitted reference is the plain `process` and the link succeeds. This is why C headers meant for C++ consumers guard their contents with an `extern "C"` block under `#ifdef __cplusplus`.',
    references: ["https://en.cppreference.com/w/cpp/language/language_linkage"],
  },
  {
    id: "compilers-odr-01",
    category: "compilers",
    difficulty: "medium",
    title: "The same static helper name in two translation units",
    tags: ["odr", "linkage", "static"],
    type: "trace",
    prompt:
      "Two translation units each define a function named helper with a different body, both marked static. Does linking a.o and b.o (plus a main() elsewhere) succeed?",
    snippet: {
      language: "cpp",
      filename: "a.cpp",
      code: `// a.cpp
static int helper(int x) { return x + 1; }
int callFromA(int x) { return helper(x); }

// b.cpp
static int helper(int x) { return x * 2; }
int callFromB(int x) { return helper(x); }`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Link error: helper is defined twice across a.o and b.o, with two conflicting bodies under one name.",
        "Compile error when b.cpp is built: helper already has an internal-linkage definition in a.cpp.",
        "Links, but both callers end up in one merged helper, and callFromA and callFromB return the same value.",
        "Links fine. callFromA uses the x + 1 helper and callFromB uses the x * 2 helper, each from its own file.",
      ],
      correctIndex: 3,
    },
    explanation:
      "`static` at namespace scope gives a function or variable internal linkage ([basic.link]). The name is never exposed to the linker's global symbol table, so each translation unit ends up with its own private, unrelated entity. `a.cpp`'s `helper` and `b.cpp`'s `helper` are not even candidates for the same symbol, so there is no multiple-definition error to raise. The One Definition Rule is satisfied too, since each TU contains exactly one definition of its own `helper`. `callFromA` calls the `x + 1` version and `callFromB` calls the `x * 2` version, each correctly. Two things worth separating here: internal linkage is what avoids the collision, and the identical spelling of the names is coincidental to the linker. An anonymous namespace achieves the same effect and is the more idiomatic modern spelling, since it also works for types, which `static` does not.",
    references: ["https://en.cppreference.com/w/cpp/language/storage_duration"],
  },
  {
    id: "compilers-odr-02",
    category: "compilers",
    difficulty: "hard",
    title: "Two translation units built against different copies of a header",
    tags: ["odr", "ifndr", "linkage", "undefined-behavior"],
    type: "trace",
    prompt:
      "Two translation units each define the same external-linkage inline function with genuinely different bodies, then link into one program. What is the standard's verdict, and what do real toolchains do?",
    snippet: {
      language: "cpp",
      filename: "shared.h",
      code: `// included identically by both a.cpp and b.cpp... except a.cpp
// was actually built against an older, hand-patched copy of this header:

// a.cpp's copy of shared.h:
inline int scale(int x) { return x * 2; }

// b.cpp's copy of shared.h:
inline int scale(int x) { return x * 3; }`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The compiler must diagnose it at compile time: the two definitions differ in a plainly visible way.",
        "Ill-formed, no diagnostic required. It builds cleanly, and which body a given call runs depends on the linker and optimizer.",
        "The linker rejects it with a multiple-definition error, exactly as it would for two non-inline functions of the same name.",
        "Well-defined: each TU keeps and calls its own copy, the way two same-named static functions would coexist.",
      ],
      correctIndex: 1,
    },
    explanation:
      "The ODR requires an `inline` function to have the same definition, token for token, in every translation unit that defines it. That requirement exists precisely because the ODR's exemption for inline entities lets the toolchain keep any one of the supposedly identical definitions and discard the rest. Here `a.cpp` and `b.cpp` genuinely disagree, which is a real violation, but [basic.def.odr] classifies it as ill-formed, no diagnostic required. Detecting it would mean comparing function bodies across separately compiled TUs, which an ordinary non-LTO pipeline never does. So both objects compile silently, and the linker follows the usual weak/COMDAT merging rules for inline functions and templates: one out-of-line definition survives, chosen by link order and the linker's own tie-breaking, and every real call instruction reaches it. Calls the optimizer has already inlined keep whichever body their own TU saw. With a `main` in `b.cpp` that prints `fa(1)` (a function in `a.cpp` that returns `scale(1)`) next to its own `scale(1)`, Clang and GCC at -O0 print `2 2`, because both calls reach the surviving copy, and at -O2 print `2 3`, because each TU inlined its own body. The upshot is that `a.cpp`'s callers can silently get `b.cpp`'s multiplier, or not, depending on link order and optimization level, with no warning anywhere, which is the classic stale-header bug in large multi-library builds. LTO and the gold linker's `--detect-odr-violations` can sometimes surface it, and building with `-flto` makes the mismatch visible to the optimizer, but neither is required by the standard.",
    references: ["https://en.cppreference.com/w/cpp/language/definition"],
  },
  {
    id: "compilers-devirt-01",
    category: "compilers",
    difficulty: "medium",
    title: "A virtual call on a local object",
    tags: ["devirtualization", "virtual-functions", "optimizer"],
    type: "trace",
    prompt:
      "Compiled with -O2, does the call obj.speak() go through the vtable at runtime?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Animal {
    virtual void speak() const { }
};

struct Dog : Animal {
    void speak() const override { /* barks */ }
};

void run() {
    Dog obj;      // concrete local object, not a pointer or reference
    obj.speak();  // (1)
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes. Every call to a virtual function loads the vtable pointer and dispatches indirectly; that is what virtual means.",
        "Yes, unless Dog::speak is also declared final, which is the only annotation that permits skipping a vtable load.",
        "No. The compiler emits a direct call to Dog::speak, and usually inlines it, with no vtable load at all.",
        "No, but only in builds where Dog's vtable is emitted in this same translation unit.",
      ],
      correctIndex: 2,
    },
    explanation:
      "Virtual dispatch exists to resolve which override runs when the static type at the call site may not match the dynamic type, as when calling through an `Animal*` that might really point at a `Dog` or a `Cat`. None of that uncertainty exists here. `obj` is a local variable declared as a `Dog`, so its dynamic type is exactly `Dog`: there is no indirection, no other class it could be, and no way for anything to have swapped its vptr, since it was never handed to code that saw it as a base. With the dynamic type pinned down, devirtualization replaces the vtable load and indirect call with a direct call to `Dog::speak`, which is both cheaper and now a candidate for inlining. Clang at -O2 on this exact code emits `bl __ZNK3Dog5speakEv`, a direct branch-with-link. The transformation is legal under the as-if rule because the observable result is identical, and it does not depend on where the vtable is emitted. The sibling question covers the harder case, where the object is reached through a pointer.",
  },
  {
    id: "compilers-devirt-02",
    category: "compilers",
    difficulty: "hard",
    title: "A virtual call through a pointer",
    tags: ["devirtualization", "final", "virtual-functions"],
    type: "trace",
    prompt:
      "Unlike the sibling question, there is no concrete local object here: speak() is called through a pointer, whose pointee the compiler has never seen. At -O2, is the call dispatched through the vtable?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Animal {
    virtual void speak() const { }
};

struct Dog final : Animal {
    void speak() const override { /* barks */ }
};

void call(Dog* d) {
    d->speak();   // (1) called through a pointer the compiler cannot trace
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes. The pointee is not visible here, and the compiler must assume it could be any class derived from Dog.",
        "Yes, unless Animal::speak is also marked final; that is the annotation that actually closes the override set.",
        "No, but only under LTO, where whole-program analysis can enumerate the classes that derive from Dog.",
        "No. The call is bound statically to Dog::speak and compiled with no vtable load at all.",
      ],
      correctIndex: 3,
    },
    explanation:
      "Devirtualization needs the compiler to pin down which override will run, and there are two ways to get there. The sibling question takes the first: prove the dynamic type outright by looking at a concrete local object. This question takes the second: leave the dynamic type unknown but close the set of candidates. The static type of `d` is `Dog*`, so the dynamic type is `Dog` or something derived from it, and `final` on `Dog` is a language-level guarantee that nothing derives from it. That leaves `Dog::speak` as the only reachable override, so a direct call is provably correct without knowing anything about the object itself. Clang at -O2 bears this out. With `speak` merely declared, `call` compiles to a single tail branch `b __ZNK3Dog5speakEv`; with the empty body visible, it collapses to a bare `ret`. Either way there is no vtable load. This is why marking leaf classes or individual overrides `final` is a real micro-optimization in polymorphic hot paths. Note that the same reasoning gets fragile the moment the pointer is laundered through a base-class pointer: Clang at -O2 stops devirtualizing if you first assign to an `Animal*` and call through that, because the front end's devirtualization keys off the static type of the object expression.",
    references: ["https://en.cppreference.com/w/cpp/language/final"],
  },
  {
    id: "compilers-escape-analysis-01",
    category: "compilers",
    difficulty: "hard",
    title: "A new[] that never leaves the function",
    tags: ["allocation-elision", "heap-allocation", "optimizer"],
    type: "trace",
    prompt:
      "point never escapes makePoint: it is not returned, not stored anywhere, not passed on, and the matching delete[] runs before the return. Compiled with -O2, do the allocation and deallocation calls survive into the generated code?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdio>

int makePoint(int x, int y) {
    int* point = new int[2]{x, y};
    int sum = point[0] + point[1];
    delete[] point;
    return sum;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes. operator new[] and operator delete[] are replaceable, their calls are observable, and the as-if rule protects them.",
        "No. The standard permits eliding the new/delete pair, and Clang at -O2 compiles makePoint down to a single add.",
        "Yes, unless the build uses -flto, which is what exposes the matched new/delete pair to the allocation-elision pass.",
        "No, but the standard does not sanction it; GCC and Clang knowingly depart from the abstract machine here.",
      ],
      correctIndex: 1,
    },
    explanation:
      "This one trips people who reason purely from the as-if rule. A call to a replaceable global allocation function is observable in general, because the program may have replaced `operator new` with something that prints or counts. So the as-if rule alone would forbid removing it. The standard therefore grants an explicit carve-out: [expr.new] says an implementation is allowed to omit a call to a replaceable global allocation function, so long as the storage is instead provided by extending another allocation or is simply unnecessary, which lets the optimizer delete a matched non-escaping new/delete pair outright. Clang implements this and compiles makePoint at -O2 on arm64 down to `add w0, w1, w0; ret`, with no call to `operator new[]` or `operator delete[]` anywhere. GCC does the same class of transformation. The carve-out is a permission, not a requirement, so it is still not something to lean on when you actually need stack storage: write `std::array<int, 2>` or a plain local array and the question does not arise. Also worth separating from the JIT world, where escape analysis in the JVM or V8 promotes non-escaping objects to stack or scalar slots as a profile-driven optimization backed by deoptimization; the C++ version is a static, standard-blessed elision rather than a speculative one.",
    references: ["https://en.cppreference.com/w/cpp/language/new"],
  },
  {
    id: "compilers-pgo-01",
    category: "compilers",
    difficulty: "medium",
    title: "A branch that's almost always taken",
    tags: ["pgo", "inlining", "profiling"],
    type: "trace",
    prompt:
      "fastPath and slowPath are both moderately large, and in the real production workload the condition is true about 99.9% of the time, which nothing in the source reveals. Compare a plain -O2 build with a PGO build (profile collected from representative traffic, then fed back into a second compilation). What changes?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int fastPath(int x);  // large-ish function bodies, cost borderline for inlining
int slowPath(int x);

int dispatch(int x, bool condition) {
    if (condition) {
        return fastPath(x);
    } else {
        return slowPath(x);
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing changes here: PGO steers vectorization and loop unrolling, and leaves the inliner's cost model alone.",
        "PGO lifts the inliner's cost cap entirely, and every call site in dispatch gets inlined no matter how large the callee.",
        "PGO reorders the if/else to make the hot arm fall through, but inlining stays driven purely by static size heuristics.",
        "With the profile, the inliner spends its budget on fastPath and leaves slowPath as an out-of-line cold call.",
      ],
      correctIndex: 3,
    },
    explanation:
      "With no profile, the inliner has to guess. It assigns a default static probability to each arm (roughly even for a plain if/else with no hints) and evaluates each call site on statically derivable information: callee size, and call frequency inferred from control-flow shape, such as assuming loop bodies run often. For two borderline-cost callees in an if/else, that guess can easily land on inlining neither, or on the arm the real workload rarely takes. Profile-guided optimization replaces the guess with measurement. An instrumented or sampled build runs against representative traffic, branch counters are recorded, and a second compilation consumes them. Seeing `condition` true 99.9% of the time, the inliner can spend its budget on `fastPath`, where the saved call overhead applies to nearly every execution, and decline to inline `slowPath`. Cold code typically also gets physically separated into a `.text.unlikely` style section, so the hot path's instructions pack more densely in the instruction cache. Branch layout does improve too, but that is a side benefit rather than the whole story: the inlining budget is where PGO usually pays for itself.",
    references: [
      "https://clang.llvm.org/docs/UsersManual.html#profile-guided-optimization",
    ],
  },
  {
    id: "compilers-o2-vs-o3-01",
    category: "compilers",
    difficulty: "medium",
    title: "-O2 versus -O3 on a hot path",
    tags: ["optimization-levels", "vectorization", "code-bloat"],
    type: "trace",
    prompt:
      "Which statement about the relationship between GCC/Clang's -O2 and -O3 is accurate for the workload described here?",
    snippet: {
      language: "text",
      filename: "notes.txt",
      code: `gcc -O2 hot_path.cpp -o hot_path_o2
gcc -O3 hot_path.cpp -o hot_path_o3
# hot_path.cpp contains many small, frequently-called functions and several
# loops with data-dependent trip counts, embedded in a large codebase
# that must fit comfortably in L1i cache for its hot path to run fast.`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "-O3 is a strict superset of -O2 and is guaranteed to produce code at least as fast, for any program on any hardware.",
        "-O3's larger unrolled, inlined, and vectorized code can cost more in icache misses here than it saves.",
        "-O3 differs from -O2 only in debug information and symbol retention, leaving runtime performance unchanged.",
        "-O3 and -O2 have been identical from GCC 4.x onward; the flag survives only for build-script compatibility.",
      ],
      correctIndex: 1,
    },
    explanation:
      "-O3 layers extra passes on top of -O2: more aggressive auto-vectorization of loops -O2 judges too costly, higher inlining thresholds, and more loop unrolling. All of that targets throughput-bound numerical code, where trading larger code for fewer dynamic instructions is clearly worth it. None of it is free. Unrolled and vectorized bodies are larger, and a raised inlining threshold expands more call sites in place, so static code size grows. In a program made of many small hot functions spread across a large codebase, the hot instruction working set can stop fitting comfortably in L1i or within iTLB reach, and the resulting misses can swamp the per-iteration gains. The relationship between the two levels is therefore not an ordering. Benchmark per workload rather than assuming, which is why plenty of latency-sensitive, branch-heavy server code ships at -O2 while scientific and kernel-heavy code ships at -O3. -Os and -Oz push further in the other direction, trading arithmetic for size, and occasionally beat both on icache-bound code.",
  },
  {
    id: "compilers-behavior-classification-01",
    category: "compilers",
    difficulty: "hard",
    title: "Classifying four behaviors in the standard's terms",
    tags: [
      "undefined-behavior",
      "unspecified-behavior",
      "implementation-defined",
    ],
    type: "trace",
    prompt:
      "Classify all four of these, drawn from the program below, in the C++17 standard's own terminology.\n\n(1) sizeof(int) being 4 on this platform\n(2) the order in which f(a(), b()) evaluates a() and b() relative to each other\n(3) signed integer overflow in `INT_MAX + 1`\n(4) the value produced by right-shifting a negative signed integer, e.g. `-8 >> 1`, prior to C++20",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <climits>

int a();
int b();
void f(int, int);

void demo() {
    int sz = sizeof(int);            // (1)
    f(a(), b());                     // (2)
    int overflow = INT_MAX + 1;      // (3)
    int shifted = -8 >> 1;           // (4), pre-C++20
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "(1) implementation-defined, (2) unspecified, (3) undefined, (4) implementation-defined",
        "(1) implementation-defined, (2) unspecified, (3) undefined, (4) undefined",
        "(1) implementation-defined, (2) undefined, (3) undefined, (4) unspecified",
        "(1) unspecified, (2) unspecified, (3) undefined, (4) unspecified",
      ],
      correctIndex: 0,
    },
    explanation:
      "The three categories are precisely defined and the differences matter. Implementation-defined behavior varies between implementations, but each one must pick a consistent answer and document it. `sizeof(int)` qualifies: the standard fixes only minimum ranges and the ordering `sizeof(short) <= sizeof(int) <= sizeof(long)`, yet a given compiler and ABI always report the same value, 4 on essentially every mainstream platform. That is (1). Right-shifting a negative signed integer was also implementation-defined before C++20; the standard permitted either an arithmetic or a logical shift and required the implementation to document which. That is (4), and C++20 later mandated the sign-extending arithmetic shift, which is why the question pins the version. Unspecified behavior means the standard allows a set of outcomes and requires no documentation of which one is chosen, and the choice may differ between call sites or even between calls. The relative order of `a()` and `b()` in `f(a(), b())` is unspecified in C++17: each argument's evaluation is indeterminately sequenced with respect to the other, so they cannot interleave, but which runs first is not pinned down. That is (2). Undefined behavior means no requirements at all, which is what licenses the optimizer to assume it never happens; `INT_MAX + 1` overflows a signed type and is UB per [expr.pre], unlike unsigned overflow, which is defined modular wraparound. That is (3).",
    references: [
      "https://en.cppreference.com/w/cpp/language/ub",
      "https://en.cppreference.com/w/cpp/language/eval_order",
    ],
  },
  {
    id: "compilers-alias-optimization-01",
    category: "compilers",
    difficulty: "hard",
    title: "The same function with and without restrict",
    tags: ["restrict", "aliasing", "optimizer", "load-elimination"],
    type: "trace",
    prompt:
      "These two C functions differ only in whether the parameters are restrict-qualified. Compiled with -O2, does the second statement have to re-read *in from memory in each?",
    snippet: {
      language: "cpp",
      filename: "alias.c",
      code: `// (A) no restrict
void bump(int* in, int* out) {
    *out = *in + 1;
    *out = *in + 2;   // does the compiler need to reload *in here?
}

// (B) restrict
void bumpR(int* restrict in, int* restrict out) {
    *out = *in + 1;
    *out = *in + 2;   // does the compiler need to reload *in here?
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both reload: restrict only feeds the vectorizer's runtime overlap checks and never affects scalar load elimination.",
        "(A) must reload *in. (B) may reuse the first load, and the first store, now dead, disappears as well.",
        "Neither reloads. The two statements sit in one function, and *out and *in are syntactically distinct lvalue expressions.",
        "Both reload, and (B) additionally traps under UBSan if a caller ever passes overlapping pointers to a restrict parameter.",
      ],
      correctIndex: 1,
    },
    explanation:
      "This is the same aliasing uncertainty as the vectorization and CSE questions, applied to load and store elimination instead of SIMD widening. In (A) the compiler must allow for a caller passing `in == out`. Under that possibility the first store overwrites the very object `*in` names, so the second statement's load cannot reuse the first load's value and a real reload instruction is emitted. In (B) `restrict` is the caller's promise that neither pointer will be used to reach the object the other designates for the duration of the call. Breaking the promise is undefined behavior on the caller's side, but given it, the store through `out` provably cannot disturb `*in`, so the value stays in a register. Clang compiling this as C at -O2 turns `bumpR` into a single load, a single add of 2, and a single store: not only is the redundant load gone, so is the first store, now provably dead. Two practical caveats. `restrict` is a C keyword with no standard C++ equivalent, and the `__restrict` extension C++ compilers offer is honored inconsistently: Apple Clang 17, for one, emits no `noalias` for `__restrict` parameters in C++ mode and compiles both halves of this pair identically. And no sanitizer checks the promise, so a caller that breaks it gets a silent miscompile rather than a diagnostic.",
    references: ["https://en.cppreference.com/w/c/language/restrict"],
  },
  {
    id: "compilers-licm-01",
    category: "compilers",
    difficulty: "easy",
    title: "A loop bound computed by an external function",
    tags: ["loop-invariant-code-motion", "optimizer", "function-attributes"],
    type: "trace",
    prompt:
      "limit() is defined in another translation unit, and in this program it happens to return the same value every time. Compiled with -O2 and no LTO, how many times does fill call limit()?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int limit();   // defined in another translation unit

void fill(int* a) {
    for (int i = 0; i < limit(); ++i) {
        a[i] = 0;
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Once. limit() takes no arguments and nothing in the loop feeds it, so LICM hoists the call out of the condition.",
        "Once at -O2 but once per iteration at -O0, since hoisting invariant calls is a standard part of the -O2 pipeline.",
        "Once per iteration plus the final check, since the compiler cannot prove limit() is side-effect free or invariant.",
        "Once, because strict aliasing guarantees the int store a[i] = 0 cannot touch anything that limit() might read.",
      ],
      correctIndex: 2,
    },
    explanation:
      "Loop-invariant code motion may only hoist a computation if it can prove two things: the value is the same on every iteration, and evaluating it once instead of n+1 times changes no observable behavior. A call to a function whose body the compiler cannot see fails both tests. `limit()` might print, bump a counter, read a global that the loop's stores change, or simply return something different each time, and under the as-if rule the compiler must preserve every one of those possibilities. Taking no arguments says nothing about purity, and that it happens to return a constant in this program is a fact the compiler has no access to. Clang at -O2 on arm64 emits the call to `limit()` inside the loop body, once per iteration. The strict-aliasing answer fails on its own terms: `a[i]` is an `int` store, and `limit()` could well read an `int` global that `a` points into. Function attributes change the picture. `__attribute__((pure))` (may read memory, must not write it) is still not enough here, because the loop's stores through `a` could change memory that `limit()` reads, and Clang keeps the per-iteration call. `__attribute__((const))` (reads no memory at all) is enough: Clang then calls `limit()` once and replaces the whole loop with a single `bzero` call. GCC 16 keeps the per-iteration call even then, since the attribute permits the hoist without requiring it. C23 standardizes similar promises as `[[unsequenced]]` and `[[reproducible]]`. All of these are promises from the programmer, and breaking one is undefined behavior. The portable fix is simply to hoist by hand: `const int n = limit();`.",
    references: [
      "https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html",
      "https://en.cppreference.com/w/cpp/language/as_if",
    ],
  },
  {
    id: "compilers-strength-reduction-01",
    category: "compilers",
    difficulty: "easy",
    title: "Dividing a signed int by two",
    tags: ["strength-reduction", "codegen", "integer-division"],
    type: "trace",
    prompt:
      "Compiled with -O2 for arm64 or x86-64, halfU becomes a single logical right shift. What does the compiler emit for half?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int half(int x) {
    return x / 2;
}

unsigned halfU(unsigned x) {
    return x / 2;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "A shift plus a fix-up that first adds the sign bit, since signed division rounds toward zero and a bare shift rounds down.",
        "A single arithmetic right shift, the same cost as halfU's logical shift, since x >> 1 equals x / 2 for every int value.",
        "A real hardware divide instruction, because rewriting division as a shift is only permitted when the operand is unsigned.",
        "A single arithmetic shift, since x / 2 for negative odd x is implementation-defined and compilers pick floor rounding.",
      ],
      correctIndex: 0,
    },
    explanation:
      "Strength reduction replaces an expensive operation with a cheaper one, but only where the two are equal for every input, and for signed division by a power of two they are not. Since C++11 (and C99) integer division truncates toward zero, so `-7 / 2` is `-3`. An arithmetic right shift rounds toward negative infinity, so `-7 >> 1` is `-4`. The two agree for non-negative values and for even negative values, and disagree for odd negative ones. To use a shift anyway, the compiler adds 1 to negative inputs first, and that 1 is exactly the sign bit. Clang at -O2 on arm64 emits `add w8, w0, w0, lsr #31` followed by `asr w0, w8, #1`; GCC on x86-64 emits the equivalent `shr`/`add`/`sar` sequence. `halfU` has no negative inputs, so it gets a single `lsr w0, w0, #1`. The implementation-defined answer describes C++03, which left the rounding direction of negative division up to the implementation; C++11 removed that latitude. No undefined behavior is involved anywhere here: the compiler is applying an exact identity, not exploiting an assumption. If you know `x` is never negative, tell the compiler: make it unsigned, or add `__builtin_assume(x >= 0)` (or C++23 `[[assume(x >= 0)]]`), and Clang drops the fix-up and emits the bare shift. Division by other constants gets the same treatment, lowered to a multiply by a precomputed reciprocal plus shifts and a similar sign correction.",
    references: [
      "https://en.cppreference.com/w/cpp/language/operator_arithmetic",
    ],
  },
  {
    id: "compilers-forward-progress-01",
    category: "compilers",
    difficulty: "hard",
    title: "A Collatz loop called with zero",
    tags: ["forward-progress", "undefined-behavior", "loop-deletion"],
    type: "trace",
    prompt:
      "For n = 0 the loop body maps 0 to 0, so the abstract machine never leaves the loop. Compiled as C++20 with -O2, what does this program do?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdio>

bool reachesOne(unsigned long n) {
    while (n != 1) {
        n = (n % 2) ? 3 * n + 1 : n / 2;
    }
    return true;
}

int main() {
    std::printf("%d\\n", reachesOne(0));
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Hangs forever. Non-termination is behavior the program exhibits, so the as-if rule obliges the compiler to keep the loop.",
        "Traps. Clang lowers a provably infinite loop with no side effects to a trap instruction, so the process dies with SIGILL.",
        "Hangs forever, because unsigned arithmetic wraps by definition, leaving no undefined behavior for the optimizer to exploit.",
        "Prints 1. A loop with no I/O, volatile, or atomic operations may be assumed to terminate, so the compiler may delete it.",
      ],
      correctIndex: 3,
    },
    explanation:
      "The unsigned-wraparound answer is right that no arithmetic here is undefined, but the undefined behavior is somewhere else. The forward progress guarantee, [intro.progress]p1, lets the implementation assume every thread eventually terminates, calls a library I/O function, performs a volatile access, or performs a synchronization or atomic operation. A loop that spins forever doing none of those violates the assumption, and executing it is undefined behavior. For `n = 0` this loop is exactly that. The rule exists for the optimizer's benefit: without it, the compiler could not delete or reorder a side-effect-free loop unless it first proved that the loop terminates, which is undecidable in general (and for this recurrence, an open problem in mathematics). With it, the reasoning is short. Nothing computed in the loop is used afterward, the only exit leads to `return true`, and the loop may be assumed to finish, so the whole loop goes. Both GCC 16 and Clang at -O2 compile `reachesOne` to `mov w0, #1; ret`, and the program prints 1 rather than hanging. Clang marks C++ functions `mustprogress`, and GCC enables `-ffinite-loops` by default at -O2 for C++11 and later. C has a narrower version of the rule, C11 6.8.5p6, which covers only loops whose controlling expression is not a constant expression. This loop qualifies, so Clang folds it in C too. C++26 (P2809) carves out trivial infinite loops such as `while (true);`, so embedded idle loops are no longer UB, but a loop with a real condition and body like this one is still covered. If you need the hang, put a volatile access or an atomic operation in the body, or build with `-fno-finite-loops`.",
    references: [
      "https://en.cppreference.com/w/cpp/language/multithread#Forward_progress",
      "https://wg21.link/p2809r3",
    ],
  },
  {
    id: "compilers-icf-01",
    category: "compilers",
    difficulty: "medium",
    title: "Two handlers with the same body and a pointer comparison",
    tags: ["identical-code-folding", "linker", "function-pointers"],
    type: "trace",
    prompt:
      "Each of the three files below is its own translation unit, all built at -O2 with -ffunction-sections and linked with lld using -Wl,--icf=all. There is no LTO. What does the program print?",
    snippet: {
      language: "cpp",
      filename: "handlers.cpp",
      code: `// handlers.cpp
int onRead(int fd)  { return fd + 1; }
int onWrite(int fd) { return fd + 1; }

// names.cpp
using Handler = int (*)(int);
int onRead(int);
int onWrite(int);

const char* nameOf(Handler h) {
    if (h == onRead)  return "read";
    if (h == onWrite) return "write";
    return "unknown";
}

// main.cpp
#include <cstdio>
using Handler = int (*)(int);
int onWrite(int);
const char* nameOf(Handler h);

int main() {
    std::puts(nameOf(onWrite));
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "write. Distinct functions are guaranteed distinct addresses, and lld never folds a function whose address is taken.",
        "unknown. Folding gives the merged body a fresh address, so h matches neither of the two original function symbols.",
        "read. --icf=all merges identical bodies even when their addresses are taken, so the two pointers now compare equal.",
        "A link error. lld detects that a folded function's address is compared and refuses to complete the --icf=all link.",
      ],
      correctIndex: 2,
    },
    explanation:
      "The standard is unambiguous that pointers to two different functions compare unequal ([expr.eq]), so a conforming implementation must print write. Identical code folding is a linker optimization that trades that guarantee away for size. With `-ffunction-sections`, each function lands in its own section; `onRead` and `onWrite` compile to byte-identical sections with identical relocations, and `--icf=all` merges every such group into one copy, regardless of whether anyone takes the function's address. Both symbols then resolve to the same address, the first comparison in `nameOf` succeeds, and the program prints read. No fresh address is invented: the survivor keeps the address of one of the originals, and every symbol in the group is pointed at it. `--icf=safe` is the conforming-in-practice mode. Clang emits an `.llvm_addrsig` section (on by default for ELF) listing every symbol whose address is significant, meaning taken and possibly compared, and lld in safe mode folds only functions that are absent from that list. Gold's safe mode approximates the same thing by inspecting relocations. MSVC's `/OPT:ICF` folds aggressively like `--icf=all`, which is why Windows stack traces sometimes show an unrelated function name and why function-address-as-unique-ID tricks fail there. A nasty side effect: the compiler is still entitled to fold `onRead == onWrite` to false whenever both symbols are visible to it in one TU, so under `--icf=all` the same comparison can be false in one place and true in another within a single binary. The names.cpp split in this snippet keeps the comparison opaque so the link-time merge is what decides it.",
    references: [
      "https://en.cppreference.com/w/cpp/language/operator_comparison",
    ],
  },
  {
    id: "compilers-launder-01",
    category: "compilers",
    difficulty: "hard",
    title: "A virtual call before and after placement new",
    tags: [
      "std-launder",
      "object-lifetime",
      "devirtualization",
      "undefined-behavior",
    ],
    type: "trace",
    prompt:
      "morph lives in its own translation unit, so it is opaque to twice. Built with Clang at -O2 the program prints 12; adding -fstrict-vtable-pointers, it prints 11. Which statement is correct?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdio>
#include <new>

struct Base    { virtual int id() { return 1; } };
struct Derived : Base { int id() override { return 2; } };

// morph.cpp (separate TU)
void morph(Base* b) {
    b->~Base();
    new (b) Derived;          // same size, same alignment
}

// main.cpp
void morph(Base* b);

int twice(Base* b) {
    int first = b->id();
    morph(b);
    int second = b->id();     // (1)
    return first * 10 + second;
}

int main() {
    std::printf("%d\\n", twice(new Base));
}`,
      highlightLines: [19],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Line (1) is UB. A Derived does not transparently replace a Base, so b still names the dead object and its stale vptr may be reused.",
        "-fstrict-vtable-pointers is non-conforming here. After morph, line (1) must dispatch to Derived::id, so 12 is the only valid output.",
        "The UB is inside morph. Placement new may only construct an object of the same type as the one that previously occupied the storage.",
        "The program is fine and 11 is a miscompile. std::launder is only needed when the replaced object has const or reference members.",
      ],
      correctIndex: 0,
    },
    explanation:
      "Ending an object's lifetime and constructing a new one in its storage is legal, so morph itself is fine. The question is what the old pointer `b` refers to afterward. [basic.life]p8 says a pointer to the original object automatically refers to the new one only if the new object transparently replaces the old: same storage, same type (ignoring cv-qualifiers), the original was not a complete const object, and neither is a potentially-overlapping subobject. A `Derived` replacing a `Base` fails the same-type requirement, so `b` still points to the dead `Base`, and calling a member function through it on line (1) is undefined behavior. The const-and-reference-member answer describes the pre-C++20 wording, which C++20 relaxed; the same-type requirement was never relaxed. Clang's `-fstrict-vtable-pointers` puts that rule to work. It tags vptr loads with `invariant.group` metadata, meaning a vptr loaded through a given pointer cannot change for the object's lifetime, and inserts a launder barrier at placement new and `std::launder`. In `twice` it then loads the vptr and the `id` slot once, and line (1) reuses the same function pointer register, calling `Base::id` even though a `Derived` now lives there. Without the flag, Clang reloads the vptr after the opaque call and prints 12, but only because it assumes conservatively that `morph` might write memory, not because the standard requires it. GCC 16 needs no flag at all: at -O2 it inlines `twice` into `main`, where it can see the object was created by `new Base`, devirtualizes both calls to `Base::id`, and the program prints 11 out of the box. The fix is to name the new object: write `std::launder(b)->id()`, or use the pointer that placement new returns. With `std::launder` on line (1), the flagged build prints 12 too. The flag is off by default because a great deal of existing code relies on the old pointer just working.",
    references: [
      "https://en.cppreference.com/w/cpp/utility/launder",
      "https://en.cppreference.com/w/cpp/language/lifetime",
    ],
  },
  {
    id: "compilers-trivially-copyable-01",
    category: "compilers",
    difficulty: "medium",
    title: "Three ways to declare a destructor that does nothing",
    tags: ["trivially-copyable", "special-member-functions", "abi"],
    type: "trace",
    prompt:
      "Which of these three types satisfy std::is_trivially_copyable, the property that sanctions copying them with memcpy and makes them eligible for the memmove fast paths in std::copy and vector reallocation?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <type_traits>

struct A { int x; };                     // no destructor declared
struct B { int x; ~B() = default; };     // defaulted on first declaration
struct C { int x; ~C() {} };             // user-provided, empty body

// Which of these assertions hold?
static_assert(std::is_trivially_copyable_v<A>);
static_assert(std::is_trivially_copyable_v<B>);
static_assert(std::is_trivially_copyable_v<C>);`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Only A. Declaring any destructor, even = default, makes it user-declared, and a user-declared destructor is never trivial.",
        "All three. Trivial copyability looks only at the copy and move operations, and none of these types declares any of them.",
        "Only A. Declaring a destructor in B or C suppresses the implicit move constructor, which trivial copyability requires.",
        "A and B. Defaulting on the first declaration keeps a destructor trivial, but C's empty body makes it user-provided.",
      ],
      correctIndex: 3,
    },
    explanation:
      "[class.prop] defines trivially copyable as: at least one eligible copy or move constructor or assignment operator, every eligible one trivial, and a trivial, non-deleted destructor. So the destructor matters, which rules out the all-three answer. A destructor is trivial when it is not user-provided (and it is not virtual, and every base and member is trivially destructible). `~B() = default;` on its first declaration is user-declared but not user-provided, so it stays trivial. `~C() {}` is user-provided, so it is non-trivial even though its body is empty; the compiler does not look inside the body to decide. B's user-declared destructor does suppress the implicit move constructor and move assignment, but the copy operations are still implicitly declared (a deprecated generation, but still valid) and trivial, and that is enough. So A and B pass and C fails. This shows up in generated code, not just in the type trait. Library algorithms branch on the trait: std::copy and vector reallocation use memmove for A and B, and do element-wise copies for C, which the optimizer may or may not turn back into a memcpy afterward. memcpy-ing into a C object is not something the standard sanctions. The calling convention changes too. The Itanium C++ ABI passes a class with a non-trivial destructor indirectly, so `int f(C c)` receives a pointer to a caller-owned temporary. Clang at -O2 on arm64 compiles `f(A)` and `f(B)` to a bare `ret`, with the value already in `w0`, but `f(C)` to `ldr w0, [x0]; ret`. One empty pair of braces costs a memory round-trip on every call.",
    references: [
      "https://en.cppreference.com/w/cpp/types/is_trivially_copyable",
      "https://en.cppreference.com/w/cpp/language/destructor#Trivial_destructor",
      "https://itanium-cxx-abi.github.io/cxx-abi/abi.html#non-trivial",
    ],
  },
  {
    id: "compilers-eh-noexcept-01",
    category: "compilers",
    difficulty: "hard",
    title: "A noexcept function calling code that may throw",
    tags: ["exception-handling", "noexcept", "unwind-tables"],
    type: "trace",
    prompt:
      "consume is not noexcept and may throw. Compiled at -O2 for a table-based (Itanium ABI) exception model, what does marking process noexcept change in its generated code compared with the unmarked version?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Buffer {
    Buffer();
    ~Buffer();
};

void consume(Buffer&);   // may throw

void process() noexcept {
    Buffer b;
    consume(b);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It wraps the body in an implicit try/catch(...) whose setup runs on every call, so the non-throwing path gets a little slower.",
        "Nothing at runtime. noexcept is a promise visible only to the noexcept operator, and an exception from consume still propagates.",
        "No happy-path code is added. A throw from consume ends in std::terminate, possibly without ~Buffer ever running.",
        "It is ill-formed: a noexcept function may not call a potentially-throwing one, though compilers only warn about the violation.",
      ],
      correctIndex: 2,
    },
    explanation:
      "Under the table-based model, the non-throwing path costs nothing at runtime, and that holds with or without `noexcept`. The compiler records which call-site address ranges map to which landing pads in a side table (the LSDA in `.gcc_except_table`). The happy path is straight-line code: construct, call, destroy, return. No registration and no flag checks; the setup-per-call answer describes the old setjmp/longjmp model. Without `noexcept`, if `consume` throws, the landing pad runs `~Buffer` and then calls `_Unwind_Resume` to keep unwinding. With `noexcept`, [except.spec] requires that an exception reaching the function's boundary call `std::terminate`, so the annotation is enforced at runtime and is not purely advisory. [except.terminate] then makes it implementation-defined whether the stack is unwound, unwound partially, or not unwound at all before `std::terminate` runs, and both major compilers use that latitude to drop the cleanup. Clang at -O2 on arm64 emits the same construct, call, destroy sequence on the happy path of both versions, but the noexcept version's single landing pad is just `bl ___clang_call_terminate`, with no destructor call. GCC goes further and emits an empty call-site table: when the personality routine finds no entry for the faulting PC it calls `std::terminate` during the search phase, so there is no landing pad at all and nothing is unwound. Zero-cost is not zero overall. The tables and landing pads take space in the binary, and every potentially-throwing call is an edge the optimizer must respect when moving code. `noexcept` also pays off one level up: callers of process need no cleanup landing pads around the call.",
    references: [
      "https://en.cppreference.com/w/cpp/language/noexcept_spec",
      "https://itanium-cxx-abi.github.io/cxx-abi/abi-eh.html",
    ],
  },
  {
    id: "compilers-devirt-03",
    category: "compilers",
    difficulty: "hard",
    title: "Three LTO builds of the same virtual call",
    tags: ["devirtualization", "lto", "whole-program-vtables", "visibility"],
    type: "trace",
    prompt:
      "Circle is the only class anywhere in the program that derives from Shape, and nothing is loaded dynamically. The program is built three ways with Clang at -O2: (1) -flto, (2) -flto -fwhole-program-vtables, (3) -flto -fwhole-program-vtables -fvisibility=hidden. In which builds does s->area() in total become a direct call?",
    snippet: {
      language: "cpp",
      filename: "shape.h",
      code: `// shape.h
struct Shape {
    virtual ~Shape() = default;
    virtual double area() const = 0;
};
Shape* makeShape();

// circle.cpp
struct Circle : Shape {
    double r = 1.0;
    double area() const override { return 3.14159 * r * r; }
};
Shape* makeShape() { return new Circle; }

// total.cpp
double total(const Shape* s, int n) {
    double t = 0;
    for (int i = 0; i < n; ++i) t += s->area();
    return t;
}

// main.cpp calls total(makeShape(), argc)`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "All three. LTO already sees every translation unit, so it can prove that Circle is the only Shape implementation there is.",
        "Only (3). Whole-program vtable analysis also needs hidden LTO visibility before it may treat the hierarchy as closed.",
        "(2) and (3). -fwhole-program-vtables is what enables hierarchy analysis; visibility affects only which symbols get exported.",
        "None. A call through a Shape* that arrives from another TU can be devirtualized only speculatively, using PGO data.",
      ],
      correctIndex: 1,
    },
    explanation:
      "Measured with Apple Clang 21 on arm64, where `total` ends up inlined into `main`: builds (1) and (2) both keep an indirect `blr` through the vtable, while build (3) devirtualizes the call, inlines `Circle::area`, and unrolls the loop into repeated adds of the constant 3.14159. Plain LTO merges the IR from every TU, but it gives the optimizer no notion of a class hierarchy. It can still devirtualize when it proves the dynamic type at a particular call site, as with a local object, but it cannot argue that only one implementation exists anywhere. `-fwhole-program-vtables` adds that argument: vtables carry type metadata, virtual call sites carry type tests, and the WholeProgramDevirt pass at link time can apply single-implementation devirtualization, virtual constant propagation, and related transforms. The pass only acts on classes with hidden LTO visibility, though. With default visibility, `Shape` is part of the binary's public interface, so a shared library loaded at runtime could derive from it and hand `total` a pointer the link never saw, and the pass declines to assume otherwise. `-fvisibility=hidden` (or an explicit visibility attribute on the class) is the programmer's promise that the hierarchy is closed at link time. So the claim that visibility affects only exported symbols misses the point: what the linker exports is the very fact the optimizer needs here. None of this is speculative, and none of it needs PGO. Speculative devirtualization, which emits a guarded direct call with an indirect fallback, is a separate technique that GCC enables by default at -O2.",
    references: [
      "https://clang.llvm.org/docs/LTOVisibility.html",
      "https://llvm.org/docs/TypeMetadata.html",
    ],
  },
];
