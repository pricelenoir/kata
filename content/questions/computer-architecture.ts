import type { TraceQuestion } from "@/types/question";

export const computerArchitectureQuestions: TraceQuestion[] = [
  {
    id: "computer-architecture-pipeline-structural-hazard-01",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Structural hazard from a shared memory port",
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
        "A data hazard: I+3 must wait for a RAW dependency to resolve",
        "A structural hazard: IF stalls for one cycle because the single shared memory port is " +
          "occupied by I's MEM-stage access — this is purely a hardware resource conflict, " +
          "unrelated to any data or control dependency between the instructions",
        "A control hazard, since fetch is blocked",
        "Undefined behavior: the two memory accesses race",
      ],
      correctIndex: 1,
    },
    explanation:
      "A structural hazard occurs when two instructions in different pipeline stages need the " +
      "same physical hardware resource in the same cycle, independent of any data or control " +
      "dependency between them — here, a single-ported unified memory. I's MEM access and " +
      "I+3's IF access are logically unrelated (no register or branch dependency links them), " +
      "yet the pipeline must still insert a bubble because the hardware cannot service both " +
      "requests in one cycle. This is exactly why real designs split instruction and data " +
      "caches (Harvard-style at the L1) even in machines with a unified, von Neumann memory " +
      "model further out — it eliminates this class of structural hazard for the common case " +
      "of overlapping fetch and memory-stage accesses. Other structural hazards arise from a " +
      "single non-pipelined multiplier/divider unit, or a register file with too few write " +
      "ports for the number of instructions retiring per cycle.",
  },
  {
    id: "computer-architecture-pipeline-raw-forwarding-02",
    category: "computer-architecture",
    difficulty: "easy",
    title: "RAW hazard resolved by full forwarding",
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
        "0 stall cycles — the EX/MEM forwarding path feeds ADD's freshly computed result directly " +
          "into SUB's ALU input the cycle SUB reaches EX, exactly when it's needed",
        "1 stall cycle, because the register file hasn't been written yet",
        "2 stall cycles, one for each pipeline stage separating the instructions",
        "3 stall cycles — forwarding only works for loads, not ALU-to-ALU dependencies",
      ],
      correctIndex: 0,
    },
    explanation:
      "Without forwarding, SUB would need to stall until ADD's WB stage writes R1 back to the " +
      "register file, since SUB's ID stage (where operands are normally read) happens before " +
      "that write completes — a RAW hazard. Full forwarding adds a bypass path that routes " +
      "ADD's ALU output (latched in the EX/MEM pipeline register) directly into the ALU input " +
      "mux for the very next instruction's EX stage, so SUB gets the correct value of R1 exactly " +
      "when it needs it with zero bubbles. This ALU-to-ALU (EX/MEM to EX) forwarding path covers " +
      "the immediately-following-instruction case; a one-cycle stall is only unavoidable for a " +
      "load immediately followed by a dependent instruction (the classic load-use hazard), " +
      "because the loaded value isn't available until the end of MEM, one stage later than an " +
      "ALU result.",
  },
  {
    id: "computer-architecture-pipeline-control-hazard-03",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Control hazard flush depth",
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
        "Zero — predict-not-taken never needs to squash anything",
        "One instruction",
        "Two instructions — by the time the branch resolves at the end of EX, the pipeline has " +
          "already fetched the instructions in ID and IF (the two cycles behind it), both along " +
          "the wrong (fall-through) path, and both must be flushed",
        "Four instructions — the entire pipeline is always flushed on any taken branch",
      ],
      correctIndex: 2,
    },
    explanation:
      "The flush depth for a mispredicted branch equals the number of pipeline stages between " +
      "fetch and branch resolution, minus one. Here the branch resolves at the end of EX (stage " +
      "3), so by that same cycle two more instructions have already been fetched behind it — one " +
      "sitting in ID, one in IF — both fetched under the wrong assumption (not-taken). Once the " +
      "branch resolves as taken, both must be squashed and the correct-path instruction fetched " +
      "instead, costing a 2-cycle bubble. This is precisely why real designs resolve branches as " +
      "early as possible (e.g. in ID with dedicated compare/forwarding hardware, cutting the " +
      "penalty to one bubble) or, far more effectively in modern cores, predict the branch " +
      "outcome and target ahead of time via a branch predictor and BTB so the common case incurs " +
      "no bubble at all.",
  },
  {
    id: "computer-architecture-branch-btb-indirect-04",
    category: "computer-architecture",
    difficulty: "hard",
    title: "BTB prediction for monomorphic vs. megamorphic indirect calls",
    tags: ["branch-prediction", "btb", "indirect-branch"],
    type: "trace",
    prompt:
      "A hot call site invokes a virtual function through a vtable pointer (an indirect branch " +
      "whose target address, not just its taken/not-taken outcome, must be predicted). Case A: " +
      "the call site is monomorphic — it always resolves to the same concrete override at " +
      "runtime. Case B: the call site is megamorphic — it alternates unpredictably among several " +
      "different concrete overrides across calls. What does the branch target buffer (BTB) do in " +
      "each case?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The BTB predicts equally well in both cases, since it only tracks taken/not-taken, not " +
          "targets",
        "In case A, the BTB quickly learns the single stable target and predicts it correctly on " +
          "nearly every call, incurring effectively no penalty; in case B, the single BTB entry " +
          "for that call site can only hold one predicted target at a time, so alternating actual " +
          "targets repeatedly disagree with whatever was last predicted, causing frequent " +
          "target mispredictions — each one a full front-end pipeline flush once the real target " +
          "is resolved in execute",
        "The BTB entry is disabled automatically once it detects a megamorphic call site, forcing " +
          "the core into a slower but resolution-free in-order mode",
        "Indirect branches are never entered into the BTB at all — only direct conditional " +
          "branches are",
      ],
      correctIndex: 1,
    },
    explanation:
      "The BTB caches, per branch instruction address, the most recently (or most commonly) " +
      "observed target address so the front end can redirect fetch before the branch is even " +
      "decoded, let alone executed. A monomorphic call site's target never changes, so the BTB " +
      "entry converges to a near-100%-accurate prediction and virtually every call is a free, " +
      "zero-bubble jump. A megamorphic call site defeats this: a single BTB entry (or the small " +
      "per-branch indirect-target history most designs maintain) cannot simultaneously represent " +
      "several live targets, so whichever target was predicted from the last call is frequently " +
      "wrong, and each misprediction is caught only once the real target is computed and " +
      "resolved much later in the pipeline, forcing a full speculative-state flush and refetch. " +
      "This is exactly why virtual-dispatch-heavy or heavily-polymorphic C++/interpreter code " +
      "(virtual calls, function pointers, switch-based dispatch) is especially sensitive to " +
      "call-site polymorphism, and why devirtualization, final-marking, and profile-guided " +
      "monomorphization are real, measurable optimizations on such hot paths.",
  },
  {
    id: "computer-architecture-branch-sorted-array-05",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Why sorting the data speeds up a branchy loop",
    tags: ["branch-prediction", "predictability"],
    type: "trace",
    prompt:
      "This loop runs over a large array of random 32-bit integers, and is timed twice: once with " +
      "`data` left in random order, once after `std::sort(data.begin(), data.end())` is called " +
      "first (the sort's own time is excluded from the measurement — only the loop below is " +
      "timed). The sorted run is measurably faster, often by several times, despite doing the " +
      "exact same arithmetic and touching the same memory footprint in the same linear order " +
      "either way. What's the primary cause?",
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
        "Better spatial cache locality once sorted — sorted data compresses into fewer cache lines",
        "Branch prediction accuracy: on sorted data the `>= threshold` outcome is false for a long " +
          "run and then true for a long run (one transition total), so the predictor converges " +
          "and predicts nearly every branch correctly; on random data the outcome is essentially a " +
          "coin flip per element, so the predictor mispredicts roughly half the time, and each " +
          "misprediction costs a full pipeline flush",
        "SIMD auto-vectorization only triggers on sorted input",
        "The sorted array is smaller in memory because duplicate values are removed by sort",
      ],
      correctIndex: 1,
    },
    explanation:
      "Both runs touch every element exactly once, in the same linear (fully cache-friendly, " +
      "unit-stride) order — sorting doesn't change the access pattern, footprint, or total " +
      "arithmetic work, so cache locality is identical either way and cannot explain the " +
      "difference. What changes is the *sequence of branch outcomes* the conditional produces. " +
      "On sorted data the outcome is false for every element below the threshold and true for " +
      "every element at or above it — a single transition across the whole array — which a " +
      "modern two-level/TAGE-style branch predictor learns almost perfectly after a short warm-up, " +
      "so nearly every branch executes with zero penalty. On random data the outcome is " +
      "effectively unpredictable (~50% correlated with recent history at best), so the predictor " +
      "mispredicts roughly half the time, and on a deep out-of-order pipeline each misprediction " +
      "costs on the order of 15-20 cycles to squash the wrong-path work and refill the pipeline " +
      "from the correct target — dwarfing the one or two cycles the branch's actual work would " +
      "otherwise take. This is the canonical illustration of why data-dependent unpredictable " +
      "branches, not raw instruction count, often dominate real-world hot-loop performance.",
  },
  {
    id: "computer-architecture-rob-inorder-retirement-06",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Reorder buffer preserves in-order retirement",
    tags: ["out-of-order-execution", "rob", "precise-exceptions"],
    type: "trace",
    prompt:
      "An out-of-order superscalar core issues three independent instructions in program order: " +
      "I1 (a 20-cycle-latency integer divide), I2 and I3 (single-cycle adds with no dependency on " +
      "I1 or each other). The scheduler dispatches all three as soon as their operands are ready, " +
      "so I2 and I3 finish execution long before I1 does. What governs when I2's and I3's results " +
      "become visible to the rest of the machine (committed to the architectural register file)?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "I2 and I3 commit immediately upon finishing execution, since the machine is out-of-order " +
          "end to end",
        "I2 and I3 finish execution early and sit in their reorder buffer (ROB) entries marked " +
          "complete, but do not retire (commit to architectural state) until I1 and every older " +
          "instruction has retired first — the ROB enforces in-order retirement even though " +
          "execution itself happened out of order, which is what makes exceptions precise",
        "The core stalls I2 and I3's execution entirely until I1 finishes, since retirement order " +
          "equals execution order on this design",
        "I2 and I3's results are discarded and must be recomputed once I1 retires",
      ],
      correctIndex: 1,
    },
    explanation:
      "Out-of-order execution and in-order retirement are two separate mechanisms, and the ROB is " +
      "what decouples them: every instruction is allocated a ROB entry in program order at " +
      "dispatch, executes whenever its operands and a functional unit are ready (potentially far " +
      "out of order), and marks its ROB entry 'complete' with its result — but the retirement " +
      "logic only ever commits entries from the head of the ROB, in strict program order, one (or " +
      "a few, superscalar-width) per cycle, and only once they're marked complete. So I2 and I3 " +
      "can finish computing well before I1, but their results sit buffered in the ROB, invisible " +
      "to architectural state, until I1 retires ahead of them. This is precisely what gives the " +
      "machine precise exceptions despite out-of-order execution: if I1 later faults (e.g. divide " +
      "by zero), the core simply never retires I1 or anything behind it — I2 and I3's already-" +
      "computed results are quietly discarded from the ROB, and architectural state reflects " +
      "exactly 'everything up to I1, and nothing after,' exactly as a naive in-order machine would " +
      "have produced.",
  },
  {
    id: "computer-architecture-speculative-execution-spectre-07",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Cache residue left behind by a squashed speculative load",
    tags: ["speculative-execution", "spectre", "side-channel"],
    type: "trace",
    prompt:
      "The branch predictor has been trained (via many prior in-bounds calls) to predict `x < " +
      "array1_size` as taken. An attacker then calls this function with an out-of-bounds `x`. The " +
      "core speculatively executes past the branch before it's resolved: it computes " +
      "`array1[x]` (an out-of-bounds read) and uses that byte to index and load from `array2`, " +
      "all before discovering the branch was mispredicted and squashing the instructions. After " +
      "the misprediction is detected and architectural state is rolled back to what it would have " +
      "been had the branch gone the other way, what — if anything — remains observable?",
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
        "Nothing at all — misprediction rollback perfectly undoes every effect of the squashed " +
          "instructions, architectural and microarchitectural alike",
        "The rollback restores architectural state (registers, memory writes are never " +
          "committed), but it does not undo microarchitectural side effects: the speculative load " +
          "from `array2` still pulled a specific cache line into the cache before the squash. A " +
          "later timing probe — measuring access latency to each of array2's possible cache lines " +
          "— can detect which line is now cached, and back out the value of the out-of-bounds " +
          "byte, entirely through a covert cache-timing channel that never depended on the " +
          "transient instructions ever architecturally committing",
        "The CPU raises a segmentation fault at the moment of the out-of-bounds read, so no data " +
          "is ever leaked",
        "The speculative load causes a data race detectable by the OS's memory protection unit",
      ],
      correctIndex: 1,
    },
    explanation:
      "Branch misprediction recovery only guarantees that *architectural* state — registers, " +
      "memory — ends up exactly as if the mispredicted path had never executed; it says nothing " +
      "about *microarchitectural* state such as cache contents, which are never rolled back " +
      "because doing so would require tracking and reverting every cache fill a speculative " +
      "instruction ever caused, which no real design does. The speculative chain here reads an " +
      "attacker-controlled out-of-bounds byte from array1, uses it to compute an address into " +
      "array2, and issues a load — pulling exactly one of array2's cache lines (determined by the " +
      "secret byte) into the cache — before the branch resolves and the whole sequence is " +
      "squashed. The squash removes any architectural trace (y is never written), but the cache " +
      "line stays resident; the attacker then times accesses to each of array2's 256 possible " +
      "lines (one per possible byte value) and the fast one reveals the secret. This is the core " +
      "mechanism behind Spectre-class attacks: speculative execution transiently computes on data " +
      "it should never have architecturally touched, and a cache-timing (or other microarchitectural) " +
      "side channel exfiltrates the result even though the computation itself is 'undone.'",
  },
  {
    id: "computer-architecture-cache-hierarchy-latency-08",
    category: "computer-architecture",
    difficulty: "easy",
    title: "Order-of-magnitude cache hierarchy latencies",
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
        "L1 ~4-5 cycles, L2 ~12-20 cycles, L3 ~40-75 cycles, DRAM ~200-300+ cycles — each level is " +
          "roughly 3-5x slower than the one above it, and the L3-to-DRAM gap is the largest jump " +
          "of all",
        "L1 ~50 cycles, L2 ~100 cycles, L3 ~150 cycles, DRAM ~200 cycles — a roughly linear " +
          "progression",
        "All three cache levels are within 2 cycles of each other; only DRAM is meaningfully " +
          "slower",
        "L1 ~4 cycles, L2 ~8 cycles, L3 ~1000 cycles, DRAM ~1200 cycles — L3 is nearly as slow as " +
          "DRAM",
      ],
      correctIndex: 0,
    },
    explanation:
      "The cache hierarchy is built as a series of exponentially larger, exponentially slower " +
      "levels precisely to hide the enormous latency gap between core execution speed and DRAM. " +
      "L1 is small (tens of KB), physically adjacent to the execution units, and tuned for a load-" +
      "to-use latency of around 4-5 cycles; L2 is larger (hundreds of KB to a few MB) and further " +
      "away, costing roughly 12-20 cycles; L3 (shared, several MB to tens of MB, often off to the " +
      "side of the die or in a ring/mesh interconnect) costs roughly 40-75 cycles; and a genuine " +
      "DRAM access, which must traverse the memory controller and the DRAM row activation/column " +
      "access protocol off-chip, costs on the order of 200-300+ cycles — by far the largest single " +
      "jump in the hierarchy. This is why working-set size relative to L2/L3 capacity, and access " +
      "pattern predictability (for prefetching), dominate the performance of memory-bound HPC " +
      "code far more than instruction count does.",
  },
  {
    id: "computer-architecture-cache-inclusive-exclusive-09",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Back-invalidation in an inclusive cache hierarchy",
    tags: ["cache-hierarchy", "inclusion-policy"],
    type: "trace",
    prompt:
      "A core's L3 is strictly inclusive of its L1 and L2 (every line resident in L1 or L2 is " +
      "guaranteed to also be resident in L3). The core is actively, repeatedly hitting on a line " +
      "in its L1 — it's genuinely hot. Meanwhile, unrelated activity from other cores fills L3 to " +
      "the point that this line's L3 set becomes full and, per the L3's own replacement policy, " +
      "this exact line is chosen for eviction from L3. What happens to the line in the core's L1?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing — L1 and L3 are independent, so the line safely stays resident in L1 regardless " +
          "of what L3 does",
        "The inclusion property forces a back-invalidation: the line must also be invalidated out " +
          "of the core's L1 (and L2) when it's evicted from L3, so the very next access to it — " +
          "even though it was being hit on constantly a moment ago — misses in L1 and must be " +
          "refilled all the way from memory (or wherever else it now lives)",
        "The line is automatically promoted to a permanently pinned L1 entry that can never be " +
          "evicted from L3 again",
        "L3 silently refuses the eviction to preserve inclusion, growing its effective capacity",
      ],
      correctIndex: 1,
    },
    explanation:
      "An inclusive cache hierarchy's defining invariant is that L3's contents are always a " +
      "superset of what's cached in L1/L2 — this is what lets a coherence snoop check only L3 " +
      "(rather than probing every core's private caches) to know whether any core has a given " +
      "line, which simplifies and speeds up coherence traffic. Maintaining that invariant when L3 " +
      "evicts a line requires back-invalidation: the eviction message is propagated down to force " +
      "the same line out of any L1/L2 that holds it, even if that core was actively using it, " +
      "because otherwise L1/L2 could hold a line L3 no longer tracks, silently breaking the " +
      "inclusion property and, with it, the snoop-filtering optimization it exists to enable. The " +
      "practical cost is that a large, shared L3 under pressure from *unrelated* cores' traffic " +
      "can evict — and thereby forcibly evict from L1/L2 — data one particular core is genuinely, " +
      "repeatedly hot on. Exclusive hierarchies (e.g., AMD's historical designs) avoid this " +
      "specific pathology: a line lives in exactly one level at a time (L3 holds only what's *not* " +
      "in L1/L2, receiving a line only when it's evicted from L2), so L3 pressure never evicts a " +
      "line the core is still actively caching in L1 — at the cost of needing an explicit transfer " +
      "on every L2 eviction instead.",
  },
  {
    id: "computer-architecture-cache-associativity-thrash-10",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Power-of-two stride conflict-miss thrashing",
    tags: ["cache-associativity", "conflict-misses"],
    type: "trace",
    prompt:
      "`matrix` is `N x N` of `double` (8 bytes), with `N = 1024` (a power of two), so each row is " +
      "exactly 8192 bytes. The cache is 8-way set-associative with 64-byte lines. This loop sums " +
      "column-major (inner loop strides down a column, jumping a full row each iteration). What " +
      "happens, and why?",
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
        "No unusual effect — as long as total working set fits in the cache, the access pattern " +
          "doesn't matter",
        "Because 8192 bytes is an exact power-of-two multiple of the cache's set-indexing modulus, " +
          "every element touched by the inner loop maps to the identical cache set; with only 8 " +
          "ways available in that one set, elements conflict-evict each other well before the " +
          "8-way limit's worth of rows can coexist, so the loop thrashes with a stream of conflict " +
          "misses even though the whole matrix is far smaller than total cache capacity",
        "The loop triggers a structural hazard in the memory controller",
        "The compiler refuses to compile a column-major traversal of a row-major array",
      ],
      correctIndex: 1,
    },
    explanation:
      "Which cache set a given address maps to is determined by a fixed slice of the address's " +
      "middle bits (between the line-offset bits and the tag bits). When the stride between " +
      "successive accesses is itself a power of two that's a multiple of (cache size / " +
      "associativity), every access in that stream lands in the same set index, no matter how " +
      "many total sets the cache has. Here, striding by exactly one row (8192 bytes) means every " +
      "`matrix[i][j]` for fixed j hits the same set; only 8 lines (the associativity) can be " +
      "resident there at once, so the 9th distinct row conflict-evicts the 1st, and by the time " +
      "the loop wraps back to reuse the 1st row's line it's long gone — a conflict miss on every " +
      "single access, despite the entire matrix easily fitting within the cache's *total* " +
      "capacity. This is a purely associativity-driven pathology, invisible to a fully-associative " +
      "or even much-higher-associativity cache of the same size. The standard fix is padding — " +
      "allocating each row as N+1 (or some other non-power-of-two-friendly) elements so the row " +
      "stride is no longer an exact alias of the set-indexing modulus, spreading accesses back " +
      "across all sets.",
  },
  {
    id: "computer-architecture-mesi-state-walkthrough-11",
    category: "computer-architecture",
    difficulty: "hard",
    title: "MESI state transitions across two cores",
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
        "A = Modified, B = Invalid — A's write requires an invalidation (BusUpgr/BusRdX) " +
          "transaction that forces out every other sharer's copy before the write can proceed, " +
          "since Modified must be held exclusively by exactly one cache",
        "A = Modified, B = Shared — both keep a valid copy, since MESI allows any number of caches " +
          "to hold the same line even after a write",
        "A = Shared, B = Shared — a write doesn't change cache state, only the value",
        "A = Invalid, B = Invalid — the write goes straight to memory, bypassing both caches",
      ],
      correctIndex: 0,
    },
    explanation:
      "After A's initial read, the line is Exclusive in A (no other cache holds it). When B reads " +
      "it, a coherence snoop finds A's Exclusive copy, A downgrades to Shared, and B loads it as " +
      "Shared — both now hold clean, matching copies, which is exactly what the Shared state " +
      "permits (any number of readers, but no writer). When A then writes, MESI's core invariant " +
      "— a line may be Modified in at most one cache at any time, and if it's Modified anywhere " +
      "it must be Invalid everywhere else — forces A to first issue an invalidation (a BusUpgr if " +
      "A already has the line, or a BusRdX equivalent) that every other sharer, including B, must " +
      "observe and respond to by transitioning their own copy to Invalid before A's write is " +
      "permitted to complete. Only after B's copy is confirmed Invalid does A's line become " +
      "Modified. If B were to read X again afterward, that would trigger a fresh coherence " +
      "transaction: A's Modified data is supplied via a cache-to-cache transfer (and, depending on " +
      "the exact protocol variant, may be written back to memory at that point too), with both " +
      "caches ending up Shared again.",
  },
  {
    id: "computer-architecture-memory-model-tso-arm-litmus-12",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Store-buffering litmus test: x86 TSO vs. ARM",
    tags: ["memory-consistency", "tso", "weak-ordering", "litmus-test"],
    type: "trace",
    prompt:
      "Two hardware threads run raw machine code with no locks, atomics-with-fences, or memory " +
      "barriers of any kind — just plain loads and stores. X and Y both start at 0. Thread 0 " +
      "stores X=1, then loads r1=Y. Thread 1 stores Y=1, then loads r2=X. Is the outcome r1==0 && " +
      "r2==0 (each thread's load reads the *other* thread's variable before that thread's store " +
      "is globally visible) actually observable on real x86 hardware, given that x86 uses the " +
      "comparatively strong TSO (total store order) memory model?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No — TSO forbids all store/load reordering, so r1==0 && r2==0 is impossible on x86; only " +
          "the weakly-ordered ARM model permits it",
        "Yes — this specific pattern (a store followed by a load to a *different* address, with " +
          "no fence between them) is the one reordering TSO explicitly still permits, because each " +
          "core's store buffer can hold the store locally while its own subsequent load bypasses " +
          "it and goes to memory/cache; ARM's weaker model permits the same outcome (and more). An " +
          "explicit MFENCE (or a LOCK-prefixed instruction) between the store and load is required " +
          "on x86 to forbid it",
        "Neither model permits it — global store visibility is instantaneous on any coherent " +
          "cache-coherent multiprocessor",
        "It's only observable on x86, never on ARM, because ARM stores are always immediately " +
          "globally visible",
      ],
      correctIndex: 1,
    },
    explanation:
      "TSO is often summarized as 'strong' relative to weak/relaxed models, which leads to a " +
      "common misconception that it forbids essentially all reordering — but TSO's precise " +
      "definition is that it forbids store-store, load-load, and load-store reordering, while " +
      "explicitly still permitting store-load reordering to different addresses, because each " +
      "core buffers its own stores locally (a store buffer) before they drain out to the coherent " +
      "cache hierarchy and become visible to other cores, and a core's own later loads are allowed " +
      "to bypass its own not-yet-drained stores and complete against memory/cache directly. That's " +
      "exactly the pattern in this litmus test: Thread 0's load of Y can execute (and observe Y's " +
      "old value 0) while Thread 0's store of X is still sitting in Thread 0's local store buffer, " +
      "not yet visible to Thread 1 — and symmetrically for Thread 1 — producing r1==0 && r2==0 on " +
      "real x86 silicon, not merely in some theoretical weak model. ARM's weaker model permits the " +
      "same outcome plus considerably more reordering (including store-store and load-load in " +
      "certain cases without explicit barriers). Forbidding this specific outcome on x86 requires " +
      "an explicit full fence (MFENCE) or a LOCK-prefixed RMW instruction between the store and the " +
      "load, which drains the store buffer before the load is allowed to proceed — precisely the " +
      "mechanism std::memory_order_seq_cst compiles down to on x86.",
  },
  {
    id: "computer-architecture-simd-autovec-dependency-13",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Loop-carried dependency blocks auto-vectorization",
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
        "Yes, trivially — the compiler speculatively computes all lanes and corrects any that " +
          "turn out wrong",
        "No — a[i] depends on a[i-1], a true loop-carried RAW dependency, so each iteration's " +
          "result is required before the next iteration can even begin; SIMD lanes must compute " +
          "several loop iterations' worth of independent results simultaneously, which this " +
          "recurrence structurally forbids, so the compiler falls back to a scalar loop",
        "Yes, because the compiler rewrites the recurrence into a closed-form expression " +
          "automatically",
        "It vectorizes, but silently produces incorrect results for any n > 8",
      ],
      correctIndex: 1,
    },
    explanation:
      "Auto-vectorization fundamentally requires that some fixed-size batch of loop iterations be " +
      "*independent*, so a SIMD instruction can compute all of them in one shot across the vector " +
      "lanes. Here, a[i] cannot be computed without first having a[i-1] — the definition of a " +
      "loop-carried dependency (specifically RAW, since a[i-1] was written by the previous " +
      "iteration and is read by this one) — so lane k's computation is not actually independent of " +
      "lane k-1's; it strictly requires lane k-1's result to be finished first, which defeats the " +
      "entire premise of processing multiple iterations in parallel. The compiler's dependence " +
      "analysis detects this recurrence and refuses to vectorize the loop, emitting ordinary " +
      "scalar code instead (though it may still unroll it). Contrast this with `a[i] = b[i]*2 + " +
      "c[i]`, where each iteration only reads from b and c and writes a distinct a[i] — no " +
      "iteration depends on any other's result — which vectorizes cleanly into wide SIMD loads/" +
      "multiplies/adds/stores.",
  },
  {
    id: "computer-architecture-simd-divergent-branch-14",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Data-dependent branch defeats clean SIMD vectorization",
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
        "It vectorizes exactly like a branch-free loop; SIMD lanes have no concept of control flow " +
          "so the branch is simply irrelevant",
        "The compiler cannot give each SIMD lane independent control flow (all lanes in one vector " +
          "instruction execute the same operation), so a genuine vectorization here requires " +
          "predication: computing both f(data[i]) and g(data[i]) unconditionally for every lane, " +
          "then blending the two results per-lane with a mask derived from the comparison — " +
          "trading branch unpredictability for strictly more (but uniform, branch-free) work; if " +
          "the compiler judges that not profitable (e.g. f/g are expensive or not easily " +
          "vectorizable themselves) it instead leaves the loop scalar, where it pays the original " +
          "branch-misprediction cost per random element",
        "The loop fails to compile because branches are illegal inside vectorizable loops",
        "The compiler vectorizes only the `if` branch and executes the `else` branch scalar, " +
          "alternating between SIMD and scalar mode every iteration",
      ],
      correctIndex: 1,
    },
    explanation:
      "SIMD execution issues one instruction that operates identically across all lanes of a " +
      "vector register — there is no mechanism for lane 3 to take the if-branch while lane 5 takes " +
      "the else-branch within a single instruction stream. To vectorize a loop containing " +
      "data-dependent per-element control flow at all, the compiler must convert control " +
      "dependence into data dependence via predication/masking: evaluate the comparison to produce " +
      "a per-lane boolean mask, unconditionally compute *both* f(data[i]) and g(data[i]) for every " +
      "lane (since some lanes need one and some need the other, and there's no way to skip work " +
      "per-lane), and then select the correct result per lane with a blend/select instruction using " +
      "the mask. This is a real, useful technique, but it's only profitable when the extra " +
      "unconditionally-executed work is cheap relative to the branch-misprediction cost it avoids " +
      "— since data[i] > threshold here is essentially random, the scalar version would mispredict " +
      "roughly half the time (a real, high cost per element), which is exactly the scenario where " +
      "predicated vectorization tends to win; if f or g were expensive, opaque (e.g. contain their " +
      "own unpredictable branches or aren't vectorizable), the compiler may instead conservatively " +
      "leave the loop scalar.",
  },
  {
    id: "computer-architecture-register-renaming-war-waw-15",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Register renaming eliminates WAR/WAW despite few architectural registers",
    tags: ["register-renaming", "war-hazard", "waw-hazard", "out-of-order-execution"],
    type: "trace",
    prompt:
      "An ISA exposes only 16 architectural general-purpose registers, but the underlying " +
      "out-of-order core has 180+ physical registers. I1 writes architectural register R1. I2, " +
      "independently, also writes architectural R1 (a WAW hazard on paper) using entirely " +
      "different source operands. I3 reads R1 afterward and must see I2's result (a RAW hazard on " +
      "I2). What actually lets I1 and I2 execute out of order — even concurrently — despite both " +
      "targeting the same architectural register?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "They can't — WAW hazards on the same architectural register always force strictly " +
          "in-order, serialized execution regardless of microarchitecture",
        "At rename time, each instruction's *destination* is mapped to a fresh, currently-unused " +
          "physical register from the larger physical register file — I1's write to 'R1' and I2's " +
          "write to 'R1' become writes to two entirely distinct physical registers, so there is no " +
          "actual storage conflict between them and no hazard to enforce; I3 is renamed to read " +
          "whichever physical register I2 (the most recent prior writer of architectural R1 at " +
          "I3's position in program order) was mapped to, correctly preserving the true RAW " +
          "dependency",
        "The compiler statically converts the code to SSA form before it ever reaches the CPU, so " +
          "the hardware never sees the conflict",
        "The cache-coherence protocol silently versions each write to R1",
      ],
      correctIndex: 1,
    },
    explanation:
      "WAR and WAW hazards are not true data dependencies — they're artifacts of a limited number " +
      "of *names* (architectural registers) being reused, not of any actual value flowing between " +
      "the instructions. Register renaming exploits exactly this: a rename table (register alias " +
      "table) maps each architectural register name to whichever physical register currently holds " +
      "its live value, and every instruction that *writes* a register is allocated a brand-new " +
      "physical register for that write at rename time, updating the map. Because I1 and I2 each " +
      "get their own distinct physical register for their respective writes to architectural R1, " +
      "there's no longer any real storage they're contending over, so the WAW hazard is eliminated " +
      "entirely — the two instructions can be scheduled and executed in any order, even the same " +
      "cycle, purely bound by their own operand readiness. I3's read of architectural R1 is renamed " +
      "at the same time to reference specifically the physical register I2's write is targeting " +
      "(the correct producer per program order), preserving the genuine RAW dependency I3 actually " +
      "has. This is precisely why real out-of-order cores can have vastly more in-flight, " +
      "overlapping computation than the ISA's small architectural register count would naively " +
      "suggest is possible — the architectural register file is just a naming convention, not the " +
      "actual physical storage the hardware executes against.",
  },
  {
    id: "computer-architecture-store-load-forwarding-stall-16",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Store-to-load forwarding: clean forward vs. forwarding stall",
    tags: ["store-buffer", "load-store-forwarding", "memory-disambiguation"],
    type: "trace",
    prompt:
      "In scenario A, a store writes a full 8-byte value at address p, and the very next " +
      "instruction loads a full 8 bytes from the exact same address p, before the store has " +
      "drained to cache. In scenario B, that same 8-byte store is immediately followed by a load " +
      "of only 4 bytes starting at address p+4 (the upper half of the just-stored value — a " +
      "partial, offset overlap rather than an exact address+size match). On typical x86 " +
      "microarchitectures, how do these two loads differ?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int64_t* p64 = &x;
*p64 = 0x1122334455667788LL;

// Scenario A:
int64_t a = *p64;                                   // same address, same 8-byte width

// Scenario B:
int32_t* p32 = reinterpret_cast<int32_t*>(p64);
int32_t  b = *(p32 + 1);                             // upper 4 bytes only — partial overlap`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both loads forward cleanly from the store buffer with no extra latency — the store " +
          "buffer always resolves any degree of overlap between a pending store and a later load",
        "Scenario A forwards cleanly from the store buffer at essentially no extra cost, since the " +
          "load's address and width exactly match the pending store. Scenario B, a partial/" +
          "misaligned overlap that most store-forwarding hardware cannot service directly, " +
          "typically triggers a store-to-load-forwarding stall: the load can't be satisfied from " +
          "the store buffer and must instead wait for the store to retire and commit to cache " +
          "before re-issuing, a penalty on the order of many cycles, comparable to a cache-miss-" +
          "like delay, versus scenario A's near-zero cost",
        "Neither forwards; both always stall, because store-to-load forwarding does not exist on " +
          "any x86 microarchitecture",
        "Scenario B is faster than scenario A because it transfers fewer bytes",
      ],
      correctIndex: 1,
    },
    explanation:
      "Store buffers exist so a core's own subsequent loads don't have to wait for every store to " +
      "drain all the way to the cache/memory hierarchy before being satisfied — the load checks " +
      "the store buffer for a matching pending store and, if found, forwards the buffered data " +
      "directly. That fast path, however, is typically implemented for the common case of an exact " +
      "address-and-width match (or occasionally a load fully contained within a single prior " +
      "store), because building general-purpose byte-granularity overlap-resolution logic for " +
      "every possible partial/misaligned overlap is expensive in hardware and rarely worth it. " +
      "Scenario A hits that fast path directly. Scenario B's load only wants the upper 4 of the " +
      "pending store's 8 bytes at a non-matching base address — a partial overlap the forwarding " +
      "logic on most mainstream x86 implementations cannot resolve — so the load is instead blocked " +
      "(often flagged by hardware performance counters as a 'store forward block' or similar) until " +
      "the store actually commits to the cache, at which point the load re-issues and reads it " +
      "normally from there. This is a real, measurable performance pitfall in low-level code that " +
      "reinterprets/aliases memory at mismatched widths shortly after writing it — a classic trap " +
      "for hand-rolled serialization or type-punning code in latency-sensitive systems.",
  },
  {
    id: "computer-architecture-prefetch-stride-vs-pointer-chase-17",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Hardware stride prefetcher vs. pointer chasing",
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
        "Both should perform identically — total bytes touched and total instructions executed are " +
          "the dominant cost, not the access pattern",
        "Traversal A's constant stride is detected by the hardware stride prefetcher after a few " +
          "accesses, which then issues prefetch requests well ahead of the demand stream, hiding " +
          "most of DRAM latency behind useful work; traversal B's next address is only known after " +
          "dereferencing the current node (it's data-dependent, not a fixed offset), so there is no " +
          "stride for the prefetcher to detect, and each hop pays the full serial DRAM latency with " +
          "essentially no overlap with the next hop's access",
        "std::list has a larger per-element memory overhead than std::vector, and that overhead " +
          "alone accounts for the entire slowdown",
        "The prefetcher actively mispredicts and prefetches the wrong cache lines for linked-list " +
          "traversal, actively slowing it down below what no prefetching at all would achieve",
      ],
      correctIndex: 1,
    },
    explanation:
      "A hardware stride prefetcher watches the sequence of addresses a core accesses and, once it " +
      "detects a consistent fixed offset between consecutive accesses (a stride), starts issuing " +
      "speculative loads for addresses further ahead in that same pattern — for traversal A's " +
      "unit-stride array walk, this means the data the loop will need several iterations from now " +
      "is often already sitting in L1/L2 by the time the loop actually reaches it, so the ~200+-" +
      "cycle DRAM latency is amortized/hidden behind the prefetcher running ahead of demand. " +
      "Traversal B has no such exploitable structure: `node->next` is a value that only becomes " +
      "known once `node` itself has been loaded and dereferenced — there is no fixed address " +
      "offset a prefetcher could speculate on, since the next node's address depends entirely on " +
      "allocation order/history and can be anywhere in the heap. Each hop is therefore a fully " +
      "serial round trip — issue the load, wait out however much of the ~200-300+ cycle DRAM " +
      "latency isn't already hidden, get the address, only then can the next dereference even " +
      "begin — with essentially zero memory-level parallelism between consecutive hops. This is why " +
      "cache-friendly, contiguous data structures (arrays, or intrusive/flattened trees) so often " +
      "dramatically outperform pointer-heavy structures for traversal-heavy workloads, even when " +
      "both are asymptotically 'O(n)'.",
  },
  {
    id: "computer-architecture-write-combining-buffer-18",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Write-combining buffers and interleaved partial-line writes",
    tags: ["write-combining", "uncacheable-memory", "bus-transactions"],
    type: "trace",
    prompt:
      "A tight loop writes small 4-byte values to a memory region marked write-combining (WC) — " +
      "e.g., a GPU/device-mapped ring buffer over PCIe — rather than normal cacheable write-back " +
      "memory. The core provides only a handful of write-combining buffer entries (each capable of " +
      "accumulating one cache-line's worth of pending writes before it must be flushed as a single " +
      "bus transaction). Case A: the loop finishes writing every byte of one cache line's worth of " +
      "data before moving on to the next line. Case B: the loop interleaves small writes across " +
      "more distinct cache lines than there are WC buffer entries, touching each line only " +
      "sporadically. How do these two access patterns differ in practice?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No difference — write-combining buffers guarantee full coalescing into single-line burst " +
          "transactions regardless of interleaving pattern or buffer count",
        "Case A lets each line's WC buffer entry stay open and accumulate all of that line's writes " +
          "before eviction, so it flushes as one efficient, wide, coalesced burst transaction. Case " +
          "B forces premature evictions — once more distinct lines are being written concurrently " +
          "than there are buffer entries, an entry must be flushed (partially filled) to make room " +
          "for a newly-touched line, so many of the underlying writes go out as small, separate, " +
          "inefficient bus transactions instead of a few large coalesced ones",
        "Case B is strictly faster, because touching more cache lines increases effective bus " +
          "parallelism",
        "Write combining only applies to reads, so neither case benefits from it at all",
      ],
      correctIndex: 1,
    },
    explanation:
      "Write-combining memory exists specifically for streaming writes to uncacheable regions " +
      "(classically MMIO/device memory, e.g. a GPU aperture) where ordinary write-back caching " +
      "isn't applicable but issuing a separate bus transaction for every individual small store " +
      "would be prohibitively slow. A small number of dedicated WC buffers — typically just a " +
      "handful of entries on mainstream x86 cores — each hold one cache-line-sized address range " +
      "open, merging (coalescing) any writes that land within it, and only flush out to the bus as " +
      "one transaction when the entry is evicted (by running out of buffers, an explicit fence/" +
      "SFENCE, a CLFLUSH, or certain other events). If software writes out an entire line's worth " +
      "of data before touching any other line (case A), that line's entry stays open the whole " +
      "time and flushes as a single, wide, efficient burst — exactly the intended fast path. If " +
      "software instead interleaves writes across more distinct lines than there are buffer " +
      "entries (case B), the WC buffers thrash: an entry gets evicted, only partially filled, to " +
      "make room for a newly-touched line, so its writes go out as several small, separate " +
      "transactions rather than being coalesced — which, over a narrow, latency-sensitive bus like " +
      "PCIe, can be dramatically slower than the equivalent line-at-a-time access pattern despite " +
      "moving the exact same total number of bytes.",
  },
  {
    id: "computer-architecture-tlb-huge-pages-19",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Why huge pages reduce TLB pressure",
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
        "Huge pages make individual TLB lookups faster per access, independent of miss rate",
        "A TLB has a fixed number of entries regardless of page size, but each entry now covers a " +
          "512x larger contiguous region of virtual address space (2 MB instead of 4 KB); the same " +
          "fixed-size TLB can therefore 'reach' — cover without a miss — a much larger working set " +
          "before it runs out of entries, since far fewer distinct mappings are needed to describe " +
          "the same footprint, directly cutting the frequency of expensive page-table-walk-inducing " +
          "TLB misses",
        "Huge pages eliminate page faults entirely, since the whole region is mapped before first " +
          "use",
        "Huge pages increase the CPU's L1 cache line size to match, improving spatial locality",
      ],
      correctIndex: 1,
    },
    explanation:
      "A TLB caches a fixed number of virtual-to-physical page translations; its effective " +
      "'reach' — the largest working set it can fully cover without missing — is simply (number of " +
      "entries) x (page size). With 4 KB pages, a 64-entry L1 DTLB only reaches 256 KB, far smaller " +
      "than a 4 GB working set, so essentially every access outside that tiny reach window misses " +
      "and requires the hardware page-table walker to walk the (typically 4-level, on x86-64) page " +
      "tables — itself a handful of dependent memory accesses, potentially each a cache miss, " +
      "easily costing 50-100+ cycles per TLB miss even before accounting for the actual data " +
      "access. Switching to 2 MB pages doesn't change the TLB's entry count, but each entry now " +
      "covers 512x more address space, so the same 64-entry L1 DTLB now reaches 128 MB — and a " +
      "1,500-entry L2 TLB reaches roughly 3 GB, covering nearly the entire 4 GB working set outright " +
      "— reducing the number of distinct mappings needed from ~1,000,000 down to ~2,048, which fits " +
      "comfortably. This is precisely why large in-memory databases, JVMs/GC heaps, and HPC codes " +
      "with big working sets commonly use explicit huge pages (`madvise(MADV_HUGEPAGE)`, " +
      "hugetlbfs, or transparent huge pages) — the benefit is specifically about TLB reach, not " +
      "raw memory bandwidth or cache behavior.",
  },
  {
    id: "computer-architecture-dma-cache-coherence-20",
    category: "computer-architecture",
    difficulty: "medium",
    title: "DMA, CPU concurrency, and a non-coherent DMA coherence bug",
    tags: ["dma", "cache-coherence", "device-drivers"],
    type: "trace",
    prompt:
      "A NIC performs a DMA transfer, writing incoming packet data directly into a buffer in main " +
      "memory, on a platform where DMA is *not* automatically snooped/kept coherent with the CPU's " +
      "caches (some embedded SoCs, and certain buffer/bus configurations even on larger systems). " +
      "The CPU had previously read that same buffer region, so a stale copy may still sit in its " +
      "cache. After the DMA completes and the driver is notified, the CPU reads the buffer through " +
      "an ordinary load instruction with no special handling. What's the risk, and why does DMA " +
      "let the CPU keep executing other code during the transfer in the first place?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No risk at all — DMA is always transparently cache-coherent on every platform by " +
          "definition, and DMA lets the CPU continue executing because it uses a dedicated engine " +
          "to move data independently of the CPU, only interrupting it on completion rather than " +
          "requiring the CPU to poll or move the bytes itself",
        "DMA offloads the actual data movement to a separate engine so the CPU is free to execute " +
          "unrelated instructions and is only notified (typically via interrupt) on completion, " +
          "rather than having to poll or copy the bytes itself. But on a non-coherent platform, the " +
          "CPU's stale cached copy of the buffer is never automatically updated by the DMA write " +
          "that landed directly in memory — an ordinary load can return the old cached data instead " +
          "of what the device just wrote, unless the driver explicitly invalidates the relevant " +
          "cache lines (before reading DMA'd-in data) or flushes them (before letting the device " +
          "read CPU-written data), using explicit cache-maintenance operations around the transfer",
        "DMA transfers always block the CPU until completion, identically to polling, so there is " +
          "no concurrency benefit at all",
        "The risk is a TLB miss, not a cache coherence issue, since DMA operates purely on physical " +
          "addresses",
      ],
      correctIndex: 1,
    },
    explanation:
      "DMA's whole purpose is to let a device move a block of data to or from memory using its own " +
      "dedicated engine, entirely independent of the CPU's instruction stream, so the CPU can " +
      "execute unrelated useful work during the transfer and only needs to be notified (usually via " +
      "an interrupt) once it's done — this is strictly better than either the CPU busy-polling a " +
      "status register or, far worse, the CPU itself copying every byte via load/store instructions " +
      "(programmed I/O). The subtlety is that DMA engines on some platforms write directly to main " +
      "memory, bypassing the CPU's cache hierarchy entirely, without generating the coherence " +
      "traffic (snoops/invalidations) an equivalent CPU store would generate. On such non-coherent " +
      "DMA platforms, if the CPU has a stale cached copy of the destination buffer from before the " +
      "transfer, an ordinary load after the DMA completes can silently return old data rather than " +
      "what the device just wrote — and conversely, a dirty CPU cache line covering that buffer " +
      "could later get written back to memory and clobber data the device already DMA'd in, or a " +
      "device DMA-*reading* stale memory if the CPU's dirty writes haven't been flushed yet. Driver " +
      "code on such platforms must explicitly manage this with cache-maintenance instructions — " +
      "invalidate the relevant lines before reading device-written data, flush (clean) them before " +
      "letting the device read CPU-written data — which is exactly what Linux's " +
      "`dma_sync_single_for_cpu`/`dma_sync_single_for_device` (and the underlying architecture-" +
      "specific cache-maintenance ops) exist to do. Fully cache-coherent DMA (common on modern x86/" +
      "server platforms, where DMA is snooped into the coherence domain like any other agent) " +
      "avoids this class of bug entirely, but it is a platform property, not a universal guarantee.",
  },
  {
    id: "computer-architecture-smt-resource-contention-21",
    category: "computer-architecture",
    difficulty: "hard",
    title: "SMT sibling contention for shared core resources",
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
        "No effect — the two logical threads are genuinely independent cores as far as execution " +
          "resources are concerned; SMT only shares the instruction fetch unit",
        "Logical thread 1's IPC measurably degrades, because SMT siblings share nearly every " +
          "core-level microarchitectural resource — fetch/decode bandwidth, the issue ports and " +
          "execution units, reorder buffer/scheduler/physical register file entries (statically " +
          "partitioned or dynamically contended for, depending on the design), and the L1/L2 caches " +
          "— so thread 0's heavy, sustained FMA usage starves thread 1 of issue slots and pollutes " +
          "shared cache capacity, even though architecturally the two threads look like separate " +
          "cores to software",
        "Logical thread 1 speeds up, because thread 0's FP-heavy code leaves the integer ALUs " +
          "entirely free for exclusive use by thread 1",
        "The core automatically disables SMT and falls back to single-threaded mode whenever one " +
          "logical thread saturates an execution unit",
      ],
      correctIndex: 1,
    },
    explanation:
      "SMT/Hyper-Threading exposes one physical core as two (or more) logical cores to software " +
      "precisely by duplicating only the architectural state needed to track two independent " +
      "instruction streams (register files/rename tables, program counters, etc.) while sharing " +
      "essentially all of the actual execution machinery: the front-end fetch/decode bandwidth, the " +
      "issue ports and functional units (ALUs, FP/vector units, load/store units), and — depending " +
      "on the exact microarchitecture — the reorder buffer, scheduler queue entries, and physical " +
      "register file, plus the L1 and L2 caches unconditionally. SMT's value proposition is filling " +
      "the idle execution slots that a single thread leaves on the table during stalls (e.g. a " +
      "cache miss or a dependency chain bubble) with a second thread's independent work — not " +
      "providing two genuinely independent cores' worth of throughput. When one sibling saturates a " +
      "shared resource — here, thread 0's AVX FMA stream keeps the FP/vector ports continuously " +
      "occupied, and its working set pressures the shared L1/L2 — thread 1 is left competing for " +
      "whatever fetch/decode cycles, issue slots, and cache capacity remain, so its effective IPC " +
      "drops measurably relative to running alone on the core. This is exactly why latency-" +
      "sensitive HPC/trading workloads frequently disable SMT (or pin only one logical thread per " +
      "physical core) for their hottest paths — predictable, uncontended access to shared " +
      "execution resources is often worth more than the extra logical thread's nominal throughput.",
  },
  {
    id: "computer-architecture-store-buffer-forwarding-22",
    category: "computer-architecture",
    difficulty: "hard",
    title: "A core sees its own store before other cores do",
    tags: ["store-buffer", "memory-ordering", "tso"],
    type: "trace",
    prompt:
      "Core A executes a store to address X (value 1), followed immediately by a load of X. At " +
      "this point the store has not yet drained out of Core A's store buffer into the coherent " +
      "cache hierarchy, so Core B — which also has X cached — still observes the old value if it " +
      "were to read X right now. Does Core A's own very next load of X see the value it just " +
      "stored (1), or the old value that other cores still see?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Core A's load must wait until the store fully drains to the coherent cache/memory and " +
          "becomes visible to other cores before it can complete — same latency and same value " +
          "visibility as Core B would get",
        "Core A's load checks its own store buffer first and forwards the pending value directly " +
          "(store buffer forwarding / store-to-load forwarding), so it sees its own just-written 1 " +
          "immediately — well before that store is globally visible to Core B or any other core. A " +
          "core is always guaranteed to observe its own stores in program order, but other cores " +
          "can lag behind that, which is exactly the mechanism that permits the classic store-" +
          "buffering (SB) litmus test's surprising outcome even under x86 TSO",
        "The load returns an unspecified/undefined value until the store commits",
        "This configuration is illegal — a core is never allowed to load an address it has a " +
          "pending store to",
      ],
      correctIndex: 1,
    },
    explanation:
      "If a core's own loads had to wait for every one of its own prior stores to fully drain all " +
      "the way out to the coherent cache hierarchy before proceeding, single-threaded performance " +
      "would collapse — every store-then-load-same-address sequence (extremely common) would stall " +
      "for the store's full latency. Store buffer forwarding avoids this: a load checks the core's " +
      "own store buffer for a matching pending store before (or instead of) going to the cache, and " +
      "if found, forwards that value directly, letting the load complete immediately. Program order " +
      "within a single core is therefore always preserved from that core's own point of view — it " +
      "never sees its own stores 'out of order.' The catch is that other cores have no visibility " +
      "into Core A's store buffer at all; they only observe the store once it actually drains and " +
      "becomes globally visible through the coherence protocol, which can happen well after Core A " +
      "itself already 'saw' the new value via forwarding. This asymmetry — a core seeing its own " +
      "stores early, while other cores can still see stale values — is precisely the microarchitectural " +
      "mechanism underlying the store-buffering (SB) litmus test result: two cores can each read " +
      "the other's variable as still-old, momentarily, even though each has already 'written and " +
      "read back' its own variable locally.",
  },
  {
    id: "computer-architecture-ilp-dependency-chain-23",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Dependency chains vs. independent ops on a superscalar core",
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
        "They finish in the same number of cycles — a 4-wide core issues 4 ops/cycle regardless of " +
          "dependencies, so both are bound purely by instruction count",
        "Version B finishes sooner: version A's critical path is the full length of its dependency " +
          "chain (5 sequential adds, each waiting on the previous one's result — 5 cycles minimum, " +
          "however wide the machine is, since issue width goes unused when there's nothing " +
          "independent ready to issue), while version B's first three adds have no dependency on " +
          "each other and can all issue the same cycle, cutting the critical path roughly in half",
        "Version A finishes sooner, because fewer temporary variables means fewer physical " +
          "registers are needed",
        "Both stall indefinitely, since neither version fits in a single fetch bundle",
      ],
      correctIndex: 1,
    },
    explanation:
      "A superscalar core's issue width (how many instructions it *can* dispatch per cycle) is an " +
      "upper bound, not a guarantee — it can only be reached when enough independent, ready " +
      "instructions actually exist in the same cycle. Version A is a strict, linear dependency " +
      "chain: each add's operand is the previous add's result, so the second add cannot even begin " +
      "until the first has produced its output, and so on — the critical path is exactly 5 " +
      "sequential 1-cycle adds, i.e. 5 cycles minimum, and the core's remaining 3 issue slots each " +
      "cycle simply go unused because there's nothing else ready to fill them. Version B restructures " +
      "the exact same mathematical computation (same associative operation, same operand count) so " +
      "that `p = a+b`, `q = c+d`, and `r = e+f` are mutually independent — all three can issue and " +
      "execute in the very same cycle across separate ALU ports — after which only two more " +
      "dependent adds remain to combine p, q, and r, for a critical path of roughly 3 cycles total " +
      "instead of 5. This is the essence of instruction-level parallelism: total instruction count " +
      "is a poor predictor of runtime on an out-of-order superscalar core; the length of the " +
      "longest true dependency chain (the critical path) is what actually bounds performance, and " +
      "restructuring code to shorten or parallelize dependency chains — exactly what compilers " +
      "attempt via reassociation, and what expert HPC code does by hand for reductions — is a real, " +
      "significant optimization technique.",
  },
  {
    id: "computer-architecture-false-sharing-mesi-24",
    category: "computer-architecture",
    difficulty: "hard",
    title: "False sharing traced through MESI transitions",
    tags: ["false-sharing", "cache-coherence", "mesi"],
    type: "trace",
    prompt:
      "Two `int64_t` counters, `a` and `b`, live 8 bytes apart in memory — well within the same 64-" +
      "byte cache line. Core 0 repeatedly writes only `a`; Core 1 repeatedly writes only `b`; " +
      "neither core ever touches the other's variable. In precise MESI terms, why does this run " +
      "far slower than if `a` and `b` were on separate cache lines, given that the two cores never " +
      "actually share any data?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It doesn't — MESI coherence operates per-variable, not per-cache-line, so two cores " +
          "writing distinct variables never generate any coherence traffic regardless of their " +
          "physical proximity in memory",
        "Coherence operates at cache-line granularity, not byte/variable granularity: every write " +
          "by one core forces the *entire line* to Invalid in the other core's cache, regardless of " +
          "which of the two variables was actually touched. So each core's next write to its own " +
          "variable finds its local copy Invalid and must first issue a coherence transaction " +
          "(invalidating/fetching the line, e.g. via BusUpgr/BusRdX) to regain exclusive Modified " +
          "ownership before the write can proceed — the line perpetually ping-pongs Modified <-> " +
          "Invalid between the two caches, so essentially every write pays a cross-core coherence-" +
          "transaction latency instead of completing as a fast, purely local L1 hit",
        "False sharing silently corrupts one or both counters' final values, which is the actual " +
          "source of the slowdown (extra retries to reach a correct result)",
        "The slowdown is caused by the TLB, not cache coherence — each write triggers a page-table " +
          "walk",
      ],
      correctIndex: 1,
    },
    explanation:
      "MESI (and every mainstream hardware coherence protocol) tracks state per cache line, because " +
      "that's the unit caches actually move and invalidate — there is no hardware concept of " +
      "'invalidate just these 8 bytes.' When Core 0 writes `a`, it must gain the line in Modified " +
      "state, which requires invalidating any other cache holding it — including Core 1's copy, " +
      "even though Core 1's copy is only 'needed' for the unrelated `b`. The instant Core 1 next " +
      "writes `b`, it finds its own cached copy Invalid (evicted by Core 0's write), so it must " +
      "issue its own coherence transaction to re-fetch the line (now Modified in Core 0, requiring a " +
      "cache-to-cache transfer) and invalidate Core 0's copy in turn to gain its own Modified " +
      "ownership. Every single write from either core therefore triggers a cross-core coherence " +
      "round trip — the line perpetually bounces Modified/Invalid between the two caches — turning " +
      "what should be a ~1-cycle local L1 hit into an operation bound by inter-core communication " +
      "latency (potentially tens to 100+ cycles for a cache-to-cache transfer), even though the two " +
      "cores' actual data is logically completely independent. This is precisely why false sharing " +
      "is invisible at the level of program correctness — no race, no wrong values, nothing a " +
      "debugger would ever flag — yet catastrophic for throughput, and why the fix (padding/" +
      "aligning each independently-written variable to its own cache line, e.g. `alignas(64)`) is " +
      "purely about layout, not logic.",
  },
  {
    id: "computer-architecture-branchless-cmov-25",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Branchless arithmetic to eliminate misprediction cost",
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
    else             sum -= arr[i];
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
        "Version A is faster — fewer total instructions always wins on a modern core",
        "Version B is typically faster: version A's branch outcome is effectively random per " +
          "element, so the branch predictor mispredicts roughly half the time, and each " +
          "misprediction costs a full pipeline flush (order of ~15-20 cycles) — far more expensive " +
          "than the handful of extra, but cheap and fully pipelined, ALU instructions version B " +
          "executes unconditionally every iteration. Trading guaranteed small extra work for " +
          "removing an unpredictable branch entirely is a real, standard optimization in low-" +
          "latency/HPC code",
        "Both run identically, since the compiler always converts A into B automatically regardless " +
          "of branch predictability",
        "Version B is undefined behavior because `mask` may be a negative int used in a bitwise op",
      ],
      correctIndex: 1,
    },
    explanation:
      "The relevant cost comparison isn't instruction count in the abstract, it's expected cycles: " +
      "version A's branch depends on essentially-random per-element data, so a modern branch " +
      "predictor — no matter how sophisticated — cannot do meaningfully better than chance on it, " +
      "meaning roughly half of all iterations mispredict; each misprediction forces the core to " +
      "squash whatever wrong-path work it spent this deep, wide pipeline speculatively executing and " +
      "refill from the correct target, typically costing on the order of 15-20 cycles on a " +
      "contemporary out-of-order core. Version B replaces that gamble with a small, fixed number of " +
      "extra ALU instructions (a negation, two ANDs, a subtraction) executed unconditionally, every " +
      "iteration, with no branch at all — cheap, fully pipelined, and predictable work that a 4+-" +
      "wide superscalar core can issue essentially for free relative to a misprediction's cost. This " +
      "trade — deterministic small overhead in exchange for eliminating an unpredictable branch — is " +
      "exactly what compilers attempt automatically via conditional-move (cmov) generation for " +
      "simple enough conditionals, and exactly what HPC/low-latency-trading engineers do by hand " +
      "(via cmov intrinsics, bit tricks, or SIMD masking/blend) when the compiler doesn't or can't: " +
      "removing tail-latency variance from data-dependent branches is often worth more than average-" +
      "case instruction-count purity. (`mask` here is fine: `-(arr[i] & 1)` is 0 or 1 before the " +
      "negation, and negating a small non-negative int is well-defined two's-complement bit " +
      "manipulation.)",
  },
  {
    id: "computer-architecture-aos-vs-soa-cache-line-26",
    category: "computer-architecture",
    difficulty: "easy",
    title: "Wasted cache-line bandwidth from array-of-structs field extraction",
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
        "100% — the cache only ever fetches the exact bytes a load instruction requests",
        "Only 25%: every 64-byte line fetched brings in 4 whole Points (x,y,z,w each), but the loop " +
          "only ever reads the x field, so 3 of every 4 floats (y, z, w) pulled into cache and " +
          "occupying cache/bandwidth are pure waste — an array-of-structs (AoS) layout used this " +
          "way wastes 3/4 of the memory bandwidth and effective cache capacity a structure-of-" +
          "arrays (SoA) layout (a separate contiguous `x[]` array) would need for the same " +
          "computation",
        "50%, because floats are 4 bytes and cache lines fetch in 8-byte granules",
        "It depends on compiler optimization level, but is always at least 90% in practice",
      ],
      correctIndex: 1,
    },
    explanation:
      "Caches always fetch in whole-line granules (here, 64 bytes) regardless of how many bytes " +
      "the triggering load actually asked for — there's no such thing as fetching 'just the x " +
      "field.' Since each Point is 16 bytes, one 64-byte line holds exactly 4 complete Points, i.e. " +
      "16 floats, but the loop only ever reads 4 of those 16 floats (one x per Point) — meaning 12 " +
      "of the 16 floats transferred from memory into cache are pulled in and occupy cache capacity " +
      "for no benefit at all. This is the classic argument for structure-of-arrays (SoA) layout in " +
      "performance-sensitive code: storing all x values contiguously in their own array means every " +
      "byte of every fetched cache line is one this loop actually consumes, quadrupling effective " +
      "memory bandwidth utilization and cache capacity for this specific access pattern (at the " +
      "cost of worse locality if some *other* code path needs to access x, y, z, and w together for " +
      "the same Point). Which layout wins depends entirely on the dominant access pattern — AoS is " +
      "better when whole objects are usually processed together; SoA is better when the same single " +
      "field is processed across many objects, exactly as here.",
  },
  {
    id: "computer-architecture-misprediction-penalty-cycles-27",
    category: "computer-architecture",
    difficulty: "medium",
    title: "Quantifying the branch misprediction penalty",
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
        "Roughly 1 cycle — out-of-order cores hide almost the entire penalty via speculation",
        "Roughly 15-20 cycles — the penalty is, to first order, bounded by the number of pipeline " +
          "stages between fetch and the point where the branch's true outcome/target is finally " +
          "known: everything speculatively fetched, decoded, renamed, and issued down the wrong " +
          "path across that entire span must be squashed from the ROB/scheduler, and the front end " +
          "must restart fetching at the correct target and refill the whole pipeline before " +
          "meaningful retirement resumes",
        "Roughly 1,000+ cycles — comparable to a full DRAM access, since the branch's target must " +
          "be fetched from main memory",
        "Exactly 0 cycles whenever the branch was predicted with high confidence, regardless of " +
          "whether the prediction turns out right or wrong",
      ],
      correctIndex: 1,
    },
    explanation:
      "The misprediction penalty is fundamentally a function of pipeline depth: a mispredicted " +
      "branch means every instruction fetched, decoded, and issued speculatively down the wrong " +
      "path during the stages between fetch and the branch's actual resolution point represents " +
      "wasted work that must be discarded, and the front end has nothing correct to feed the back " +
      "end until it restarts fetching from the correct target and that new stream works its way " +
      "back through the same number of stages before instructions can retire again. On a " +
      "contemporary deep out-of-order core with roughly 15-20 stages between fetch and branch " +
      "resolution, that translates to roughly 15-20 lost cycles per misprediction — independent of " +
      "how 'confident' the predictor was, since confidence doesn't change the pipeline depth the " +
      "recovery has to traverse. This single number is the crux of why branch predictor accuracy " +
      "matters so much on modern cores: a 95% vs. 99% prediction accuracy on a hot, frequently-" +
      "executed branch can be the difference between a workload being front-end-bound by " +
      "misprediction recovery versus not, and it's exactly why deeper pipelines (which buy higher " +
      "clock frequency) trade off against a steeper misprediction penalty, pushing designs toward " +
      "ever more sophisticated predictors (two-level, TAGE, neural/perceptron-based) to keep " +
      "accuracy high enough to justify the depth.",
  },
  {
    id: "computer-architecture-loop-unrolling-ilp-28",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Multiple accumulators break a reduction's dependency-chain bottleneck",
    tags: ["ilp", "loop-unrolling", "reduction"],
    type: "trace",
    prompt:
      "Assume floating-point `add` has a 4-cycle latency but the core can issue a new independent " +
      "add every cycle (throughput 1/cycle across multiple FP add pipelines/ports). Version A " +
      "accumulates into a single running sum. Version B unrolls by 4 and accumulates into four " +
      "independent partial sums, combined only once at the very end. For a large array, what's the " +
      "realistic throughput difference?",
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
        "No meaningful difference — both perform the same number of adds, and the core's issue " +
          "width is the only thing that matters",
        "Version A is latency-bound, not throughput-bound: each add must wait for the *previous* " +
          "add's result (a single 4-cycle-latency dependency chain), so a new add can only be " +
          "issued once every 4 cycles regardless of the core's superscalar width, wasting most of " +
          "the available issue slots and add-pipeline throughput. Version B's four accumulators are " +
          "mutually independent, so the core can have up to four adds from different chains in " +
          "flight simultaneously, approaching the 1-add-per-cycle throughput limit instead of the " +
          "4-cycle latency limit — roughly a 4x speedup on the accumulation loop itself",
        "Version B is slower, because it uses four times as many registers",
        "Version A is faster, because it has fewer total instructions in the loop body",
      ],
      correctIndex: 1,
    },
    explanation:
      "A reduction into a single accumulator creates a strict serial dependency chain: `sum += " +
      "a[i]` can't begin until the *previous* iteration's `sum +=` has produced its result, because " +
      "each add both reads and writes the same `sum`. With a 4-cycle add latency, that means a new " +
      "useful add can only be issued once every 4 cycles no matter how many ALU ports or how wide " +
      "the issue width is — the bottleneck is purely the latency of the dependency chain, and 3 out " +
      "of every 4 cycles' worth of issue capacity simply goes unused waiting on the chain. Splitting " +
      "the reduction into 4 independent partial sums breaks that single long chain into 4 separate, " +
      "mutually independent 4-cycle-latency chains — since s0's next add doesn't depend on s1, s2, " +
      "or s3 at all, the core can have all four in flight simultaneously, issuing a new add for " +
      "some chain essentially every cycle instead of every 4th cycle, now bound by the core's add " +
      "throughput (1/cycle) rather than by the chain's latency (4 cycles) — a roughly 4x improvement " +
      "on the accumulation loop's steady-state rate. The one-time combine at the end (`(s0+s1)+" +
      "(s2+s3)`) adds a negligible fixed cost outside the hot loop. This exact technique — breaking " +
      "a serial reduction into several independent partial accumulators sized to the target " +
      "latency/throughput ratio — is a standard, textbook HPC optimization, and is precisely what " +
      "vectorizing compilers and hand-tuned SIMD reduction code do internally (each SIMD lane " +
      "effectively acting as one more independent accumulator).",
  },
  {
    id: "computer-architecture-numa-remote-latency-29",
    category: "computer-architecture",
    difficulty: "hard",
    title: "NUMA remote memory access latency",
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
        "None — a cache-coherent NUMA (ccNUMA) system presents a single memory latency for all " +
          "addresses; 'NUMA' only affects total capacity, not per-access latency",
        "Node 1's accesses to this Node-0-resident buffer incur substantially higher latency (and " +
          "consume shared inter-socket interconnect bandwidth) than local accesses would, because " +
          "each request must cross the inter-socket interconnect to reach Node 0's memory " +
          "controller and typically also perform a remote coherence/directory lookup — even though " +
          "the buffer is architecturally indistinguishable from local memory to software running on " +
          "Node 1",
        "The access fails outright with a segmentation fault, since a core cannot address another " +
          "socket's physical memory",
        "The OS transparently and immediately migrates the entire buffer to Node 1 the first time " +
          "Node 1 touches it, eliminating any latency penalty from the second access onward",
      ],
      correctIndex: 1,
    },
    explanation:
      "ccNUMA (cache-coherent NUMA) systems present a single, flat, coherent physical address space " +
      "to software — any core can legally load or store any address regardless of which socket's " +
      "memory controller actually owns it — but 'can access' and 'accesses equally fast' are " +
      "different things. Physical memory in a multi-socket system is partitioned per node, each " +
      "with its own local memory controller; an access from Node 1 to an address that physically " +
      "lives in Node 0's DRAM must traverse the inter-socket interconnect (UPI/Infinity Fabric/" +
      "equivalent) to reach Node 0's controller, and typically also involves a directory or snoop-" +
      "filter lookup to maintain coherence across sockets — both of which add real, measurable " +
      "latency (often on the order of 1.5-2x+ a local access) beyond what a same-node access costs, " +
      "and both consume shared, finite interconnect bandwidth that competes with other cross-socket " +
      "traffic. Which node a given page's *physical* memory actually lives on is typically decided " +
      "by first-touch (the page is placed local to whichever thread/core first faults it in), not " +
      "by which thread called malloc — so a buffer allocated by one thread but handed off to and " +
      "used by a thread on a different socket routinely ends up permanently 'remote' relative to its " +
      "actual consumer unless something explicitly intervenes. This is exactly why NUMA-aware " +
      "software either pins allocating threads to the node that will do the bulk of the accessing, " +
      "uses explicit node-local allocation APIs (e.g. `numa_alloc_onnode`), or explicitly migrates/" +
      "replicates hot data — leaving placement to chance can silently cost a large, consistent " +
      "fraction of memory-bound performance on multi-socket hardware.",
  },
  {
    id: "computer-architecture-speculative-store-bypass-30",
    category: "computer-architecture",
    difficulty: "hard",
    title: "Memory disambiguation speculation lets a load jump ahead of an older store",
    tags: ["speculative-execution", "memory-disambiguation", "spectre-v4"],
    type: "trace",
    prompt:
      "An out-of-order core encounters, in program order, a store to address `*p` whose address " +
      "isn't fully resolved yet (p is itself the result of a not-yet-complete computation), " +
      "immediately followed by a load from `*q` (q's address ready sooner). Rather than stall the " +
      "load until the older store's address is known and definitively ruled out as aliasing, the " +
      "core's memory disambiguation predictor speculatively guesses that the load does *not* alias " +
      "the pending store, and lets the load execute early against memory/cache. What happens if p " +
      "and q later turn out to actually be equal (a true RAW dependency the core incorrectly bet " +
      "against)?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing — the hardware always waits for every older store's address to resolve before any " +
          "later load is permitted to execute, so this scenario can never arise",
        "The core detects the misspeculation once the store's address is finally resolved and " +
          "compared, and replays/squashes the load and everything that consumed its (now known to " +
          "be stale) value — a recovery broadly comparable in cost to a branch misprediction. This " +
          "speculative 'assume no aliasing' mechanism (memory/store-to-load disambiguation " +
          "prediction) is what lets loads execute ahead of older, address-unresolved stores in the " +
          "common (non-aliasing) case, and it is the specific microarchitectural mechanism " +
          "underlying the Spectre variant 4 (Speculative Store Bypass) side channel",
        "The result is silently and permanently wrong; the core has no mechanism to detect or " +
          "correct this class of error",
        "Compile-time alias analysis guarantees p and q can never alias, so this situation is " +
          "impossible in valid code",
      ],
      correctIndex: 1,
    },
    explanation:
      "Naively, an out-of-order core could always stall a load until every older store's address is " +
      "fully known, guaranteeing correctness but sacrificing significant performance, since the " +
      "large majority of load/store pairs never actually alias in practice. To recover that " +
      "performance, modern cores include a memory disambiguation (store-to-load dependence) " +
      "predictor that learns, per load, whether it has historically aliased with nearby older " +
      "stores, and speculatively allows a load to execute early against memory/cache — ahead of an " +
      "older store whose address isn't resolved yet — whenever it predicts no aliasing, exactly " +
      "like a branch predictor speculating on a not-yet-resolved branch. Compile-time alias " +
      "analysis (e.g. C's restrict-based reasoning) is a separate, conservative, static guarantee " +
      "that constrains what the compiler may assume when generating code; it says nothing about " +
      "runtime pointer values computed via arbitrary indexing/arithmetic, which is exactly the case " +
      "the hardware predictor is dealing with here. Once the store's address genuinely resolves and " +
      "the core discovers p == q (a real RAW hazard it bet against), it must treat this like any " +
      "other misspeculation: squash the load and every downstream instruction that consumed the " +
      "load's now-known-to-be-wrong value, and re-execute them with the correct, forwarded value — a " +
      "recovery whose cost is broadly comparable to a branch misprediction. Crucially — and this is " +
      "exactly the basis of the Spectre variant 4 (Speculative Store Bypass) side channel — the " +
      "transiently-executed, ultimately-squashed instructions can still leave microarchitectural " +
      "traces (e.g. cache lines touched by a load fed from the stale, incorrect value) before the " +
      "misspeculation is caught, which a timing side channel can then probe, exactly as with branch-" +
      "predictor-based Spectre variants.",
  },
];
