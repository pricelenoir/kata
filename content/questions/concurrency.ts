import type { TraceQuestion } from "@/types/question";

export const concurrencyQuestions: TraceQuestion[] = [
  {
    id: "concurrency-relaxed-ordering-01",
    category: "concurrency",
    difficulty: "medium",
    title: "Relaxed store and load around a non-atomic payload",
    tags: ["atomics", "memory-order", "data-race"],
    type: "trace",
    prompt: "What can this program print (or do)?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::atomic<bool> ready{false};
int data = 0;

void producer() {
    data = 42;
    ready.store(true, std::memory_order_relaxed);
}

void consumer() {
    while (!ready.load(std::memory_order_relaxed)) {}
    std::cout << data << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Always prints 42.",
        "Prints 0 or 42 nondeterministically, but the program is well defined.",
        "Compile error: `data` must be atomic to be read from another thread.",
        "Undefined behavior: the read of `data` is a data race.",
      ],
      correctIndex: 3,
    },
    explanation:
      "`memory_order_relaxed` guarantees atomicity of the `ready` operations but establishes " +
      "no *synchronizes-with* relationship between the store in `producer` and the load in " +
      "`consumer`. So even after `consumer` observes `ready == true`, nothing guarantees it " +
      "sees `producer`'s write to the plain (non-atomic) `data`. The two accesses to `data` " +
      "are therefore conflicting, unordered by happens-before, and at least one is a write: " +
      "that is the standard's definition of a data race in [intro.races], which is undefined " +
      "behavior rather than merely a stale read. On x86 it will usually print 42 anyway, which " +
      "is what makes the bug survive testing. The fix is `memory_order_release` on the store " +
      "and `memory_order_acquire` on the load (or seq_cst on both), which establishes " +
      "happens-before and guarantees 42 is always observed.",
    references: [
      "https://en.cppreference.com/w/cpp/atomic/memory_order",
    ],
  },
  {
    id: "concurrency-false-sharing-02",
    category: "concurrency",
    difficulty: "medium",
    title: "Two atomic counters on the same cache line",
    tags: ["cache-coherence", "false-sharing", "performance"],
    type: "trace",
    prompt:
      "Thread 1 increments `c.a` 100M times; Thread 2 concurrently increments `c.b` 100M " +
      "times. `a` and `b` are ~8 bytes apart, well within a typical 64-byte cache line. " +
      "What is the most accurate prediction?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Counters {
    std::atomic<long> a{0};
    std::atomic<long> b{0};
};
Counters c;

// Thread 1: for (...) c.a.fetch_add(1, std::memory_order_relaxed);
// Thread 2: for (...) c.b.fetch_add(1, std::memory_order_relaxed);`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "A data race on `a` and `b` leaves both final counts undefined.",
        "Both counters end up correct, and throughput matches the same code with each counter padded onto its own cache line.",
        "Both counters end up correct, but throughput is far below the same code with each counter padded onto its own cache line.",
        "Both counters end up correct, and `memory_order_relaxed` already avoids the coherence traffic that padding would.",
      ],
      correctIndex: 2,
    },
    explanation:
      "Each `fetch_add` is individually atomic and operates on its own object, so there is no " +
      "race and no UB, and both final values are exactly 100M. The problem is purely " +
      'performance: `a` and `b` land on the same cache line, so every write by one core ' +
      "invalidates that line in the other core's cache (coherence ping-pong), even though the " +
      "threads never touch the same logical variable. `memory_order_relaxed` does not help " +
      "here either: relaxed controls ordering between operations, not whether the write is " +
      "made coherent, and an RMW still has to acquire the line in an exclusive state. " +
      "The fix is to pad or align each counter onto its own cache line, e.g. " +
      "`alignas(64) std::atomic<long> a;`, or to use " +
      "`std::hardware_destructive_interference_size` where the implementation provides it.",
  },
  {
    id: "concurrency-seq-cst-vs-relaxed-03",
    category: "concurrency",
    difficulty: "hard",
    title: "Two seq_cst store/load pairs across two threads",
    tags: ["atomics", "memory-order", "seq-cst"],
    type: "trace",
    prompt:
      "x and y start at 0. threadA and threadB run concurrently as shown, then " +
      "the program joins both and prints r1 and r2. Which outcome is impossible?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::atomic<int> x{0}, y{0};
int r1, r2;

void threadA() {
    x.store(1, std::memory_order_seq_cst);
    r1 = y.load(std::memory_order_seq_cst);
}

void threadB() {
    y.store(1, std::memory_order_seq_cst);
    r2 = x.load(std::memory_order_seq_cst);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "r1 == 1 && r2 == 1",
        "r1 == 0 && r2 == 1",
        "r1 == 0 && r2 == 0",
        "r1 == 1 && r2 == 0",
      ],
      correctIndex: 2,
    },
    explanation:
      "With memory_order_seq_cst, every seq_cst operation across all threads is consistent with " +
      "a single global total order S that agrees with each thread's own program order. Suppose " +
      "r1==0 and r2==0. r1==0 means A's load of y read the initial value, so in S, A's load(y) " +
      "precedes B's store(y). Symmetrically, r2==0 places B's load(x) before A's store(x) in S. " +
      "But program order forces A's store(x) before A's load(y), and B's store(y) before B's " +
      "load(x). Chaining all four relations gives A.storeX < A.loadY < B.storeY < B.loadX < " +
      "A.storeX, a cycle, which is impossible in a total order. So (0,0) cannot occur under " +
      "seq_cst. That is what seq_cst adds beyond acquire/release or relaxed: with " +
      "memory_order_relaxed instead, or even with release stores and acquire loads, this " +
      "classic 'store buffering' litmus test *can* produce r1==0 && r2==0, because neither " +
      "provides a shared total order tying the two threads' operations together. Each variable " +
      "then has only its own per-location modification order. On x86 the seq_cst version costs " +
      "a real fence (or an XCHG) on the stores precisely to shut off the store buffer that " +
      "would otherwise allow (0,0).",
  },
  {
    id: "concurrency-acquire-release-producer-consumer-04",
    category: "concurrency",
    difficulty: "medium",
    title: "Release store and acquire load around a non-atomic payload",
    tags: ["atomics", "memory-order", "happens-before"],
    type: "trace",
    prompt:
      "Same structure as the relaxed-ordering example above, but now using release/acquire " +
      "instead of relaxed. What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::atomic<bool> ready{false};
int data = 0;

void producer() {
    data = 42;
    ready.store(true, std::memory_order_release);
}

void consumer() {
    while (!ready.load(std::memory_order_acquire)) {}
    std::cout << data << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Always prints 42.",
        "Undefined behavior: the read of `data` is still a data race.",
        "Prints 0 or 42 nondeterministically, but well defined either way.",
        "Always prints 0.",
      ],
      correctIndex: 0,
    },
    explanation:
      "A release store synchronizes-with an acquire load that reads the value it stored (or a " +
      "later value in the same release sequence). Once consumer's acquire load observes " +
      "ready==true, that synchronizes-with edge links producer's store to consumer's load. " +
      "Combine it with the intra-thread sequenced-before relations (`data = 42` is " +
      "sequenced-before the release store, and the acquire load is sequenced-before the read of " +
      "`data`) and the standard's happens-before relation transitively connects producer's write " +
      "to consumer's read. Happens-before guarantees visibility, so the read always observes 42, " +
      "with no race and no UB. That is the direct fix for the earlier relaxed example: it is the " +
      "*synchronizes-with* relationship, not merely the atomicity of `ready`, that makes " +
      "cross-thread visibility of `data` guaranteed.",
  },
  {
    id: "concurrency-mutex-vs-spinlock-05",
    category: "concurrency",
    difficulty: "medium",
    title: "Spinlock vs std::mutex when the lock holder is preempted",
    tags: ["mutex", "spinlock", "scheduling"],
    type: "trace",
    prompt:
      "Four threads run on a 4-core machine. Thread T1 acquires a lock and, while holding it, " +
      "is preempted by the OS scheduler before releasing it (e.g., its time slice ends on a " +
      "timer interrupt). The other three threads are all waiting to acquire the same lock. " +
      "Which lock implementation is most likely to make this scenario dramatically worse?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "std::mutex: it makes a syscall on every lock and unlock, which costs more than spinning.",
        "A spinlock: the waiters burn full time slices polling and cannot speed T1's return to a core.",
        "Neither: once contention exists, the two behave identically.",
        "A spinlock: concurrent spinners corrupt the lock word while the holder is descheduled.",
      ],
      correctIndex: 1,
    },
    explanation:
      "Spinlocks only make sense when critical sections are short and lock-hold times are small " +
      "and bounded, ideally shorter than the cost of a context switch, typically in pinned " +
      "real-time or HPC code where preemption during the critical section is not expected. Here, " +
      "once T1 is preempted while holding the lock, the three spinning waiters keep consuming " +
      "full CPU cycles polling the lock state, yet none of that spinning helps the scheduler run " +
      "T1 again sooner. On an oversubscribed machine the spinners actively compete with T1 for " +
      "cores, extending the hold time further. std::mutex-based waiters instead block (typically " +
      "via a futex-style OS wait after a short adaptive spin), consuming essentially no CPU, " +
      "which lets the scheduler run T1 to completion and release the lock. The spinners also do " +
      "not corrupt anything: the lock word is atomic and mutual exclusion still holds; the damage " +
      "is entirely to latency and CPU efficiency. As for the mutex option, an uncontended " +
      "std::mutex lock/unlock is normally a pair of atomic operations with no syscall at all; the " +
      "kernel only gets involved when a thread actually has to block.",
  },
  {
    id: "concurrency-lock-order-deadlock-06",
    category: "concurrency",
    difficulty: "medium",
    title: "Two threads locking two mutexes in opposite order",
    tags: ["mutex", "deadlock", "lock-ordering"],
    type: "trace",
    prompt:
      "threadA and threadB are launched concurrently (as shown) repeatedly, each run using " +
      "fresh mutexes. What is the most accurate prediction across many runs of this program?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::mutex mtx1, mtx2;

void threadA() {
    std::lock_guard<std::mutex> lockA(mtx1);
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
    std::lock_guard<std::mutex> lockB(mtx2);
}

void threadB() {
    std::lock_guard<std::mutex> lockB(mtx2);
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
    std::lock_guard<std::mutex> lockA(mtx1);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It deadlocks on every run; opposite lock order always deadlocks.",
        "It never deadlocks, because std::lock_guard acquires mutexes in a canonical order automatically.",
        "It may or may not deadlock on any given run, depending on how the two threads interleave.",
        "It deadlocks only on a multicore machine; on one core the scheduler always breaks the cycle.",
      ],
      correctIndex: 2,
    },
    explanation:
      "Acquiring two mutexes in opposite order across threads is a classic deadlock hazard, but " +
      "it is not a deterministic one. Deadlock requires the specific interleaving where A holds " +
      "mtx1 and B holds mtx2 at the same time, each then blocking forever on the other's mutex. " +
      "The 10ms sleep between the two locks makes that interleaving overwhelmingly likely here, " +
      "but in real code the window can be a handful of instructions, and if the scheduler happens " +
      "to run one thread past its second lock before the other starts contending, that run " +
      "completes fine. Core count does not change this: a single core interleaves the two threads " +
      "just as readily, and the sleep guarantees a preemption point mid-sequence. That timing " +
      "dependence is what makes lock-order bugs so dangerous in production, since code can pass " +
      "thousands of test runs and still deadlock later under different scheduling, load, or " +
      "hardware. The robust fix is to acquire multiple locks in a single globally consistent " +
      "order, or to acquire them together via std::lock(mtx1, mtx2) or C++17's " +
      "std::scoped_lock(mtx1, mtx2), which uses a deadlock-avoidance algorithm internally.",
  },
  {
    id: "concurrency-livelock-07",
    category: "concurrency",
    difficulty: "medium",
    title: "Symmetric try_lock and back-off between two threads",
    tags: ["livelock", "mutex", "try_lock"],
    type: "trace",
    prompt:
      "Both threads are written to avoid deadlock by backing off (releasing their first lock and " +
      "yielding) whenever the second lock isn't immediately available. On a system where the two " +
      "threads happen to run in near-lockstep, what can happen?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `void threadA() {
    while (true) {
        mtx1.lock();
        if (mtx2.try_lock()) {
            /* do work */
            mtx2.unlock();
            mtx1.unlock();
            break;
        }
        mtx1.unlock();
        std::this_thread::yield();
    }
}

void threadB() {
    while (true) {
        mtx2.lock();
        if (mtx1.try_lock()) {
            /* do work */
            mtx1.unlock();
            mtx2.unlock();
            break;
        }
        mtx2.unlock();
        std::this_thread::yield();
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Deadlock: both threads block forever, each holding one lock.",
        "Both threads succeed within two iterations, since try_lock is required to be fair.",
        "Undefined behavior: try_lock cannot be called while the caller already holds a different mutex.",
        "Neither thread makes progress, even though both keep running and neither is ever blocked.",
      ],
      correctIndex: 3,
    },
    explanation:
      "This pattern avoids deadlock, since neither thread ever blocks indefinitely on a held " +
      "lock, but it introduces livelock. Both threads remain actively running (locking, failing " +
      "try_lock, unlocking, yielding, retrying), yet if their timing stays synchronized neither " +
      "ever holds both locks simultaneously, so no forward progress is made despite full CPU " +
      "activity. That is what distinguishes livelock from deadlock: the threads are not blocked " +
      "or waiting, they are busy but unproductive. Nothing in the standard makes try_lock fair, " +
      "and calling it while holding a different mutex is perfectly legal. Real schedulers rarely " +
      "sustain perfect lockstep indefinitely, since a stray interrupt or scheduling jitter " +
      "usually breaks the symmetry, but the hazard is real and reproducible under synchronized " +
      "or lockstep-like scheduling. The standard fix is randomized (exponential) backoff instead " +
      "of an unconditional yield, which breaks the symmetry deliberately rather than hoping the " +
      "scheduler will do it.",
  },
  {
    id: "concurrency-cv-spurious-wakeup-08",
    category: "concurrency",
    difficulty: "medium",
    title: "Guarding condition_variable::wait with if instead of while",
    tags: ["condition-variable", "mutex", "predicate"],
    type: "trace",
    prompt:
      "waiter() runs on one thread, notifier() eventually runs on another. What's wrong (if " +
      "anything) with guarding cv.wait(lock) with `if` instead of `while`?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::mutex mtx;
std::condition_variable cv;
bool ready = false;

void waiter() {
    std::unique_lock<std::mutex> lock(mtx);
    if (!ready) {              // <-- if, not while
        cv.wait(lock);
    }
    do_work();                 // assumes ready == true
}

void notifier() {
    { std::lock_guard<std::mutex> lock(mtx); ready = true; }
    cv.notify_one();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Bug: a woken thread can find `ready` still false, and `do_work()` then runs anyway.",
        "Nothing is wrong; wait() returns only after a notify, and only once the predicate holds.",
        "Bug: `if` leaves the mutex locked across the wait, so notifier() can never acquire it.",
        "Undefined behavior: the standard requires a loop around cv.wait, and `if` violates that.",
      ],
      correctIndex: 0,
    },
    explanation:
      "cv.wait(lock) atomically unlocks the mutex and blocks, then re-locks it before returning, " +
      "but the standard explicitly permits spurious wakeups: wait() may return even though no " +
      "thread ever called notify_one or notify_all. Even setting those aside, a single " +
      "notify_all can release several waiters when only one's precondition is actually " +
      "satisfied. An `if` checks the predicate exactly once and then trusts that whatever woke " +
      "it corresponds to the state it wanted. The only correct pattern is " +
      "`while (!ready) cv.wait(lock);`, or the predicate overload " +
      "`cv.wait(lock, []{ return ready; })`, which performs exactly that loop internally, " +
      "re-validating after every wakeup. The lock is genuinely released while blocked, so " +
      "notifier() is never locked out, and using `if` is not itself UB, it is a logic bug. " +
      "The consequence is that do_work() can run with `ready` still false, reading shared state " +
      "the notifier has not finished preparing.",
  },
  {
    id: "concurrency-aba-problem-09",
    category: "concurrency",
    difficulty: "hard",
    title: "Treiber stack pop with a reused node address",
    tags: ["lock-free", "cas", "aba"],
    type: "trace",
    prompt:
      "Thread 1 begins pop(): it reads head == A and computes newHead = A->next == B, then is " +
      "preempted right before the compare_exchange_weak call. While preempted, Thread 2 pops A " +
      "(head becomes B), pops B (head becomes C), then pushes a freshly allocated node that " +
      "happens to reuse A's old memory address as the new head (head becomes A again, but now " +
      "A->next == C, not B). Thread 1 resumes and executes " +
      "compare_exchange_weak(oldHead=A, newHead=B). What happens?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::atomic<Node*> head;

Node* pop() {
    Node* oldHead = head.load();
    Node* newHead;
    do {
        if (!oldHead) return nullptr;
        newHead = oldHead->next;
    } while (!head.compare_exchange_weak(oldHead, newHead));
    return oldHead;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The CAS fails, and the loop retries against head's genuinely current value.",
        "The CAS succeeds and installs the stale B, dropping C and reviving an already-popped node.",
        "The program deadlocks: two threads cannot CAS the same atomic concurrently.",
        "Undefined behavior from a data race on head, independent of the values involved.",
      ],
      correctIndex: 1,
    },
    explanation:
      "compare_exchange_weak compares head's current object representation against oldHead and " +
      "nothing else. It has no notion of whether that value changed and changed back in the " +
      "interim. Since head holds A both when Thread 1 first read it and when it CASes, the CAS " +
      "succeeds and installs newHead=B, a pointer Thread 1 computed from now-stale (and possibly " +
      "reused) memory, even though the true top of stack should be C. The stack is left " +
      "corrupted: C is unreachable, and B, already popped and potentially freed, is back at the " +
      "head. This is the canonical ABA problem, where the CAS observes 'A' and concludes nothing " +
      "relevant happened. The accesses to head are all atomic, so there is no data " +
      "race in the standard's sense, and concurrent CAS on one atomic is exactly what the " +
      "operation is for. Standard mitigations are tagged or versioned pointers (a monotonically " +
      "incrementing counter packed alongside the pointer and compared by a double-width CAS), " +
      "hazard pointers, or epoch-based reclamation, all of which distinguish 'this is A' from " +
      "'this is the *same* A' rather than relying on pointer equality alone.",
  },
  {
    id: "concurrency-lockfree-push-cas-10",
    category: "concurrency",
    difficulty: "hard",
    title: "Treiber stack push via compare_exchange_weak",
    tags: ["lock-free", "cas", "atomics"],
    type: "trace",
    prompt:
      "Is this Treiber-stack push implementation correct? In particular, note that n->next is " +
      "assigned once before the loop and is never manually reloaded inside the loop body.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Node { int value; Node* next; };
std::atomic<Node*> head{nullptr};

void push(Node* n) {
    n->next = head.load(std::memory_order_relaxed);
    while (!head.compare_exchange_weak(
               n->next, n,
               std::memory_order_release,
               std::memory_order_relaxed)) {
        // retry
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Buggy: n->next is never reloaded, so every retry after the first compares against a stale value.",
        "Buggy: memory_order_release on success is too weak here; the push needs memory_order_seq_cst.",
        "Correct: a failed compare_exchange_weak writes head's current value back into n->next.",
        "Correct, but only because compare_exchange_weak retries internally; the while loop is redundant.",
      ],
      correctIndex: 2,
    },
    explanation:
      "compare_exchange_weak(expected, desired, ...) takes `expected` by reference: on failure it " +
      "atomically writes the atomic object's current value into `expected` before returning " +
      "false. Here `expected` *is* n->next, so a failed attempt automatically refreshes n->next " +
      "to head's latest value, which is exactly what the retry needs, with no separate reload. " +
      "That is the standard idiom rather than an accident, and the loop is genuinely required: " +
      "compare_exchange_weak does not retry on its own, and is in fact allowed to fail spuriously " +
      "even when the comparison would have succeeded. memory_order_release on success is " +
      "sufficient: it publishes n and its already-initialized contents to whichever thread's " +
      "later acquire load or CAS observes the new head, and memory_order_relaxed on failure is " +
      "fine because a failed CAS publishes nothing. Push is also not where ABA bites. ABA is " +
      "a hazard for pop(), which dereferences the old head to compute the next pointer before " +
      "CASing; push never reads through a potentially stale, already-freed pointer.",
  },
  {
    id: "concurrency-thread-local-11",
    category: "concurrency",
    difficulty: "easy",
    title: "A thread_local counter incremented from two threads and main",
    tags: ["thread-local", "storage-duration"],
    type: "trace",
    prompt:
      "What values does this print for `counter` across the three calls (via t1, via t2, and " +
      "the main-thread call), in whatever order they happen to print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `thread_local int counter = 0;

void increment(int n) {
    for (int i = 0; i < n; ++i) ++counter;
    std::cout << "counter = " << counter << std::endl;
}

int main() {
    std::thread t1(increment, 5);
    std::thread t2(increment, 10);
    t1.join();
    t2.join();
    increment(3);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "5, then 10, then 15: one shared instance accumulates across all three calls.",
        "5, then 10, then 3: t1, t2, and main each get their own zero-initialized instance.",
        "Undefined behavior: a thread_local variable cannot be modified from more than one thread.",
        "5, then 15, then 18: main's instance accumulates the counts of the threads it created.",
      ],
      correctIndex: 1,
    },
    explanation:
      "`thread_local` gives each thread its own separate instance of `counter`, independently " +
      "initialized, here zero-initialized before first use in that thread. t1's five increments " +
      "only affect t1's copy and print 5; t2's ten increments only affect t2's copy and print " +
      "10; the main thread's own copy was never touched by t1 or t2, so three increments from a " +
      "fresh 0 print 3. Creating a thread does not link its instance to the creator's in any " +
      "way. There is no shared state and no data race here at all, which is the point of " +
      "thread_local storage duration: it trades sharing for per-thread isolation, useful for " +
      "per-thread arenas, RNG state, or errno-style status without any synchronization. The " +
      "printing itself is a separate matter, since the three `std::cout` insertions from " +
      "different threads can interleave, which is why the prompt says the order is whatever " +
      "happens to occur.",
  },
  {
    id: "concurrency-volatile-vs-atomic-12",
    category: "concurrency",
    difficulty: "medium",
    title: "A volatile flag used for a producer/consumer handoff",
    tags: ["volatile", "atomics", "data-race"],
    type: "trace",
    prompt:
      "producer and consumer run concurrently on separate threads, with `ready` marked volatile " +
      "instead of std::atomic<bool>. Does volatile make this safe, and what does the program do?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `volatile bool ready = false;
int data = 0;

void producer() {
    data = 42;
    ready = true;
}

void consumer() {
    while (!ready) {}
    std::cout << data << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No: `volatile` supplies neither atomicity nor a happens-before edge, so both accesses race.",
        "Yes: `volatile` forces each access to memory, which makes it atomic and visible across threads.",
        "Yes for `ready`, since a volatile bool access is atomic everywhere, but `data` may still read 0.",
        "No: the compiler rejects a volatile object that is accessed from more than one thread.",
      ],
      correctIndex: 0,
    },
    explanation:
      "This is one of the most common C++ concurrency misconceptions. Unlike Java or C#, " +
      "`volatile` in C++ has nothing to do with threading. It disables a specific set of " +
      "compiler optimizations (caching the value in a register, eliding a seemingly dead store, " +
      "reordering accesses to that object relative to other volatile accesses) so that each " +
      "access happens at the point the source says. It guarantees nothing about atomicity on any " +
      "given ISA, and nothing about happens-before relative to other, non-volatile variables. " +
      "Without a real synchronizes-with edge, which only std::atomic with an appropriate " +
      "memory_order or a mutex establishes, the compiler remains free to reorder `data = 42` " +
      "relative to `ready = true`, since it has no idea they are used for cross-thread " +
      "signaling, and weakly-ordered hardware may reorder them as well. The unsynchronized " +
      "accesses to `ready` and `data` from two threads are a data race and therefore undefined " +
      "behavior regardless of `volatile`. On x86 with a compiler that happens not to reorder, it " +
      "will usually appear to work, which is what makes the bug so hard to catch in testing. " +
      "The remaining legitimate uses of `volatile` are memory-mapped I/O registers and " +
      "signal-handler-visible `sig_atomic_t`, not inter-thread communication.",
  },
  {
    id: "concurrency-double-checked-locking-13",
    category: "concurrency",
    difficulty: "hard",
    title: "Double-checked locking with a raw pointer and a mutex",
    tags: ["singleton", "call_once", "data-race"],
    type: "trace",
    prompt:
      "Multiple threads call getInstance() concurrently. Is this classic double-checked locking " +
      "pattern correct in C++?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `Singleton* instance = nullptr;
std::mutex mtx;

Singleton* getInstance() {
    if (!instance) {                       // first check, no lock
        std::lock_guard<std::mutex> lock(mtx);
        if (!instance) {                   // second check, locked
            instance = new Singleton();
        }
    }
    return instance;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: the second check under the lock prevents constructing more than one Singleton.",
        "No: std::mutex cannot be unlocked by a thread other than the one that locked it, so this deadlocks.",
        "Yes, provided Singleton's constructor is trivial and writes no members of its own.",
        "No: the unlocked read races with the guarded write, and can observe a half-constructed object.",
      ],
      correctIndex: 3,
    },
    explanation:
      "Naive double-checked locking is broken in C++ for two independent reasons. First, the " +
      "unlocked outer read of `instance` is a plain, non-atomic access that races with the " +
      "mutex-protected write performed by another thread. That is a data race and therefore UB " +
      "regardless of which value is actually observed at runtime. Second, even setting the race " +
      "aside, `new Singleton()` conceptually allocates, runs the constructor writing members, " +
      "and then assigns the resulting pointer to `instance`. Without an explicit release/acquire " +
      "edge, the compiler and hardware are free to make the pointer write visible to another " +
      "core before the constructor's member writes are, so a thread doing the unlocked check can " +
      "see a non-null `instance` pointing at a half-constructed object. A trivial constructor " +
      "does not save the pattern either, since the first problem stands on its own. The correct " +
      "fixes are `std::call_once` with a `std::once_flag`, which internally supplies the required " +
      "synchronization, or a `std::atomic<Singleton*>` whose inner store uses " +
      "memory_order_release and whose outer unlocked load uses memory_order_acquire, restoring " +
      "the missing synchronizes-with edge. In modern C++ a function-local `static Singleton s;` " +
      "is simpler still, since [stmt.dcl] already requires exactly this synchronization.",
  },
  {
    id: "concurrency-thread-join-detach-14",
    category: "concurrency",
    difficulty: "easy",
    title: "A std::thread destroyed without join or detach",
    tags: ["std-thread", "join", "detach"],
    type: "trace",
    prompt:
      "run() creates a std::thread and returns without joining or detaching it. What happens " +
      "when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `void doWork() {
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
}

void run() {
    std::thread t(doWork);
    // no t.join() and no t.detach() here
}

int main() {
    run();
    std::cout << "done" << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The destructor detaches the thread, so \"done\" prints and doWork() finishes in the background.",
        "The destructor joins the thread, so run() blocks about 50ms and then \"done\" prints.",
        "std::terminate() is called from t's destructor and the process aborts; \"done\" never prints.",
        "Undefined behavior whose outcome varies by standard library implementation.",
      ],
      correctIndex: 2,
    },
    explanation:
      "std::thread deliberately has no implicit join and no implicit detach in its destructor. " +
      "The committee considered both 'safer' defaults and rejected them: implicit join can " +
      "silently hang for an unbounded time on exit paths, and implicit detach can silently " +
      "outlive resources the caller assumed were joined. Instead, ~thread() calls " +
      "std::terminate() whenever joinable() is true, meaning the thread was never joined or " +
      "detached. That is a deterministic rule specified by [thread.thread.destr], not " +
      "implementation-defined, so every conforming implementation aborts here. The fix is to " +
      "call t.join() to block until it finishes, or t.detach() to explicitly disown it and " +
      "accept that it now runs independently, before t goes out of scope, or to use a RAII " +
      "wrapper that joins in its destructor such as C++20's std::jthread.",
  },
  {
    id: "concurrency-acq-rel-fetch-add-16",
    category: "concurrency",
    difficulty: "hard",
    title: "Reference count with relaxed increments and an acquire decrement",
    tags: ["atomics", "memory-order", "reference-counting", "fetch_add"],
    type: "trace",
    prompt:
      "An intrusive reference count shared by several threads. addRef() increments with " +
      "memory_order_relaxed; release() decrements with memory_order_acquire and destroys the " +
      "object when it observes the count going from 1 to 0. Is that ordering sufficient to make " +
      "`delete this` safe?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::atomic<int> refCount{1};

void addRef() {
    refCount.fetch_add(1, std::memory_order_relaxed);
}

void release() {
    if (refCount.fetch_sub(1, std::memory_order_acquire) == 1) {
        delete this;   // last owner: safe to destroy?
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: acquire on a read-modify-write makes every prior write by every thread that touched refCount visible, so the delete is always safe.",
        "No: the increments are the real problem, since memory_order_relaxed lets a fetch_add drift past the fetch_sub that frees the object.",
        "Yes: fetch_sub is a read-modify-write, and every RMW is implicitly seq_cst whatever memory_order argument is passed to it.",
        "No: acquire orders only the load half of the read-modify-write, so a decrement publishes nothing; the decrement needs acq_rel, or release plus an acquire fence on the destroying branch.",
      ],
      correctIndex: 3,
    },
    explanation:
      "memory_order_acquire on a read-modify-write gives acquire semantics to the load portion " +
      "only. The store portion behaves as if relaxed, so the decrement is not a release " +
      "operation and heads no release sequence. That matters because the writes another thread " +
      "made to the reference-counted object before dropping its reference have to be visible to " +
      "whichever thread's decrement drives the count to zero and calls delete, and the only way " +
      "to build that happens-before edge is for each decrement's store to be a release that the " +
      "final decrement's acquire load can synchronize-with. The canonical fix, matching the " +
      "shared_ptr control-block design analyzed by Boehm: keep memory_order_relaxed on the " +
      "increments, since nothing needs to happen-before an increment; use memory_order_release " +
      "on the decrement; and have only the thread that actually observed the count reach zero " +
      "issue a std::atomic_thread_fence(std::memory_order_acquire) before destroying the object, " +
      "which is cheaper than paying acq_rel on every decrement. memory_order_acq_rel on the " +
      "fetch_sub is the simpler, slightly more expensive version of the same fix. Two nearby " +
      "temptations are both wrong: the relaxed increments are genuinely fine, because an " +
      "increment only ever needs the count itself to be atomic, and a read-modify-write is not " +
      "implicitly seq_cst, since the memory_order argument you pass is exactly the ordering you " +
      "get.",
  },
  {
    id: "concurrency-data-race-vs-false-sharing-17",
    category: "concurrency",
    difficulty: "hard",
    title: "Two threads incrementing the same non-atomic int",
    tags: ["data-race", "false-sharing", "cache-coherence", "mesi"],
    type: "trace",
    prompt:
      "Two threads both run incrementer(), concurrently incrementing the *same* plain " +
      "(non-atomic) int with no synchronization. How does this differ from the false-sharing " +
      "example above, and what's the most accurate prediction for this program?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int counter = 0;   // plain int, not std::atomic

void incrementer() {
    for (int i = 0; i < 1000000; ++i) ++counter;
}

// Thread 1: incrementer();
// Thread 2: incrementer();
// main: t1.join(); t2.join(); std::cout << counter;`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Undefined behavior: a true data race on one non-atomic object, unlike false sharing, where distinct atomics that are each individually synchronized merely share a cache line.",
        "Well-defined but slow, in the same category as false sharing: MESI serializes the cache-line traffic, so the printed value is some number no greater than 2,000,000.",
        "Well-defined and always exactly 2,000,000, since `++counter` compiles to a single atomic hardware instruction on most platforms.",
        "Well-defined but nondeterministic: increments can only be lost, never invented, so the printed value always lands between 1,000,000 and 2,000,000.",
      ],
      correctIndex: 0,
    },
    explanation:
      "The distinction is *which* object is being accessed, not merely whether there is " +
      "contention. False sharing (the earlier example) involves two distinct atomic variables, " +
      "each individually well-defined and correctly synchronized, that happen to share a " +
      "hardware cache line, so coherence ping-pong makes it slow but never incorrect. Here both " +
      "threads perform unsynchronized, non-atomic read-modify-write sequences (`++counter` is a " +
      "load, an add, and a store) on the exact same object, with no happens-before relationship " +
      "between the threads' accesses. That is precisely the data race [intro.races] defines as " +
      "undefined behavior: two conflicting actions on the same memory location, at least one a " +
      "write, unordered by happens-before. Hardware cache coherence does not rescue it. MESI's " +
      "Modified/Exclusive/Shared/Invalid states guarantee only that the hardware serializes " +
      "visibility of individual memory transactions between caches; they say nothing about what " +
      "the compiler is allowed to assume. Because the abstract machine forbids the race, the " +
      "compiler may assume no other thread is touching `counter` and hoist it into a register " +
      "for the entire loop, which drops the other thread's writes wholesale rather than losing " +
      "an occasional increment. So the 'somewhere between 1,000,000 and 2,000,000' intuition is " +
      "not a guarantee either: it describes what a naive translation of the loop would do, not " +
      "what the standard permits an optimizer to produce.",
  },
  {
    id: "concurrency-exception-across-threads-18",
    category: "concurrency",
    difficulty: "easy",
    title: "An unhandled exception escaping a thread function",
    tags: ["exceptions", "std-thread", "terminate"],
    type: "trace",
    prompt:
      "worker() throws an exception that is never caught inside the thread function. What " +
      "happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `void worker() {
    throw std::runtime_error("boom");
}

int main() {
    std::thread t(worker);
    try {
        t.join();
    } catch (const std::exception& e) {
        std::cout << "caught: " << e.what() << std::endl;
    }
    return 0;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "join() rethrows the exception on the calling thread, so \"caught: boom\" is printed.",
        "The exception is discarded when the thread finishes; join() returns normally and the program exits cleanly, printing nothing.",
        "std::terminate() is called on the worker's own thread as the exception leaves worker(), and the whole process aborts without printing anything.",
        "Undefined behavior: throwing out of a thread's entry function is not permitted, and what happens next is implementation-defined.",
      ],
      correctIndex: 2,
    },
    explanation:
      "Exceptions do not cross std::thread boundaries automatically. There is no mechanism by " +
      "which join() rethrows whatever the thread function threw. If an exception propagates out " +
      "of the function passed to std::thread's constructor without being caught inside that " +
      "function, std::terminate() is invoked and the process aborts, and it happens on whatever " +
      "thread was running worker(). main's try/catch around t.join() is irrelevant: it lives on " +
      "a different thread, and there is nothing for it to catch across that boundary. This is a " +
      "deterministic rule from [thread.thread.constr], not implementation-defined behavior. To " +
      "propagate an error from a worker thread to whichever thread joins it, catch the exception " +
      "inside the thread function, capture it with std::current_exception(), store the resulting " +
      "std::exception_ptr somewhere the joining thread can reach, and call " +
      "std::rethrow_exception() there. That is the mechanism std::promise, std::future, and " +
      "std::async use internally to shuttle exceptions across thread boundaries.",
  },
  {
    id: "concurrency-memory-order-consume-19",
    category: "concurrency",
    difficulty: "hard",
    title: "memory_order_consume on a released pointer",
    tags: ["atomics", "memory-order", "consume", "compilers"],
    type: "trace",
    prompt:
      "producer publishes a pointer with a release store; consumer reads it with " +
      "memory_order_consume and dereferences it. On mainstream compilers (GCC, Clang, MSVC), " +
      "what does memory_order_consume actually compile to, and is this program correct?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Widget { int value; };
std::atomic<Widget*> ptr{nullptr};

void producer() {
    Widget* w = new Widget{42};
    ptr.store(w, std::memory_order_release);
}

void consumer() {
    Widget* w;
    while (!(w = ptr.load(std::memory_order_consume))) {}
    std::cout << w->value << std::endl;   // dependent read through w
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Well-defined, and it compiles to genuine dependency-chain tracking: every major compiler implements consume as specified, making it cheaper than acquire on weakly-ordered ISAs.",
        "Fails to compile: memory_order_consume was removed from the library in C++20, and only memory_order_acquire remains valid as a load's ordering argument.",
        "Equivalent to memory_order_relaxed in the absence of a [[carries_dependency]] annotation, which is missing here, so the dereference of w is a data race.",
        "Well-defined, but every mainstream compiler promotes the consume load to an acquire load, so it pays full acquire cost and gains none of consume's theoretical savings.",
      ],
      correctIndex: 3,
    },
    explanation:
      "memory_order_consume was designed to provide a weaker, cheaper-than-acquire guarantee: " +
      "only operations carrying a data dependency from the consume-loaded value need be ordered " +
      "after it, rather than everything sequenced-after the load. The distinction only matters " +
      "on ISAs that do not already guarantee dependent loads execute in order, with DEC Alpha " +
      "the historical motivating example; mainstream ARM, POWER, and x86 make it largely moot in " +
      "practice. Tracking 'carries-dependency' soundly through expression rewriting, " +
      "common-subexpression elimination, and inlining turned out to be so fragile that every " +
      "major compiler gave up and silently strengthens memory_order_consume to " +
      "memory_order_acquire, which [atomics.order] explicitly permits. So the code above is not " +
      "broken and is fully portable; what is wrong is the expectation of a performance win. On " +
      "GCC, Clang, and MSVC this generates exactly the same code as writing " +
      "memory_order_acquire. The gap between specification and reality is why the committee has " +
      "repeatedly discussed deprecating or redesigning consume, and why P0371 recommends " +
      "temporarily discouraging its use.",
  },
  {
    id: "concurrency-hazard-pointers-epoch-reclamation-20",
    category: "concurrency",
    difficulty: "hard",
    title: "Hazard pointers vs epoch-based reclamation",
    tags: ["lock-free", "memory-reclamation", "hazard-pointers", "epoch-based-reclamation"],
    type: "trace",
    prompt:
      "A lock-free list is read by many threads without holding any lock, so a writer that " +
      "unlinks a node cannot simply delete it: some reader might still be dereferencing it. " +
      "Given the hazard-pointer read pattern shown, which statement best contrasts hazard " +
      "pointers with epoch-based reclamation (EBR) as solutions to this problem?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// Hazard-pointer read of a shared lock-free list node
Node* readNode(std::atomic<Node*>& src, std::atomic<Node*>& hazardSlot) {
    Node* p;
    do {
        p = src.load(std::memory_order_acquire);
        hazardSlot.store(p, std::memory_order_release);   // "I'm using p"
    } while (p != src.load(std::memory_order_acquire));   // re-check p wasn't swapped out
    return p;
}
// Before freeing a retired node, the reclaimer must scan every thread's
// hazard slot and confirm none currently holds that node's address.`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "They publish the same information under different names: a hazard slot and an epoch counter both announce which nodes a reader currently holds, so the two schemes are interchangeable.",
        "Hazard pointers publish each pointer in use and force a scan of every thread's slots before a node is freed; EBR publishes only a coarse per-thread epoch and frees in batches, so a thread stalled in an old epoch holds up all reclamation.",
        "Hazard pointers batch reclamation by generation while EBR tracks individual pointers per access, so the two names describe the same batching strategy with the labels swapped.",
        "EBR dominates hazard pointers on both throughput and worst-case memory bounds, because batching amortizes away the per-node scan that hazard pointers cannot avoid.",
      ],
      correctIndex: 1,
    },
    explanation:
      "Hazard pointers (Maged Michael's technique) give each reader a small, fixed number of " +
      "publish slots: before dereferencing a shared pointer, the reader announces it there, then " +
      "re-validates that the source pointer hasn't changed underneath it (as shown). A reclaimer " +
      "retiring a node must scan all threads' hazard slots and only frees nodes that appear in " +
      "none of them. That is precise, but it requires a publish-and-recheck on essentially every access, plus " +
      "an O(threads) scan per reclamation batch. Epoch-based reclamation instead has each thread " +
      "announce a coarse 'I am currently active, in epoch E' state relatively rarely (e.g., once " +
      "per operation rather than per pointer touched); a global epoch only advances once all " +
      "threads have caught up, and anything retired two epochs ago is safe to free in bulk. EBR's " +
      "per-access cost is far lower (often just a counter increment, no re-validation loop), but " +
      "correctness depends on every participating thread eventually advancing its epoch. A single " +
      "thread stalled (blocked, descheduled, or stuck in a long operation) in a stale epoch " +
      "prevents reclamation of everything retired since, an unbounded-memory-growth risk that " +
      "hazard pointers' per-node precision does not share. Real HPC allocators/schedulers pick " +
      "based on this trade-off: EBR for throughput-sensitive paths with well-behaved threads, " +
      "hazard pointers when worst-case memory bounds matter more than per-access cost.",
  },
  {
    id: "concurrency-seqlock-torn-read-21",
    category: "concurrency",
    difficulty: "hard",
    title: "Seqlock reader validating a snapshot with two sequence loads",
    tags: ["seqlock", "lock-free", "torn-read"],
    type: "trace",
    prompt:
      "This seqlock reader retries whenever s1 != s2, but never checks whether s1 itself is odd " +
      "(i.e., a write was already in progress when the reader's first read of `seq` happened). " +
      "Is `while (s1 != s2)` alone sufficient to guarantee the reader never returns torn data?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::atomic<unsigned> seq{0};
Data data;   // plain, non-atomic payload

void writer(const Data& d) {
    seq.fetch_add(1, std::memory_order_release);   // now odd: write in progress
    data = d;
    seq.fetch_add(1, std::memory_order_release);   // now even: write complete
}

Data reader() {
    Data local;
    unsigned s1, s2;
    do {
        s1 = seq.load(std::memory_order_acquire);
        local = data;
        s2 = seq.load(std::memory_order_acquire);
    } while (s1 != s2);          // <-- missing: also must check !(s1 & 1)
    return local;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: if a write overlaps the read at all, the two sequence values necessarily differ, so the s1 != s2 retry catches every torn read on its own.",
        "No functional bug in the reader; the writer is the broken half, because `data = d;` is a plain assignment rather than a compare_exchange loop over the payload.",
        "Bug: a reader that performs both of its loads inside one in-progress write reads the identical odd value twice, exits the loop, and returns torn data.",
        "Bug: release-ordered fetch_add is too weak for `seq`; unless every access to `seq` is seq_cst the reader can never observe a write in progress at all.",
      ],
      correctIndex: 2,
    },
    explanation:
      "The correct seqlock reader idiom checks two things on every attempt: that s1 == s2, so no " +
      "sequence-number change occurred between the two reads of `seq`, and that s1 is even, so " +
      "no write was already underway when the read began. Canonically that is " +
      "`do { s1 = seq.load(acquire); } while (s1 & 1); ... s2 = seq.load(acquire); if (s1 != s2) retry;`, " +
      "or equivalently retrying on `(s1 & 1) || (s1 != s2)`. Omitting the parity check leaves a " +
      "window. The reader's first load can catch `seq` mid-write at an odd value, and if the " +
      "reader's second load also lands before the writer has issued its second fetch_add, that " +
      "second load observes the same odd value. s1 == s2 holds, " +
      "the loop exits, and the returned `local` was copied while `data` was only partially " +
      "overwritten. This is the seqlock-specific analogue of a torn read and a real, " +
      "historically-seen kernel bug; Linux's read_seqbegin/read_seqretry pair loops while the " +
      "initial sequence value is odd for exactly this reason. A separate caveat applies even to " +
      "a fully correct seqlock: `data` is read and written as plain non-atomic memory from " +
      "multiple threads concurrently, which is formally a data race under the ISO C++ object " +
      "model no matter how careful the parity and fence discipline is. Seqlocks are a widely " +
      "used, hardware-proven idiom that nonetheless sits outside what the standard blesses, " +
      "which is why C++ implementations of them lean on implementation-specific guarantees or on " +
      "per-field relaxed atomics for the payload.",
  },
  {
    id: "concurrency-wait-free-lock-free-obstruction-free-22",
    category: "concurrency",
    difficulty: "medium",
    title: "Classifying a CAS retry loop",
    tags: ["lock-free", "wait-free", "progress-guarantees", "cas"],
    type: "trace",
    prompt:
      "Given this Treiber-stack push implementation (a CAS retry loop), how should it be " +
      "classified under the formal non-blocking progress-guarantee hierarchy, and why?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Node { int value; Node* next; };
std::atomic<Node*> head{nullptr};

void push(Node* n) {
    n->next = head.load(std::memory_order_relaxed);
    while (!head.compare_exchange_weak(
               n->next, n,
               std::memory_order_release,
               std::memory_order_relaxed)) {
        // retry
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Obstruction-free only: the loop advances just when a thread happens to run with no concurrent CAS attempts against it.",
        "Wait-free: compare_exchange_weak eventually succeeds for every thread, bounding each thread's own steps to completion.",
        "None of the three apply, since the hierarchy classifies hardware-transactional-memory algorithms rather than manual CAS loops.",
        "Lock-free but not wait-free: the structure as a whole always advances, but nothing bounds one particular thread's retries.",
      ],
      correctIndex: 3,
    },
    explanation:
      "The formal hierarchy runs strongest to weakest. Wait-free guarantees every thread " +
      "completes in a bounded number of its own steps regardless of other threads' relative " +
      "speeds or interleavings. Lock-free guarantees only that *some* thread completes in a " +
      "bounded number of steps in any execution, so the system's aggregate throughput is bounded " +
      "even though a specific unlucky thread's personal progress is not. Obstruction-free, the " +
      "weakest of the three commonly named, guarantees bounded completion only for a thread that " +
      "eventually runs with no concurrent contention at all. The push() above is lock-free: " +
      "whenever a thread's CAS fails, that failure was caused by some other thread's CAS having " +
      "just succeeded and installed a new head, so the data structure always advances. But " +
      "nothing bounds how many times any *particular* thread can be the loser. Under " +
      "sufficiently adversarial (if practically improbable) scheduling, one thread could retry " +
      "indefinitely while others keep winning the race, which is exactly the per-thread bound " +
      "wait-free adds and this loop does not provide. Real wait-free algorithms buy that bound " +
      "with extra machinery, typically an operation-announcement array plus helping, where " +
      "threads finish a stalled thread's operation on its behalf. They are correspondingly rarer " +
      "and more intricate, and show up mostly where hard worst-case latency bounds are " +
      "non-negotiable, such as real-time control loops or ultra-low-latency trading paths.",
  },
  {
    id: "concurrency-memory-fence-vs-atomic-op-23",
    category: "concurrency",
    difficulty: "hard",
    title: "atomic_thread_fence paired with relaxed atomic flags",
    tags: ["atomics", "memory-order", "fences"],
    type: "trace",
    prompt:
      "`a` and `b` are plain, non-atomic ints, so they cannot carry a memory_order themselves. " +
      "flagA and flagB are separate atomics, both stored/loaded with memory_order_relaxed, but " +
      "producer/consumerA additionally use explicit atomic_thread_fence calls. Is consumerA() " +
      "guaranteed to print 1?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int a = 0, b = 0;                          // plain, non-atomic
std::atomic<bool> flagA{false}, flagB{false};

void producer() {
    a = 1;
    b = 2;
    std::atomic_thread_fence(std::memory_order_release);
    flagA.store(true, std::memory_order_relaxed);
    flagB.store(true, std::memory_order_relaxed);
}

void consumerA() {
    while (!flagA.load(std::memory_order_relaxed)) {}
    std::atomic_thread_fence(std::memory_order_acquire);
    std::cout << a << std::endl;   // guaranteed 1?
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: the release fence pairs with consumerA's acquire fence through flagA, and happens-before then covers the plain write to `a`.",
        "No: memory_order_relaxed on flagA carries no ordering at all, and a fence cannot supply ordering the operation itself lacks.",
        "Yes on x86 only; the identical code with the identical fences is still a data race on ARM or POWER.",
        "No: atomic_thread_fence constrains compiler reordering only, so the hardware stays free to reorder across it on every ISA.",
      ],
      correctIndex: 0,
    },
    explanation:
      "A fence is a standalone synchronization point, distinct from the memory_order attached to " +
      "any single atomic operation. memory_order_release on a store orders prior writes relative " +
      "to *that store*, whereas atomic_thread_fence(memory_order_release) orders everything " +
      "sequenced before it (atomic operations and, critically, plain non-atomic writes like `a` " +
      "and `b`, which have no way to carry a memory_order at all) relative to whatever atomic " +
      "store follows the fence. [atomics.fences] states the pairing precisely: a release fence A " +
      "synchronizes-with an acquire fence B when there exist atomic operations X and Y on the " +
      "same object M such that A is sequenced-before X, X modifies M, Y is sequenced-before B, " +
      "and Y reads the value written by X (or a value from the release sequence X would head if " +
      "it were a release operation). Here X is producer's relaxed store to flagA and Y is " +
      "consumerA's relaxed load of it, so the two fences pair up and everything sequenced before " +
      "the release fence happens-before everything sequenced after the acquire fence. `a == 1` is " +
      "therefore guaranteed, with no data race. The fences do real work on hardware " +
      "too, emitting whatever barrier instruction the target needs (`dmb ish` on AArch64, " +
      "typically nothing at all for a release fence on x86, whose TSO model already forbids " +
      "store-store and load-load reordering). The practical payoff over per-operation " +
      "release/acquire is on display here: one fence covers every relaxed store sequenced after " +
      "it, flagA and flagB alike, plus arbitrary plain memory written before it, instead of " +
      "requiring each atomic operation to be annotated separately.",
  },
  {
    id: "concurrency-latch-vs-barrier-24",
    category: "concurrency",
    difficulty: "easy",
    title: "std::latch and std::barrier across a three-phase loop",
    tags: ["latch", "barrier", "cpp20"],
    type: "trace",
    prompt:
      "Three worker threads run worker(id). startLine is a std::latch(3); checkpoint is a " +
      "std::barrier(3, completion-fn) used across a 3-phase loop. How many times does " +
      "\"phase done\" print, and can startLine be reused for a second synchronization event " +
      "the way checkpoint is reused across phases?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::latch startLine(3);
std::barrier checkpoint(3, []{ std::cout << "phase done\\n"; });

void worker(int id) {
    startLine.arrive_and_wait();          // wait for all 3 to be ready
    for (int phase = 0; phase < 3; ++phase) {
        // ... do this phase's work ...
        checkpoint.arrive_and_wait();     // wait for all 3 to finish this phase
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "\"phase done\" prints once in total, and startLine is reusable indefinitely, exactly like checkpoint is.",
        "\"phase done\" prints 9 times, once per thread per phase, since each of the 3 participants runs the completion function.",
        "\"phase done\" prints 3 times, once per phase, and startLine cannot be reused; a latch never resets its counter.",
        "Compile error: a barrier's completion function must return bool to signal whether another phase should follow.",
      ],
      correctIndex: 2,
    },
    explanation:
      "std::latch is a single-use countdown. It starts at N, each arrive() or arrive_and_wait() " +
      "decrements it, and once it reaches zero every waiter is released permanently. The counter " +
      "cannot be reset or reused for a second rendezvous, which makes a latch the right shape for " +
      "one-time events such as 'wait for N initialization tasks to finish' or, as here, a start " +
      "line. Calling arrive_and_wait() on startLine again would block nobody, since everyone has " +
      "already passed it; a second one-time event needs a fresh latch. std::barrier is built for " +
      "the opposite use case, repeated phased synchronization among a fixed set of participants. " +
      "Once all N threads have arrived for the current phase, the barrier invokes its completion " +
      "function exactly once, on one unspecified participating thread, and then resets its " +
      "internal counter to N for the next phase. The three-iteration loop therefore crosses the " +
      "barrier three times and prints \"phase done\" three times, once per phase boundary, never " +
      "once per arriving thread.",
  },
  {
    id: "concurrency-jthread-stop-token-25",
    category: "concurrency",
    difficulty: "medium",
    title: "std::jthread destruction when the worker never checks a stop token",
    tags: ["jthread", "stop_token", "cpp20", "cancellation"],
    type: "trace",
    prompt:
      "badWorker() takes no std::stop_token parameter and never checks any cancellation signal. " +
      "What happens when the enclosing block ends and t's destructor runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `void badWorker() {
    while (true) {
        doWork();
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
}

int main() {
    {
        std::jthread t(badWorker);
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }   // t's destructor runs here
    std::cout << "main continues" << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "std::terminate() is called, exactly as a plain joinable std::thread's destructor would do.",
        "The destructor requests a stop that badWorker() never polls and then joins, so main blocks forever and prints nothing.",
        "badWorker() is preemptively killed the instant request_stop() fires, which is the cancellation jthread adds over thread.",
        "Nothing special happens: jthread detaches on destruction, so \"main continues\" prints immediately.",
      ],
      correctIndex: 1,
    },
    explanation:
      "std::jthread improves on std::thread in two ways. Its destructor calls request_stop() and " +
      "then join(), rather than calling std::terminate() on a still-joinable thread, and its " +
      "entry function may optionally accept a std::stop_token as its first parameter to opt into " +
      "cooperative cancellation. The catch is that request_stop() is purely advisory: it flips a " +
      "shared stop-state to 'requested' and runs any registered std::stop_callbacks, and it has " +
      "no power whatsoever to preempt or interrupt a running thread. badWorker() never accepts a " +
      "stop_token, never calls get_stop_token(), and never polls stop_requested(), so the request " +
      "changes nothing about its control flow. The destructor then calls join() unconditionally, " +
      "blocking until badWorker() returns, which its infinite loop guarantees never happens. main " +
      "hangs and \"main continues\" is never printed. Nothing here resembles the plain " +
      "std::thread outcome either: jthread's whole point is that its destructor joins instead of " +
      "terminating, and it never detaches. Making the code actually cancellable means declaring " +
      "`void goodWorker(std::stop_token st)` and checking `st.stop_requested()` at a defined " +
      "point in the work loop each iteration, or registering a std::stop_callback that interrupts " +
      "whatever the thread is blocked on.",
  },
  {
    id: "concurrency-work-stealing-deque-26",
    category: "concurrency",
    difficulty: "medium",
    title: "Work-stealing deque with owner and thieves on opposite ends",
    tags: ["work-stealing", "scheduler", "deque", "contention"],
    type: "trace",
    prompt:
      "In a work-stealing task scheduler, each worker thread owns a deque of tasks. The owner " +
      "exclusively pushes and pops from one end (\"bottom\"); other worker threads that have run " +
      "out of local work (\"thieves\") steal from the opposite end (\"top\"). Why is splitting the " +
      "deque this way, rather than having every thread operate on a single shared end, the key " +
      "design decision for low contention?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It is arbitrary: either thread could use either end with identical performance, and the split is Cilk-era convention.",
        "It is required by the standard library's thread-safety rules, which forbid concurrent access to the same end of a deque.",
        "It makes every steal wait-free, since operating on opposite ends of a deque is sufficient on its own to bound each operation.",
        "It keeps the owner's high-frequency push/pop contention-free and confines the arbitrating CAS to the rare steal path.",
      ],
      correctIndex: 3,
    },
    explanation:
      "Chase-Lev-style (and Arora-Blumofe-Plaxton) work-stealing deques exploit two asymmetries " +
      "at once: locality and access frequency. The owner treats its own end as a LIFO stack, " +
      "because popping the most-recently-pushed task tends to hit warm cache lines, while thieves " +
      "take from the opposite end in FIFO order, grabbing the oldest and typically " +
      "coarsest-grained tasks, which are the ones most likely to contain enough embedded " +
      "parallelism to justify the cost of a steal. Local push/pop vastly outnumbers steal " +
      "attempts in typical workloads, and no other owner thread ever touches the bottom end, so " +
      "the hot path can avoid synchronization entirely (or reduce to a cheap fast-path bounds " +
      "check) in the common case where the deque is not near-empty. Stealing is the rare path, " +
      "triggered only once a thief has exhausted its own deque, and it is the one operation that " +
      "must pay for a CAS: to arbitrate against other concurrent thieves, and against the owner's " +
      "own pop in the boundary case where exactly one item remains and both ends refer to it. " +
      "That cost allocation, cheap on the hot path and expensive on the cold one, is precisely " +
      "the inverse of a single shared queue, where every push and pop from every thread pays full " +
      "synchronization cost regardless of how often it happens. Note that the split buys low " +
      "contention, not a stronger progress guarantee: Chase-Lev steals are lock-free, not " +
      "wait-free, since a losing thief simply retries.",
  },
  {
    id: "concurrency-petersons-algorithm-27",
    category: "concurrency",
    difficulty: "hard",
    title: "Peterson's algorithm built from plain non-atomic variables",
    tags: ["peterson", "memory-order", "reordering", "data-race"],
    type: "trace",
    prompt:
      "Peterson's algorithm is the textbook proof that two threads can achieve mutual exclusion " +
      "using only plain reads and writes of shared flag[]/turn, with no atomic read-modify-write " +
      "instruction required. Compiled and run as plain (non-atomic, non-volatile) C++ variables " +
      "on a real modern multicore machine with a standard optimizing compiler, is mutual " +
      "exclusion actually guaranteed?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `bool flag[2] = {false, false};
int turn = 0;

void thread0() {
    flag[0] = true;
    turn = 1;
    while (flag[1] && turn == 1) { /* spin */ }
    // critical section
    flag[0] = false;
}

void thread1() {
    flag[1] = true;
    turn = 0;
    while (flag[0] && turn == 0) { /* spin */ }
    // critical section
    flag[1] = false;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No: the proof assumes sequential consistency, which neither the optimizer nor real hardware provides for plain variables.",
        "Yes: the proof relies only on each thread's own program order, and every CPU respects the program order of its own instructions.",
        "Yes on x86-64, which alone provides full sequential consistency for loads and stores; only weakly-ordered ISAs like ARM64 break it.",
        "No: the algorithm is valid only under cooperative, single-core scheduling and was never intended for true multicore parallelism.",
      ],
      correctIndex: 0,
    },
    explanation:
      "Peterson's algorithm's classical proof of mutual exclusion is carried out on an idealized " +
      "sequentially-consistent machine, where a single global interleaving of all reads and writes " +
      "exists and every thread agrees on it. Real hardware provides no such guarantee for plain " +
      "loads/stores: x86-64's store buffers permit a thread's own store to be locally visible before " +
      "it's globally visible, allowing a later load in program order to be reordered ahead of an " +
      "earlier store from another core's perspective (store-load reordering, the one reordering x86 " +
      "does allow); ARM/POWER permit considerably more reordering still. Independently of hardware, " +
      "the C++ compiler is free to reorder, cache in a register, or otherwise transform accesses to " +
      "plain (non-atomic, non-volatile) variables it doesn't know are used for cross-thread " +
      "signaling, since it owes no ordering guarantees at all absent std::atomic or an equivalent. " +
      "Either effect alone can break the algorithm: e.g., if thread0's write to `turn` becomes visible to " +
      "thread1 before thread0's write to flag[0] does, thread1 can enter its critical section while " +
      "thread0 believes it also has priority. And regardless of what any specific piece of hardware " +
      "happens to do, concurrent unsynchronized reads and writes of flag[]/turn from two threads " +
      "constitute a data race under the C++ standard, which is undefined behavior on its own terms. " +
      "This is a favorite trick question precisely because the algorithm is provably correct under " +
      "the abstraction most people learn it in (a sequentially consistent shared-memory model) while " +
      "being silently broken under the actual C++ memory model and actual hardware absent explicit " +
      "atomics. Making flag[] and turn `std::atomic` with memory_order_seq_cst restores the total " +
      "order the proof assumes and makes the code correct again; acquire/release is not enough, " +
      "since the proof turns on the store-then-load pattern that only a full seq_cst ordering (or " +
      "an explicit seq_cst fence between the store to `turn` and the spin loop) forbids reordering. " +
      "That is also why hand-rolled mutual exclusion out of plain variables is essentially never " +
      "the right call in production C++, where std::mutex already pays for the fences correctly.",
  },
  {
    id: "concurrency-cas-tagged-pointer-aba-fix-28",
    category: "concurrency",
    difficulty: "hard",
    title: "Treiber stack pop with a tagged pointer and double-width CAS",
    tags: ["lock-free", "cas", "aba", "tagged-pointer"],
    type: "trace",
    prompt:
      "Replaying the earlier Treiber-stack ABA scenario: Thread 1 reads head as {A, tag=5}, then " +
      "is preempted before its CAS. While preempted, Thread 2 pops A (tag becomes 6), pops B " +
      "(tag becomes 7), then pushes a freshly allocated node that happens to reuse A's old " +
      "address as the new head (tag becomes 8, so head is now {A, tag=8}). Thread 1 resumes and " +
      "executes compare_exchange_weak(expected={A,tag=5}, desired={B,tag=6}). What happens now?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct TaggedPtr { Node* ptr; uint64_t tag; };
std::atomic<TaggedPtr> head;   // assumes a lock-free double-width CAS is available

Node* pop() {
    TaggedPtr oldHead = head.load();
    TaggedPtr newHead;
    do {
        if (!oldHead.ptr) return nullptr;
        newHead.ptr = oldHead.ptr->next;
        newHead.tag = oldHead.tag + 1;              // always advances, never reused
    } while (!head.compare_exchange_weak(oldHead, newHead));
    return oldHead.ptr;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The CAS still succeeds, since the comparison inspects only the pointer field; tagging cannot prevent ABA.",
        "The CAS fails on the tag mismatch, and the retry recomputes newHead from head's genuinely current value.",
        "The CAS succeeds exactly as before, since the tag is diagnostic metadata compare_exchange_weak never inspects.",
        "Compile error: std::atomic<TaggedPtr> is ill-formed for a struct that mixes a pointer with an integer member.",
      ],
      correctIndex: 1,
    },
    explanation:
      "compare_exchange_weak and _strong compare the entire object representation of the atomic's " +
      "value type against `expected`, effectively a bitwise comparison of all 16 bytes. Once a " +
      "monotonically-incrementing tag is packed alongside the pointer into one atomically-compared " +
      "word, two states that share a pointer value but arose from different modification " +
      "histories stop being indistinguishable. Here the pointer field coincidentally matches " +
      "(A == A) but the tag does not (expected 5 against head's current 8, three modifications " +
      "later), so the CAS correctly reports that head is not in the state Thread 1 last observed. " +
      "It fails, writes {A, tag=8} back into oldHead, and the loop retries against the real " +
      "current head, whose ->next is C rather than the stale B Thread 1 originally read. The " +
      "stack corruption the untagged version suffered never happens. Three caveats matter in " +
      "practice. First, this needs hardware support for a compare-and-swap wider than a pointer: " +
      "CMPXCHG16B on x86-64 for a 128-bit {pointer, 64-bit tag} pair, or CASP (ARMv8.1) or an " +
      "LDXP/STXP pair on AArch64, so std::atomic<TaggedPtr>::is_always_lock_free is worth " +
      "checking rather than assuming. Second, the bitwise comparison means padding bits inside " +
      "the struct would cause spurious CAS failures; {Node*, uint64_t} happens to pack with no " +
      "padding on LP64 targets, but a narrower tag type would not. Third, the tag can in " +
      "principle wrap, though a 64-bit counter makes that a non-concern. This technique, along " +
      "with hazard pointers and epoch-based reclamation, is one of the standard production " +
      "mitigations for ABA.",
  },
  {
    id: "concurrency-release-sequence-rmw-30",
    category: "concurrency",
    difficulty: "hard",
    title: "Relaxed fetch_add operations between a release store and an acquire load",
    tags: ["atomics", "memory-order", "release-sequence", "happens-before"],
    type: "trace",
    prompt:
      "writer() runs once and performs a release store. Three separate threads then each call " +
      "bumper() exactly once, performing a relaxed fetch_add on the same atomic `counter`. " +
      "reader() spins on an acquire load until it observes counter's value has reached 4, the " +
      "value produced by the *last* fetch_add to actually execute, not writer()'s original store " +
      "of 1. Is reader() guaranteed to print 99?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::atomic<int> counter{0};
int payload = 0;

void writer() {
    payload = 99;
    counter.store(1, std::memory_order_release);      // heads the release sequence
}

void bumper() {                                        // called once each, by 3 threads
    counter.fetch_add(1, std::memory_order_relaxed);   // relaxed RMW
}

void reader() {
    while (counter.load(std::memory_order_acquire) < 4) {}
    std::cout << payload << std::endl;   // guaranteed 99?
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No: only an acquire load reading the exact value the release store wrote (1) synchronizes with that store.",
        "No: a relaxed fetch_add cannot participate in a release sequence, which only release or acq_rel RMWs extend.",
        "Yes: the three RMWs extend writer()'s release sequence, so reader()'s acquire load synchronizes with the original store.",
        "Yes, but only at this count; the release sequence rule tolerates a small bounded number of intervening RMWs.",
      ],
      correctIndex: 2,
    },
    explanation:
      "A release sequence headed by a release operation A on an atomic object M is the maximal " +
      "contiguous run of side effects in M's modification order starting at A in which every " +
      "subsequent side effect is an atomic read-modify-write. The standard imposes no requirement " +
      "on which thread performs those RMWs, nor on what memory_order they carry: a " +
      "memory_order_relaxed fetch_add extends the sequence exactly as well as an acq_rel one " +
      "does. Any acquire operation that reads a value written by any operation in that release " +
      "sequence, not only by A itself, synchronizes-with A. Here writer()'s release store heads " +
      "the sequence and the three bumper() calls, each a relaxed RMW on the same `counter`, " +
      "extend it. A plain non-RMW store from another thread landing in the middle of the chain " +
      "would break it, but no such store exists. reader()'s acquire load observes the value left " +
      "by the final fetch_add and therefore synchronizes-with writer()'s original release store, " +
      "despite never reading the literal 1 that store wrote. Happens-before is transitive, so " +
      "`payload = 99` happens-before reader()'s read of `payload` and 99 is guaranteed, with no " +
      "race. The tempting wrong intuition is that synchronization requires reading the exact " +
      "value the release wrote; the release sequence rule exists precisely to let synchronization " +
      "ride along an intervening chain of RMWs, the canonical case being several relaxed " +
      "reference-count decrements between an initial release and a final acquire. One historical " +
      "wrinkle: C++20 tightened the definition so a release sequence is only ever the head plus " +
      "subsequent RMWs, dropping an older C++11 through C++17 allowance for additional plain " +
      "stores made by A's own thread. That change does not affect this answer, since every " +
      "continuation here is already an RMW.",
  },
  {
    id: "concurrency-async-future-dtor-block-01",
    category: "concurrency",
    difficulty: "medium",
    title: "Discarding the future returned by std::async",
    tags: ["std-async", "std-future", "launch-policy"],
    type: "trace",
    prompt:
      "measure() times how long the block containing the std::async call takes to run. " +
      "slowTask() sleeps for ~800ms before returning. What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int slowTask() {
    std::this_thread::sleep_for(std::chrono::milliseconds(800));
    return 42;
}

int main() {
    auto start = std::chrono::steady_clock::now();
    {
        std::async(std::launch::async, slowTask);   // return value discarded
    }
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                  std::chrono::steady_clock::now() - start).count();
    std::cout << "elapsed: " << ms << "ms" << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "elapsed: ~800ms; the enclosing block cannot exit until slowTask() has returned",
        "elapsed: ~0ms; the discarded future leaves slowTask() running detached in the background",
        "Compile error: std::async's return value cannot be discarded, only bound to a std::future",
        "elapsed: ~800ms, and swapping in std::launch::deferred would still cost ~800ms in the destructor",
      ],
      correctIndex: 0,
    },
    explanation:
      "This is one of the most common std::async gotchas in production code. std::async returns " +
      "a std::future tied to a shared state, and that future's destructor has special behavior " +
      "carved out in the standard specifically for shared states created by std::async: it " +
      "blocks until the associated asynchronous task finishes, as if an implicit .wait() were " +
      "called ([futures.async]). Ordinary futures, for instance one obtained from a " +
      "std::promise, have no such rule, and their destructor just releases the shared state " +
      "without blocking. Here the future returned by std::async is an unnamed temporary, so it " +
      "is destroyed at the end of the full expression, still on the same line. The call " +
      "therefore becomes effectively synchronous despite std::launch::async having requested " +
      "eager execution on a new thread: the calling thread parks in the destructor for ~800ms " +
      "before the enclosing block can exit. The deferred case behaves differently, not " +
      "identically: with std::launch::deferred nothing runs eagerly, and destroying the last " +
      "future without ever calling get() or wait() means the deferred function is simply never " +
      "invoked, so the timing would read ~0ms and slowTask() would not run at all. Either way, " +
      "discarding the future is a bug, though only a diagnosable one: std::async is marked " +
      "[[nodiscard]] since C++20, so a conforming compiler warns here rather than rejecting the " +
      "code. The fix is to bind the future to a named variable whose lifetime " +
      "spans however long the task should overlap with other work, e.g. " +
      "`std::future<int> f = std::async(std::launch::async, slowTask);`, calling f.get() only " +
      "once the result is actually needed.",
    references: [
      "https://en.cppreference.com/w/cpp/thread/async",
      "https://en.cppreference.com/w/cpp/thread/future/~future",
    ],
  },
  {
    id: "concurrency-packaged-task-01",
    category: "concurrency",
    difficulty: "medium",
    title: "std::packaged_task in a thread pool's submit()",
    tags: ["packaged_task", "std-future", "thread-pool"],
    type: "trace",
    prompt:
      "A thread pool's submit() function needs to hand work to whichever worker thread picks it " +
      "up next from a shared queue, while still giving the caller a std::future for the result. " +
      "Why is std::packaged_task used here instead of just calling std::async(f) directly?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::queue<std::packaged_task<int()>> taskQueue;
std::mutex qmtx;
std::condition_variable qcv;

std::future<int> submit(std::function<int()> job) {
    std::packaged_task<int()> task(std::move(job));
    std::future<int> fut = task.get_future();
    {
        std::lock_guard<std::mutex> lock(qmtx);
        taskQueue.push(std::move(task));
    }
    qcv.notify_one();
    return fut;
}

// worker thread loop:
// std::packaged_task<int()> t = std::move(taskQueue.front()); taskQueue.pop();
// t();   // runs job(), fulfills fut automatically via its shared state`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No real difference: std::async(std::launch::async, job) yields an equivalent future and could be substituted directly",
        "It is required because a future can only be obtained once, and std::async exposes no get_future() to call at all",
        "It is needed because std::async's returned future would block inside submit() before the job could reach the queue",
        "It binds a callable to a future-producing shared state while leaving when and on which thread it runs to the caller",
      ],
      correctIndex: 3,
    },
    explanation:
      "std::packaged_task<R()> bundles a callable with a std::promise-like shared state: calling " +
      "the packaged_task invokes the wrapped callable and automatically stores its return value " +
      "(or exception) into that shared state, which get_future() exposes as a std::future, all " +
      "without manually managing a std::promise yourself. Critically, a packaged_task is just an " +
      "object: constructing one and calling get_future() does not start any thread or schedule " +
      "any execution at all. It only runs when something actually invokes it via operator(), on " +
      "whatever thread happens to do that invoking. That's precisely the property a thread pool " +
      "needs: submit() can hand the packaged_task off to a shared queue and return a future to " +
      "the caller immediately, while an arbitrary pool worker thread later pulls it off the queue " +
      "and calls it, giving the pool (not the standard library's launch-policy heuristics) full " +
      "control over which thread runs the work and when. std::async, in contrast, is an all-in-one " +
      "'run this now (or lazily), somewhere I decide' API. Under std::launch::async it always " +
      "spins up a thread of its own, and there is no supported way to redirect that execution onto " +
      "an existing pool worker. Two nearby ideas are wrong for different reasons: std::async does " +
      "hand back a perfectly usable std::future (there is no once-only get_future() restriction to " +
      "route around), and returning that future from submit() would not block, since the " +
      "async-created future's blocking destructor only bites when the future is discarded rather " +
      "than returned. The packaged_task/promise/future family is the general-purpose building " +
      "block; std::async is a convenience wrapper over it for the common 'run this async and give " +
      "me a future' case, and that convenience is precisely what makes it unsuitable for " +
      "pool-based scheduling.",
    references: [
      "https://en.cppreference.com/w/cpp/thread/packaged_task",
      "https://en.cppreference.com/w/cpp/thread/async",
    ],
  },
  {
    id: "concurrency-notify-all-thundering-herd-01",
    category: "concurrency",
    difficulty: "medium",
    title: "notify_all on a single-slot resource pool",
    tags: ["condition-variable", "notify_all", "notify_one", "thundering-herd"],
    type: "trace",
    prompt:
      "A resource pool holds exactly one available slot at a time. 50 threads are all blocked in " +
      "acquire(), waiting for slotAvailable to become true. release() is called once. What " +
      "actually happens with notify_all() here, and is it the right call to use?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::mutex mtx;
std::condition_variable cv;
bool slotAvailable = true;

void acquire() {
    std::unique_lock<std::mutex> lock(mtx);
    cv.wait(lock, [] { return slotAvailable; });
    slotAvailable = false;
    // ... use the one available slot ...
}

void release() {
    {
        std::lock_guard<std::mutex> lock(mtx);
        slotAvailable = true;
    }
    cv.notify_all();   // wakes every one of the 50 waiters
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "notify_all() is required here; notify_one() would wake a single waiter and strand the other 49 forever",
        "All 50 wake and serialize on the mutex, one takes the slot, and the other 49 wakeups accomplish nothing",
        "notify_all() introduces a data race, since 50 threads read slotAvailable simultaneously without the mutex",
        "notify_all() and notify_one() are interchangeable here, because the predicate overload serializes the checks anyway",
      ],
      correctIndex: 1,
    },
    explanation:
      "notify_all() unblocks every thread currently waiting on the condition variable, but the " +
      "predicate-overload cv.wait(lock, pred) requires each awakened thread to reacquire the " +
      "mutex before it can re-check pred, so all 50 threads do get woken roughly simultaneously " +
      "by the OS, but they then serialize on the mutex one at a time. The single-slot invariant " +
      "means exactly one of them will see slotAvailable == true and consume it; the remaining 49 " +
      "each wake up, briefly contend for the mutex, find the predicate false again, and go back to " +
      "sleep in wait(). That is correct behavior, but it costs 49 pointless wakeups and mutex " +
      "acquisitions/releases per release() call, an effect that scales badly and is exactly what's " +
      "meant by the 'thundering herd' problem. In this specific single-resource pattern, " +
      "notify_one() produces the identical final state (some one waiter proceeds) with none of " +
      "the wasted work, because it is guaranteed at most one thread can usefully make progress " +
      "regardless of how many are told to check. notify_all() is the right tool only when " +
      "multiple waiters might *simultaneously* be able to proceed after a state change (e.g. a " +
      "multi-slot pool where release() frees several slots at once, or a broadcast-style " +
      "'all threads should now re-evaluate a fundamentally changed condition' signal, such as " +
      "shutdown). Reaching for it reflexively on every condition variable, including " +
      "single-consumer single-signal cases like this one, is a common and measurable performance " +
      "anti-pattern once thread counts get high. Nothing here is a correctness bug, incidentally: " +
      "every predicate check happens with the mutex held, since cv.wait reacquires it before " +
      "evaluating pred and before returning.",
    references: [
      "https://en.cppreference.com/w/cpp/thread/condition_variable/notify_all",
      "https://en.cppreference.com/w/cpp/thread/condition_variable/notify_one",
    ],
  },
  {
    id: "concurrency-lost-wakeup-01",
    category: "concurrency",
    difficulty: "hard",
    title: "Checking a condition variable's predicate outside the mutex",
    tags: ["condition-variable", "lost-wakeup", "mutex", "race-condition"],
    type: "trace",
    prompt:
      "This is a different bug from the classic spurious-wakeup issue (where cv.wait can return " +
      "without any notify at all, fixed by looping/re-checking the predicate). Here the predicate " +
      "check and the wait() call are correctly using while-style re-checking, but the check " +
      "happens *outside* the mutex, as two separate steps. What can go wrong?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::mutex mtx;
std::condition_variable cv;
bool ready = false;

void waiter() {
    while (!ready) {                        // <-- read WITHOUT holding mtx
        std::unique_lock<std::mutex> lock(mtx);
        cv.wait(lock);                      // <-- separate step: re-lock, then wait
    }
    do_work();
}

void notifier() {
    { std::lock_guard<std::mutex> lock(mtx); ready = true; }
    cv.notify_one();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing is wrong: re-checking the condition in a loop rather than with a single `if` is sufficient whether or not the mutex is held during the check",
        "The spurious-wakeup problem in a different costume, with the same fix: switch to the predicate overload cv.wait(lock, predicate)",
        "A notify_one() landing in the gap between the unlocked read of `ready` and waiter's entry into cv.wait() is lost, and waiter then blocks with no further notification coming",
        "Undefined behavior: locking a std::mutex through a std::unique_lock declared inside a loop body is not permitted",
      ],
      correctIndex: 2,
    },
    explanation:
      "Spurious wakeup and lost wakeup are opposite failure directions, and this is the second " +
      "one. Spurious wakeup is wait() returning with nothing having happened, cured by " +
      "re-validating the predicate after every return from wait(). Lost wakeup is a real " +
      "notify_one()/notify_all() that has no effect because no thread was registered as waiting " +
      "on the condition variable at that instant; notifications are not queued or remembered for " +
      "a future waiter. The bug here is structural. Checking `!ready` and calling `cv.wait(lock)` " +
      "are two separate, non-atomic steps, and the read of `ready` does not even hold the mutex. " +
      "The correct contract depends on the predicate check and the act of becoming a registered " +
      "waiter being atomic with respect to the mutex: wait() only unlocks the mutex and begins " +
      "waiting while the calling thread still holds the lock across both, so notifier() cannot " +
      "acquire the mutex, set ready = true, and reach notify_one() in between. In the version " +
      "above, waiter reads `ready` with no lock held, so notifier can run its whole critical " +
      "section and notify_one() in the gap before waiter locks and waits. The signal fires while " +
      "nobody is listening, and waiter then blocks until some unrelated, coincidental wakeup " +
      "happens to arrive. The fix is the predicate overload under a single lock acquisition: " +
      "`std::unique_lock<std::mutex> lock(mtx); cv.wait(lock, [] { return ready; });`. Never read " +
      "the predicate variable without the mutex already held.",
    references: [
      "https://en.cppreference.com/w/cpp/thread/condition_variable/wait",
    ],
  },
  {
    id: "concurrency-shared-mutex-writer-starvation-01",
    category: "concurrency",
    difficulty: "medium",
    title: "A std::shared_mutex writer waiting behind a continuous reader stream",
    tags: ["shared_mutex", "reader-writer-lock", "starvation"],
    type: "trace",
    prompt:
      "A single writer thread calls tryUpdate() once and blocks waiting for the unique_lock. " +
      "Meanwhile, a steady, overlapping stream of new reader threads keeps arriving, each taking " +
      "and releasing a shared_lock quickly, such that at least one reader is essentially always " +
      "holding the lock in shared mode. What is guaranteed to eventually happen to the writer?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::shared_mutex rw;
int sharedValue = 0;

void reader() {
    while (true) {
        std::shared_lock<std::shared_mutex> lock(rw);
        int v = sharedValue;   // brief read
        (void)v;
    }
}

void tryUpdate() {
    std::unique_lock<std::shared_mutex> lock(rw);   // waiting to acquire exclusive access
    sharedValue++;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It eventually acquires the lock: the standard requires an implementation to block any new shared_lock attempt once a unique_lock is pending, so the reader pipeline drains and the writer proceeds",
        "Nothing is guaranteed: shared_mutex specifies no ordering or fairness policy between a pending writer and newly-arriving readers, so a conforming implementation may admit new readers indefinitely and starve the writer",
        "The program deadlocks immediately, since a std::shared_lock and a std::unique_lock on the same shared_mutex object cannot coexist even momentarily",
        "It wins on its very next attempt after any reader releases, since exclusive acquisition outranks shared acquisition by the definition of 'exclusive' access",
      ],
      correctIndex: 1,
    },
    explanation:
      "The concrete failure mode here is writer starvation under continuous reader arrival. Even " +
      "though no single reader holds the lock for long, and even though the writer began waiting " +
      "first, nothing in the standard requires an implementation to stop granting shared_lock to " +
      "new readers just because a writer is already queued. As long as the reader stream stays " +
      "dense enough that the shared-mode reader count never drops to zero at a moment the " +
      "implementation checks, a conforming (if unfair) implementation may let readers keep " +
      "cutting in line ahead of the waiting writer forever. That makes indefinite starvation " +
      "conforming behavior, not a bug in the library. The hazard is operational rather than " +
      "theoretical: high-read-throughput services such as a cache or config store that is read " +
      "constantly and updated rarely are precisely the workload that maximizes the density of " +
      "overlapping readers. Some standard library implementations do bias toward writers to avoid " +
      "this, but that is a quality-of-implementation choice rather than a portable guarantee. " +
      "Code that must bound writer wait time needs either an implementation verified to " +
      "prioritize writers, or a hand-rolled reader-writer lock with an explicit writer-priority " +
      "policy, such as a pending-writer flag that reader() checks before acquiring so new readers " +
      "block once a writer is waiting.",
    references: [
      "https://en.cppreference.com/w/cpp/thread/shared_mutex",
      "https://en.cppreference.com/w/cpp/named_req/SharedMutex",
    ],
  },
  {
    id: "concurrency-recursive-mutex-01",
    category: "concurrency",
    difficulty: "medium",
    title: "A locked method calling a helper that locks the same mutex",
    tags: ["recursive_mutex", "mutex", "deadlock", "reentrancy"],
    type: "trace",
    prompt:
      "doWork() locks the object's mutex, then calls helper(), which is also a method of the " +
      "same object and also locks the same mutex. Both calls happen on the same thread, and as " +
      "written `mtx` is a std::mutex. What happens when doWork() is called, and how (if at " +
      "all) would replacing std::mutex with std::recursive_mutex change the outcome?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Widget {
public:
    void doWork() {
        std::lock_guard<std::mutex> lock(mtx);
        // ... some work ...
        helper();                          // same thread, same object
    }
    void helper() {
        std::lock_guard<std::mutex> lock(mtx);   // locking mtx again!
        // ... more work ...
    }
private:
    std::mutex mtx;
};`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Undefined behavior per the standard, and a self-deadlock inside helper() on mainstream implementations; std::recursive_mutex fixes it by tracking an owning thread plus a recursion count, released only on the matching unlock",
        "std::mutex handles this safely: helper() blocks until doWork() returns and releases the lock, then proceeds normally, so switching to std::recursive_mutex would buy nothing but a little less latency",
        "Both std::mutex and std::recursive_mutex throw std::system_error the moment a thread relocks a mutex it already holds, so the difference is exception versus silent success, not deadlock versus success",
        "The two types behave identically here; 'recursive' refers only to being safe to use inside recursive functions, which is orthogonal to being locked twice by one thread",
      ],
      correctIndex: 0,
    },
    explanation:
      "std::mutex is explicitly specified as producing undefined behavior if a thread that " +
      "already owns the mutex attempts to lock it again without first unlocking it " +
      "([thread.mutex.requirements.mutex]). It is not a recursive or reentrant primitive. In " +
      "practice, most implementations (including glibc's pthread-based one on Linux and the " +
      "typical macOS/Windows implementations) deadlock: the thread blocks waiting for the " +
      "lock to become available, but the only thread that could release it is itself, currently " +
      "blocked. Here that means helper()'s lock_guard construction inside doWork() never " +
      "completes and the calling thread hangs. On those implementations the hang is deterministic " +
      "for this call structure rather than merely possible, but the program is still formally UB, " +
      "so nothing obliges an implementation to hang rather than do something stranger. " +
      "std::recursive_mutex is built for exactly " +
      "this case: it tracks an owning thread ID plus an internal lock count, allowing the " +
      "same thread to lock it any number of additional times (each such call succeeds " +
      "immediately rather than blocking), and it only becomes available to a different thread " +
      "once the owning thread has issued a matching number of unlock() " +
      "calls. So switching mtx to std::recursive_mutex here makes the program work: " +
      "doWork() locks once, helper() locks again (now succeeding, count becomes 2), helper() " +
      "unlocks (count back to 1), and doWork()'s lock_guard destructor performs the final unlock " +
      "(count 0), truly releasing the mutex. Caveat: a class whose " +
      "methods call other methods on `this` that redundantly relock the same mutex is usually " +
      "considered a design smell even when recursive_mutex papers over it. It often signals the " +
      "locking granularity is wrong (the outer method should factor out an unlocked private " +
      "helper, or the public/private split should separate locked entry points from " +
      "already-locked internals) rather than a genuine need for reentrant locking semantics.",
    references: [
      "https://en.cppreference.com/w/cpp/thread/mutex",
      "https://en.cppreference.com/w/cpp/thread/recursive_mutex",
    ],
  },
  {
    id: "concurrency-thread-pool-self-deadlock-01",
    category: "concurrency",
    difficulty: "medium",
    title: "Nested submission to a fixed-size thread pool",
    tags: ["thread-pool", "deadlock", "packaged_task", "std-future"],
    type: "trace",
    prompt:
      "A thread pool has exactly 2 worker threads. Both workers are simultaneously given a task " +
      "of the shape shown: the task itself calls pool.submit() to enqueue a *new* task on the " +
      "same pool, then calls .get() on the resulting future to synchronously wait for that new " +
      "task's result before returning. What happens?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class ThreadPool {
public:
    ThreadPool(size_t n);   // spawns n worker threads, each looping: pull job from queue, run it
    std::future<int> submit(std::function<int()> job);   // enqueues job, wakes a worker, returns its future
    // ...
};

ThreadPool pool(2);   // exactly 2 worker threads

auto f1 = pool.submit([&pool] {
    auto inner = pool.submit([] { return 1; });   // enqueue a second task on the SAME pool
    return inner.get();                            // block this worker until it completes
});
auto f2 = pool.submit([&pool] {
    auto inner = pool.submit([] { return 2; });
    return inner.get();
});

f1.get();   // caller waits for the outer tasks
f2.get();`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No problem: the pool queues the inner tasks and runs them once a worker frees up, so f1.get() and f2.get() eventually return 1 and 2 with some added latency",
        "Compile error: a task running on a pool worker thread is not permitted to call pool.submit() on the same pool instance",
        "Only one of f1/f2 hangs; the other's inner task is guaranteed to run inline on the calling thread once the pool detects it is fully occupied",
        "Deadlock: both workers are parked inside inner.get(), leaving nobody to dequeue either inner task, so neither outer task nor f1.get()/f2.get() ever completes",
      ],
      correctIndex: 3,
    },
    explanation:
      "This is a classic, real-world thread-pool design pitfall usually described as pool " +
      "exhaustion or self-deadlock via recursive/nested submission. With exactly 2 workers and 2 " +
      "outer tasks submitted, both workers become occupied running the outer lambdas. Each outer " +
      "lambda then does two things: it enqueues a brand-new inner task onto the pool's shared " +
      "queue (a cheap, non-blocking operation, since submit() just pushes work and returns a " +
      "future immediately), and then it synchronously blocks the *current worker thread* on " +
      "inner.get(), waiting for that inner task's result. But the inner tasks can only ever be " +
      "picked up and executed by one of the pool's worker threads, and both worker threads are " +
      "now blocked inside outer tasks, waiting on futures that depend on those very inner tasks " +
      "running. No worker is left free to dequeue and execute either inner task, so neither " +
      "inner.get() call can ever return, which means neither outer task can ever return, which " +
      "means f1.get() and f2.get() on the calling thread block forever too. This generalizes: " +
      "any fixed-size pool where N tasks are simultaneously occupying all N workers, and each of " +
      "those tasks synchronously depends on a *new* task being run by that same pool, deadlocks " +
      "regardless of pool size. It only takes as many concurrently-blocking nested submissions " +
      "as there are workers. Common mitigations: never block a pool worker thread waiting on " +
      "another task submitted to the same pool (restructure as continuations/callbacks instead of " +
      "blocking .get(), e.g. via a future::then-style chain or a work-stealing design where an " +
      "idle wait can itself execute queued work); reserve a separate dedicated pool for tasks " +
      "that need to submit-and-wait; or bound nesting depth and grow the pool accordingly. " +
      "Structurally this is the thread-pool analogue of a lock-order deadlock, a " +
      "resource-acquisition cycle in which the exhausted resource is a free worker thread rather " +
      "than a mutex.",
    references: [
      "https://en.cppreference.com/w/cpp/thread/packaged_task",
      "https://en.cppreference.com/w/cpp/thread/future",
    ],
  },
  {
    id: "concurrency-atomic-flag-spinlock-01",
    category: "concurrency",
    difficulty: "medium",
    title: "A hand-rolled spinlock built on std::atomic_flag",
    tags: ["atomic_flag", "spinlock", "lock-free"],
    type: "trace",
    prompt:
      "SpinLock is hand-implemented using std::atomic_flag's test_and_set()/clear() interface. " +
      "Four threads each run the loop shown, incrementing a shared counter 100,000 times under " +
      "the spinlock. What is the most accurate statement about this code and about " +
      "std::atomic_flag in general?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class SpinLock {
    std::atomic_flag flag = ATOMIC_FLAG_INIT;
public:
    void lock() {
        while (flag.test_and_set(std::memory_order_acquire)) {
            // busy-wait
        }
    }
    void unlock() {
        flag.clear(std::memory_order_release);
    }
};

SpinLock sl;
long counter = 0;

void worker() {
    for (int i = 0; i < 100000; ++i) {
        sl.lock();
        ++counter;
        sl.unlock();
    }
}
// 4 threads each run worker(), then join; main prints counter`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Correct, always 400000: std::atomic_flag is the one standard type unconditionally guaranteed lock-free everywhere, which is why its interface is so spare; std::mutex is still the better default outside very short critical sections",
        "Correct, always 400000, but the technique is pointless: std::atomic<bool> carries the same unconditional lock-free guarantee and would implement an identical spinlock with a friendlier interface",
        "The program has a data race on `counter`: std::atomic_flag's test_and_set/clear do not establish the acquire/release relationship a real mutex does, so the printed total is unpredictable",
        "std::atomic_flag cannot implement a spinlock at all: it exposes no boolean read operation (no load()), only test_and_set and clear, leaving a waiter no way to poll the lock without taking it",
      ],
      correctIndex: 0,
    },
    explanation:
      "std::atomic_flag holds a special place in the standard: [atomics.flag] guarantees it is " +
      "always lock-free, unconditionally, on every conforming implementation. No is_lock_free() " +
      "or is_always_lock_free() query even exists for it, since there is no 'maybe' left to " +
      "query. std::atomic<T> for other types, by " +
      "contrast, exposes is_always_lock_free (a compile-time constant) and is_lock_free() (a " +
      "runtime check) because whether a given T's atomic operations can be implemented without a " +
      "hidden lock depends on the platform, T's size and alignment, and the standard library " +
      "implementation. Even std::atomic<bool> and std::atomic<int> are only conventionally, not " +
      "universally, lock-free. atomic_flag's interface is deliberately spartan (historically " +
      "just test_and_set() and clear(), with a load-like test() added in C++20) because that " +
      "minimalism is what made the unconditional guarantee tractable to specify across " +
      "all hardware: it maps directly onto a hardware test-and-set primitive with no need for a " +
      "compare-and-swap loop, a wider CAS, or a fallback lock. test_and_set(memory_order_acquire) " +
      "atomically sets the flag and returns its previous value, so lock() spins exactly while some " +
      "other thread already holds it; clear(memory_order_release) releases it with a matching " +
      "release. That acquire/release pairing establishes happens-before for `counter` " +
      "the same way a mutex's lock/unlock would, so there is no data race and the program reliably " +
      "prints 400000. The practical caveat is the same one that applies to any spinlock: because " +
      "waiting here means busy-polling rather than yielding to the OS scheduler, it wastes CPU " +
      "cycles under contention and can perform far worse than std::mutex if a lock holder is ever " +
      "preempted mid-critical-section or if critical sections are not extremely short. " +
      "The unconditional lock-free guarantee makes std::atomic_flag the natural low-level building " +
      "block for a spinlock; it does not make spinning the right choice " +
      "for general-purpose, possibly-long-held locks.",
    references: [
      "https://en.cppreference.com/w/cpp/atomic/atomic_flag",
      "https://en.cppreference.com/w/cpp/atomic/atomic/is_lock_free",
    ],
  },
  {
    id: "concurrency-cas-contention-backoff-01",
    category: "concurrency",
    difficulty: "hard",
    title: "A CAS retry loop with no backoff under heavy contention",
    tags: ["cas", "atomics", "contention", "backoff", "performance"],
    type: "trace",
    prompt:
      "Eight threads all repeatedly increment the same std::atomic<int> via a naive " +
      "compare_exchange_weak retry loop with no backoff, as shown. Under heavy contention " +
      "(many more threads than cores, all hammering the same atomic), what actually happens " +
      "to throughput, and does this count as a correctness bug the way livelock or deadlock does?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::atomic<int> counter{0};

void bump() {
    int old = counter.load(std::memory_order_relaxed);
    while (!counter.compare_exchange_weak(
               old, old + 1, std::memory_order_relaxed)) {
        // retry immediately: no pause, no backoff
    }
}

// 8 threads each call bump() in a tight loop, millions of times`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No measurable effect: compare_exchange_weak is a single hardware instruction, so contention among any number of threads is essentially free and throughput scales linearly with thread count.",
        "The program deadlocks, since compare_exchange_weak cannot be executed by two threads at the same instant on the same atomic.",
        "Livelock in the formal sense: every failing thread is by definition not making progress, so the system-wide guarantee lock-free algorithms provide is violated and the program is incorrect.",
        "Throughput collapses while correctness holds: the loop stays lock-free, but the shared line ping-pongs between cores and most attempts are wasted work, which is what backoff exists to mitigate.",
      ],
      correctIndex: 3,
    },
    explanation:
      "This is a genuine, well-documented performance failure mode distinct from livelock or " +
      "deadlock: the algorithm remains correctly lock-free the entire time. By the formal " +
      "definition, a failed CAS on one thread always corresponds to some other thread's CAS " +
      "having just succeeded, so the shared counter genuinely keeps advancing and the system as " +
      "a whole makes bounded progress. What degrades is throughput, not correctness. With many " +
      "threads all spinning on compare_exchange_weak against the same atomic and no pause between " +
      "attempts, every thread reloads the cache line and attempts the CAS while N-1 other " +
      "threads do the same thing essentially simultaneously, so most attempts fail and the " +
      "cache line bounces between cores (MESI invalidate/re-fetch) far more often than the " +
      "single successful update per round actually requires. As thread count grows past the " +
      "number of successful updates that can physically land per unit time, the ratio of wasted " +
      "attempts to useful ones grows essentially without bound. That is contention " +
      "collapse: adding more threads makes the operation slower in " +
      "wall-clock terms, not faster, even though nothing is stuck. The standard mitigation is " +
      "backoff. Rather than retrying immediately after a failed CAS, insert a short pause (a CPU " +
      "PAUSE or YIELD instruction), or sleep for a small and often exponentially increasing " +
      "duration (capped, then reset on success), before the next attempt. That spreads " +
      "retries out in time, reduces the instantaneous number of threads hammering the same cache " +
      "line, and lets more attempts succeed per unit of coherence traffic, at the cost of " +
      "added latency for any individual thread's operation. That trade is worth making when the " +
      "alternative is throughput collapse under real contention. Keep this distinct from the " +
      "classic two-thread " +
      "mutual-yielding livelock, where threads that are supposed to eventually succeed never do " +
      "because of a persistent, symmetric mutual-avoidance pattern. Here every thread can and " +
      "does eventually succeed; the issue is purely how much wasted work the system does getting " +
      "there under contention.",
    references: [
      "https://en.cppreference.com/w/cpp/atomic/atomic/compare_exchange",
      "https://en.wikipedia.org/wiki/Exponential_backoff",
    ],
  },
  {
    id: "concurrency-coarse-grained-lock-01",
    category: "concurrency",
    difficulty: "medium",
    title: "One mutex guarding an entire hash table",
    tags: ["mutex", "lock-granularity", "striped-locking", "contention"],
    type: "trace",
    prompt:
      "Two threads call writeKey() concurrently with completely different keys (\"apple\" and " +
      "\"zebra\") that hash to different buckets in the underlying hash table. Given a single " +
      "mutex protecting the whole table, are these two calls able to proceed concurrently?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::mutex mtx;                              // one lock for the entire table
std::unordered_map<std::string, int> table;

void writeKey(const std::string& k, int v) {
    std::lock_guard<std::mutex> lock(mtx);
    table[k] = v;
}

// Thread 1: writeKey("apple", 1);
// Thread 2: writeKey("zebra", 2);   // different bucket, no real conflict`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No: the single mtx imposes a false dependency and serializes every call regardless of key, where striped locking over K mutexes chosen by hash would let non-colliding keys proceed genuinely in parallel.",
        "Yes: std::unordered_map internally locks only the bucket being touched, so two keys hashing to different buckets never contend regardless of the mutex wrapped around writeKey().",
        "No: the two simultaneous lock attempts on mtx deadlock against each other, since std::mutex has no queueing for acquirers that arrive at the same instant.",
        "Yes, but only because writeKey() uses operator[] rather than insert(), which internally bypasses the lock when creating a new key.",
      ],
      correctIndex: 0,
    },
    explanation:
      "A single coarse-grained mutex guarding an entire data structure is simple and always " +
      "correct, but it conflates two different notions of 'conflict': physical contention on the " +
      "lock object itself, and logical conflict between the operations being performed. Here, " +
      "writeKey(\"apple\", ...) and writeKey(\"zebra\", ...) touch entirely different buckets of " +
      "the hash table and have no data dependency on each other whatsoever, so a correct " +
      "concurrent implementation could run them fully in parallel with no risk to shared state. " +
      "But because both calls must acquire the exact same mtx, the second call cannot even begin " +
      "its critical section until the first releases the lock, regardless of which keys are " +
      "involved. That false dependency is purely an artifact of lock granularity, not of any " +
      "genuine data hazard. It becomes a real bottleneck as thread count and table size grow: contention on " +
      "the single mutex scales with total operation rate across all keys, not with the (much " +
      "smaller) rate of operations that actually collide on the same key or bucket. The standard " +
      "fix is finer-grained locking, most commonly striped or sharded locking, where the table is " +
      "partitioned into K independent regions (e.g., K mutexes, each guarding table_size/K " +
      "buckets), and a key's hash determines which single stripe's mutex must be held to touch " +
      "it. Two keys landing in different stripes can then be modified by different threads " +
      "genuinely concurrently; only keys that happen to hash into the same stripe still serialize " +
      "against each other. This is the same underlying design principle behind Java's original " +
      "ConcurrentHashMap (segment/stripe locking) and per-bucket locking schemes in production " +
      "concurrent hash maps. The price is extra memory and implementation complexity (K mutexes " +
      "instead of one, and operations that span multiple stripes, like resize or iteration, " +
      "becoming harder to reason about) in exchange for parallelism that a single coarse lock " +
      "structurally cannot provide, no matter how briefly it is held.",
    references: [
      "https://en.cppreference.com/w/cpp/thread/mutex",
      "https://en.wikipedia.org/wiki/Lock_(computer_science)#Granularity",
    ],
  },
  {
    id: "concurrency-thread-creation-overhead-01",
    category: "concurrency",
    difficulty: "medium",
    title: "Per-task thread spawn vs a fixed worker pool",
    tags: ["std-thread", "thread-pool", "performance", "scheduling"],
    type: "trace",
    prompt:
      "A server processes a steady, high-rate stream of small incoming tasks (say, microseconds " +
      "of actual work each). Version A spawns a brand-new std::thread per task and joins it " +
      "before handling the next one, as shown. Version B instead maintains a small fixed pool " +
      "of long-lived worker threads that pull tasks from a shared queue. As the task arrival " +
      "rate increases, which most accurately describes what happens to Version A?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `// Version A: a new OS thread per task, in a hot loop
while (moreTasksArriving()) {
    Task task = nextTask();
    std::thread t([task] { handle(task); });   // real OS thread spawn every time
    t.join();
}

// Version B (conceptually): a fixed pool of N long-lived worker threads
// that block on a shared queue and pull the next task when idle.
// No new OS thread is ever created per task.`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No meaningful difference: std::thread construction is a lightweight, purely userspace operation comparable in cost to a function call, so Version A scales identically to Version B as arrival rate grows.",
        "Version A eventually outperforms Version B, because a fresh thread per task guarantees perfect load balancing across cores with zero queue-contention overhead.",
        "Thread creation and teardown become the dominant cost: each spawn is real kernel work (a syscall, a fresh stack, scheduler registration) costing far more than the task itself, and join() discards it after one use.",
        "Version A is strictly safer than Version B because it can never suffer a thread-pool self-deadlock, so the performance difference between them is not a meaningful tradeoff to consider.",
      ],
      correctIndex: 2,
    },
    explanation:
      "std::thread's constructor is not a cheap userspace abstraction. Under the hood it makes " +
      "an actual OS thread-creation syscall (e.g., pthread_create on POSIX, CreateThread on " +
      "Windows), which involves the kernel allocating and initializing thread-control-block " +
      "state, allocating a new stack (often megabytes of virtual address space reserved, even if " +
      "not all committed), and registering the new thread with the OS scheduler so it can be " +
      "scheduled onto a core. All of that costs on the order of tens of microseconds in the best " +
      "case, and can be substantially worse under load, against the nanosecond-scale cost of an " +
      "ordinary function call. Version A pays this full setup-and-teardown cost for every single " +
      "task, no matter how little actual work that task does, and t.join() then throws all of it " +
      "away the moment the task completes. When task arrival rate is high and individual tasks " +
      "are small, the thread-creation overhead rather than the task's own logic dominates " +
      "wall-clock time, and the approach cannot keep pace once the arrival rate exceeds " +
      "roughly '1 / (thread-creation latency).' Version B's fixed worker pool instead pays the " +
      "OS-level thread-creation cost exactly once per worker, at startup, and then reuses those " +
      "already-running threads indefinitely: handing off a new task becomes pushing it onto a " +
      "shared queue and waking an idle worker (typically via a condition variable or a lock-free " +
      "queue plus a semaphore), which is orders of magnitude cheaper than spawning a kernel " +
      "thread. This is precisely the motivation for thread pools (and, at a different layer, for " +
      "task/coroutine-based concurrency): decouple the unit of concurrent work (a task) from the " +
      "unit of OS scheduling (a thread), so the expensive OS-level resource is created rarely and " +
      "reused often, rather than being created and destroyed on every task's critical path.",
    references: [
      "https://en.cppreference.com/w/cpp/thread/thread/thread",
    ],
  },
  {
    id: "concurrency-call-once-01",
    category: "concurrency",
    difficulty: "medium",
    title: "std::call_once with a std::once_flag for lazy initialization",
    tags: ["call_once", "once_flag", "initialization", "singleton"],
    type: "trace",
    prompt:
      "Eight threads all call getInstance() concurrently for the first time. initInstance() " +
      "does real work (allocating and constructing an object). Using std::call_once with a " +
      "std::once_flag as shown, how many times does initInstance() actually run, and what (if " +
      "anything) must the caller do about memory ordering to safely read `instance` afterward?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::once_flag initFlag;
Singleton* instance = nullptr;

void initInstance() {
    instance = new Singleton();
}

Singleton* getInstance() {
    std::call_once(initFlag, initInstance);
    return instance;   // no atomics, no memory_order, no mutex visible here
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "initInstance() may run once per thread that races to be first (up to 8 times here), and each caller must additionally add its own memory_order_acquire fence before reading `instance` to be safe.",
        "Exactly once across all 8 threads, and the completion of that one invocation happens-before every call_once on the same flag that returns having observed it as done, so no caller needs explicit atomics, a memory_order, or a second check.",
        "Exactly once, but std::call_once supplies no synchronization beyond preventing double-construction, so the caller must still publish `instance` to other threads through a separate atomic or mutex.",
        "std::call_once requires initInstance() to return a value (it cannot be void), so this code fails to compile.",
      ],
      correctIndex: 1,
    },
    explanation:
      "std::call_once, together with a std::once_flag, is the standard library's purpose-built " +
      "answer to 'run this exactly once, safely, no matter how many threads race to trigger it.' " +
      "The guarantee is precisely: among all calls to call_once on the same once_flag from any " +
      "number of threads, exactly one of them actually invokes the callable (here, " +
      "initInstance()) to completion (barring exceptions, which cause call_once to allow another " +
      "caller to retry). The others block until that invocation finishes and then return without " +
      "having run it themselves. Crucially for correctness, the standard also specifies the " +
      "necessary happens-before relationship: the completion of the single active invocation is " +
      "guaranteed to happen-before every other call_once invocation on the same flag that returns " +
      "having observed it as already complete. That is the same synchronizes-with edge the " +
      "naive double-checked-locking pattern has to " +
      "hand-build out of a release store paired with an acquire load, and the edge whose absence " +
      "breaks that pattern. With std::call_once, the caller writes no atomics, no " +
      "memory_order, and no manual second-check-inside-a-lock logic whatsoever; all 8 threads " +
      "calling getInstance() here are guaranteed to see instance pointing at a fully-constructed " +
      "Singleton, with initInstance() itself having executed exactly once. This makes call_once " +
      "strictly preferable to a hand-rolled double-checked-locking implementation in essentially " +
      "every case: it is simpler to write, leaves no memory-ordering subtleties for the caller to " +
      "get wrong, and (in most implementations) has a fast path for the already-initialized case " +
      "comparable to what a correct hand-rolled version would need anyway.",
    references: [
      "https://en.cppreference.com/w/cpp/thread/call_once",
      "https://en.cppreference.com/w/cpp/thread/once_flag",
    ],
  },
  {
    id: "concurrency-counting-semaphore-01",
    category: "concurrency",
    difficulty: "easy",
    title: "std::counting_semaphore limiting concurrent connections",
    tags: ["semaphore", "cpp20", "resource-pool", "rate-limiting"],
    type: "trace",
    prompt:
      "openConnection() is called by 10 threads concurrently, but the service must never have " +
      "more than 4 connections open at once. Using std::counting_semaphore<8> initialized to 4 " +
      "as shown, what behavior does this actually produce, and how does it differ fundamentally " +
      "from guarding the same code with a plain std::mutex?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::counting_semaphore<8> connectionSlots(4);   // supports >= 8 permits, starts with 4

void openConnection(int id) {
    connectionSlots.acquire();          // blocks if 4 permits are already taken
    doNetworkWork(id);                  // at most 4 of these run concurrently
    connectionSlots.release();          // frees one permit back up
}

// 10 threads each call openConnection(id) once`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Up to 4 threads hold a permit and run doNetworkWork() at once, with the rest blocked in acquire() until a release(); a mutex admits exactly one holder and has no count to generalize this way.",
        "Identical behavior to guarding doNetworkWork() with a single std::mutex: both admit exactly one thread into the critical section at a time, so at most 1 of the 10 calls runs concurrently, not 4.",
        "All 10 threads proceed immediately without blocking, since std::counting_semaphore<8>(4) bounds only the semaphore's own internal counter, not the number of threads calling acquire().",
        "The program deadlocks after the 4th call to acquire(), since std::counting_semaphore requires release() from the exact thread that acquired, and doNetworkWork() may migrate the caller across cores.",
      ],
      correctIndex: 0,
    },
    explanation:
      "std::counting_semaphore<LeastMaxValue> (C++20) generalizes mutual exclusion from 'exactly " +
      "one holder' to 'up to N holders,' which is precisely the right primitive when the resource " +
      "being protected is a pool of interchangeable slots rather than a single piece of shared " +
      "state. Internally it holds a counter, initialized here to 4. The template parameter is " +
      "LeastMaxValue, the smallest maximum an implementation must support rather than a hard cap, " +
      "so max() may legitimately report more than 8. acquire() atomically decrements the " +
      "counter and blocks the calling thread if the counter is already at zero, while release() " +
      "atomically increments the counter and, if any threads are blocked in acquire(), unblocks " +
      "one. With an initial count of 4, exactly 4 threads can be 'inside' (holding a permit) at " +
      "once; a 5th arriving thread blocks in acquire() until one of the 4 currently-executing " +
      "calls finishes and calls release(). This is fundamentally different from a std::mutex, " +
      "which structurally supports only a maximum of 1 concurrent holder. There is no 'count' " +
      "for a mutex to generalize; lock()/unlock() is binary. Using a semaphore here " +
      "instead of a mutex lets up to 4 network operations genuinely overlap in flight (useful " +
      "when doNetworkWork() itself spends most of its time blocked on I/O rather than CPU-bound), " +
      "while still enforcing a hard cap that prevents the service from ever exceeding, say, a " +
      "connection-pool or file-descriptor limit imposed by the OS or a downstream system. One " +
      "further difference: unlike std::mutex, a semaphore's acquire and release need not come " +
      "from the same thread, and a permit acquired by one thread can legally be released by " +
      "another. That is part of why semaphores also serve as a general " +
      "signaling and handoff primitive between threads, not only as a resource-pool limiter.",
    references: [
      "https://en.cppreference.com/w/cpp/thread/counting_semaphore",
    ],
  },
  {
    id: "concurrency-coroutines-vs-threads-01",
    category: "concurrency",
    difficulty: "medium",
    title: "Stackless coroutines vs one OS thread per connection",
    tags: ["coroutines", "cpp20", "co_await", "context-switch", "performance"],
    type: "trace",
    prompt:
      "A server needs to handle tens of thousands of concurrent, mostly-idle network " +
      "connections, each spending nearly all of its time waiting on I/O. handleConnection() " +
      "below is a C++20 stackless coroutine that suspends at co_await points instead of " +
      "blocking a thread. Compared to a naive one-OS-thread-per-connection design, what is the " +
      "core reason the coroutine approach scales to far higher connection counts?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `Task handleConnection(Socket sock) {
    while (auto request = co_await sock.readRequest()) {
        auto response = co_await computeResponse(*request);
        co_await sock.writeResponse(response);
    }
    // suspends here at each co_await, giving control back to
    // a small pool of OS threads that drive many such coroutines
}
// vs. the naive design: one std::thread per connection, each
// blocked inside a synchronous read() call waiting for I/O.`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "There is no fundamental cost difference: a coroutine suspend and an OS thread context switch both need the kernel scheduler to intervene and save/restore a full register set, so any gain comes from using less stack memory per connection.",
        "Suspending is a userspace state-machine transition: live locals move into the coroutine frame and control returns to the caller, with no syscall, no scheduler, and no per-connection stack, unlike a kernel-mediated thread switch.",
        "Coroutines scale better purely because co_await implicitly spawns a kernel thread only once I/O is actually ready, so the two designs differ only in creating OS threads lazily rather than eagerly.",
        "The scalability advantage is exclusive to networked I/O, since sockets are the only kind of resource in the C++ standard library that a coroutine is permitted to co_await on at all.",
      ],
      correctIndex: 1,
    },
    explanation:
      "The cost-model distinction is the crux of it. A C++20 stackless coroutine is a compiler " +
      "transformation: the function body is rewritten into a state machine object (the coroutine " +
      "frame, typically heap-allocated) that records exactly enough live state to resume at each " +
      "co_await/co_yield point. 'Suspending' is nothing more than returning control to whatever " +
      "resumed the coroutine, having stashed that live state in the frame; 'resuming' is calling " +
      "back into the state machine at the saved point. None of this involves the kernel at all: " +
      "no syscall, no scheduler decision, no full CPU register-set save/restore, and critically no " +
      "separate OS-allocated stack per coroutine, since a stackless coroutine's locals-across-" +
      "suspension live in the frame, not on a dedicated stack (this is precisely what " +
      "distinguishes 'stackless' coroutines from stackful fibers/green-threads, which do carry " +
      "their own stack). An OS thread context switch is categorically more expensive: the kernel " +
      "scheduler must save the outgoing thread's full register file, update its scheduling and " +
      "accounting state, select the next thread to run, restore that thread's register file, and " +
      "potentially flush or reload TLB entries if switching address-space context. That is real, " +
      "measurable overhead on the order of microseconds rather than nanoseconds, multiplied across " +
      "however many threads are being juggled. Worse, a thread-per-connection design also pays a " +
      "large fixed per-thread memory cost (a reserved stack, frequently a megabyte or more of " +
      "virtual address space by default) whether or not that thread is doing anything at a given " +
      "moment, and OS schedulers are not designed to efficiently juggle hundreds of thousands of " +
      "mostly-blocked threads. A coroutine-based design instead runs a small, fixed pool of OS " +
      "threads (sized to available CPU cores) that each drive many thousands of suspended-and-" +
      "resumed coroutines, paying the expensive kernel-level cost only rarely (per actual OS " +
      "thread) rather than per logical unit of concurrent work. It is the same amortization " +
      "principle as a thread pool over per-task threads, one level further down the stack.",
    references: [
      "https://en.cppreference.com/w/cpp/language/coroutines",
    ],
  },
  {
    id: "concurrency-spinlock-memory-order-01",
    category: "concurrency",
    difficulty: "hard",
    title: "A spinlock using memory_order_relaxed for test_and_set and clear",
    tags: ["atomic_flag", "spinlock", "memory-order", "acquire-release", "data-race"],
    type: "trace",
    prompt:
      "Both lock() and unlock() below use memory_order_relaxed. Two threads use this spinlock " +
      "to protect increments of a plain (non-atomic) `shared` counter. Mutual exclusion on the " +
      "flag itself (never two threads simultaneously past test_and_set()) is not in question " +
      "here. Is that enough to make `shared++` safe?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Spinlock {
    std::atomic_flag flag = ATOMIC_FLAG_INIT;
public:
    void lock() {
        while (flag.test_and_set(std::memory_order_relaxed)) {
            // spin
        }
    }
    void unlock() {
        flag.clear(std::memory_order_relaxed);
    }
};

Spinlock lk;
int shared = 0;   // plain, non-atomic, protected only by lk (supposedly)

void worker() {
    lk.lock();
    shared++;      // read-modify-write on plain int
    lk.unlock();
}
// Thread 1: worker();   Thread 2: worker();`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: only one thread can be between test_and_set() and clear() at a time, so `shared++` never physically executes concurrently on two threads and no synchronization beyond exclusion is needed.",
        "No, but only because ATOMIC_FLAG_INIT is deprecated in C++20, so the code fails to compile on a conforming C++20 implementation regardless of which memory_order is used.",
        "Yes for mutual exclusion, but the program is unconditionally UB anyway, since std::atomic_flag may never be used to build a spinlock; only std::atomic<bool> is permitted for that.",
        "No: relaxed establishes no synchronizes-with edge, so the next holder is not guaranteed to observe the previous holder's writes, making `shared` a data race; the fix is acquire on test_and_set() and release on clear().",
      ],
      correctIndex: 3,
    },
    explanation:
      "This is a sharper trap than 'spinlocks are just slower than mutexes': using " +
      "memory_order_relaxed for both test_and_set() and clear() still yields correct mutual " +
      "exclusion in the narrow sense. The flag's own atomicity guarantees only one thread is ever " +
      "'inside' the lock/unlock region at a time, so two threads never simultaneously execute " +
      "shared++ as far as instruction interleaving goes. But mutual exclusion alone " +
      "is not what makes a lock correct for protecting shared memory; a lock must also establish a " +
      "happens-before edge from the critical section of one holder to the critical section of the " +
      "next holder, so that writes made under the lock become visible, in order, to whoever " +
      "acquires it next. memory_order_relaxed provides no such guarantee: it only ensures the flag " +
      "operations themselves are atomic, not that anything sequenced around them is ordered " +
      "relative to other threads. Concretely, nothing here stops the compiler from reordering " +
      "`shared++` to execute after clear() from the perspective of another core, or stops the " +
      "hardware from letting a subsequent lock()-ing thread observe a stale, pre-increment value " +
      "of `shared` even though it correctly observed the flag transition to 'unlocked.' That makes " +
      "the accesses to `shared` a genuine data race, formally undefined behavior per the C++ " +
      "object model, and indistinguishable in kind from the classic relaxed-flag producer/" +
      "consumer bug elsewhere in this set, just dressed up as a hand-rolled lock instead of an " +
      "explicit flag variable. The fix mirrors what std::mutex guarantees internally: " +
      "lock()'s test_and_set() must use memory_order_acquire (so nothing sequenced after it in the " +
      "critical section can be reordered before it, and it synchronizes-with the release that " +
      "granted access), and unlock()'s clear() must use memory_order_release (so everything " +
      "written in the critical section is published before the flag is cleared). With that " +
      "acquire/release pairing restored, the spin loop's mutual exclusion is joined by a genuine " +
      "happens-before relationship and `shared++` becomes safe. Treat that as a correctness fix " +
      "rather than a performance tweak: the relaxed version is not merely slow, it is broken.",
    references: [
      "https://en.cppreference.com/w/cpp/atomic/atomic_flag",
      "https://en.cppreference.com/w/cpp/atomic/memory_order",
    ],
  },
];
