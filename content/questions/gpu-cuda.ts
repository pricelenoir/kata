import type { TraceQuestion } from "@/types/question";

export const gpuCudaQuestions: TraceQuestion[] = [
  {
    id: "gpu-cuda-thread-index-01",
    category: "gpu-cuda",
    difficulty: "easy",
    title: "Computing a global thread index from blockIdx and threadIdx",
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
      choices: ["10", "266", "522", "2562"],
      correctIndex: 2,
    },
    explanation:
      "The standard global-index formula is `blockIdx.x * blockDim.x + threadIdx.x`: it treats " +
      "the grid as a flattened 1-D array of threads, where each block contributes `blockDim.x` " +
      "consecutive slots before the next block's threads begin. With blockDim.x == 256, block 2 " +
      "owns global indices [512, 767]; adding threadIdx.x == 10 gives 522. The other options are " +
      "the three indexing slips that show up most often: 10 drops the block offset entirely (every " +
      "block then writes over block 0's range), 266 uses a block stride of 256 but the wrong block " +
      "number, and 2562 comes from swapping the operands to `threadIdx.x * blockDim.x + " +
      "blockIdx.x`, which maps threads onto a completely different and heavily overlapping set of " +
      "addresses.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#thread-hierarchy",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/programming-model.html#thread-blocks-and-grids",
    ],
  },
  {
    id: "gpu-cuda-thread-index-02",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "A 2-D grid launch that over-provisions threads for the image size",
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
    img[idx] = img[idx] * 2.0f;   // no "if (row >= height || col >= width) return;" guard
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Some out-of-range threads land on a valid but wrong (row, col) inside the buffer and corrupt unrelated pixels, while threads past the last image row index off the end of the allocation",
        "The extra threads are skipped by the hardware, which clamps any index derived from blockIdx and threadIdx to the extent of the allocation the pointer came from, so the output image is correct",
        "Every out-of-range access traps at runtime and surfaces through cudaGetLastError as an out-of-bounds fault, leaving the image unmodified and the kernel's other work discarded",
        "Compile-time error: nvcc rejects a launch whose grid dimensions do not evenly divide the width and height extents that are passed to the kernel as arguments",
      ],
      correctIndex: 0,
    },
    explanation:
      "CUDA performs no automatic bounds checking on global memory accesses: indexing math is " +
      "just pointer arithmetic. Since 1000 is not a multiple of 32, each row of 32-wide blocks " +
      "has col values from 992 to 1023, so cols 1000-1023 are logically out of range for that " +
      "row. Because idx = row*width+col is a flat linear index, an out-of-range col in one row " +
      "can produce an idx that actually falls inside the buffer but belongs to a completely " +
      "different (row, col) pair, silently corrupting unrelated pixels rather than cleanly " +
      "crashing. Threads in the last block-row (row >= 1000) push idx past the end of the " +
      "allocation entirely, which may or may not fault depending on what memory follows the " +
      "allocation. The fix is the classic guard, `if (row >= height || col >= width) return;` " +
      "before ever touching memory, which is cheap since it only costs a predicated exit for " +
      "the small fraction of over-provisioned threads.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#thread-hierarchy",
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#thread-and-block-heuristics",
      "https://docs.nvidia.com/cuda/compute-sanitizer/index.html",
    ],
  },
  {
    id: "gpu-cuda-warp-divergence-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "A warp whose even and odd lanes take different branches",
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
        "The 16 even lanes run heavyA() on one group of ALUs while the 16 odd lanes run heavyB() on another, so the warp takes about max(time(heavyA), time(heavyB))",
        "The scheduler splits the two sides across two separate warps at dispatch, so the branch costs nothing beyond the compare that selects it",
        "Undefined behavior: threads within a single warp are not permitted to take different sides of a data-dependent branch",
        "The warp runs heavyA() with the odd lanes masked off, then heavyB() with the even lanes masked off, so it takes about time(heavyA) + time(heavyB)",
      ],
      correctIndex: 3,
    },
    explanation:
      "A warp is executed in lockstep by a single instruction unit issuing one instruction stream " +
      "at a time (SIMT). When threads within a warp disagree on a branch, the hardware serializes " +
      "the divergent paths: it executes the taken-path instructions with an active-lane mask that " +
      "disables (predicates off) the threads that didn't take that path, then executes the other " +
      "path with the complementary mask, and finally reconverges. Both heavyA() and heavyB() " +
      "therefore run to completion on the same warp scheduler slot, back to back, so the warp's " +
      "total time is approximately the sum of both branches' costs rather than the max, exactly " +
      "the opposite of true parallel execution. Volta's independent thread scheduling changes how " +
      "finely the two paths can be interleaved, but not the arithmetic: a warp still issues one " +
      "instruction per cycle for one subset of its lanes, so both branches' work is still paid for " +
      "in sequence. This is why warp-divergent branches on " +
      "performance-critical, hot-loop code (as opposed to occasional edge-case branches) are a " +
      "canonical CUDA anti-pattern; the fix is usually to restructure data or work assignment so " +
      "that divergence aligns with warp boundaries (e.g., branch on warp id, not thread id).",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html#simt-execution-model",
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#branching-and-divergence",
    ],
  },
  {
    id: "gpu-cuda-warp-divergence-02",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "A per-thread SpMV loop with data-dependent trip counts",
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
        "The AVERAGE rowLength across the warp's 32 lanes: a lane that exits early releases its issue slot to the lanes still iterating",
        "The MAXIMUM rowLength in the warp, 200 iterations here: lanes that finish early sit masked off while the warp keeps re-issuing the loop body",
        "The MINIMUM rowLength in the warp, 2 iterations here: the warp leaves the loop as soon as the first lane's exit condition fires",
        "Nothing to do with rowLength: the trip counts are hidden behind DRAM latency on vals and cols, which is what sets when the warp retires",
      ],
      correctIndex: 1,
    },
    explanation:
      "A per-thread `for` loop with a data-dependent trip count is a divergent branch re-evaluated " +
      "every iteration: on each pass, the warp checks `i < len` for all 32 lanes, and any lane " +
      "whose loop has already exited is simply masked off (predicated inactive) rather than freed " +
      "to do other work. A warp issues one instruction at a time on behalf of whichever lanes are " +
      "still active, and the loop is not done until every lane's exit condition has fired, so the " +
      "warp keeps re-issuing loop-body instructions (with an ever-shrinking active-lane mask) " +
      "until the longest-running lane (200 iterations) finishes. That tail is what makes ragged " +
      "or irregular workloads like sparse linear algebra so awkward on a GPU: by the final " +
      "iterations only the longest row's lane is doing useful work, while the warp still burns a " +
      "full issue slot on every pass. Standard " +
      "mitigations reassign work so each warp handles rows of similar length (row sorting/binning " +
      "by nonzero count), or switch to a vector/warp-per-row scheme (e.g., CSR-vector) that spreads " +
      "a single row's work across a whole warp instead of one lane.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#branching-and-divergence",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html#simt-execution-model",
    ],
  },
  {
    id: "gpu-cuda-coalescing-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Contiguous versus strided global memory access across a warp",
    tags: ["memory-coalescing", "global-memory", "bandwidth"],
    type: "trace",
    prompt:
      "Both kernels below are launched with the same total thread count and move the same number " +
      "of useful `float`s; Kernel B's arrays are 32 times larger so its strided indices stay in " +
      "bounds. Which is the more accurate performance prediction?",
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
        "Kernel A is dramatically faster: a warp's addresses coalesce into a couple of wide transactions, while Kernel B's need up to 32",
        "Both reach the same throughput: L1 and L2 absorb the access-pattern difference once the arrays are resident in cache",
        "Kernel B is faster: the stride spreads a warp's 32 requests over 32 independent memory partitions that are serviced simultaneously",
        "Kernel A is slower: 32 lanes storing into one 128-byte line create write-after-write hazards the store unit has to serialize",
      ],
      correctIndex: 0,
    },
    explanation:
      "The GPU's memory controller services a warp's load/store as a small number of memory " +
      "transactions covering fixed-size, aligned segments (historically 128-byte lines split into " +
      "32-byte sectors on modern architectures). When 32 consecutive threads request 32 " +
      "consecutive 4-byte floats, the whole warp's request fits in one or two of those aligned " +
      "segments: full coalescing, near-peak achieved bandwidth. When the same 32 threads request " +
      "addresses 32 floats (128 bytes) apart, each thread's 4-byte word typically lands in its own " +
      "distinct segment, so the controller must issue up to 32 separate transactions to satisfy one " +
      "warp's instruction, wasting the vast majority of each transaction's fetched bytes on data no " +
      "thread asked for. Array-of-structs vs struct-of-arrays layout and loop/index restructuring " +
      "are first-order performance concerns in CUDA for this reason: the access pattern, rather " +
      "than the total bytes moved, determines achieved bandwidth relative to the hardware's " +
      "peak.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#coalesced-access-to-global-memory",
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#strided-accesses",
      "https://developer.nvidia.com/blog/how-access-global-memory-efficiently-cuda-c-kernels/",
    ],
  },
  {
    id: "gpu-cuda-coalescing-02",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Array-of-structs versus struct-of-arrays for a single-field update",
    tags: ["memory-coalescing", "aos-soa", "global-memory"],
    type: "trace",
    prompt:
      "Both kernels compute the same thing, doubling every particle's x-coordinate, over the " +
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
        "scaleAoS is faster: holding x, y, and z on one line gives each thread better spatial locality for the field it actually touches",
        "They perform identically: both kernels move 4 useful bytes per particle, and achieved bandwidth tracks the useful bytes moved",
        "scaleSoA is substantially faster: AoS puts consecutive threads' x fields 12 bytes apart, so a warp spans 384 bytes where SoA spans 128",
        "scaleAoS is faster: `p[i].x` compiles to one 12-byte vector load per thread, which costs a warp no more than a 4-byte load would",
      ],
      correctIndex: 2,
    },
    explanation:
      "Coalescing depends on the *byte stride between consecutive threads' addresses*, not on " +
      "total useful bytes moved. In the AoS layout, thread i's `.x` sits at byte offset " +
      "i*sizeof(Particle) = i*12, so 32 consecutive threads' `.x` fields span 32*12 = 384 bytes, " +
      "spread across many more 32-byte sectors than the 128 bytes strictly needed for 32 floats, " +
      "and each sector fetched also carries `y`/`z` bytes no thread in this kernel even reads, " +
      "wasting roughly two-thirds of the fetched bandwidth. In the SoA layout, `px[i]` for 32 " +
      "consecutive threads is a single contiguous 128-byte run, which coalesces into the minimal " +
      "transaction count with no wasted bytes. Performance-sensitive CUDA code (and " +
      "GPU-friendly C++ in general, including Structure-of-Arrays libraries, `thrust`, and " +
      "columnar layouts) strongly prefers SoA whenever a kernel operates on one field at a time " +
      "across many elements, even though AoS can be more convenient for CPU code where cache lines " +
      "are line-granular but access is scalar/sequential per object rather than warp-parallel per " +
      "field.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#coalesced-access-to-global-memory",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#coalesced-global-memory-access",
      "https://developer.nvidia.com/blog/how-access-global-memory-efficiently-cuda-c-kernels/",
    ],
  },
  {
    id: "gpu-cuda-bank-conflict-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "A 32x32 shared-memory tile read with swapped indices",
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
        "No conflict: the 32 lanes read 32 distinct elements of the tile, and distinct elements are always spread across distinct banks",
        "A broadcast: the lanes all resolve to one bank, and the broadcast path returns the data to every lane in a single cycle",
        "A 2-way conflict: the even and odd halves of the warp collide pairwise, so the read costs roughly twice a conflict-free access",
        "A 32-way conflict: every lane lands on the same bank at a different address, so the read serializes into 32 accesses",
      ],
      correctIndex: 3,
    },
    explanation:
      "Shared memory is organized into 32 banks, each servicing one 4-byte-wide access per cycle; " +
      "a bank conflict occurs when two or more threads in the same warp access *different* " +
      "addresses that happen to map to the *same* bank (accessing the exact same address is a " +
      "conflict-free broadcast, not a conflict; that's a different case). Here tile[32][32] means " +
      "each row is 32 floats = 128 bytes = exactly 32 banks' worth, so incrementing the row index " +
      "by 1 lands on the identical bank (just a different address within it). For fixed " +
      "threadIdx.y, varying threadIdx.x across the warp sweeps the row index of tile[threadIdx.x]" +
      "[threadIdx.y], so all 32 lanes hit the same bank at distinct addresses, which is the worst " +
      "case: full 32-way serialization. The canonical fix is to pad the tile's row length by one " +
      "extra element, `__shared__ float tile[32][33]`, which shifts the row stride to 33 words, " +
      "no longer a multiple of 32 banks, so consecutive rows land on different banks and the " +
      "conflict disappears entirely, at the cost of a few wasted padding bytes.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#shared-memory-and-memory-banks",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#shared-memory-bank-conflicts",
      "https://developer.nvidia.com/blog/efficient-matrix-transpose-cuda-cc/",
    ],
  },
  {
    id: "gpu-cuda-bank-conflict-02",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Ranking three shared-memory access patterns across one warp",
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
        "All three tie: shared memory services a warp-wide access in a single transaction no matter what index expression the lanes compute",
        "Patterns 1 and 2 tie at one transaction each; Pattern 3 is a 2-way conflict, with lanes 0 and 16 sharing bank 0 and so on, so it takes roughly twice as long",
        "Pattern 1, then Pattern 3, then Pattern 2: 32 lanes asking for one address have to be serviced one lane at a time, which is the worst case here",
        "Pattern 3, then Pattern 1, then Pattern 2: doubling the index spreads the warp over twice as many banks, and Pattern 2 collapses the whole warp onto one",
      ],
      correctIndex: 1,
    },
    explanation:
      "Pattern 1 is the textbook conflict-free case: threadIdx.x directly selects bank " +
      "threadIdx.x mod 32, a bijection across the warp, so all 32 requests hit distinct banks and " +
      "complete in a single memory transaction. Pattern 2 is a broadcast: the hardware specifically " +
      "detects when every active lane requests the exact same address and services it as a single " +
      "read replicated to all lanes, also one transaction. The same address is never a conflict; " +
      "only *different* addresses mapping to the *same* bank are. Pattern 3 computes bank = " +
      "(threadIdx.x*2) mod 32; since multiplying by 2 is not coprime with 32, the mapping " +
      "threadIdx.x -> bank is 2-to-1 (lanes 0 and 16 both target bank 0 at different addresses, 1 " +
      "and 17 both target bank 1, etc.), so the memory unit must issue the access in two serialized " +
      "sub-passes, roughly halving throughput relative to Patterns 1 and 2. This generalizes: an " +
      "access stride of `s` against 32 banks produces an `n`-way conflict where n = gcd(32, s) " +
      "(for s=1, gcd(32,1)=1, no conflict; for s=2, gcd(32,2)=2, a 2-way conflict, matching Pattern " +
      "3 above), which is why power-of-two strides that share factors with the bank count are a " +
      "classic shared-memory performance trap.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#shared-memory-and-memory-banks",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#shared-memory-access-patterns",
      "https://developer.nvidia.com/blog/using-shared-memory-cuda-cc/",
    ],
  },
  {
    id: "gpu-cuda-occupancy-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Unrolling a memory-bound loop at 32 versus 96 registers per thread",
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
        "Version B is likely slower: only about 21 warps fit per SM at 96 registers versus 64 at 32, leaving the scheduler far fewer warps to switch to on a stall",
        "Version B is faster: fewer instructions retired per element is what matters, and a memory-latency-bound kernel is bounded by instruction count in the same way a compute-bound one is",
        "Version B is faster: the extra registers keep values out of local memory, and spill traffic is the only way register usage can affect a kernel's runtime",
        "Neither version wins: resident threads per SM are fixed at the architectural 2048 limit, and register usage changes only how much spilling each thread does",
      ],
      correctIndex: 0,
    },
    explanation:
      "Occupancy is bounded by whichever per-SM resource runs out first among registers, shared " +
      "memory, and the architectural max-threads/max-blocks-per-SM limits. Register count is " +
      "allocated per-thread but drawn from one shared per-SM pool, so raising per-thread register " +
      "usage directly shrinks the number of threads (and therefore warps) that can be co-resident. " +
      "For a latency-bound kernel (one where threads frequently stall on hundreds-of-cycles global " +
      "memory accesses), the GPU's primary tool for hiding that latency is having enough *other* " +
      "resident warps ready to issue instructions while a stalled warp waits; this is fundamentally " +
      "different from a CPU's out-of-order execution or deep speculation. Dropping from 64 to 21 " +
      "resident warps sharply reduces the scheduler's pool of latency-hiding work, so the SM is " +
      "more likely to sit idle with no eligible warp to issue, even though Version B's individual " +
      "threads do less looping overhead. CUDA occupancy tuning (`--" +
      "maxrregcount`, `__launch_bounds__`, the Occupancy Calculator/Nsight Compute) therefore treats " +
      "aggressive unrolling and register pressure as a tradeoff to be measured, not an unconditional " +
      "win. The right answer is workload-dependent (compute-bound kernels often *do* benefit from " +
      "fewer, register-heavy warps).",
    references: [
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#register-pressure",
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#occupancy",
      "https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html",
    ],
  },
  {
    id: "gpu-cuda-occupancy-02",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Block residency for a 256-thread kernel with a 40 KB shared tile",
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
        "8 blocks resident, limited by the 2048-thread cap divided by 256 threads per block",
        "32 blocks resident: the max-blocks-per-SM limit outranks the other per-SM budgets",
        "0 blocks: 40 KB exceeds the hard per-block shared memory limit, so the launch fails",
        "2 blocks resident, limited by shared memory: 40 KB per block against a 96 KB per-SM pool",
      ],
      correctIndex: 3,
    },
    explanation:
      "Occupancy is determined by the *most restrictive* of several independent per-SM budgets: " +
      "max resident threads, max resident blocks, register file size, and shared memory size. " +
      "Whichever runs out first caps the number of resident blocks. Here, the thread-count limit " +
      "would allow 2048/256 = 8 blocks, and the block-count limit would allow up to 32, but shared " +
      "memory only has 96 KB total to distribute, and each block statically claims 40 KB, so only " +
      "floor(96/40) = 2 blocks can fit (a third block's 40 KB would need 120 KB total, exceeding " +
      "the 96 KB budget). That caps the SM at 2*256 = 512 resident threads out of a possible 2048, " +
      "25% theoretical occupancy, leaving three-quarters of the SM's latency-hiding capacity " +
      "unused purely due to the shared-memory footprint, independent of how many registers the " +
      "kernel needs. Profiling tools therefore report *achieved* vs *theoretical* occupancy along " +
      "with the limiting resource, and shrinking a kernel's shared-memory tile (or tuning it via " +
      "dynamic shared memory) is a standard occupancy lever entirely distinct from register " +
      "pressure. One caveat on the numbers: on architectures where L1 and shared memory share a " +
      "carveout, the 96 KB figure is the configured shared-memory portion, not a fixed constant.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#calculating-occupancy",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#kernel-launch-and-occupancy",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/compute-capabilities.html#features-and-technical-specifications",
    ],
  },
  {
    id: "gpu-cuda-constant-memory-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Reading one constant-memory address versus 32 different ones per warp",
    tags: ["constant-memory", "broadcast", "memory-hierarchy"],
    type: "trace",
    prompt:
      "`__constant__ float coeffs[256];` is populated once via `cudaMemcpyToSymbol` before launch. " +
      "Kernel A has every thread in a warp read `coeffs[0]` (the same address). Kernel B has each " +
      "thread read `coeffs[threadIdx.x % 256]` (32 different addresses). What's the performance " +
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
        "Identical performance: constant memory always services a full warp in a single cycle regardless of the access pattern",
        "Kernel B is faster: reading different addresses lets the 32 threads use 32 independent constant cache ports in parallel",
        "Kernel A is markedly faster: one address broadcasts to all 32 lanes in a single access, while 32 distinct addresses serialize",
        "Both kernels are equally slow: constant memory always requires a round trip to global (device) memory, cache or not",
      ],
      correctIndex: 2,
    },
    explanation:
      "Constant memory sits in device DRAM but is backed by a small, dedicated per-SM constant " +
      "cache tuned specifically for the case where every thread in a warp requests the identical " +
      "address, a scenario extremely common for kernel parameters, physical constants, or a small " +
      "shared coefficient table. In that broadcast case, the hardware reads the value once and " +
      "fans it out to all 32 lanes, at throughput comparable to a register read. The moment threads " +
      "in a warp diverge to different addresses, that broadcast fast path no longer applies: the " +
      "constant cache must service each distinct address as a separate request, and accesses " +
      "serialize by the number of unique addresses touched, in the worst case as slow as 32 " +
      "separate lookups for 32 distinct addresses. This is the opposite tradeoff from global memory " +
      "coalescing (where *different-but-adjacent* addresses are the fast case): constant memory " +
      "wants *identical* addresses across a warp to be fast, which is why it's suited for " +
      "broadcast-style read-only data and not for per-thread lookup tables.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#constant-memory",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#constant-memory",
    ],
  },
  {
    id: "gpu-cuda-memory-hierarchy-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "A loop that reloads base[0] on every iteration while storing through out",
    tags: ["memory-hierarchy", "global-memory", "registers", "latency"],
    type: "trace",
    prompt:
      "Global memory access latency is on the order of several hundred cycles; a register read is " +
      "effectively free (~1 cycle, no separate instruction-level cost beyond the operation itself). " +
      "Every iteration of this loop stores one element of `out` and re-reads the same `base[0]` " +
      "from global memory. What is the most accurate prediction?",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `__global__ void scaleRows(float* out, const float* in, float* base) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    for (int k = 0; k < 1000; ++k) {
        out[i * 1000 + k] = in[i * 1000 + k] * base[0];   // base[0] read again each pass
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No meaningful difference: a load whose address never changes is loop-invariant, so nvcc hoists it into a register no matter what else the loop does",
        "Undefined behavior: every thread in the grid reads `base[0]` concurrently with no synchronization ordering those reads",
        "Marginally faster than hoisting: not holding `base[0]` in a live register frees a register slot and raises occupancy",
        "Likely much slower than hoisting `base[0]` into a local before the loop: the store through `out` may alias `base`, forcing a reload every pass",
      ],
      correctIndex: 3,
    },
    explanation:
      "Registers, shared memory, and global memory sit at very different points on the GPU memory " +
      "hierarchy's latency/bandwidth spectrum: a register operand costs essentially nothing extra, " +
      "shared memory is on the order of tens of cycles, and global memory (even cache-hot) is the " +
      "most expensive of the three to touch repeatedly, both in raw latency and in the load/store " +
      "unit issue slots and cache bandwidth it consumes on behalf of the whole warp. A load counts " +
      "as loop-invariant only if nothing in the loop can write the location it reads. Here each " +
      "iteration stores to `out[i * 1000 + k]`, and `out` and `base` are ordinary pointers the " +
      "compiler must assume may overlap, so it cannot prove the store leaves `base[0]` untouched " +
      "and reissues the load on the next pass: one load becomes a thousand. Marking the parameters " +
      "`__restrict__` (`float* __restrict__ out, const float* __restrict__ in, const float* " +
      "__restrict__ base`) promises they do not alias and lets the compiler keep the value live in " +
      "a register for the whole loop. Hoisting by hand with `float b = base[0];` before the loop " +
      "asserts the same property more directly and is the more portable habit for any value reused " +
      "across many iterations. `nvcc -Xptxas -v` and Nsight Compute's source view both make the " +
      "repeated global load visible in the generated SASS.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cpp-language-extensions.html#restrict-pointers",
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#device-memory-spaces",
      "https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html",
    ],
  },
  {
    id: "gpu-cuda-syncthreads-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "__syncthreads() called inside one side of a branch",
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
        "Well-defined: __syncthreads() synchronizes only the threads that actually reach it, so threads 0-127 rendezvous while the rest run on",
        "Compile-time error: nvcc rejects a __syncthreads() call whose reachability depends on a data-dependent branch condition",
        "Undefined behavior, with a hang among the likely outcomes: the barrier is block-wide and threads 128-255 never arrive at it",
        "The barrier is silently dropped for the whole block once one thread misses it, so nothing synchronizes but nothing hangs either",
      ],
      correctIndex: 2,
    },
    explanation:
      "__syncthreads() is a block-wide barrier: every thread in the block must arrive at the exact " +
      "same __syncthreads() call site before any of them are permitted to proceed past it. This is " +
      "explicit in the CUDA C++ Programming Guide, which warns that __syncthreads() used inside " +
      "conditional code is only well-defined if the condition evaluates identically across the " +
      "entire block. Here threads 0-127 reach the barrier while threads 128-255 never call " +
      "__syncthreads() at all on this control-flow path, so the arriving threads wait for " +
      "arrivals that may never come. Observed behavior varies by architecture and by what the " +
      "non-arriving threads do next: the kernel can hang outright (a watchdog timeout on a display " +
      "GPU, an indefinite stall on a headless compute GPU), or the missing threads can simply exit " +
      "the kernel and let the barrier release with only part of the block, which produces " +
      "plausible-looking results in testing and breaks later. The formal classification is " +
      "undefined behavior, not a guaranteed hang. The fix is to restructure so that either all threads in the " +
      "block reach a shared __syncthreads() (e.g., move the barrier outside the branch, doing the " +
      "conditional work before and after it), or use warp-level primitives like __syncwarp() with " +
      "an explicit mask when only synchronizing within a warp is actually needed.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cpp-language-extensions.html#thread-block-synchronization-functions",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#thread-block-synchronization",
    ],
  },
  {
    id: "gpu-cuda-syncthreads-02",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "A shared-memory stencil with no barrier between write and read",
    tags: ["syncthreads", "shared-memory", "race-condition"],
    type: "trace",
    prompt:
      "Each thread writes its own value into shared memory, then immediately reads its right " +
      "neighbor's slot, with no synchronization between the write and the read. What does this " +
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
        "A data race with nondeterministic results: nothing orders thread tid+1's write to smem[tid+1] before thread tid's read of that slot",
        "Correct as compiled: nvcc inserts an implicit __syncthreads() wherever a shared array is read after being written in the same kernel",
        "Safe as written: tid and (tid + 1) % blockDim.x always land in the same warp, and a warp issues its instructions in lockstep",
      ],
      correctIndex: 1,
    },
    explanation:
      "Threads within a CUDA block are not guaranteed to execute in any particular relative order " +
      "beyond what's imposed by explicit synchronization. Different warps within a block are " +
      "scheduled independently by the SM's warp schedulers, and there is no implicit guarantee that " +
      "warp k's instruction stream is 'ahead of' or 'behind' warp k+1's at any given moment (and " +
      "since threadIdx.x=255's neighbor wraps to threadIdx.x=0, this example spans multiple warps). " +
      "Without a `__syncthreads()` between the shared-memory write and the read of a *different* " +
      "thread's slot, this is a genuine race: the read may observe the freshly written value or " +
      "whatever the slot held beforehand (shared memory is not zero-initialized, and its contents " +
      "are whatever the previous block to occupy that SM left behind), varying nondeterministically " +
      "from run to run and from GPU to GPU. " +
      "The fix is a single `__syncthreads()` immediately after the write and before the " +
      "cross-thread read, which is precisely the barrier pattern every shared-memory stencil, " +
      "reduction, and tiling kernel relies on.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cpp-language-extensions.html#thread-block-synchronization-functions",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cuda-cpp-memory-model.html#data-races",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#shared-memory",
    ],
  },
  {
    id: "gpu-cuda-atomics-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Histogram binning with hist[bin]++ versus atomicAdd",
    tags: ["atomics", "race-condition", "histogram"],
    type: "trace",
    prompt:
      "Thousands of threads each increment one of 16 bins in a histogram held in global memory, " +
      "chosen by their input value; many threads land on the same bin at once. Compare the two " +
      "kernels below.",
    snippet: {
      language: "cpp",
      filename: "kernel.cu",
      code: `// Kernel A: no atomics
__global__ void histNaive(int* hist, const int* data, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) {
        int bin = data[i] % 16;
        hist[bin]++;              // read-modify-write, not atomic
    }
}

// Kernel B: atomics
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
        "Both kernels produce identical, correct histograms: `hist[bin]++` lowers to a single indivisible read-modify-write instruction on the GPU",
        "Kernel A is correct but slower: the compiler inserts a lock around `hist[bin]++` once it sees the address can be shared between threads",
        "Kernel A races and typically undercounts several bins: `hist[bin]++` is a non-atomic load, increment, and store. Kernel B is correct",
        "Kernel B is incorrect: atomicAdd only orders updates within a block, so increments from different blocks can still clobber one another",
      ],
      correctIndex: 2,
    },
    explanation:
      "`hist[bin]++` is not a single hardware operation: it lowers to a load of `hist[bin]`, an " +
      "increment in a register, and a store back to `hist[bin]`. When two (or more) threads from " +
      "potentially different warps or blocks execute this concurrently against the same bin with no " +
      "synchronization, both can load the same pre-increment value before either has written back, " +
      "so both compute old+1 and one thread's store simply clobbers the other's, a lost update, " +
      "the textbook read-modify-write race. `atomicAdd` guarantees the entire read-modify-write is " +
      "performed as one indivisible operation with respect to all other atomic operations on that " +
      "address, so concurrent atomicAdds to the same bin serialize correctly and no increment is " +
      "lost, at the cost of that serialization being a real (if hardware-accelerated) throughput " +
      "bottleneck under heavy contention on a small number of addresses. This is the direct GPU " +
      "analogue of a data race on an unsynchronized shared counter on a CPU; the fix (atomics) is " +
      "the same idea, just backed by dedicated atomic units in the memory subsystem rather than a " +
      "lock.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cpp-language-extensions.html#atomic-functions",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#atomics",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cuda-cpp-memory-model.html#data-races",
    ],
  },
  {
    id: "gpu-cuda-atomics-02",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "One global atomicAdd per element versus one per block",
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
        "Both are equally fast: an atomicAdd to shared memory and one to global memory have the same latency and behave identically under same-address contention",
        "Kernel A is faster: it skips both barriers, and global atomics are resolved by dedicated units at the L2 slices rather than being serialized",
        "Kernel B is slower: its shared-memory atomic still funnels every thread of the block onto one address, so it relocates the serialization on-chip and adds two barriers on top",
        "Kernel B is substantially faster at scale: it drops the traffic on the one contended global address from one atomic per element to one per block, absorbing the rest on-chip",
      ],
      correctIndex: 3,
    },
    explanation:
      "Atomic operations targeting the *same* memory address must be serialized by the hardware to " +
      "guarantee correctness, regardless of which memory space that address lives in. This is an " +
      "inherent property of atomicity, not an implementation quirk. Kernel A has every thread in " +
      "the entire grid contend for one global address, so total atomic-serialization cost scales " +
      "linearly with n (the full element count), turning what should be a bandwidth-bound reduction " +
      "into a serialization-bound bottleneck. Kernel B performs the same reduction in two tiers: " +
      "threads within a block still contend on a shared-memory atomic (`partial`), but shared " +
      "memory atomics are on-chip and considerably lower-latency than global memory atomics, and, " +
      "crucially, only one thread per block (thread 0) then issues an atomicAdd into the globally " +
      "contended `result` address, dropping the number of global-address atomic operations from n " +
      "down to n / blockDim.x (the number of blocks). Kernel B's shared-memory atomic does still " +
      "serialize within the block, which is why the fully tuned version replaces it with a " +
      "warp-shuffle reduction and one shared atomic per warp; even as written, though, on-chip " +
      "serialization at a few cycles per conflicting lane is far cheaper than the same number of " +
      "round trips to a single address in the L2. This block-then-grid hierarchical reduction " +
      "pattern (often extended with a further warp-shuffle-based reduction within each block before " +
      "the shared-memory atomic) is the standard technique for scaling reductions on GPUs with " +
      "heavy contention, and generalizes to any 'many writers, one hot address' pattern.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cpp-language-extensions.html#atomic-functions",
      "https://developer.nvidia.com/blog/faster-parallel-reductions-kepler/",
      "https://developer.download.nvidia.com/assets/cuda/files/reduction.pdf",
    ],
  },
  {
    id: "gpu-cuda-warp-shuffle-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "Warp-wide sum via a shared-memory tree versus __shfl_down_sync",
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
        "Version B is typically faster: the shuffle moves values between lanes in registers, with no shared-memory traffic, no bank-conflict exposure, and no barrier between steps",
        "Both land in the same place: __shfl_down_sync is lowered to the same shared-memory staging that Version A writes out by hand, so the two compile to near-identical SASS",
        "Version A is typically faster: a shuffle costs several times a shared-memory access, and __syncthreads() is nearly free once only one warp of the block is still active",
        "Version B is incorrect for a warp-wide sum: lanes near the top of the warp shuffle from source lanes past lane 31, which return garbage that propagates into lane 0's total",
      ],
      correctIndex: 0,
    },
    explanation:
      "Warp shuffle instructions let threads within the same warp read each other's registers " +
      "directly through a dedicated crossbar-style intra-warp exchange network, without ever " +
      "staging the data through shared memory. That eliminates the shared-memory store, the " +
      "bank-conflict potential of the tree-reduction access pattern, and, critically, the " +
      "repeated __syncthreads() barriers the shared-memory version needs after every halving step " +
      "(since __syncthreads() is a full block-wide barrier, using it just to synchronize 32 threads " +
      "within one warp is overkill). The upper lanes' shuffles are harmless rather than wrong: when " +
      "the source lane computed by `lane + offset` falls outside the warp, __shfl_down_sync returns " +
      "the calling lane's own value, so the upper lanes just fold their own value in again and end " +
      "up with partial sums nobody reads, while lane 0 still holds the true total of all 32 " +
      "values. __shfl_down_sync takes an explicit mask argument " +
      "(0xFFFFFFFF here, meaning 'all 32 lanes participate') because, since Volta's independent " +
      "thread scheduling, the hardware no longer assumes an entire warp is implicitly still " +
      "together at every instruction. The mask names the lanes that must reach this instruction " +
      "together; a value read from a lane that is not in the mask, or that has already exited, is " +
      "undefined. For warp-scoped reductions this shuffle-based pattern is the standard, " +
      "faster building block; a full block-wide reduction typically still needs one shared-memory " +
      "combine step across warps, often implemented as a warp-shuffle reduction per warp followed " +
      "by a small shared-memory reduction across the (few) per-warp partial results.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cpp-language-extensions.html#warp-shuffle-functions",
      "https://developer.nvidia.com/blog/using-cuda-warp-level-primitives/",
      "https://developer.nvidia.com/blog/faster-parallel-reductions-kepler/",
    ],
  },
  {
    id: "gpu-cuda-unified-memory-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "First GPU access to a managed allocation the host just initialized",
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
        "Nothing special: a managed allocation is physically resident on host and device at the same time, so the kernel reads it at full device-memory bandwidth from the first instruction",
        "On Pascal and later, the first GPU touch of each page faults, and the migration engine pulls that page across the interconnect before the access completes",
        "The launch returns an error: a managed range written by the host is owned by the host until it is released with cudaMemPrefetchAsync or an explicit cudaMemAdvise hint",
        "Nothing special: the runtime tracks which managed pages the host dirtied and issues one bulk migration at launch time, so an explicit prefetch would change nothing",
      ],
      correctIndex: 1,
    },
    explanation:
      "Unified (managed) memory presents a single pointer valid on both host and device, but " +
      "under the hood a page can only be resident in one place at a time (on architectures without " +
      "full hardware cache coherence across the interconnect); the CUDA runtime tracks ownership " +
      "and migrates pages on demand. This on-demand, page-fault-driven migration is a Pascal-and-" +
      "later (compute capability 6.0+) capability; earlier architectures supported cudaMallocManaged " +
      "with a coarser model that migrated the whole allocation at stream synchronization points " +
      "rather than faulting in individual pages. After the host-side initialization loop, every " +
      "page of `data` is resident in host memory. When the kernel's threads then access `data`, " +
      "each first touch of a given page by the GPU triggers a page fault handled by the GPU's page " +
      "migration engine, which pulls that page from host DRAM to device memory over PCIe/NVLink " +
      "before the faulting memory access can be satisfied; the requesting warp stalls until the " +
      "migration completes. Because this happens fault-by-fault (at page granularity) rather than " +
      "as one large batched transfer, it typically has higher overhead than either an explicit " +
      "`cudaMemcpy` (a single bulk DMA transfer issued upfront) or a `cudaMemPrefetchAsync(data, " +
      "size, deviceId)` call issued before the kernel launch, which proactively migrates the whole " +
      "range in one operation and lets the kernel start with the data already resident. Unified " +
      "memory trades this potential performance cliff for substantially simpler programming (no " +
      "manual copy management, and oversubscription of GPU memory becomes possible via automatic " +
      "eviction), which is why prefetching is recommended whenever the access pattern is known " +
      "ahead of time.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/unified-memory.html",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/unified-memory.html#data-prefetching",
      "https://developer.nvidia.com/blog/unified-memory-cuda-beginners/",
    ],
  },
  {
    id: "gpu-cuda-kernel-launch-overhead-01",
    category: "gpu-cuda",
    difficulty: "easy",
    title: "Ten thousand 10-element launches versus one fused launch",
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
        "Version B is typically far faster: every launch carries a fixed driver- and queue-side cost of a few microseconds, paid once here instead of 10,000 times",
        "They perform identically: the element count and the FLOP count are the same either way, and launches on a single stream are pipelined deeply enough to hide their own setup",
        "Version A is faster: a 10-element kernel fits inside one SM's registers and shared memory, so it avoids the scheduling cost of spreading a large grid over every SM",
        "Version A is faster: back-to-back launches on the same stream overlap, so launch k+1's setup runs on the CPU while launch k executes on the GPU",
      ],
      correctIndex: 0,
    },
    explanation:
      "Every kernel launch, regardless of how little work it does, incurs a largely fixed cost: " +
      "the host-side driver call, command buffer construction, and the queuing/dispatch handshake " +
      "with the GPU, typically on the order of a handful of microseconds even in the best case " +
      "(more with a synchronizing launch or an underpopulated queue). When a kernel's actual " +
      "compute is tiny (10 elements is nowhere near enough work to fill even one SM), that fixed " +
      "overhead dwarfs the useful work done per launch, so issuing 10,000 such launches accumulates " +
      "tens of milliseconds of pure overhead with almost no compute to show for it. A single fused " +
      "launch processing all 100,000 elements (e.g., via a grid-stride loop, or simply launching " +
      "enough threads to cover the whole problem) pays that fixed cost once and lets the GPU spend " +
      "essentially all of its time on genuine compute. That fixed cost is the motivation behind " +
      "kernel fusion (combining multiple small kernels into one) and CUDA Graphs (which let you " +
      "record a sequence of launches once and replay the whole graph with a single, much cheaper " +
      "submission), " +
      "both standard techniques for workloads common in ML inference and iterative solvers that are " +
      "dominated by many small, dependent kernel launches.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cuda-graphs.html",
      "https://developer.nvidia.com/blog/cuda-graphs/",
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#execution-configuration-optimizations",
    ],
  },
  {
    id: "gpu-cuda-grid-stride-loop-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "A grid-stride loop launched with far fewer threads than elements",
    tags: ["grid-stride-loop", "scalability", "portability"],
    type: "trace",
    prompt:
      "This kernel is launched with only 1024 total threads (`gridStride<<<4, 256>>>`) to process " +
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
        "It touches only the first 1024 elements: a thread can write only the index it derives from blockIdx and threadIdx, and the loop simply recomputes that same index",
        "It covers all 10,000,000 elements but races: the strided ranges of different threads overlap, so a subset of outputs is written by two threads at once",
        "It covers all 10,000,000 elements, but only the final 1024 results survive, since each thread's later iterations overwrite the output slots its earlier ones wrote",
        "It correctly processes all 10,000,000 elements: each thread walks idx, idx+stride, idx+2*stride, ..., so launch shape and problem size decouple",
      ],
      correctIndex: 3,
    },
    explanation:
      "The grid-stride loop pattern has each thread process every `stride`-th element starting " +
      "from its own global index, where stride equals the total number of threads actually " +
      "launched (gridDim.x * blockDim.x), so thread 0 handles elements 0, 1024, 2048, ...; thread " +
      "1 handles 1, 1025, 2049, ...; and so on, fully covering all n elements regardless of how n " +
      "relates to the launched thread count. This is preferable to sizing the launch to exactly n " +
      "threads (`ceil(n / blockDim.x)` blocks) for several reasons: it lets the launch configuration " +
      "be tuned to what the specific GPU can efficiently run concurrently (e.g., enough blocks to " +
      "fill every SM at good occupancy) independent of problem size, it amortizes each thread's " +
      "setup/register-allocation cost over multiple elements rather than creating and tearing down " +
      "millions of mostly-idle threads for a huge N, and it trivially handles the case where N " +
      "exceeds the hardware's maximum grid dimensions. It's a standard, portable idiom recommended " +
      "in NVIDIA's own performance guidance for exactly this reason: the same kernel code scales " +
      "correctly whether N is 100 or 10 billion.",
    references: [
      "https://developer.nvidia.com/blog/cuda-pro-tip-write-flexible-kernels-grid-stride-loops/",
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#thread-and-block-heuristics",
    ],
  },
  {
    id: "gpu-cuda-reduction-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "An interleaved-addressing reduction keyed on threadIdx.x % (2*s)",
    tags: ["reduction", "shared-memory", "warp-divergence", "bank-conflicts"],
    type: "trace",
    prompt:
      "This is the classic 'naive' shared-memory reduction taught in early CUDA tutorials. " +
      "blockDim.x == 256, and `s` is a runtime loop variable. What are its two distinct " +
      "performance problems, beyond just being 'not optimal'?",
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
        "Two compounding costs: the `threadIdx.x % (2*s) == 0` predicate scatters the active lanes through every warp, and the modulo lowers to a multi-instruction integer sequence all 256 threads run each pass",
        "One cost only: whole warps go idle as `s` grows, but the warps that remain active run fully packed, and the modulo folds into a single bitwise AND on a power-of-two divisor",
        "Two compounding costs: the active lanes are scattered through every warp, and `sdata[threadIdx.x] += sdata[threadIdx.x + s]` puts all of a warp's active lanes on one shared-memory bank at every stage",
        "Neither the predicate nor the addressing is the problem: the real cost is the log2(blockDim.x) rounds of __syncthreads(), which no tree-shaped reduction can avoid",
      ],
      correctIndex: 0,
    },
    explanation:
      "This 'interleaved addressing' reduction (Mark Harris's Reduction #1 in NVIDIA's " +
      "'Optimizing Parallel Reduction in CUDA') has two independent costs. First, " +
      "`threadIdx.x % (2*s) == 0` selects active lanes that are spread through every warp (at s=1 " +
      "every even lane, at s=2 every fourth lane, and so on), so through the early stages every " +
      "warp issues the loop body with most of its lanes predicated away and gets nothing back for " +
      "the issue slot; by the late stages the warps that still have work are down to a single " +
      "active lane apiece. Second, that modulo is genuinely expensive on this " +
      "hardware. `s` is a runtime value, so the compiler cannot rewrite `x % (2*s)` as `x & (2*s - " +
      "1)`; integer division and remainder are emulated on NVIDIA GPUs and cost roughly twenty " +
      "instructions, paid by every thread on every one of the eight passes. What this version does " +
      "NOT have is a bank conflict: the active lanes of a warp sit at indices that are multiples of " +
      "2*s, so they map to distinct banks (bank = index mod 32) and the access stays " +
      "conflict-free. Bank conflicts appear in the next revision of this kernel, the one that " +
      "replaces the modulo with `int index = 2 * s * threadIdx.x;` to make the active lanes " +
      "contiguous: that fixes divergence but marches consecutive lanes through shared memory with " +
      "stride 2*s, which collides gcd(32, 2*s) ways. Sequential addressing (see the companion " +
      "reduction question) is what finally clears both.",
    references: [
      "https://developer.download.nvidia.com/assets/cuda/files/reduction.pdf",
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#division-and-modulo-operations",
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#branching-and-divergence",
    ],
  },
  {
    id: "gpu-cuda-reduction-02",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "A shared-memory reduction predicated on threadIdx.x < s",
    tags: ["reduction", "shared-memory", "warp-divergence"],
    type: "trace",
    prompt:
      "This is the standard fix for the naive interleaved-addressing reduction above, same total " +
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
        "It isn't actually faster: it performs the same additions and the same number of __syncthreads() rounds as the modulo version, and both leave the same lanes idle",
        "`threadIdx.x < s` keeps the active lanes a contiguous prefix from lane 0, so at most one warp is ever split between active and idle lanes",
        "It is faster only in the loop control: `s >>= 1` replaces a multiply, saving one integer instruction per lane per stage while the memory behavior is unchanged",
        "It is faster because the idle lanes now fall in separate warps, letting the scheduler retire those warps early and hand their register and issue slots to other blocks",
      ],
      correctIndex: 1,
    },
    explanation:
      "Sequential addressing replaces the scattered `threadIdx.x % (2*s) == 0` condition with " +
      "`threadIdx.x < s`, which selects a contiguous prefix of thread indices at every stage of the " +
      "reduction. Because that active set always starts at lane 0 and is contiguous, it aligns " +
      "cleanly with warp boundaries: for s >= 32, whole warps are either entirely active or " +
      "entirely inactive (no per-lane masking within a warp), and once s drops below 32 only a " +
      "single warp does any real work while the rest trivially fall through the (false) condition. " +
      "Only that one boundary warp ever holds a mix of active and predicated-off lanes, where the " +
      "modulo version split every warp at every stage. It also drops the per-thread modulo, which " +
      "is emulated in software on NVIDIA hardware, in favor of a single comparison. What does not " +
      "improve is the barrier count: the idle warps are not retired early, since a block's warps " +
      "stay resident until the whole block exits and every warp must still reach each " +
      "`__syncthreads()`. Bank behavior is fine in both versions here, with lanes 0..s-1 reading " +
      "consecutive words; the canonical further optimizations (unrolling the last warp to skip " +
      "__syncthreads() once only " +
      "one warp remains active, and replacing the final stages with warp-shuffle instructions " +
      "entirely) go further still. This progression, naive interleaved to sequential addressing to " +
      "warp-shuffle-based, is the standard worked example (from Mark Harris's well-known " +
      "'Optimizing Parallel Reduction in CUDA' NVIDIA talk) of iteratively removing divergence and " +
      "synchronization overhead from a canonical parallel primitive.",
    references: [
      "https://developer.download.nvidia.com/assets/cuda/files/reduction.pdf",
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#branching-and-divergence",
      "https://developer.nvidia.com/blog/faster-parallel-reductions-kepler/",
    ],
  },
  {
    id: "gpu-cuda-pinned-memory-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "cudaMemcpy from pageable host memory versus cudaMallocHost memory",
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
        "No difference for a synchronous cudaMemcpy: the driver page-locks the source range for the duration of the copy either way, so both hit the same DMA path",
        "Version A is faster: pageable pages sit in the OS page cache and benefit from read-ahead and prefetching, which page-locking an allocation turns off",
        "Version B is typically faster: the DMA engine reads page-locked memory directly, while a pageable source is staged through a driver buffer. The cost: pinned pages never swap out",
        "Version B is faster only for cudaMemcpyAsync: a synchronous copy from pageable memory already reaches full bandwidth, and the real risk of pinning is fragmenting device memory",
      ],
      correctIndex: 2,
    },
    explanation:
      "A DMA engine transfers data by physical address and needs the source/destination region to " +
      "stay put for the transfer's duration. Pageable memory (ordinary malloc/new) can be moved or " +
      "swapped by the OS's virtual memory subsystem at any time, so cudaMemcpy from pageable memory " +
      "cannot hand it directly to the DMA engine. The CUDA driver instead copies it first into an " +
      "internal pinned staging buffer, then DMAs from there, effectively doubling the host-side " +
      "memory traffic for that transfer. cudaMallocHost (or cudaHostRegister on existing memory) " +
      "page-locks the allocation, guaranteeing a fixed physical address, so the DMA engine can " +
      "transfer it directly, typically yielding meaningfully higher achieved bandwidth, and it's " +
      "also a hard requirement for genuinely asynchronous cudaMemcpyAsync calls to overlap with " +
      "kernel execution or other transfers (an async copy from pageable memory silently falls back " +
      "to synchronous behavior). The tradeoff is that pinned pages cannot be paged out by the OS, " +
      "so over-allocating pinned memory shrinks the pool available for other processes' virtual " +
      "memory management and can cause system-wide memory pressure or degraded multitasking. " +
      "Pinned memory should be reserved for actual transfer staging buffers, not used as a " +
      "general-purpose host allocator.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#pinned-memory",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/understanding-memory.html#page-locked-host-memory",
      "https://developer.nvidia.com/blog/how-optimize-data-transfers-cuda-cc/",
    ],
  },
  {
    id: "gpu-cuda-streams-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "Copy-and-kernel pairs issued on one stream versus two",
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
        "Both sequences behave the same: the driver inspects the arguments, sees that d_b's copy is independent of kernelA, and overlaps them whichever stream they were issued on",
        "Sequence B is slower: operations in different streams have to be reconciled against each other at the next synchronization point, and that costs more than the overlap wins back",
        "Neither can overlap a copy with a kernel: the copy engine drives its transfers through the SMs, so a running kernel and an in-flight transfer are mutually exclusive on one device",
        "Sequence A runs all four in issue order, since one stream is an ordered queue; in Sequence B kernelA can hold the SMs while stream2's copy runs on the copy engine",
      ],
      correctIndex: 3,
    },
    explanation:
      "A CUDA stream is an ordered queue: operations issued into the same stream are guaranteed to " +
      "execute in the order they were issued, with each waiting for the previous one to complete " +
      "(this is what 'stream' ordering means), so Sequence A cannot overlap any " +
      "of its four operations even though, e.g., copying d_b in principle has nothing to do with " +
      "kernelA. Operations issued into different streams have no such ordering constraint relative " +
      "to each other, so the hardware scheduler is free to run them concurrently if the underlying " +
      "engines are available. Modern GPUs expose separate copy engines (often one for H2D and one " +
      "for D2H) and compute (SM) resources, so a memory transfer on stream2 genuinely can proceed on " +
      "the copy engine at the same time kernelA runs on the SMs from stream1's queue. This requires " +
      "pinned host memory (async copies from pageable memory silently serialize, as in the pinned " +
      "memory question above) and enough independent work to actually fill both engines. This " +
      "stream-based overlap of transfer and compute, pipelining a large problem into chunks each on " +
      "its own stream so chunk k's compute overlaps chunk k+1's transfer, is the standard technique " +
      "for hiding PCIe transfer latency behind useful GPU work.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/asynchronous-execution.html#cuda-streams",
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#asynchronous-transfers-and-overlapping-transfers-with-computation",
      "https://developer.nvidia.com/blog/how-overlap-data-transfers-cuda-cc/",
    ],
  },
  {
    id: "gpu-cuda-simt-vs-simd-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "The SIMT execution model compared with classic SIMD",
    tags: ["simt", "simd", "execution-model"],
    type: "trace",
    prompt:
      "A colleague argues that a CUDA warp is 'just SIMD with extra steps' since all 32 threads " +
      "execute the same instruction at the same time on real hardware. What is the most accurate " +
      "characterization of the actual distinction NVIDIA draws between SIMT and SIMD?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "SIMT gives each thread its own logical program counter, registers, and stack, so it may branch on its own data with divergence handled in hardware; SIMD needs hand-written masks and blends",
        "There is no real distinction: SIMT is a marketing name for masked vector execution, since a divergent warp ends up running both sides of the branch under masks anyway",
        "It is the reverse of how it is usually told: SIMD hardware tracks a predicate per lane natively, while a warp must take one path and the programmer has to sort data so the lanes agree",
        "The distinction is width and register file layout: a warp is a 32-wide vector unit against a CPU's 4- to 16-wide one, and everything else about the two execution models lines up",
      ],
      correctIndex: 0,
    },
    explanation:
      "The programming-model distinction is real, even though the underlying execution on a warp " +
      "is, at the hardware level, close to SIMD-like lockstep issue. In SIMT (Single Instruction, " +
      "Multiple Threads), the programmer writes ordinary scalar-looking code per thread: each " +
      "thread has its own logical program counter, registers, and local/call-stack state, and is " +
      "free to branch based on its own thread-specific data (as in every kernel in this set with an " +
      "`if (threadIdx.x ...)`). The hardware is responsible for detecting when threads within a warp " +
      "diverge and handling it via predicated execution and a reconvergence mechanism (historically " +
      "a hardware reconvergence stack; since Volta, more flexible per-thread program counters under " +
      "independent thread scheduling), entirely transparent to the source code. In classic SIMD " +
      "(e.g., x86 SSE/AVX, ARM NEON), there is exactly one instruction stream applied uniformly to " +
      "all lanes of a vector register, and the vector ISA has no native concept of 'this lane " +
      "branches differently'. Any lane-conditional behavior has to be hand-encoded by the " +
      "programmer or compiler as explicit compare/mask/blend/select instructions operating on the " +
      "whole vector. SIMT's key innovation is moving that masking/divergence-handling burden from " +
      "the programmer into the hardware/compiler, at the cost of the performance penalty divergent " +
      "warps pay when threads do disagree.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html#simt-execution-model",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/programming-model.html#warps-and-simt",
    ],
  },
  {
    id: "gpu-cuda-shared-mem-race-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "A cross-warp flag-and-payload spin-wait in shared memory",
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
        "Safe: warps of a block are issued in ascending warp-index order, so warp 0's stores have all landed before warp 1 executes its first instruction",
        "A genuine race: nothing orders warps within a block, and even once thread 32 sees flag == 1, the write to payload need not be visible to it",
        "It deadlocks on every architecture: thread 32's spin holds the SM's issue slots for warp 1, and warp 0 can never be scheduled to write the flag",
        "Safe within a block: shared-memory writes are sequentially consistent to every thread of the block, and only cross-block visibility needs __threadfence()",
      ],
      correctIndex: 1,
    },
    explanation:
      "CUDA's execution model explicitly does not guarantee any relative ordering or interleaving " +
      "between different warps of the same block. The SM's warp scheduler is free to run resident " +
      "warps in whatever order and interleaving it chooses (including time-slicing them at " +
      "instruction granularity), and there is no notion of warp 0 having scheduling priority over " +
      "warp 1 merely because of its lower index. A hand-rolled 'flag' spin-wait pattern like this " +
      "has two separate problems: first, thread 32 might begin executing (and even finish spinning, " +
      "since flag could still hold stale shared-memory contents that happen to already look nonzero) " +
      "before thread 0 has written anything at all; second, even once thread 0's write to `flag` " +
      "is observed, nothing in this code enforces that the earlier write to `payload` is visible " +
      "to thread 32 by that point. The compiler and hardware are free to reorder or delay the " +
      "`payload` write relative to the `flag` write absent an explicit fence like " +
      "`__threadfence_block()` between them. There is a third hazard on the reader's side: `flag` " +
      "is a plain `__shared__ int`, so the compiler is entitled to load it once and keep it in a " +
      "register, turning the spin into an infinite loop that never reloads the variable at all. " +
      "The correct, supported way to synchronize *all* " +
      "threads in a block is `__syncthreads()`; genuinely producer/consumer patterns across warps " +
      "that can't use a full block barrier need explicit fences (`__threadfence_block()`) combined " +
      "with atomics on the flag, not a plain spin on a plain shared variable.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cpp-language-extensions.html#memory-fence-functions",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cuda-cpp-memory-model.html#data-races",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html#hardware-multithreading",
    ],
  },
  {
    id: "gpu-cuda-pcie-bottleneck-01",
    category: "gpu-cuda",
    difficulty: "easy",
    title: "Two 1 KB host-device transfers around a 256-element add kernel",
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
        "The kernel's compute dominates: 256 floating-point additions plus the write of the result array back to device memory outweigh a host-device transfer this small",
        "The two cudaMemcpy calls dominate: each pays a fixed latency floor of a few microseconds whatever its size, so an iterative version should keep data device-resident",
        "Launch overhead dominates and the transfers are free: a payload this small rides along in the launch's command buffer rather than being DMA'd separately",
        "Nothing dominates: at roughly 16 GB/s, PCIe moves 1 KB in well under a microsecond, so the total sits close to the kernel's own few hundred nanoseconds",
      ],
      correctIndex: 1,
    },
    explanation:
      "PCIe (or NVLink) host-device transfers, like kernel launches, have a largely fixed " +
      "per-transfer latency floor made up of driver overhead, transfer setup, and the " +
      "interconnect's round trip, and that floor dominates for small payloads; anything close to " +
      "PCIe's rated peak " +
      "bandwidth requires transfers on the order of many megabytes, not kilobytes. A 1 KB transfer " +
      "spends nearly all of its time paying that fixed overhead rather than actually being " +
      "bandwidth-limited, and with the kernel itself doing only a few hundred nanoseconds of real " +
      "compute, the two cudaMemcpy calls (H2D and D2H) can easily account for well over 99% of the " +
      "operation's wall-clock time. This is a common trap in naive GPU-acceleration attempts: " +
      "porting a small, frequently-called computation to the GPU can make it *slower* overall " +
      "purely due to transfer overhead, even though the GPU computes the kernel itself far faster " +
      "than a CPU would. The standard fix for an iterative algorithm is to keep the working data " +
      "resident in device memory across iterations: allocate once, launch each iteration's kernel " +
      "back-to-back operating on the already-resident device buffers, and copy results back to the " +
      "host only when actually needed (e.g., once at the end, or periodically for logging), turning " +
      "many small fixed-overhead transfers into at most a couple of large ones.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#data-transfer-between-host-and-device",
      "https://developer.nvidia.com/blog/how-optimize-data-transfers-cuda-cc/",
    ],
  },
  {
    id: "gpu-cuda-register-spill-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "An unrolled kernel with 256 simultaneously live per-thread values",
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
    float acc[256];   // 256 simultaneously-live locals, heavily used throughout
    #pragma unroll
    for (int i = 0; i < 256; ++i) acc[i] = in[threadIdx.x * 256 + i];
    // ... extensive per-element compute reusing all 256 values repeatedly ...
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "ptxas refuses the kernel: exceeding the per-thread register budget under an explicit __launch_bounds__ is a compile-time error rather than something the compiler works around",
        "The overflow is placed in shared memory, carved silently out of the block's shared-memory allocation, which runs at close to register speed but eats into occupancy",
        "The values all stay in registers and the cost is purely occupancy: the SM simply drops to one resident warp so that one thread can own the whole register file",
        "The excess values spill to local memory, which despite the name is per-thread off-chip DRAM cached through L1/L2, so a spilled access costs closer to a global load than a register read",
      ],
      correctIndex: 3,
    },
    explanation:
      "'Local memory' is one of the more misleading terms in the CUDA memory model: it sounds like " +
      "it should be fast, on-chip, thread-private storage, but architecturally it is simply a " +
      "private, per-thread-indexed region of the same off-chip DRAM backing global memory. It goes " +
      "through the same L1/L2 cache hierarchy as global memory accesses, and a cache miss on a " +
      "spilled local variable pays essentially the same few-hundred-cycle latency as a global memory " +
      "miss. When the compiler's register allocator cannot fit all of a kernel's live values into " +
      "the per-thread register budget (bounded by the architectural max, or a tighter cap imposed by " +
      "`__launch_bounds__`/`--maxrregcount` to preserve occupancy), it spills the excess values to " +
      "local memory, inserting the necessary loads/stores transparently. The source code doesn't " +
      "change, but the generated SASS now contains many more (and much higher latency) memory " +
      "operations than a variable that stayed in a register would need. A kernel that keeps too much " +
      "simultaneously live (like the 256 heavily-reused accumulators here) is a classic way to trigger " +
      "this: it can end up slower than a version with less unrolling or fewer live values, precisely " +
      "because 'more work per instruction' is undone by every one of those values effectively " +
      "becoming a global-memory-latency access. A per-thread array like `acc` has a second way to " +
      "land in local memory regardless of size: if it is ever indexed by a value the compiler " +
      "cannot resolve at compile time, it cannot live in registers at all, since registers are not " +
      "addressable. `nvcc --ptxas-options=-v` reports spill loads/stores " +
      "per kernel, and Nsight Compute flags high local memory traffic, both standard ways to catch " +
      "this in practice.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#local-memory",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#local-memory",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cpp-language-extensions.html#launch-bounds",
    ],
  },
  {
    id: "gpu-cuda-multi-gpu-nccl-01",
    category: "gpu-cuda",
    difficulty: "medium",
    title: "cudaMemcpyPeerAsync versus staging through a pinned host buffer",
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
        "No difference: the same bytes cross the same physical links either way, and cudaMemcpyPeerAsync is a convenience wrapper the driver expands into the two host-staged copies",
        "Version B is usually faster: host DRAM bandwidth exceeds that of any GPU-to-GPU link, and the staging buffer lets the two hops pipeline against each other",
        "Version A is typically much faster: with peer access, especially over NVLink, the payload crosses once directly between the two devices' memories, where Version B moves it twice",
        "Peer access buys latency, not bandwidth: both paths are still limited by the same PCIe link, so NCCL reaches for it only when messages are small enough to be latency-bound",
      ],
      correctIndex: 2,
    },
    explanation:
      "When peer-to-peer access is enabled between two GPUs on the same node (and supported by the " +
      "topology, e.g. same PCIe switch/root complex, or connected via NVLink), the GPUs' memory " +
      "controllers can address each other's device memory directly, so `cudaMemcpyPeerAsync` (or a " +
      "plain `cudaMemcpy` with peer access enabled) can move data GPU-to-GPU in a single transfer, " +
      "at the bandwidth of whichever interconnect actually carries it. NVLink offers considerably " +
      "higher bandwidth than PCIe, which is the main reason multi-GPU training and inference on " +
      "NVLink-connected systems (as opposed to plain PCIe-only ones) scale so much better across " +
      "GPUs. Without peer access, the driver has no choice but to stage the transfer through host " +
      "memory: a device-to-host copy off GPU 0 followed by a separate host-to-device copy onto GPU " +
      "1, which moves the same logical payload twice across the host's PCIe links and adds the " +
      "latency and bandwidth cost of both hops plus the staging buffer overhead, roughly doubling " +
      "the effective transfer cost for the same data. NCCL (NVIDIA's collective " +
      "communication library, used for multi-GPU all-reduce, broadcast, etc. in distributed " +
      "training) actively probes and prefers direct peer/NVLink paths over host-staged transfers, " +
      "falling back to host-mediated copies only when direct peer access genuinely isn't available " +
      "(e.g., GPUs on different, unconnected PCIe root complexes, or across nodes where network " +
      "transport like InfiniBand with GPUDirect RDMA becomes the relevant direct-path analogue).",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/multi-gpu-systems.html#peer-to-peer-memory-transfers",
      "https://docs.nvidia.com/cuda/cuda-runtime-api/group__CUDART__PEER.html",
      "https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/index.html",
    ],
  },
  {
    id: "gpu-cuda-independent-thread-scheduling-01",
    category: "gpu-cuda",
    difficulty: "hard",
    title: "An intra-warp shared-memory handoff across a divergent branch",
    tags: ["independent-thread-scheduling", "warp-sync", "syncwarp", "volta"],
    type: "trace",
    prompt:
      "This kernel relies on the old 'warp-synchronous programming' assumption, common in " +
      "pre-Volta CUDA code, that all 32 threads of a warp are always implicitly lockstep, so no " +
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
        // old assumption: no __syncwarp() needed, "the warp is always in lockstep"
    } else {
        int v = buf[lane - 16];   // read what the "other half" of the warp wrote
        use(v);
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Correct on every architecture: a warp executes in strict lockstep by definition, so the if-branch's write to buf always lands before the else-branch's read of it",
        "Unreliable on Volta and later: independent thread scheduling can interleave a warp's divergent paths, so the read is no longer ordered after the write without a __syncwarp()",
        "Rejected at compile time on Volta and later: nvcc diagnoses a divergent shared-memory dependency inside a warp and demands an explicit lane mask argument on the read",
        "Correct on Volta and later, though not before: giving each thread its own program counter is what makes one lane's shared-memory write visible to another without a barrier",
      ],
      correctIndex: 1,
    },
    explanation:
      "Pre-Volta GPUs implemented warp divergence using a single shared program counter plus a " +
      "hardware reconvergence stack: on a divergent branch, the warp executed one path to " +
      "completion (or to the next divergence point), then the other, then reconverged. This was a " +
      "rigid but predictable enough pattern that some real-world code came to informally rely on " +
      "one branch's side effects (like a shared-memory write) being fully visible before the other " +
      "branch ran, without ever calling an explicit intra-warp synchronization primitive. This was " +
      "always technically an unsupported assumption ('implicit warp-synchronous programming', which " +
      "NVIDIA's own documentation warned against), but it often happened to work. Starting with " +
      "Volta, the architecture introduced independent thread scheduling: each thread gets its own " +
      "program counter and call stack, and the hardware is explicitly free to interleave execution " +
      "of a warp's divergent paths at much finer granularity (even instruction-by-instruction) " +
      "rather than one-path-then-the-other, in order to enable new capabilities like fine-grained " +
      "producer-consumer patterns and mutual-exclusion primitives within a warp. That means code " +
      "which never used an explicit barrier can now genuinely observe the else-branch executing " +
      "before, during, or interleaved with the if-branch's write, producing stale or garbage reads " +
      "of `buf` that would not have occurred on older hardware. The fix is to restructure so that " +
      "all 32 lanes reach one common `__syncwarp()` between the write and the read: do the write in " +
      "the if-branch, call `__syncwarp()` outside the branch where every lane arrives at it, then " +
      "read. A `__syncwarp()` placed inside one side of the branch only synchronizes the lanes on " +
      "that path, which is no help here. NVIDIA added `__syncwarp()` and the `_sync` suffix (`__shfl_sync`, " +
      "`__ballot_sync`, etc.) to the warp-level primitive family starting with Volta's CUDA 9 " +
      "toolkit, making the required synchronization explicit rather than an unstated hardware " +
      "coincidence.",
    references: [
      "https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html#independent-thread-scheduling",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cpp-language-extensions.html#warp-synchronization-function",
      "https://developer.nvidia.com/blog/using-cuda-warp-level-primitives/",
    ],
  },
];
