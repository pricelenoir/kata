import type { TraceQuestion } from "@/types/question";

export const gpuCudaQuestions: TraceQuestion[] = [
  {
    id: "gpu-cuda-thread-index-01",
    category: "gpu-cuda",
    difficulty: "easy",
    title: "Computing the global thread index",
    tags: ["thread-hierarchy", "indexing"],
    type: "trace",
    prompt:
      "The kernel below is launched as `writeIndex<<<4, 256>>>(out)`. For the thread with " +
      "blockIdx.x == 2 and threadIdx.x == 10, what value does that thread write into `out`?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__global__ void writeIndex(int* out) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    out[idx] = idx;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: ["10", "266", "522", "2570"],
      correctIndex: 2,
    },
    explanation:
      "The standard global-index formula is `blockIdx.x * blockDim.x + threadIdx.x`: it treats " +
      "the grid as a flattened 1-D array of threads, where each block contributes `blockDim.x` " +
      "consecutive slots before the next block's threads begin. With blockDim.x == 256, block 2 " +
      "owns global indices [512, 767]; adding threadIdx.x == 10 gives 522. A common bug is " +
      "swapping the operands to `threadIdx.x * blockDim.x + blockIdx.x`, which produces a " +
      "completely different (and generally overlapping/incorrect) mapping — getting this formula " +
      "backwards is one of the most common entry-level CUDA indexing mistakes.",
  },
  {
    id: "gpu-cuda-thread-index-02",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Missing bounds check on a non-divisible 2D grid",
    tags: ["thread-hierarchy", "indexing", "out-of-bounds"],
    type: "trace",
    prompt:
      "This kernel processes a `width x height` image with `width = height = 1000`, launched as " +
      "`process<<<dim3(32,32), dim3(32,32)>>>(img, 1000, 1000)` (so grid and block dims give " +
      "1024x1024 = 1,048,576 total threads for a 1,000,000-pixel image). There is no bounds " +
      "check before the write. What happens?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__global__ void process(float* img, int width, int height) {
    int col = blockIdx.x * blockDim.x + threadIdx.x;
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int idx = row * width + col;
    img[idx] = img[idx] * 2.0f;   // no "if (row < height && col < width) return;"
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The extra threads are automatically skipped by the hardware since they map past the array bounds, so the output is correct",
        "Compile-time error: grid dimensions must evenly divide the data dimensions",
        "The threads with col >= 1000 or row >= 1000 compute an idx that reads/writes out-of-bounds global memory — since width (1000) isn't a multiple of blockDim.x (32), this isn't just trailing overflow past the end of the buffer; some in-range-looking idx values land inside the array but at the wrong (row, col), silently corrupting neighboring rows, while others run off the end entirely and can fault",
        "Every thread automatically clamps idx to width*height - 1, so results are correct but slower",
      ],
      correctIndex: 2,
      // (kept as reference note, not part of schema): idx computed from col past width doesn't
      // just spill past the buffer end; because width isn't block-aligned, some out-of-range col
      // values combine with row to still land inside [0, width*height) but at a wrong pixel.
    },
    explanation:
      "CUDA performs no automatic bounds checking on global memory accesses — indexing math is " +
      "just pointer arithmetic. Since 1000 is not a multiple of 32, each row of 32-wide blocks " +
      "has col values from 992 to 1023, so cols 1000-1023 are logically out of range for that " +
      "row. Because idx = row*width+col is a flat linear index, an out-of-range col in one row " +
      "can produce an idx that actually falls inside the buffer but belongs to a completely " +
      "different (row, col) pair — silently corrupting unrelated pixels rather than cleanly " +
      "crashing. Threads in the last block-row (row >= 1000) push idx past the end of the " +
      "allocation entirely, which may or may not fault depending on what memory follows the " +
      "allocation. The fix is the classic guard: `if (row >= height || col >= width) return;` " +
      "before ever touching memory — cheap because it only costs a predicated exit for the small " +
      "fraction of over-provisioned threads.",
  },
  {
    id: "gpu-cuda-warp-divergence-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Warp divergence on a data-dependent branch",
    tags: ["warp-divergence", "simt", "predication"],
    type: "trace",
    prompt:
      "A single warp (32 threads, contiguous threadIdx.x 0-31) executes this kernel. `heavyA()` " +
      "and `heavyB()` each take roughly the same, nontrivial amount of time. What is the most " +
      "accurate prediction of this warp's execution time compared to if all 32 threads took the " +
      "same branch?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__global__ void diverge(float* out) {
    int tid = threadIdx.x;
    if (tid % 2 == 0) {
        out[tid] = heavyA(tid);
    } else {
        out[tid] = heavyB(tid);
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The 16 even-lane threads run heavyA() and the 16 odd-lane threads run heavyB() truly in parallel on separate ALUs, so total time is roughly max(time(heavyA), time(heavyB)) — same as if there were no branch",
        "The warp executes heavyA() with the odd lanes predicated off (idle), then executes heavyB() with the even lanes predicated off, so total time is roughly time(heavyA) + time(heavyB) — both paths run serially even though only half the lanes are ever doing useful work at a time",
        "This is undefined behavior — a warp cannot contain threads that take different branches",
        "The scheduler issues heavyA() and heavyB() on two different warps automatically to avoid divergence, so this is transparently handled with no performance cost",
      ],
      correctIndex: 1,
      // duplicate key guard note removed
    },
    explanation:
      "A warp is executed in lockstep by a single instruction unit issuing one instruction stream " +
      "at a time (SIMT). When threads within a warp disagree on a branch, the hardware serializes " +
      "the divergent paths: it executes the taken-path instructions with an active-lane mask that " +
      "disables (predicates off) the threads that didn't take that path, then executes the other " +
      "path with the complementary mask, and finally reconverges. Both heavyA() and heavyB() " +
      "therefore run to completion on the same warp scheduler slot, back to back, so the warp's " +
      "total time is approximately the sum of both branches' costs rather than the max — exactly " +
      "the opposite of true parallel execution. This is why warp-divergent branches on " +
      "performance-critical, hot-loop code (as opposed to occasional edge-case branches) are a " +
      "canonical CUDA anti-pattern; the fix is usually to restructure data or work assignment so " +
      "that divergence aligns with warp boundaries (e.g., branch on warp id, not thread id).",
  },
  {
    id: "gpu-cuda-warp-divergence-02",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Ragged loop trip counts and the divergence tail effect",
    tags: ["warp-divergence", "simt", "sparse", "tail-effect"],
    type: "trace",
    prompt:
      "This kernel processes a sparse matrix in CSR format: each thread handles one row, and " +
      "`rowLength[tid]` varies per row (some rows have 2 nonzeros, others have 200). Within a " +
      "single warp, lane 0 has rowLength == 2 and lane 31 has rowLength == 200; all other lanes " +
      "fall somewhere in between. What determines this warp's total execution time?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__global__ void spmv(const int* rowStart, const int* rowLength,
                      const float* vals, const int* cols,
                      const float* x, float* y) {
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    float sum = 0.0f;
    int start = rowStart[tid];
    int len = rowLength[tid];
    for (int i = 0; i < len; ++i) {
        sum += vals[start + i] * x[cols[start + i]];
    }
    y[tid] = sum;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The warp's total time is proportional to the average rowLength across its 32 lanes, since each lane genuinely runs independently on its own hardware thread",
        "The warp's total time is proportional to the MAXIMUM rowLength among its 32 lanes (here, 200 iterations) — lanes that finish their loop early (like lane 0, after 2 iterations) go idle/predicated-off but the warp as a whole cannot retire or move on until every lane's loop has exited, since the loop condition is itself a divergent branch re-evaluated every iteration",
        "The warp's total time is proportional to the MINIMUM rowLength (here, 2 iterations), since the warp exits the loop as soon as any lane satisfies the exit condition",
        "Each lane's loop runs on an independent instruction pointer with no relation to the other 31 lanes, so total time is unpredictable and depends purely on DRAM latency",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "A per-thread `for` loop with a data-dependent trip count is a divergent branch re-evaluated " +
      "every iteration: on each pass, the warp checks `i < len` for all 32 lanes, and any lane " +
      "whose loop has already exited is simply masked off (predicated inactive) rather than freed " +
      "to do other work. The warp's program counter — shared at the hardware scheduling level — " +
      "cannot advance past the loop until every lane's exit condition has fired, so the warp keeps " +
      "re-issuing loop-body instructions (with an ever-shrinking active-lane mask) until the " +
      "longest-running lane (200 iterations) finishes. This is the classic 'tail effect' in ragged " +
      "or irregular workloads like sparse linear algebra, and it means 30 of the 32 lanes spend " +
      "most of the loop doing zero useful work while still consuming issue slots. Standard " +
      "mitigations reassign work so each warp handles rows of similar length (row sorting/binning " +
      "by nonzero count), or switch to a vector/warp-per-row scheme (e.g., CSR-vector) that spreads " +
      "a single row's work across a whole warp instead of one lane.",
  },
  {
    id: "gpu-cuda-coalescing-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Coalesced vs strided global memory access",
    tags: ["memory-coalescing", "global-memory", "bandwidth"],
    type: "trace",
    prompt:
      "Both kernels below are launched with the same total thread count over the same size " +
      "`float` array. Which is the more accurate performance prediction?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `// Kernel A
__global__ void copyContiguous(float* out, const float* in) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    out[i] = in[i];
}

// Kernel B (stride = 32)
__global__ void copyStrided(float* out, const float* in, int stride) {
    int i = (blockIdx.x * blockDim.x + threadIdx.x) * stride;
    out[i] = in[i];
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both kernels achieve identical throughput — the GPU's cache hides any access-pattern difference",
        "Kernel A is dramatically faster: consecutive threads in a warp access consecutive 4-byte addresses, which the memory controller coalesces into a small number of wide transactions (e.g., one 128-byte transaction per warp), whereas Kernel B's stride-32 access scatters each warp's 32 requests across 32 different cache lines/sectors, requiring up to 32 separate transactions to service the same warp",
        "Kernel B is faster because striding lets the 32 threads read from 32 independent memory banks in parallel with zero contention",
        "Kernel A is slower because writing to fully consecutive addresses causes write-after-write hazards that must be serialized",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "The GPU's memory controller services a warp's load/store as a small number of memory " +
      "transactions covering fixed-size, aligned segments (historically 128-byte lines split into " +
      "32-byte sectors on modern architectures). When 32 consecutive threads request 32 " +
      "consecutive 4-byte floats, the whole warp's request fits in one or two of those aligned " +
      "segments — full coalescing, near-peak achieved bandwidth. When the same 32 threads request " +
      "addresses 32 floats (128 bytes) apart, each thread's 4-byte word typically lands in its own " +
      "distinct segment, so the controller must issue up to 32 separate transactions to satisfy one " +
      "warp's instruction, wasting the vast majority of each transaction's fetched bytes on data no " +
      "thread asked for. This is precisely why array-of-structs vs struct-of-arrays layout and " +
      "loop/index restructuring are first-order performance concerns in CUDA: the access pattern, " +
      "not just the total bytes moved, determines achieved bandwidth relative to the hardware's " +
      "peak.",
  },
  {
    id: "gpu-cuda-coalescing-02",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Array-of-structs vs struct-of-arrays coalescing",
    tags: ["memory-coalescing", "aos-soa", "global-memory"],
    type: "trace",
    prompt:
      "Both kernels compute the same thing — doubling every particle's x-coordinate — over the " +
      "same number of particles, launched with one thread per particle. Which layout achieves " +
      "meaningfully higher effective memory bandwidth, and why?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `// Layout 1: array of structs
struct Particle { float x, y, z; };
__global__ void scaleAoS(Particle* p, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) p[i].x *= 2.0f;
}

// Layout 2: struct of arrays
__global__ void scaleSoA(float* px, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) px[i] *= 2.0f;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "scaleAoS is faster, since keeping x, y, z together improves spatial locality within each thread",
        "They perform identically, since the total number of bytes touched (4 bytes of 'x' per particle) is the same either way",
        "scaleSoA is substantially faster: with AoS, consecutive threads' `x` fields are 12 bytes apart (stride = sizeof(Particle)), so a warp's 32 accesses to `.x` are scattered across many more cache-line segments than necessary, wasting bandwidth fetching unused `y`/`z` bytes for every segment touched; with SoA, `px[i]` for consecutive i is fully contiguous, so a warp's access coalesces into the minimal number of transactions",
        "scaleAoS is faster because struct member access compiles to a single vectorized load per thread regardless of layout",
      ],
      correctIndex: 2,
      // pruned
    },
    explanation:
      "Coalescing depends on the *byte stride between consecutive threads' addresses*, not on " +
      "total useful bytes moved. In the AoS layout, thread i's `.x` sits at byte offset " +
      "i*sizeof(Particle) = i*12, so 32 consecutive threads' `.x` fields span 32*12 = 384 bytes — " +
      "spread across many more 32-byte sectors than the 128 bytes strictly needed for 32 floats, " +
      "and each sector fetched also carries `y`/`z` bytes no thread in this kernel even reads, " +
      "wasting roughly two-thirds of the fetched bandwidth. In the SoA layout, `px[i]` for 32 " +
      "consecutive threads is a single contiguous 128-byte run, which coalesces into the minimal " +
      "transaction count with no wasted bytes. This is why performance-sensitive CUDA code (and " +
      "GPU-friendly C++ in general — Structure-of-Arrays libraries, `thrust`, columnar layouts) " +
      "strongly prefers SoA whenever a kernel operates on one field at a time across many elements, " +
      "even though AoS can be more convenient for CPU code where cache lines are line-granular but " +
      "access is scalar/sequential per object rather than warp-parallel per field.",
  },
  {
    id: "gpu-cuda-bank-conflict-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Shared-memory tile transpose bank conflicts",
    tags: ["shared-memory", "bank-conflicts", "transpose"],
    type: "trace",
    prompt:
      "This tile-based transpose loads a 32x32 tile into shared memory, then writes it out " +
      "transposed. Shared memory has 32 banks, each 4 bytes wide, and consecutive 4-byte words " +
      "map to consecutive banks (bank = address / 4 mod 32). During the WRITE-out phase, warp " +
      "lane `threadIdx.x` reads `tile[threadIdx.x][threadIdx.y]` (note the swapped indices). " +
      "What happens on that read, for a fixed threadIdx.y across the warp's 32 threadIdx.x values?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__shared__ float tile[32][32];

__global__ void transpose(float* out, const float* in, int width) {
    int x = blockIdx.x * 32 + threadIdx.x;
    int y = blockIdx.y * 32 + threadIdx.y;
    tile[threadIdx.y][threadIdx.x] = in[y * width + x];
    __syncthreads();

    int outX = blockIdx.y * 32 + threadIdx.x;
    int outY = blockIdx.x * 32 + threadIdx.y;
    out[outY * width + outX] = tile[threadIdx.x][threadIdx.y];  // swapped indices
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No conflict: each thread reads a different array element, and different elements never conflict regardless of address",
        "A 32-way bank conflict: with tile[32][32] of floats, row stride is 32 floats = 128 bytes, i.e. exactly 32 banks, so tile[threadIdx.x][threadIdx.y] for fixed threadIdx.y and varying threadIdx.x steps by one full row (32 words) each time — every lane in the warp lands on the SAME bank (differing only in which row, i.e. a different address within that bank), forcing the memory unit to serialize all 32 accesses into 32 separate cycles instead of one",
        "A broadcast: since all 32 threads read from the same bank, the hardware automatically serves them all in one cycle as a broadcast, identical in cost to no conflict at all",
        "This causes a compile error, since shared memory arrays cannot be indexed with swapped subscripts",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "Shared memory is organized into 32 banks, each servicing one 4-byte-wide access per cycle; " +
      "a bank conflict occurs when two or more threads in the same warp access *different* " +
      "addresses that happen to map to the *same* bank (accessing the exact same address is a " +
      "conflict-free broadcast, not a conflict — that's a different case). Here tile[32][32] means " +
      "each row is 32 floats = 128 bytes = exactly 32 banks' worth, so incrementing the row index " +
      "by 1 lands on the identical bank (just a different address within it). For fixed " +
      "threadIdx.y, varying threadIdx.x across the warp sweeps the row index of tile[threadIdx.x]" +
      "[threadIdx.y] — so all 32 lanes hit the same bank, distinct addresses, which is the worst " +
      "case: full 32-way serialization. The canonical fix is to pad the tile's row length by one " +
      "extra element, `__shared__ float tile[32][33]`, which shifts the row stride to 33 words — " +
      "no longer a multiple of 32 banks — so consecutive rows land on different banks and the " +
      "conflict disappears entirely, at the cost of a few wasted padding bytes.",
  },
  {
    id: "gpu-cuda-bank-conflict-02",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Ranking shared-memory access patterns by bank conflict",
    tags: ["shared-memory", "bank-conflicts"],
    type: "trace",
    prompt:
      "Shared memory has 32 banks, 4 bytes wide, bank = (byte_address / 4) mod 32. `float sdata" +
      "[64]` is declared in shared memory. A single warp (threadIdx.x 0-31) performs each of the " +
      "three accesses below in separate kernels. Rank them from fastest to slowest.",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__shared__ float sdata[64];

// Pattern 1
float a = sdata[threadIdx.x];

// Pattern 2
float b = sdata[0];

// Pattern 3
float c = sdata[threadIdx.x * 2];`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Pattern 1 == Pattern 2 == Pattern 3 — shared memory always services a warp in one cycle regardless of index math",
        "Pattern 1 (one word per bank, no conflict) and Pattern 2 (every lane reads the identical address, a hardware broadcast) both complete in one transaction; Pattern 3 is a 2-way bank conflict, since sdata[threadIdx.x*2] maps to bank (threadIdx.x*2) mod 32 — each bank is hit by exactly two distinct lanes (e.g., threadIdx.x=0 and threadIdx.x=16 both map to bank 0, at different addresses) — roughly 2x slower than Patterns 1/2",
        "Pattern 2 is the slowest because reading the same address from all 32 threads forces full serialization — one thread at a time",
        "Pattern 3 is the fastest because multiplying the index by 2 spreads accesses across twice as many banks",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "Pattern 1 is the textbook conflict-free case: threadIdx.x directly selects bank " +
      "threadIdx.x mod 32, a bijection across the warp, so all 32 requests hit distinct banks and " +
      "complete in a single memory transaction. Pattern 2 is a broadcast: the hardware specifically " +
      "detects when every active lane requests the exact same address and services it as a single " +
      "read replicated to all lanes, also one transaction — same address is never a conflict, only " +
      "*different* addresses mapping to the *same* bank are. Pattern 3 computes bank = (threadIdx.x" +
      "*2) mod 32; since multiplying by 2 is not coprime with 32, the mapping threadIdx.x -> bank " +
      "is 2-to-1 (lanes 0 and 16 both target bank 0 at different addresses, 1 and 17 both target " +
      "bank 1, etc.), so the memory unit must issue the access in two serialized sub-passes, " +
      "roughly halving throughput relative to Patterns 1/2. This generalizes: an access stride of " +
      "`s` against 32 banks produces an `n`-way conflict where n = 32 / gcd(32, s), which is why " +
      "power-of-two strides that share factors with the bank count are a classic shared-memory " +
      "performance trap.",
  },
  {
    id: "gpu-cuda-occupancy-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Higher register usage per thread reducing occupancy",
    tags: ["occupancy", "registers", "latency-hiding"],
    type: "trace",
    prompt:
      "An SM has 65,536 32-bit registers and supports up to 2048 resident threads (64 warps). " +
      "This kernel is memory-latency-bound (each thread stalls frequently waiting on global " +
      "memory). Version A uses 32 registers/thread. Version B aggressively unrolls the inner " +
      "loop, reducing loop-overhead instructions per element but raising usage to 96 " +
      "registers/thread. What is the most likely outcome for Version B relative to Version A?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Version B is always faster: doing more work per instruction is strictly better regardless of any other resource constraint",
        "Version B is likely SLOWER overall despite each thread being individually more efficient: 65,536/32 = 2048 threads/SM fit under Version A (full occupancy, 64 resident warps), but 65,536/96 ≈ 682 threads/SM (21 warps) fit under Version B — with far fewer resident warps, the SM's warp scheduler has fewer independent warps to switch to when a warp stalls on a long-latency memory operation, so latency-hiding degrades and the SM spends more time idle waiting on memory rather than issuing useful instructions",
        "Register usage per thread has no effect on how many threads can be resident on an SM — only shared memory usage does",
        "Version B is faster because using more registers avoids spilling to local memory, which is the only thing that affects occupancy",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "Occupancy is bounded by whichever per-SM resource runs out first among registers, shared " +
      "memory, and the architectural max-threads/max-blocks-per-SM limits. Register count is " +
      "allocated per-thread but drawn from one shared per-SM pool, so raising per-thread register " +
      "usage directly shrinks the number of threads (and therefore warps) that can be co-resident. " +
      "For a latency-bound kernel — one where threads frequently stall on hundreds-of-cycles global " +
      "memory accesses — the GPU's primary tool for hiding that latency is having enough *other* " +
      "resident warps ready to issue instructions while a stalled warp waits; this is fundamentally " +
      "different from a CPU's out-of-order execution or deep speculation. Dropping from 64 to 21 " +
      "resident warps sharply reduces the scheduler's pool of latency-hiding work, so the SM is " +
      "more likely to sit idle with no eligible warp to issue, even though Version B's individual " +
      "threads do less looping overhead. This is precisely why CUDA occupancy tuning (`--" +
      "maxrregcount`, `__launch_bounds__`, the Occupancy Calculator/Nsight Compute) treats " +
      "aggressive unrolling and register pressure as a tradeoff to be measured, not an unconditional " +
      "win — the right answer is workload-dependent (compute-bound kernels often *do* benefit from " +
      "fewer, register-heavy warps).",
  },
  {
    id: "gpu-cuda-occupancy-02",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Shared memory capping resident blocks per SM",
    tags: ["occupancy", "shared-memory"],
    type: "trace",
    prompt:
      "An SM has 96 KB of shared memory available per SM and supports up to 32 resident thread " +
      "blocks and 2048 resident threads. A kernel is launched with 256 threads/block and statically " +
      "declares 40 KB of shared memory per block. Registers are not a limiting factor. How many " +
      "blocks can actually be resident on the SM simultaneously, and what limits it?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__global__ void __launch_bounds__(256) heavySmem(float* data) {
    __shared__ float buf[10240];   // 40 KB per block
    // ... kernel body ...
}
// launch: heavySmem<<<numBlocks, 256>>>(data);`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "8 blocks resident — limited by 2048 max threads / 256 threads-per-block",
        "32 blocks resident — the SM's max-blocks-per-SM limit always wins regardless of memory usage",
        "2 blocks resident — limited by shared memory: floor(96 KB / 40 KB) = 2 blocks, which caps resident threads at 2*256=512 (well under both the 2048 thread limit and the 32 block limit), leaving the SM significantly under-occupied even though threads and blocks alone would allow far more",
        "0 blocks — 40 KB per block exceeds a hard per-block shared memory limit and the kernel fails to launch",
      ],
      correctIndex: 2,
      // pruned
    },
    explanation:
      "Occupancy is determined by the *most restrictive* of several independent per-SM budgets: " +
      "max resident threads, max resident blocks, register file size, and shared memory size — " +
      "whichever runs out first caps the number of resident blocks. Here, the thread-count limit " +
      "would allow 2048/256 = 8 blocks, and the block-count limit would allow up to 32, but shared " +
      "memory only has 96 KB total to distribute, and each block statically claims 40 KB, so only " +
      "floor(96/40) = 2 blocks can fit (a third block's 40 KB would need 120 KB total, exceeding " +
      "the 96 KB budget). That caps the SM at 2*256 = 512 resident threads out of a possible 2048 — " +
      "25% theoretical occupancy — leaving three-quarters of the SM's latency-hiding capacity " +
      "unused purely due to the shared-memory footprint, independent of how many registers the " +
      "kernel needs. This is exactly why profiling tools report *achieved* vs *theoretical* " +
      "occupancy per limiting resource, and why reducing a kernel's shared-memory tile size (or " +
      "using `__launch_bounds__`/dynamic shared memory tuning) is a standard occupancy lever " +
      "distinct from register pressure.",
  },
  {
    id: "gpu-cuda-constant-memory-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Constant memory broadcast vs divergent constant reads",
    tags: ["constant-memory", "broadcast", "memory-hierarchy"],
    type: "trace",
    prompt:
      "`__constant__ float coeffs[256];` is populated once via `cudaMemcpyToSymbol` before launch. " +
      "Kernel A has every thread in a warp read `coeffs[0]` (the same address). Kernel B has each " +
      "thread read `coeffs[threadIdx.x]` (32 different addresses). What's the performance " +
      "difference, assuming both are otherwise identical and the constant cache is warm?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__constant__ float coeffs[256];

// Kernel A
__global__ void useSameCoeff(float* out, const float* in) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    out[i] = in[i] * coeffs[0];
}

// Kernel B
__global__ void useDifferentCoeff(float* out, const float* in) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    out[i] = in[i] * coeffs[threadIdx.x % 256];
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Identical performance — constant memory always services a full warp in a single cycle regardless of the access pattern",
        "Kernel A is fast: the constant cache is optimized for the broadcast case where every thread in a warp reads the SAME address, serving all 32 lanes in one (or very few) cycles. Kernel B, where threads read differing addresses, cannot broadcast — the constant cache path serializes into multiple requests, one per unique address, making it markedly slower than Kernel A despite reading from the same memory space",
        "Kernel B is faster because reading different addresses lets the 32 threads use 32 independent constant cache ports in parallel",
        "Both kernels are equally slow because constant memory always requires a round trip to global (device) memory, cache or not",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "Constant memory sits in device DRAM but is backed by a small, dedicated per-SM constant " +
      "cache tuned specifically for the case where every thread in a warp requests the identical " +
      "address — a scenario extremely common for kernel parameters, physical constants, or a small " +
      "shared coefficient table. In that broadcast case, the hardware reads the value once and " +
      "fans it out to all 32 lanes, at throughput comparable to a register read. The moment threads " +
      "in a warp diverge to different addresses, that broadcast fast path no longer applies: the " +
      "constant cache must service each distinct address as a separate request, and accesses " +
      "serialize by the number of unique addresses touched, in the worst case as slow as 32 " +
      "separate lookups for 32 distinct addresses. This is the opposite tradeoff from global memory " +
      "coalescing (where *different-but-adjacent* addresses are the fast case): constant memory " +
      "wants *identical* addresses across a warp to be fast, which is why it's suited for " +
      "broadcast-style read-only data and not for per-thread lookup tables.",
  },
  {
    id: "gpu-cuda-memory-hierarchy-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Re-reading global memory in a loop vs caching in a register",
    tags: ["memory-hierarchy", "global-memory", "registers", "latency"],
    type: "trace",
    prompt:
      "Global memory access latency is on the order of several hundred cycles; a register read is " +
      "effectively free (~1 cycle, no separate instruction-level cost beyond the operation itself). " +
      "This kernel re-reads `base[0]` from global memory on every one of 1000 loop iterations " +
      "instead of loading it once. What is the most accurate prediction?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__global__ void wasteful(float* base, float* out, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    float acc = 0.0f;
    for (int k = 0; k < 1000; ++k) {
        acc += out[i] * base[0];   // base[0] re-read from global memory every iteration
    }
    out[i] = acc;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No meaningful difference — the compiler is guaranteed to hoist the redundant load out of the loop into a register regardless of aliasing concerns",
        "The kernel is likely to run substantially slower than a hand-hoisted version (`float b0 = base[0];` before the loop, then using `b0` in the loop): unless the compiler can prove `base` doesn't alias `out` (enabling it to safely hoist/keep the value cached), every iteration reissues a global memory transaction hundreds of cycles deep; even with the L1/L2 cache absorbing repeat hits after the first access, a cached global load is still meaningfully more expensive than a register/local value with zero possibility of a cache miss",
        "This is undefined behavior because `base[0]` is being read concurrently by multiple threads without synchronization",
        "The kernel runs faster than the hoisted version, since re-reading avoids keeping an extra live value in the register file",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "Registers, shared memory, and global memory sit at very different points on the GPU memory " +
      "hierarchy's latency/bandwidth spectrum: a register operand costs essentially nothing extra, " +
      "shared memory is on the order of tens of cycles, and global memory (even cache-hot) is " +
      "typically the most expensive of the three to touch repeatedly, both in raw latency and in " +
      "consuming load/store unit issue slots and cache bandwidth shared by the whole warp/SM. The " +
      "compiler can only hoist the repeated `base[0]` read out of the loop if it can prove no " +
      "intervening write to `out` could alias `base` — pointer aliasing between `out` and `base` is " +
      "exactly the kind of ambiguity `restrict`-qualified pointers (or `__restrict__` in CUDA) exist " +
      "to eliminate, letting the compiler safely keep the value live in a register across the whole " +
      "loop. Without that guarantee, a conservative compiler may reissue the global load every " +
      "iteration; explicitly hoisting frequently-reused values into a local variable (which the " +
      "compiler keeps in a register) is a standard, high-value CUDA optimization for exactly this " +
      "reason.",
  },
  {
    id: "gpu-cuda-syncthreads-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "__syncthreads() inside a divergent branch",
    tags: ["syncthreads", "barrier", "deadlock", "undefined-behavior"],
    type: "trace",
    prompt:
      "A block of 256 threads (8 warps) runs this kernel. What happens?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__global__ void badBarrier(float* data) {
    int tid = threadIdx.x;
    if (tid < 128) {
        data[tid] = data[tid] * 2.0f;
        __syncthreads();
        data[tid] += 1.0f;
    } else {
        data[tid] = data[tid] * 3.0f;
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Well-defined: __syncthreads() only synchronizes the threads that actually call it, so the first 128 threads synchronize with each other and the other 128 proceed independently",
        "Undefined behavior — potential deadlock or hang: __syncthreads() is a barrier over the WHOLE thread block, and the CUDA programming model requires that if any thread in a block reaches a given __syncthreads() call, all threads in the block must reach it (the same call, executed the same number of times); since threads 128-255 never call it at all, the threads that do call it may block forever waiting for threads that will never arrive",
        "Compile-time error: __syncthreads() cannot appear inside an if-statement",
        "The kernel silently skips the __syncthreads() call for all threads if any thread doesn't reach it, so no synchronization happens for anyone but no hang occurs either",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "__syncthreads() is a block-wide barrier: every thread in the block must arrive at the exact " +
      "same __syncthreads() call site before any of them are permitted to proceed past it — this is " +
      "explicit in the CUDA C++ Programming Guide, which warns that __syncthreads() used inside " +
      "conditional code is only well-defined if the condition evaluates identically across the " +
      "entire block. Here threads 0-127 reach the barrier while threads 128-255 never call " +
      "__syncthreads() at all on this control-flow path, so the arriving threads wait for " +
      "arrivals that will never come — in practice this frequently manifests as the kernel hanging " +
      "(GPU appears to make no forward progress, watchdog timeout on a display GPU, or an " +
      "indefinite stall on a headless compute GPU) though the formal classification is undefined " +
      "behavior, not a guaranteed hang. The fix is to restructure so that either all threads in the " +
      "block reach a shared __syncthreads() (e.g., move the barrier outside the branch, doing the " +
      "conditional work before and after it), or use warp-level primitives like __syncwarp() with " +
      "an explicit mask when only synchronizing within a warp is actually needed.",
  },
  {
    id: "gpu-cuda-syncthreads-02",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Shared-memory race without a barrier",
    tags: ["syncthreads", "shared-memory", "race-condition"],
    type: "trace",
    prompt:
      "Each thread writes its own value into shared memory, then immediately reads its right " +
      "neighbor's slot — with no synchronization between the write and the read. What does this " +
      "kernel produce?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__global__ void stencilNoSync(float* out, const float* in) {
    __shared__ float smem[256];
    int tid = threadIdx.x;
    smem[tid] = in[blockIdx.x * blockDim.x + tid];
    // no __syncthreads() here
    float neighbor = smem[(tid + 1) % blockDim.x];
    out[blockIdx.x * blockDim.x + tid] = neighbor;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Deterministically correct: threads within a block always execute in lockstep across the whole block, so every write completes before any read",
        "A data race producing nondeterministic results: nothing guarantees thread tid+1 has executed its `smem[tid+1] = ...` write before thread tid executes its read of smem[tid+1] — different warps in the block (and even threads within the same warp on architectures with independent thread scheduling) can interleave arbitrarily without a barrier, so `neighbor` may be the freshly written value or leftover/garbage data from shared memory's previous use",
        "Compile-time error: shared memory cannot be both written and read within the same kernel without an explicit __syncthreads()",
        "This is safe specifically because tid and (tid+1) % blockDim.x are always in the same warp",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "Threads within a CUDA block are not guaranteed to execute in any particular relative order " +
      "beyond what's imposed by explicit synchronization — different warps within a block are " +
      "scheduled independently by the SM's warp schedulers, and there is no implicit guarantee that " +
      "warp k's instruction stream is 'ahead of' or 'behind' warp k+1's at any given moment (and " +
      "since threadIdx.x=255's neighbor wraps to threadIdx.x=0, this example spans multiple warps). " +
      "Without a `__syncthreads()` between the shared-memory write and the read of a *different* " +
      "thread's slot, this is a genuine race: the read may observe the freshly written value, a " +
      "stale value from shared memory's prior contents (shared memory is not zero-initialized " +
      "between kernel launches or reused across different __shared__ declarations in the same " +
      "kernel), or — on some interleavings — the correct value, nondeterministically varying run to " +
      "run. The fix is a single `__syncthreads()` immediately after the write and before the " +
      "cross-thread read, which is precisely the barrier pattern every shared-memory stencil, " +
      "reduction, and tiling kernel relies on.",
  },
  {
    id: "gpu-cuda-atomics-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Histogram without atomics vs atomicAdd",
    tags: ["atomics", "race-condition", "histogram"],
    type: "trace",
    prompt:
      "Thousands of threads each increment a bin in a small shared histogram based on their " +
      "input value; many threads target the same bin concurrently. Compare the two kernels below.",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `// Kernel A — no atomics
__global__ void histNaive(int* hist, const int* data, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) {
        int bin = data[i] % 16;
        hist[bin]++;              // read-modify-write, not atomic
    }
}

// Kernel B — atomics
__global__ void histAtomic(int* hist, const int* data, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) {
        int bin = data[i] % 16;
        atomicAdd(&hist[bin], 1);
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both kernels produce identical, correct histograms — `hist[bin]++` compiles to a single indivisible hardware instruction, so no race is possible",
        "Kernel A has a genuine race condition and will typically undercount several bins: `hist[bin]++` is a read, an increment, and a write as three separate steps, and when two threads perform this concurrently on the same bin, one thread's increment can be silently lost (both read the same old value, both write old+1, one update is overwritten). Kernel B is correct because atomicAdd performs the read-modify-write as a single indivisible hardware-guaranteed operation, serializing concurrent updates to the same address without losing any",
        "Kernel A deadlocks because two threads cannot write to the same array simultaneously",
        "Kernel B is incorrect because atomicAdd cannot be used on shared arrays, only on single scalar global variables",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "`hist[bin]++` is not a single hardware operation — it lowers to a load of `hist[bin]`, an " +
      "increment in a register, and a store back to `hist[bin]`. When two (or more) threads from " +
      "potentially different warps or blocks execute this concurrently against the same bin with no " +
      "synchronization, both can load the same pre-increment value before either has written back, " +
      "so both compute old+1 and one thread's store simply clobbers the other's — a lost update, " +
      "the textbook read-modify-write race. `atomicAdd` guarantees the entire read-modify-write is " +
      "performed as one indivisible operation with respect to all other atomic operations on that " +
      "address, so concurrent atomicAdds to the same bin serialize correctly and no increment is " +
      "lost, at the cost of that serialization being a real (if hardware-accelerated) throughput " +
      "bottleneck under heavy contention on a small number of addresses. This is the direct " +
      "GPU analogue of a data race on an un-synchronized shared counter on a CPU — the fix (atomics) " +
      "is the same idea, just backed by dedicated atomic units in the memory subsystem rather than a " +
      "lock.",
  },
  {
    id: "gpu-cuda-atomics-02",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Atomic contention on a single address vs hierarchical reduction",
    tags: ["atomics", "contention", "performance", "reduction"],
    type: "trace",
    prompt:
      "Both kernels below compute the same correct sum over a large array using one thread per " +
      "element, launched with many blocks. Which is faster at scale, and why?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `// Kernel A: every thread atomics directly into one global counter
__global__ void sumGlobalAtomic(float* result, const float* data, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) atomicAdd(result, data[i]);
}

// Kernel B: block-level shared-memory reduction, one atomic per block
__global__ void sumHierarchical(float* result, const float* data, int n) {
    __shared__ float partial;
    if (threadIdx.x == 0) partial = 0.0f;
    __syncthreads();
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    float v = (i < n) ? data[i] : 0.0f;
    atomicAdd(&partial, v);         // fast, block-local shared-memory atomic
    __syncthreads();
    if (threadIdx.x == 0) atomicAdd(result, partial);   // one global atomic per block
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both are equally fast — atomicAdd on global memory and atomicAdd on shared memory have identical latency and contention characteristics",
        "Kernel A is faster because it has no __syncthreads() overhead at all",
        "Kernel B is substantially faster at scale: Kernel A funnels every one of n threads' atomicAdd into the SAME global memory address, which the hardware must serialize entirely — contention on one address scales as O(n). Kernel B still contends within each block's shared-memory atomic (fast, on-chip, lower latency than global memory), but only issues ONE atomicAdd to the contended global address per block, cutting global-address contention from O(n) down to O(n / blockDim.x)",
        "Kernel B is slower because using __shared__ memory always adds more overhead than it can possibly save",
      ],
      correctIndex: 2,
      // pruned
    },
    explanation:
      "Atomic operations targeting the *same* memory address must be serialized by the hardware to " +
      "guarantee correctness, regardless of which memory space that address lives in — this is an " +
      "inherent property of atomicity, not an implementation quirk. Kernel A has every thread in " +
      "the entire grid contend for one global address, so total atomic-serialization cost scales " +
      "linearly with n (the full element count), turning what should be a bandwidth-bound reduction " +
      "into a serialization-bound bottleneck. Kernel B performs the same reduction in two tiers: " +
      "threads within a block still contend on a shared-memory atomic (`partial`), but shared " +
      "memory atomics are on-chip and considerably lower-latency than global memory atomics, and — " +
      "crucially — only one thread per block (thread 0) then issues an atomicAdd into the globally " +
      "contended `result` address, dropping the number of global-address atomic operations from n " +
      "down to n / blockDim.x (the number of blocks). This block-then-grid hierarchical reduction " +
      "pattern (often extended with a further warp-shuffle-based reduction within each block before " +
      "the shared-memory atomic) is the standard technique for scaling reductions on GPUs with " +
      "heavy contention, and generalizes to any 'many writers, one hot address' pattern.",
  },
  {
    id: "gpu-cuda-warp-shuffle-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Warp shuffle reduction vs shared-memory reduction",
    tags: ["warp-shuffle", "reduction", "shfl_sync"],
    type: "trace",
    prompt:
      "Both kernels below sum the 32 values held by a single warp's threads (one value per lane) " +
      "down to a single result in lane 0. Which is the more accurate characterization?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `// Version A: shared-memory tree reduction
__shared__ float sdata[32];
sdata[threadIdx.x] = val;
__syncthreads();
for (int s = 16; s > 0; s >>= 1) {
    if (threadIdx.x < s) sdata[threadIdx.x] += sdata[threadIdx.x + s];
    __syncthreads();
}
// result in sdata[0]

// Version B: warp shuffle reduction
for (int offset = 16; offset > 0; offset >>= 1) {
    val += __shfl_down_sync(0xFFFFFFFF, val, offset);
}
// result in lane 0's val`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both are equally fast — __shfl_down_sync is just shared memory under a different name",
        "Version A is faster because it uses more total instructions, and more instructions always means better latency hiding",
        "Version B is typically faster: __shfl_down_sync exchanges register values directly between threads in the same warp over a dedicated intra-warp interconnect, with no shared memory traffic, no bank-conflict potential, and — since a single warp is inherently lockstep at the hardware level for a straight-line shuffle sequence like this — no need for repeated __syncthreads() barriers the way the shared-memory version requires after every reduction step",
        "Version B is not legal CUDA — __shfl_down_sync can only be called from host code, never from within a kernel",
      ],
      correctIndex: 2,
    },
    explanation:
      "Warp shuffle instructions let threads within the same warp read each other's registers " +
      "directly through a dedicated crossbar-style intra-warp exchange network, without ever " +
      "staging the data through shared memory. That eliminates the shared-memory store, the " +
      "bank-conflict potential of the tree-reduction access pattern, and — critically — the " +
      "repeated __syncthreads() barriers the shared-memory version needs after every halving step " +
      "(since __syncthreads() is a full block-wide barrier, using it just to synchronize 32 threads " +
      "within one warp is overkill). __shfl_down_sync still takes an explicit mask argument " +
      "(0xFFFFFFFF here, meaning 'all 32 lanes participate') because, since Volta's independent " +
      "thread scheduling, the hardware no longer assumes an entire warp is implicitly still " +
      "together at every instruction — the mask tells the shuffle exactly which lanes are " +
      "expected to participate, and it is undefined behavior to omit a participating active lane " +
      "from the mask. For warp-scoped reductions this shuffle-based pattern is the standard, " +
      "faster building block; a full block-wide reduction typically still needs one shared-memory " +
      "combine step across warps, often implemented as a warp-shuffle reduction per warp followed " +
      "by a small shared-memory reduction across the (few) per-warp partial results.",
  },
  {
    id: "gpu-cuda-unified-memory-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Page fault migration on first GPU touch of managed memory",
    tags: ["unified-memory", "page-fault", "cudaMallocManaged"],
    type: "trace",
    prompt:
      "`data` is allocated with `cudaMallocManaged`. The host initializes every element (touching " +
      "and thus resident-migrating all pages to host DRAM), then launches `kernel<<<...>>>(data)` " +
      "with no explicit prefetch. What happens on the kernel's very first access to `data`?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `float* data;
cudaMallocManaged(&data, N * sizeof(float));
for (int i = 0; i < N; ++i) data[i] = (float)i;   // host touches every page

kernel<<<blocks, threads>>>(data, N);              // no cudaMemPrefetchAsync first
cudaDeviceSynchronize();`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing special — cudaMallocManaged memory is always physically resident on both host and device simultaneously, so the kernel reads it at full device-memory bandwidth immediately",
        "The GPU thread accessing a given page triggers a page fault, since that page currently lives in host DRAM; the CUDA driver's page-migration engine handles the fault by transferring that page over PCIe/NVLink to device memory before the access can complete, stalling that access — repeated across however many pages the kernel touches — which is typically slower than an explicit bulk cudaMemcpy or cudaMemPrefetchAsync issued ahead of the launch, since faults are handled page-by-page and can serialize on the migration engine",
        "The kernel launch fails with an error, because managed memory cannot be written by the host before being read by the device",
        "The compiler automatically inserts a cudaMemcpy before the kernel launch, making prefetching irrelevant",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "Unified (managed) memory presents a single pointer valid on both host and device, but " +
      "under the hood a page can only be resident in one place at a time (on architectures without " +
      "full hardware cache coherence across the interconnect); the CUDA runtime tracks ownership " +
      "and migrates pages on demand. After the host-side initialization loop, every page of " +
      "`data` is resident in host memory. When the kernel's threads then access `data`, each " +
      "first touch of a given page by the GPU triggers a page fault handled by the GPU's page " +
      "migration engine, which pulls that page from host DRAM to device memory over PCIe/NVLink " +
      "before the faulting memory access can be satisfied — the requesting warp stalls until the " +
      "migration completes. Because this happens fault-by-fault (at page granularity) rather than " +
      "as one large batched transfer, it typically has higher overhead than either an explicit " +
      "`cudaMemcpy` (a single bulk DMA transfer issued upfront) or a `cudaMemPrefetchAsync(data, " +
      "size, deviceId)` call issued before the kernel launch, which proactively migrates the whole " +
      "range in one operation and lets the kernel start with the data already resident. Unified " +
      "memory trades this potential performance cliff for substantially simpler programming (no " +
      "manual copy management, and oversubscription of GPU memory becomes possible via automatic " +
      "eviction), which is why prefetching is recommended whenever the access pattern is known " +
      "ahead of time.",
  },
  {
    id: "gpu-cuda-kernel-launch-overhead-01",
    category: "gpu-cuda",
    difficulty: "easy",
    title: "Kernel launch overhead dominating many tiny launches",
    tags: ["kernel-launch", "overhead", "kernel-fusion"],
    type: "trace",
    prompt:
      "Version A launches a tiny kernel that processes just 10 elements, 10,000 times in a host " +
      "loop (100,000 elements total, all on the same stream). Version B launches one kernel with " +
      "a grid-stride loop that processes all 100,000 elements in a single launch. Each individual " +
      "element's compute work is trivial (a few FLOPs). Which is faster, and why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Version A is faster because launching many small kernels lets the GPU pipeline and overlap them automatically",
        "They perform identically — total element count and total FLOPs are the same either way",
        "Version B is typically dramatically faster: each kernel launch carries a fixed CPU-side and driver-side overhead (queuing the launch, driver validation, signaling the GPU) on the order of several microseconds, independent of how much work the kernel actually does; with 10,000 launches each doing only ~10 elements' worth of (sub-microsecond) compute, Version A's total time is dominated by launch overhead rather than by the GPU actually computing anything, whereas Version B pays that fixed overhead exactly once",
        "Version A is faster because smaller kernels always have higher occupancy than one large kernel",
      ],
      correctIndex: 2,
      // pruned
    },
    explanation:
      "Every kernel launch — regardless of how little work it does — incurs a largely fixed cost: " +
      "the host-side driver call, command buffer construction, and the queuing/dispatch handshake " +
      "with the GPU, typically on the order of a handful of microseconds even in the best case " +
      "(more with a synchronizing launch or an underpopulated queue). When a kernel's actual " +
      "compute is tiny (10 elements is nowhere near enough work to fill even one SM), that fixed " +
      "overhead dwarfs the useful work done per launch, so issuing 10,000 such launches accumulates " +
      "tens of milliseconds of pure overhead with almost no compute to show for it. A single fused " +
      "launch processing all 100,000 elements (e.g., via a grid-stride loop, or simply launching " +
      "enough threads to cover the whole problem) pays that fixed cost once and lets the GPU spend " +
      "essentially all of its time on genuine compute. This is exactly the motivation behind kernel " +
      "fusion (combining multiple small kernels into one) and CUDA Graphs (which let you record a " +
      "sequence of launches once and replay the whole graph with a single, much cheaper submission), " +
      "both standard techniques for workloads — common in ML inference, iterative solvers — " +
      "dominated by many small, dependent kernel launches.",
  },
  {
    id: "gpu-cuda-grid-stride-loop-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Grid-stride loop for problem sizes larger than the launched grid",
    tags: ["grid-stride-loop", "scalability", "portability"],
    type: "trace",
    prompt:
      "This kernel is launched with only 1024 total threads (`grid-stride<<<4, 256>>>`) to process " +
      "an array of 10,000,000 elements. What does it compute, and why is this pattern preferred " +
      "over trying to launch exactly one thread per element?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__global__ void gridStride(float* out, const float* in, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    int stride = gridDim.x * blockDim.x;
    for (int i = idx; i < n; i += stride) {
        out[i] = in[i] * 2.0f;
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It only processes the first 1024 elements; the rest of the array is left untouched since only 1024 threads were launched",
        "It correctly processes all 10,000,000 elements: each of the 1024 launched threads handles a strided subset of indices (idx, idx+stride, idx+2*stride, ...) spaced `stride = gridDim.x * blockDim.x` apart, looping until it walks off the end of the array — this decouples the launch configuration from the problem size, letting a modest, hardware-appropriate number of threads (enough to saturate the GPU) handle an arbitrarily large N, and it degrades gracefully to a single pass per thread when the grid IS large enough to cover N in one shot",
        "This is a compile error — a kernel cannot loop internally over data indices",
        "It processes all elements but only the last 1024 are computed correctly, since earlier iterations get overwritten",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "The grid-stride loop pattern has each thread process every `stride`-th element starting " +
      "from its own global index, where stride equals the total number of threads actually " +
      "launched (gridDim.x * blockDim.x) — so thread 0 handles elements 0, 1024, 2048, ...; thread " +
      "1 handles 1, 1025, 2049, ...; and so on, fully covering all n elements regardless of how n " +
      "relates to the launched thread count. This is preferable to sizing the launch to exactly n " +
      "threads (`ceil(n / blockDim.x)` blocks) for several reasons: it lets the launch configuration " +
      "be tuned to what the specific GPU can efficiently run concurrently (e.g., enough blocks to " +
      "fill every SM at good occupancy) independent of problem size, it amortizes each thread's " +
      "setup/register-allocation cost over multiple elements rather than creating and tearing down " +
      "millions of mostly-idle threads for a huge N, and it trivially handles the case where N " +
      "exceeds the hardware's maximum grid dimensions. It's a standard, portable idiom recommended " +
      "in NVIDIA's own performance guidance for exactly this reason — the same kernel code scales " +
      "correctly whether N is 100 or 10 billion.",
  },
  {
    id: "gpu-cuda-reduction-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Naive interleaved-addressing reduction",
    tags: ["reduction", "shared-memory", "warp-divergence", "bank-conflicts"],
    type: "trace",
    prompt:
      "This is the classic 'naive' shared-memory reduction taught in early CUDA tutorials. " +
      "blockDim.x == 256. What are its two distinct performance problems, beyond just being " +
      "'not optimal'?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__shared__ float sdata[256];
sdata[threadIdx.x] = input[blockIdx.x * blockDim.x + threadIdx.x];
__syncthreads();

for (int s = 1; s < blockDim.x; s *= 2) {
    if (threadIdx.x % (2 * s) == 0) {
        sdata[threadIdx.x] += sdata[threadIdx.x + s];
    }
    __syncthreads();
}
// result in sdata[0]`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It's actually optimal — this is the fastest possible reduction pattern",
        "It has one problem, warp divergence, but no bank-conflict issue",
        "Two compounding problems: (1) the modulo test `threadIdx.x % (2*s) == 0` means active threads are scattered non-contiguously within each warp (e.g., at s=1 only even threadIdx.x are active), so warps diverge and serialize the active/inactive paths instead of cleanly retiring idle warps; (2) the access pattern `sdata[threadIdx.x] += sdata[threadIdx.x + s]` with a growing stride s causes shared-memory bank conflicts at several stages of the reduction (whenever s shares a common factor with the 32 banks), neither of which would occur with a sequential-addressing formulation",
        "It's correct and has no meaningful performance issue at all beyond needing __syncthreads() calls, which are unavoidable in any reduction",
      ],
      correctIndex: 2,
      // pruned
    },
    explanation:
      "This textbook 'interleaved addressing' reduction has two independent, compounding costs. " +
      "First, the condition `threadIdx.x % (2*s) == 0` selects active threads that are not " +
      "contiguous within a warp — at s=1 it's every even lane, at s=2 every 4th lane, and so on — " +
      "so each warp still contains a mix of active and inactive lanes for most of the reduction, " +
      "meaning the warp scheduler cannot simply retire whole idle warps early; the warp still has " +
      "to execute the (masked) instruction stream even though a shrinking fraction of its lanes are " +
      "doing useful work, similar in spirit to ordinary warp divergence. Second, the address " +
      "`sdata[threadIdx.x]` for the active, non-contiguous lanes combined with the growing stride s " +
      "produces shared-memory access patterns that, at several stages, map multiple active lanes " +
      "onto the same bank at different addresses — a genuine bank conflict distinct from the " +
      "divergence issue. Both problems are fixed simultaneously by switching to 'sequential " +
      "addressing' (see the companion reduction question), which keeps the active-thread set " +
      "contiguous starting from threadIdx.x == 0 at every stage.",
  },
  {
    id: "gpu-cuda-reduction-02",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Sequential-addressing reduction fix",
    tags: ["reduction", "shared-memory", "warp-divergence"],
    type: "trace",
    prompt:
      "This is the standard fix for the naive interleaved-addressing reduction above — same total " +
      "work, same result, but restructured indexing. blockDim.x == 256. Why is this version " +
      "faster, specifically with respect to warp divergence?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__shared__ float sdata[256];
sdata[threadIdx.x] = input[blockIdx.x * blockDim.x + threadIdx.x];
__syncthreads();

for (int s = blockDim.x / 2; s > 0; s >>= 1) {
    if (threadIdx.x < s) {
        sdata[threadIdx.x] += sdata[threadIdx.x + s];
    }
    __syncthreads();
}
// result in sdata[0]`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It isn't actually any faster — the number of __syncthreads() calls and total additions performed are identical to the naive version",
        "It's faster because `threadIdx.x < s` is always contiguous starting from lane 0: for any given s, the active threads are exactly threadIdx.x in [0, s), so entire warps are either fully active or fully inactive (once s drops below 32, only the first warp does any work at all, and every other warp is uniformly idle and can fall through with minimal cost) — this eliminates the within-warp divergence the modulo-based version suffered from, though it still pays the same number of barrier/synchronization rounds",
        "It's faster purely because it uses right-shift (>>=) instead of multiplication, which is a cheaper CPU instruction",
        "It's faster because it eliminates the need for __syncthreads() entirely",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "Sequential addressing replaces the scattered `threadIdx.x % (2*s) == 0` condition with " +
      "`threadIdx.x < s`, which selects a contiguous prefix of thread indices at every stage of the " +
      "reduction. Because that active set always starts at lane 0 and is contiguous, it aligns " +
      "cleanly with warp boundaries: for s >= 32, whole warps are either entirely active or " +
      "entirely inactive (no per-lane masking within a warp), and once s drops below 32 only a " +
      "single warp does any real work while the rest trivially fall through the (false) condition — " +
      "there is no warp that contains a genuine mix of active and predicated-off lanes doing " +
      "different things the way the modulo version had at every stage. The access pattern " +
      "`sdata[threadIdx.x] + sdata[threadIdx.x+s]` with contiguous threadIdx.x also has " +
      "substantially better shared-memory bank behavior than the strided modulo version, though the " +
      "canonical further optimizations (unrolling the last warp to skip __syncthreads() once only " +
      "one warp remains active, and replacing the final stages with warp-shuffle instructions " +
      "entirely) go further still. This progression — naive interleaved, to sequential addressing, " +
      "to warp-shuffle-based — is the standard worked example (from Mark Harris's well-known " +
      "'Optimizing Parallel Reduction in CUDA' NVIDIA talk) of iteratively removing divergence and " +
      "synchronization overhead from a canonical parallel primitive.",
  },
  {
    id: "gpu-cuda-pinned-memory-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Pinned host memory vs pageable host memory transfer speed",
    tags: ["pinned-memory", "page-locked", "dma", "pcie"],
    type: "trace",
    prompt:
      "Version A copies from ordinary `malloc`'d (pageable) host memory via `cudaMemcpy`. Version " +
      "B copies from `cudaMallocHost`-allocated (pinned/page-locked) host memory of the same size. " +
      "What's the expected difference, and what's the downside of allocating most of a system's " +
      "RAM as pinned memory?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `// Version A
float* hostPageable = (float*)malloc(bytes);
cudaMemcpy(dev, hostPageable, bytes, cudaMemcpyHostToDevice);

// Version B
float* hostPinned;
cudaMallocHost(&hostPinned, bytes);   // page-locked
cudaMemcpy(dev, hostPinned, bytes, cudaMemcpyHostToDevice);`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No difference — cudaMemcpy always achieves the same bandwidth regardless of host allocation type",
        "Version B is typically meaningfully faster: pageable host memory can be relocated or swapped out by the OS virtual memory manager at any time, so the DMA engine cannot safely target it directly — the driver must first stage a copy through an internal pinned buffer before the actual device transfer, adding an extra memcpy's worth of overhead. Pinned memory is guaranteed to stay at a fixed physical address, so the DMA engine can transfer it directly, and it's also a prerequisite for true asynchronous transfers (cudaMemcpyAsync) that overlap with compute. The downside: allocating too much pinned memory reduces the pool of pageable memory available to the OS for other processes/swapping, which can degrade overall system performance",
        "Version A is faster because pageable memory benefits from OS-level read-ahead caching that pinned memory disables",
        "Pinned memory is only relevant for device-to-device transfers, not host-to-device",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "A DMA engine transfers data by physical address and needs the source/destination region to " +
      "stay put for the transfer's duration. Pageable memory (ordinary malloc/new) can be moved or " +
      "swapped by the OS's virtual memory subsystem at any time, so cudaMemcpy from pageable memory " +
      "cannot hand it directly to the DMA engine — the CUDA driver instead copies it first into an " +
      "internal pinned staging buffer, then DMAs from there, effectively doubling the host-side " +
      "memory traffic for that transfer. cudaMallocHost (or cudaHostRegister on existing memory) " +
      "page-locks the allocation, guaranteeing a fixed physical address, so the DMA engine can " +
      "transfer it directly — typically yielding meaningfully higher achieved bandwidth, and it's " +
      "also a hard requirement for genuinely asynchronous cudaMemcpyAsync calls to overlap with " +
      "kernel execution or other transfers (an async copy from pageable memory silently falls back " +
      "to synchronous behavior). The tradeoff is that pinned pages cannot be paged out by the OS, " +
      "so over-allocating pinned memory shrinks the pool available for other processes' virtual " +
      "memory management and can cause system-wide memory pressure or degraded multitasking — " +
      "pinned memory should be reserved for actual transfer staging buffers, not used as a " +
      "general-purpose host allocator.",
  },
  {
    id: "gpu-cuda-streams-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Overlap across CUDA streams vs in-order execution within a stream",
    tags: ["streams", "overlap", "async", "events"],
    type: "trace",
    prompt:
      "Assume pinned host memory and a GPU with separate copy and compute engines. Compare the " +
      "two launch sequences below. Which operations can actually execute concurrently?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `// Sequence A: everything on the default stream
cudaMemcpyAsync(d_a, h_a, bytes, cudaMemcpyHostToDevice);
kernelA<<<blocks, threads>>>(d_a);
cudaMemcpyAsync(d_b, h_b, bytes, cudaMemcpyHostToDevice);
kernelB<<<blocks, threads>>>(d_b);

// Sequence B: two independent streams
cudaMemcpyAsync(d_a, h_a, bytes, cudaMemcpyHostToDevice, stream1);
kernelA<<<blocks, threads, 0, stream1>>>(d_a);
cudaMemcpyAsync(d_b, h_b, bytes, cudaMemcpyHostToDevice, stream2);
kernelB<<<blocks, threads, 0, stream2>>>(d_b);`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both sequences behave identically — CUDA automatically parallelizes independent operations regardless of which stream they're issued on",
        "In Sequence A, all four operations execute strictly in issue order on the single (default) stream, with no overlap between any of them, since operations within one stream are always ordered relative to each other; in Sequence B, because stream1 and stream2 are independent, kernelA's compute (stream1) can execute concurrently with d_b's H2D copy (stream2) — the copy engine and the compute (SM) engine are separate hardware resources that can run truly in parallel, so the copy for kernelB's input can be prefetched while kernelA is still running",
        "Sequence B is actually slower because using multiple streams forces additional synchronization between them",
        "Neither sequence can overlap copy and compute, because a GPU has only one engine that handles both memory transfers and kernel execution",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "A CUDA stream is an ordered queue: operations issued into the same stream are guaranteed to " +
      "execute in the order they were issued, with each waiting for the previous one to complete " +
      "(this is what 'stream' ordering means), which is exactly why Sequence A cannot overlap any " +
      "of its four operations even though, e.g., copying d_b in principle has nothing to do with " +
      "kernelA. Operations issued into different streams have no such ordering constraint relative " +
      "to each other, so the hardware scheduler is free to run them concurrently if the underlying " +
      "engines are available — modern GPUs expose separate copy engines (often one for H2D and one " +
      "for D2H) and compute (SM) resources, so a memory transfer on stream2 genuinely can proceed on " +
      "the copy engine at the same time kernelA runs on the SMs from stream1's queue. This requires " +
      "pinned host memory (async copies from pageable memory silently serialize, as in the pinned " +
      "memory question above) and enough independent work to actually fill both engines. This " +
      "stream-based overlap of transfer and compute — pipelining a large problem into chunks, each " +
      "on its own stream, so chunk k's compute overlaps chunk k+1's transfer — is the standard " +
      "technique for hiding PCIe transfer latency behind useful GPU work.",
  },
  {
    id: "gpu-cuda-simt-vs-simd-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "SIMT execution model vs classic SIMD",
    tags: ["simt", "simd", "execution-model"],
    type: "trace",
    prompt:
      "A colleague argues that a CUDA warp is 'just SIMD with extra steps' since all 32 threads " +
      "execute the same instruction at the same time on real hardware. What is the most accurate " +
      "characterization of the actual distinction NVIDIA draws between SIMT and SIMD?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "There is no real distinction — SIMT is purely a marketing term for SIMD",
        "In SIMT, each thread is programmed as if it has its own independent instruction pointer, register state, and call stack, and can branch independently in source code — the hardware then handles divergent per-thread control flow itself via predication and reconvergence (as in the warp-divergence questions above), transparently to the programmer. In classic SIMD, there is a single instruction stream operating on a vector of data lanes with no notion of a lane taking an independent branch at all — any lane-dependent behavior must be expressed explicitly via manual masking/blending in the vector code itself, visible in the source",
        "SIMD supports divergent control flow between lanes natively in hardware, while SIMT does not support divergence at all and requires all threads to always take the same path",
        "SIMT and SIMD differ only in vector width — SIMT is simply SIMD with a 32-wide vector register instead of 4/8/16-wide",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "The programming-model distinction is real, even though the underlying execution on a warp " +
      "is, at the hardware level, close to SIMD-like lockstep issue. In SIMT (Single Instruction, " +
      "Multiple Threads), the programmer writes ordinary scalar-looking code per thread — each " +
      "thread has its own logical program counter, registers, and local/call-stack state, and is " +
      "free to branch based on its own thread-specific data (as in every kernel in this set with an " +
      "`if (threadIdx.x ...)`). The hardware is responsible for detecting when threads within a warp " +
      "diverge and handling it via predicated execution and a reconvergence mechanism (historically " +
      "a hardware reconvergence stack; since Volta, more flexible per-thread program counters under " +
      "independent thread scheduling), entirely transparent to the source code. In classic SIMD " +
      "(e.g., x86 SSE/AVX, ARM NEON), there is exactly one instruction stream applied uniformly to " +
      "all lanes of a vector register, and the vector ISA has no native concept of 'this lane " +
      "branches differently' — any lane-conditional behavior has to be hand-encoded by the " +
      "programmer or compiler as explicit compare/mask/blend/select instructions operating on the " +
      "whole vector. SIMT's key innovation is moving that masking/divergence-handling burden from " +
      "the programmer into the hardware/compiler, at the cost of the performance penalty divergent " +
      "warps pay when threads do disagree.",
  },
  {
    id: "gpu-cuda-shared-mem-race-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Cross-warp shared-memory producer/consumer without a barrier",
    tags: ["shared-memory", "race-condition", "warp-scheduling"],
    type: "trace",
    prompt:
      "A block has 4 warps (128 threads). Thread 0 (in warp 0) writes a flag and a value into " +
      "shared memory; thread 32 (the first thread of warp 1) reads them, with no barrier or fence " +
      "between the write and the read. The programmer assumes warp 0 always 'runs first' since it " +
      "has the lower thread index. What actually happens?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__shared__ int flag;
__shared__ float payload;

__global__ void crossWarp() {
    if (threadIdx.x == 0) {
        payload = computeExpensiveValue();
        flag = 1;                     // no fence/barrier after this
    }
    if (threadIdx.x == 32) {
        while (flag == 0) { /* spin, hoping to see it flip */ }
        use(payload);
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "This is guaranteed safe: warps within a block always execute in ascending warp-index order, so warp 0 always finishes before warp 1 begins",
        "This is a genuine, hardware-level race with no correctness guarantee: the CUDA programming model makes no guarantee about the relative execution order or interleaving of different warps within a block absent explicit synchronization — warp 1 may run before, after, or interleaved with warp 0 in any order the SM's warp scheduler chooses, so thread 32's spin-wait on `flag` is not even guaranteed to observe thread 0's write in a timely or ordered fashion without a proper memory fence, and even if it does see flag==1, nothing guarantees `payload`'s write becomes visible to thread 32 before the flag's write does, absent a fence enforcing that ordering",
        "This will deadlock, because thread 32 cannot spin-wait on shared memory written by a different warp",
        "This is safe as long as both threads are within the same thread block, regardless of which warp they're in, since all shared memory writes within a block are automatically sequentially consistent",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "CUDA's execution model explicitly does not guarantee any relative ordering or interleaving " +
      "between different warps of the same block — the SM's warp scheduler is free to run resident " +
      "warps in whatever order and interleaving it chooses (including time-slicing them at " +
      "instruction granularity), and there is no notion of warp 0 having scheduling priority over " +
      "warp 1 merely because of its lower index. A hand-rolled 'flag' spin-wait pattern like this " +
      "has two separate problems: first, thread 32 might begin executing (and even finish spinning, " +
      "since flag could still hold stale shared-memory contents that happen to already look nonzero) " +
      "before thread 0 has written anything at all; second, even once thread 0's write to `flag` " +
      "is observed, nothing in this code enforces that the earlier write to `payload` is visible " +
      "to thread 32 by that point — the compiler and hardware are free to reorder or delay the " +
      "`payload` write relative to the `flag` write absent an explicit fence like " +
      "`__threadfence_block()` between them. The correct, supported way to synchronize *all* " +
      "threads in a block is `__syncthreads()`; genuinely producer/consumer patterns across warps " +
      "that can't use a full block barrier need explicit fences (`__threadfence_block()`) combined " +
      "with atomics on the flag, not a plain spin on a plain shared variable.",
  },
  {
    id: "gpu-cuda-pcie-bottleneck-01",
    category: "gpu-cuda",
    difficulty: "easy",
    title: "PCIe transfer time dominating a tiny kernel",
    tags: ["pcie", "transfer-overhead", "data-residency"],
    type: "trace",
    prompt:
      "A kernel adds two 1 KB float arrays element-wise (256 floats each) and is invoked once: " +
      "`cudaMemcpy` both inputs to the device, launch the kernel, `cudaMemcpy` the result back. " +
      "The addition itself takes a few hundred nanoseconds on the GPU. What dominates the total " +
      "wall-clock time of this operation, and what's the implication for an iterative algorithm " +
      "that calls a similar kernel thousands of times in a loop?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The kernel's compute time dominates — 256 floating point additions is enough work to saturate the GPU's compute throughput",
        "The PCIe host-device transfer overhead dominates: each cudaMemcpy has a largely fixed latency floor (typically several microseconds) regardless of how little data is moved, which for a 1 KB transfer is far larger than the actual transfer-bandwidth-limited time and utterly dwarfs the kernel's sub-microsecond compute; for an iterative algorithm, repeatedly round-tripping data to the host every iteration means this fixed overhead is paid every single iteration — keeping the data resident on the GPU across iterations (allocating once, launching multiple kernels back-to-back, only copying results back at the very end) avoids re-paying that cost each time",
        "Kernel launch overhead and PCIe transfer overhead are the same cost and can be ignored as equal contributors",
        "The result is undefined because 256 elements is not a multiple of the warp size 32... it is (256 = 8*32), so this option is simply wrong on its premise",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "PCIe (or NVLink) host-device transfers, like kernel launches, have a largely fixed latency " +
      "floor per transfer — driver overhead, transfer setup, and the interconnect's round-trip " +
      "latency — that dominates for small payloads; achieving anything close to PCIe's rated peak " +
      "bandwidth requires transfers on the order of many megabytes, not kilobytes. A 1 KB transfer " +
      "spends nearly all of its time paying that fixed overhead rather than actually being " +
      "bandwidth-limited, and with the kernel itself doing only a few hundred nanoseconds of real " +
      "compute, the two cudaMemcpy calls (H2D and D2H) can easily account for well over 99% of the " +
      "operation's wall-clock time. This is a common trap in naive GPU-acceleration attempts: " +
      "porting a small, frequently-called computation to the GPU can make it *slower* overall " +
      "purely due to transfer overhead, even though the GPU computes the kernel itself far faster " +
      "than a CPU would. The standard fix for an iterative algorithm is to keep the working data " +
      "resident in device memory across iterations — allocate once, launch each iteration's kernel " +
      "back-to-back operating on the already-resident device buffers, and copy results back to the " +
      "host only when actually needed (e.g., once at the end, or periodically for logging) — turning " +
      "many small fixed-overhead transfers into at most a couple of large ones.",
  },
  {
    id: "gpu-cuda-register-spill-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Register spilling to local memory",
    tags: ["registers", "local-memory", "spilling", "latency"],
    type: "trace",
    prompt:
      "A kernel is aggressively unrolled and keeps many simultaneously-live local variables, " +
      "pushing its register requirement past the architectural per-thread register cap (e.g., 255 " +
      "on many recent architectures) or past a compiler/launch_bounds-imposed limit. What happens " +
      "to the variables that don't fit, and what's the performance implication?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__global__ void __launch_bounds__(128, 1) heavyUnroll(float* out, const float* in) {
    float acc[64];   // 64 simultaneously-live locals, heavily used throughout
    #pragma unroll
    for (int i = 0; i < 64; ++i) acc[i] = in[threadIdx.x * 64 + i];
    // ... extensive per-element compute reusing all 64 values repeatedly ...
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The compiler always simply refuses to compile the kernel if it needs too many registers",
        "The excess variables 'spill' to what CUDA calls local memory — despite the name, this is NOT on-chip storage; it is a per-thread private region carved out of the same off-chip DRAM as global memory (cached through L1/L2 like global memory accesses), so spilled variables incur latency far closer to a global memory access than to a register access, and a kernel with heavy spilling can slow down significantly even though it 'has more variables to work with'",
        "The excess variables are automatically promoted to shared memory instead, which is nearly as fast as registers",
        "The excess variables silently alias onto already-used registers, causing incorrect results but no performance change",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "'Local memory' is one of the more misleading terms in the CUDA memory model: it sounds like " +
      "it should be fast, on-chip, thread-private storage, but architecturally it is simply a " +
      "private, per-thread-indexed region of the same off-chip DRAM backing global memory — it goes " +
      "through the same L1/L2 cache hierarchy as global memory accesses, and a cache miss on a " +
      "spilled local variable pays essentially the same few-hundred-cycle latency as a global memory " +
      "miss. When the compiler's register allocator cannot fit all of a kernel's live values into " +
      "the per-thread register budget (bounded by the architectural max, or a tighter cap imposed by " +
      "`__launch_bounds__`/`--maxrregcount` to preserve occupancy), it spills the excess values to " +
      "local memory, inserting the necessary loads/stores transparently — the source code doesn't " +
      "change, but the generated SASS now contains many more (and much higher latency) memory " +
      "operations than a variable that stayed in a register would need. A kernel that keeps too much " +
      "simultaneously live (like 64 heavily-reused accumulators here) is a classic way to trigger " +
      "this: it can end up slower than a version with less unrolling or fewer live values, precisely " +
      "because 'more work per instruction' is undone by every one of those values effectively " +
      "becoming a global-memory-latency access. `nvcc --ptxas-options=-v` reports spill loads/stores " +
      "per kernel, and Nsight Compute flags high local memory traffic, both standard ways to catch " +
      "this in practice.",
  },
  {
    id: "gpu-cuda-multi-gpu-nccl-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Peer-to-peer GPU transfer vs routing through host memory",
    tags: ["multi-gpu", "nvlink", "peer-access", "nccl"],
    type: "trace",
    prompt:
      "Two GPUs sit in the same node. Version A calls `cudaDeviceEnablePeerAccess` and then " +
      "`cudaMemcpyPeerAsync` to move data directly from GPU 0 to GPU 1. Version B (peer access not " +
      "enabled/available) copies GPU 0 -> pinned host buffer -> GPU 1 using two separate " +
      "cudaMemcpy calls. What's the expected performance difference, and why do multi-GPU " +
      "libraries like NCCL prioritize the Version A path?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No difference — both approaches move the same number of bytes over the same physical PCIe/NVLink topology regardless of the API used",
        "Version A is typically substantially faster: with peer access enabled (and ideally an NVLink interconnect between the two GPUs, which offers far higher bandwidth than PCIe), data moves directly from GPU 0's memory to GPU 1's memory in a single transfer, potentially without even routing through the host's root complex. Version B requires two full transfers (device-to-host, then host-to-device) each paying its own latency/bandwidth cost and consuming host-side PCIe bandwidth and staging buffer capacity twice, roughly doubling the data movement for the same logical transfer",
        "Version B is faster because host memory has higher bandwidth than any GPU-to-GPU interconnect",
        "Peer access provides no bandwidth benefit over host staging — it exists purely to simplify application code",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "When peer-to-peer access is enabled between two GPUs on the same node (and supported by the " +
      "topology — same PCIe switch/root complex, or connected via NVLink), the GPUs' memory " +
      "controllers can address each other's device memory directly, so `cudaMemcpyPeerAsync` (or a " +
      "plain `cudaMemcpy` with peer access enabled) can move data GPU-to-GPU in a single transfer, " +
      "at the bandwidth of whichever interconnect actually carries it — NVLink offers considerably " +
      "higher bandwidth than PCIe, which is precisely why multi-GPU training/inference workloads on " +
      "NVLink-connected systems (as opposed to plain PCIe-only ones) scale so much better across " +
      "GPUs. Without peer access, the driver has no choice but to stage the transfer through host " +
      "memory: a device-to-host copy off GPU 0 followed by a separate host-to-device copy onto GPU " +
      "1, which moves the same logical payload twice across the host's PCIe links and adds the " +
      "latency and bandwidth cost of both hops plus the staging buffer overhead, roughly doubling " +
      "the effective transfer cost for the same data. This is exactly why NCCL (NVIDIA's collective " +
      "communication library, used for multi-GPU all-reduce, broadcast, etc. in distributed " +
      "training) actively probes and prefers direct peer/NVLink paths over host-staged transfers, " +
      "falling back to host-mediated copies only when direct peer access genuinely isn't available " +
      "(e.g., GPUs on different, unconnected PCIe root complexes, or across nodes where network " +
      "transport like InfiniBand with GPUDirect RDMA becomes the relevant direct-path analogue).",
  },
  {
    id: "gpu-cuda-independent-thread-scheduling-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Warp-synchronous code and Volta+ independent thread scheduling",
    tags: ["independent-thread-scheduling", "warp-sync", "syncwarp", "volta"],
    type: "trace",
    prompt:
      "This kernel relies on the old 'warp-synchronous programming' assumption — common in " +
      "pre-Volta CUDA code — that all 32 threads of a warp are always implicitly lockstep, so no " +
      "explicit synchronization is needed for one lane to see another lane's shared-memory write " +
      "within the same warp. What happens when this kernel runs on a Volta-or-later GPU?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__shared__ int buf[32];

__global__ void warpSyncAssumption() {
    int lane = threadIdx.x % 32;
    if (lane < 16) {
        buf[lane] = compute(lane);
        // old assumption: no __syncwarp() needed — "the warp is always in lockstep"
    } else {
        int v = buf[lane - 16];   // read what the "other half" of the warp wrote
        use(v);
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "This is guaranteed correct on every architecture, since a warp is always executed in strict lockstep by definition, regardless of CUDA compute capability",
        "This is unreliable on Volta and later: prior to Volta, divergent branches were handled with a hardware reconvergence stack that, in practice, often executed one side of a branch fully before the other, which could accidentally make warp-synchronous code 'work' without explicit synchronization. Starting with Volta's independent thread scheduling, each thread has its own program counter and call stack, and the hardware is explicitly permitted to interleave the execution of divergent branches within a warp at finer granularity — so the else-branch's read of buf[lane-16] is no longer guaranteed to happen after the if-branch's write, and this code needs an explicit __syncwarp() (or restructuring) to be correct",
        "This causes a compile-time error on Volta and later, since the compiler statically detects the missing __syncwarp()",
        "Independent thread scheduling only affects performance, never correctness — this code was always safe and remains safe on every architecture",
      ],
      correctIndex: 1,
      // pruned
    },
    explanation:
      "Pre-Volta GPUs implemented warp divergence using a single shared program counter plus a " +
      "hardware reconvergence stack: on a divergent branch, the warp executed one path to " +
      "completion (or to the next divergence point), then the other, then reconverged — a rigid but " +
      "predictable enough pattern that some real-world code came to informally rely on one branch's " +
      "side effects (like a shared-memory write) being fully visible before the other branch ran, " +
      "without ever calling an explicit intra-warp synchronization primitive. This was always " +
      "technically an unsupported assumption ('implicit warp-synchronous programming', which " +
      "NVIDIA's own documentation warned against), but it often happened to work. Starting with " +
      "Volta, the architecture introduced independent thread scheduling: each thread gets its own " +
      "program counter and call stack, and the hardware is explicitly free to interleave execution " +
      "of a warp's divergent paths at much finer granularity (even instruction-by-instruction) " +
      "rather than one-path-then-the-other, in order to enable new capabilities like fine-grained " +
      "producer-consumer patterns and mutual-exclusion primitives within a warp. That means code " +
      "which never used an explicit barrier can now genuinely observe the else-branch executing " +
      "before, during, or interleaved with the if-branch's write, producing stale or garbage reads " +
      "of `buf` that would not have occurred on older hardware. The fix is `__syncwarp()` (with an " +
      "appropriate active-lane mask) between the divergent write and the later read that depends on " +
      "it, which is precisely why NVIDIA added `__syncwarp()` and the `_sync` suffix (`__shfl_sync`, " +
      "`__ballot_sync`, etc.) to the warp-level primitive family starting with Volta's CUDA 9 " +
      "toolkit — making the required synchronization explicit rather than an unstated hardware " +
      "coincidence.",
  },
];
// result in sdata[0]