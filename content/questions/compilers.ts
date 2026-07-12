import type { TraceQuestion } from "@/types/question";

export const compilersQuestions: TraceQuestion[] = [
  {
    id: "compilers-ub-optimizer-01",
    category: "compilers",
    difficulty: "hard",
    title: "A pointer-overflow null check eliminated by the optimizer",
    tags: ["undefined-behavior", "optimizer", "pointer-arithmetic"],
    type: "trace",
    prompt:
      "Compiled with -O2, what does this function's overflow check do at runtime for a very large buf/len where p + len wraps around the address space?",
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
        "The check works as intended: end < buf is true whenever buf + len overflows, so the function correctly returns false",
        "At -O2 the compiler is permitted to (and in practice does, on GCC/Clang) delete the `if (end < buf) return false;` branch entirely, because computing a pointer past the one-past-the-end of an array is undefined behavior, and the optimizer assumes UB never happens — so bufferFits always returns true",
        "Compile error: pointer comparison between unrelated pointers is ill-formed",
        "The check is fully preserved but always evaluates to false regardless of overflow, since pointer comparison after UB is unspecified rather than optimized away",
      ],
      correctIndex: 1,
    },
    explanation:
      "`buf + len` computing an address outside (or more than one-past-the-end of) the array `buf` points into is undefined behavior per [expr.add] — pointer arithmetic is only defined within an array object plus one past its end. Because the optimizer is entitled to assume a program never executes UB, it may reason backward: since `end < buf` can only be true if overflow (UB) occurred, and UB can't occur, `end < buf` must always be false — so the entire guard is dead code and gets deleted by GCC/Clang at -O2 (this is a real, widely-documented class of miscompiled bounds checks). The fix is to do the overflow check in unsigned integer arithmetic (which has well-defined wraparound) rather than pointer arithmetic, e.g. compare `len > SIZE_MAX - (uintptr_t)buf`.",
    references: [
      "https://www.kernel.org/doc/html/latest/process/deprecated.html",
      "https://en.cppreference.com/w/cpp/language/ub",
    ],
  },
  {
    id: "compilers-strict-aliasing-01",
    category: "compilers",
    difficulty: "hard",
    title: "Type punning through incompatible pointer types",
    tags: ["strict-aliasing", "undefined-behavior", "type-punning"],
    type: "trace",
    prompt:
      "Compiled with -O2 (strict aliasing enabled, the default at -O2 for GCC/Clang), what does this function print?",
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
        "Always prints 1.000000 — the bit pattern is preserved regardless of pointer type",
        "Undefined behavior from a strict-aliasing violation: int and float are not compatible/similar types, so the compiler is not required to consider a write through ip visible to a read through fp, and may reorder or eliminate the load of *fp so the printed value is unreliable (may print stale/garbage, or with sufficiently aggressive optimization even print 0.0)",
        "Compile error: reinterpret_cast between int* and float* is ill-formed",
        "Always prints 0.000000 because *fp reads before *ip's write is committed to memory",
      ],
      correctIndex: 1,
    },
    explanation:
      "The strict aliasing rule ([basic.lval]p11) says an object may only be accessed through an lvalue of its own type, a similar type, or a few exempted types (char, unsigned char, std::byte). `int` and `float` are neither the same type nor 'similar', so accessing the `int` object `x` through the unrelated `float*` `fp` is undefined behavior. Because the optimizer assumes `*ip` and `*fp` cannot alias the same storage, it is free to schedule/cache the write to `*ip` and the read of `*fp` in either order, or eliminate the read of `*fp` altogether and reuse a previously loaded value — in practice this can silently print stale or wrong data, especially once inlined into a larger function where the compiler has more freedom to reorder. The standard-conforming fixes are `memcpy(&f, &i, sizeof f)` (which the compiler recognizes and optimizes into a plain bit-reinterpreting move) or, since C++20, `std::bit_cast<float>(i)`.",
    references: [
      "https://en.cppreference.com/w/cpp/language/reinterpret_cast",
      "https://en.cppreference.com/w/cpp/numeric/bit_cast",
    ],
  },
  {
    id: "compilers-strict-aliasing-02",
    category: "compilers",
    difficulty: "medium",
    title: "memcpy as the well-defined escape hatch for type punning",
    tags: ["strict-aliasing", "memcpy", "type-punning"],
    type: "trace",
    prompt:
      "Contrasted with the reinterpret_cast version, what does the compiler do with this memcpy-based version of the same bit-reinterpretation, and does it actually cost a runtime memory copy?",
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
        "It's well-defined and standard-conforming, but at -O2/-O3 GCC and Clang recognize the fixed-size memcpy between same-sized scalar types and lower it to a single register move/reinterpret with no actual memcpy call or byte-by-byte copy loop in the generated code",
        "It's still undefined behavior because memcpy operates on the object representation, which is implementation-defined for float",
        "It compiles and is well-defined, but always incurs a real function-call-and-copy at every optimization level since the compiler cannot see through memcpy",
        "Compile error: memcpy cannot copy into an object of a different type than the source",
      ],
      correctIndex: 0,
    },
    explanation:
      "`std::memcpy` copies `sizeof(f)` bytes of the object representation and is explicitly exempted from the strict aliasing rule — it operates on `unsigned char`-like access, which is always permitted to alias any object. This makes it (and, since C++20, `std::bit_cast`) the standard-sanctioned way to reinterpret bits between same-sized types. The concern that this costs a real function call is a common misconception: GCC and Clang both special-case `memcpy` of a compile-time-constant, small, fixed size between scalar-sized buffers and generate it as a plain load/store or register move, identical in codegen to the (unsafe) `reinterpret_cast` version — you get defined behavior at zero extra runtime cost.",
    references: ["https://en.cppreference.com/w/cpp/numeric/bit_cast"],
  },
  {
    id: "compilers-as-if-rule-01",
    category: "compilers",
    difficulty: "medium",
    title: "The as-if rule eliminates an observably-inert loop",
    tags: ["as-if-rule", "dead-code-elimination", "optimizer"],
    type: "trace",
    prompt:
      "Compiled with -O2, what does the generated assembly for sumSquares look like, and why?",
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
        "A tight machine-code loop that computes i*i and accumulates it n times, because the compiler cannot know n at compile time",
        "The compiler is permitted by the as-if rule to replace the entire loop with a closed-form arithmetic expression (equivalent to the sum-of-squares formula) computed in a handful of instructions with no loop at all, since that produces the exact same observable result for every value of n, and modern GCC/Clang actually do this",
        "The loop is left completely intact because auto-vectorization is not part of the as-if rule",
        "Compile error: the compiler cannot prove the loop terminates",
      ],
      correctIndex: 1,
    },
    explanation:
      "The as-if rule ([intro.abstract]) permits any transformation of the code as long as the program's *observable behavior* — its outputs, volatile accesses, and I/O — is preserved as if the abstract machine executed it literally. Since the loop body has no side effects other than the final `total`, and the summation has a closed-form equivalent (a variant of n(n-1)(2n-1)/6, adjusted for the actual squared-sum recurrence), a sufficiently strong optimizer can prove the two are equivalent for all int n and replace the entire O(n) loop with an O(1) formula. GCC in particular is well known for doing exactly this kind of induction-variable-strength-reduction-to-closed-form transformation on simple summation/multiplication loops. This is the same license under which entire benchmark loops with no observable output get erased to nothing.",
    references: ["https://en.cppreference.com/w/cpp/language/as_if"],
  },
  {
    id: "compilers-const-fold-01",
    category: "compilers",
    difficulty: "easy",
    title: "Constant folding across a constexpr-eligible expression",
    tags: ["constant-folding", "constexpr", "compile-time"],
    type: "trace",
    prompt:
      "Compiled with any standard optimization level, what does the generated code for main contain?",
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
        "A runtime call to square(7) and square(3), then an addition, then a call to printf",
        "The entire value of a (58) is computed at compile time via constant folding/propagation (guaranteed here since a is declared constexpr, which requires a constant-expression initializer), so the generated code just loads/embeds the literal 58 and calls printf with it — no arithmetic instructions and no call to square remain",
        "Undefined behavior because square is not marked consteval",
        "Compile error: constexpr functions cannot be called more than once in the same expression",
      ],
      correctIndex: 1,
    },
    explanation:
      "`square` is `constexpr` and both calls use only literal arguments, so `square(7) + square(3)` is a valid constant expression. Because `a` itself is declared `constexpr`, the standard *requires* its initializer to be evaluated at compile time ([dcl.constexpr]) — this isn't just an optimizer being clever, it's a language guarantee, so even an unoptimized (-O0) build must fold this to 58 at compile time and the object code for `main` simply contains the literal 58 baked in before the call to `printf`. This is the sharp distinction from ordinary constant folding/propagation of non-constexpr-qualified expressions (see the sibling question), which is only ever a best-effort optimization, not a guarantee.",
    references: ["https://en.cppreference.com/w/cpp/language/constexpr"],
  },
  {
    id: "compilers-const-fold-02",
    category: "compilers",
    difficulty: "medium",
    title: "Constant folding blocked by a non-constexpr call",
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
        "It is folded to a constant at compile time because *2 + 1 is a pure arithmetic expression",
        "It cannot be constant-folded: getConfigValue()'s return value is unknown at compile time (its definition isn't visible in this translation unit), so the compiler must emit an actual call instruction, though it can still fold the *2 into a shift and combine the +1 as ordinary instruction selection/strength reduction around the unknown runtime value",
        "Compile error: a non-constexpr function cannot appear in an arithmetic expression",
        "The whole function is deleted as dead code since its result is unused within the TU",
      ],
      correctIndex: 1,
    },
    explanation:
      "Constant folding requires every operand to be known at compile time. `getConfigValue()` is an ordinary (non-`constexpr`) function whose *definition* isn't even visible in this translation unit, so its return value is opaque to the compiler — it must emit a `call` instruction and cannot fold the multiplication or addition into it. It can still apply peephole-level transformations to the parts it does control: multiplying by 2 is commonly strength-reduced to a left-shift or an `lea`/add-with-itself instruction, and the `+1` is just an add against the call's return register. This distinguishes constant folding (requires compile-time-known operands) from strength reduction (works on runtime values too, just replaces an expensive op with a cheaper equivalent one).",
  },
  {
    id: "compilers-dce-01",
    category: "compilers",
    difficulty: "medium",
    title: "Dead code elimination after a provably-false branch condition",
    tags: ["dead-code-elimination", "optimizer", "branch-elimination"],
    type: "trace",
    prompt:
      "Compiled with -O2, what happens to the `expensiveDiagnostic()` call and its surrounding branch?",
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
        "expensiveDiagnostic() is always called at runtime since it's reachable code inside an if statement",
        "The compiler constant-folds DEBUG to false, proves the if-branch is unreachable, and eliminates the entire branch (and, since it's now the only caller-visible use, potentially the call to expensiveDiagnostic and even the requirement to link against its definition) via dead code elimination — compute compiles down to just the multiply",
        "Compile error: DEBUG must be used in at least one reachable branch",
        "The branch is kept but expensiveDiagnostic's body is inlined and folded to a no-op",
      ],
      correctIndex: 1,
    },
    explanation:
      "`DEBUG` is a `constexpr bool` initialized to `false`, so `if (DEBUG)` is a compile-time-provable-false condition. The optimizer performs dead code elimination (DCE): since control can never reach the `if` body, that entire basic block — including the call to `expensiveDiagnostic()` — is unreachable and is removed from the emitted code. `expensiveDiagnostic` need not even be defined in this TU for this to compile and optimize away; only if some other path actually called it would the linker need a definition. This is the mechanism behind zero-runtime-cost `if constexpr`-style debug/release branching even when using a plain runtime `if` on a compile-time-constant condition (though `if constexpr` gives stronger guarantees, e.g. suppressing template instantiation of the dead branch, which a plain `if` does not).",
  },
  {
    id: "compilers-dce-02",
    category: "compilers",
    difficulty: "hard",
    title: "Dead code elimination downstream of prior UB",
    tags: ["dead-code-elimination", "undefined-behavior", "optimizer"],
    type: "trace",
    prompt:
      "Compiled with -O2, given that arr has only 4 elements, what happens to everything after the out-of-bounds write on the line marked (1)?",
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
        "The out-of-bounds write silently corrupts adjacent stack memory, then \"after write\" and \"done\" are both printed normally",
        "Because arr[10] = 99 is undefined behavior whenever trigger is true, the compiler is entitled to assume that whole path never executes; this can manifest as the optimizer deleting the write, the printf at (2), or even collapsing the entire trigger==true path (including \"done\") — the actual observed behavior is unspecified by the standard and can range from a crash to skipped output to code that behaves as if trigger were always false",
        "Compile error: arr[10] is out of the declared bounds of a 4-element array and is diagnosed at compile time",
        "The write is bounds-checked at runtime and silently ignored, so only \"done\" is printed",
      ],
      correctIndex: 1,
    },
    explanation:
      "Indexing `arr[10]` on a 4-element array is undefined behavior ([expr.sub]) — C++ does not bounds-check plain array subscripting. Once the optimizer can prove a code path necessarily executes UB, it is licensed by [intro.abstract] to treat that path as if it cannot happen at all, since the standard imposes no requirements on a program's behavior once it invokes UB. In practice this is not merely 'the write clobbers memory' (a naive mental model) — real optimizing compilers have been observed to delete subsequent code, hoist/sink surrounding instructions across the UB point, or even assume `trigger` is always false and eliminate the whole conditional, because any of those are equally 'valid' outcomes when the standard promises nothing. This is why 'it happened to work when I tested it' is not evidence of correctness for UB-containing code — behavior can change across compiler versions, flags, or even by adding unrelated code elsewhere in the function that changes inlining decisions.",
  },
  {
    id: "compilers-cse-01",
    category: "compilers",
    difficulty: "medium",
    title: "Common subexpression elimination on a pure computation",
    tags: ["cse", "optimizer", "codegen"],
    type: "trace",
    prompt:
      "Compiled with -O2, how many times does the multiplication a * b actually get computed in the generated machine code?",
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
        "Twice — once for x and once for y, since they're separate statements",
        "Once — the optimizer recognizes a * b as a common subexpression computed identically for x and y (int multiplication has no side effects and the operands aren't modified in between), computes it a single time, and reuses the result for both",
        "Zero times — the whole function is constant-folded away",
        "Three times — once for x, once for y, and once more inside the final return's multiplication",
      ],
      correctIndex: 1,
    },
    explanation:
      "Common subexpression elimination (CSE) identifies expressions that compute the same value more than once and replaces later occurrences with a reference to the first result. `a * b` appears identically in both `x`'s and `y`'s definitions, `a` and `b` are not modified between the two uses, and `int` multiplication is a pure operation with no observable side effects — so the optimizer proves the two occurrences are equivalent and emits the multiply instruction only once, reusing the value (typically kept in a register) for both `x` and `y`. This is a purely local, provably-safe transformation, unlike the function-call case in the sibling CSE question where purity can't be assumed.",
  },
  {
    id: "compilers-cse-02",
    category: "compilers",
    difficulty: "hard",
    title: "CSE blocked by an unprovable side effect",
    tags: ["cse", "optimizer", "aliasing"],
    type: "trace",
    prompt:
      "getValue() is an ordinary (non-const, non-pure, not visible for inlining) external function. Compiled with -O2, how many times does the compiler call getValue() in the generated code for f?",
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
        "Once — the compiler assumes getValue() is a pure function and reuses the first result for both x and y",
        "Twice — getValue()'s definition isn't visible, so the compiler cannot prove it's free of side effects (it might mutate global state, perform I/O, or return a different value each call), and eliminating the second call would change observable behavior if it isn't actually pure; CSE cannot legally fire here",
        "Zero times — both calls are dead code since x and y are only used in a sum that's returned",
        "Compile error: a function without a definition cannot be called twice in the same scope",
      ],
      correctIndex: 1,
    },
    explanation:
      "CSE is only a legal transformation when the compiler can prove the two occurrences of an expression are *referentially transparent* — same inputs guaranteed to produce the same result with no intervening observable side effect. An ordinary external function call is opaque: without seeing its definition (or a `const`/`pure`/`[[gnu::const]]`-style attribute making stronger guarantees, or LTO exposing the body for inlining and side-effect analysis), the compiler must conservatively assume `getValue()` could return a different value each call, or could have side effects (writing a global, doing I/O) that must each individually be preserved per the as-if rule. So both calls remain in the generated code. This is exactly why marking known-pure functions `[[gnu::const]]`/`__attribute__((const))` (or exposing them via LTO) can unlock optimizations that are otherwise legally blocked.",
  },
  {
    id: "compilers-vectorization-01",
    category: "compilers",
    difficulty: "hard",
    title: "Pointer aliasing blocks auto-vectorization",
    tags: ["vectorization", "aliasing", "restrict", "simd"],
    type: "trace",
    prompt:
      "Compiled with -O3 and auto-vectorization enabled, why can't the compiler safely vectorize this loop into SIMD instructions as written?",
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
        "It can always vectorize freely — float arithmetic has no aliasing concerns",
        "Because a, b, and out are ordinary (non-restrict) pointers, the compiler cannot prove out doesn't overlap a or b; if a caller passed overlapping ranges (e.g. out == a + 1), processing elements in SIMD-width chunks could read already-overwritten input, changing the result versus sequential execution — so without __restrict (or runtime pointer-range checks the compiler inserts as a vectorized/scalar fallback pair) it must either not vectorize or generate a runtime aliasing check",
        "It fails to compile because float* parameters require restrict by default in C++",
        "It vectorizes unconditionally at -O3 regardless of potential overlap because -O3 disables aliasing checks entirely",
      ],
      correctIndex: 1,
    },
    explanation:
      "Vectorizing this loop means computing several `out[i] = a[i] + b[i]` iterations together using SIMD lanes, which implicitly reorders the individual scalar reads/writes relative to strict sequential execution. That reordering is only safe if `out`'s memory doesn't overlap `a` or `b` in a way that would make a later (in program order) read observe an earlier (in program order) write that SIMD execution would perform out of order. Since `a`, `b`, and `out` are plain pointers, the compiler has no static guarantee they're distinct — a caller is free to alias them. Modern compilers commonly handle this by emitting a runtime aliasing check that picks between a vectorized fast path (when ranges provably don't overlap at runtime) and a scalar fallback, but the cleanest fix is annotating the parameters `float* __restrict__ a, ...` so the *programmer* asserts non-aliasing and the compiler can vectorize unconditionally without a runtime check.",
    references: ["https://en.cppreference.com/w/c/language/restrict"],
  },
  {
    id: "compilers-vectorization-02",
    category: "compilers",
    difficulty: "medium",
    title: "A data-dependent trip count still vectorizes with a remainder loop",
    tags: ["vectorization", "loop-unrolling", "simd"],
    type: "trace",
    prompt:
      "n is a runtime parameter, not known at compile time. Does that alone prevent the compiler from vectorizing this loop at -O3?",
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
        "Yes — vectorization requires a compile-time-constant trip count so the compiler knows exactly how many SIMD lanes to fill",
        "No — the compiler can still vectorize the main body in fixed-width SIMD chunks (e.g. process 8 floats at a time) and emit a separate scalar 'remainder loop' to handle the up-to-7 leftover elements when n isn't a multiple of the vector width; __restrict here removes the aliasing concern that would otherwise block it",
        "No — it can't vectorize, but only because __restrict is a GCC/Clang extension that has no effect on codegen without -fno-strict-aliasing",
        "Yes, but only if n is provably even",
      ],
      correctIndex: 1,
    },
    explanation:
      "A runtime (not compile-time-constant) trip count does not by itself block vectorization — only a compile-time-known count enables *full unrolling*, a distinct optimization. For vectorization, the compiler generates a loop that processes the vector width's worth of elements per iteration (e.g. 8 floats with AVX) for `n / width` iterations, plus a short scalar 'remainder' or 'epilogue' loop (or a masked final vector iteration on ISAs supporting predication) to handle `n % width` leftover elements — all of this is generated once at compile time and dispatches correctly for whatever `n` turns out to be at runtime. The `__restrict` qualifier on `a` here matters for a different reason than the sibling question: it tells the compiler `a` doesn't alias `factor` (moot, different type) but more importantly rules out self-aliasing concerns if this were extended to multiple pointer parameters; here it's `float* __restrict` — the input and output are the same buffer, which is fine since there's no cross-array aliasing hazard, so vectorization proceeds freely.",
  },
  {
    id: "compilers-inlining-01",
    category: "compilers",
    difficulty: "easy",
    title: "What the inline keyword actually guarantees",
    tags: ["inlining", "odr", "linkage"],
    type: "trace",
    prompt:
      "What does marking a function inline actually guarantee, given this header included by multiple .cpp files?",
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
        "It guarantees the compiler will substitute addOne's body at every call site instead of emitting a call instruction",
        "It does not guarantee actual inlining at all — the compiler's inliner decides that heuristically based on cost/benefit (this function's 1000-iteration loop makes it a poor inlining candidate despite the keyword). What `inline` actually guarantees is an exemption from the One Definition Rule: it permits an identical definition to appear in multiple translation units (e.g. via a header) without triggering a multiple-definition linker error, with the linker keeping exactly one copy",
        "It guarantees the function is emitted as a macro-like text substitution at preprocessing time",
        "It has no effect whatsoever in modern C++ and exists purely for backward compatibility with C",
      ],
      correctIndex: 1,
    },
    explanation:
      "The name `inline` is a famous historical misnomer. Per [dcl.inline], its actual normative effect is on *linkage*: a function so marked may have its definition appear, identically, in more than one translation unit without violating the One Definition Rule, which is exactly what's needed when a function body lives in a header included everywhere. Whether the compiler actually substitutes the body at call sites is an entirely separate, heuristic decision made by the inliner based on estimated cost (code size growth, register pressure) versus benefit (eliminated call overhead, enabling further optimization) — a function marked `inline` can easily not be inlined (as here, where a 1000-iteration loop makes the body far too large to be a good inlining candidate under default heuristics), and a function *not* marked `inline` but defined in a single TU (or exposed via LTO) can absolutely be inlined by the compiler when it judges that beneficial.",
  },
  {
    id: "compilers-regalloc-01",
    category: "compilers",
    difficulty: "hard",
    title: "Register allocation via graph coloring forces a spill",
    tags: ["register-allocation", "graph-coloring", "spilling"],
    type: "trace",
    prompt:
      "On a target ISA with, say, 8 available general-purpose integer registers for allocation, what does the compiler's register allocator do when this function has 12 simultaneously-live local variables at one program point, all used again afterward?",
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
        "Compile error: too many live variables for the available registers",
        "The register allocator builds an interference graph where each simultaneously-live variable is a node connected to every other live-at-the-same-time variable; when it cannot find a valid k-coloring (k = 8 available registers) because too many variables interfere at once, it must spill one or more variables to stack memory, inserting store/load instructions around their uses — this is a real, common, and entirely legal outcome of register pressure exceeding the register file size, not an error",
        "The compiler automatically increases the number of hardware registers by using SIMD registers to hold scalar longs instead",
        "It silently produces incorrect code because more than 8 variables cannot coexist",
      ],
      correctIndex: 1,
    },
    explanation:
      "Graph-coloring register allocation (the Chaitin-Briggs family of algorithms used by LLVM and GCC) models the problem as graph coloring: build an interference graph with one node per virtual/live range, an edge between any two that are simultaneously live, and try to color the graph with k colors (k = number of physical registers) such that no two adjacent nodes share a color. Here, with 12 long-lived values all interfering at the `sum = ...` computation and beyond, the interference graph has a clique (or near-clique) larger than 8 available registers, so no valid 8-coloring exists. The standard resolution is spilling: the allocator picks one or more nodes (typically by an estimated spill-cost heuristic — how expensive vs. how frequently used) to evict to stack memory, inserting explicit store instructions after their definitions and load instructions before their uses, which reduces the effective interference and lets the remaining graph be colored. This is completely ordinary compiler behavior under high register pressure, not a failure mode — it just means the generated code has more memory traffic than an equivalent function with fewer simultaneously-live values.",
  },
  {
    id: "compilers-tco-01",
    category: "compilers",
    difficulty: "hard",
    title: "Tail call optimization on a genuinely tail-recursive function",
    tags: ["tail-call-optimization", "recursion", "stack"],
    type: "trace",
    prompt:
      "Compiled with -O2, calling sumTo(1000000, 0) — what happens?",
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
        "Stack overflow — one million recursive calls each push a new stack frame",
        "The recursive call is in tail position (nothing happens after it returns — its result is returned directly), so the compiler can perform tail call optimization: reusing the current stack frame for the 'recursive' call instead of pushing a new one, effectively transforming it into a loop at the machine-code level with O(1) stack usage regardless of n — no stack overflow even for n = 1,000,000",
        "Compile error: recursive functions cannot take an accumulator parameter",
        "It works correctly but still uses O(n) stack frames because C++ never performs TCO, unlike functional languages",
      ],
      correctIndex: 1,
    },
    explanation:
      "`return sumTo(n - 1, acc + n);` is a tail call: the recursive call's result is returned immediately, with no pending computation (no addition, no further use of the result) after it returns. This is precisely the shape that lets a compiler perform tail call optimization — rather than pushing a new stack frame and returning through a chain of one million frames, the compiler can overwrite the current frame's arguments in place and jump back to the top of the function (or equivalently, transform the whole thing into a plain loop during codegen), giving O(1) stack space. GCC and Clang do perform this at -O2 for cases like this (it typically requires optimization to be enabled — it's not guaranteed by the standard, unlike languages such as Scheme, but is reliable QoI behavior for simple self-tail-recursive functions on these compilers). Note this contrasts with `n + sumTo(n - 1)`-style non-tail recursion (see the sibling non-tail-recursion question), where the pending addition after the call returns means TCO cannot apply and stack usage genuinely grows with n.",
    references: ["https://en.wikipedia.org/wiki/Tail_call"],
  },
  {
    id: "compilers-tco-02",
    category: "compilers",
    difficulty: "medium",
    title: "A non-tail-recursive rewrite defeats TCO",
    tags: ["tail-call-optimization", "recursion", "stack-overflow"],
    type: "trace",
    prompt:
      "This version computes the same sum but without an accumulator. Calling sumTo(1000000) at -O2 — what's the practical difference from the accumulator version?",
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
        "Identical to the accumulator version — the compiler can always convert any recursion to a loop regardless of shape",
        "The recursive call is not in tail position (the pending `n +` addition must be applied to its result after it returns), so this is not a candidate for tail call optimization; each call genuinely pushes a stack frame that must remain live until the recursive call returns, so calling sumTo(1000000) risks a real stack overflow that the accumulator-passing tail-recursive version would not have",
        "The compiler automatically rewrites this into the accumulator-passing form at -O2, so it behaves identically to the tail-recursive version",
        "Compile error: recursive functions must be in tail position at -O2",
      ],
      correctIndex: 1,
    },
    explanation:
      "`return n + sumTo(n - 1);` requires the caller's frame to remain alive after the recursive call returns, because the addition of `n` to the result hasn't happened yet — this is the defining characteristic of *non*-tail recursion. TCO fundamentally cannot apply here: there is no way to reuse the current frame for the recursive call, since the current frame's local state (`n`) is still needed after that call completes. While a sufficiently advanced compiler could in principle recognize this specific summation pattern and transform it via accumulator-introduction (a much rarer, more aggressive transformation than plain TCO), mainstream C++ compilers do not reliably perform this rewrite for arbitrary non-tail-recursive functions, so in practice this recurses with genuine O(n) stack frames and is a realistic stack-overflow risk at n = 1,000,000 on a typical 1-8MB thread stack, unlike the accumulator-passing version in the sibling question.",
  },
  {
    id: "compilers-lto-01",
    category: "compilers",
    difficulty: "hard",
    title: "Cross-TU inlining enabled only by LTO",
    tags: ["lto", "linkage", "inlining"],
    type: "trace",
    prompt:
      "square is a non-inline function defined in math.cpp and declared in math.h; caller.cpp calls it in a hot loop. Compiled normally (each .cpp compiled separately, then linked) versus compiled with -flto — what's the difference in whether square can be inlined into the loop in caller.cpp?",
    snippet: {
      language: "cpp",
      filename: "math.cpp",
      code: `// math.h: int square(int x);
int square(int x) { return x * x; }`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No difference — the compiler can always see across translation units regardless of LTO",
        "Without LTO, the compiler compiles caller.cpp with only square's declaration visible (from math.h), so it must emit an actual call instruction — it cannot inline a function whose definition lives in a separate TU it never sees during that compilation. With -flto, both TUs' intermediate representations are available to the optimizer at link time, so it can perform cross-TU inlining (and devirtualization) as if the two files had been compiled together, potentially inlining square directly into caller.cpp's loop",
        "Without LTO the call is always inlined because square is a trivially small function; LTO only matters for large functions",
        "LTO only affects debug symbol generation, not inlining decisions",
      ],
      correctIndex: 1,
    },
    explanation:
      "Ordinary (non-LTO) compilation processes each translation unit essentially independently: `caller.cpp` is compiled with only the declaration `int square(int x);` visible from `math.h`, and the compiler has no access to `square`'s function body (which lives in `math.cpp`, compiled as a separate, later-linked object file) — so it has no choice but to emit a real `call` instruction, however trivial `square` is. Link-time optimization changes this by deferring code generation: each TU is compiled to an intermediate representation (e.g. LLVM bitcode, or GCC's GIMPLE) rather than final machine code, and the linker invokes the compiler's optimizer again with *all* TUs' IR available simultaneously, letting it perform whole-program-scope optimizations — cross-TU inlining, devirtualization, and interprocedural constant propagation — that are fundamentally impossible without seeing both bodies at once. This is the precise mechanism by which LTO can inline `square` directly into `caller.cpp`'s loop, eliminating the call overhead entirely, something no amount of per-TU `-O3` can achieve on its own.",
  },
  {
    id: "compilers-lto-02",
    category: "compilers",
    difficulty: "medium",
    title: "Header-defined inline functions are the exception that doesn't need LTO",
    tags: ["lto", "inlining", "headers"],
    type: "trace",
    prompt:
      "Contrast this version — where square's definition (not just its declaration) lives directly in the header — with the previous math.cpp/math.h split. Without LTO, can caller.cpp's compilation inline square here?",
    snippet: {
      language: "cpp",
      filename: "math.h",
      code: `inline int square(int x) { return x * x; }`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No — inlining across any file boundary always requires LTO, regardless of where the definition physically lives",
        "Yes — because square's full definition (not just a declaration) is textually present in math.h, and caller.cpp #includes math.h, the compiler compiling caller.cpp has square's actual body available during that single TU's compilation and can inline it using ordinary per-TU optimization, with no LTO required at all; the inline keyword here is also what legally permits this same definition to appear (post-preprocessing) in every TU that includes the header without violating the ODR",
        "It depends on the optimization level of math.cpp, which must also be compiled with -O2",
        "Compile error: a function cannot be both inline and included from a header used by multiple .cpp files",
      ],
      correctIndex: 1,
    },
    explanation:
      "The key distinction from the sibling LTO question is *where the definition is visible*, not merely whether the function is marked `inline`. Because `square`'s full body is written directly in `math.h`, the preprocessor textually pastes that definition into `caller.cpp` before compilation even begins — by the time the compiler's front end runs, `caller.cpp`'s translation unit genuinely contains `square`'s complete definition, so ordinary single-TU optimization can inline it with no need for cross-TU visibility or LTO at all. The `inline` keyword's ODR-exemption role (see the inlining-basics question) is what makes this pattern legal in the first place — without it, `square`'s definition appearing identically in every TU that includes `math.h` would be an ODR violation at link time. This is exactly why performance-critical small functions are conventionally defined directly in headers (or as class member functions, which are implicitly `inline`): it guarantees inlining opportunity without depending on LTO being enabled.",
  },
  {
    id: "compilers-name-mangling-01",
    category: "compilers",
    difficulty: "medium",
    title: "Why C and C++ can't link without extern \"C\"",
    tags: ["name-mangling", "linkage", "extern-c"],
    type: "trace",
    prompt:
      "A C++ file declares `void process(int x);` and tries to link against a C library's compiled object file that exports a symbol literally named `process`. Without an extern \"C\" declaration, does the link succeed?",
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
        "Yes — function names are stored identically by both C and C++ compilers, so the linker matches them directly",
        "No — the linker fails with an undefined reference. The C++ compiler mangles process(int) into a decorated symbol name encoding the function's scope/namespace and its parameter types (e.g. something like _Z7processi), while the C object file exports the plain unmangled symbol process; the linker is looking for the mangled name and never finds a matching definition. Declaring it extern \"C\" tells the C++ compiler to use C linkage (no mangling) for that declaration, which fixes the link",
        "Yes, but only because modern linkers automatically demangle C++ symbols before matching against C libraries",
        "No — this is actually a compile-time error in caller.cpp, not a link error",
      ],
      correctIndex: 1,
    },
    explanation:
      "C has no function overloading, so a C compiler can emit the symbol table entry for a function using its plain source name (`process`) with no additional encoding. C++ supports overloading, namespaces, templates, and more, so a C++ compiler must encode enough information into the linker-visible symbol name to distinguish, say, `process(int)` from `process(double)` or `ns::process(int)` — this encoding is *name mangling*, and it typically captures the function's (possibly namespace-/class-qualified) name, its parameter types, and (for templates) the template arguments, using a scheme like the Itanium C++ ABI's (e.g. `_Z7processi` for a global `process(int)`). Because the C object file's symbol table has the plain name `process` and the C++ translation unit is looking for the mangled name, the linker cannot resolve the reference and fails with an undefined-reference/unresolved-external-symbol error. `extern \"C\"` instructs the C++ compiler to give that specific declaration C linkage — meaning no mangling, and no overloading permitted for it — so the emitted/expected symbol name becomes the plain `process`, matching the C library and letting the link succeed.",
    references: ["https://en.cppreference.com/w/cpp/language/language_linkage"],
  },
  {
    id: "compilers-odr-01",
    category: "compilers",
    difficulty: "medium",
    title: "static internal linkage avoids an ODR conflict across TUs",
    tags: ["odr", "linkage", "static"],
    type: "trace",
    prompt:
      "Two translation units each define a function named helper with different bodies, both marked static. Does linking a.o and b.o (plus a main() elsewhere) succeed?",
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
        "Link error: helper is defined twice across a.o and b.o with conflicting bodies",
        "Links successfully. static at namespace scope gives helper internal linkage in each TU, meaning each TU's helper is a private symbol not visible to, or conflicting with, any other TU's symbol table entry — a.o's helper and b.o's helper are entirely distinct entities that merely happen to share a source-level name, and the ODR (which governs entities with external linkage/visible across TUs) is not violated",
        "Compile error at the point b.cpp is compiled, because helper was already declared static in a.cpp",
        "Links, but calling callFromA and callFromB produces the same result because the linker merges identical-looking function signatures",
      ],
      correctIndex: 1,
    },
    explanation:
      "`static` at namespace scope gives a function or variable *internal linkage* ([basic.link]) — its name is not exposed to the linker's global symbol table at all; each translation unit gets its own private, unrelated entity. Since `a.cpp`'s `helper` and `b.cpp`'s `helper` never actually collide at the linker level (they're not even candidates for the same symbol), there's no multiple-definition error, and the One Definition Rule — which is a constraint on entities with external linkage having identical definitions across TUs, or a single definition of internal-linkage entities per TU — is fully satisfied here since each TU has exactly one definition of its own private `helper`. `callFromA` correctly calls `a.cpp`'s version (returning `x+1`) and `callFromB` correctly calls `b.cpp`'s version (returning `x*2`) — this is precisely the mechanism used to give translation-unit-private helper functions distinct names without polluting the global namespace or risking collisions with other TUs' or libraries' same-named helpers.",
    references: ["https://en.cppreference.com/w/cpp/language/storage_duration"],
  },
  {
    id: "compilers-odr-02",
    category: "compilers",
    difficulty: "hard",
    title: "An unenforced ODR violation (IFNDR) across translation units",
    tags: ["odr", "ifndr", "linkage", "undefined-behavior"],
    type: "trace",
    prompt:
      "Two translation units each define the same external-linkage inline function with genuinely different bodies, then link into one program. What is the standard's verdict, and what do real linkers typically do?",
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
        "The compiler is required to diagnose this at compile time, since it's a straightforward syntax difference",
        "This is a genuine ODR violation, but the standard does not require a diagnostic for it (an 'ill-formed, no diagnostic required' — IFNDR — case), since detecting it requires whole-program cross-TU analysis most compilers don't perform by default; both a.o and b.o compile and link cleanly with no error or warning, but the program's behavior is undefined — in practice the linker silently picks one definition of scale (often whichever object file it processes first, or per its own tie-breaking rule) and both TUs' calls to scale end up using that single chosen definition, potentially silently giving a.cpp's caller the *wrong* (b.cpp's) multiplier or vice versa",
        "The linker always detects and rejects this at link time with a multiple-definition error, just like it would for two non-inline external functions with the same name",
        "Both definitions coexist independently at runtime and each TU calls its own version correctly, similar to the static case",
      ],
      correctIndex: 1,
    },
    explanation:
      "`inline` functions are required by the ODR to have an identical definition ('token-for-token', informally) in every translation unit that defines them, precisely because the ODR's exemption for `inline` entities assumes the compiler/linker may pick any one of the (supposedly identical) definitions and discard the rest, without runtime consequence. Here, `a.cpp` and `b.cpp` genuinely disagree on `scale`'s body — a real ODR violation. But per [basic.def.odr], this specific flavor of violation is classified as *ill-formed, no diagnostic required* (IFNDR): the standard doesn't mandate that any implementation detect it, because doing so in general requires comparing function bodies across separately-compiled translation units, which ordinary (non-LTO) compilation pipelines don't do. In practice, both object files compile without error, the linker (following the usual 'weak'/COMDAT symbol-merging rules used for inline functions and templates) picks exactly one definition of `scale` to keep — typically the first one it encounters, though this is unspecified and toolchain-dependent — and every call site in the final binary, regardless of which TU it came from, ends up invoking that single chosen definition. This means `a.cpp`'s code can silently end up calling `b.cpp`'s `scale` (or vice versa) with no compiler or linker warning at all, which is exactly the kind of stale-header/ODR-mismatch bug that's notoriously difficult to diagnose in large multi-library C++ builds.",
    references: ["https://en.cppreference.com/w/cpp/language/definition"],
  },
  {
    id: "compilers-devirt-01",
    category: "compilers",
    difficulty: "hard",
    title: "Devirtualization of a call through a concrete local object",
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
    Dog obj;         // concrete, local, statically-typed object — not through a pointer/reference
    obj.speak();      // (1)
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes — any call to a virtual function always goes through the vtable, unconditionally, by design of the virtual dispatch mechanism",
        "No — since obj is a local variable of the concrete, statically-known type Dog (not accessed through a Animal* / Animal& that could point to some other derived class at runtime), the compiler can prove the dynamic type is exactly Dog at (1) and devirtualize the call into a direct, non-virtual call to Dog::speak(), skipping the vtable load and indirect call entirely — a legal application of the as-if rule since the observable result is identical",
        "Compile error: you cannot call a virtual function directly on a stack object, only through a pointer or reference",
        "It goes through the vtable only in debug builds; in release builds virtual functions are always converted to non-virtual by the language standard itself",
      ],
      correctIndex: 1,
    },
    explanation:
      "Virtual dispatch exists to resolve which override to call when the *static* type at the call site might not match the *dynamic* type (e.g. calling through a `Animal*` that could actually point to a `Dog`, `Cat`, or any other derived class at runtime). Here, `obj` is declared directly as a `Dog` local variable — its dynamic type is provably, statically `Dog` with 100% certainty (no pointer/reference indirection, no possibility of a different derived class, and no way for `obj`'s vptr to have been altered to point to a different class's vtable, since it was never exposed as a base-class reference to code that could do that). Because the compiler can prove the exact dynamic type at the call site, it can perform devirtualization: replace the indirect (vtable-load-then-call-through-pointer) call with a direct call to `Dog::speak()`, which is both faster (no memory indirection, and now inlinable) and produces identical observable behavior, making it a legal as-if-rule transformation. This is a common, real optimization performed by GCC and Clang at -O2/-O3, and is also commonly enabled by declaring a class or method `final`, which gives the compiler the same 'no further overriding possible' guarantee even through pointers/references.",
  },
  {
    id: "compilers-devirt-02",
    category: "compilers",
    difficulty: "medium",
    title: "final enables devirtualization through a pointer",
    tags: ["devirtualization", "final", "virtual-functions"],
    type: "trace",
    prompt:
      "Given Dog is marked final, does a call through an Animal* known to point to a Dog get devirtualized, even though it's accessed via a base-class pointer?",
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
    Animal* a = d;    // upcast to base pointer
    a->speak();        // (1) — called through a base-class pointer
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No — calling through an Animal* always requires the vtable lookup regardless of any final annotation, since the compiler only looks at the static type of the pointer",
        "Yes — the compiler can still prove the dynamic type at (1). Since d is a Dog*, a is known to point to an object whose dynamic type is Dog; and because Dog is marked final, no further class can derive from (and override speak() in) Dog, so Dog::speak() is guaranteed to be the actual override in play. This lets the optimizer devirtualize a->speak() into a direct call despite the base-class pointer indirection",
        "It depends only on whether Animal::speak() is also marked final, not Dog",
        "Compile error: cannot upcast a pointer to a class marked final",
      ],
      correctIndex: 1,
    },
    explanation:
      "Devirtualization doesn't strictly require the object to be a bare local variable — it only requires the compiler to be able to *prove* the dynamic type at the call site through whatever means available. Here, `a` is initialized directly from `d`, a `Dog*`, so the compiler can track that `a` points to an object whose dynamic type is `Dog` (this kind of local points-to/type tracking is standard in modern optimizers). Ordinarily that alone wouldn't be enough to devirtualize `a->speak()`, because even knowing the dynamic type is exactly `Dog`, a further-derived class could in principle override `speak()` again... except `Dog` is marked `final`, which is a language-level guarantee that no class can ever derive from it. Combining 'dynamic type is exactly Dog' with 'Dog cannot be further derived from' lets the compiler conclude with certainty that `Dog::speak()` is the function that will run, and it can emit a direct call instead of an indirect vtable dispatch — this is precisely why marking leaf classes (or individual override methods) `final` is a recommended micro-optimization in performance-sensitive polymorphic C++ code.",
    references: ["https://en.cppreference.com/w/cpp/language/final"],
  },
  {
    id: "compilers-escape-analysis-01",
    category: "compilers",
    difficulty: "hard",
    title: "Escape analysis and stack allocation of a non-escaping heap object",
    tags: ["escape-analysis", "heap-allocation", "optimizer"],
    type: "trace",
    prompt:
      "point never leaves makePoint's scope (it's not returned, stored globally, or passed anywhere it could be observed after the function returns) — it's only read from immediately and then discarded. In a typical AOT (ahead-of-time) C++ compiler like GCC/Clang at -O2, is the new-allocation here likely to be eliminated and replaced with a stack allocation?",
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
        "Yes — every mainstream AOT C++ compiler performs escape analysis and routinely promotes any provably-non-escaping new/delete pair to a stack allocation, exactly as JIT compilers like the JVM's C2 or a JavaScript JIT commonly do",
        "It's target/optimizer-dependent and much less reliable than in a JIT: mainstream AOT C++ compilers (GCC, Clang) don't perform general heap-to-stack promotion of new/delete as a standard optimization the way tracing/method JITs with profile-guided escape analysis do; some restricted patterns may be recognized (e.g. Clang's more limited allocation elision in specific cases), but you should not assume the new[]/delete[] pair here gets eliminated — the safer mental model is that in AOT C++, if you want stack allocation, allocate on the stack explicitly (e.g. std::array or a plain array) rather than relying on the optimizer to infer it from a non-escaping new",
        "No compiler, JIT or AOT, can ever eliminate a heap allocation because delete has an observable side effect (calling the deallocation function) that must always execute",
        "It's guaranteed by the C++ standard as a required optimization whenever an allocation's lifetime is provably confined to a single function",
      ],
      correctIndex: 1,
    },
    explanation:
      "Escape analysis — determining that an allocated object's lifetime and visibility never extend beyond the allocating function/thread — is a real and well-established optimization technique, but its application to eliminating heap allocations in favor of stack allocation is most strongly associated with managed-runtime JIT compilers (the JVM's C2/Graal, V8, etc.), which have the luxury of profiling, deoptimization, and a runtime that can always fall back to a real heap allocation if their static analysis was wrong. Mainstream AOT C++ compilers (GCC, Clang) do perform various interprocedural analyses and *can* in some narrow, specific patterns elide allocations (e.g. Clang has some allocation-elision capability, and both compilers can eliminate a matched `new`/`delete` pair with no intervening use in trivial cases), but there is no general guarantee that a `new[]`/`delete[]` pair like this gets promoted to a stack allocation the way a JIT's escape analysis would. `operator new`/`operator delete` calls are also, by default, real (possibly user-replaceable/overridable) function calls with observable side effects from the abstract machine's perspective, which further constrains when eliminating them is even legal under the as-if rule. The practical, portable answer for C++ is: don't rely on the optimizer inferring stack allocation from a non-escaping heap allocation — allocate on the stack explicitly if that's what you want.",
  },
  {
    id: "compilers-pgo-01",
    category: "compilers",
    difficulty: "medium",
    title: "Profile-guided optimization changes an inlining decision",
    tags: ["pgo", "inlining", "profiling"],
    type: "trace",
    prompt:
      "fastPath and slowPath are both moderately large functions called from dispatch based on a runtime condition that is, in the actual production workload, true about 99.9% of the time (though the compiler has no way to know that from the source alone). Contrast a normal -O2 build with a PGO build (profile collected from representative production traffic, then fed back into a second compilation pass). What's the key difference in how dispatch gets compiled?",
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
        "There's no difference — PGO only affects which functions get vectorized, not inlining decisions",
        "Without profile data, the compiler's inliner treats both branches as equally likely and makes an inlining decision using static heuristics alone (which may inline neither, or make an arbitrary choice, since both are borderline-cost); with PGO, the compiler sees from actual branch-frequency counters that the condition==true path executes ~99.9% of the time, so it can bias its cost/benefit inlining heuristic toward inlining fastPath (the hot path) more aggressively while leaving slowPath (the cold path) uninlined and even relocated to a separate, colder region of the binary to improve icache locality for the hot path",
        "PGO always inlines every call site regardless of branch frequency, since it removes all heuristic cost limits",
        "PGO can only affect loop unrolling, never function inlining decisions",
      ],
      correctIndex: 1,
    },
    explanation:
      "Without profiling data, the compiler's inlining heuristic has to guess: it typically assumes some default static branch probability (or treats both arms as equally likely) and evaluates each candidate call site's cost/benefit using only statically-derivable information (function size, call frequency estimated purely from control-flow structure, e.g. assuming loop bodies are 'hot' by nature of being loops) — for two borderline-cost functions in an if/else with no other information, it might inline neither, or make a choice that happens not to match the real workload. Profile-guided optimization closes this gap: an instrumented (or sampling) build is run against representative input, recording actual branch-taken frequencies, and that data is fed back into a second compilation pass. With real counters showing `condition` is true 99.9% of the time, the compiler's inliner can strongly prioritize inlining `fastPath` (since it's now known to dominate runtime call volume, the traditional call overhead savings from inlining apply to nearly every execution) while treating `slowPath` as cold — commonly also physically relocating cold code to a separate section of the binary (`.text.unlikely`-style splitting) so the hot path's instructions stay densely packed for better instruction-cache utilization. This is the core value proposition of PGO: better decisions from real branch-frequency data than static heuristics can infer from source structure alone.",
    references: ["https://clang.llvm.org/docs/UsersManual.html#profile-guided-optimization"],
  },
  {
    id: "compilers-seq-points-01",
    category: "compilers",
    difficulty: "hard",
    title: "i = i++ + ++i is undefined behavior, not just unspecified order",
    tags: ["sequence-points", "undefined-behavior", "evaluation-order"],
    type: "trace",
    prompt:
      "Even compiled under C++17 or later (which tightened some evaluation-order rules), what does this statement do?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

int main() {
    int i = 5;
    i = i++ + ++i;
    std::cout << i << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "C++17 fixed evaluation order for compound expressions, so this is now guaranteed to produce a specific, portable value (e.g. 13) on all conforming compilers",
        "This remains undefined behavior even in C++17 and later: i is modified by i++ and again by ++i with no sequence point separating those two side effects relative to each other (C++17's evaluation-order guarantees address the order of evaluation of certain operator operands — e.g. for built-in assignment and most operators, the right operand is now sequenced before the left — but they do NOT introduce a sequencing relationship between the two unsequenced side-effecting subexpressions i++ and ++i here, and the outer assignment to i overlapping with reads used to compute its own right-hand side compounds the problem); the value is unpredictable and toolchain/version-dependent, and compilers are free to do anything, not merely pick one of several 'reasonable' orderings",
        "It's unspecified behavior (not undefined) — the standard guarantees one of a small number of legal answers, such as 13 or 14, depending on evaluation order, and a conforming compiler must pick consistently for a given expression shape",
        "Compile error: i cannot be modified more than once in a single expression",
      ],
      correctIndex: 1,
    },
    explanation:
      "Prior to C++17, evaluating `i++ + ++i` had two problems that both fall under 'undefined behavior' per [intro.execution]: the order of evaluation of the two operands of `+` was unspecified, AND (independently, more importantly) `i` was modified twice (once by `i++`, once by `++i`) without a sequence point ordering those two modifications relative to each other — the classic 'a scalar object shall have its stored value modified at most once by the evaluation of an expression, otherwise the behavior is undefined' rule. C++17 ([intro.execution]p10 revisions, informally 'P0145') tightened evaluation-order rules for specific cases — notably, for the built-in assignment operator, the right-hand operand is now sequenced before the left-hand operand, and for many binary operators general left-to-right sequencing between operands was clarified — but critically, this did NOT retroactively impose an ordering between the *unsequenced* side effects of `i++` and `++i` as operands of `+` here (`+` is not one of the operators C++17 added sequencing guarantees for), nor does it change the fundamental 'modified twice without an intervening sequence point' rule that already made this UB. So the entire statement remains undefined behavior in C++17/20/23 exactly as in C++11/14 — a very commonly-misunderstood point, since people often (incorrectly) believe P0145 'fixed' expressions like this.",
    references: [
      "https://en.cppreference.com/w/cpp/language/eval_order",
      "https://wg21.link/p0145",
    ],
  },
  {
    id: "compilers-o2-vs-o3-01",
    category: "compilers",
    difficulty: "medium",
    title: "-O3 can produce slower code than -O2",
    tags: ["optimization-levels", "vectorization", "code-bloat"],
    type: "trace",
    prompt:
      "Which statement about the relationship between -O2 and -O3 (GCC/Clang) is accurate?",
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
        "-O3 is a strict superset of -O2's optimizations and is mathematically guaranteed to produce code that runs at least as fast, for any input program, on any hardware",
        "-O3 enables additional, more aggressive optimizations beyond -O2 — notably more aggressive auto-vectorization, function inlining thresholds, and loop unrolling — which can improve throughput-bound, loop-heavy numerical code, but these same transformations increase code size (unrolled/vectorized loop bodies, more inlined call sites); for code with many small hot functions and tight instruction-cache constraints, that code bloat can cause more icache/iTLB misses and net out slower than -O2, so -O3 is not a strictly-dominant choice and should be benchmarked, not assumed superior",
        "-O3 only affects debug info generation and has no effect on runtime performance versus -O2",
        "-O3 is identical to -O2 on all modern compilers; the distinction was removed after GCC 4.x",
      ],
      correctIndex: 1,
    },
    explanation:
      "`-O3` layers additional optimization passes on top of `-O2` — most notably more aggressive auto-vectorization (attempting to vectorize loops -O2 considers too risky/costly), higher inlining thresholds, and more aggressive loop unrolling — all generally aimed at maximizing throughput for compute-bound, loop-heavy code (numerical kernels, tight math loops) where the tradeoff of larger code for fewer iterations/instructions is clearly favorable. But none of these transformations are free: unrolled and vectorized loop bodies are larger, and more aggressive inlining means more call sites get expanded in place — both increase the static code size (code bloat). For a program dominated by many small, frequently-invoked functions across a large codebase, larger generated code can mean the hot working set of instructions no longer fits as cleanly in the L1 instruction cache (or iTLB reach), causing more cache/TLB misses that can outweigh whatever per-loop-iteration gains -O3's transformations bought — a well-documented, real-world phenomenon, which is precisely why performance engineers benchmark -O2 vs -O3 empirically per-workload rather than assuming -O3 is strictly better, and why some latency-sensitive/branch-heavy server codebases (as opposed to numerical/scientific codebases) are routinely built at -O2.",
  },
  {
    id: "compilers-copy-elision-01",
    category: "compilers",
    difficulty: "medium",
    title: "Mandatory prvalue elision vs. discretionary NRVO, precisely distinguished",
    tags: ["copy-elision", "rvo", "nrvo"],
    type: "trace",
    prompt:
      "Compiled as C++17, which of these two functions' copy/move-elision behavior is a language guarantee the standard requires, versus merely an optimization a conforming compiler is permitted (but not required) to perform?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Widget { Widget(); Widget(const Widget&); Widget(Widget&&); };

Widget makeA() {
    return Widget();       // (A) returns a prvalue directly
}

Widget makeB() {
    Widget w;               // (B) returns a named local
    return w;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both (A) and (B) are guaranteed elision under C++17 — the standard made all copy elision mandatory in C++17, full stop",
        "Neither is guaranteed — C++17 did not change anything about copy elision, both remain purely discretionary 'as-if' optimizations exactly as in C++11/14",
        "(A) is mandatory elision under C++17: Widget() is a prvalue directly initializing the return object, so per [class.copy.elision]/[dcl.init] the language now requires the prvalue be constructed directly into the caller's result object with zero copy/move constructor calls (Widget need not even be copyable/movable for this to compile). (B) remains NRVO — discretionary even in C++17: w is a named local, and the standard only ever permits (never requires) eliding its copy/move into the return slot; a conforming compiler may legally call the move constructor instead",
        "(A) remains discretionary and (B) is the one made mandatory in C++17 — it's the reverse of common assumption",
      ],
      correctIndex: 2,
    },
    explanation:
      "This is the single most commonly conflated distinction in copy-elision discussions. C++17's 'guaranteed copy elision' changes are narrowly about *prvalues*: [dcl.init] was reworded so that when a prvalue (like the temporary produced by `Widget()`) directly initializes an object of the same type (here, the return slot of `makeA`, via the caller-allocated-result-object mechanism), no temporary materialization or copy/move constructor call happens at all — construction happens directly in the destination storage. This is why `makeA` compiles and works even if `Widget`'s copy and move constructors were both deleted; there is genuinely no copy/move constructor call to elide, by the language's own construction rules. Named Return Value Optimization (`makeB`, returning the named local `w`) is an entirely different, older provision ([class.copy.elision]) that the C++17 changes explicitly left untouched: eliding the copy/move of a named object being returned remains something the standard *permits* an implementation to do, never something it *requires* — a conforming compiler can legally emit a real move-constructor call for `return w;` (and if elision doesn't happen, `Widget` must actually have an accessible move or copy constructor for the code to even compile, unlike the prvalue case). This is why interview questions and code reviews should be precise about which of the two 'copy elision' phenomena a given piece of code is actually relying on.",
    references: ["https://en.cppreference.com/w/cpp/language/copy_elision"],
  },
  {
    id: "compilers-behavior-classification-01",
    category: "compilers",
    difficulty: "hard",
    title: "Classifying implementation-defined, unspecified, and undefined behavior",
    tags: ["undefined-behavior", "unspecified-behavior", "implementation-defined"],
    type: "trace",
    prompt:
      "Four behaviors are listed below, drawn from this program. Which option correctly classifies all four according to the C++17 standard's terminology?\n\n(1) sizeof(int) being 4 on this platform\n(2) the order in which f(a(), b()) evaluates a() and b() relative to each other\n(3) signed integer overflow in `INT_MAX + 1`\n(4) the numeric value produced by right-shifting a negative signed integer, e.g. `-8 >> 1`, prior to C++20",
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
        "(1) implementation-defined, (2) unspecified, (3) undefined behavior, (4) implementation-defined (pre-C++20)",
        "(1) undefined, (2) implementation-defined, (3) unspecified, (4) undefined",
        "All four are undefined behavior, since none of them are portable across platforms/compilers",
        "(1) unspecified, (2) unspecified, (3) undefined, (4) unspecified",
      ],
      correctIndex: 0,
    },
    explanation:
      "These three categories are precisely defined and worth keeping straight. Implementation-defined behavior is behavior that varies by implementation but each implementation must document/pick one consistent, defined answer: `sizeof(int)` isn't fixed by the standard (it only guarantees `sizeof(int) >= sizeof(short)` and minimum range requirements), but a given compiler/ABI always reports the same value (4 on essentially every mainstream 32/64-bit platform) — that's (1). Right-shift of a negative signed integer, prior to C++20, was also implementation-defined (the standard permitted either an arithmetic or logical shift, but required the implementation to behave consistently and document which) — that's (4); C++20 standardized it to be arithmetic-shift-defined (sign-extending), removing the implementation-defined status going forward, which is why the question specifies 'pre-C++20'. Unspecified behavior is behavior where the standard allows a set of possible results without requiring the implementation to document which it picked, and it may even vary call to call: the order of evaluation of function arguments — `a()` vs `b()` in `f(a(), b())` — is unspecified in C++17 (each is guaranteed to run to completion without interleaving relative to the other, but which one runs *first* is left unspecified, notably different from the sequence-point UB case of modifying the same variable twice) — that's (2). Undefined behavior is behavior for which the standard imposes no requirements whatsoever, and a conforming implementation may do anything, including appearing to work, crashing, or being 'optimized around' by the compiler: signed integer overflow (`INT_MAX + 1`) is UB per [expr.pre], unlike unsigned overflow which is well-defined modular wraparound — that's (3).",
    references: [
      "https://en.cppreference.com/w/cpp/language/ub",
      "https://en.cppreference.com/w/cpp/language/eval_order",
    ],
  },
  {
    id: "compilers-alias-optimization-01",
    category: "compilers",
    difficulty: "hard",
    title: "restrict-qualified parameters unlock a redundant-load elimination",
    tags: ["restrict", "aliasing", "optimizer", "load-elimination"],
    type: "trace",
    prompt:
      "Compare these two otherwise-identical functions differing only in whether out is __restrict-qualified. At -O2, does the compiler need to re-read *in after the store to *out in each?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// (A) no restrict
void bump(int* in, int* out) {
    *out = *in + 1;
    *out = *in + 2;   // does the compiler need to reload *in here?
}

// (B) restrict
void bumpR(int* __restrict in, int* __restrict out) {
    *out = *in + 1;
    *out = *in + 2;   // does the compiler need to reload *in here?
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both versions must reload *in for the second statement — restrict has no effect on load elimination, only on vectorization",
        "In (A), the compiler cannot assume out and in point to different objects, so the write *out = *in + 1 could, if out == in, change the very value the next statement reads through *in — it must conservatively re-read *in from memory for the second statement. In (B), __restrict is a promise from the programmer that in and out do not alias, so the compiler can prove the first store can't affect what *in reads, and it can reuse the already-loaded value of *in from the first statement instead of re-reading memory, eliminating a redundant load",
        "Both versions can safely reuse the first load of *in, since the two statements are in the same function and *out is a different lvalue expression than *in syntactically",
        "Compile error: __restrict cannot be applied to a plain (non-array, non-pointer-to-const) int* parameter",
      ],
      correctIndex: 1,
    },
    explanation:
      "This is the same fundamental aliasing-uncertainty problem as the vectorization and CSE questions, applied to load/store elimination rather than SIMD widening. In version (A), `in` and `out` are ordinary pointers with no non-aliasing guarantee, so the compiler must consider the possibility that a caller passed `in == out` (pointing at the same `int`). Under that assumption, the first statement's write `*out = *in + 1` actually overwrites the very memory that `*in` refers to, so the second statement's `*in` must be re-read from memory (it cannot reuse the value loaded for the first statement) to get correct behavior in the aliasing case — this forces a genuine reload instruction in the generated code. In version (B), `__restrict` on both `in` and `out` is the programmer's contractual promise to the compiler that, for the lifetime of this function call, no other pointer (specifically here, `out` relative to `in`) will be used to access the same object — violating that promise is undefined behavior on the caller's part, but given the promise, the compiler can safely prove the store through `out` cannot alter what `*in` denotes, so it's free to keep the first load's value in a register and reuse it directly for the second statement, eliminating a redundant memory read. This is a concrete, common example of `restrict`/`__restrict` unlocking optimizations beyond just vectorization.",
    references: ["https://en.cppreference.com/w/c/language/restrict"],
  },
];
