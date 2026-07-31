import type { TraceQuestion } from "@/types/question";

export const osQuestions: TraceQuestion[] = [
  {
    id: "os-fork-count-01",
    category: "os",
    difficulty: "easy",
    title: "Counting fork() output",
    tags: ["processes", "fork"],
    type: "trace",
    prompt: 'How many times does "hello" get printed?',
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <unistd.h>
#include <cstdio>

int main() {
    fork();
    fork();
    printf("hello\\n");
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: ["1", "2", "4", "8"],
      correctIndex: 2,
    },
    explanation:
      "The first `fork()` turns 1 process into 2. Each of those independently executes the " +
      "second `fork()`, turning 2 into 4. All 4 processes then reach the `printf` and each " +
      "prints once, for 4 lines total. The ordering and interleaving of those lines is " +
      "unspecified (it depends entirely on how the scheduler runs the four processes), but " +
      "the count is fixed. The general rule: n unconditional forks in sequence produce 2^n " +
      "processes, because every fork doubles the population reaching the next one.",
  },
  {
    id: "os-page-fault-02",
    category: "os",
    difficulty: "medium",
    title: "Touching a freshly mmap'd page",
    tags: ["virtual-memory", "paging"],
    type: "trace",
    prompt:
      "A process calls mmap() to reserve a region of virtual address space, then reads a " +
      "byte from a page in that region that it has never touched before. What happens?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "A minor page fault: the kernel maps a zero-filled physical frame and re-runs the faulting instruction",
        "A major page fault: the kernel must read the page's contents back from the swap device first",
        "No fault at all: mmap() populated page-table entries for the whole region when it was called",
        "SIGSEGV, since nothing ever wrote to that page to make it valid",
      ],
      correctIndex: 0,
    },
    explanation:
      "A valid-but-unbacked page (the normal state of a fresh mmap region) triggers a *minor " +
      "page fault* on first touch. The CPU traps into the kernel, the page-fault handler " +
      "finds a VMA covering the address, wires up a zero-filled physical frame, updates the " +
      "page table, and re-executes the faulting instruction. " +
      "The program never sees any of it. For a read fault specifically, Linux does not even " +
      "allocate a fresh frame: it points the PTE at the system-wide read-only zero page and " +
      "defers the real allocation until the first write. It is a minor fault rather than a major one " +
      "because no backing store is read: there is nothing on disk to fetch for an anonymous " +
      "page that has never been written. A segfault, by contrast, is what happens when the " +
      "faulting address has no VMA at all, so the handler has nothing it can legally map.",
  },
  {
    id: "os-exec-fd-03",
    category: "os",
    difficulty: "medium",
    title: "File descriptors across exec()",
    tags: ["exec", "file-descriptors", "process-image"],
    type: "trace",
    prompt:
      "main.cpp opens data.txt (suppose open() returns fd 3), then execl()s into " +
      "child_prog without closing it. child_prog immediately calls " +
      "read(3, buf, sizeof(buf)), using the hard-coded fd number 3. Does that read " +
      "succeed and return bytes from data.txt?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <unistd.h>
#include <fcntl.h>
#include <cstdio>

int main() {
    int fd = open("data.txt", O_RDONLY);   // suppose this returns fd 3
    execl("/usr/bin/child_prog", "child_prog", nullptr);
    perror("execl failed");
    return 1;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No: exec() closes every open file descriptor as part of replacing the process image",
        "Yes: fd 3 is still open in child_prog, at the same file offset and access mode",
        "Yes, but the descriptor comes back read-only in the new program regardless of how it was opened",
        "No: only the three standard descriptors survive exec(); anything the program opened itself is closed",
      ],
      correctIndex: 1,
    },
    explanation:
      "exec() replaces the calling process's text, data, heap, and stack (the 'process " +
      "image') with a new program and resets the instruction pointer to that program's entry " +
      "point. The file descriptor table is a separate kernel structure hanging off the " +
      "process, not part of the image being replaced, so POSIX exec semantics explicitly " +
      "preserve it: fd 3 stays open, at the same file offset and access mode, inside " +
      "child_prog. The only descriptors closed automatically at exec time are those marked " +
      "FD_CLOEXEC. Shell redirection is built entirely on this guarantee: fork(), dup2() the " +
      "target onto the well-known fd, then exec(), and the child program simply finds the " +
      "already-redirected descriptor waiting for it.",
    references: ["https://man7.org/linux/man-pages/man3/exec.3.html"],
  },
  {
    id: "os-fork-return-04",
    category: "os",
    difficulty: "easy",
    title: "fork() return values",
    tags: ["fork", "processes"],
    type: "trace",
    prompt: "What value of `pid` does each process print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <unistd.h>
#include <cstdio>

int main() {
    pid_t pid = fork();
    if (pid == 0) {
        printf("child: pid=%d\\n", pid);
    } else if (pid > 0) {
        printf("parent: pid=%d\\n", pid);
    } else {
        perror("fork");
    }
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both print the same value, the child's PID",
        "The child prints its own PID; the parent prints 0",
        "Both print 0, since `pid` lives in memory the two processes go on sharing after fork()",
        "The child prints 0; the parent prints the child's PID, a positive value",
      ],
      correctIndex: 3,
    },
    explanation:
      "fork() returns twice, once in each process, with deliberately different values so a " +
      "program can tell which one it is now running as. In the child, fork() returns 0; the " +
      "child can still recover its own PID with getpid() if it needs the real number. In the " +
      "parent, fork() returns the newly created child's PID, a positive integer. A negative " +
      "return is only ever seen by the caller (no child was created at all) and signals " +
      "failure, e.g. EAGAIN from RLIMIT_NPROC or ENOMEM. Each process has its own copy of " +
      "`pid` from the moment fork() returns: the two address spaces are logically independent " +
      "(implemented copy-on-write), so neither can observe the other's value.",
    references: ["https://man7.org/linux/man-pages/man2/fork.2.html"],
  },
  {
    id: "os-threads-shared-05",
    category: "os",
    difficulty: "easy",
    title: "What threads share that forked processes don't",
    tags: ["threads", "processes", "address-space"],
    type: "trace",
    prompt:
      "Within one process, you spawn a new thread with pthread_create(). Compare that to " +
      "calling fork() to create a child process. Which resource is genuinely shared (one " +
      "live copy) between two threads of the same process, but is NOT shared that way " +
      "between a forked parent and child?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Each thread's own stack and its saved register / program-counter state",
        "Nothing: threads and forked children alike get a private copy of everything but open files",
        "The virtual address space (heap, globals, static data) and the open file descriptor table",
        "The heap only; global and static data gets a private copy per thread",
      ],
      correctIndex: 2,
    },
    explanation:
      "Threads created within one process share the process's actual address space (code, " +
      "heap, globals) and its file descriptor table. There is only one mapping, so a write to " +
      "a global by one thread is immediately visible to all the others, and an fd opened by " +
      "one thread is usable by name in any other. What is private per thread is the execution " +
      "context: its own stack, its own saved registers and program counter, thread-local " +
      "storage, and its own signal mask. fork() inverts this. The child gets a logically " +
      "independent address space (implemented copy-on-write, so writes by one are invisible " +
      "to the other) and its own descriptor table, though the duplicated entries initially " +
      "point at the same underlying open file descriptions, which is why the file offset " +
      "stays linked between parent and child until one of them reopens or seeks " +
      "independently. Under the hood both are the same syscall: clone() with CLONE_VM | " +
      "CLONE_FILES set for a thread, and cleared for a fork.",
  },
  {
    id: "os-context-switch-06",
    category: "os",
    difficulty: "medium",
    title: "What triggers a context switch",
    tags: ["scheduling", "context-switch"],
    type: "trace",
    prompt:
      "A single-core system is running process A. Which of the following, by itself, is " +
      "NOT sufficient to make the scheduler context-switch away from A?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Process A allocates a large heap buffer with malloc()",
        "A hardware timer interrupt fires, ending A's scheduling quantum",
        "A now-higher-priority process B transitions from blocked to ready",
        "A calls a blocking system call (e.g. read() on an empty pipe) and gives up the CPU",
      ],
      correctIndex: 0,
    },
    explanation:
      "A context switch happens when the CPU stops running one thread and starts another, " +
      "saving and restoring register state and, for a switch between processes, swapping " +
      "page tables. Three things drive it: a timer interrupt ending a quantum (preemptive " +
      "time-slicing), an interrupt that makes a higher-priority process runnable so the " +
      "scheduler preempts the current one, or the running process voluntarily blocking on " +
      "I/O, a contended lock, or an explicit yield. malloc() is none of those. Most calls are " +
      "satisfied entirely from the allocator's existing free lists in userspace, and even a " +
      "call that has to extend the heap issues a brk() or mmap() that returns without " +
      "blocking. What makes involuntary switching expensive is the aftermath rather than the " +
      "switch itself: register save/restore is cheap, but flushing or re-tagging the TLB and " +
      "losing warm cache lines to the incoming process's working set is not.",
  },
  {
    id: "os-deadlock-07",
    category: "os",
    difficulty: "medium",
    title: "Two threads locking two mutexes in opposite order",
    tags: ["deadlock", "mutex", "concurrency"],
    type: "trace",
    prompt: "Does this program reliably deadlock, reliably complete, or is the outcome scheduling-dependent?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <mutex>
#include <thread>
#include <chrono>

std::mutex A, B;

void thread1() {
    std::lock_guard<std::mutex> lockA(A);
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
    std::lock_guard<std::mutex> lockB(B);
}

void thread2() {
    std::lock_guard<std::mutex> lockB(B);
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
    std::lock_guard<std::mutex> lockA(A);
}

int main() {
    std::thread t1(thread1), t2(thread2);
    t1.join();
    t2.join();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It always deadlocks; taking A then B in one thread and B then A in the other makes the circular wait deterministic",
        "It deadlocks only if both threads take their first lock before either reaches its second, which the 10ms sleep makes near-certain",
        "It always completes, because std::mutex detects the cycle and the second lock throws a system_error",
        "It always completes, because lock_guard acquires with try_lock and releases what it holds on failure",
      ],
      correctIndex: 1,
    },
    explanation:
      "This is the classic lock-ordering (circular-wait) deadlock: thread1 holds A and wants " +
      "B, thread2 holds B and wants A. All four Coffman conditions are present. Mutual " +
      "exclusion, since mutexes are exclusive. Hold-and-wait, since each thread keeps one " +
      "lock while blocking on the other. No preemption, since a std::mutex cannot be taken " +
      "away from its owner. And circular wait, from the opposing acquisition orders. What the " +
      "10ms sleep buys is not the deadlock itself but its reliability: it makes it " +
      "overwhelmingly likely that both threads reach their second acquisition only after both " +
      "first acquisitions have succeeded. Nothing in the standard schedules the threads that " +
      "way, so a run where thread1 completes entirely before thread2 starts would finish " +
      "cleanly; the program is a race whose losing interleaving happens to be nearly certain " +
      "here. The fix is a consistent global lock order, or std::scoped_lock / std::lock, " +
      "which acquire multiple mutexes with a deadlock-avoiding algorithm and never leave a " +
      "thread parked holding a partial set.",
  },
  {
    id: "os-signal-safety-08",
    category: "os",
    difficulty: "hard",
    title: "Calling malloc() from a signal handler",
    tags: ["signals", "async-signal-safety"],
    type: "trace",
    prompt:
      "The main loop is in the middle of its own malloc()/free() call when SIGINT arrives " +
      "and the handler below runs. What is the risk?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <csignal>
#include <cstdlib>
#include <cstdio>
#include <unistd.h>

void handler(int) {
    char* buf = (char*)malloc(64);
    write(1, buf, 14);
    free(buf);
}

int main() {
    signal(SIGINT, handler);
    for (;;) {
        void* p = malloc(32);
        free(p);
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "None: malloc() is thread-safe, and a signal handler is just another context calling it",
        "None: glibc's arena lock is recursive, so re-entering the allocator on the same thread is safe",
        "The handler can deadlock on the allocator's own lock, or corrupt half-updated heap metadata",
        "The process takes an immediate SIGSEGV the moment the handler is entered",
      ],
      correctIndex: 2,
    },
    explanation:
      "A signal handler runs asynchronously on the interrupted thread, at an arbitrary point " +
      "in whatever that thread was doing. Here that point can be the middle of malloc()'s own " +
      "free-list and arena bookkeeping, with the allocator's internal lock held. malloc() is " +
      "thread-safe against concurrent calls from *other* threads, which is a different " +
      "property from being safe against a re-entrant call on the *same* thread. With glibc's " +
      "non-recursive arena lock, the handler's malloc() blocks trying to take a lock the " +
      "thread already owns and the process wedges immediately; with a recursive or absent " +
      "lock it would instead walk chunk metadata that is mid-update and corrupt the heap. " +
      "POSIX handles this by specifying a short list of async-signal-safe functions (write(), " +
      "_exit(), sig_atomic_t access, and friends) that pointedly excludes malloc(), free(), " +
      "and printf(). The safe pattern is to do essentially nothing in the handler: set a " +
      "volatile sig_atomic_t flag, or write() a byte to a self-pipe, and let the main loop do " +
      "the real work.",
    references: [
      "https://man7.org/linux/man-pages/man7/signal-safety.7.html",
    ],
  },
  {
    id: "os-eintr-09",
    category: "os",
    difficulty: "medium",
    title: "A signal arriving during a blocking read()",
    tags: ["signals", "eintr", "syscalls"],
    type: "trace",
    prompt:
      "The process is blocked inside read(), waiting on stdin with no data available yet. " +
      "A signal arrives for which a handler was installed via sigaction() without " +
      "SA_RESTART. The handler runs and returns. What does the interrupted read() call do?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <unistd.h>
#include <cerrno>
#include <cstdio>

int main() {
    char buf[64];
    ssize_t n = read(0, buf, sizeof(buf));
    if (n < 0) {
        printf("read failed, errno=%d\\n", errno);
    } else {
        printf("read %zd bytes\\n", n);
    }
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It returns -1 with errno set to EINTR, having read nothing; retrying is the caller's job",
        "It resumes waiting transparently and returns normally once data arrives, as if nothing happened",
        "It returns 0, indistinguishable from stdin reaching end of file",
        "It returns the bytes copied so far (possibly 0) with errno untouched, as an ordinary short read",
      ],
      correctIndex: 0,
    },
    explanation:
      "When a blocking ('slow') system call such as read(), write(), or accept() is " +
      "interrupted by a caught signal before transferring any data, POSIX specifies that the " +
      "call is abandoned and returns -1 with errno == EINTR once the handler returns. It does " +
      "not resume on its own. Robust code therefore either wraps such calls in a " +
      "retry-on-EINTR loop or registers the handler with sigaction()'s SA_RESTART flag, which " +
      "asks the kernel to re-issue the interrupted syscall transparently. Without either, " +
      "this program prints 'read failed, errno=4' the instant the signal is handled, even " +
      "though nothing was ever read from stdin. SA_RESTART is not a complete answer either: " +
      "several calls (including poll(), select(), and any call with a timeout) are specified " +
      "to return EINTR regardless of the flag, which is why EINTR loops remain standard " +
      "defensive practice. Note also the short-read case: if some bytes had already been " +
      "transferred before the signal arrived, read() returns that partial count successfully " +
      "instead of failing.",
    references: [
      "https://man7.org/linux/man-pages/man7/signal.7.html",
      "https://man7.org/linux/man-pages/man2/read.2.html",
    ],
  },
  {
    id: "os-mmap-shared-10",
    category: "os",
    difficulty: "medium",
    title: "mmap MAP_SHARED across fork()",
    tags: ["mmap", "shared-memory", "fork"],
    type: "trace",
    prompt: "What does the parent print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <sys/mman.h>
#include <sys/wait.h>
#include <unistd.h>
#include <cstdio>

int main() {
    int* counter = (int*)mmap(nullptr, sizeof(int), PROT_READ | PROT_WRITE,
                               MAP_SHARED | MAP_ANONYMOUS, -1, 0);
    *counter = 0;

    if (fork() == 0) {
        *counter = 42;
        _exit(0);
    }
    wait(nullptr);
    printf("counter = %d\\n", *counter);
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "counter = 0",
        "Either 0 or 42, depending on how the two processes interleave",
        "Undefined behavior",
        "counter = 42",
      ],
      correctIndex: 3,
    },
    explanation:
      "A MAP_SHARED mapping is backed by a shareable object (here, anonymous shared memory) " +
      "that more than one mapping can reference at once. fork() gives the child that same " +
      "mapping, so both processes' page tables end up pointing at one identical physical " +
      "page, and a write through either is visible through the other with no copy-on-write " +
      "step in between. That is precisely what separates MAP_SHARED from MAP_PRIVATE: with " +
      "MAP_PRIVATE the child's store would fault in a private copy and the parent would still " +
      "read 0. The result is also deterministic rather than racy, because wait() cannot " +
      "return until the child has fully terminated, which orders the child's store before the " +
      "parent's load. This pattern, an anonymous MAP_SHARED region created before fork(), is " +
      "the standard lightweight way to get shared memory between related processes without a " +
      "named shm_open() or shmget() segment.",
    references: ["https://man7.org/linux/man-pages/man2/mmap.2.html"],
  },
  {
    id: "os-cow-fork-11",
    category: "os",
    difficulty: "hard",
    title: "When copy-on-write actually copies",
    tags: ["copy-on-write", "fork", "paging"],
    type: "trace",
    prompt:
      "At the instant fork() returns, how much of the ~4MB `big` vector's backing memory " +
      "has actually been physically duplicated? And what does the parent print afterward?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <unistd.h>
#include <sys/wait.h>
#include <cstdio>
#include <vector>

int main() {
    std::vector<int> big(1000000, 7); // ~4MB, already resident

    pid_t pid = fork();
    if (pid == 0) {
        big[0] = 99; // child modifies one element
        _exit(0);
    }
    wait(nullptr);
    printf("%d\\n", big[0]);
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "All ~4MB is duplicated inside the fork() call itself; the parent prints 7",
        "None at fork() time; only the 4KB page holding big[0] is copied, when the child writes; the parent prints 7",
        "None at fork() time; the child's first write copies the whole ~4MB region at once; the parent prints 7",
        "Nothing is ever duplicated, so the child's store lands in the parent's memory; the parent prints 99",
      ],
      correctIndex: 1,
    },
    explanation:
      "fork() duplicates the parent's page tables, marking every private writable page " +
      "read-only in both processes, but it does not duplicate the physical frames those " +
      "entries point at. Immediately after fork() the two page tables reference the exact " +
      "same RAM. When either process stores to such a page, the MMU raises a protection fault " +
      "(the PTE says read-only even though the VMA is read-write), and the kernel's " +
      "copy-on-write handler resolves it by allocating one fresh frame, copying that single " +
      "faulting page into it, repointing the faulting process's PTE at the new writable " +
      "frame, and restarting the instruction. Granularity is the page, not the allocation: " +
      "only the 4KB containing big[0] is ever physically copied, and the rest of the ~4MB " +
      "stays shared until something writes to it. The child's store therefore lands on its " +
      "own private copy, leaving the parent's page untouched, so the parent still reads 7. " +
      "This per-page laziness is also why fork() of a huge process is cheap, and why the " +
      "cost shows up later as a scatter of COW faults rather than as one big pause.",
  },
  {
    id: "os-tlb-flush-12",
    category: "os",
    difficulty: "medium",
    title: "TLB behavior across a context switch",
    tags: ["tlb", "context-switch", "virtual-memory"],
    type: "trace",
    prompt:
      "The scheduler context-switches from process A to process B, which live in different " +
      "address spaces. Assume this CPU has no ASID/PCID-style tagging support. Immediately " +
      "after B resumes and touches a few pages it accessed recently, what happens?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "A's cached entries stay valid and get reused for B, since both processes use numerically identical virtual addresses",
        "Entries carry a tag identifying their address space, so B's translations from its previous slice are still live and warm",
        "The TLB is flushed at the switch, so B's first touch of each page misses and gets re-walked from B's page tables",
        "TLB entries are indexed by physical frame, so they stay valid no matter which process is currently running",
      ],
      correctIndex: 2,
    },
    explanation:
      "The TLB caches virtual-to-physical translations, and a virtual address only means " +
      "anything relative to one particular page table. Two processes routinely map the same " +
      "virtual address to completely different physical data. Without a hardware tag " +
      "identifying which address space owns an entry, the kernel has no choice but to flush " +
      "the whole TLB whenever CR3 changes; otherwise B could hit a translation left behind by " +
      "A and read or write the wrong physical memory, which would destroy process isolation " +
      "outright. Address-space tagging is exactly what ASID/PCID buys on hardware " +
      "that has it, and the prompt rules it out here. Even with tagging the cost does not " +
      "vanish: B's first touch of a page after being switched back in commonly still misses, " +
      "either because it was never cached under B's tag or because it was evicted while A " +
      "ran, so the page-table walker has to refill the entry. This refill cost is a large " +
      "part of why switching between unrelated processes is more expensive than switching " +
      "between threads of one process, which share an address space and therefore keep the " +
      "same TLB entries valid.",
  },
  {
    id: "os-thrashing-13",
    category: "os",
    difficulty: "easy",
    title: "Working set exceeds physical memory",
    tags: ["demand-paging", "thrashing", "virtual-memory"],
    type: "trace",
    prompt:
      "A system is running several processes whose combined actively-referenced memory " +
      "(working set) significantly exceeds available physical RAM, with swap enabled. " +
      "What is the most likely symptom?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Each process runs modestly slower, roughly in proportion to how far the total overcommits RAM",
        "The kernel stops scheduling any process at all until enough physical memory has been freed",
        "Nothing measurable: demand paging makes performance depend on pages touched, not pages mapped",
        "Throughput collapses: nearly all the time goes into page faults and swapping rather than instructions",
      ],
      correctIndex: 3,
    },
    explanation:
      "Demand paging lets a system carry far more virtual memory than it has RAM, faulting " +
      "pages in only as they are touched. That works as long as each process's working set, " +
      "the pages it actually references over a short window, mostly fits in memory at the " +
      "same time. Once the aggregate working sets exceed physical RAM, the reclaim path has " +
      "to evict pages that are about to be referenced again, so each eviction begets a fault, " +
      "which begets a swap read, which evicts another needed page. The system enters " +
      "thrashing, where the fault rate is high enough that swap latency (orders of magnitude " +
      "above a RAM access) dominates everything. Degradation is not gradual and proportional; " +
      "it falls off a cliff once the working sets stop fitting. CPU utilization can look " +
      "healthy while this happens, since fault handling and I/O bookkeeping are counted as " +
      "system time. The classic remedy is to reduce the multiprogramming level so the " +
      "remaining resident processes' working sets fit, or simply to add RAM.",
  },
  {
    id: "os-priority-inversion-14",
    category: "os",
    difficulty: "hard",
    title: "Three threads at different priorities sharing one mutex",
    tags: ["scheduling", "priority-inversion", "mutex"],
    type: "trace",
    prompt:
      "Three threads: L (low priority), M (medium priority), H (high priority). L acquires " +
      "a mutex and is working inside the critical section. H then becomes ready and blocks " +
      "trying to acquire that same mutex. Before L can finish and release it, M (which " +
      "never touches the mutex at all) becomes ready. On a strict priority-preemptive " +
      "scheduler with no mitigation, what happens?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "M preempts L and runs to completion or block, so H waits behind M despite never contending with it",
        "H runs immediately: it has the highest priority, so the scheduler preempts both L and M for it",
        "L runs on to the end of its critical section, since a thread holding a mutex cannot be preempted",
        "The kernel boosts L to H's priority as soon as H blocks on the mutex, so M cannot get in front",
      ],
      correctIndex: 0,
    },
    explanation:
      "This is unbounded priority inversion. H is blocked on a mutex held by L, but the " +
      "scheduler knows nothing about that dependency; it simply runs the highest-priority " +
      "*runnable* thread. L is runnable, since it is executing inside the critical section " +
      "rather than blocked, so when M wakes up it outranks L and preempts it. H is now stuck " +
      "behind L, L is stuck behind M, and nothing bounds how long M may run, which is what " +
      "makes the inversion unbounded rather than merely a short wait. Holding a lock confers " +
      "no scheduling protection on its own, so L is preemptible like anything else. Boosting " +
      "L to H's priority is priority inheritance, a real mitigation but an opt-in one: on Linux you get " +
      "it only from a PTHREAD_PRIO_INHERIT mutex or an rt-mutex in the kernel, not by " +
      "default. The other standard answer is a priority ceiling protocol, which raises any " +
      "lock holder to the highest priority of the threads that can contend for it. This exact " +
      "scenario famously caused repeated watchdog resets on Mars Pathfinder, fixed in flight " +
      "by enabling priority inheritance on the offending mutex.",
  },
  {
    id: "os-fd-cloexec-15",
    category: "os",
    difficulty: "medium",
    title: "FD_CLOEXEC across fork() and exec()",
    tags: ["fork", "exec", "file-descriptors", "cloexec"],
    type: "trace",
    prompt: "Does the fd for secret.log show up among the exec'd `ls` process's open file descriptors?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <fcntl.h>
#include <unistd.h>
#include <sys/wait.h>
#include <cstdio>

int main() {
    int fd = open("secret.log", O_RDONLY);
    fcntl(fd, F_SETFD, FD_CLOEXEC);

    if (fork() == 0) {
        execl("/bin/ls", "ls", "-l", "/proc/self/fd", nullptr);
        _exit(1);
    }
    wait(nullptr);
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: fork() and exec() both preserve every open descriptor unconditionally",
        "No: the descriptor survives fork() but the kernel closes it at the moment exec() succeeds",
        "No: fork() consults FD_CLOEXEC and drops the descriptor before the child ever reaches execl()",
        "Yes: FD_CLOEXEC only takes effect when passed as O_CLOEXEC to open(); setting it later with fcntl() is ignored",
      ],
      correctIndex: 1,
    },
    explanation:
      "fork() copies the whole descriptor table into the child, FD_CLOEXEC flags and all, and " +
      "never consults the flag itself. The flag matters at exactly one moment: a successful " +
      "exec(), where the kernel walks the table and closes every entry marked FD_CLOEXEC as " +
      "part of installing the new process image, before the new program's first instruction " +
      "runs. So the child really does inherit the descriptor and could use it right up until " +
      "execl() succeeds; by the time ls starts, the fd is gone and does not appear under " +
      "/proc/self/fd. Setting the flag with fcntl(F_SETFD) works, but it leaves a window: if " +
      "another thread forks between open() and the fcntl(), the descriptor leaks into that " +
      "child. Passing O_CLOEXEC to open() closes the window by setting the flag as part of " +
      "the same syscall, which is why it is the preferred form in threaded programs.",
    references: ["https://man7.org/linux/man-pages/man2/fcntl.2.html"],
  },
  {
    id: "os-zombie-16",
    category: "os",
    difficulty: "easy",
    title: "Child state before wait()",
    tags: ["fork", "wait", "zombie", "process-lifecycle"],
    type: "trace",
    prompt:
      "During the parent's 5-second sleep below, after the child has already called " +
      "_exit(7), what state is the child process in?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <unistd.h>
#include <sys/wait.h>
#include <cstdio>

int main() {
    pid_t pid = fork();
    if (pid == 0) {
        _exit(7);
    }
    sleep(5); // parent does not call wait() yet
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It no longer exists: _exit() releases its resources and its process-table slot in one step",
        "It is stopped rather than terminated, waiting for the parent to resume it with SIGCONT",
        "It is an orphan, already re-parented to init, which has reaped it on the parent's behalf",
        "It is a zombie: its resources are gone, but its process-table entry and exit status remain",
      ],
      correctIndex: 3,
    },
    explanation:
      "When a process terminates, the kernel reclaims nearly all of its resources (memory, " +
      "open file descriptors) right away, but it can't fully discard the process-table " +
      "entry, because the parent may still retrieve the exit status via " +
      "wait()/waitpid()/wait4(). Until that happens, the entry persists in the 'zombie' (or " +
      "'defunct') state, visible in `ps` as `Z`, consuming only a process-table slot holding " +
      "essentially a PID and an exit-status record. Once the parent calls wait(), the " +
      "kernel delivers the status and the zombie entry is removed. Orphanhood is a separate, " +
      "orthogonal condition: it describes a child whose parent exited first, which gets " +
      "re-parented to init (or the nearest subreaper) and reaped there. Here the parent is " +
      "very much alive and simply sleeping, so the child is a zombie and not an orphan.",
  },
  {
    id: "os-pipe-sigpipe-17",
    category: "os",
    difficulty: "medium",
    title: "Writing to a pipe after the reader closes",
    tags: ["pipes", "sigpipe", "ipc"],
    type: "trace",
    prompt:
      "SIGPIPE is left at its default disposition (not ignored, no handler installed). " +
      "What actually happens when write() is called on the write end of a pipe whose read " +
      "end has already been closed?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <unistd.h>
#include <cstdio>

int main() {
    int fds[2];
    pipe(fds);
    close(fds[0]); // close the read end

    ssize_t n = write(fds[1], "hello", 5);
    printf("write returned %zd\\n", n);
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The process is killed by SIGPIPE before write() returns, so the printf line never runs",
        "write() returns -1 with errno set to EPIPE, and execution continues on to the printf line",
        "write() blocks indefinitely, waiting for a reader that will never appear",
        "write() succeeds and returns 5; the bytes sit in the pipe buffer until a reader appears",
      ],
      correctIndex: 0,
    },
    explanation:
      "Writing to a pipe (or socket) with no remaining readers is a well-defined error " +
      "condition, but the kernel's default handling is to first deliver SIGPIPE to the " +
      "writing thread. SIGPIPE's default disposition (SIG_DFL) is to terminate the process, " +
      "so unless the program has explicitly ignored it (signal(SIGPIPE, SIG_IGN)) or " +
      "installed a handler, the process dies right there. write() never actually returns, so " +
      "'write returned ...' is never printed. If SIGPIPE is ignored or handled, write() " +
      "instead returns -1 with errno == EPIPE, letting the program handle the error " +
      "programmatically. That default is why network servers almost universally call " +
      "signal(SIGPIPE, SIG_IGN) at startup: otherwise a client disconnecting mid-write " +
      "would silently kill the whole server process.",
  },
  {
    id: "os-sem-mutex-18",
    category: "os",
    difficulty: "easy",
    title: "Semaphore vs mutex: who can unlock?",
    tags: ["semaphore", "mutex", "synchronization"],
    type: "trace",
    prompt:
      "Thread T1 calls sem_wait() on a counting semaphore (decrementing it) and starts " +
      "some work. Thread T2, which never called sem_wait(), then calls sem_post() on that " +
      "same semaphore. Compare this to a std::mutex: could T2 legally call unlock() on a " +
      "mutex that T1 locked?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both are legal: neither primitive tracks which thread performed the acquire",
        "Both are illegal: every synchronization primitive requires the acquirer to release",
        "The sem_post() is legal; the cross-thread mutex unlock is undefined behavior",
        "The sem_post() is undefined behavior; the cross-thread mutex unlock is legal",
      ],
      correctIndex: 2,
    },
    explanation:
      "A counting semaphore is fundamentally an atomic integer with blocking semantics: " +
      "sem_wait() decrements it (blocking if it would go below zero) and sem_post() " +
      "increments it. Neither the kernel nor the library tracks which thread performed which " +
      "operation, so having T1 wait and T2 post is not just legal but a common, idiomatic " +
      "pattern (e.g. producer/consumer signaling or a completion handoff). A mutex, in " +
      "contrast, models exclusive *ownership*: pthread_mutex_unlock() (and std::mutex, " +
      "which specifies this contract explicitly) is undefined behavior when called by a " +
      "thread that doesn't currently hold the lock, because the mutex's internal state, plus " +
      "the priority-boosting bookkeeping on priority-inheritance-capable mutexes, is tied to " +
      "the specific owning thread. That difference is why semaphores are the right tool for " +
      "cross-thread signaling, while mutexes are the right tool for protecting a critical " +
      "section that a single thread enters and exits.",
  },
  {
    id: "os-numa-19",
    category: "os",
    difficulty: "hard",
    title: "Allocating on one NUMA node, working from another",
    tags: ["numa", "virtual-memory", "performance"],
    type: "trace",
    prompt:
      "On a dual-socket NUMA system, a setup thread pinned to socket 1 allocates and " +
      "zero-initializes a large array (the initializing writes are its 'first touch'). " +
      "Afterward, the array is handed off to a worker thread pinned to socket 0, which " +
      "repeatedly reads and writes it in a hot loop, and the array is never touched again " +
      "by anything on socket 1. What determines the memory latency the worker experiences, " +
      "and does it improve on its own over time?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "NUMA affects only which controller performs the initial allocation; steady-state latency is the same from either socket",
        "First touch pinned the array's pages to socket 1's local DRAM, so the worker pays remote-access latency indefinitely",
        "The kernel migrates each page to socket 0 on the worker's first access, so only that first read is slow",
        "Latency is identical because both sockets are served by a single unified memory controller",
      ],
      correctIndex: 1,
    },
    explanation:
      "Linux's default NUMA memory policy is first-touch: a page is physically backed on " +
      "whichever NUMA node the thread doing the first write (the page fault that allocates a " +
      "frame) is running on, not the node that will use it most and not the node that " +
      "called malloc(). Here that was socket 1, so the array's physical frames live in " +
      "socket 1's local DRAM. Every subsequent access from the worker on socket 0 has to " +
      "traverse the inter-socket interconnect (e.g. UPI/Infinity Fabric) to reach that " +
      "memory controller, incurring meaningfully higher latency and lower bandwidth than a " +
      "local access, routinely 1.5-2x worse or more under contention. Linux does not " +
      "eagerly correct this: pages stay put unless something explicitly migrates them. The " +
      "optional 'automatic NUMA balancing' feature can slowly sample and migrate hot pages " +
      "toward the accessing node over many seconds, but that is a heuristic background " +
      "process, not a fix you can schedule around. The reliable remedies are to control " +
      "placement explicitly " +
      "(numa_alloc_onnode(), mbind(), libnuma's numa_set_preferred()) or to structure the " +
      "program so the thread that will actually use the memory is also the one that first " +
      "touches it.",
  },
  {
    id: "os-hugepages-20",
    category: "os",
    difficulty: "hard",
    title: "Transparent huge pages and latency spikes",
    tags: ["huge-pages", "tlb", "memory-management"],
    type: "trace",
    prompt:
      "A latency-sensitive service enables Transparent Huge Pages (THP) in 'always' mode to " +
      "reduce TLB misses on its multi-gigabyte heap. In production it occasionally sees " +
      "multi-millisecond stalls that don't correlate with GC pauses, I/O, or lock " +
      "contention. What is the most likely cause, and how does switching to explicit " +
      "hugetlbfs pages avoid it?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Satisfying a fault with a huge page can force synchronous compaction on the faulting thread; hugetlbfs draws from a pre-reserved pool instead",
        "THP is a purely hardware feature, so software configuration cannot introduce stalls; the cause must be unrelated to huge pages",
        "THP stalls only when swap is disabled system-wide, and hugetlbfs sidesteps that purely by disabling swap for the whole machine",
        "A 2MB page needs extra page-table levels walked on every TLB miss, and that longer walk is what costs milliseconds",
      ],
      correctIndex: 0,
    },
    explanation:
      "Huge pages (2MB or 1GB instead of the standard 4KB) reduce TLB pressure by covering " +
      "far more address space per entry, cutting TLB miss rates for large working sets. THP " +
      "gets this transparently by having khugepaged scan memory in the background and " +
      "promote eligible regions, and with the 'always' policy the allocation path itself " +
      "will try to satisfy a fault with a huge page immediately. The catch is that a " +
      "contiguous 2MB physical region is much harder to find once memory has been running " +
      "and fragmenting for a while, so the kernel may trigger synchronous compaction, moving " +
      "other pages around to assemble the needed contiguous block, directly on the " +
      "faulting thread's path. That is the kind of unpredictable multi-millisecond " +
      "stall that shows up with no correlation to application-level events. hugetlbfs " +
      "sidesteps it entirely: its pages are carved out of a fixed pool reserved at boot or " +
      "startup time (via /proc/sys/vm/nr_hugepages or similar), so allocating one at runtime " +
      "is just taking a pre-existing free page off a list. No compaction, no scanning, no " +
      "surprise latency, at the cost of needing to size and reserve that pool in advance. " +
      "Many latency-sensitive systems set THP to 'madvise' (opt-in per-region) or disable it " +
      "outright, using hugetlbfs explicitly instead.",
  },
  {
    id: "os-io-uring-21",
    category: "os",
    difficulty: "medium",
    title: "io_uring versus a loop of pread() calls",
    tags: ["io_uring", "syscalls", "async-io"],
    type: "trace",
    prompt:
      "A program needs to issue 10,000 independent 4KB reads from a file. Compare doing " +
      "this with a loop of blocking pread() calls versus using io_uring. What is the core " +
      "architectural reason io_uring achieves substantially lower overhead here, rather than " +
      "just 'it's asynchronous'?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "io_uring spawns a kernel thread per request to run the reads in parallel, while pread() is inherently sequential",
        "io_uring is faster purely because it bypasses the page cache, which pread() has no way to do",
        "io_uring internally forces the descriptor into non-blocking mode, something pread() can never be given",
        "Submission and completion ring buffers shared with the kernel let one enter() call carry many requests and completions",
      ],
      correctIndex: 3,
    },
    explanation:
      "Each pread() is a full syscall: a mode switch into the kernel, argument validation, " +
      "the actual work, and a switch back. For 10,000 tiny reads, that per-call fixed cost " +
      "(easily hundreds of nanoseconds, more with mitigations like meltdown/spectre " +
      "isolation enabled) dominates. io_uring restructures the interface around two shared " +
      "ring buffers: the application writes submission queue entries (SQEs) describing " +
      "requested operations, and the kernel writes completion queue entries (CQEs) when " +
      "they finish. Both buffers are mapped into the process's address space, so producing " +
      "or consuming entries is plain memory access, not a syscall. A single io_uring_enter() " +
      "call can submit an entire batch of queued SQEs and simultaneously reap a batch of " +
      "completed CQEs, amortizing the syscall cost over many operations instead of paying it " +
      "per operation; in SQPOLL mode a dedicated kernel thread polls the SQ continuously, so " +
      "a well-tuned workload can submit I/O with zero syscalls at all. This is a genuinely " +
      "different execution model from classic non-blocking I/O (which still needs one " +
      "syscall per operation, just without blocking) or thread-pool-based async I/O (which " +
      "pays thread scheduling and context-switch overhead instead).",
  },
  {
    id: "os-vdso-22",
    category: "os",
    difficulty: "medium",
    title: "clock_gettime() in a tight loop under strace",
    tags: ["vdso", "syscalls", "timekeeping"],
    type: "trace",
    prompt: "Why does strace show almost no clock_gettime syscalls despite the loop calling it millions of times?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <time.h>
#include <cstdio>

int main() {
    struct timespec ts;
    long long sum = 0;
    for (int i = 0; i < 10'000'000; ++i) {
        clock_gettime(CLOCK_MONOTONIC, &ts);
        sum += ts.tv_nsec;
    }
    printf("%lld\\n", sum);
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The compiler hoists the call out of the loop entirely, since its result is never meaningfully used",
        "clock_gettime() is replaced at link time by a bare RDTSC instruction, involving no kernel-provided data at all",
        "glibc routes the call through the vDSO, kernel code and data mapped into the process that computes the time in userspace",
        "strace cannot instrument clock_gettime given how it is registered, so the syscalls are happening but stay invisible",
      ],
      correctIndex: 2,
    },
    explanation:
      "A plain syscall requires trapping into kernel mode, a relatively expensive mode " +
      "switch, which is wasteful for something as frequent and simple as reading the " +
      "current time. The vDSO (virtual dynamic shared object) is a small chunk of kernel " +
      "code mapped into every process's address space at exec time; glibc's clock_gettime() " +
      "wrapper calls into this mapped code first rather than issuing `syscall` directly. For " +
      "clock sources that are cheaply and consistently readable from userspace (typically an " +
      "invariant, synchronized TSC), the vDSO implementation reads a small shared data " +
      "structure that the kernel updates periodically (protected by a seqlock so readers " +
      "never observe a torn update) and combines it with a TSC read to compute the current " +
      "time entirely in userspace, with no trap and no mode switch. If the configured clocksource " +
      "isn't usable this way (e.g. certain virtualized or HPET-based setups), the vDSO falls " +
      "back to issuing the real syscall, so the optimization is conditional on hardware/clock " +
      "source, not guaranteed.",
  },
  {
    id: "os-rcu-23",
    category: "os",
    difficulty: "hard",
    title: "RCU readers and a concurrently freed node",
    tags: ["rcu", "kernel", "concurrency"],
    type: "trace",
    prompt:
      "A kernel data structure is protected by RCU (Read-Copy-Update) instead of a lock: " +
      "reads are extremely frequent, updates rare. A reader calls rcu_read_lock(), obtains " +
      "a pointer to a node, and keeps using it for a while inside that read-side critical " +
      "section. Concurrently, a writer unlinks that exact node from the structure and, after " +
      "calling synchronize_rcu(), calls kfree() on it. What actually prevents the reader " +
      "from dereferencing freed memory?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "rcu_read_lock() takes a spinlock, which blocks the writer's unlink until the reader's critical section ends",
        "The writer republishes the pointer past the node, then waits in synchronize_rcu() for every CPU to reach a quiescent state before freeing",
        "RCU is reference counting underneath: the kfree() is deferred until every outstanding reader's count on that node drops to zero",
        "Readers re-check a global version counter before each dereference and abort the traversal if it has changed",
      ],
      correctIndex: 1,
    },
    explanation:
      "RCU's defining property is that readers never block and never take a lock against " +
      "writers. rcu_read_lock()/rcu_read_unlock() are typically just preemption-disabling " +
      "or even pure compiler barriers, not synchronization primitives in the mutual-exclusion " +
      "sense. A writer removing a node does so by atomically updating the pointer that " +
      "referenced it to instead point past it (a single-word write is inherently atomic, so " +
      "concurrent readers see either the old link or the new one, never a torn value). " +
      "Readers already mid-traversal that grabbed the old pointer before the update are still " +
      "entitled to keep using it. The writer cannot free the old node immediately, though, " +
      "because such a reader might still be using it; instead it calls synchronize_rcu(), " +
      "which blocks until the kernel can prove every CPU has passed through a 'quiescent " +
      "state' (a point guaranteed to be outside any read-side critical section) at least " +
      "once. That window is the 'grace period.' Once it has elapsed, no pre-existing reader " +
      "can possibly still hold the old pointer, so kfree() is safe. Readers pay almost " +
      "nothing and writers absorb the cost of waiting and copying, which is what makes RCU " +
      "shine for read-mostly kernel structures like routing tables.",
  },
  {
    id: "os-futex-24",
    category: "os",
    difficulty: "hard",
    title: "Uncontended versus contended std::mutex::lock()",
    tags: ["futex", "mutex", "synchronization"],
    type: "trace",
    prompt:
      "On Linux, calling std::mutex::lock() on an uncontended mutex almost never shows up as " +
      "a syscall in strace, but under contention it does. What mechanism explains this, and " +
      "why is it faster than a mutex implemented as a plain kernel object?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "A userspace atomic compare-and-swap handles the uncontended case; the futex syscall is reached only to sleep or wake a thread",
        "std::mutex always makes a syscall; the uncontended case merely looks fast because that syscall happens to be cheap on Linux",
        "A futex is a purely userspace spinlock construct, so the kernel is never involved even for a thread blocked indefinitely",
        "futex names a lock-prefixed CPU instruction that replaces the mutex data structure entirely, implemented by the MMU",
      ],
      correctIndex: 0,
    },
    explanation:
      "A futex is not a full kernel object like a System V semaphore. It is a userspace " +
      "integer plus a thin kernel-provided waiting/waking mechanism keyed off that integer's " +
      "address. The classic design (as used by glibc/libstdc++'s std::mutex on Linux) encodes " +
      "state directly in the word: e.g. 0 = unlocked, 1 = locked with no waiters, 2 = locked " +
      "with waiters. lock() first attempts an atomic compare-and-swap from 0 to 1 entirely in " +
      "userspace. If that succeeds, the function returns having never touched the kernel at " +
      "all, which is why the fast, uncontended path is essentially free. Only if the CAS " +
      "fails (someone else holds it) does the thread transition the word to 2 and call the " +
      "futex(FUTEX_WAIT, ...) syscall, which atomically checks the value is still what's " +
      "expected and puts the thread to sleep on a kernel wait queue keyed by that memory " +
      "address, closing the classic missed-wakeup race. unlock() similarly does an atomic " +
      "decrement/exchange and only calls futex(FUTEX_WAKE, ...) if the word indicated waiters " +
      "were present, skipping the syscall entirely for the uncontended unlock. The net effect " +
      "is that the kernel is involved only for the necessary blocking and waking, not for " +
      "every acquire/release, which is what makes futex-based mutexes dramatically cheaper " +
      "than syscall-per-operation designs under low contention.",
  },
  {
    id: "os-namespaces-25",
    category: "os",
    difficulty: "medium",
    title: "What a PID namespace isolates",
    tags: ["namespaces", "containers", "isolation"],
    type: "trace",
    prompt:
      "A colleague claims that putting a process in its own PID namespace (so it sees " +
      "itself as PID 1, with no visibility into host process IDs) is, by itself, sufficient " +
      "to prevent that process from accessing or affecting the host system, with no other " +
      "namespaces or restrictions needed. Is this claim correct?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: a PID namespace fully isolates the process from the host, filesystem and privileges included",
        "Yes, but only for as long as the process never calls fork() again inside its new namespace",
        "No: PID namespaces are a cgroups-v2 concept and do not actually restrict process visibility at all",
        "No: it scopes only PID numbering and signal delivery; the host filesystem, network, and UID 0 are untouched",
      ],
      correctIndex: 3,
    },
    explanation:
      "Linux namespaces are independent, composable isolation primitives (pid, mnt, net, " +
      "uts, ipc, user, cgroup, time), and a 'container' is really just a process launched " +
      "with some chosen subset of them (plus cgroups for resource limits and often seccomp/" +
      "capabilities for further restriction). A PID namespace by itself changes only what " +
      "process IDs look like and which processes can be seen/signaled: the isolated process " +
      "becomes PID 1 in its own hierarchy and cannot see or signal host processes outside " +
      "it. That says nothing about the filesystem (still the host's, absent a separate " +
      "mount namespace and a chroot/pivot_root), the network (still the host's interfaces, " +
      "absent a net namespace), or privilege (absent a user namespace, a root process inside " +
      "the 'container' is genuinely UID 0 on the host, with real root capabilities against " +
      "anything it can reach: host device nodes, procfs entries, or any shared mount). " +
      "Assuming namespace isolation implies privilege isolation is the gap that underlies " +
      "many real container-escape techniques, which is why production container runtimes " +
      "combine PID/mount/net namespaces with a user namespace (UID remapping) and capability " +
      "dropping, not PID isolation alone.",
  },
  {
    id: "os-plt-got-26",
    category: "os",
    difficulty: "medium",
    title: "Lazy binding through the PLT and GOT",
    tags: ["elf", "dynamic-linking", "plt-got"],
    type: "trace",
    prompt: "With default lazy binding, which call to sqrt() pays the cost of symbol resolution?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cmath>
#include <cstdio>

int main() {
    for (int i = 0; i < 2; ++i) {
        double r = sqrt(2.0); // sqrt comes from libm.so, linked dynamically
        printf("iteration %d: %f\\n", i, r);
    }
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Neither: the dynamic linker resolves every external symbol before main() runs, whatever the binding mode",
        "The second, because the CPU's branch predictor has no history for the PLT stub and mispredicts the repeat",
        "The first: its PLT stub reaches the resolver through the GOT, which the resolver then patches with sqrt's real address",
        "The first, but only from paging libm's code in off disk, a cost eager binding would pay identically",
      ],
      correctIndex: 2,
    },
    explanation:
      "With the default lazy-binding scheme (as opposed to linking with -Wl,-z,now / a " +
      "binary built with full RELRO), calls to external functions compile to a jump through " +
      "a per-function PLT stub rather than a direct call to the function's final address, " +
      "because that address isn't known until the dynamic linker has actually loaded and " +
      "resolved it. Each PLT stub jumps indirectly through its corresponding GOT slot; " +
      "initially that slot doesn't hold sqrt's real address, only the address of a " +
      "small trampoline back into the dynamic linker's resolver. The very first call " +
      "therefore detours through the resolver, which walks libm's dynamic symbol table to " +
      "find sqrt, and then patches the GOT slot in place with the now-known real address " +
      "before jumping to it. Every subsequent call still goes through the same PLT stub, but " +
      "the GOT slot now holds the real address directly, so it jumps straight to sqrt() with " +
      "no resolver detour. Only the first call carries the one-time symbol-resolution cost. " +
      "This is why profiling a program's very first calls into a " +
      "shared library can look disproportionately slow compared to steady state.",
  },
  {
    id: "os-aslr-27",
    category: "os",
    difficulty: "hard",
    title: "What ASLR randomizes across two runs",
    tags: ["aslr", "security", "memory-layout"],
    type: "trace",
    prompt:
      "This PIE (position-independent executable, the modern default) binary is run twice " +
      "in a row on a Linux system with ASLR enabled (the default). Compare the two runs' " +
      "printed addresses.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdio>
#include <cstdlib>

int main() {
    int stack_var;
    void* heap_var = malloc(16);
    printf("stack: %p\\n", (void*)&stack_var);
    printf("heap:  %p\\n", heap_var);
    free(heap_var);
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Identical on both runs: ASLR randomizes only shared-library load addresses, never the main binary's stack or heap",
        "Both differ between runs: the kernel re-randomizes the stack, the mmap/heap base, and this PIE binary's load base at each exec()",
        "The heap address differs but the stack address is always the same, since ulimit fixes stack placement regardless of ASLR",
        "Identical, because ASLR derives its entropy from a hash of the binary's contents, which are the same both times",
      ],
      correctIndex: 1,
    },
    explanation:
      "ASLR works by adding a fresh random offset, chosen at each exec(), to the base of " +
      "several distinct regions: the stack, the mmap/shared-library region (which also " +
      "hosts a PIE binary's own load base), and typically the heap's starting offset " +
      "relative to the program break. Because this program is compiled as PIE (the distro " +
      "default), even the executable's own code and the stack/heap addresses printed here " +
      "move between runs. A non-PIE binary would instead load its own code and data at a fixed " +
      "link-time address every time, with only the stack, heap, and any shared libraries " +
      "still randomized. Because ASLR only randomizes each region's *base*, not the layout " +
      "within it, a single information leak (a format-string bug, say, or an out-of-bounds " +
      "read that discloses one live pointer into the stack, heap, or a shared library) " +
      "reveals that entire region's base, since every " +
      "other address within it sits at a fixed, statically-known offset from that one leaked " +
      "pointer. This is exactly how real-world exploits routinely defeat ASLR without brute " +
      "force: leak one address, derive the rest.",
  },
  {
    id: "os-stack-canary-28",
    category: "os",
    difficulty: "medium",
    title: "A stack buffer overflow with -fstack-protector enabled",
    tags: ["stack-canary", "buffer-overflow", "security"],
    type: "trace",
    prompt:
      "Compiled with the default stack-protector enabled (-fstack-protector-strong, the " +
      "default on most modern distros), what happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdio>
#include <cstring>

void vulnerable(const char* input) {
    char buf[16];
    strcpy(buf, input); // no bounds check; input is 63 bytes
    printf("buf = %s\\n", buf);
}

int main() {
    char big[64];
    memset(big, 'A', sizeof(big) - 1);
    big[63] = '\\0';
    vulnerable(big); // overflows the 16-byte buf by ~47 bytes
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The overflow trips the canary, and the epilogue's check aborts via __stack_chk_fail() before vulnerable() returns",
        "It prints \"buf = AAAA...A\" and returns normally; the overflow lands harmlessly in unused stack space beyond buf",
        "The corrupted return address is used the instant strcpy() finishes, faulting immediately inside vulnerable() itself",
        "The stack-protector rejects the strcpy() call at compile time, since buf's fixed size is statically known",
      ],
      correctIndex: 0,
    },
    explanation:
      "With stack-protector enabled, the compiler inserts a random 'canary' value into the " +
      "stack frame between local buffers and the saved return address/frame pointer, and " +
      "emits a check of that canary against the known value in the function's epilogue, " +
      "right before the function actually returns. Because buf sits below the canary in " +
      "memory and the overflow writes upward through consecutive addresses, the 47 extra " +
      "bytes here overwrite the canary before they'd ever reach the return address; the " +
      "canary is deliberately positioned as a trip-wire in between. The check happens only " +
      "at return time, though, not the instant the overflow occurs. The corruption already " +
      "happened during strcpy(), and the printf() with the now-garbled buf still executes. " +
      "Only when vulnerable() is about to return is the mismatch caught and " +
      "__stack_chk_fail() aborts the process, preventing the corrupted return address from " +
      "ever being used. This is a fundamentally different mechanism from a guard page, which " +
      "protects against stack *exhaustion* (e.g. unbounded recursion growing the stack " +
      "pointer past its allotted region) by mapping an inaccessible page just beyond the " +
      "stack, so growing into it raises an immediate hardware SIGSEGV. Canaries detect " +
      "in-frame buffer overflows at return time; guard pages detect stack-region overrun at " +
      "the moment of the offending access.",
  },
  {
    id: "os-overcommit-oom-29",
    category: "os",
    difficulty: "hard",
    title: "malloc() beyond available memory under default overcommit",
    tags: ["memory-overcommit", "oom-killer", "malloc"],
    type: "trace",
    prompt:
      "System is Linux with default overcommit settings (vm.overcommit_memory=0) and only " +
      "~200MB of RAM+swap actually free. Predict what happens when this runs.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdlib>
#include <cstring>
#include <cstdio>

int main() {
    const size_t GB = 1024UL * 1024 * 1024;
    char* p = (char*)malloc(GB); // 1GB, but only ~200MB is actually free
    if (!p) {
        printf("malloc failed\\n");
        return 1;
    }
    printf("malloc succeeded, address = %p\\n", (void*)p);
    memset(p, 0xAB, GB); // touch every page
    printf("memset complete\\n");
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "\"malloc failed\" is printed: under overcommit_memory=0 the kernel checks free memory up front and returns NULL",
        "Both lines print: Linux transparently compresses and deduplicates pages under pressure, so the full 1GB ends up backed",
        "memset() blocks indefinitely waiting for memory to be freed elsewhere, rather than ever invoking the OOM killer",
        "\"malloc succeeded...\" is printed, then partway through memset() the OOM killer SIGKILLs whichever process scores worst",
      ],
      correctIndex: 3,
    },
    explanation:
      "malloc()'s underlying mmap()/brk() call, under the default heuristic overcommit " +
      "policy (mode 0), reserves virtual address space and typically succeeds even for " +
      "requests that exceed currently-free memory, because the kernel doesn't know how much " +
      "of that space will actually be touched, and most large allocations are sparsely used. " +
      "No physical frame is actually committed until each page is first written, via ordinary " +
      "demand paging. As memset() strides through the full gigabyte, physical pages get " +
      "allocated page-by-page; once genuine system-wide memory pressure hits the point where " +
      "no more pages can be found (even after reclaim and swapping), the kernel invokes the " +
      "OOM killer, which computes a badness score for candidate processes (roughly, memory " +
      "footprint adjusted by /proc/[pid]/oom_score_adj, with protections for things like " +
      "init) and SIGKILLs whichever process scores worst, which is often, but not " +
      "necessarily, the process whose allocation triggered the shortage. A successful " +
      "malloc() return is therefore not by itself a guarantee that the memory can " +
      "actually be used without risking termination. The other overcommit modes trade this " +
      "off differently: mode 1 always overcommits, and mode 2 refuses any allocation that " +
      "would exceed swap plus a configured fraction of RAM, buying more eager malloc() " +
      "failures in exchange for less OOM-kill risk.",
  },
  {
    id: "os-page-cache-fsync-30",
    category: "os",
    difficulty: "easy",
    title: "Power loss after write() returns but before fsync()",
    tags: ["page-cache", "fsync", "durability"],
    type: "trace",
    prompt:
      "write() returns 13 (success) as shown. The machine loses power at the point marked " +
      "in the comment, after write() returns but before fsync() or close() runs. Is " +
      "\"critical data\" guaranteed to be recoverable from output.dat after reboot?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <fcntl.h>
#include <unistd.h>
#include <cstdio>

int main() {
    int fd = open("output.dat", O_WRONLY | O_CREAT | O_TRUNC, 0644);
    ssize_t n = write(fd, "critical data", 13);
    printf("write returned %zd\\n", n); // prints 13
    // power loss happens here, before fsync() or close()
    close(fd);
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: a successful write() return means the kernel has already flushed the bytes to the physical device",
        "No: write() copies nothing into the kernel until close() runs, so the data is lost regardless of the timing",
        "No: write() only marks the bytes dirty in the page cache, and writeback to the device happens later",
        "Yes, but only because the write is smaller than one filesystem block, which is committed atomically",
      ],
      correctIndex: 2,
    },
    explanation:
      "A successful write() to a regular file (absent O_DIRECT or O_SYNC/O_DSYNC) only " +
      "promises that the bytes have been copied into the kernel's page cache and the " +
      "corresponding pages marked dirty. It says nothing about when, or whether, those " +
      "pages reach the physical device. The kernel writes dirty pages back on its own " +
      "schedule: periodic writeback daemons flush pages older than a threshold, memory " +
      "pressure can force earlier writeback, and an application can force it immediately by " +
      "calling fsync() (which flushes both data and metadata for the fd and blocks until the " +
      "device confirms the write, to the extent the device's own caching is honest about " +
      "that) or the lighter fdatasync() (skips metadata not needed to read the data back, " +
      "e.g. mtime updates). This buffering is what makes ordinary write() fast (it's a " +
      "memory copy, not a disk operation), but it also means a crash between write() " +
      "and the next writeback (whether triggered by the kernel's own timers or an explicit " +
      "fsync()) loses whatever hadn't yet been flushed. This is why databases and other " +
      "durability-sensitive software always call fsync() (or use O_DIRECT/O_SYNC) at " +
      "points where they need an actual persistence guarantee, rather than trusting write()'s " +
      "return value.",
  },
  {
    id: "os-cpu-affinity-01",
    category: "os",
    difficulty: "medium",
    title: "Pinning a hot-loop thread with sched_setaffinity",
    tags: ["cpu-affinity", "scheduling", "low-latency"],
    type: "trace",
    prompt:
      "A latency-sensitive hot-loop thread (e.g. polling a NIC ring buffer for market " +
      "data) is left to run wherever the Linux scheduler happens to place it, and its tail " +
      "latency is spiky. The team pins it to a single core with " +
      "pthread_setaffinity_np()/sched_setaffinity() as shown below. Which of the following " +
      "best explains why this reduces tail latency?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <sched.h>
#include <pthread.h>
#include <cstdio>

void pin_to_core(int core_id) {
    cpu_set_t cpuset;
    CPU_ZERO(&cpuset);
    CPU_SET(core_id, &cpuset);

    int rc = pthread_setaffinity_np(pthread_self(), sizeof(cpu_set_t), &cpuset);
    if (rc != 0) {
        perror("pthread_setaffinity_np");
    }
}

int main() {
    pin_to_core(2);   // hot-loop thread confined to core 2
    for (;;) {
        // latency-sensitive work: e.g. poll a NIC ring buffer
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It raises the thread's scheduling priority on that core, so other runnable work there is preempted whenever the hot loop becomes ready",
        "It stops the kernel from routing timer interrupts to that core, so the hot loop runs without ever being preempted",
        "It binds the thread's future heap allocations to the NUMA node local to that core, removing remote-memory access latency",
        "It stops the load balancer from migrating the thread, so the hot loop keeps its warm L1/L2 and TLB state and avoids re-scheduling jitter",
      ],
      correctIndex: 3,
    },
    explanation:
      "sched_setaffinity()/pthread_setaffinity_np() sets a thread's CPU affinity mask, the " +
      "set of cores the scheduler is allowed to place it on. With the mask narrowed to a " +
      "single core, the load balancer can no longer migrate the thread to spread load, which " +
      "removes several latency sources: a migrated thread arrives on its new core with cold " +
      "L1/L2 caches and no warm TLB entries, so its next several memory accesses eat full " +
      "cache-miss/page-walk latency instead of hitting in cache; migration also means the " +
      "thread has to be re-picked by a different runqueue's scheduling decision, adding " +
      "jitter to exactly when it resumes. Pinning does not change scheduling priority or " +
      "quantum length. A pinned SCHED_OTHER thread still competes with whatever else runs " +
      "on that core, which is why pinning is frequently combined with CPU isolation " +
      "(isolcpus=/nohz_full=, or moving all other work off that core via cpusets) so the " +
      "pinned thread effectively owns it. Affinity is also a distinct concept from NUMA " +
      "memory placement: pinning a thread to a core says nothing about which node its " +
      "allocations land on (that's governed by first-touch policy or explicit mbind()/" +
      "numa_alloc_onnode()), though the two are commonly tuned together in low-latency systems.",
    references: [
      "https://man7.org/linux/man-pages/man2/sched_setaffinity.2.html",
      "https://man7.org/linux/man-pages/man7/sched.7.html",
    ],
  },
  {
    id: "os-sched-fifo-01",
    category: "os",
    difficulty: "hard",
    title: "A SCHED_FIFO thread in a loop that never blocks",
    tags: ["scheduling", "sched_fifo", "real-time", "starvation"],
    type: "trace",
    prompt:
      "A thread calls sched_setscheduler(pid, SCHED_FIFO, &param) with sched_priority = 50, " +
      "then, because of a bug, enters a tight loop that never calls a blocking syscall, " +
      "sleep(), or sched_yield(). Every other runnable thread on that same CPU is an " +
      "ordinary SCHED_OTHER (CFS) thread, and no other realtime thread of equal or higher " +
      "priority ever becomes runnable. What happens to those SCHED_OTHER threads on that " +
      "CPU?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "They get only the share realtime throttling reserves for non-RT work (5% of each period by default), and nothing at all if that throttle is disabled",
        "They keep their normal CFS-computed share, because the kernel preempts any SCHED_FIFO thread once its default fair-share time slice elapses",
        "They resume after roughly 100ms, when the kernel demotes the runaway thread back to SCHED_OTHER to prevent starvation",
        "They get an ordinary round-robin turn, since SCHED_FIFO time-slices against other runnable threads exactly like SCHED_RR, just with a longer quantum",
      ],
      correctIndex: 0,
    },
    explanation:
      "SCHED_FIFO is a fixed-priority, run-to-block real-time policy: among threads at " +
      "the same priority level there is no time-slicing at all (that's what distinguishes it " +
      "from SCHED_RR, which round-robins threads sharing a priority). A SCHED_FIFO thread " +
      "keeps the CPU until it voluntarily blocks (I/O, a lock, sleep), calls sched_yield(), " +
      "or is preempted by a realtime thread of strictly higher (or, for SCHED_RR, " +
      "equal-and-next-in-line) priority. A plain CFS/SCHED_OTHER thread can never preempt " +
      "it, no matter how long it has been running or how starved everything else becomes. " +
      "So a buggy or malicious SCHED_FIFO thread that never blocks can lock out the rest of " +
      "the system on that CPU indefinitely. Linux ships a partial safety net for this case, " +
      "realtime throttling, governed by /proc/sys/kernel/sched_rt_runtime_us and " +
      "sched_rt_period_us: by default it lets realtime tasks consume 950000 out of every " +
      "1000000 microseconds and throttles them for the remaining 5%, which is the only " +
      "reason the SCHED_OTHER threads here make any progress at all. That throttle is " +
      "commonly set to -1 (unlimited) on latency-tuned real-time systems specifically to " +
      "remove it as a jitter source, at which point a runaway SCHED_FIFO thread genuinely " +
      "can monopolize the CPU forever. Real-time code has to be scrupulously correct about " +
      "eventually blocking or yielding.",
    references: [
      "https://man7.org/linux/man-pages/man7/sched.7.html",
      "https://man7.org/linux/man-pages/man2/sched_setscheduler.2.html",
    ],
  },
  {
    id: "os-cgroup-cfs-throttling-01",
    category: "os",
    difficulty: "hard",
    title: "CFS bandwidth throttling with low average CPU usage",
    tags: ["cgroups", "cfs-bandwidth", "throttling", "containers"],
    type: "trace",
    prompt:
      "A containerized service has a cgroup CPU quota of 2 cores (cpu.cfs_quota_us=200000, " +
      "cpu.cfs_period_us=100000, i.e. 200ms of CPU time allowed per 100ms period). " +
      "Dashboards show its average CPU usage over any 1-minute window is only ~40% of that " +
      "quota, yet cgroup metrics (nr_throttled / throttled_time) show it being throttled " +
      "dozens of times per minute, and request p99 latency has periodic spikes. How can a " +
      "workload with low *average* usage still get throttled this often?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The throttling counters only record periods where the cgroup came close to its quota; nr_throttled can rise without any thread actually being descheduled",
        "The cap being hit belongs to a tighter parent cgroup rather than the 200ms configured here, so the service is capped well below its own limit",
        "The quota is enforced inside each fixed 100ms period, not as a rolling average, so a burst of parallel threads can spend the whole 200ms budget in the first 20ms",
        "cgroup v1's bandwidth controller only deprioritizes threads rather than descheduling them, so the latency spikes must come from an unrelated source",
      ],
      correctIndex: 2,
    },
    explanation:
      "The CFS bandwidth controller (cpu.cfs_quota_us/cpu.cfs_period_us on cgroup v1, the " +
      "combined cpu.max on cgroup v2) enforces a hard cap per fixed period, refilled at the " +
      "start of each period. It has no memory of how little the cgroup used in previous " +
      "periods and does not average anything over a longer window. A quota of 200ms per " +
      "100ms period means, in principle, up to 2 CPU-cores'-worth of parallel execution: " +
      "4 threads each running flat-out for 50ms would exhaust the whole period's budget " +
      "in 50ms of wall-clock time, at which point every thread in the cgroup is throttled " +
      "(runqueue-blocked, not merely deprioritized) until the next period begins and the " +
      "quota refills. A service can easily average 40% utilization over a minute while still " +
      "having many individual 100ms periods where a burst of parallel work spikes to 100% of " +
      "quota almost instantly, gets throttled for the remainder of that period, then goes " +
      "idle again. The long-window average simply hides the short-window bursts. This is a " +
      "very common real-world gotcha in Kubernetes-style deployments: a pod's CPU *limit* " +
      "maps directly to cfs_quota_us/cfs_period_us, so services with bursty, multi-threaded " +
      "or GC-pause-then-catch-up behavior (thread-pool webservers, GC'd runtimes, event-loop " +
      "fan-out) get throttled and see tail-latency spikes despite 'plenty of average " +
      "headroom.' Standard mitigations: raise the CPU limit (or remove it and rely on " +
      "requests + node-level isolation), increase cfs_period_us so bursts have more room to " +
      "spread out, reduce request-time thread fan-out/parallelism, or move the workload to " +
      "cpuset-pinned dedicated cores instead of a shared quota.",
    references: [
      "https://docs.kernel.org/scheduler/sched-bwc.html",
      "https://man7.org/linux/man-pages/man7/cgroups.7.html",
    ],
  },
  {
    id: "os-major-minor-fault-01",
    category: "os",
    difficulty: "medium",
    title: "Two page faults on a memory-mapped file",
    tags: ["page-fault", "virtual-memory", "mmap", "page-cache"],
    type: "trace",
    prompt:
      "A process mmap()s a large log file with MAP_PRIVATE shortly after a fresh boot, " +
      "before anything has ever read that file (nothing from it is in the page cache). It " +
      "reads one byte at an offset it has never touched. Later, it reads a byte at a " +
      "*different* offset in the same file, one that another, unrelated process happened " +
      "to read moments earlier, so that page is now already resident in the page cache. " +
      "Contrast the page fault triggered by each of these two accesses.",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both are minor faults of similar cost, since mmap() already populated the mapping's page-table entries at the time it was called",
        "Both are major faults: with MAP_PRIVATE the kernel must re-read the file for this mapping rather than share another process's page-cache pages",
        "The first is minor and the second is major, since mmap() pre-faults from the start of a mapping and a page another process cached is not reachable from this one",
        "The first is a major fault that blocks the thread on real I/O to populate the page cache; the second is a minor fault that only wires up a PTE to the already-resident frame",
      ],
      correctIndex: 3,
    },
    explanation:
      "The minor-vs-major distinction is about whether the kernel's page-fault handler can " +
      "satisfy the fault without touching backing storage. A minor fault covers any case " +
      "where a physical frame with the right contents already exists somewhere accessible: " +
      "a freshly zero-filled anonymous page, a copy-on-write page, or, as in the second " +
      "scenario here, a file-backed page that's already sitting in the page cache because " +
      "some other process (or an earlier access by the same process) already pulled it in; " +
      "the kernel just wires up a page-table entry and resumes, on the order of a memory " +
      "access plus bookkeeping. A major fault is what happens when no such frame exists " +
      "yet: mmap() only reserves virtual address space and metadata describing the mapping " +
      "at call time and never eagerly reads file contents, so the very first touch of a " +
      "page whose contents aren't cached anywhere forces the kernel to block the faulting " +
      "thread, issue an actual read from the backing file (disk, network filesystem, etc.), " +
      "wait for it to complete, populate a fresh page-cache page, and only then map it and " +
      "resume. That is orders of magnitude slower than a minor fault, and on spinning disk or a " +
      "loaded network filesystem this can cost multiple milliseconds or more. Both fault " +
      "counts are directly observable via getrusage()'s ru_minflt/ru_majflt fields or " +
      "/proc/[pid]/stat, and via `perf stat -e minor-faults,major-faults`. For " +
      "latency-sensitive code, the practical implication is that touching a memory-mapped " +
      "file for the first time is a genuine tail-latency risk unless the pages are known to " +
      "already be resident. Mitigations are pre-warming with madvise(MADV_WILLNEED), reading " +
      "the file once during a non-critical startup phase, or mlock()'ing the mapping after " +
      "an initial warm-up pass.",
    references: [
      "https://man7.org/linux/man-pages/man2/mmap.2.html",
      "https://man7.org/linux/man-pages/man2/getrusage.2.html",
    ],
  },
  {
    id: "os-mlock-01",
    category: "os",
    difficulty: "medium",
    title: "mlockall() after pre-faulting a buffer",
    tags: ["mlock", "real-time", "memory-management", "latency"],
    type: "trace",
    prompt:
      "A real-time audio callback (equally: an HFT market-data hot path) must never miss " +
      "its deadline, and the team is worried the kernel could reclaim/swap a page of its " +
      "scratch buffer under memory pressure, later stalling the callback on a page fault " +
      "mid-deadline. The code below touches the buffer once via memset(), then calls " +
      "mlockall(MCL_CURRENT | MCL_FUTURE) before ever entering the real-time loop. Why does " +
      "this combination guarantee later accesses to hot_buffer inside the real-time loop " +
      "will never stall on a page fault (not even a fast minor one) for the rest of the " +
      "process's lifetime?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <sys/mman.h>
#include <cstring>
#include <cstdio>

int main() {
    char* hot_buffer = new char[1 << 20];   // 1MB scratch buffer for the RT path
    memset(hot_buffer, 0, 1 << 20);          // first touch: pages become resident here

    // Lock every page currently mapped into this process (including hot_buffer),
    // and keep any pages mapped in the future locked too.
    if (mlockall(MCL_CURRENT | MCL_FUTURE) != 0) {
        perror("mlockall");
        return 1;
    }

    // ... enter real-time audio callback / market-data hot loop, using hot_buffer ...
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "mlockall() disables the swap subsystem machine-wide for as long as the process is alive, which is what actually keeps the buffer resident",
        "The locked pages are marked VM_LOCKED and pulled off the reclaim LRU lists, so nothing can evict the resident frames or tear down their page-table entries",
        "mlockall() only pins memory also marked madvise(MADV_DONTFORK); without that second call the pages stay evictable under heavy pressure",
        "The lock is redundant here: Linux never swaps out an anonymous page that has already been written, whatever mlock says",
      ],
      correctIndex: 1,
    },
    explanation:
      "mlock()/mlockall() do two things: first, for pages already mapped and resident, they " +
      "guarantee (per POSIX and the Linux implementation) that the pages are resident in RAM " +
      "before the call returns successfully; if a locked range included memory that had " +
      "never been touched, the call itself would fault it in. Second, and more importantly " +
      "for keeping a deadline, locked pages are marked VM_LOCKED and pulled off the normal " +
      "LRU reclaim lists, so the kernel's page reclaim and swap machinery will never select " +
      "them as eviction candidates. Under memory pressure it reclaims unlocked pages from " +
      "elsewhere, or as a last resort invokes the OOM killer, rather than paging out locked " +
      "memory. In the snippet, hot_buffer is deliberately touched via memset() *before* the " +
      "mlockall() call, so by the time it's locked it's already backed by real physical " +
      "frames with populated page-table entries, and mlockall(MCL_CURRENT) simply pins " +
      "that already-resident state permanently. MCL_FUTURE extends the same pinning " +
      "guarantee to any memory the process maps or grows into afterward (heap growth, new " +
      "mmap regions), so nothing allocated later can silently reintroduce swap risk. With " +
      "all of that in place, every access to hot_buffer inside the real-time loop hits an " +
      "already-resident, never-to-be-evicted physical page: no major fault (nothing to read " +
      "back in from swap) and no minor fault (the page-table entry is never torn down by " +
      "reclaim). In practice, unprivileged processes are also bounded by RLIMIT_MEMLOCK " +
      "(the `ulimit -l` limit), so locking a nontrivial amount of memory usually requires " +
      "raising that limit or holding CAP_IPC_LOCK, a common deployment detail for the " +
      "real-time audio and HFT services this technique is built for.",
    references: [
      "https://man7.org/linux/man-pages/man2/mlock.2.html",
      "https://man7.org/linux/man-pages/man2/mlockall.2.html",
    ],
  },
  {
    id: "os-guard-page-stack-overflow-01",
    category: "os",
    difficulty: "medium",
    title: "Unbounded recursion with large stack frames",
    tags: ["virtual-memory", "stack", "guard-page", "segfault"],
    type: "trace",
    prompt:
      "The function below recurses without a base case, and each call frame reserves a " +
      "4KB local array, so the stack grows unboundedly. Why does this reliably crash with " +
      "SIGSEGV, rather than the recursion silently overwriting whatever memory happens to " +
      "sit past the end of the stack (e.g. heap data or a shared library's mapped code)?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdio>

long long recurse(long long n) {
    char padding[4096];   // large stack frame per call
    padding[0] = (char)n;
    return recurse(n + 1) + padding[0];
}

int main() {
    printf("%lld\\n", recurse(0));
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The stack grows until it runs into the heap's break address, after which malloc() starts failing and the process dies on the failed allocation",
        "The stack VMA only grows up to RLIMIT_STACK, and beyond it the address space is deliberately left unmapped, so the fault there has no VMA to satisfy it",
        "The kernel tracks per-thread call depth and kills the process once a fixed recursion limit is exceeded",
        "Each frame's stack-protector canary is clobbered by the next frame's array, and __stack_chk_fail() aborts the process on the way back out",
      ],
      correctIndex: 1,
    },
    explanation:
      "A process's virtual address space is a patchwork of mapped regions (text, data/BSS, " +
      "heap, shared library mappings, the stack) separated by unmapped gaps. The main " +
      "thread's stack is special-cased by the kernel to grow automatically on demand " +
      "(handled by the page-fault path itself) as the stack pointer moves into a small " +
      "adjacent 'grows-down' region, but only up to a configured ceiling (RLIMIT_STACK, " +
      "commonly 8MB by default on Linux) and only into space the kernel is willing to " +
      "extend the stack VMA into. Just past that limit (and, for non-main-thread stacks " +
      "created by pthreads, immediately past each thread's fixed-size stack allocation, " +
      "controlled by pthread_attr_setstacksize()/setguardsize(), one guard page by " +
      "default) the kernel deliberately leaves the address space unmapped rather than " +
      "letting the stack blend into whatever mapping happens to follow it. When unbounded " +
      "recursion (or a single huge local array) pushes an access into that unmapped guard " +
      "region, the MMU raises a page fault for a virtual address with no backing VMA at " +
      "all (or, at the stack's growth limit, one automatic-growth explicitly refuses to " +
      "satisfy); the kernel's fault handler finds nothing to fix up and delivers SIGSEGV. " +
      "This guard region converts what would otherwise be a wild, silently-corrupting write " +
      "into a deterministic, immediately-fatal fault. One historical wrinkle worth knowing: " +
      "the 2017 'Stack Clash' class of bugs (e.g. CVE-2017-1000364) exploited the fact that " +
      "a single large stack-pointer adjustment (rather than page-by-page growth) could jump " +
      "clean over a single guard page without ever touching it, landing directly in the " +
      "mapping beyond, which is why modern compilers emit explicit stack-probing code for " +
      "large frame allocations, to guarantee every intervening page, including the guard " +
      "page, actually gets touched.",
    references: [
      "https://man7.org/linux/man-pages/man2/getrlimit.2.html",
      "https://man7.org/linux/man-pages/man3/pthread_attr_setguardsize.3.html",
    ],
  },
  {
    id: "os-thp-latency-01",
    category: "os",
    difficulty: "hard",
    title: "Transparent huge pages with defrag set to madvise",
    tags: ["huge-pages", "khugepaged", "latency", "tlb"],
    type: "trace",
    prompt:
      "A service sets THP's defrag mode to 'madvise' specifically to avoid the well-known " +
      "page-fault-path stall, where a thread that faults in new memory can itself block on " +
      "synchronous compaction while the kernel assembles a contiguous 2MB region. Even with " +
      "that mitigated, the team still occasionally sees a few-hundred-microsecond latency " +
      "blip on a completely unrelated, already-warmed-up hot-loop thread of the same " +
      "process, a thread that isn't touching any new memory and didn't trigger any fault " +
      "itself. What's the most likely cause?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing to do with THP: this is almost certainly an ordinary timer-interrupt-driven CFS quantum preemption of the hot-loop thread",
        "khugepaged only runs while a CPU is fully idle, so it can never interrupt a thread that is currently executing user code",
        "The hot-loop thread is waiting on a global lock khugepaged holds system-wide while collapsing pages for any process on the machine",
        "khugepaged collapsed small pages into a huge page in the background and issued a TLB shootdown IPI to every CPU running a thread of that process",
      ],
      correctIndex: 3,
    },
    explanation:
      "This is a different THP hazard than the fault-path synchronous-compaction stall: " +
      "even once a service avoids that (by setting defrag to 'madvise' or 'never', so a " +
      "fresh fault doesn't itself trigger synchronous compaction), THP's 'always'/'madvise' " +
      "allocation policy still leaves khugepaged running in the background. khugepaged " +
      "periodically wakes up (governed by /sys/kernel/mm/transparent_hugepage/khugepaged/" +
      "scan_sleep_millisecs, on the order of several seconds between passes on a typical " +
      "modern kernel, though this is tunable and version-dependent) and scans eligible " +
      "VMAs across the system's processes for contiguous runs of small pages that could be " +
      "promoted into a huge page. When it finds a candidate, it performs an in-place " +
      "collapse: allocate a huge page, copy the small pages' contents into it, and remap " +
      "the region, an operation that requires briefly taking the target process's " +
      "mm-wide lock and, critically, issuing a TLB shootdown to every CPU where a thread of " +
      "that process is currently running, since those CPUs may hold now-stale small-page " +
      "TLB entries for the collapsed region that must be invalidated before the collapse is " +
      "safe to use. That shootdown is an inter-processor interrupt each affected CPU must " +
      "service essentially immediately, which can briefly delay whatever that CPU's thread " +
      "was doing, including a hot loop that has nothing to do with the memory being " +
      "collapsed and never itself faulted. That is why many latency-sensitive " +
      "production systems go further than tuning the defrag mode and disable THP outright " +
      "(echo never > /sys/kernel/mm/transparent_hugepage/enabled) in favor of explicit " +
      "hugetlbfs allocations sized and reserved up front. hugetlbfs pages are never " +
      "collapsed, scanned, or migrated by khugepaged, so they carry none of this background " +
      "jitter risk.",
    references: [
      "https://docs.kernel.org/admin-guide/mm/transhuge.html",
      "https://www.kernel.org/doc/html/latest/admin-guide/mm/transhuge.html#khugepaged",
    ],
  },
  {
    id: "os-epoll-edge-triggered-01",
    category: "os",
    difficulty: "medium",
    title: "Edge-triggered epoll with a single read() per event",
    tags: ["epoll", "edge-triggered", "networking", "event-loop"],
    type: "trace",
    prompt:
      "client_fd is registered with EPOLLET (edge-triggered), as shown below. A burst of " +
      "2000 bytes arrives at once on client_fd, but the handler performs a single 512-byte " +
      "read() and returns to epoll_wait() without looping until read() returns EAGAIN. No " +
      "further data ever arrives on client_fd afterward. What happens to the remaining " +
      "~1488 bytes still sitting in the kernel's socket receive buffer?",
    snippet: {
      language: "cpp",
      filename: "server.cpp",
      code: `#include <sys/epoll.h>
#include <unistd.h>
#include <cstdio>

int event_loop(int epfd) {
    epoll_event events[16];
    for (;;) {
        int n = epoll_wait(epfd, events, 16, -1);
        for (int i = 0; i < n; ++i) {
            char buf[512];
            // Single read, NOT a loop to EAGAIN.
            ssize_t r = read(events[i].data.fd, buf, sizeof(buf));
            if (r <= 0) continue;
            // ... process buf[0..r) ...
        }
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "epoll_wait() reports client_fd readable again on its very next call, since both modes re-report any fd whose receive buffer is non-empty",
        "The kernel notices the partial read and silently downgrades that registration to level-triggered so the leftover data cannot be stranded",
        "They stay buffered but unreported: with no new data arriving there is no fresh edge, so epoll_wait() never returns EPOLLIN for client_fd again",
        "The kernel discards them when the handler returns to epoll_wait(), since an edge-triggered socket drops whatever was not consumed during that wakeup",
      ],
      correctIndex: 2,
    },
    explanation:
      "Level-triggered (epoll's default) reports a registered fd as ready on every " +
      "epoll_wait() call for as long as the underlying condition holds (say, the socket's " +
      "receive buffer being non-empty), so even a handler that under-reads gets re-notified on " +
      "the next call and eventually catches up. Edge-triggered (EPOLLET) is fundamentally " +
      "different: epoll only reports the fd when the kernel observes a transition, most " +
      "commonly new data being queued onto a socket that previously had none pending, or " +
      "more generally a readiness-changing event firing on that socket. It does not " +
      "re-report merely because old, already-signaled data is still sitting unread. If a " +
      "handler reads only part of what's available and returns to epoll_wait() without " +
      "looping read()/recv() until it hits EAGAIN/EWOULDBLOCK (or a short read on a stream " +
      "confirms there's nothing more queued), the leftover bytes remain buffered in the " +
      "kernel but produce no further wakeup. From the application's point of view, that " +
      "data has effectively vanished until something else causes a new edge (e.g. more data " +
      "arriving later, which happens to also flush out the older bytes when it's finally " +
      "read). This is one of the most common real-world edge-triggered epoll bugs, and the " +
      "reason the canonical EPOLLET idiom requires two things together: the fd must be " +
      "non-blocking (O_NONBLOCK), and the handler must loop read()/recv() in a tight loop " +
      "until it observes EAGAIN, guaranteeing the buffer is fully drained before returning " +
      "to epoll_wait(). Level-triggered mode is more forgiving of a partial read (you just " +
      "get called again), which is why many applications default to LT and reach for ET " +
      "only when they specifically need to avoid the small overhead of repeated readiness " +
      "notifications for the same fd.",
    references: ["https://man7.org/linux/man-pages/man7/epoll.7.html"],
  },
  {
    id: "os-rdtsc-01",
    category: "os",
    difficulty: "hard",
    title: "Comparing rdtsc readings taken on different cores",
    tags: ["rdtsc", "tsc", "timing", "low-latency"],
    type: "trace",
    prompt:
      "A latency-measurement library takes a raw `rdtsc` reading on thread A (pinned to " +
      "core 3) at the start of an operation, and later compares it against a raw `rdtsc` " +
      "reading taken by thread B (pinned to core 7) that completes the operation, computing " +
      "elapsed cycles as a plain subtraction, with no clock_gettime() and no syscall, just " +
      "the `rdtsc` instruction on each side. On a typical modern x86-64 server CPU, is this " +
      "safe, and why would anyone reach for raw `rdtsc` over clock_gettime()/gettimeofday() " +
      "in the first place?",
    snippet: {
      language: "cpp",
      filename: "latency.cpp",
      code: `#include <x86intrin.h>
#include <cstdint>

// Hot-path timestamp: a single instruction, no syscall.
inline uint64_t rdtsc_now() {
    return __rdtsc();
}

// thread A (core 3):
uint64_t start = rdtsc_now();
// ... send the order ...

// thread B (core 7), later:
uint64_t end = rdtsc_now();
uint64_t elapsed_cycles = end - start; // cross-core comparison`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Safe on parts advertising an invariant TSC (constant_tsc/nonstop_tsc), and cheap because `rdtsc` reads the counter in userspace with no kernel transition",
        "Never meaningful across threads: the TSC is a per-process software counter the kernel maintains, with no fixed relationship to any particular core",
        "`rdtsc` traps into the kernel through the vsyscall page to be read safely, so it costs about what clock_gettime() costs and buys no speed at all",
        "Safe on every x86-64 part ever shipped, since Intel and AMD have kept per-core TSCs rate-stable and synchronized since the original Pentium",
      ],
      correctIndex: 0,
    },
    explanation:
      "`rdtsc` reads a 64-bit hardware counter directly in userspace with a single " +
      "instruction: no ring transition, no argument validation, none of the fixed overhead " +
      "a real syscall (or even a vDSO-served clock_gettime()) carries. That is " +
      "why hot-path latency instrumentation in HFT-style code reaches for it directly instead " +
      "of going through libc's time functions. The catch is the 'invariant TSC' caveat: on " +
      "older CPUs (and non-invariant AMD parts prior to family 10h), the TSC simply counted " +
      "core clock cycles, so its tick rate changed with dynamic frequency scaling (P-states) " +
      "and could stop advancing entirely during deep sleep (C-states); on multi-socket " +
      "systems, per-core counters could also start from different offsets and drift apart " +
      "over time with no hardware guarantee of staying aligned. Under those conditions, " +
      "subtracting a reading taken on one core from a reading taken on another was not just " +
      "imprecise, it could yield numbers with no real meaning at all, including apparently " +
      "negative durations. Modern CPUs fix this by advertising an invariant TSC (CPUID leaf " +
      "0x80000007, EDX bit 8, surfaced in /proc/cpuinfo as the constant_tsc and nonstop_tsc " +
      "flags): a single " +
      "counter domain that ticks at a fixed rate (matching the CPU's rated/nominal frequency, " +
      "not the current turbo or throttled frequency) and is kept synchronized across cores " +
      "and sockets, typically re-verified/aligned by firmware or the OS at boot. Software " +
      "should not simply assume it: check the CPUID invariant-TSC " +
      "bit (or the constant_tsc/nonstop_tsc flags Linux exposes) before trusting cross-core " +
      "rdtsc comparisons, and remember that virtualized environments add their own " +
      "wrinkles (a hypervisor may emulate or scale the TSC in ways that break the invariant-TSC " +
      "guarantee the guest believes it has). This is the same hardware guarantee the " +
      "vDSO's fast clock_gettime() path relies on internally to avoid a real syscall.",
    references: [
      "https://en.wikipedia.org/wiki/Time_Stamp_Counter",
      "https://www.felixcloutier.com/x86/rdtsc",
    ],
  },
  {
    id: "os-clock-monotonic-01",
    category: "os",
    difficulty: "medium",
    title: "Measuring an interval with CLOCK_REALTIME",
    tags: ["clock_gettime", "monotonic", "timing", "ntp"],
    type: "trace",
    prompt:
      "This benchmarking helper times an operation using CLOCK_REALTIME. It runs correctly " +
      "in isolated testing, but in production the printed duration is occasionally a large " +
      "negative number. What's wrong, and what's the correct fix?",
    snippet: {
      language: "cpp",
      filename: "bench.cpp",
      code: `#include <time.h>
#include <cstdio>

long long now_ns() {
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    return (long long)ts.tv_sec * 1'000'000'000LL + ts.tv_nsec;
}

void time_operation() {
    long long start = now_ns();
    do_work();
    long long end = now_ns();
    printf("elapsed: %lld ns\\n", end - start); // occasionally negative in production
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The optimizer is reordering the two now_ns() calls around do_work(); the fix is a compiler barrier before and after each read",
        "do_work() is itself stepping the system clock, and the fix is to sandbox it so it can no longer call settimeofday()",
        "The vDSO's cached CLOCK_REALTIME value can be read mid-update and come back stale; the fix is to switch to CLOCK_REALTIME_COARSE",
        "CLOCK_REALTIME can be stepped backward by NTP or clock_settime(); the fix is to time the interval with CLOCK_MONOTONIC instead",
      ],
      correctIndex: 3,
    },
    explanation:
      "POSIX clocks are not interchangeable, and the distinction matters enormously for " +
      "latency measurement. CLOCK_REALTIME represents the system's notion of wall-clock time " +
      "(seconds since the Unix epoch) and is explicitly documented as subject to discontinuous " +
      "jumps: an administrator manually changing the clock, or, far more commonly in " +
      "production, the NTP/chrony daemon stepping the clock to correct drift. Either can move " +
      "CLOCK_REALTIME backward at essentially any moment, with no relationship to how much " +
      "wall-clock time has actually elapsed. If that happens between the 'start' and 'end' " +
      "reads here, `end - start` can be negative, or simply wrong by however much the clock " +
      "was stepped, a correctness bug that's invisible in short local test runs but shows up " +
      "sporadically in any long-running production service subject to normal NTP discipline. " +
      "CLOCK_MONOTONIC is specified never to go backward between successive reads (though " +
      "successive calls may return an identical, not strictly increased, value depending on " +
      "clock resolution), and it is not affected by settimeofday()-style adjustments. NTP " +
      "may still slew its rate slightly to keep it roughly aligned with real time, but it " +
      "will not be stepped. CLOCK_MONOTONIC_RAW goes further, providing a hardware-based time " +
      "that isn't even subject to NTP frequency slewing, at the cost of typically being " +
      "slightly more expensive to read and not useful for anything that needs to track real " +
      "elapsed seconds precisely calibrated to the outside world. The vDSO's fast path is " +
      "not a hazard here either: it guards the shared timekeeping data with a seqlock, so a " +
      "reader that catches an update in progress simply retries. The practical rule: never " +
      "use CLOCK_REALTIME to measure a duration; use CLOCK_MONOTONIC (or MONOTONIC_RAW) for " +
      "anything computing an interval, and reserve CLOCK_REALTIME for timestamps meant to be " +
      "compared against external wall-clock time.",
    references: [
      "https://man7.org/linux/man-pages/man2/clock_gettime.2.html",
    ],
  },
  {
    id: "os-syscall-overhead-01",
    category: "os",
    difficulty: "hard",
    title: "Syscall transition cost under KPTI",
    tags: ["syscalls", "kpti", "mode-switch", "tlb"],
    type: "trace",
    prompt:
      "Both io_uring and the vDSO exist partly to avoid the same underlying cost: a plain " +
      "syscall's user-to-kernel mode transition. On a modern x86-64 Linux system with " +
      "Meltdown mitigations (KPTI, kernel page-table isolation) enabled, why is that " +
      "transition frequently significantly MORE expensive than 'just' the CPU switching " +
      "privilege rings, and how do io_uring and the vDSO each sidestep that specific extra " +
      "cost in a different way?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "KPTI costs nothing extra by itself; the overhead on patched kernels comes from the `syscall` instruction's microcode taking longer to retire on affected parts",
        "KPTI gives user and kernel mode separate page tables, so entry and exit reload CR3 and disturb the TLB; io_uring batches transitions, and the vDSO avoids them",
        "KPTI applies only to AMD parts, so the extra cost is AMD-specific and neither io_uring nor the vDSO does anything about it on Intel hardware",
        "The extra cost is the scheduler being consulted on every syscall return, which has nothing to do with page tables and long predates KPTI",
      ],
      correctIndex: 1,
    },
    explanation:
      "The baseline cost of a syscall (saving and restoring registers, validating arguments, " +
      "switching from ring 3 to ring 0 and back) was already the reason latency-sensitive " +
      "code tries to minimize syscall counts long before Meltdown. KPTI made that baseline " +
      "cost measurably worse on affected CPUs: to prevent user-mode code from using " +
      "speculative execution to read kernel memory that happened to be mapped (even if " +
      "inaccessible) in the same page tables, the kernel maintains largely separate page " +
      "tables for user mode and kernel mode, and a syscall entry/exit typically has to switch " +
      "between them by reloading CR3, an operation that, without PCID-tagged TLB entries to " +
      "soften it, flushes translations wholesale and forces expensive page-table walks on the " +
      "next accesses. Public benchmarking after KPTI's rollout found roughly 5% overhead for " +
      "typical workloads and up to the 15-30% range for syscall- or interrupt-heavy workloads " +
      "even with PCID optimizations engaged, with some database and interrupt-heavy workloads " +
      "measured at the higher end of that range. io_uring and the vDSO both reduce exposure " +
      "to this same cost, but via different mechanisms: io_uring doesn't eliminate the " +
      "user/kernel transition, it amortizes it: a single io_uring_enter() call (and its one " +
      "CR3 reload) can submit many queued operations and reap many completions at once, so " +
      "the fixed per-transition cost is paid once per batch rather than once per operation. " +
      "The vDSO instead avoids the transition altogether for the specific calls it can serve " +
      "entirely from a page of kernel-authored code and kernel-updated data already mapped " +
      "into the calling process. For a suitable clocksource, clock_gettime() never enters " +
      "the kernel at all, so there's no ring switch and no CR3 reload to pay for in the first " +
      "place. Same underlying cost, two different strategies: batch the expensive thing, or " +
      "avoid triggering it entirely.",
    references: [
      "https://en.wikipedia.org/wiki/Kernel_page-table_isolation",
      "https://lwn.net/Articles/741878/",
    ],
  },
  {
    id: "os-busy-poll-01",
    category: "os",
    difficulty: "hard",
    title: "Setting SO_BUSY_POLL on a market-data socket",
    tags: ["so_busy_poll", "networking", "epoll", "low-latency"],
    type: "trace",
    prompt:
      "A market-data feed handler currently blocks in epoll_wait() on its UDP socket. Under " +
      "load, p99 latency from 'packet arrives on the NIC' to 'application processes it' is " +
      "dominated by wakeup jitter rather than by the packet processing itself: the delay of an " +
      "interrupt, softirq, and scheduler wakeup pulling the blocked thread off a run queue. " +
      "The team sets SO_BUSY_POLL on the socket as shown. What does this actually change, " +
      "and what does it cost?",
    snippet: {
      language: "cpp",
      filename: "feed.cpp",
      code: `#include <sys/socket.h>
#include <cstdio>

void enable_busy_poll(int sockfd, int usecs) {
    if (setsockopt(sockfd, SOL_SOCKET, SO_BUSY_POLL, &usecs, sizeof(usecs)) != 0) {
        perror("setsockopt SO_BUSY_POLL");
    }
}

// enable_busy_poll(sockfd, 50); // busy-poll for up to 50us before blocking`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It raises the socket's priority within softirq processing, so its packets get dequeued ahead of other sockets' packets on each NAPI run",
        "It converts the socket to non-blocking mode permanently, so the application has to abandon epoll_wait() for a manual read() retry loop",
        "A blocking receive spins in the driver's NAPI poll for that many microseconds before sleeping, skipping the interrupt/softirq/wakeup path at real CPU cost",
        "It offloads that socket's packet processing into an eBPF program attached in the driver, taking recv() off the application's hot path entirely",
      ],
      correctIndex: 2,
    },
    explanation:
      "The normal receive path (NIC raises a hardware interrupt, the kernel runs a softirq " +
      "to pull the packet off the ring and queue it to the socket, then wakes the blocked " +
      "thread via the scheduler) is fast in aggregate but adds real, variable latency on the " +
      "critical path of any individual packet: interrupt coalescing, softirq scheduling " +
      "delay, and the scheduler actually placing the woken thread back on a CPU can each " +
      "contribute microseconds of jitter, which is exactly the kind of unpredictable tail " +
      "latency HFT/market-data systems try to eliminate. SO_BUSY_POLL, backed by the kernel's " +
      "NAPI busy-poll infrastructure, changes what a blocking receive call does: instead of " +
      "immediately sleeping, the calling thread repeatedly polls the network device driver " +
      "directly from process context, asking it to check for and pull in new packets, for " +
      "up to the configured number of microseconds, only falling back to a real blocking wait " +
      "if nothing arrived in that window. When a packet does show up during the poll window, " +
      "it can be handled without ever going through the interrupt/softirq/wakeup chain, which " +
      "is where the latency win comes from. This isn't free: the polling thread spins, " +
      "consuming a full CPU core (and correspondingly more power) for the polling duration " +
      "regardless of whether traffic actually arrives, which is the CPU-for-latency " +
      "trade the technique is named for. It also depends on driver support (the underlying " +
      "NIC driver must implement NAPI polling) and, per the socket(7) man page, increasing the " +
      "busy-poll duration beyond the system-wide default requires CAP_NET_ADMIN, so it isn't " +
      "something an unprivileged process can dial up arbitrarily. System-wide defaults for " +
      "select()/poll() busy-polling are separately configurable via " +
      "/proc/sys/net/core/busy_read and /proc/sys/net/core/busy_poll.",
    references: [
      "https://man7.org/linux/man-pages/man7/socket.7.html",
    ],
  },
  {
    id: "os-numa-first-touch-01",
    category: "os",
    difficulty: "hard",
    title: "A read-only warm-up pass and NUMA first-touch",
    tags: ["numa", "first-touch", "zero-page", "virtual-memory"],
    type: "trace",
    prompt:
      "Trying to work around NUMA locality problems, a team has each worker thread run a " +
      "'warm-up' pass that only READS its portion of a large calloc()'d buffer before the " +
      "real hot loop begins, believing this read pass will establish first-touch locality on " +
      "that worker's own NUMA node (each worker is pinned to a different node). In " +
      "production, workers still see the remote-NUMA-node access penalty in the hot loop, as " +
      "if the warm-up pass never happened. On a typical modern Linux kernel/x86-64, why " +
      "doesn't a read-only pass establish first-touch locality here?",
    snippet: {
      language: "cpp",
      filename: "warmup.cpp",
      code: `// Each worker thread, pinned to its own NUMA node, does this before the hot loop:
volatile int sink;
for (size_t i = start; i < end; i += page_size / sizeof(int)) {
    sink = buf[i]; // read-only "warm-up", believed to establish first-touch locality
}
// ... hot loop follows, reading and writing buf[start..end) ...`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "calloc() eagerly places every physical page on the allocating thread's node before any worker touches the buffer, so no warm-up pass could change placement",
        "Reads and writes trigger first-touch identically here; the real culprit is automatic NUMA balancing migrating the pages away between the warm-up and the hot loop",
        "Anonymous memory is interleaved round-robin across all nodes by default on a multi-socket system regardless of touch order, unless mbind() says otherwise",
        "An untouched anonymous page is mapped to the shared zero page, so reads never fault in a real frame; only a write triggers the allocation that binds a page to a node",
      ],
      correctIndex: 3,
    },
    explanation:
      "calloc() and anonymous mmap() both return zero-initialized memory, and the kernel " +
      "implements that zero-fill lazily and cheaply: rather than allocating and zeroing a " +
      "real physical frame for every page up front, it maps every page of the region to a " +
      "single shared, read-only, system-wide 'zero page.' Reading from such a page is " +
      "satisfied directly by that shared frame, with no page fault requiring the kernel " +
      "to decide anything about NUMA placement at all, because no real per-page frame is " +
      "being allocated. It's only when something WRITES to the page that the kernel must " +
      "actually give that page a private, real physical frame, and that is the fault that " +
      "consults the (default first-touch) NUMA policy and binds the new frame to whichever " +
      "node the writing thread is currently running on. A purely read-only 'warm-up' pass " +
      "therefore never triggers this allocation at all: every one of those reads quietly hits " +
      "the same shared zero page, no matter which node's thread performs it, and the buffer's " +
      "real per-page placement is only decided later, whenever each page first happens to be " +
      "written, which in the scenario here means whichever worker's hot loop gets to a given " +
      "page's first write, not necessarily the 'right' one for that region. The fix is for " +
      "each worker's warm-up pass to actually write to its portion of the buffer (even " +
      "writing back the value it just read is enough to force a real, node-local allocation), " +
      "or to bypass first-touch policy entirely with explicit placement via " +
      "numa_alloc_onnode()/mbind().",
    references: [
      "https://man7.org/linux/man-pages/man7/numa.7.html",
      "https://man7.org/linux/man-pages/man2/mmap.2.html",
    ],
  },
  {
    id: "os-vfork-01",
    category: "os",
    difficulty: "hard",
    title: "Mutating a variable between vfork() and exec()",
    tags: ["vfork", "fork", "exec", "undefined-behavior"],
    type: "trace",
    prompt:
      "Unlike fork(), vfork() does not copy the parent's address space or use " +
      "copy-on-write: the child runs using the parent's actual memory, and the parent is " +
      "suspended until the child calls exec() or _exit(). Here, the child writes to a global " +
      "variable before calling execl(). What does the parent print after it resumes?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <unistd.h>
#include <cstdio>

int global_counter = 100;

int main() {
    pid_t pid = vfork();
    if (pid == 0) {
        global_counter = 999;                 // child mutates a variable before exec
        execl("/bin/echo", "echo", "hi", nullptr);
        _exit(1);                              // only reached if execl() fails
    }
    printf("parent: global_counter = %d\\n", global_counter);
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "\"parent: global_counter = 100\", since vfork() sets up copy-on-write exactly as fork() does and the child's write stays private to the child",
        "Undefined behavior, though on a typical Linux system it prints \"parent: global_counter = 999\" with the child's write intact",
        "The program deadlocks: the parent is suspended waiting on the child while the child waits for the parent to release the shared address space",
        "The kernel faults on the write and hands the child a private copy of just that page, silently upgrading the mapping to copy-on-write from there on",
      ],
      correctIndex: 1,
    },
    explanation:
      "vfork()'s entire reason to exist is to skip the cost fork() normally pays, " +
      "duplicating page tables and setting up copy-on-write, for the extremely common case " +
      "where the child is about to immediately exec() into a different program and would " +
      "otherwise discard its copy of the address space seconds later anyway. It does this by " +
      "not copying anything at all: per the vfork() man page, 'the child process shares all " +
      "memory with its parent, including the stack,' and 'the calling thread is suspended " +
      "until the child terminates ... or it makes a call to execve().' Because there is only " +
      "one real copy of memory in play, a write the child makes to global_counter is not a " +
      "write to 'the child's copy' (there is no such thing), it is a write to the exact same " +
      "physical memory the parent will resume executing with. That's why global_counter reads " +
      "999 in the parent once it resumes: the mutation was never private to begin with. POSIX " +
      "nonetheless specifies this scenario as undefined behavior rather than a guarantee, " +
      "warning that the child must take care not to modify memory in unintended ways, since " +
      "any such changes will be seen by the parent once the child terminates or execs. The " +
      "standard leaves implementations free to satisfy vfork() by literally calling fork() " +
      "instead (some platforms do exactly this), in which case the same code would silently " +
      "print 100. Relying on the sharing behavior is therefore both dangerous (a single wrong " +
      "write in the child can corrupt the parent's live state, including its stack) and " +
      "non-portable, which is why vfork() is now considered a historical curiosity that " +
      "posix_spawn() (or plain fork()+exec() where the extra copy cost doesn't matter) should " +
      "replace in essentially all new code.",
    references: [
      "https://man7.org/linux/man-pages/man2/vfork.2.html",
      "https://man7.org/linux/man-pages/man3/posix_spawn.3.html",
    ],
  },
  {
    id: "os-cgroup-cpu-count-01",
    category: "os",
    difficulty: "medium",
    title: "Sizing a thread pool inside a container",
    tags: ["cgroups", "containers", "thread-pool", "hardware_concurrency"],
    type: "trace",
    prompt:
      "This service runs in a Docker container started with a CPU quota limiting it to 2 " +
      "cores' worth of CPU time (e.g. `docker run --cpus=2 ...`), on a host machine with 64 " +
      "physical cores. It sizes its thread pool directly off std::thread::hardware_concurrency() " +
      "at startup, as shown. What does hardware_concurrency() actually report here, and what " +
      "goes wrong for the thread pool as a result?",
    snippet: {
      language: "cpp",
      filename: "pool_init.cpp",
      code: `#include <thread>
#include <cstdio>

int main() {
    unsigned n = std::thread::hardware_concurrency();
    printf("sizing thread pool with %u threads\\n", n);
    // ThreadPool pool(n);  // naive: one worker thread per reported core
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It prints 64: a bandwidth quota caps CPU time, not visible topology or the affinity mask, so the pool over-provisions 64 workers into 2 cores' worth of budget",
        "It prints 2, because Docker's --cpus flag virtualizes /proc/cpuinfo and the process's affinity mask inside the container to match the configured quota",
        "It prints 0, since hardware_concurrency() returns 0 whenever it cannot determine an exact count, and a cgroup-limited environment always qualifies as indeterminate",
        "It prints 2, because libstdc++ consults cpu.max before falling back to sched_getaffinity(), making a modern toolchain cgroup-aware without any extra work",
      ],
      correctIndex: 0,
    },
    explanation:
      "std::thread::hardware_concurrency() is a thin wrapper over host-level CPU-topology " +
      "queries. On Linux this generally traces back to the same information nproc and " +
      "/proc/cpuinfo expose: the number of processors currently online, optionally narrowed by " +
      "the calling process's CPU affinity mask (sched_getaffinity()). Both of those are " +
      "orthogonal to a cgroup CPU *quota*: cpu.cfs_quota_us/cpu.cfs_period_us (what --cpus " +
      "configures under the hood) caps how much aggregate CPU *time* the cgroup's threads may " +
      "consume per scheduling period, throttling them once that budget is exhausted. It never " +
      "modifies which CPUs are listed as online or which CPUs the process's affinity mask " +
      "allows. Only the separate cpuset cgroup controller (what Docker's --cpuset-cpus flag " +
      "configures) actually narrows the affinity mask, which is the one thing that would cause " +
      "sched_getaffinity()-based counts to shrink. Absent that, a container throttled to 2 " +
      "cores' worth of time on a 64-core host still reports hardware_concurrency() == 64, " +
      "because from the affinity/topology point of view nothing has changed and only the " +
      "scheduling budget has. A thread pool naively sized off that number spins up 64 worker " +
      "threads all contending for a CPU budget equivalent to only 2 real cores: far more " +
      "runnable threads than the quota can service concurrently, which increases context-switch " +
      "overhead and makes the service far more likely to hit CFS bandwidth throttling within " +
      "any given period. This is a well-known real-world container gotcha (the same class of " +
      "issue that historically caused JVMs and other runtimes to badly over-provision thread " +
      "pools and GC threads inside containers before their tooling became cgroup-aware); the " +
      "fix is to size pools off the actual configured quota (cpu.cfs_quota_us / " +
      "cpu.cfs_period_us, or cpu.max on cgroup v2) rather than off host-topology queries, or to " +
      "rely on a runtime that has been made explicitly cgroup-aware.",
    references: [
      "https://man7.org/linux/man-pages/man7/cgroups.7.html",
      "https://man7.org/linux/man-pages/man2/sched_getaffinity.2.html",
      "https://docs.kernel.org/scheduler/sched-bwc.html",
    ],
  },
];
