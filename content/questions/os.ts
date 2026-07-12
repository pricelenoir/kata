import type { TraceQuestion } from "@/types/question";

export const osQuestions: TraceQuestion[] = [
  {
    id: "os-fork-count-01",
    category: "os",
    difficulty: "medium",
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
      "second `fork()`, turning 2 into 4. All 4 processes then reach the `printf`, each " +
      "printing once — 4 total. (Output ordering/interleaving is unspecified, but the count is fixed.)",
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
        "Segmentation fault immediately",
        "The OS silently zero-fills the page without any fault occurring",
        "A minor page fault occurs; the kernel transparently maps a physical frame and execution resumes",
        "Undefined behavior at the hardware level",
      ],
      correctIndex: 2,
    },
    explanation:
      "A valid-but-unmapped page (e.g. lazily-backed by mmap) triggers a *minor page fault* " +
      "on first touch. The CPU traps into the kernel, the page-fault handler allocates and " +
      "maps a physical frame (zero-filled for anonymous mappings), updates the page table, " +
      "and execution resumes at the faulting instruction — completely transparent to the " +
      "program. This is distinct from a segfault, which occurs when the address isn't valid " +
      "at all (not mapped in the process's address space in any form).",
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
        "No — exec() closes all open file descriptors as part of replacing the process image",
        "Yes — open file descriptors without FD_CLOEXEC remain open across exec() with the same fd number, since the descriptor table is preserved, not part of the replaced process image",
        "No — the fd number is preserved but its underlying file offset is reset to 0 and made unreadable",
        "It depends on whether child_prog itself calls fork() before reading",
      ],
      correctIndex: 1,
    },
    explanation:
      "exec() replaces the calling process's text, data, heap, and stack — the 'process " +
      "image' — with a new program, and resets the instruction pointer to that program's " +
      "entry point. The file descriptor table, however, is a separate kernel structure " +
      "attached to the process, not part of the image being replaced, so POSIX exec " +
      "semantics explicitly preserve it: fd 3 stays open, at the same file offset and " +
      "access mode, inside child_prog. The only descriptors closed automatically at exec " +
      "time are those explicitly marked FD_CLOEXEC. This is precisely the mechanism shells " +
      "rely on for redirection — fork(), dup2() the target onto the well-known fd, then " +
      "exec() — the child program simply inherits the already-redirected descriptor.",
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
        "Both print the same value: the child's PID",
        "The child prints 0; the parent prints the child's PID (a positive value)",
        "The child prints its own PID; the parent prints 0",
        "Both print -1, since fork() can only succeed once per process",
      ],
      correctIndex: 1,
    },
    explanation:
      "fork() returns twice — once in each process — with deliberately different return " +
      "values so a program can tell which one it's now running as. In the child, fork() " +
      "returns 0 (the child can still recover its own PID via getpid() if it needs the " +
      "actual number). In the parent, fork() returns the newly created child's PID, a " +
      "positive integer. A negative return (seen only by the caller, i.e. the parent — no " +
      "child was created) signals failure, e.g. EAGAIN from a resource limit or ENOMEM. " +
      "After this point the two processes have independent (copy-on-write) address spaces, " +
      "so nothing about `pid`'s storage is shared going forward.",
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
        "The virtual address space (heap, global/static data) and the open file descriptor table",
        "The stack and the saved CPU register / program-counter state",
        "The process ID (PID)",
        "The current working directory, but nothing involving memory",
      ],
      correctIndex: 0,
    },
    explanation:
      "POSIX threads created within one process share the process's actual address space " +
      "(code, heap, globals) and its file descriptor table — a write to a global by one " +
      "thread is instantly visible to all others, because there's only one mapping. What's " +
      "NOT shared per-thread is each thread's execution context: its own stack, its own " +
      "saved registers/program counter, thread-local storage, and signal mask. fork(), by " +
      "contrast, gives the child a logically independent address space (implemented " +
      "copy-on-write, so writes by one are invisible to the other) and its own file " +
      "descriptor table — though the duplicated descriptor entries initially reference the " +
      "same underlying open file descriptions, so the file offset stays linked between " +
      "parent and child for those fds until something makes them diverge. The core " +
      "distinction: threads share one live address space; forked processes each get their " +
      "own copy.",
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
        "A hardware timer interrupt fires, ending A's scheduling quantum",
        "A now-higher-priority process B transitions from blocked to ready",
        "A calls a blocking system call (e.g. read() on an empty pipe) and voluntarily gives up the CPU",
        "Process A allocates a large heap buffer with malloc()",
      ],
      correctIndex: 3,
    },
    explanation:
      "A context switch happens when the CPU stops running one thread/process and starts " +
      "another — saving/restoring register state and, for a process switch, swapping page " +
      "tables. That's triggered by: a timer interrupt ending a quantum (preemptive " +
      "time-slicing), an interrupt that wakes a higher-priority ready process (causing the " +
      "scheduler to preempt the current one), or the running process voluntarily blocking " +
      "(I/O wait, lock contention, explicit yield). Plain malloc() from the process's own " +
      "heap is ordinary userspace bookkeeping — at most it triggers a quick brk()/mmap() " +
      "syscall to extend the heap, which returns immediately rather than blocking, so it " +
      "doesn't by itself force a switch. The real cost of a switch — saving/restoring " +
      "registers, flushing or re-tagging the TLB, losing warm cache lines to the incoming " +
      "process's working set — is what makes frequent involuntary switching expensive.",
  },
  {
    id: "os-deadlock-07",
    category: "os",
    difficulty: "hard",
    title: "Two locks, opposite order",
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
        "It always deadlocks deterministically — the lock order guarantees it",
        "It always completes — std::mutex silently detects and avoids deadlock",
        "It's a race: it deadlocks whenever both threads acquire their first lock before either attempts its second (near-certain here given the 10ms sleep, but not guaranteed by the language)",
        "It never deadlocks because lock_guard uses try-lock semantics internally",
      ],
      correctIndex: 2,
    },
    explanation:
      "This is the classic lock-ordering (circular-wait) deadlock: thread1 holds A and " +
      "wants B, thread2 holds B and wants A. All four necessary conditions are present — " +
      "mutual exclusion (mutexes are exclusive), hold-and-wait (each thread holds one lock " +
      "while blocked on the other), no preemption (a std::mutex can't be forcibly taken " +
      "from its owner), and circular wait (A→B and B→A). The 10ms sleep after acquiring the " +
      "first lock makes it overwhelmingly likely both threads grab their first lock before " +
      "attempting the second, so in practice this deadlocks on virtually every run — but " +
      "strictly speaking nothing in the C++ standard guarantees that interleaving, so it is " +
      "technically a race rather than a deterministic guarantee. The fix is a consistent " +
      "global lock order (always A before B) or std::lock()/std::scoped_lock, which acquire " +
      "multiple mutexes atomically and avoid the partial-ownership window entirely.",
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
        "None — malloc() is thread-safe, so it's safe to call from any context, including signal handlers",
        "The handler's malloc()/free() can deadlock or corrupt the heap: if the interrupted malloc() held the allocator's internal lock, the handler's call re-enters that same lock/data structures on the same thread",
        "The program crashes immediately with SIGSEGV the moment the handler is entered",
        "malloc() detects it is running inside a signal handler and transparently falls back to a static buffer",
      ],
      correctIndex: 1,
    },
    explanation:
      "A signal handler runs asynchronously on the interrupted thread, potentially in the " +
      "middle of whatever that thread was doing — including mid-mutation of malloc()'s own " +
      "internal free-list/arena bookkeeping while holding its internal lock. malloc() is " +
      "thread-safe against concurrent calls from *other* threads, but it is not " +
      "async-signal-safe against a re-entrant call from a handler on the *same* thread: if " +
      "the allocator's lock is non-recursive, the handler's malloc() deadlocks instantly " +
      "(the thread tries to lock a mutex it already owns); if the lock is absent or " +
      "recursive, the handler can instead observe and corrupt half-updated heap metadata. " +
      "This is exactly why POSIX defines a short async-signal-safe function list (write(), " +
      "_exit(), sig_atomic_t access, etc.) that explicitly excludes malloc(), free(), and " +
      "printf(). The safe pattern is to do minimal work in the handler — set a " +
      "volatile sig_atomic_t flag or write() to a self-pipe — and defer real work to the " +
      "main loop.",
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
        "It resumes waiting transparently and returns normally once data arrives, as if nothing happened",
        "It returns -1 with errno set to EINTR, without waiting any further; the program must explicitly retry the call",
        "It returns 0, as if EOF had been reached on stdin",
        "The process is killed, because a signal interrupted a blocking system call",
      ],
      correctIndex: 1,
    },
    explanation:
      "When a blocking ('slow') system call such as read(), write(), or accept() is " +
      "interrupted by a caught signal, POSIX specifies that the call is aborted and returns " +
      "-1 with errno == EINTR once the handler returns — it does not silently resume on its " +
      "own. That's why robust code either wraps such calls in a retry-on-EINTR loop, or " +
      "registers the handler with sigaction()'s SA_RESTART flag, which tells the kernel to " +
      "transparently re-issue certain interrupted syscalls. Without SA_RESTART or manual " +
      "retry logic, this program prints 'read failed, errno=4' the instant the signal is " +
      "handled, even though the intended read of stdin never actually completed. Note that " +
      "SA_RESTART doesn't uniformly cover every interruptible call across platforms (some " +
      "always return EINTR regardless), so EINTR-handling loops remain standard defensive " +
      "practice.",
  },
  {
    id: "os-mmap-shared-10",
    category: "os",
    difficulty: "easy",
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
        "counter = 0 — the child's write only affects its own copy-on-write page",
        "counter = 42 — MAP_SHARED means the mapping's physical page is shared between parent and child, so the child's write is visible through the parent's mapping too",
        "Undefined — accessing memory across fork() without an explicit synchronization primitive is always undefined behavior",
        "The program crashes: MAP_ANONYMOUS regions cannot be inherited across fork()",
      ],
      correctIndex: 1,
    },
    explanation:
      "A MAP_SHARED mapping is backed by a shareable object — here, anonymous shared memory " +
      "— that multiple mappings can reference at once; fork() causes the child to inherit " +
      "that same mapping, so both processes' page tables ultimately point at the identical " +
      "physical page. A write through either mapping is immediately visible through the " +
      "other, with no copy-on-write involved — that's exactly what distinguishes " +
      "MAP_SHARED from MAP_PRIVATE (where the child would get its own COW copy on write, " +
      "and the parent would still see 0). Because wait() establishes a happens-before " +
      "relationship — the child fully exits before wait() returns in the parent — there's " +
      "no data race here, so 'counter = 42' is guaranteed, not just probable. This is the " +
      "standard lightweight technique for inter-process shared memory without a named " +
      "shm_open()/shmget() segment.",
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
        "All ~4MB is duplicated immediately at fork() time; parent prints 7",
        "None is duplicated at fork() time; only the single page (typically 4KB) containing big[0] gets physically copied, at the moment the child writes to it — parent prints 7",
        "Nothing is ever duplicated; the child's write also mutates the parent's memory — parent prints 99",
        "All ~4MB is duplicated lazily, but only once the parent itself next reads the vector — parent prints 7",
      ],
      correctIndex: 1,
    },
    explanation:
      "fork() duplicates the parent's page table — marking the shared pages read-only in " +
      "both processes — but not the underlying physical frames; both processes' page " +
      "tables initially point at the exact same RAM. Only when either process writes to a " +
      "shared page does the MMU raise a protection fault (the page is read-only despite the " +
      "process's actual mapping being read-write), which the kernel's copy-on-write fault " +
      "handler resolves by allocating a fresh physical frame, copying just that one " +
      "faulting page's contents into it, remapping the faulting process's PTE to the new " +
      "(now writable) frame, and resuming the instruction. So only the single page holding " +
      "big[0] — typically 4KB out of ~4MB — is ever physically copied; the remaining pages " +
      "stay shared until something else writes to them. Since the child's write landed on " +
      "its own now-private copy of that one page, the parent's original page is untouched " +
      "and big[0] still reads 7 there.",
  },
  {
    id: "os-tlb-flush-12",
    category: "os",
    difficulty: "hard",
    title: "TLB behavior across a context switch",
    tags: ["tlb", "context-switch", "virtual-memory"],
    type: "trace",
    prompt:
      "The scheduler context-switches from process A to process B — different address " +
      "spaces, and assume this CPU has no ASID/PCID-style tagging support. Immediately " +
      "after B resumes and touches a few pages it accessed recently, what happens?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "A's cached TLB entries are still valid and get reused for B's addresses, since virtual addresses are numerically the same",
        "The TLB must be flushed (or is logically invalidated) on the switch, because A's cached virtual-to-physical translations mean nothing for B's address space; B's first touches of those pages miss in the TLB and are walked from B's page tables again",
        "TLB entries are indexed by physical page, so they remain valid and correct regardless of which process is currently running",
        "The context switch cannot proceed until every physical page is evicted from RAM",
      ],
      correctIndex: 1,
    },
    explanation:
      "The TLB caches virtual-address-to-physical-frame translations, and a virtual address " +
      "is only meaningful relative to one particular process's page table — two processes " +
      "routinely reuse the identical virtual address for completely different physical " +
      "data. Without a hardware tag identifying which address space owns each TLB entry " +
      "(an ASID/PCID), the kernel must flush the entire TLB on every address-space-changing " +
      "switch; otherwise B could hit a stale translation left over from A and read/write " +
      "the wrong physical memory, breaking process isolation. Modern CPUs mitigate the cost " +
      "with ASID/PCID tagging, letting entries from multiple address spaces coexist in the " +
      "TLB without a full flush — but even then, B's *first* touch of a given page after " +
      "being switched back in still misses (either never cached under B's tag, or evicted " +
      "meanwhile), forcing a page-table walk to refill the entry. This TLB-refill cost is a " +
      "major reason switching between unrelated processes is more expensive than switching " +
      "between threads of the same process, which share one address space and thus one set " +
      "of valid TLB entries.",
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
        "Each process simply runs slightly slower, proportional to the memory overcommit ratio",
        "Thrashing: the system spends most of its time servicing page faults and swapping pages in/out rather than executing useful instructions, so throughput collapses even though the CPU looks busy",
        "The kernel refuses to schedule any process until enough physical memory is freed",
        "Nothing — demand paging guarantees performance depends only on how much memory is actually touched, not on how much is mapped",
      ],
      correctIndex: 1,
    },
    explanation:
      "Demand paging lets processes have virtual mappings far exceeding physical RAM, " +
      "backing pages in from disk only when touched — fine as long as each process's " +
      "actively-used pages (its working set) mostly fit in RAM at once. When the aggregate " +
      "working sets exceed physical memory, pages get evicted to make room, but those " +
      "evicted pages are needed again almost immediately, causing a fault, a disk read to " +
      "page them back in, evicting yet another needed page, and so on — this cycle is " +
      "thrashing. Because disk/swap latency is orders of magnitude higher than RAM access, " +
      "effective throughput collapses even though CPU utilization can look high (it's mostly " +
      "fault-handling and I/O-wait bookkeeping, not useful work). The classic fix is " +
      "reducing the multiprogramming level so each resident process's working set actually " +
      "fits, or adding physical memory.",
  },
  {
    id: "os-priority-inversion-14",
    category: "os",
    difficulty: "hard",
    title: "Priority inversion",
    tags: ["scheduling", "priority-inversion", "mutex"],
    type: "trace",
    prompt:
      "Three threads: L (low priority), M (medium priority), H (high priority). L acquires " +
      "a mutex and is working inside the critical section. H then becomes ready and blocks " +
      "trying to acquire that same mutex. Before L can finish and release it, M — which " +
      "never touches the mutex at all — becomes ready. On a strict priority-preemptive " +
      "scheduler with no mitigation, what happens?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "H runs immediately, since it has the highest priority, preempting both L and M",
        "M preempts L (M has higher priority than L) and runs until it finishes or blocks, before L ever runs again — so H, despite being the highest-priority thread, ends up waiting behind M even though M and H have no direct relationship",
        "L keeps running until it releases the mutex, since a thread inside a critical section cannot be preempted",
        "The scheduler detects the inversion and boosts H's priority directly, bypassing both L and M",
      ],
      correctIndex: 1,
    },
    explanation:
      "This is the classic unbounded priority inversion. H is logically blocked waiting for " +
      "L to release the mutex, but the scheduler has no notion of that dependency — it just " +
      "runs the highest-priority *runnable* thread. L is still runnable (executing the " +
      "critical section, not blocked), so once M becomes ready, M outranks L and preempts " +
      "it. Now H is stuck waiting on L, and L is stuck behind M, so effectively the " +
      "highest-priority thread H is blocked by a medium-priority thread M with no bound on " +
      "how long M might run — famously, this scenario stalled the Mars Pathfinder rover in " +
      "flight. The standard fixes are priority inheritance (temporarily boost L to H's " +
      "priority while L holds the contested resource, so M can no longer preempt it) or a " +
      "priority ceiling protocol.",
  },
  {
    id: "os-fd-cloexec-15",
    category: "os",
    difficulty: "medium",
    title: "close-on-exec and inherited file descriptors",
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
        "Yes — fork() and exec() both preserve all open file descriptors unconditionally",
        "No — FD_CLOEXEC tells the kernel to automatically close this specific descriptor at the moment of a successful exec(); it is still preserved across fork() itself, then closed only at exec time",
        "No — fork() already closed it before the child could exec",
        "Yes, but the descriptor becomes read-only in the child regardless of its original mode",
      ],
      correctIndex: 1,
    },
    explanation:
      "fork() duplicates the entire file descriptor table into the child, including the " +
      "FD_CLOEXEC flag on each entry — fork() itself never consults that flag. The flag " +
      "only takes effect at the next successful exec(): the kernel walks the descriptor " +
      "table and closes any entry marked FD_CLOEXEC as part of replacing the process image, " +
      "before the new program begins running. So the child does inherit and could still use " +
      "the descriptor right up until execl() succeeds, but once ls actually starts " +
      "executing, that fd is already closed and won't appear under /proc/self/fd. This is " +
      "the standard way to keep sensitive or unrelated descriptors from leaking into child " +
      "programs; O_CLOEXEC passed directly to open() achieves the same effect atomically, " +
      "avoiding a race where another thread forks between open() and a separate " +
      "fcntl(F_SETFD) call.",
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
        "It no longer exists — _exit() immediately and completely removes the process from the system",
        "It is a zombie: the process has terminated and released its resources (memory, fds), but its process-table entry (PID, exit status) is retained until the parent calls wait()/waitpid() to reap it",
        "It is suspended (stopped), waiting for the parent to resume it",
        "It becomes an orphan and is immediately re-parented to init",
      ],
      correctIndex: 1,
    },
    explanation:
      "When a process terminates, the kernel reclaims nearly all of its resources — memory, " +
      "open file descriptors — right away, but it can't fully discard the process-table " +
      "entry, because the parent may still retrieve the exit status via " +
      "wait()/waitpid()/wait4(). Until that happens, the entry persists in the 'zombie' (or " +
      "'defunct') state, visible in `ps` as `Z`, consuming only a process-table slot holding " +
      "essentially a PID and an exit-status record. Once the parent calls wait(), the " +
      "kernel delivers the status and the zombie entry is removed. If the parent instead " +
      "exits (or was never going to wait) before reaping, the child would become an " +
      "*orphan* and be re-parented to init (or a subreaper), which reaps it automatically — " +
      "orphan and zombie are distinct, orthogonal states, not the same thing.",
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
        "write() returns -1 with errno = EPIPE, and execution continues to the printf line",
        "The process is terminated by SIGPIPE before write() can return; the printf line never executes, since the default disposition of SIGPIPE is to terminate the process",
        "write() blocks forever, waiting for a reader that will never appear",
        "write() silently succeeds and returns 5, but the data is discarded",
      ],
      correctIndex: 1,
    },
    explanation:
      "Writing to a pipe (or socket) with no remaining readers is a well-defined error " +
      "condition, but the kernel's default handling is to first deliver SIGPIPE to the " +
      "writing thread. SIGPIPE's default disposition (SIG_DFL) is to terminate the process, " +
      "so unless the program has explicitly ignored it (signal(SIGPIPE, SIG_IGN)) or " +
      "installed a handler, the process dies right there — write() never actually returns, " +
      "and 'write returned ...' is never printed. If SIGPIPE is ignored or handled, write() " +
      "instead returns -1 with errno == EPIPE, letting the program handle the error " +
      "programmatically. This default is exactly why network servers almost universally " +
      "call signal(SIGPIPE, SIG_IGN) at startup — otherwise a client disconnecting mid-write " +
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
      "some work. Thread T2 — which never called sem_wait() — then calls sem_post() on that " +
      "same semaphore. Compare this to a std::mutex: could T2 legally call unlock() on a " +
      "mutex that T1 locked?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both are legal: neither semaphores nor mutexes have a notion of ownership, so any thread can release either",
        "Semaphore: legal — sem_post() has no concept of ownership, so any thread may increment the count. Mutex: illegal/undefined behavior — a mutex is owned by the thread that locked it, and unlocking from a different thread violates that contract",
        "Both are illegal — synchronization primitives always require the acquiring thread to be the one that releases",
        "Semaphore: illegal — only the thread that decremented may increment it. Mutex: legal — any thread may unlock it",
      ],
      correctIndex: 1,
    },
    explanation:
      "A counting semaphore is fundamentally an atomic integer with blocking semantics: " +
      "sem_wait() decrements it (blocking if it would go below zero), sem_post() increments " +
      "it — neither the kernel nor the library tracks which thread performed which " +
      "operation, so having T1 wait and T2 post is not just legal but a common, idiomatic " +
      "pattern (e.g. producer/consumer signaling or a completion handoff). A mutex, in " +
      "contrast, models exclusive *ownership*: pthread_mutex_unlock() (and std::mutex, " +
      "which specifies this contract explicitly) is undefined behavior when called by a " +
      "thread that doesn't currently hold the lock, because the mutex's internal state — " +
      "and, for priority-inheritance-capable mutexes, its priority-boosting bookkeeping — " +
      "is tied to the specific owning thread. This is exactly why semaphores are the right " +
      "tool for cross-thread signaling, while mutexes are the right tool for protecting a " +
      "critical section that a single thread enters and exits.",
  },
  {
    id: "os-numa-19",
    category: "os",
    difficulty: "hard",
    title: "First-touch and remote NUMA latency",
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
        "NUMA only affects which socket's memory controller performs the initial allocation; steady-state access latency is identical from either socket",
        "The Linux default first-touch policy bound the array's physical pages to socket 1's local DRAM at the moment the setup thread wrote them; every access from the worker on socket 0 now crosses the inter-socket interconnect and pays remote-access latency, and this does not reliably self-correct — the kernel does not eagerly migrate hot pages, only an opt-in background mechanism (automatic NUMA balancing) may slowly move them, so the fix is to explicitly place the pages correctly (e.g. numa_alloc_onnode()/mbind(), or simply doing the first touch from the worker's own socket after affinity is set)",
        "The OS immediately migrates every page to socket 0 the instant the worker's first access is detected, so latency is only elevated for the very first read",
        "Latency is identical because both sockets share a single unified memory controller in any dual-socket x86 system",
      ],
      correctIndex: 1,
    },
    explanation:
      "Linux's default NUMA memory policy is first-touch: a page is physically backed on " +
      "whichever NUMA node the thread doing the first write (the page fault that allocates a " +
      "frame) is running on — not the node that will use it most, and not the node that " +
      "called malloc(). Here that was socket 1, so the array's physical frames live in " +
      "socket 1's local DRAM. Every subsequent access from the worker on socket 0 has to " +
      "traverse the inter-socket interconnect (e.g. UPI/Infinity Fabric) to reach that " +
      "memory controller, incurring meaningfully higher latency and lower bandwidth than a " +
      "local access — routinely 1.5-2x+ worse, and more under contention. Linux does not " +
      "eagerly correct this: pages stay put unless something explicitly migrates them, " +
      "though the optional 'automatic NUMA balancing' feature can slowly sample and migrate " +
      "hot pages toward the accessing node over many seconds — a heuristic background process, " +
      "not an immediate fix. The reliable remedies are to control placement explicitly " +
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
        "THP is a purely hardware feature; software configuration cannot cause stalls, so the cause must be unrelated to huge pages",
        "The kernel's khugepaged (and the allocation-path 'always' policy itself) opportunistically collapses runs of small pages into 2MB huge pages, which can require synchronous memory compaction/defragmentation to free up a contiguous 2MB physical region right when a fault occurs — this can block the faulting thread for milliseconds; hugetlbfs pages are instead reserved from a fixed, pre-allocated pool at startup, so no compaction ever happens on the hot path",
        "THP causes stalls only when swap is completely disabled system-wide, and hugetlbfs sidesteps this purely because it disables swap for the whole machine",
        "Huge pages require twice as many page-table levels to walk on a TLB miss, and that extra walk is what causes the multi-millisecond stalls",
      ],
      correctIndex: 1,
      },
    explanation:
      "Huge pages (2MB or 1GB instead of the standard 4KB) reduce TLB pressure by covering " +
      "far more address space per entry, cutting TLB miss rates for large working sets. THP " +
      "gets this transparently by having khugepaged scan memory in the background and " +
      "promote eligible regions, and with the 'always' policy the allocation path itself " +
      "will try to satisfy a fault with a huge page immediately. The catch is that a " +
      "contiguous 2MB physical region is much harder to find once memory has been running " +
      "and fragmenting for a while, so the kernel may trigger synchronous compaction — " +
      "moving other pages around to assemble the needed contiguous block — directly on the " +
      "faulting thread's path, which is exactly the kind of unpredictable multi-millisecond " +
      "stall that shows up with no correlation to application-level events. hugetlbfs " +
      "sidesteps this entirely: its pages are carved out of a fixed pool reserved at boot or " +
      "startup time (via /proc/sys/vm/nr_hugepages or similar), so allocating one at runtime " +
      "is just taking a pre-existing free page off a list — no compaction, no scanning, no " +
      "surprise latency, at the cost of needing to size and reserve that pool in advance. " +
      "Many latency-sensitive systems set THP to 'madvise' (opt-in per-region) or disable it " +
      "outright, using hugetlbfs explicitly instead.",
  },
  {
    id: "os-io-uring-21",
    category: "os",
    difficulty: "medium",
    title: "Why io_uring beats one syscall per I/O",
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
        "io_uring spawns a kernel thread per request that runs the read in parallel, while pread() is inherently sequential",
        "io_uring gives the application a submission queue (SQ) and completion queue (CQ) — ring buffers memory-mapped into both user and kernel space — so many I/O requests can be placed and many completions reaped per io_uring_enter() call (and, with SQPOLL, even without calling it at all), versus pread()'s one syscall — and one user/kernel mode transition — per single operation",
        "io_uring is faster purely because it bypasses the page cache, which pread() cannot do",
        "io_uring is faster only because it always uses non-blocking file descriptors internally, and pread() cannot be made non-blocking",
      ],
      correctIndex: 1,
    },
    explanation:
      "Each pread() is a full syscall: a mode switch into the kernel, argument validation, " +
      "the actual work, and a switch back — for 10,000 tiny reads, that per-call fixed cost " +
      "(easily hundreds of nanoseconds, more with mitigations like meltdown/spectre " +
      "isolation enabled) dominates. io_uring restructures the interface around two shared " +
      "ring buffers: the application writes submission queue entries (SQEs) describing " +
      "requested operations, and the kernel writes completion queue entries (CQEs) when " +
      "they finish — both buffers are mapped into the process's address space, so producing " +
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
    title: "clock_gettime() without a syscall",
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
        "The compiler hoists the call out of the loop entirely since its result is never meaningfully used",
        "glibc resolves clock_gettime() through the vDSO — a small page of kernel-authored code that the kernel maps read-only into every process's address space — which, for a suitable clocksource (e.g. an invariant TSC), computes the current time directly in userspace from a kernel-updated, seqlock-protected shared data region, without ever trapping into the kernel",
        "strace specifically cannot instrument clock_gettime due to how it's registered as a vsyscall, so the syscalls are happening but invisible",
        "clock_gettime() is replaced at link time with a single hardware RDTSC instruction and involves no kernel-provided data whatsoever",
      ],
      correctIndex: 1,
    },
    explanation:
      "A plain syscall requires trapping into kernel mode — a relatively expensive mode " +
      "switch — which is wasteful for something as frequent and simple as reading the " +
      "current time. The vDSO (virtual dynamic shared object) is a small chunk of kernel " +
      "code mapped into every process's address space at exec time; glibc's clock_gettime() " +
      "wrapper calls into this mapped code first rather than issuing `syscall` directly. For " +
      "clock sources that are cheaply and consistently readable from userspace (typically an " +
      "invariant, synchronized TSC), the vDSO implementation reads a small shared data " +
      "structure that the kernel updates periodically (protected by a seqlock so readers " +
      "never observe a torn update) and combines it with a TSC read to compute the current " +
      "time entirely in userspace — no trap, no mode switch. If the configured clocksource " +
      "isn't usable this way (e.g. certain virtualized or HPET-based setups), the vDSO falls " +
      "back to issuing the real syscall, so the optimization is conditional on hardware/clock " +
      "source, not guaranteed.",
  },
  {
    id: "os-rcu-23",
    category: "os",
    difficulty: "hard",
    title: "RCU: readers never block, writers wait for a grace period",
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
        "rcu_read_lock() internally acquires a spinlock, which blocks the writer's removal until the reader's critical section ends",
        "The writer atomically republishes the pointer to skip the old node (so no reader can ever see a torn/partially-updated link), then defers actually freeing the old node until synchronize_rcu() returns; synchronize_rcu() blocks the writer until every CPU has passed through a quiescent state, which guarantees no reader could still be holding a reference obtained before the unlink — only then is it safe to free",
        "RCU is implemented as reference counting under the hood: kfree() is deferred automatically until every outstanding reader's reference count on that node drops to zero",
        "Readers are required to re-check a global version counter before every dereference inside the critical section, and the read aborts if it's stale",
      ],
      correctIndex: 1,
    },
    explanation:
      "RCU's defining property is that readers never block and never take a lock against " +
      "writers — rcu_read_lock()/rcu_read_unlock() are typically just preemption-disabling " +
      "or even pure compiler barriers, not synchronization primitives in the mutual-exclusion " +
      "sense. A writer removing a node does so by atomically updating the pointer that " +
      "referenced it to instead point past it (a single-word write is inherently atomic, so " +
      "concurrent readers see either the old link or the new one, never a torn value) — " +
      "readers already mid-traversal that grabbed the old pointer before the update are still " +
      "entitled to keep using it. The writer cannot free the old node immediately, though, " +
      "because such a reader might still be using it; instead it calls synchronize_rcu(), " +
      "which blocks until the kernel can prove every CPU has passed through a 'quiescent " +
      "state' (a point guaranteed to be outside any read-side critical section) at least " +
      "once — this defines the 'grace period.' Once that's confirmed, no pre-existing reader " +
      "can possibly still hold the old pointer, so kfree() is safe. The overall pattern — " +
      "readers pay almost nothing, writers pay the cost of waiting and copying — is why RCU " +
      "shines for read-mostly kernel structures like routing tables.",
  },
  {
    id: "os-futex-24",
    category: "os",
    difficulty: "hard",
    title: "Why uncontended std::mutex::lock() doesn't enter the kernel",
    tags: ["futex", "mutex", "synchronization"],
    type: "trace",
    prompt:
      "On Linux, calling std::mutex::lock() on an uncontended mutex almost never shows up as " +
      "a syscall in strace, but under contention it does. What mechanism explains this, and " +
      "why is it faster than a mutex implemented as a plain kernel object?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "std::mutex always makes a syscall; the uncontended case merely looks fast because that particular syscall happens to be cheap on Linux",
        "futex ('fast userspace mutex') lets the common uncontended path be a single userspace atomic compare-and-swap on a shared integer, transitioning it from unlocked to locked with no kernel involvement at all; only when the CAS detects the lock is already held does the thread make the futex(FUTEX_WAIT) syscall to actually sleep, and the unlocking thread only issues FUTEX_WAKE if the lock's state indicates there are waiters — so the kernel is invoked solely for the blocking/waking itself",
        "futex is a purely userspace spinlock construct; the kernel is never involved under any circumstances, even with a thread blocked indefinitely",
        "futex refers to a special lock-prefixed CPU instruction that replaces the need for any mutex data structure, implemented entirely by the MMU",
      ],
      correctIndex: 1,
    },
    explanation:
      "A futex is not a full kernel object like a System V semaphore — it's a userspace " +
      "integer plus a thin kernel-provided waiting/waking mechanism keyed off that integer's " +
      "address. The classic design (as used by glibc/libstdc++'s std::mutex on Linux) encodes " +
      "state directly in the word: e.g. 0 = unlocked, 1 = locked with no waiters, 2 = locked " +
      "with waiters. lock() first attempts an atomic compare-and-swap from 0 to 1 entirely in " +
      "userspace — if that succeeds, the function returns having never touched the kernel at " +
      "all, which is why the fast, uncontended path is essentially free. Only if the CAS " +
      "fails (someone else holds it) does the thread transition the word to 2 and call the " +
      "futex(FUTEX_WAIT, ...) syscall, which atomically checks the value is still what's " +
      "expected and puts the thread to sleep on a kernel wait queue keyed by that memory " +
      "address — avoiding the classic missed-wakeup race. unlock() similarly does an atomic " +
      "decrement/exchange and only calls futex(FUTEX_WAKE, ...) if the word indicated waiters " +
      "were present, skipping the syscall entirely for the uncontended unlock. The net effect: " +
      "the kernel is involved only for the actually-necessary blocking and waking, not for " +
      "every acquire/release, which is what makes futex-based mutexes dramatically cheaper " +
      "than syscall-per-operation designs under low contention.",
  },
  {
    id: "os-namespaces-25",
    category: "os",
    difficulty: "medium",
    title: "What a PID namespace does and doesn't isolate",
    tags: ["namespaces", "containers", "isolation"],
    type: "trace",
    prompt:
      "A colleague claims that putting a process in its own PID namespace (so it sees " +
      "itself as PID 1, with no visibility into host process IDs) is, by itself, sufficient " +
      "to prevent that process from accessing or affecting the host system — no other " +
      "namespaces or restrictions are needed. Is this claim correct?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes — a PID namespace fully isolates a process from the entire host, including its filesystem and privileges",
        "No — a PID namespace only isolates process-ID numbering/visibility and signal-delivery scoping within that hierarchy; on its own the process still sees the host's real filesystem (no mount namespace was created), and if it's running as root, it's still the genuine root UID 0 on the host (no user namespace remapping it), so file permissions, capabilities, and most privileged operations are entirely uncontained — this is exactly the misconception behind many container-escape writeups",
        "No — PID namespaces are a purely cgroups-v2 concept and don't actually restrict process visibility at all",
        "Yes, but only as long as the process never calls fork() again inside the namespace",
      ],
      correctIndex: 1,
    },
    explanation:
      "Linux namespaces are independent, composable isolation primitives — pid, mnt, net, " +
      "uts, ipc, user, cgroup, time — and a 'container' is really just a process launched " +
      "with some chosen subset of them (plus cgroups for resource limits and often seccomp/" +
      "capabilities for further restriction). A PID namespace by itself changes only what " +
      "process IDs look like and which processes can be seen/signaled: the isolated process " +
      "becomes PID 1 in its own hierarchy and cannot see or signal host processes outside it " +
      "— but that says nothing about the filesystem (still the host's, absent a separate " +
      "mount namespace and a chroot/pivot_root), the network (still the host's interfaces, " +
      "absent a net namespace), or privilege (absent a user namespace, a root process inside " +
      "the 'container' is genuinely UID 0 on the host, with real root capabilities against " +
      "anything it can reach — e.g. host device nodes, procfs entries, or any shared mount). " +
      "This exact gap — assuming namespace isolation implies privilege isolation — underlies " +
      "many real container-escape techniques, which is why production container runtimes " +
      "combine PID/mount/net namespaces with a user namespace (UID remapping) and capability " +
      "dropping, not PID isolation alone.",
  },
  {
    id: "os-plt-got-26",
    category: "os",
    difficulty: "medium",
    title: "Lazy binding: why the first call to a shared-library function is slower",
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
        "Neither — the dynamic linker resolves every external symbol at process startup, before main() runs, regardless of binding mode",
        "The first call: it jumps through a small PLT (Procedure Linkage Table) stub whose GOT (Global Offset Table) entry initially points back into the dynamic linker's resolver, which looks up sqrt's real address in libm's symbol table and patches the GOT entry in place; the second call goes through the identical PLT stub but now the GOT entry already holds the resolved address, so it jumps straight there with no resolver involved",
        "The first call triggers a page fault to load libm.so's code pages into memory from disk, which is unrelated to symbol resolution and would happen even with eager binding",
        "The second call is slower, because the CPU's branch predictor has no history for the PLT stub on the first call and mispredicts on the second",
      ],
      correctIndex: 1,
    },
    explanation:
      "With the default lazy-binding scheme (as opposed to linking with -Wl,-z,now / a " +
      "binary built with full RELRO), calls to external functions compile to a jump through " +
      "a per-function PLT stub rather than a direct call to the function's final address, " +
      "because that address isn't known until the dynamic linker has actually loaded and " +
      "resolved it. Each PLT stub jumps indirectly through its corresponding GOT slot; " +
      "initially that slot doesn't hold sqrt's real address — it holds the address of a " +
      "small trampoline back into the dynamic linker's resolver. The very first call " +
      "therefore detours through the resolver, which walks libm's dynamic symbol table to " +
      "find sqrt, and then patches the GOT slot in place with the now-known real address " +
      "before jumping to it. Every subsequent call still goes through the same PLT stub, but " +
      "the GOT slot now holds the real address directly, so it jumps straight to sqrt() with " +
      "no resolver detour — hence the first call carries a one-time symbol-resolution cost " +
      "that later calls don't pay. This is why profiling a program's very first calls into a " +
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
        "Identical addresses on both runs — ASLR randomizes only shared library load addresses, never the stack or heap of the main binary",
        "Different addresses on both runs, for both the stack and the heap pointer — the kernel independently re-randomizes the process's stack region, the heap/mmap base, and (because this binary is PIE) the executable's own load base at every exec(), each drawn fresh from a per-exec random offset",
        "The heap address differs between runs but the stack address is always identical, since stack size and placement are fixed by ulimit regardless of ASLR",
        "Identical, because ASLR derives its entropy from a hash of the binary's contents, which are the same on both runs",
      ],
      correctIndex: 1,
    },
    explanation:
      "ASLR works by adding a fresh random offset, chosen at each exec(), to the base of " +
      "several distinct regions: the stack, the mmap/shared-library region (which also " +
      "hosts a PIE binary's own load base), and typically the heap's starting offset " +
      "relative to the program break. Because this program is compiled as PIE (the distro " +
      "default), even the executable's own code and the stack/heap addresses printed here " +
      "move between runs — a non-PIE binary would instead load its own code/data at a fixed " +
      "link-time address every time, with only the stack, heap, and any shared libraries " +
      "still randomized. Because ASLR only randomizes each region's *base*, not the layout " +
      "within it, this has an important practical consequence: a single information leak — " +
      "e.g. a format-string bug or an out-of-bounds read that discloses one live pointer into " +
      "the stack, heap, or a shared library — reveals that entire region's base, since every " +
      "other address within it sits at a fixed, statically-known offset from that one leaked " +
      "pointer. This is exactly how real-world exploits routinely defeat ASLR without brute " +
      "force: leak one address, derive the rest.",
  },
  {
    id: "os-stack-canary-28",
    category: "os",
    difficulty: "hard",
    title: "Stack canary detection on a buffer overflow",
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
    strcpy(buf, input); // no bounds check — input is 63 bytes
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
        "Prints \"buf = AAAA...A\" (all 63 A's) and returns normally — the overflow harmlessly overwrites unused stack space beyond buf",
        "The overflow overwrites the stack canary that the compiler placed between buf and the saved return address; when vulnerable() reaches its epilogue, it compares the canary against the known cookie, detects the mismatch, and calls __stack_chk_fail(), aborting the program (typically reported as \"stack smashing detected\") before the corrupted return address is ever used to return",
        "The overflow directly corrupts the saved return address, so the CPU jumps to attacker-controlled memory the instant strcpy() returns, causing an immediate SIGSEGV inside vulnerable() itself",
        "The compiler's stack-protector rejects the strcpy() call at compile time, since buf's fixed size is known statically",
      ],
      correctIndex: 1,
    },
    explanation:
      "With stack-protector enabled, the compiler inserts a random 'canary' value into the " +
      "stack frame between local buffers and the saved return address/frame pointer, and " +
      "emits a check of that canary against the known value in the function's epilogue, " +
      "right before the function actually returns. Because buf sits below the canary in " +
      "memory and the overflow writes upward through consecutive addresses, the 47 extra " +
      "bytes here overwrite the canary before they'd ever reach the return address — the " +
      "canary is deliberately positioned as a trip-wire in between. The check happens only " +
      "at return time, though, not the instant the overflow occurs — the corruption already " +
      "happened during strcpy(), and the printf() with the now-garbled buf still executes; " +
      "it's only when vulnerable() is about to return that the mismatch is caught and " +
      "__stack_chk_fail() aborts the process, preventing the corrupted return address from " +
      "ever being used. This is a fundamentally different mechanism from a guard page, which " +
      "protects against stack *exhaustion* (e.g. unbounded recursion growing the stack " +
      "pointer past its allotted region) by mapping an inaccessible page just beyond the " +
      "stack, so growing into it raises an immediate hardware SIGSEGV — canaries detect " +
      "in-frame buffer overflows at return time, guard pages detect stack-region overrun at " +
      "the moment of the offending access.",
  },
  {
    id: "os-overcommit-oom-29",
    category: "os",
    difficulty: "hard",
    title: "Overcommitted malloc() and the OOM killer",
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
        "\"malloc failed\" is printed — the kernel checks available memory upfront under overcommit_memory=0 and malloc() returns NULL for a request it can't back",
        "\"malloc succeeded...\" is printed, because the allocation only reserves virtual address space (no physical memory is committed yet); partway through memset(), once physical pages actually backing the writes exhaust available memory, the kernel's OOM killer selects a victim process using a heuristic badness/oom_score (based on RSS, swap usage, and oom_score_adj) and sends it SIGKILL — the victim isn't necessarily this process, but if it is, \"memset complete\" is never printed",
        "Both lines print successfully — Linux transparently compresses or deduplicates memory pages under pressure, so the full 1GB always ends up backed",
        "The memset() call blocks indefinitely waiting for memory to be freed elsewhere, rather than ever invoking the OOM killer",
      ],
      correctIndex: 1,
    },
    explanation:
      "malloc()'s underlying mmap()/brk() call, under the default heuristic overcommit " +
      "policy (mode 0), reserves virtual address space and typically succeeds even for " +
      "requests that exceed currently-free memory, because the kernel doesn't know how much " +
      "of that space will actually be touched — most large allocations are sparsely used. " +
      "No physical frame is actually committed until each page is first written, via ordinary " +
      "demand paging. As memset() strides through the full gigabyte, physical pages get " +
      "allocated page-by-page; once genuine system-wide memory pressure hits the point where " +
      "no more pages can be found (even after reclaim and swapping), the kernel invokes the " +
      "OOM killer, which computes a badness score for candidate processes (roughly, memory " +
      "footprint adjusted by /proc/[pid]/oom_score_adj, with protections for things like " +
      "init) and SIGKILLs whichever process scores worst — which is often, but not " +
      "necessarily, the process whose allocation triggered the shortage. This is precisely " +
      "why a successful malloc() return is not, by itself, a guarantee that the memory can " +
      "actually be used without risking termination; the other overcommit modes trade this " +
      "off differently — mode 1 always overcommits, mode 2 refuses any allocation that would " +
      "exceed swap plus a configured fraction of RAM, trading OOM-kill risk for more " +
      "eager malloc() failures.",
  },
  {
    id: "os-page-cache-fsync-30",
    category: "os",
    difficulty: "easy",
    title: "write() success versus durability on disk",
    tags: ["page-cache", "fsync", "durability"],
    type: "trace",
    prompt:
      "write() returns 13 (success) as shown. The machine loses power at the point marked " +
      "in the comment — after write() returns but before fsync() or close() runs. Is " +
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
    // -- power loss here, before fsync() or close() --
    close(fd);
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes — a successful write() return means the kernel has already flushed the data to the physical disk",
        "No — write() on a regular file (without O_DIRECT/O_SYNC) only guarantees the data has been copied into the kernel's page cache and marked dirty; it's written back to the physical device asynchronously later, driven by periodic writeback timers, memory pressure, or an explicit fsync()/fdatasync() call, so a power loss before that writeback happens can lose the data even though write() reported success",
        "No — write() never actually copies the data anywhere in the kernel until close() is called, so it's lost regardless of power loss timing",
        "Yes, but only because the write is smaller than one filesystem block",
      ],
      correctIndex: 1,
    },
    explanation:
      "A successful write() to a regular file (absent O_DIRECT or O_SYNC/O_DSYNC) only " +
      "promises that the bytes have been copied into the kernel's page cache and the " +
      "corresponding pages marked dirty — it says nothing about when, or whether yet, those " +
      "pages reach the physical device. The kernel writes dirty pages back on its own " +
      "schedule: periodic writeback daemons flush pages older than a threshold, memory " +
      "pressure can force earlier writeback, and an application can force it immediately by " +
      "calling fsync() (which flushes both data and metadata for the fd and blocks until the " +
      "device confirms the write, to the extent the device's own caching is honest about " +
      "that) or the lighter fdatasync() (skips metadata not needed to read the data back, " +
      "e.g. mtime updates). This buffering is precisely what makes ordinary write() fast — " +
      "it's a memory copy, not a disk operation — but it also means a crash between write() " +
      "and the next writeback (whether triggered by the kernel's own timers or an explicit " +
      "fsync()) loses whatever hadn't yet been flushed. This is why databases and other " +
      "durability-sensitive software always call fsync() (or use O_DIRECT/O_SYNC) at " +
      "points where they need an actual persistence guarantee, rather than trusting write()'s " +
      "return value.",
  },
];
