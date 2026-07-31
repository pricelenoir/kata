import type { TraceQuestion } from "@/types/question";

export const computerArchitectureQuestions: TraceQuestion[] = [
  {
    id: "computer-architecture-pipeline-structural-hazard-01",
    category: "computer-architecture",
    difficulty: "easy",
    title: "Instruction fetch and a load in the same cycle on a unified memory",
    tags: ["pipelining", "structural-hazard"],
    type: "trace",
    prompt:
      "A classic 5-stage in-order pipeline (IF, ID, EX, MEM, WB) uses a single unified memory " +
      "with exactly one access port shared by both instruction fetch and data-memory access " +
      "(no separate instruction/data caches). In some cycle, instruction I is in its MEM stage " +
      "performing a load, while instruction I+3 is simultaneously trying to use IF to fetch the " +
      "next instruction. What happens?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "A data hazard: I+3 stalls until a RAW dependency on I resolves",
        "A control hazard: fetch is blocked until the older instruction clears MEM",
        "A structural hazard: IF stalls one cycle while I's MEM access holds the only port",
        "No stall: the memory arbiter services both requests within the same cycle",
      ],
      correctIndex: 2,
    },
    explanation:
      "A structural hazard occurs when two instructions in different pipeline stages need the " +
      "same physical hardware resource in the same cycle, independent of any data or control " +
      "dependency between them. Here that resource is a single-ported unified memory. I's MEM " +
      "access and I+3's IF access are logically unrelated (no register or branch dependency " +
      "links them), yet the pipeline must still insert a bubble because the hardware cannot " +
      "service both requests in one cycle. Real designs split instruction and data caches " +
      "(Harvard-style at the L1) even in machines with a unified, von Neumann memory model " +
      "further out, precisely to eliminate this class of hazard for the common case of " +
      "overlapping fetch and memory-stage accesses. Other structural hazards arise from a " +
      "single non-pipelined multiplier/divider unit, or a register file with too few write " +
      "ports for the number of instructions retiring per cycle.",
  },
  {
    id: "computer-architecture-pipeline-raw-forwarding-02",
    category: "computer-architecture",
    difficulty: "easy",
    title: "Counting bubbles between an ADD and its consumer",
    tags: ["pipelining", "data-hazard", "forwarding"],
    type: "trace",
    prompt:
      "In a classic 5-stage pipeline with full forwarding (bypass paths from the EX/MEM and " +
      "MEM/WB pipeline latches directly into the ALU's input muxes), how many stall cycles are " +
      "required to correctly execute this back-to-back register dependency?",
    snippet: {
      language: "text",
      code: `ADD R1, R2, R3   ; R1 = R2 + R3
SUB R4, R1, R5   ; R4 = R1 - R5  (needs R1 the very next instruction)`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "0 stall cycles",
        "1 stall cycle",
        "2 stall cycles",
        "3 stall cycles",
      ],
      correctIndex: 0,
    },
    explanation:
      "Without forwarding, SUB would have to stall until ADD's WB stage writes R1 back to the " +
      "register file, since SUB's ID stage (where operands are normally read) happens before " +
      "that write completes. That is the classic RAW hazard, and it is where the 1-cycle and " +
      "2-cycle answers come from. Full forwarding adds a bypass that routes ADD's ALU output, " +
      "already latched in the EX/MEM pipeline register, straight into the ALU input mux for the " +
      "very next instruction's EX stage, so SUB gets the correct R1 exactly when it needs it " +
      "with zero bubbles. Forwarding is not restricted to loads; the EX/MEM-to-EX path exists " +
      "specifically for ALU-to-ALU dependencies. The one case forwarding cannot fully cover is " +
      "a load immediately followed by a dependent instruction (the load-use hazard), because a " +
      "loaded value is not available until the end of MEM, one stage later than an ALU result, " +
      "which costs an unavoidable single bubble.",
  },
  {
    id: "computer-architecture-pipeline-control-hazard-03",
    category: "computer-architecture",
    difficulty: "medium",
    title: "A taken branch under a predict-not-taken policy",
    tags: ["pipelining", "control-hazard", "branch"],
    type: "trace",
    prompt:
      "A 5-stage in-order pipeline (IF, ID, EX, MEM, WB) resolves conditional branches at the " +
      "end of EX (the 3rd stage) and uses a simple predict-not-taken policy with no BTB. A " +
      "branch is fetched, and the two instructions immediately behind it in program order are " +
      "fetched speculatively (as fall-through) while the branch is still working its way through " +
      "the pipeline. The branch turns out to be taken. How many fetched instructions must be " +
      "squashed?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Zero: predict-not-taken defers fetch instead of squashing",
        "One: only the instruction currently in ID",
        "Two: the instructions currently in ID and IF",
        "Four: every stage behind the branch is flushed",
      ],
      correctIndex: 2,
    },
    explanation:
      "The flush depth for a mispredicted branch equals the number of pipeline stages between " +
      "fetch and branch resolution, minus one. Here the branch resolves at the end of EX (stage " +
      "3), so by that cycle two more instructions have already been fetched behind it, one " +
      "sitting in ID and one in IF, both fetched under the wrong assumption. Once the branch " +
      "resolves as taken, both are squashed and fetch restarts at the target, costing a 2-cycle " +
      "bubble. Nothing older than the branch is affected, so a full 4-stage flush is wrong. Real " +
      "designs attack this either by resolving branches earlier (in ID, with dedicated compare " +
      "and forwarding hardware, cutting the penalty to one bubble) or, far more effectively on " +
      "modern cores, by predicting outcome and target ahead of time with a branch predictor and " +
      "BTB so the common case costs nothing.",
  },
  {
    id: "computer-architecture-branch-btb-indirect-04",
    category: "computer-architecture",
    difficulty: "hard",
    title: "BTB behavior for monomorphic vs. megamorphic virtual calls",
    tags: ["branch-prediction", "btb", "indirect-branch"],
    type: "trace",
    prompt:
      "A hot call site invokes a virtual function through a vtable pointer (an indirect branch " +
      "whose target address, not just its taken/not-taken outcome, must be predicted). Case A: " +
      "the call site is monomorphic, always resolving to the same concrete override at runtime. " +
      "Case B: the call site is megamorphic, alternating unpredictably among several different " +
      "concrete overrides across calls. What does the branch target buffer (BTB) do in each case?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both cases predict equally well, since the BTB records taken/not-taken outcomes rather " +
          "than target addresses",
        "Case A converges on one stable, correctly predicted target; case B keeps predicting " +
          "whichever target it saw last, so target mispredictions and front-end flushes are frequent",
        "The BTB entry is disabled once the hardware notices several distinct targets, and the " +
          "call site then stalls fetch until the target is computed",
        "Indirect branches are never allocated BTB entries at all; only direct conditional " +
          "branches are tracked there",
      ],
      correctIndex: 1,
    },
    explanation:
      "The BTB caches, per branch instruction address, the most recently or most commonly " +
      "observed target so the front end can redirect fetch before the branch is even decoded. A " +
      "monomorphic call site's target never changes, so its entry converges to near-perfect " +
      "accuracy and virtually every call is a free, zero-bubble jump. A megamorphic call site " +
      "defeats that: one BTB entry (or the small per-branch indirect-target history most designs " +
      "maintain, indexed by global branch history on modern cores) cannot represent several live " +
      "targets at once, so the prediction carried over from the last call is frequently wrong. " +
      "The misprediction is caught only when the real target is computed deep in the pipeline, " +
      "forcing a full speculative-state flush and refetch. That sensitivity is why " +
      "devirtualization, marking classes or methods final, and profile-guided monomorphization " +
      "are measurable optimizations on virtual-dispatch-heavy C++ and on interpreter dispatch " +
      "loops.",
    references: [
      "Intel 64 and IA-32 Architectures Optimization Reference Manual, front-end optimization chapter",
    ],
  },
  {
    id: "computer-architecture-branch-sorted-array-05",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Sorted vs. unsorted iteration through a branchy loop",
    tags: ["branch-prediction", "predictability"],
    type: "trace",
    prompt:
      "This loop runs over a large array of random 32-bit integers, and is timed twice: once with " +
      "`data` left in random order, once after `std::sort(data.begin(), data.end())` is called " +
      "first (the sort's own time is excluded, only the loop below is timed). The sorted run is " +
      "measurably faster, often by several times, despite doing the exact same arithmetic and " +
      "touching the same memory footprint in the same linear order either way. What's the " +
      "primary cause?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `long long sum = 0;
for (size_t i = 0; i < data.size(); ++i) {
    if (data[i] >= threshold) {
        sum += data[i];
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Better spatial locality: sorted data packs into fewer distinct cache lines per pass",
        "The stride prefetcher only engages on monotonically increasing values, so the sorted run " +
          "streams from L2 while the random run misses to DRAM",
        "Auto-vectorization applies only when the compiler can assume the input is monotonic",
        "Branch predictability: sorted input makes the comparison false for one long run and then " +
          "true for one long run, while random input mispredicts on roughly half the elements",
      ],
      correctIndex: 3,
    },
    explanation:
      "Both runs touch every element exactly once in the same unit-stride order, so footprint, " +
      "cache behavior, and total arithmetic are identical; sorting changes the sequence of branch " +
      "outcomes, nothing else. Prefetchers key off address patterns, not data values, so the " +
      "linear walk is prefetched equally well in both runs. On sorted data the condition is false " +
      "for every element below the threshold and true for every element at or above it, a single " +
      "transition across the whole array, which a two-level or TAGE-style predictor learns almost " +
      "perfectly after a short warm-up. On random data the outcome is effectively a coin flip, so " +
      "the predictor mispredicts roughly half the time, and on a deep out-of-order pipeline each " +
      "misprediction costs on the order of 15-20 cycles to squash wrong-path work and refill from " +
      "the correct target, dwarfing the branch's own cost. This is the canonical demonstration " +
      "that unpredictable data-dependent branches, rather than instruction count, often dominate " +
      "hot-loop performance.",
  },
  {
    id: "computer-architecture-rob-inorder-retirement-06",
    category: "computer-architecture",
    difficulty: "medium",
    title: "A 20-cycle divide ahead of two independent single-cycle adds",
    tags: ["out-of-order-execution", "rob", "precise-exceptions"],
    type: "trace",
    prompt:
      "An out-of-order superscalar core issues three independent instructions in program order: " +
      "I1 (a 20-cycle-latency integer divide), I2 and I3 (single-cycle adds with no dependency on " +
      "I1 or each other). The scheduler dispatches all three as soon as their operands are ready, " +
      "so I2 and I3 finish execution long before I1 does. What governs when I2's and I3's results " +
      "become visible to the rest of the machine (committed to architectural state)?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "They finish execution early but sit complete in their reorder buffer entries, retiring " +
          "only after I1 and every older instruction has retired",
        "They commit to architectural state the moment they finish executing, since the machine is " +
          "out of order end to end",
        "Their execution is held back until I1 completes, so that retirement order matches " +
          "execution order",
        "Their results are discarded when I1 stalls and recomputed once I1 retires, since the ROB " +
          "tracks order but not data",
      ],
      correctIndex: 0,
    },
    explanation:
      "Out-of-order execution and in-order retirement are separate mechanisms, and the ROB " +
      "decouples them. Every instruction is allocated a ROB entry in program order at dispatch, " +
      "executes whenever its operands and a functional unit are ready, and then marks its entry " +
      "complete. Retirement logic only ever commits entries from the head of the ROB, in strict " +
      "program order, a few per cycle, and only once they are marked complete. So I2 and I3 can " +
      "finish computing well before I1, but their results stay buffered, invisible to " +
      "architectural state, until I1 retires ahead of them. That is what makes exceptions precise " +
      "on an out-of-order core: if I1 faults (say, divide by zero), the core simply never retires " +
      "I1 or anything behind it, I2 and I3's already-computed results are dropped from the ROB, " +
      "and architectural state reflects everything up to I1 and nothing after, just as a naive " +
      "in-order machine would have produced.",
  },
  {
    id: "computer-architecture-speculative-execution-spectre-07",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Speculation past a trained bounds check with an out-of-bounds index",
    tags: ["speculative-execution", "spectre", "side-channel"],
    type: "trace",
    prompt:
      "The branch predictor has been trained (via many prior in-bounds calls) to predict `x < " +
      "array1_size` as taken. An attacker then calls this function with an out-of-bounds `x`. The " +
      "core speculatively executes past the branch before it's resolved: it computes " +
      "`array1[x]` (an out-of-bounds read) and uses that byte to index and load from `array2`, " +
      "all before discovering the branch was mispredicted and squashing the instructions. After " +
      "the misprediction is detected and architectural state is rolled back to what it would have " +
      "been had the branch gone the other way, what remains observable?",
    snippet: {
      language: "cpp",
      filename: "gadget.cpp",
      code: `if (x < array1_size) {
    y = array2[array1[x] * 4096];
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing: misprediction recovery reverts architectural and microarchitectural state alike, " +
          "including any lines the squashed loads brought in",
        "The out-of-bounds read faults the moment it executes, so the dependent load never issues " +
          "and no secret-dependent state is created",
        "The cache line that `array2[array1[x] * 4096]` maps to stays resident, and timing loads " +
          "against each candidate line recovers the out-of-bounds byte",
        "The secret byte remains in the physical register the squashed load wrote until that " +
          "register is reallocated, which is where the leak actually comes from",
      ],
      correctIndex: 2,
    },
    explanation:
      "Misprediction recovery only guarantees that architectural state, registers and committed " +
      "memory, ends up as if the wrong path had never executed. It says nothing about " +
      "microarchitectural state such as cache contents, which are never rolled back because doing " +
      "so would require tracking and reverting every fill a speculative instruction caused. Nor " +
      "does the fault help: a fault on a transient instruction is only reported at retirement, " +
      "and this transient instruction never retires, so execution of the dependent load is not " +
      "prevented. Physical registers are freed by the rename recovery and are not readable by the " +
      "attacker in any case. What survives is the fill: the speculative chain reads an " +
      "attacker-chosen out-of-bounds byte, scales it by 4096 so each possible value maps to a " +
      "distinct page and cache line, and issues a load that pulls exactly one of array2's lines " +
      "in. The attacker then times accesses to all 256 candidate lines and the fast one names the " +
      "secret. That is the core of Spectre v1: transient execution computes on data it should " +
      "never have touched, and a cache-timing side channel exfiltrates the result even though the " +
      "computation itself was undone.",
    references: [
      "Kocher et al., \"Spectre Attacks: Exploiting Speculative Execution\", IEEE S&P 2019",
    ],
  },
  {
    id: "computer-architecture-cache-hierarchy-latency-08",
    category: "computer-architecture",
    difficulty: "easy",
    title: "Typical access latencies from L1 through DRAM",
    tags: ["cache-hierarchy", "latency"],
    type: "trace",
    prompt:
      "A pointer is chased through progressively larger, uncached working sets so each access is " +
      "forced to hit in L1, then L2, then L3, then main memory (DRAM) respectively. Which ordering " +
      "of typical latencies (in core clock cycles, roughly, on a contemporary desktop/server core) " +
      "is closest to reality?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "L1 ~4-5 cycles, L2 ~12-20, L3 ~40-75, DRAM ~200-300+",
        "L1 ~50 cycles, L2 ~100, L3 ~150, DRAM ~200",
        "L1 ~4 cycles, L2 ~5, L3 ~7, DRAM ~200",
        "L1 ~4 cycles, L2 ~8, L3 ~1000, DRAM ~1200",
      ],
      correctIndex: 0,
    },
    explanation:
      "The hierarchy is built as a series of exponentially larger, exponentially slower levels to " +
      "hide the gap between core execution speed and DRAM. L1 is small (tens of KB), sits next to " +
      "the execution units, and is tuned for a load-to-use latency around 4-5 cycles. L2 is larger " +
      "(hundreds of KB to a few MB) and further away at roughly 12-20 cycles. L3 is shared, " +
      "several MB to tens of MB, reached over a ring or mesh interconnect, at roughly 40-75 " +
      "cycles. A genuine DRAM access must cross the memory controller and go through row " +
      "activation and column access off-chip, costing on the order of 200-300+ cycles, by far the " +
      "largest single jump. Exact numbers move with each generation and clock speed, but the " +
      "roughly 3-5x step between levels is stable, which is why working-set size relative to L2/L3 " +
      "capacity and access-pattern predictability dominate memory-bound code far more than " +
      "instruction count does.",
    references: [
      "Agner Fog, \"The microarchitecture of Intel, AMD and VIA CPUs\", cache latency tables",
    ],
  },
  {
    id: "computer-architecture-cache-inclusive-exclusive-09",
    category: "computer-architecture",
    difficulty: "hard",
    title: "L3 eviction of a line in a strictly inclusive hierarchy",
    tags: ["cache-hierarchy", "inclusion-policy"],
    type: "trace",
    prompt:
      "A core's L3 is strictly inclusive of its L1 and L2 (every line resident in L1 or L2 is " +
      "guaranteed to also be resident in L3). The core is actively, repeatedly hitting on a line " +
      "in its L1, so the line is genuinely hot. Meanwhile, unrelated activity from other cores " +
      "fills L3 to the point that this line's L3 set becomes full and, per the L3's own " +
      "replacement policy, this exact line is chosen for eviction from L3. What happens to the " +
      "line in the core's L1?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing: the levels track their contents independently, so the core keeps hitting on its " +
          "L1 copy",
        "The L3 replacement policy skips any line a private cache still holds, so a different " +
          "victim is chosen instead",
        "The line is written back from L1 into L3 and reinstalled there, so both copies stay valid",
        "The line is invalidated out of L1 and L2 as well, so the core's next access misses and " +
          "must refill from further out",
      ],
      correctIndex: 3,
    },
    explanation:
      "An inclusive hierarchy's defining invariant is that L3's contents are a superset of what " +
      "is cached in L1/L2. That invariant is what lets a coherence snoop check only L3, instead " +
      "of probing every core's private caches, to learn whether any core holds a line. " +
      "Maintaining it on an L3 eviction requires back-invalidation: the eviction is propagated " +
      "down to force the line out of any L1/L2 that holds it, even a core actively using it, " +
      "because otherwise a private cache would hold a line L3 no longer tracks and the " +
      "snoop-filtering property would silently break. L3 replacement policies are typically " +
      "hit-rate driven and, in the simplest implementations, unaware of which lines a private " +
      "cache is hot on, which is precisely why the pathology bites: pressure from unrelated cores " +
      "can knock a line out from under the core that is using it. Exclusive hierarchies (AMD's " +
      "historical designs, for example) avoid this specific problem by keeping a line in exactly " +
      "one level at a time, at the cost of an explicit transfer on every L2 eviction. Real " +
      "designs also soften the effect with hints from the private caches or non-inclusive, " +
      "non-exclusive policies, which is why inclusion victims are a tuning concern rather than a " +
      "constant catastrophe.",
  },
  {
    id: "computer-architecture-cache-associativity-thrash-10",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Striding down a column of a 1024x1024 matrix",
    tags: ["cache-associativity", "conflict-misses"],
    type: "trace",
    prompt:
      "`matrix` is `N x N` of `double` (8 bytes), with `N = 1024` (a power of two), so each row is " +
      "exactly 8192 bytes. The L1 data cache is 32 KB, 8-way set-associative with 64-byte lines " +
      "(so 64 sets), and the whole matrix fits comfortably inside the much larger shared L3. This " +
      "loop sums column-major, so the inner loop jumps a full row each iteration. What happens, " +
      "and why?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `double sum = 0;
for (int j = 0; j < N; ++j) {
    for (int i = 0; i < N; ++i) {
        sum += matrix[i][j];   // stride N*sizeof(double) = 8192 bytes between consecutive i
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No unusual effect: the working set fits in cache, so traversal order changes nothing",
        "Every inner-loop access maps to the same cache set, so with only 8 ways the stream " +
          "conflict-evicts itself and misses on nearly every access",
        "The memory controller collapses the column walk onto a single open DRAM row, halving " +
          "achievable bandwidth for the loop",
        "The stride prefetcher locks onto the 8192-byte stride and streams the column ahead of " +
          "demand, so throughput matches the row-major loop",
      ],
      correctIndex: 1,
    },
    explanation:
      "Which set an address maps to is decided by a fixed slice of its middle bits, between the " +
      "line-offset bits and the tag, so the set index repeats every (number of sets x line size) " +
      "bytes, which is the same quantity as (cache size / associativity). Here that period is 64 " +
      "sets x 64 bytes = 4096 bytes, and the 8192-byte row stride is an exact multiple of it, so " +
      "every `matrix[i][j]` for fixed j lands in one set. Only 8 lines fit there, so the 9th " +
      "distinct row evicts the 1st and the line is long gone by the time the loop wraps back to " +
      "it. The result is a conflict miss on essentially every access even though the whole matrix " +
      "fits in total capacity. Prefetching does not rescue it either: hardware stride prefetchers " +
      "on mainstream x86 do not prefetch across 4 KB page boundaries, and this stride is two " +
      "pages. The pathology is purely associativity-driven and would vanish on a fully associative " +
      "cache of the same size. The standard fix is padding each row to N+1 elements so the row " +
      "stride is no longer an exact alias of the set-indexing modulus, spreading accesses back " +
      "across all sets.",
  },
  {
    id: "computer-architecture-mesi-state-walkthrough-11",
    category: "computer-architecture",
    difficulty: "medium",
    title: "MESI states after two cores read a line and one then writes it",
    tags: ["cache-coherence", "mesi"],
    type: "trace",
    prompt:
      "Line X starts out in no cache (Invalid everywhere). Core A reads X (miss, brings it in). " +
      "Core B then also reads X (miss in B, but the line exists in A). Finally, Core A writes to " +
      "X. What are the MESI states of the line in Core A's and Core B's caches immediately after " +
      "Core A's write completes?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "A = Modified, B = Invalid",
        "A = Modified, B = Shared",
        "A = Shared, B = Shared",
        "A = Exclusive, B = Invalid",
      ],
      correctIndex: 0,
    },
    explanation:
      "After A's initial read the line is Exclusive in A, since no other cache holds it. When B " +
      "reads, a snoop finds A's copy, A downgrades to Shared, and B installs it Shared: any " +
      "number of clean readers, no writer. When A then writes, MESI's central invariant applies, " +
      "namely that a line may be Modified in at most one cache and must be Invalid in every " +
      "other. A therefore issues an invalidation first (a BusUpgr, since A already holds the " +
      "line; a BusRdX if it did not), every sharer including B transitions to Invalid, and only " +
      "then is A's write allowed to complete, leaving A Modified. Exclusive is wrong here " +
      "specifically because the line is now dirty relative to memory, which is exactly the " +
      "distinction between E and M. If B read X again afterward, A's Modified data would be " +
      "supplied by a cache-to-cache transfer (and, depending on protocol variant, written back to " +
      "memory at that point), leaving both caches Shared again.",
  },
  {
    id: "computer-architecture-memory-model-tso-arm-litmus-12",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Store-buffering litmus test on x86 with no fences",
    tags: ["memory-consistency", "tso", "weak-ordering", "litmus-test"],
    type: "trace",
    prompt:
      "Two hardware threads run raw machine code with no locks, atomics, or memory barriers of " +
      "any kind, just plain loads and stores. X and Y both start at 0. Thread 0 stores X=1, then " +
      "loads r1=Y. Thread 1 stores Y=1, then loads r2=X. Is the outcome r1==0 && r2==0 (each " +
      "thread's load reads the other thread's variable before that thread's store is globally " +
      "visible) actually observable on real x86 hardware, given that x86 uses the comparatively " +
      "strong TSO (total store order) memory model?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No: TSO forbids all four reorderings, so the outcome is possible only under a weak model " +
          "such as ARM's",
        "No: cache coherence makes a store globally visible the instant it executes, so no " +
          "coherent multiprocessor permits it",
        "Yes: TSO still permits a store to be reordered with a later load to a different address, " +
          "and forbidding it on x86 requires an MFENCE or a LOCK-prefixed instruction between them",
        "Yes on x86 only: ARM drains stores to the coherence point before any later load may " +
          "execute, which rules the outcome out there",
      ],
      correctIndex: 2,
    },
    explanation:
      "TSO gets described as strong relative to weak models, which invites the misconception that " +
      "it forbids essentially all reordering. Its precise definition forbids store-store, " +
      "load-load, and load-store reordering, while explicitly permitting store-load reordering to " +
      "different addresses. The mechanism is the store buffer: each core buffers its own stores " +
      "locally before they drain into the coherent cache hierarchy, and the core's own later " +
      "loads may bypass those undrained stores and complete against cache directly. That is " +
      "exactly this litmus test. Thread 0's load of Y can execute and observe 0 while Thread 0's " +
      "store of X still sits in Thread 0's store buffer, unseen by Thread 1, and symmetrically for " +
      "Thread 1, producing r1==0 && r2==0 on real x86 silicon rather than only in theory. ARM and " +
      "POWER permit the same outcome plus considerably more, including load-load and store-store " +
      "reordering that TSO rules out. Forbidding the outcome on x86 takes a full fence (MFENCE) " +
      "or a LOCK-prefixed RMW between the store and the load, which drains the store buffer " +
      "first, and that is precisely what a seq_cst store lowers to on x86.",
    references: [
      "Sewell et al., \"x86-TSO: A Rigorous and Usable Programmer's Model for x86 Multiprocessors\", CACM 2010",
    ],
  },
  {
    id: "computer-architecture-simd-autovec-dependency-13",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Auto-vectorizing `a[i] = a[i - 1] * 2 + b[i]` at -O3",
    tags: ["simd", "auto-vectorization", "loop-carried-dependency"],
    type: "trace",
    prompt:
      "Compiled with `-O3` and AVX2 enabled, does this loop get auto-vectorized into SIMD " +
      "instructions?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `for (int i = 1; i < n; ++i) {
    a[i] = a[i - 1] * 2 + b[i];
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: the compiler computes all lanes speculatively and fixes up any lane whose input " +
          "turns out to have changed",
        "Yes: dependence analysis rewrites the recurrence into a closed form whose lanes are " +
          "independent",
        "It vectorizes, and silently produces wrong results once n exceeds the vector width",
        "No: each iteration needs the previous iteration's result, so no batch of iterations is " +
          "independent and the compiler emits scalar code",
      ],
      correctIndex: 3,
    },
    explanation:
      "Auto-vectorization requires that some fixed-size batch of iterations be independent, so one " +
      "SIMD instruction can compute all of them at once across the lanes. Here a[i] cannot be " +
      "computed without a[i-1], the definition of a loop-carried RAW dependency, so lane k " +
      "strictly requires lane k-1's result and the premise of parallel lanes collapses. The " +
      "compiler's dependence analysis detects the recurrence and refuses to vectorize, emitting " +
      "ordinary scalar code (it may still unroll). A compiler will not silently emit code that " +
      "changes results, and it does not have a general mechanism for solving arbitrary " +
      "recurrences in closed form, though specific patterns like prefix sums do have known " +
      "parallel formulations that a library or hand-written SIMD can exploit. Contrast with `a[i] " +
      "= b[i]*2 + c[i]`, where each iteration reads only b and c and writes a distinct a[i]: no " +
      "iteration depends on another, and it vectorizes cleanly into wide loads, multiplies, adds, " +
      "and stores.",
  },
  {
    id: "computer-architecture-simd-divergent-branch-14",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Auto-vectorizing a loop with a data-dependent if/else",
    tags: ["simd", "auto-vectorization", "predication"],
    type: "trace",
    prompt:
      "`f` and `g` are both fully vectorizable pure functions with side effects only through their " +
      "return value. `data[i] > threshold` is essentially random per element (no exploitable " +
      "pattern). What's the realistic outcome when the compiler tries to auto-vectorize this loop?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `for (int i = 0; i < n; ++i) {
    if (data[i] > threshold) {
        sum += f(data[i]);
    } else {
        sum += g(data[i]);
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It vectorizes exactly like a branch-free loop, since SIMD lanes have no control flow for " +
          "the branch to disturb",
        "Lanes cannot diverge, so vectorizing means computing both f and g for every lane and " +
          "blending by mask, which the compiler weighs against just staying scalar",
        "The loop is rejected outright with a diagnostic, since branches are not legal inside a " +
          "vectorizable loop body",
        "The compiler vectorizes the if-side and runs the else-side scalar, switching between " +
          "vector and scalar mode per element as the condition changes",
      ],
      correctIndex: 1,
    },
    explanation:
      "A SIMD instruction applies one operation identically across all lanes of a vector register; " +
      "there is no mechanism for lane 3 to take the if-branch while lane 5 takes the else-branch " +
      "within a single instruction. To vectorize data-dependent per-element control flow, the " +
      "compiler converts control dependence into data dependence through if-conversion: evaluate " +
      "the comparison into a per-lane mask, compute both f(data[i]) and g(data[i]) unconditionally " +
      "for every lane, and select per lane with a blend. AVX-512 and SVE add real predicate " +
      "registers so masked lanes can suppress side effects and faults, but they still do not let " +
      "different lanes execute different code. The transform is profitable only when the extra " +
      "unconditional work is cheap relative to the mispredictions it removes. With a random " +
      "condition the scalar version mispredicts about half the time, which favors predication; if " +
      "f or g are expensive, opaque, or contain unpredictable branches of their own, the compiler " +
      "will often decline and leave the loop scalar.",
  },
  {
    id: "computer-architecture-register-renaming-war-waw-15",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Two instructions that both write R1",
    tags: ["register-renaming", "war-hazard", "waw-hazard", "out-of-order-execution"],
    type: "trace",
    prompt:
      "An ISA exposes only 16 architectural general-purpose registers, but the underlying " +
      "out-of-order core has 180+ physical registers. I1 writes architectural register R1. I2, " +
      "independently, also writes architectural R1 (a WAW hazard on paper) using entirely " +
      "different source operands. I3 reads R1 afterward and must see I2's result (a RAW hazard on " +
      "I2). What lets I1 and I2 execute out of order, even concurrently, despite both targeting " +
      "the same architectural register?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Rename maps each write to a fresh physical register, so the two writes never share " +
          "storage, and I3 is renamed to read the physical register I2 was given",
        "Nothing does: I2 must wait for I1 to finish writing R1, so that the register is left " +
          "holding the younger instruction's value",
        "The compiler emits the code in SSA form, so the hardware never sees the same name written " +
          "twice",
        "The ROB holds both results and retirement keeps the younger one, so no renaming is " +
          "involved",
      ],
      correctIndex: 0,
    },
    explanation:
      "WAR and WAW are not true data dependencies; they are artifacts of a limited supply of " +
      "names, not of any value flowing between the instructions. Renaming exploits that: a " +
      "register alias table maps each architectural name to whichever physical register currently " +
      "holds its live value, and every instruction that writes a register is allocated a brand-new " +
      "physical register at rename time, updating the map. Because I1 and I2 each get their own " +
      "physical destination, there is no storage they contend over, the WAW disappears, and the " +
      "two can execute in any order or the same cycle, bounded only by their own operand " +
      "readiness. I3's read of R1 is renamed at the same time to the physical register I2 targets, " +
      "which is the correct producer at I3's point in program order, preserving the genuine RAW. " +
      "The ROB tracks ordering and completion but is not what resolves the name conflict, and SSA " +
      "in the compiler does not survive into the ISA's fixed 16-register namespace. Renaming is " +
      "why an out-of-order core can keep far more computation in flight than a small architectural " +
      "register count suggests: those names are a calling convention, not the storage the hardware " +
      "executes against.",
  },
  {
    id: "computer-architecture-store-load-forwarding-stall-16",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Store-to-load forwarding for two store/load overlap patterns",
    tags: ["store-buffer", "load-store-forwarding", "memory-disambiguation"],
    type: "trace",
    prompt:
      "Scenario A: a single 8-byte store writes address p, and the next instruction loads the " +
      "upper 4 bytes at p+4, while the store is still in the store buffer. Scenario B: two " +
      "separate 4-byte stores write p and p+4, and the next instruction loads all 8 bytes at p, " +
      "again before either store has drained. On mainstream x86 microarchitectures (Sandy Bridge " +
      "and later), how do these two loads differ?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// Scenario A: one 8-byte store, then a narrower load contained within it
*p64 = 0x1122334455667788LL;
int32_t a = *(reinterpret_cast<int32_t*>(p64) + 1);   // upper 4 bytes

// Scenario B: two 4-byte stores, then one load spanning both of them
p32[0] = 0x55667788;
p32[1] = 0x11223344;
int64_t b = *reinterpret_cast<int64_t*>(p32);          // all 8 bytes`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both forward at the same cost: the store buffer resolves any overlap between pending " +
          "stores and a later load",
        "Neither forwards: a load always waits for older overlapping stores to commit to cache " +
          "before it can read them",
        "A forwards from the single store that covers it; B overlaps two pending stores with no " +
          "single one covering it, so it waits for both to commit and then re-issues",
        "B forwards and A does not, since forwarding requires the load and store to start at the " +
          "same address",
      ],
      correctIndex: 2,
    },
    explanation:
      "Store buffers let a core's own loads be satisfied without waiting for its stores to drain " +
      "to cache: the load searches the buffer for a matching pending store and forwards the data. " +
      "The forwarding network reads from at most one store buffer entry, so what matters is " +
      "whether a single older store covers the load. On Sandy Bridge and later, a load fully " +
      "contained within one store of 8 bytes or less forwards successfully regardless of offset, " +
      "which is scenario A (older microarchitectures did require a matching start address, which " +
      "is where that misconception comes from). Scenario B is the classic blocker: the load " +
      "overlaps two distinct pending stores, no single entry covers it, so forwarding fails and " +
      "the load is blocked until those stores commit to cache and it re-issues to read them from " +
      "there. Performance counters expose this as a store-forward block " +
      "(`ld_blocks.store_forward` on Intel), and the penalty is on the order of ten-plus cycles. " +
      "It shows up in real code that merges narrow writes and reads them back wide: hand-rolled " +
      "serializers, union-based type punning, and byte-at-a-time buffer assembly followed by a " +
      "wide read.",
    references: [
      "Intel 64 and IA-32 Architectures Optimization Reference Manual, store-forwarding restrictions",
      "Agner Fog, \"The microarchitecture of Intel, AMD and VIA CPUs\", store forwarding stalls",
    ],
  },
  {
    id: "computer-architecture-prefetch-stride-vs-pointer-chase-17",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Summing a vector vs. walking a scattered linked list",
    tags: ["prefetching", "pointer-chasing", "memory-latency"],
    type: "trace",
    prompt:
      "Two traversals process the same total amount of data. Traversal A sums a large " +
      "`std::vector<int64_t>` linearly (`for (i) sum += v[i];`). Traversal B sums an equally " +
      "large `std::list<int64_t>` (a doubly linked list whose nodes were allocated independently " +
      "over time and are scattered essentially randomly across the heap), following `node = " +
      "node->next` each step. Both are far larger than any cache level. Why is B typically " +
      "dramatically slower per element than A, well beyond what the extra pointer indirection " +
      "alone would predict?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "They should be close: total bytes touched and instructions executed dominate, not the " +
          "order in which addresses are produced",
        "std::list's per-node overhead (two pointers plus allocator metadata) is what accounts for " +
          "the whole difference",
        "The prefetcher trains on the list walk and speculates wrong lines, making B slower than " +
          "it would be with prefetching disabled",
        "A's constant stride lets the prefetcher run far ahead and hide DRAM latency, while B's " +
          "next address is only known once the current load returns, so each hop pays full latency " +
          "serially",
      ],
      correctIndex: 3,
    },
    explanation:
      "A hardware stride prefetcher watches the address stream and, once it detects a consistent " +
      "offset between accesses, issues speculative loads further ahead in the same pattern. For " +
      "A's unit-stride walk that means the data the loop will need several iterations from now is " +
      "often already in L1/L2 when the loop gets there, so DRAM latency is hidden behind useful " +
      "work. B offers nothing to train on: `node->next` becomes known only after `node` itself has " +
      "been loaded, so there is no address pattern to extrapolate, and the next node can be " +
      "anywhere in the heap. Each hop is a full serial round trip, issue the load, wait out the " +
      "200-300+ cycle DRAM latency, get the address, only then start the next dereference, with " +
      "essentially zero memory-level parallelism between hops. Per-node size overhead is real but " +
      "second order next to that serialization, and prefetchers do not degrade the list walk, they " +
      "simply have nothing to work with. Contiguous, flattened structures beat pointer-heavy ones " +
      "for traversal-heavy work for exactly this reason, even when both are nominally O(n).",
  },
  {
    id: "computer-architecture-write-combining-buffer-18",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Streaming 4-byte stores at a device over PCIe",
    tags: ["write-combining", "uncacheable-memory", "bus-transactions"],
    type: "trace",
    prompt:
      "A tight loop writes small 4-byte values to a memory region marked write-combining (WC), " +
      "e.g. a GPU or device-mapped ring buffer over PCIe, rather than normal cacheable write-back " +
      "memory. The core provides only a handful of write-combining buffer entries, each able to " +
      "accumulate one cache line's worth of pending writes before it must be flushed as a single " +
      "bus transaction. Case A: the loop finishes writing every byte of one cache line's worth of " +
      "data before moving on to the next line. Case B: the loop interleaves small writes across " +
      "more distinct cache lines than there are WC buffer entries, touching each line only " +
      "sporadically. How do these two access patterns differ in practice?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No difference: WC buffers coalesce into full-line bursts regardless of how many lines are " +
          "in flight at once",
        "A keeps one entry open per line and flushes full-line bursts, while B touches more lines " +
          "than there are entries, so entries flush partially filled and the writes go out as many " +
          "small transactions",
        "B is faster: spreading writes over more lines keeps more independent bus transactions in " +
          "flight simultaneously",
        "Neither benefits: write combining applies only to write-back memory, so a WC region " +
          "issues one bus transaction per store either way",
      ],
      correctIndex: 1,
    },
    explanation:
      "Write-combining memory exists for streaming writes to regions where ordinary write-back " +
      "caching does not apply (classically MMIO and device apertures) but where a separate bus " +
      "transaction per small store would be ruinous. A small number of WC buffers, typically a " +
      "handful of entries on mainstream x86 cores, each hold one cache-line-sized address range " +
      "open and merge any writes landing within it, flushing as a single transaction when the " +
      "entry is evicted: on running out of buffers, on an SFENCE, on certain serializing events, " +
      "or on a CLFLUSH. Writing an entire line before touching another line (case A) keeps that " +
      "entry open the whole time and flushes one wide burst, the intended fast path. Interleaving " +
      "across more lines than there are entries (case B) thrashes the buffers: an entry is evicted " +
      "partially filled to make room for a newly touched line, so its writes go out as several " +
      "small transactions instead of one coalesced one. Over a narrow, latency-sensitive link like " +
      "PCIe, that can be dramatically slower for the exact same number of bytes moved.",
  },
  {
    id: "computer-architecture-tlb-huge-pages-19",
    category: "computer-architecture",
    difficulty: "medium",
    title: "4 KB vs. 2 MB pages over a 4 GB random working set",
    tags: ["tlb", "huge-pages", "virtual-memory"],
    type: "trace",
    prompt:
      "A process randomly accesses a 4 GB working set. With standard 4 KB pages, that footprint " +
      "requires roughly 1,000,000 distinct page-table mappings, while a typical L1 DTLB holds only " +
      "around 64 entries (and a unified L2 TLB perhaps ~1,500). The workload suffers heavy, " +
      "constant TLB misses, each triggering a multi-level page-table walk. Switching the same 4 GB " +
      "region to 2 MB huge pages reduces it to roughly 2,048 mappings. Why does this reduce TLB " +
      "misses so dramatically?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Entry count stays fixed but each entry now maps 512x more address space, so the TLB's " +
          "reach covers far more of the working set and misses become rare",
        "Each individual translation lookup completes in fewer cycles with larger pages, " +
          "independent of the miss rate",
        "The whole region is populated up front, so the page faults that trigger walks stop " +
          "occurring after startup",
        "The walk itself gets shorter, since a 2 MB mapping terminates one level earlier, which is " +
          "where nearly all of the saving comes from",
      ],
      correctIndex: 0,
    },
    explanation:
      "A TLB caches a fixed number of translations, so its reach, the largest working set it can " +
      "cover without missing, is simply entries x page size. With 4 KB pages a 64-entry L1 DTLB " +
      "reaches 256 KB, nothing against a 4 GB footprint, so nearly every access misses and invokes " +
      "the hardware page-table walker across (on x86-64) four levels of dependent memory accesses, " +
      "each potentially a cache miss, easily 50-100+ cycles before the data access even starts. " +
      "Switching to 2 MB pages leaves the entry count unchanged but makes each entry cover 512x " +
      "more address space, so the same 64-entry L1 DTLB reaches 128 MB and a 1,500-entry L2 TLB " +
      "reaches roughly 3 GB, covering most of the working set outright. A 2 MB mapping does also " +
      "terminate one level early, saving one memory access per walk, but that is a small effect " +
      "next to eliminating the vast majority of walks entirely. Large in-memory databases, GC " +
      "heaps, and HPC codes use explicit huge pages (`madvise(MADV_HUGEPAGE)`, hugetlbfs, or THP) " +
      "specifically for reach, not for bandwidth or cache behavior.",
  },
  {
    id: "computer-architecture-dma-cache-coherence-20",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Driver read of a DMA-written buffer on a non-coherent platform",
    tags: ["dma", "cache-coherence", "device-drivers"],
    type: "trace",
    prompt:
      "A NIC performs a DMA transfer, writing incoming packet data directly into a buffer in main " +
      "memory, on a platform where DMA is not automatically snooped or kept coherent with the " +
      "CPU's caches (some embedded SoCs, and certain buffer/bus configurations even on larger " +
      "systems). The CPU had read that same buffer region earlier, while processing the previous " +
      "packet. After the DMA completes and the driver is notified by interrupt, the driver reads " +
      "the buffer through an ordinary load with no cache maintenance of any kind. What does it " +
      "get?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Stale data, but only until the interrupt handler returns: taking the completion interrupt " +
          "is a serializing event that flushes the CPU's data caches",
        "Fresh data: a device write to memory always wins, since a clean cached line is dropped " +
          "rather than trusted the next time the address is loaded",
        "Possibly stale data: the device's write left the CPU's cached copy of the buffer " +
          "untouched, so the driver has to invalidate those lines itself before reading",
        "Fresh data here; the hazard runs only the other way, when a dirty CPU line is written back " +
          "afterwards over what the device deposited",
      ],
      correctIndex: 2,
    },
    explanation:
      "DMA lets a device move a block of data with its own engine while the CPU runs unrelated " +
      "work, but on a non-coherent platform that engine writes straight to memory without " +
      "generating the snoops and invalidations an equivalent CPU store would. Nothing tells the " +
      "CPU's caches the buffer changed underneath them. The previously fetched line is still " +
      "Valid and clean as far as the cache is concerned, so the load hits on it and silently " +
      "returns pre-DMA contents. Taking an interrupt does not help: interrupts serialize " +
      "execution, they do not perform cache maintenance, and no mainstream architecture flushes " +
      "data caches on interrupt entry. The reverse hazard is real as well, but it is not the only " +
      "one: a " +
      "dirty CPU line covering the buffer can later be written back over what the device " +
      "deposited, and a device reading a CPU-written buffer can pick up stale memory if those " +
      "dirty lines were never cleaned. Drivers handle both directions explicitly with cache " +
      "maintenance, invalidating before reading device-written data and cleaning before letting " +
      "the device read CPU-written data, which is what Linux's `dma_sync_single_for_cpu` and " +
      "`dma_sync_single_for_device` wrap. Fully coherent DMA, common on modern x86 servers where " +
      "the device participates in the coherence domain, removes the hazard, but that is a platform " +
      "property rather than a universal guarantee, which is why portable driver code issues the " +
      "sync calls anyway and lets them compile away where they are unnecessary.",
  },
  {
    id: "computer-architecture-smt-resource-contention-21",
    category: "computer-architecture",
    difficulty: "hard",
    title: "An FMA-saturating thread beside an integer thread on one core",
    tags: ["smt", "hyper-threading", "resource-contention"],
    type: "trace",
    prompt:
      "Two logical threads share one physical core via simultaneous multithreading (SMT/Hyper-" +
      "Threading). Logical thread 0 runs a saturating stream of AVX FMA (fused multiply-add) " +
      "floating-point instructions, keeping the core's FP execution ports continuously busy. " +
      "Logical thread 1, on the sibling logical core, runs simple integer/branch-heavy code with " +
      "no floating-point work at all. What happens to logical thread 1's throughput, and why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing measurable: SMT duplicates the execution resources and shares only the instruction " +
          "fetch unit between siblings",
        "Thread 1 speeds up, since thread 0 confines itself to the FP ports and leaves the integer " +
          "ALUs entirely uncontended",
        "The core drops out of SMT into single-threaded mode automatically whenever one sibling " +
          "saturates an execution unit",
        "Thread 1's IPC drops: siblings share front-end bandwidth, scheduler and ROB entries, the " +
          "issue ports, and L1/L2, so thread 0 takes issue slots and cache capacity from it",
      ],
      correctIndex: 3,
    },
    explanation:
      "SMT presents one physical core as two logical cores by duplicating only the architectural " +
      "state needed to track two instruction streams (program counters, architectural register " +
      "state, rename tables) while sharing essentially all the execution machinery: fetch and " +
      "decode bandwidth, issue ports and functional units, and, depending on the microarchitecture, " +
      "the ROB, scheduler entries, and physical register file, plus L1 and L2 unconditionally. The " +
      "point of SMT is filling issue slots one thread leaves idle during stalls, not delivering " +
      "two cores' worth of throughput. The assumption that FP and integer work never collide is " +
      "wrong on Intel cores in particular, where the vector FMA units live on the same ports (0 " +
      "and 1 on Skylake) that host integer ALUs, so a saturating FMA stream directly removes " +
      "integer issue capacity as well as competing for fetch cycles and cache. Thread 1's IPC " +
      "therefore drops measurably against running alone. Latency-sensitive HPC and trading " +
      "workloads frequently disable SMT, or pin one thread per physical core, because predictable " +
      "uncontended access to these structures is worth more than the extra logical thread's " +
      "nominal throughput.",
  },
  {
    id: "computer-architecture-store-buffer-forwarding-22",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Reading back an address whose store hasn't drained",
    tags: ["store-buffer", "memory-ordering", "tso"],
    type: "trace",
    prompt:
      "Core A executes a store to address X (value 1), followed immediately by a load of X. At " +
      "this point the store has not yet drained out of Core A's store buffer into the coherent " +
      "cache hierarchy, so Core B, which also has X cached, still observes the old value if it " +
      "were to read X right now. Does Core A's own very next load of X see the value it just " +
      "stored (1), or the old value that other cores still see?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The load waits for the store to reach coherent cache, so it observes the same value and " +
          "the same timing Core B would",
        "The load is satisfied out of Core A's own store buffer and returns 1 immediately, while " +
          "Core B still sees the old value",
        "The load returns an unspecified value until the store commits, which is why lock-free " +
          "code needs a fence in this position",
        "The core disallows it: a load is blocked at issue while the same core has an unresolved " +
          "store pending to that address",
      ],
      correctIndex: 1,
    },
    explanation:
      "If a core's own loads had to wait for its prior stores to drain to the coherent hierarchy, " +
      "single-threaded performance would collapse, since store-then-load-same-address is extremely " +
      "common. Store buffer forwarding avoids that: a load searches the core's own store buffer " +
      "for a matching pending store and, on a hit, takes the value directly and completes. Program " +
      "order within a core is therefore always preserved from that core's own point of view, which " +
      "is an architectural guarantee on every mainstream ISA, not a microarchitectural accident, " +
      "so nothing here is unspecified and no fence is required for self-consistency. What other " +
      "cores see is a different matter: they have no visibility into Core A's store buffer and " +
      "observe the store only once it drains and becomes globally visible through the coherence " +
      "protocol. That asymmetry, a core seeing its own store early while others still read stale " +
      "values, is the mechanism behind the store-buffering litmus test, where two cores can each " +
      "read the other's variable as still-old even though each has already written and read back " +
      "its own.",
  },
  {
    id: "computer-architecture-ilp-dependency-chain-23",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Chained vs. independent additions on a 4-wide superscalar core",
    tags: ["ilp", "dependency-chain", "superscalar"],
    type: "trace",
    prompt:
      "Both snippets perform the same 5 additions on a 4-wide superscalar out-of-order core where " +
      "each `add` has a 1-cycle latency but the core can issue up to 4 independent ops per cycle. " +
      "Version A chains every add through the previous result. Version B computes three additions " +
      "independently, then combines them. Which finishes sooner, and why, despite identical " +
      "instruction counts?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// Version A: serial dependency chain
int x = ((((a + b) + c) + d) + e) + f;

// Version B: independent partial sums combined at the end
int p = a + b;
int q = c + d;
int r = e + f;
int x2 = p + q + r;`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "B: A's five adds form one serial chain and need about 5 cycles however wide the machine " +
          "is, while B's first three adds issue together and cut the critical path to about 3",
        "The same: a 4-wide core issues 4 ops per cycle regardless of dependencies, so instruction " +
          "count is what decides",
        "A: fewer named temporaries means less rename pressure and fewer physical registers in " +
          "flight",
        "The same: the renamer gives each add its own physical destination, which breaks A's chain " +
          "just as B's rewrite does",
      ],
      correctIndex: 0,
    },
    explanation:
      "Issue width is an upper bound on what a core can dispatch per cycle, reachable only when " +
      "enough independent ready instructions exist that cycle. Version A is a strict linear chain: " +
      "each add's operand is the previous add's result, so its critical path is 5 sequential " +
      "1-cycle adds and the other 3 issue slots per cycle go unused for want of anything ready. " +
      "Version B restructures the same computation so that `p = a+b`, `q = c+d`, and `r = e+f` are " +
      "mutually independent, all three issuing in one cycle across separate ALU ports, leaving " +
      "only two dependent adds to combine them, for a critical path around 3 cycles. Renaming does " +
      "not help A, since renaming removes WAR and WAW hazards caused by name reuse, not the true " +
      "RAW dependencies that define a chain. This is the essence of instruction-level parallelism: " +
      "the length of the longest true dependency chain bounds performance far more tightly than " +
      "instruction count does, and shortening chains is what compiler reassociation (for integers, " +
      "or for floats only under fast-math) and hand-tuned HPC reductions are after.",
  },
  {
    id: "computer-architecture-false-sharing-mesi-24",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Two counters eight bytes apart, two cores",
    tags: ["false-sharing", "cache-coherence", "mesi"],
    type: "trace",
    prompt:
      "Two `int64_t` counters, `a` and `b`, live 8 bytes apart in memory, well within the same " +
      "64-byte cache line. Core 0 repeatedly writes only `a`; Core 1 repeatedly writes only `b`; " +
      "neither core ever touches the other's variable. In precise MESI terms, why does this run " +
      "far slower than if `a` and `b` were on separate cache lines, given that the two cores never " +
      "actually share any data?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It doesn't: coherence tracks the bytes actually written, so two cores writing distinct " +
          "variables generate no coherence traffic between them",
        "Updates to the two counters can be lost, and the retries needed to converge on correct " +
          "values are where the time goes",
        "Coherence works per line, so each write invalidates the other core's copy of the whole " +
          "line and it ping-pongs Modified/Invalid, putting a cross-core transaction on nearly " +
          "every write",
        "Writes to a line another core also holds are downgraded to write-through, so both " +
          "counters bypass L1 and every increment is sent out to memory",
      ],
      correctIndex: 2,
    },
    explanation:
      "MESI, like every mainstream hardware coherence protocol, tracks state per cache line, " +
      "because a line is the unit caches move and invalidate; there is no hardware notion of " +
      "invalidating just 8 bytes. When Core 0 writes `a` it must hold the line Modified, which " +
      "requires invalidating every other copy, including Core 1's, even though Core 1 only cares " +
      "about `b`. The instant Core 1 writes `b` it finds its own copy Invalid, so it issues its " +
      "own transaction to refetch the line (now Modified in Core 0, so a cache-to-cache transfer) " +
      "and invalidate Core 0 in turn. Every write from either core therefore costs a cross-core " +
      "round trip, and the line bounces between the two caches, turning a roughly 1-cycle local L1 " +
      "hit into an operation bound by inter-core latency, potentially tens to over a hundred " +
      "cycles. Nothing is incorrect while this happens: no race, no lost update, nothing a " +
      "debugger would flag, which is what makes false sharing so easy to miss and why the fix " +
      "(padding or aligning each independently written variable to its own line, e.g. " +
      "`alignas(64)`) is purely about layout.",
  },
  {
    id: "computer-architecture-branchless-cmov-25",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Branchy vs. branchless code on unpredictable data",
    tags: ["branchless", "cmov", "branch-prediction"],
    type: "trace",
    prompt:
      "`arr[i]`'s low bit is effectively random (no exploitable pattern) for every element. Version " +
      "A uses a data-dependent branch; version B computes the same result with unconditional " +
      "bitwise arithmetic every iteration (strictly more ALU ops, but no branch). For large, random " +
      "input, which runs faster, and why?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// Version A: data-dependent branch
for (int i = 0; i < n; ++i) {
    if (arr[i] & 1) sum += arr[i];
    else            sum -= arr[i];
}

// Version B: branchless
for (int i = 0; i < n; ++i) {
    int mask = -(arr[i] & 1);              // all-1s if odd, all-0s if even
    sum += (arr[i] & mask) - (arr[i] & ~mask);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "A: it executes fewer instructions per element, and instruction count is what a modern core " +
          "is bound by here",
        "Neither: the compiler lowers A to the same branchless sequence anyway, so the two are the " +
          "same machine code",
        "B is undefined behavior: negating `arr[i] & 1` and masking with the result relies on a " +
          "particular signed representation",
        "B: A mispredicts on roughly half the elements at ~15-20 cycles each, far more than the few " +
          "extra fully pipelined ALU ops B pays unconditionally",
      ],
      correctIndex: 3,
    },
    explanation:
      "The comparison is expected cycles, not instruction count. Version A's branch depends on " +
      "essentially random per-element data, so no predictor, however sophisticated, does better " +
      "than chance, and roughly half of all iterations mispredict. Each misprediction squashes the " +
      "wrong-path work already in flight across a deep pipeline and refills from the correct " +
      "target, typically 15-20 cycles on a contemporary out-of-order core. Version B replaces that " +
      "gamble with a negation, two ANDs, and a subtraction executed unconditionally, cheap fully " +
      "pipelined work a 4-wide core absorbs almost for free by comparison. Compilers attempt this " +
      "transform themselves via cmov for simple enough conditionals, but they do it based on " +
      "heuristics and profile data rather than always, and they can guess wrong in both " +
      "directions, which is why this rewrite is still done by hand in low-latency code via cmov " +
      "intrinsics, bit tricks, or SIMD blends. For a highly predictable branch the tradeoff " +
      "reverses: the predicted branch costs nearly nothing while the branchless version " +
      "still pays for every operation. The mask is well defined: `arr[i] & 1` is 0 or 1 before the " +
      "negation, and negating a small non-negative int is ordinary two's-complement arithmetic.",
  },
  {
    id: "computer-architecture-aos-vs-soa-cache-line-26",
    category: "computer-architecture",
    difficulty: "easy",
    title: "Summing one field of a four-field struct",
    tags: ["cache-lines", "spatial-locality", "data-layout"],
    type: "trace",
    prompt:
      "`Point` is 16 bytes (four `float`s). A 64-byte cache line therefore holds exactly 4 " +
      "`Point`s. This loop sums only the `x` field across a large array of `Point`. What fraction " +
      "of each fetched cache line's bytes does the loop actually use, and what's the consequence?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Point { float x, y, z, w; };   // 16 bytes
std::vector<Point> points(N);

float sumX = 0;
for (const auto& p : points) {
    sumX += p.x;    // y, z, w are loaded into cache too, but never read
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "100%: a cache only ever fetches the bytes the load instruction actually requested",
        "25%: each 64-byte line brings in 4 whole Points but only their 4 x floats are read, so " +
          "three quarters of the fetched bytes and cache capacity are wasted",
        "50%: lines are transferred in 8-byte granules, so each granule carries one used float and " +
          "one unused one",
        "Effectively 100% at -O3: the optimizer splits the struct so only the x fields are " +
          "streamed in",
      ],
      correctIndex: 1,
    },
    explanation:
      "Caches fetch whole lines, here 64 bytes, regardless of how few bytes the triggering load " +
      "asked for; there is no such thing as fetching just the x field, and no mainstream compiler " +
      "performs whole-program struct splitting on a `std::vector<Point>` whose layout is " +
      "observable. Since each Point is 16 bytes, one line holds 4 Points, 16 floats, and the loop " +
      "reads 4 of them, so 12 of the 16 floats transferred occupy cache capacity and memory " +
      "bandwidth for no benefit. That is the standard argument for structure-of-arrays layout in " +
      "performance-sensitive code: with all x values contiguous in their own array, every byte of " +
      "every fetched line is consumed, quadrupling effective bandwidth and cache utilization for " +
      "this access pattern. The tradeoff runs the other way for code that needs x, y, z, and w of " +
      "one Point together, where AoS keeps them on a single line. Which layout wins is decided by " +
      "the dominant access pattern, not by either being better in the abstract.",
  },
  {
    id: "computer-architecture-misprediction-penalty-cycles-27",
    category: "computer-architecture",
    difficulty: "easy",
    title: "Cost of a branch misprediction on a deep out-of-order pipeline",
    tags: ["branch-prediction", "pipeline-flush", "misprediction-penalty"],
    type: "trace",
    prompt:
      "A modern out-of-order core has a deep front-to-back pipeline (roughly 19 stages from fetch " +
      "through the stage where a branch's actual outcome and target are finally resolved in " +
      "execute). A branch mispredicts. Roughly how many cycles of useful work are lost, and what " +
      "determines that number?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Roughly 15-20 cycles, set by the number of stages between fetch and where the branch's " +
          "outcome and target are finally known",
        "Roughly 1 cycle: the out-of-order window covers the bubble with other in-flight work " +
          "already past rename",
        "Roughly 200-300 cycles, comparable to a DRAM access, since the correct target has to be " +
          "re-fetched from memory",
        "Zero when the predictor was confident, since a high-confidence prediction is verified in " +
          "the front end rather than in execute",
      ],
      correctIndex: 0,
    },
    explanation:
      "The penalty is fundamentally a function of pipeline depth. Everything fetched, decoded, " +
      "renamed, and issued speculatively down the wrong path between fetch and the branch's " +
      "resolution point is wasted and must be squashed, and the front end has nothing correct to " +
      "feed the back end until it restarts at the right target and that new stream works its way " +
      "through the same stages before instructions retire again. On a contemporary core with " +
      "roughly 15-20 stages between fetch and branch resolution, that is roughly 15-20 lost cycles " +
      "per misprediction, and predictor confidence does not change the depth that recovery must " +
      "traverse. Recovering the correct target rarely costs a memory access, since it usually hits " +
      "in the instruction cache or a micro-op cache, so a DRAM-scale penalty is the wrong order of " +
      "magnitude. This one number is why predictor accuracy matters so much: on a hot branch, 95% " +
      "versus 99% accuracy can decide whether a workload is front-end bound by recovery, and it is " +
      "the tension that pushes deep, high-frequency pipelines toward ever more elaborate " +
      "predictors (two-level, TAGE, perceptron-based) to justify their depth.",
  },
  {
    id: "computer-architecture-loop-unrolling-ilp-28",
    category: "computer-architecture",
    difficulty: "hard",
    title: "One running sum vs. four partial sums",
    tags: ["ilp", "loop-unrolling", "reduction"],
    type: "trace",
    prompt:
      "Assume floating-point `add` has a 4-cycle latency but the core can issue a new independent " +
      "add every cycle (throughput 1/cycle across multiple FP add pipelines/ports). Version A " +
      "accumulates into a single running sum. Version B unrolls by 4 and accumulates into four " +
      "independent partial sums, combined only once at the very end. The array is large but stays " +
      "resident in cache, so neither version is limited by memory bandwidth. What's the realistic " +
      "throughput difference?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// Version A: single accumulator
double sum = 0;
for (int i = 0; i < n; ++i) sum += a[i];

// Version B: 4 independent accumulators
double s0 = 0, s1 = 0, s2 = 0, s3 = 0;
for (int i = 0; i < n; i += 4) {
    s0 += a[i];
    s1 += a[i + 1];
    s2 += a[i + 2];
    s3 += a[i + 3];
}
double sum = (s0 + s1) + (s2 + s3);`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No meaningful difference: both execute the same number of adds, and issue width is the " +
          "binding constraint in either case",
        "A wins: its loop body is shorter and keeps only one accumulator live, so it retires more " +
          "iterations per cycle",
        "B is roughly 4x faster on the loop: A can only start an add every 4 cycles because each " +
          "waits on the previous result, while B keeps four independent chains in flight and " +
          "approaches one add per cycle",
        "B is slower: four live accumulators raise register pressure enough to force spills in the " +
          "inner loop",
      ],
      correctIndex: 2,
    },
    explanation:
      "A reduction into one accumulator is a strict serial dependency chain, since `sum += a[i]` " +
      "both reads and writes `sum` and cannot start until the previous iteration's add produced " +
      "its result. With a 4-cycle add latency a new useful add starts only every 4 cycles no " +
      "matter how many FP ports exist, so three quarters of the issue capacity idles waiting on " +
      "the chain: the loop is latency-bound, not throughput-bound. Splitting into four partial " +
      "sums creates four independent 4-cycle chains, so the core can have all four in flight and " +
      "issue an add nearly every cycle, now bound by add throughput instead of add latency, " +
      "roughly a 4x improvement in steady state. The final combine is a fixed cost outside the hot " +
      "loop. The win is bounded by whatever the next constraint turns out to be: stream the same " +
      "array from DRAM instead and both versions collapse onto memory bandwidth, where the extra " +
      "accumulators buy nothing. A compiler will also not perform this transform on floating-point " +
      "code on its own without `-ffast-math` or equivalent, because reassociating FP addition " +
      "changes the result; for integers, where addition is associative, it will. Sizing the " +
      "accumulator count " +
      "to the latency-to-throughput ratio is the standard version of this optimization, and it is " +
      "what vectorized reductions do implicitly, each lane acting as one more independent " +
      "accumulator.",
  },
  {
    id: "computer-architecture-numa-remote-latency-29",
    category: "computer-architecture",
    difficulty: "medium",
    title: "A buffer first-touched on one socket, consumed on the other",
    tags: ["numa", "memory-latency", "multi-socket"],
    type: "trace",
    prompt:
      "On a dual-socket server (two NUMA nodes, one per socket, connected by an inter-socket " +
      "interconnect such as Intel UPI or AMD Infinity Fabric), a thread pinned to a core on Node 0 " +
      "allocates and first-touches a large buffer, which the OS's first-touch policy places in " +
      "Node 0's local DRAM. A different thread, pinned to a core on Node 1, then reads and writes " +
      "that same buffer heavily. Software sees one flat, cache-coherent shared address space either " +
      "way. What's the actual hardware-level consequence?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "None: a ccNUMA system presents one uniform access latency for every address, and NUMA " +
          "affects only total addressable capacity",
        "The accesses fault, since a core cannot address physical memory owned by another socket's " +
          "memory controller",
        "The OS migrates the pages to Node 1 on the first remote touch, so only that first access " +
          "pays a penalty",
        "Every access crosses the inter-socket link to Node 0's memory controller, adding latency " +
          "and consuming shared interconnect bandwidth, though software sees ordinary memory",
      ],
      correctIndex: 3,
    },
    explanation:
      "ccNUMA presents a single flat coherent physical address space, so any core may legally load " +
      "or store any address regardless of which socket's controller owns it, but being able to " +
      "access memory and accessing it equally fast are different claims. Physical memory is " +
      "partitioned per node, each with its own controller; an access from Node 1 to an address " +
      "living in Node 0's DRAM must traverse the inter-socket interconnect and typically also " +
      "consult a directory or snoop filter for coherence, adding real latency (commonly 1.5-2x a " +
      "local access) and consuming finite shared link bandwidth that competes with other " +
      "cross-socket traffic. Which node holds a page is decided by first touch, the faulting " +
      "thread's node, not by which thread called malloc, so a buffer produced on one socket and " +
      "consumed on another stays remote indefinitely unless something intervenes. Automatic NUMA " +
      "balancing in Linux can migrate pages after observing access patterns, but it is a " +
      "sampling-driven background policy, not an immediate first-remote-touch migration. NUMA-aware " +
      "code instead pins allocating threads to the consuming node, allocates explicitly with " +
      "`numa_alloc_onnode`, or replicates hot read-only data.",
  },
  {
    id: "computer-architecture-speculative-store-bypass-30",
    category: "computer-architecture",
    difficulty: "hard",
    title: "A load executed past an older store whose address is unresolved",
    tags: ["speculative-execution", "memory-disambiguation", "spectre-v4"],
    type: "trace",
    prompt:
      "An out-of-order core encounters, in program order, a store to address `*p` whose address " +
      "isn't fully resolved yet (p is itself the result of a not-yet-complete computation), " +
      "immediately followed by a load from `*q` (q's address ready sooner). Rather than stall the " +
      "load until the older store's address is known and definitively ruled out as aliasing, the " +
      "core's memory disambiguation predictor speculatively guesses that the load does not alias " +
      "the pending store, and lets the load execute early against memory/cache. What happens if p " +
      "and q later turn out to actually be equal (a true RAW dependency the core bet against)?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing: hardware always waits for every older store's address to resolve before a later " +
          "load may execute, so the scenario cannot arise",
        "The core detects the aliasing when the store's address resolves, then squashes and " +
          "replays the load and everything that consumed its stale value, at a cost broadly like a " +
          "branch misprediction",
        "The load keeps the stale value permanently, since nothing compares addresses after the " +
          "fact; this is why compilers must emit their own alias checks",
        "The store buffer merges the newer store into the already-executed load's destination " +
          "register, so no replay is needed",
      ],
      correctIndex: 1,
    },
    explanation:
      "A core could always stall a load until every older store's address is known, which is " +
      "correct but costly, since the large majority of load/store pairs never alias. Modern cores " +
      "instead include a memory disambiguation predictor that learns, per load, whether it has " +
      "historically aliased with nearby older stores, and lets the load execute early whenever it " +
      "predicts no aliasing, much as a branch predictor speculates past an unresolved branch. The " +
      "load/store queue keeps the addresses, so when the store's address finally resolves the " +
      "hardware compares it against younger executed loads; on a match it must treat the situation " +
      "as misspeculation, squash the load and every downstream consumer of its now-wrong value, " +
      "and re-execute them with the correctly forwarded data, at a recovery cost broadly " +
      "comparable to a branch misprediction. Compile-time alias analysis, including restrict-based " +
      "reasoning, is a separate static guarantee about what the compiler may assume; it says " +
      "nothing about runtime pointer values and is not what keeps the hardware correct. The " +
      "security angle is that the transiently executed, ultimately squashed instructions still " +
      "leave microarchitectural traces such as cache lines touched using the stale value, probeable " +
      "by a timing side channel, which is Spectre variant 4 (Speculative Store Bypass).",
    references: [
      "Intel, \"Speculative Store Bypass\" (CVE-2018-3639) technical advisory",
    ],
  },
  {
    id: "computer-architecture-numa-false-sharing-31",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Two counters sharing a cache line across two NUMA nodes",
    tags: ["numa", "false-sharing", "cache-coherence", "performance"],
    type: "trace",
    prompt:
      "Two counters share a single 64-byte cache line, exactly as in a same-socket false-sharing " +
      "scenario, but now Thread 1 is pinned to a core on NUMA node 0 and Thread 2 is pinned to a " +
      "core on NUMA node 1, and the cache line's backing physical memory is homed on node 0 " +
      "(typical, since it was first touched by code running there under a first-touch allocation " +
      "policy). How does pinning the two threads to different NUMA nodes change the false-sharing " +
      "analysis, if at all?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No difference from the same-socket case: coherence traffic costs the same cycles wherever the line's home memory physically sits.",
        "Better, if anything: each NUMA node has its own coherence domain, so cross-node false sharing cannot arise in the first place.",
        "Identical to the non-NUMA case, except the OS scheduler migrates one of the two threads onto the other's node to resolve it.",
        "Worse: each ping-pong now crosses the inter-socket interconnect, and node 1 additionally pays remote-memory latency on every miss.",
      ],
      correctIndex: 3,
    },
    explanation:
      "Same-socket false sharing already costs cache-coherence ping-pong traffic (MESI/MOESI " +
      "invalidations and re-fetches) traveling over an on-chip interconnect (ring bus / mesh) at " +
      "relatively low latency. Once the two contending threads live on different NUMA nodes, the " +
      "same coherence traffic must instead cross a socket-to-socket interconnect, which carries " +
      "meaningfully higher per-hop latency than an intra-socket path (Intel UPI or AMD Infinity " +
      "Fabric rather than the on-die ring or mesh), so every invalidate/fetch round trip gets " +
      "more expensive purely from physical distance and interconnect hops, before considering " +
      "anything else. Separately, cache-coherence protocols on NUMA systems are " +
      "typically directory-based: a remote node's request for a line may need to consult a directory " +
      "or snoop filter associated with whichever node's memory controller actually owns that " +
      "physical address, adding another cross-interconnect round trip specifically because the line " +
      "is homed remotely relative to the requester. So false sharing across NUMA nodes compounds two " +
      "costs rather than one: the coherence traffic itself, present even same-socket, plus " +
      "remote-memory-access latency, present because the accessed physical memory is not local to " +
      "the requesting node. Fixing it requires both per-line padding (to eliminate the false " +
      "sharing itself) and NUMA-aware allocation such as first-touch placement or explicit " +
      "node-local allocation (e.g., numa_alloc_onnode on Linux), so that each thread's working set is " +
      "physically local to the node it actually runs on.",
  },
];
