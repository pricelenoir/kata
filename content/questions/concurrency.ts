import type { TraceQuestion } from "@/types/question";

export const concurrencyQuestions: TraceQuestion[] = [
  {
    id: "concurrency-relaxed-ordering-01",
    category: "concurrency",
    difficulty: "hard",
    title: "memory_order_relaxed flag/data pattern",
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
        "Always prints 42",
        "Always prints 0",
        "Undefined behavior — this is a data race on `data`, even though the atomic ops themselves are well-defined",
        "Compile error: `data` must be atomic",
      ],
      correctIndex: 2,
    },
    explanation:
      "`memory_order_relaxed` guarantees atomicity of the `ready` operations but establishes " +
      "no *synchronizes-with* relationship between the store in `producer` and the load in " +
      "`consumer`. So even after `consumer` observes `ready == true`, nothing guarantees it " +
      "sees `producer`'s write to the plain (non-atomic) `data`. That makes the access to " +
      "`data` a genuine data race — formally undefined behavior — not merely \"maybe stale.\" " +
      "Fix: use `memory_order_release` on the store and `memory_order_acquire` on the load " +
      "(or seq_cst), which establishes happens-before and guarantees 42 is always observed.",
  },
  {
    id: "concurrency-false-sharing-02",
    category: "concurrency",
    difficulty: "medium",
    title: "False sharing between adjacent atomics",
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
        "Data race / undefined behavior on `a` and `b`",
        "Deadlock between the two threads",
        "Both counters end up correct, but the program runs far slower than expected due to false sharing",
        "Compile error: atomics cannot be adjacent struct members",
      ],
      correctIndex: 2,
    },
    explanation:
      "Each `fetch_add` is individually atomic and correctly synchronized — no race, no UB, " +
      "final values are correct. The problem is purely performance: `a` and `b` land on the " +
      "same cache line, so every write by one core invalidates that line in the other core's " +
      'cache (cache coherence "ping-pong"), even though the threads never touch the same ' +
      "logical variable. Fix: pad/align each counter to its own cache line, e.g. " +
      "`alignas(64) std::atomic<long> a;`.",
  },
  {
    id: "concurrency-seq-cst-vs-relaxed-03",
    category: "concurrency",
    difficulty: "hard",
    title: "Sequential consistency total order (store-buffering litmus test)",
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
      "A.storeX — a cycle, which is impossible in a total order. So (0,0) cannot occur under " +
      "seq_cst. This is exactly what seq_cst adds beyond acquire/release or relaxed: with " +
      "memory_order_relaxed instead, this classic 'store buffering' litmus test *can* produce " +
      "r1==0 && r2==0, because relaxed provides no shared total order tying the two threads' " +
      "operations together — each variable only has its own per-location modification order.",
  },
  {
    id: "concurrency-acquire-release-producer-consumer-04",
    category: "concurrency",
    difficulty: "medium",
    title: "Correctly synchronized producer/consumer with release/acquire",
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
        "Always prints 42 — guaranteed by the standard",
        "Undefined behavior — still a data race on `data`",
        "Prints 0 or 42 nondeterministically, but well-defined either way",
        "Always prints 0",
      ],
      correctIndex: 0,
    },
    explanation:
      "A release store synchronizes-with an acquire load that reads the value it stored (or a " +
      "later value in the same release sequence). Once consumer's acquire load observes " +
      "ready==true, that synchronizes-with edge links producer's store to consumer's load, and " +
      "combined with the intra-thread sequenced-before relations — `data = 42` is " +
      "sequenced-before the release store, and the acquire load is sequenced-before the read of " +
      "`data` — the standard's happens-before relation transitively connects producer's write to " +
      "`data` to consumer's read of it. Happens-before guarantees visibility, so the read always " +
      "observes 42: no race, no UB. This is the direct fix for the earlier relaxed example — it's " +
      "the *synchronizes-with* relationship, not merely the atomicity of `ready`, that makes " +
      "cross-thread visibility of `data` guaranteed.",
  },
  {
    id: "concurrency-mutex-vs-spinlock-05",
    category: "concurrency",
    difficulty: "medium",
    title: "Spinlock vs mutex under preemption",
    tags: ["mutex", "spinlock", "scheduling"],
    type: "trace",
    prompt:
      "Four threads run on a 4-core machine. Thread T1 acquires a lock and, while holding it, " +
      "is preempted by the OS scheduler before releasing it (e.g., its time slice ends on a " +
      "timer interrupt). The other three threads are all waiting to acquire the same lock. " +
      "Which lock implementation is most likely to make this scenario dramatically worse, and why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "std::mutex — because it always makes at least one syscall per lock/unlock, which is slower than spinning",
        "A spinlock — the three waiting threads burn full CPU time slices busy-polling and cannot help T1 get rescheduled sooner, so the effective wait can balloon; std::mutex would instead block the waiters and let the OS scheduler prioritize running T1 again",
        "Neither — both implementations behave identically once contention exists",
        "A spinlock — spinning threads corrupt the lock's internal state under preemption, causing undefined behavior",
      ],
      correctIndex: 1,
    },
    explanation:
      "Spinlocks only make sense when critical sections are short and lock-hold times are bounded " +
      "and small — ideally shorter than the cost of a context switch — typically in pinned, " +
      "real-time-ish HPC code where preemption during the critical section is not expected. Here, " +
      "once T1 is preempted while holding the lock, the three spinning waiters keep consuming full " +
      "CPU cycles polling the lock state, yet none of that spinning helps the scheduler run T1 " +
      "again sooner — it can even actively compete with T1 for cores. std::mutex-based waiters " +
      "instead block (typically via a futex-style OS wait), consuming essentially no CPU, which " +
      "lets the scheduler run T1 to completion and release the lock. Spinlocks trade wakeup " +
      "latency for CPU burn, a trade that's only favorable when preemption of the lock holder is " +
      "not a concern; under general-purpose OS scheduling with oversubscription, they can perform " +
      "far worse than a mutex.",
  },
  {
    id: "concurrency-lock-order-deadlock-06",
    category: "concurrency",
    difficulty: "medium",
    title: "Deadlock from inconsistent lock ordering",
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
        "The program deadlocks on every single run — inconsistent lock order always deadlocks",
        "The program never deadlocks because std::lock_guard prevents it automatically",
        "The program may or may not deadlock on any given run — it deadlocks only when both threads happen to acquire their first lock before either attempts its second, so it can appear to work fine for many iterations before hanging",
        "Compile error: mtx1 and mtx2 must be locked together via std::lock()",
      ],
      correctIndex: 2,
    },
    explanation:
      "Acquiring two mutexes in opposite order across threads is a classic deadlock hazard, but " +
      "it is not a deterministic one: deadlock requires the specific interleaving where A holds " +
      "mtx1 and B holds mtx2 at the same time, each then blocking forever on the other's mutex " +
      "(here all but guaranteed by the sleep between the two locks, but in real code the window " +
      "can be a handful of instructions). If the scheduler happens to run one thread past its " +
      "second lock before the other starts contending, no deadlock occurs that run. That timing " +
      "dependence is exactly what makes lock-order bugs so dangerous in production: code can pass " +
      "thousands of test runs and still deadlock later under different scheduling, load, or " +
      "hardware. The robust fix is to always acquire multiple locks in a single, globally " +
      "consistent order, or to acquire them together via std::lock(mtx1, mtx2) (or C++17's " +
      "std::scoped_lock(mtx1, mtx2)), which uses a deadlock-avoidance algorithm internally.",
  },
  {
    id: "concurrency-livelock-07",
    category: "concurrency",
    difficulty: "easy",
    title: "Livelock from symmetric lock backoff",
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
        "Deadlock — both threads block forever, each holding one lock",
        "Livelock — both threads keep acquiring/releasing their first lock and yielding in lockstep, actively executing yet never both succeeding at the same time, so neither makes forward progress",
        "The threads always succeed within two iterations because try_lock guarantees fairness between competing threads",
        "Undefined behavior — try_lock cannot be called while the calling thread already holds a different mutex",
      ],
      correctIndex: 1,
    },
    explanation:
      "This pattern avoids deadlock (neither thread ever blocks indefinitely on a held lock) but " +
      "introduces livelock: unlike deadlock, both threads remain actively running — locking, " +
      "failing try_lock, unlocking, yielding, and retrying — yet if their timing stays " +
      "synchronized, neither ever holds both locks simultaneously, so no forward progress is " +
      "made despite full CPU activity. This is precisely what distinguishes livelock from " +
      "deadlock: threads are not blocked/waiting, they're busy but unproductive. Real schedulers " +
      "rarely sustain perfect lockstep indefinitely — a stray interrupt or scheduling jitter " +
      "usually breaks the symmetry eventually — but the hazard is real and reproducible, " +
      "especially under synchronized or lockstep-like scheduling. The standard fix is randomized " +
      "(exponential) backoff instead of an unconditional yield, which breaks the symmetry " +
      "deliberately rather than hoping the scheduler will.",
  },
  {
    id: "concurrency-cv-spurious-wakeup-08",
    category: "concurrency",
    difficulty: "medium",
    title: "Condition variable spurious wakeup",
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
        "Nothing — cv.wait always returns only after notify_one/notify_all is called and the predicate is true",
        "Bug: cv.wait is permitted to return spuriously (with no notify at all), and even setting spurious wakeups aside, a woken thread must re-validate the predicate rather than assume the wakeup it received corresponds to the state it expects — an `if` checks once and trusts a wait that may not be legitimate",
        "Bug: `if` causes a deadlock because it doesn't release the lock before waiting",
        "Undefined behavior: the standard requires `while` around cv.wait, and using `if` is UB",
      ],
      correctIndex: 1,
    },
    explanation:
      "cv.wait(lock) atomically unlocks the mutex and blocks, then re-locks it before returning — " +
      "but the standard explicitly permits spurious wakeups: wait() may return even though no " +
      "thread ever called notify_one or notify_all. Even without spurious wakeups, multiple " +
      "waiters can be released by a single notify_all where only one's precondition is actually " +
      "satisfied, or a waiter can be scheduled to observe a wakeup before the writer's changes " +
      "are what it expects. An `if` checks the predicate exactly once and blindly trusts that the " +
      "wait was legitimate. The only correct pattern is `while (!ready) cv.wait(lock);` (or the " +
      "predicate overload `cv.wait(lock, []{ return ready; })`, which performs exactly this loop " +
      "internally), re-validating the predicate after every wakeup, spurious or not. This is not " +
      "UB by itself — it's a logic bug: do_work() can run with `ready` still false, potentially " +
      "reading incompletely-initialized shared state.",
  },
  {
    id: "concurrency-aba-problem-09",
    category: "concurrency",
    difficulty: "hard",
    title: "ABA problem in a lock-free stack pop",
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
        "compare_exchange_weak correctly fails, because head's identity effectively changed since Thread 1 first read it",
        "compare_exchange_weak spuriously succeeds because head == A again (the ABA problem) — head is set to the stale B computed by Thread 1, silently corrupting the stack (C becomes unreachable and B, already reused/freed, is reintroduced)",
        "The program deadlocks, because two threads cannot both call compare_exchange_weak on the same atomic concurrently",
        "Undefined behavior due to a data race on head, unrelated to the specific values involved",
      ],
      correctIndex: 1,
    },
    explanation:
      "compare_exchange_weak only compares head's current bit-pattern value against oldHead — it " +
      "has no notion of whether that value changed and changed back in the interim. Since head is " +
      "A both when Thread 1 first read it and when it CASes, the CAS succeeds and installs " +
      "newHead=B, a pointer Thread 1 computed from now-stale (and possibly reused) memory, even " +
      "though the true top of stack should be C. This is the canonical ABA problem: the CAS " +
      "observes 'A' and assumes nothing relevant happened, when in fact the structure was " +
      "mutated twice and coincidentally returned to the same pointer value. Standard mitigations " +
      "are tagged/versioned pointers (pack a monotonically incrementing counter alongside the " +
      "pointer, e.g. via a double-width CAS), hazard pointers, or epoch-based reclamation " +
      "(RCU-style), all of which detect 'this is A, but not the *same* A' rather than relying on " +
      "pointer equality alone.",
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
        "Buggy: since n->next is never re-read inside the loop, every retry after the first compares against a stale value and the loop can spin forever without making progress",
        "Correct: compare_exchange_weak writes head's current value back into its first argument (n->next) on every failed attempt, so the loop always retries against a fresh value — n->next doesn't need to be manually reloaded",
        "Buggy: memory_order_release is insufficient for the success case here; it must be memory_order_seq_cst or the push is a data race",
        "Correct, but only because compare_exchange_weak internally retries on its own without any user-written loop being necessary",
      ],
      correctIndex: 1,
    },
    explanation:
      "compare_exchange_weak(expected, desired, ...) takes `expected` by reference: on failure it " +
      "atomically writes the atomic object's current value into `expected` before returning " +
      "false. Here `expected` *is* n->next, so a failed attempt automatically refreshes n->next to " +
      "head's latest value — exactly what the retry needs, with no separate reload required. This " +
      "is the standard idiom, not an accident. memory_order_release on success is sufficient and " +
      "appropriate: it publishes n and its already-fully-initialized contents to whichever " +
      "thread's later acquire load/CAS observes the new head; memory_order_relaxed on failure is " +
      "fine because a failed CAS publishes nothing. Note this push implementation is not where " +
      "ABA bites — ABA is a hazard for pop(), which dereferences the old head to compute the next " +
      "pointer before CASing; push never reads through a potentially stale, already-freed pointer.",
  },
  {
    id: "concurrency-thread-local-11",
    category: "concurrency",
    difficulty: "easy",
    title: "thread_local storage duration",
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
        "5, then 10, then 15 — counter is shared across all calls since it's effectively a single global variable",
        "5, then 10, then 3 — thread_local gives each thread (t1, t2, and main) its own independent instance, zero-initialized before first use in that thread",
        "Undefined behavior — thread_local variables cannot be modified from more than one thread",
        "5, then 15, then 18 — main's counter accumulates across all three calls since main is the thread that created t1 and t2",
      ],
      correctIndex: 1,
    },
    explanation:
      "`thread_local` gives each thread its own separate instance of `counter`, independently " +
      "initialized — here, zero-initialized before first use in that thread. t1's five " +
      "increments only affect t1's copy (prints 5); t2's ten increments only affect t2's copy " +
      "(prints 10); the main thread's own copy was never touched by t1 or t2, so three " +
      "increments starting from a fresh 0 prints 3. There is no shared state and no data race " +
      "here at all — that's the entire point of thread_local storage duration: it trades sharing " +
      "for per-thread isolation, useful for things like per-thread arenas, RNG state, or " +
      "errno-style status without any synchronization.",
  },
  {
    id: "concurrency-volatile-vs-atomic-12",
    category: "concurrency",
    difficulty: "medium",
    title: "volatile does not provide thread safety",
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
        "Yes — volatile forces every read/write to go directly to memory, which makes the accesses atomic and visible across threads, so this always prints 42",
        "No — volatile only tells the compiler not to cache the value in a register or elide/reorder accesses to that specific object; it provides no atomicity guarantee and, critically, no cross-thread synchronizes-with relationship, so this remains formally a data race (UB) on both `ready` and `data`, even though it may happen to 'work' on x86 in practice",
        "No — volatile causes a compile error when the same variable is accessed from multiple threads",
        "Yes for `ready` (volatile bool access is atomic on all platforms), but the race on plain `data` remains, so the program may print 0",
      ],
      correctIndex: 1,
    },
    explanation:
      "This is one of the most common C++ concurrency misconceptions. Unlike Java or C#, " +
      "`volatile` in C++ has nothing to do with threading: it only disables certain compiler " +
      "optimizations — caching a value in a register, eliding a seemingly dead store, reordering " +
      "accesses to that object relative to other volatile accesses — so each access happens at " +
      "the source-specified point. It says nothing about atomicity on every ISA, and nothing " +
      "about memory_order/happens-before relative to *other*, non-volatile variables. Without a " +
      "genuine synchronizes-with edge (which only std::atomic with an appropriate memory_order, " +
      "or a mutex, establishes), the compiler remains free to reorder `data = 42` relative to " +
      "`ready = true` — it has no idea they're used for cross-thread signaling — and the hardware " +
      "may reorder them too on weakly-ordered ISAs. The unsynchronized access to `ready` and " +
      "`data` from two threads is formally undefined behavior regardless of `volatile`, though on " +
      "a strongly-ordered platform like x86 with a non-reordering compiler it may 'work' most of " +
      "the time — which is precisely what makes this bug insidious and hard to catch in testing.",
  },
  {
    id: "concurrency-double-checked-locking-13",
    category: "concurrency",
    difficulty: "hard",
    title: "Naive double-checked locking is broken",
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
        "Yes — the second check inside the lock prevents constructing more than one Singleton, so this is a safe, standard optimization over always locking",
        "No — the unlocked outer read of `instance` races with the mutex-protected write, which is formally UB; and independent of that, a thread could observe a non-null `instance` whose pointed-to object's constructor hasn't finished writing its members, since nothing prevents the pointer publish from becoming visible before the constructor's internal writes are",
        "No — std::mutex cannot be locked and unlocked by different threads, so this always deadlocks",
        "Yes, but only if Singleton has a trivial, empty constructor",
      ],
      correctIndex: 1,
    },
    explanation:
      "Naive double-checked locking is broken in C++ for two independent reasons. First, the " +
      "unlocked outer read of `instance` is a plain, non-atomic access that races with the " +
      "mutex-protected write performed by another thread — a data race, and therefore UB, " +
      "regardless of which value is actually observed at runtime. Second, even setting the race " +
      "aside, `new Singleton()` conceptually (a) allocates, (b) runs the constructor writing " +
      "members, then (c) assigns the resulting pointer to `instance` — and without an explicit " +
      "release/acquire edge, the compiler and hardware are free to make (c)'s write visible to " +
      "another core before (b)'s writes are, so a thread doing the unlocked check could see a " +
      "non-null `instance` pointing at a half-constructed object. The correct fixes are " +
      "`std::call_once` with a `std::once_flag` (simplest, and internally supplies the required " +
      "synchronization), or a `std::atomic<Singleton*>` where the inner store uses " +
      "memory_order_release and the outer unlocked load uses memory_order_acquire, restoring the " +
      "missing synchronizes-with edge.",
  },
  {
    id: "concurrency-thread-join-detach-14",
    category: "concurrency",
    difficulty: "easy",
    title: "Destroying a joinable std::thread",
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
        "The thread object's destructor implicitly detaches it, so the program prints \"done\" and doWork() finishes in the background",
        "The thread object's destructor implicitly joins it, so run() blocks for ~50ms before returning, then \"done\" prints",
        "std::terminate() is called when t's destructor runs, because a std::thread representing a joinable thread (neither joined nor detached) being destroyed is a fatal error — the program aborts and \"done\" never prints",
        "Undefined behavior, but not necessarily a crash — the outcome depends on the standard library implementation",
      ],
      correctIndex: 2,
    },
    explanation:
      "std::thread deliberately has no implicit join or implicit detach in its destructor — the " +
      "committee considered both 'safer' defaults and rejected them (implicit join can silently " +
      "hang for an unbounded time on exit paths; implicit detach can silently outlive resources " +
      "the caller assumed were joined). Instead, ~thread() calls std::terminate() whenever " +
      "joinable() is true, i.e., the thread was never joined or detached. This is a deterministic " +
      "rule specified by the standard ([thread.thread.destr]), not implementation-defined — every " +
      "conforming implementation aborts here. The fix is to call t.join() (block until it " +
      "finishes) or t.detach() (explicitly disown it, accepting it now runs fully independently) " +
      "before t goes out of scope, or to use a RAII wrapper that joins automatically in its " +
      "destructor, such as C++20's std::jthread.",
  },
  {
    id: "concurrency-reader-writer-lock-15",
    category: "concurrency",
    difficulty: "medium",
    title: "shared_mutex writer starvation",
    tags: ["shared_mutex", "reader-writer-lock", "fairness"],
    type: "trace",
    prompt:
      "Several reader threads and one writer thread contend for `rw`. New readers keep arriving " +
      "in a steady stream, each briefly taking a shared_lock, while the single writer is blocked " +
      "waiting for a unique_lock. Which statement is actually guaranteed by the C++ standard?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::shared_mutex rw;
int sharedValue = 0;

void reader() {
    std::shared_lock<std::shared_mutex> lock(rw);
    // read sharedValue
}

void writer() {
    std::unique_lock<std::shared_mutex> lock(rw);
    sharedValue++;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Multiple readers may hold the shared_mutex in shared mode simultaneously, and the standard guarantees the writer will never starve — it is given priority over new readers once it starts waiting",
        "Multiple readers may hold the shared_mutex in shared mode simultaneously, but the standard specifies no fairness/priority policy between a waiting writer and newly-arriving readers — a conforming implementation is permitted to starve the writer indefinitely under a continuous stream of readers",
        "Only one reader may hold the lock at a time — shared_mutex behaves identically to a plain mutex aside from its name",
        "The writer automatically upgrades any single reader's shared_lock into a unique_lock once every other reader has released",
      ],
      correctIndex: 1,
    },
    explanation:
      "std::shared_mutex's defining feature is that shared_lock (read) acquisitions can coexist — " +
      "any number of readers may hold it in shared mode concurrently — while unique_lock (write) " +
      "acquisition is exclusive against both readers and other writers. However, the standard " +
      "intentionally does not mandate any fairness or priority policy: it says nothing about " +
      "whether a waiting writer blocks subsequently-arriving readers from jumping ahead of it in " +
      "the queue. This is left implementation-defined so implementations can tune for their " +
      "expected workload; some do prioritize a waiting writer to avoid starvation, but portable " +
      "code must not rely on that. If writer starvation is unacceptable, you need either an " +
      "implementation you've specifically verified behaves that way, or a hand-rolled " +
      "reader-writer lock with an explicit writer-priority policy — e.g., a pending-writer " +
      "counter that blocks newly-arriving readers once a writer starts waiting.",
  },
  {
    id: "concurrency-acq-rel-fetch-add-16",
    category: "concurrency",
    difficulty: "hard",
    title: "memory_order_acquire is not enough for a refcount decrement",
    tags: ["atomics", "memory-order", "reference-counting", "fetch_add"],
    type: "trace",
    prompt:
      "This is a common but subtly wrong attempt at intrusive reference counting. addRef() uses " +
      "relaxed ordering, which is correct — incrementing needs no ordering relative to other " +
      "memory operations. But release() uses memory_order_acquire on the fetch_sub. Is that " +
      "sufficient to make `delete this` safe once the count reaches zero?",
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
        "Yes — memory_order_acquire on the read-modify-write means every prior write by any thread that touched refCount is now visible, so the delete is always safe",
        "No — for a read-modify-write operation, memory_order_acquire only makes the *load* half an acquire operation; the *store* half is effectively relaxed, so this decrement supplies no release semantics for other decrementing threads' preceding writes to be published — it should use memory_order_acq_rel (or memory_order_release, plus a separate acquire fence only on the branch that actually destroys the object)",
        "No — fetch_sub does not exist on std::atomic<int>; only fetch_add exists, so this fails to compile",
        "Yes, but only because refCount happens to be initialized to 1 rather than 0",
      ],
      correctIndex: 1,
    },
    explanation:
      "The subtlety is that memory_order_acquire on a read-modify-write operation gives acquire " +
      "semantics to the load portion only — it does not give the store portion release semantics. " +
      "Decrements performed by *other* threads need their preceding writes (e.g., to the " +
      "reference-counted object itself) to become visible to whichever thread's decrement drives " +
      "the count to zero and calls delete; that requires each decrement's *store* to participate " +
      "in a release, which memory_order_acquire alone does not provide. The canonical fix, " +
      "following Boost/shared_ptr's design (per Boehm's analysis): fetch_add for increments can " +
      "stay memory_order_relaxed, since nothing needs to happen-before an increment; fetch_sub for " +
      "decrements should use memory_order_release (or memory_order_acq_rel to be simple/safe); " +
      "and ideally only the thread that observes the count actually hit zero issues an additional " +
      "std::atomic_thread_fence(std::memory_order_acquire) before destroying the object, which is " +
      "cheaper than making every decrement acq_rel. Using plain memory_order_acquire on the " +
      "decrement looks 'safe' but omits the release half that correctness actually depends on.",
  },
  {
    id: "concurrency-data-race-vs-false-sharing-17",
    category: "concurrency",
    difficulty: "hard",
    title: "True data race vs false sharing",
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
        "Same category of issue as false sharing — well-defined but slow, because the cache-coherence protocol (MESI) serializes the underlying cache-line traffic, so the result is simply some value <= 2,000,000",
        "Undefined behavior — a true data race on the *same* non-atomic object, categorically different from false sharing (which involves distinct, individually well-synchronized atomics that merely share a cache line and remains well-defined). Hardware cache coherence does serialize the underlying memory transactions, but that doesn't rescue the program: the C++ abstract machine still classifies concurrent unsynchronized non-atomic access to the same object as UB, independent of what the hardware guarantees",
        "Well-defined and always prints exactly 2,000,000, because `++counter` compiles to a single atomic hardware instruction on most platforms",
        "Deadlock — two threads cannot both modify the same variable concurrently without a lock",
      ],
      correctIndex: 1,
    },
    explanation:
      "The critical distinction is *which* object is being accessed, not merely 'is there " +
      "contention.' False sharing (the earlier example) involves two *distinct* atomic " +
      "variables, each individually well-defined and correctly synchronized, that simply happen " +
      "to share a hardware cache line — cache-coherence ping-pong makes it slow but never " +
      "incorrect. Here, both threads perform unsynchronized, non-atomic read-modify-write " +
      "operations (`++counter` is a read, an add, then a write — three separate steps, not one) " +
      "on the exact same object, with no happens-before relationship between the threads' " +
      "accesses. This is precisely the data race the standard defines as undefined behavior: two " +
      "conflicting actions on the same memory location (at least one a write), unordered by " +
      "happens-before, is UB by [intro.races]. Hardware cache coherence — MESI's " +
      "Modified/Exclusive/Shared/Invalid states — guarantees only that the *hardware* serializes " +
      "visibility of individual memory transactions between caches; it says nothing about the " +
      "compiler-level guarantees the C++ object model requires, and the compiler remains free to " +
      "assume no other thread concurrently modifies `counter` (e.g., hoisting it into a register " +
      "for the whole loop, silently dropping the other thread's writes entirely, not merely " +
      "occasionally overwriting them). In practice this often 'just' loses some increments " +
      "(printing less than 2,000,000), but formally the behavior is unbounded UB, not a " +
      "numerically-predictable race.",
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
        "join() rethrows the exception on the calling thread, so \"caught: boom\" is printed",
        "The exception is silently discarded when the thread finishes, t.join() returns normally, and the program exits with code 0 printing nothing",
        "std::terminate() is called (from inside worker's own thread) the moment the exception propagates out of the thread's top-level function, aborting the whole process — main's try/catch around t.join() never gets a chance to run, since it lives on a completely different thread",
        "Undefined behavior — throwing from a thread's entry function is not permitted by the standard, and behavior is implementation-defined",
      ],
      correctIndex: 2,
    },
    explanation:
      "Exceptions never cross std::thread boundaries automatically — there is no mechanism " +
      "analogous to join() rethrowing whatever the thread function threw. If an exception " +
      "propagates out of the function passed to a std::thread's constructor without being caught " +
      "within that function, std::terminate() is invoked, and the process aborts immediately, on " +
      "whatever thread was running worker() — main's try/catch around t.join() is irrelevant " +
      "because it lives on a completely different thread and there is nothing for it to catch " +
      "across that boundary. To propagate an error from a worker thread to whichever thread joins " +
      "it, you must catch the exception inside the thread function yourself and transport it " +
      "explicitly — typically by capturing it with std::current_exception() inside a catch block, " +
      "storing the resulting std::exception_ptr somewhere the joining thread can retrieve it, and " +
      "calling std::rethrow_exception() there. This is exactly the mechanism std::promise / " +
      "std::future / std::async use internally to shuttle exceptions across thread boundaries.",
  },
  {
    id: "concurrency-memory-order-consume-19",
    category: "concurrency",
    difficulty: "hard",
    title: "memory_order_consume: the trick nobody implements",
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
        "Every major compiler implements memory_order_consume's fine-grained dependency-chain tracking exactly as specified, so this is well-defined and cheaper than the equivalent memory_order_acquire on weakly-ordered ISAs like DEC Alpha.",
        "Correct but not for the reason it looks: memory_order_consume is supposed to order only operations that carry a data dependency from the loaded pointer, which is theoretically cheaper than a full acquire on architectures that don't guarantee dependent-load ordering — but no mainstream compiler ever shipped the standard's dependency-chain tracking, because soundly propagating \"carries-dependency\" through inlining and optimization proved intractable. The standard explicitly permits strengthening memory_order_consume to memory_order_acquire, and GCC, Clang, and MSVC all do so unconditionally, so this code is correct and portable but pays full acquire cost while gaining none of consume's theoretical savings.",
        "This fails to compile: memory_order_consume was removed from the standard library in C++20 and only memory_order_acquire remains valid for load().",
        "memory_order_consume behaves identically to memory_order_relaxed unless the code is annotated with [[carries_dependency]], which is absent here, so w->value is a data race.",
      ],
      correctIndex: 1,
    },
    explanation:
      "memory_order_consume was designed to provide a weaker, cheaper-than-acquire guarantee: only " +
      "operations that are data-dependent on the consume-loaded value need be ordered after it, " +
      "rather than everything sequenced-after the load. This distinction only matters on ISAs that " +
      "don't already guarantee dependent loads execute in order (DEC Alpha being the historical " +
      "motivating example; mainstream ARM/POWER/x86 largely make it moot in practice). Tracking " +
      "'carries-dependency' correctly through arbitrary expression rewriting, common-subexpression " +
      "elimination, and inlining turned out to be so fragile that every major compiler gave up and " +
      "silently upgrades memory_order_consume to memory_order_acquire — a strengthening the " +
      "standard explicitly permits in [atomics.order]. This is a well-known 'gotcha' in advanced " +
      "interviews: the code above is not broken, but anyone who thinks they're getting consume's " +
      "theoretical performance benefit is mistaken; they're paying for a full acquire fence. This " +
      "gap between specification and reality is exactly why the committee has repeatedly discussed " +
      "deprecating or redesigning memory_order_consume in later standards.",
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
      "unlinks a node cannot simply delete it — some reader might still be dereferencing it. " +
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
        "They are the same mechanism under different names — a hazard pointer and an epoch counter both publish exactly the same information.",
        "Hazard pointers require each reader to publish the exact pointer(s) it is currently dereferencing, and a reclaimer must scan every thread's published slots before freeing a specific node — precise, per-pointer tracking with per-access publish/re-check overhead. EBR instead has readers announce only which coarse-grained epoch they're currently executing in (a lightweight per-thread counter, updated rarely rather than per-access), and reclamation batches: anything retired during an epoch can be freed once no thread is still observed to be in that epoch or an earlier one. This trades hazard pointers' fine-grained precision and per-access cost for EBR's much lower per-access overhead, at the cost of a stalled/preempted thread in an old epoch blocking reclamation of everything retired since — potentially much higher peak memory use than hazard pointers' precise, per-node tracking.",
        "Hazard pointers batch reclamation by generation while EBR tracks individual pointers per access — the two techniques are just industry-swapped names for the same batching strategy.",
        "EBR is always strictly faster and strictly bounds memory usage better than hazard pointers in every workload, making hazard pointers obsolete.",
      ],
      correctIndex: 1,
    },
    explanation:
      "Hazard pointers (Maged Michael's technique) give each reader a small, fixed number of " +
      "publish slots: before dereferencing a shared pointer, the reader announces it there, then " +
      "re-validates that the source pointer hasn't changed underneath it (as shown). A reclaimer " +
      "retiring a node must scan all threads' hazard slots and only frees nodes that appear in " +
      "none of them — precise but requiring a publish-and-recheck on essentially every access, plus " +
      "an O(threads) scan per reclamation batch. Epoch-based reclamation instead has each thread " +
      "announce a coarse 'I am currently active, in epoch E' state relatively rarely (e.g., once " +
      "per operation rather than per pointer touched); a global epoch only advances once all " +
      "threads have caught up, and anything retired two epochs ago is safe to free in bulk. EBR's " +
      "per-access cost is far lower (often just a counter increment, no re-validation loop), but " +
      "correctness depends on every participating thread eventually advancing its epoch — a single " +
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
    title: "Seqlock reader missing the odd-parity check",
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
        "Yes — checking s1 != s2 alone is sufficient; if a write happened during the read, the two sequence values will always differ.",
        "Bug: the reader never checks whether s1 is odd. If the reader's first load lands while a write is already in progress and the reader is then preempted for the remainder of that same (still-incomplete) write, both s1 and s2 can observe the identical odd value once the reader resumes and finishes its second load — the loop condition s1 != s2 is false, so the reader exits believing it captured a consistent snapshot, when in fact `data` was copied mid-update by the writer's still-in-flight, non-atomic overwrite: a genuine torn read slipping past the retry check.",
        "Bug: fetch_add with memory_order_release is too weak for `seq`; every operation on `seq` must be memory_order_seq_cst or the reader can never detect a write at all.",
        "No functional bug in the reader, but the writer is broken because `data = d;` is not itself wrapped in a compare_exchange loop.",
      ],
      correctIndex: 1,
    },
    explanation:
      "The correct seqlock reader idiom checks two things on every attempt: that s1 == s2 (no " +
      "sequence-number change occurred between the two reads of `seq`), *and* that s1 is even " +
      "(no write was already underway when the read began) — canonically written as " +
      "`do { s1 = seq.load(acquire); } while (s1 & 1); ... s2 = seq.load(acquire); if (s1 != s2) retry;` " +
      "or equivalently checking `(s1 & 1) || (s1 != s2)`. Omitting the odd check leaves a window: " +
      "the reader's first load can catch `seq` mid-write (an odd value), and if the reader stalls " +
      "for the remainder of that same write — the writer hasn't yet issued its second fetch_add — " +
      "the reader's second load observes the *same* odd value, satisfying s1 == s2 despite having " +
      "read `data` while it was only partially overwritten. This is the seqlock-specific analogue " +
      "of a torn read, and it is a real, historically-seen kernel/HPC bug (the Linux kernel's " +
      "read_seqbegin/read_seqretry pair is careful to loop while the initial sequence value is odd " +
      "for exactly this reason). Worth noting separately: even a fully correct seqlock reads/writes " +
      "`data` as plain non-atomic memory concurrently from multiple threads, which is technically a " +
      "data race under the strict ISO C++ object model regardless of the fences/parity discipline — " +
      "seqlocks are a widely-used, hardware-proven idiom (especially in kernels) that nonetheless " +
      "sit in a gray area relative to the formal standard, which is exactly the kind of nuance that " +
      "distinguishes production lock-free code from textbook-clean C++.",
  },
  {
    id: "concurrency-wait-free-lock-free-obstruction-free-22",
    category: "concurrency",
    difficulty: "medium",
    title: "Progress guarantees: wait-free vs lock-free vs obstruction-free",
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
        "Wait-free — compare_exchange_weak eventually succeeds for every thread, so every thread is guaranteed to complete in a bounded number of its own steps regardless of what other threads do.",
        "Lock-free but not wait-free — every failed CAS implies some *other* thread's CAS just succeeded, so the system as a whole always makes progress in a bounded number of steps (this is what lock-free guarantees: system-wide, not per-thread, progress). But there is no bound on how many times any one specific thread might retry: under sufficiently adversarial scheduling, one thread's CAS could repeatedly lose to others indefinitely while the aggregate system keeps moving. Wait-free would additionally require a per-thread bound on steps-to-completion independent of other threads' behavior, which this loop does not provide.",
        "Obstruction-free only — the loop makes progress solely when all other threads are suspended; any concurrent CAS attempt causes every participant to fail and retry forever.",
        "None of the three classifications apply, since they are only meaningful for algorithms built on hardware transactional memory, not manual CAS retry loops.",
      ],
      correctIndex: 1,
    },
    explanation:
      "The formal hierarchy, strongest to weakest: wait-free guarantees every thread completes in a " +
      "bounded number of steps regardless of other threads' relative speeds or interleavings; " +
      "lock-free guarantees only that *some* thread completes in a bounded number of steps in any " +
      "execution — the system's aggregate throughput is bounded even though a specific unlucky " +
      "thread's personal progress is not; obstruction-free (the weakest of the three commonly " +
      "named) guarantees a thread completes in bounded steps only if it eventually runs with no " +
      "concurrent contention at all. The push() above is lock-free: whenever a thread's CAS fails, " +
      "that failure is caused by some other thread's CAS having just succeeded (installing a new " +
      "head), so the data structure as a whole always advances. But nothing bounds how many times " +
      "any *particular* thread can be the loser — under pathological (if practically improbable) " +
      "scheduling, one thread could theoretically retry forever while others repeatedly win the " +
      "race. True wait-free algorithms require additional machinery (e.g., operation announcement " +
      "arrays and helping, where other threads complete a stalled thread's operation on its behalf) " +
      "and are correspondingly rarer and more complex — used in practice mostly where hard " +
      "worst-case latency bounds are non-negotiable, such as certain real-time or ultra-low-latency " +
      "trading paths.",
  },
  {
    id: "concurrency-memory-fence-vs-atomic-op-23",
    category: "concurrency",
    difficulty: "hard",
    title: "atomic_thread_fence vs an operation's own memory_order",
    tags: ["atomics", "memory-order", "fences"],
    type: "trace",
    prompt:
      "`a` and `b` are plain, non-atomic ints — they cannot carry a memory_order themselves. " +
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
        "No — memory_order_relaxed on flagA provides no ordering at all, and a fence cannot compensate for ordering a specific atomic operation lacks; this remains a data race regardless of the fences.",
        "Yes — a release fence placed before one or more relaxed atomic stores makes those stores (and everything sequenced-before the fence, including the plain writes to `a` and `b`, which have no memory_order of their own to attach) participate in fence-based synchronization: if consumerA's relaxed load of flagA observes true, and consumerA then executes an acquire fence before reading `a`, the release fence synchronizes-with the acquire fence per [atomics.fences], and happens-before transitively connects `a = 1` to consumerA's read. Unlike tagging flagA's store itself with memory_order_release (which would only cover that one atomic), a single release fence simultaneously covers every relaxed store sequenced after it — here, both flagA and flagB — which is exactly when a fence is preferable to per-operation ordering: batch-publishing several atomics, or plain non-atomic data that cannot take a memory_order at all, behind one fence.",
        "Yes, but only by luck on x86; the identical code with the identical fences is UB on ARM or POWER regardless of what fences are used.",
        "No — atomic_thread_fence only restricts compiler reordering, never hardware reordering, so CPUs remain free to reorder around it on every ISA.",
      ],
      correctIndex: 1,
    },
    explanation:
      "A fence is a standalone synchronization point, distinct from the memory_order attached to any " +
      "single atomic operation: memory_order_release on a store only orders *that store* relative to " +
      "prior writes, whereas atomic_thread_fence(memory_order_release) orders *all* memory operations " +
      "sequenced before it (atomic or, critically, plain non-atomic like `a` and `b`, which have no " +
      "way to carry a memory_order at all) relative to whatever atomic store follows the fence. Per " +
      "[atomics.fences], a release fence A synchronizes-with an acquire fence B when there exist " +
      "atomic operations X and Y such that A is sequenced-before X, X modifies some atomic M, B is " +
      "sequenced-before... (reversed: Y is sequenced-before B and reads the value X wrote or a later " +
      "value in its release sequence) — informally, once such a pairing is established, everything " +
      "before the release fence happens-before everything after the paired acquire fence. Here that " +
      "pairing is established through flagA: producer's fence precedes its store to flagA; " +
      "consumerA's load of flagA observes that store; consumerA's fence follows. This correctly makes " +
      "`a == 1` visible. The practical payoff versus per-operation release/acquire is exactly shown " +
      "here: one fence can cover multiple subsequently-stored atomics (flagA and flagB both) and " +
      "arbitrary plain memory in between, instead of requiring every individual atomic operation to " +
      "be separately annotated.",
  },
  {
    id: "concurrency-latch-vs-barrier-24",
    category: "concurrency",
    difficulty: "easy",
    title: "std::latch (single-use) vs std::barrier (reusable, phased)",
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
        "\"phase done\" prints once total, and startLine can also be reused indefinitely — both std::latch and std::barrier support unlimited reuse.",
        "\"phase done\" prints 3 times, once per phase — std::barrier is explicitly designed for repeated, phased synchronization: once all 3 participants arrive, it runs the completion function exactly once and automatically resets its counter for the next phase. std::latch, in contrast, is strictly single-use: once its counter reaches zero, it stays at zero permanently, so calling arrive_and_wait() on startLine again would not block anyone (everyone already passed) — a fresh latch is required for a second one-time event.",
        "\"phase done\" prints once per thread per phase (9 times total), because each of the 3 threads independently invokes the completion function.",
        "Compile error: std::barrier's completion function must return bool indicating whether to continue to the next phase; a void-returning lambda is not permitted.",
      ],
      correctIndex: 1,
    },
    explanation:
      "std::latch is a single-use countdown: it starts at N, each arrive() (or arrive_and_wait()) " +
      "decrements it, and once it hits zero every waiter is released — permanently; the latch cannot " +
      "be reset or reused for a second rendezvous, making it suited for one-time events like 'wait " +
      "for N initialization tasks to finish' or, as here, a one-time start line. std::barrier is " +
      "built for exactly the opposite use case: repeated, phased synchronization among a fixed set " +
      "of participants. Once all N threads call arrive_and_wait() for the current phase, the barrier " +
      "invokes its completion function exactly once (by an unspecified single participant), then " +
      "automatically resets its internal counter to N for the next phase — so it can be reused as " +
      "many times as there are phases, which is exactly why the loop above prints \"phase done\" " +
      "three times, once per phase boundary.",
  },
  {
    id: "concurrency-jthread-stop-token-25",
    category: "concurrency",
    difficulty: "medium",
    title: "std::jthread cooperative cancellation requires checking the token",
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
        "std::terminate() is called, just like with a plain joinable std::thread whose destructor runs while it's still running.",
        "t's destructor calls request_stop() and then join(). request_stop() flips t's shared stop-state to \"stop requested,\" but since badWorker() never accepts a stop_token (it isn't even declared to take one) and never calls stop_requested() anywhere, the request has no effect on its control flow — it's simply ignored. jthread's destructor still unconditionally calls join() afterward, so main blocks forever waiting for a thread that never returns; \"main continues\" never prints.",
        "badWorker() is forcibly, preemptively terminated the instant request_stop() is called, because std::jthread guarantees preemptive cancellation that std::thread lacks.",
        "Nothing special happens — std::jthread behaves exactly like std::thread and detaches automatically on destruction, so \"main continues\" prints immediately.",
      ],
      correctIndex: 1,
    },
    explanation:
      "std::jthread improves on std::thread in two ways: its destructor calls request_stop() and " +
      "then join() instead of calling std::terminate() on a still-joinable thread, and its entry " +
      "function may optionally accept a std::stop_token as its first parameter to enable cooperative " +
      "cancellation. Critically, request_stop() is purely advisory — it flips a shared stop-state to " +
      "'requested' and invokes any registered std::stop_callbacks, but it has no power to preempt or " +
      "interrupt a running thread. badWorker() never accepts a stop_token, never calls " +
      "get_stop_token(), and never polls stop_requested(), so the request changes nothing about its " +
      "execution. jthread's destructor still calls join() unconditionally after issuing the request, " +
      "so it blocks until badWorker() actually returns — which, given its infinite loop, is never. " +
      "This is a genuinely common real-world bug: jthread eliminates the un-joined-destructor-" +
      "terminates footgun, but it does not make arbitrary code cancellable — that requires actively " +
      "threading the stop_token through the work loop and checking it at defined cancellation points.",
  },
  {
    id: "concurrency-work-stealing-deque-26",
    category: "concurrency",
    difficulty: "medium",
    title: "Why work-stealing deques push/pop from one end and steal from the other",
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
        "It's arbitrary — any thread could use either end with identical performance; the split is purely historical convention from Cilk.",
        "Separating the ends means the hot path — the owner pushing and popping its own most-recently-spawned tasks, which also tends to have good cache locality — is contention-free in the overwhelming common case, since no other owner ever touches bottom and stealing (the only operation that must synchronize against the owner or other thieves) is comparatively rare. The expensive coordination (a CAS to arbitrate concurrent thieves against each other, and against the owner in the boundary case of exactly one remaining item) is confined to the cold path, so the high-frequency local push/pop operations pay little to no synchronization cost.",
        "It guarantees wait-free progress for every thief, since operating on opposite ends of a deque is by itself sufficient to make every operation on it wait-free.",
        "It's required because concurrent access to the same end of any deque is disallowed by the C++ standard library's thread-safety rules.",
      ],
      correctIndex: 1,
    },
    explanation:
      "Chase-Lev-style (and Arora-Blumofe-Plaxton) work-stealing deques exploit both locality and " +
      "access-frequency asymmetry. The owner treats its own end as a LIFO stack — popping the " +
      "most-recently-pushed task tends to have better cache locality, since it was created most " +
      "recently and its data is likely still warm — while thieves take from the opposite end in " +
      "FIFO order relative to the owner, grabbing the oldest, typically coarser-grained tasks, which " +
      "are more likely to contain enough embedded parallelism to be worth the cost of stealing. " +
      "Because local push/pop vastly outnumbers steal attempts in typical workloads, and because no " +
      "other owner thread ever touches the bottom end, the hot path can often avoid synchronization " +
      "entirely (or use a cheap fast-path check) in the common case where the deque isn't near-empty. " +
      "Stealing — the rare path, only triggered once a thief's own local deque is exhausted — is the " +
      "one operation that must pay for a CAS to arbitrate against concurrent thieves and against the " +
      "owner's own pop in the single-remaining-item race. This asymmetric cost allocation (cheap hot " +
      "path, expensive cold path) is the opposite of a naive single shared queue, where every push " +
      "and pop from every thread pays full synchronization cost regardless of frequency — exactly " +
      "why work-stealing deques underlie schedulers like Cilk, Intel TBB, Rust's Rayon, and Java's " +
      "ForkJoinPool.",
  },
  {
    id: "concurrency-petersons-algorithm-27",
    category: "concurrency",
    difficulty: "hard",
    title: "Peterson's algorithm is broken on real hardware without barriers",
    tags: ["peterson", "memory-order", "reordering", "data-race"],
    type: "trace",
    prompt:
      "Peterson's algorithm is the textbook proof that two threads can achieve mutual exclusion " +
      "using only plain reads/writes to shared flag[]/turn — no atomic read-modify-write " +
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
        "Yes — Peterson's correctness proof only relies on each thread's own program order, and every real CPU respects the program order of its own instructions, so this works correctly on any hardware.",
        "No — the proof assumes sequential consistency: that all threads observe every read and write in one global order consistent with each thread's own program order. Real hardware is generally not sequentially consistent for plain memory accesses (even x86, despite being comparatively strongly ordered, permits store-load reordering via store buffers), and the compiler is independently free to reorder or cache these plain, non-atomic, non-volatile variables absent any synchronization construct telling it not to. Either kind of reordering can let both threads simultaneously believe it's safe to enter the critical section. This code is also formally a data race — concurrent unsynchronized access to plain flag[]/turn from two threads — making it UB in C++ independent of any specific hardware behavior. The fix is to make flag[] and turn std::atomic with memory_order_seq_cst (the algorithm's proof specifically depends on a total order across these operations); hand-rolled mutual exclusion with plain variables is essentially never appropriate in real C++.",
        "Yes, but only on x86-64; it is broken exclusively on weakly-ordered ISAs like ARM64, because x86-64 alone provides full sequential consistency for all loads and stores.",
        "No, because Peterson's algorithm is mathematically valid only under cooperative, non-preemptive single-core scheduling and was never intended to run with true multicore parallelism.",
      ],
      correctIndex: 1,
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
      "signaling — it owes no ordering guarantees at all absent std::atomic or an equivalent. Either " +
      "effect alone can break the algorithm: e.g., if thread0's write to `turn` becomes visible to " +
      "thread1 before thread0's write to flag[0] does, thread1 can enter its critical section while " +
      "thread0 believes it also has priority. And regardless of what any specific piece of hardware " +
      "happens to do, concurrent unsynchronized reads and writes of flag[]/turn from two threads " +
      "constitute a data race under the C++ standard, which is undefined behavior on its own terms. " +
      "This is a favorite trick question precisely because the algorithm is provably correct under " +
      "the abstraction most people learn it in (a sequentially consistent shared-memory model) while " +
      "being silently broken under the actual C++ memory model and actual hardware absent explicit " +
      "atomics.",
  },
  {
    id: "concurrency-cas-tagged-pointer-aba-fix-28",
    category: "concurrency",
    difficulty: "hard",
    title: "Fixing ABA with a tagged pointer and double-width CAS",
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
        "The CAS still spuriously succeeds, because comparison only inspects the pointer field for equality; ABA is unavoidable regardless of tagging.",
        "The CAS correctly fails: even though the pointer field matches (A == A), the tag field does not (expected tag=5 vs head's current tag=8, since three modifications occurred in between), so compare_exchange_weak — which compares the full {ptr, tag} object representation, not just the pointer — sees a mismatch, fails, and writes head's current value {A, tag=8} back into oldHead for the loop to retry against. Thread 1's retry now recomputes newHead from the genuinely current A (whose ->next is C, not the stale B it originally read), preventing the stack corruption the untagged version suffered.",
        "The CAS succeeds and proceeds as before, because the tag field is purely diagnostic metadata and is never actually compared by compare_exchange_weak.",
        "Compile error: std::atomic<TaggedPtr> is not permitted because TaggedPtr contains a pointer member alongside an integer.",
      ],
      correctIndex: 1,
    },
    explanation:
      "compare_exchange_weak/strong compare the entire object representation of the atomic's value " +
      "type against `expected` — effectively a bitwise comparison — so once the pointer and a " +
      "monotonically-incrementing tag are packed into one atomically-compared word, two states that " +
      "share the same pointer value but arose from different sequences of modifications are no " +
      "longer indistinguishable: the tag field differs (5 vs 8 here) even though the pointer field " +
      "coincidentally doesn't, so the CAS correctly detects that head is not in the state Thread 1 " +
      "last observed and fails as it should. This requires hardware support for a double-width " +
      "compare-and-swap wider than the pointer alone — e.g., CMPXCHG16B on x86-64 for a 128-bit " +
      "{pointer, 64-bit tag} pair, or ARMv8.1's CASP/a LDXP+STXP pair — and it's worth checking " +
      "std::atomic<TaggedPtr>::is_always_lock_free, since not every platform guarantees the wider " +
      "CAS is itself lock-free. The tag can in principle wrap around given astronomically many " +
      "operations, but with a 64-bit counter this is not a practical concern; this tagged-pointer " +
      "(or generation-counter) technique, along with hazard pointers and epoch-based reclamation, is " +
      "one of the standard production mitigations for ABA in lock-free data structures.",
  },
  {
    id: "concurrency-numa-false-sharing-29",
    category: "concurrency",
    difficulty: "hard",
    title: "False sharing is worse across NUMA nodes",
    tags: ["numa", "false-sharing", "cache-coherence", "performance"],
    type: "trace",
    prompt:
      "Two counters share a single 64-byte cache line, exactly as in the earlier false-sharing " +
      "example — but now Thread 1 is pinned to a core on NUMA node 0 and Thread 2 is pinned to a " +
      "core on NUMA node 1, and the cache line's backing physical memory is homed on node 0 " +
      "(typical, since it was first touched by code running there under a first-touch allocation " +
      "policy). How does pinning the two threads to different NUMA nodes change the earlier " +
      "false-sharing analysis, if at all?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "No difference from the same-socket case — cache-coherence protocol traffic costs the same number of cycles regardless of which physical node the cache line's home memory resides on.",
        "It's strictly worse: every time Thread 2 (node 1) writes its counter, the coherence protocol must invalidate Thread 1's (node 0) cached copy and transfer ownership of the line across the inter-socket interconnect (e.g., Intel UPI or AMD Infinity Fabric) rather than a same-socket L3/ring-bus hop — inherently higher latency than intra-socket coherence traffic. Because the line's home physical memory sits on node 0, node 1's cache-line fetches and write-backs additionally have to cross the interconnect just to reach the memory controller that owns that address, compounding the cost on top of the coherence ping-pong itself. The fix combines the earlier remedy (padding each counter to its own cache line) with NUMA-aware allocation (first-touch on the node that will actually use it, or explicit node-local allocation) so each thread's counter is both isolated on its own cache line and physically homed in its own node's local memory.",
        "It's actually better, because each NUMA node has an independent cache-coherence domain, so cross-node false sharing cannot occur — coherence traffic stays confined to whichever node touched the line last.",
        "The behavior is identical to the non-NUMA case, except the OS scheduler automatically migrates one of the two threads onto the other's node to eliminate the false sharing.",
      ],
      correctIndex: 1,
    },
    explanation:
      "Same-socket false sharing already costs cache-coherence ping-pong traffic (MESI/MOESI " +
      "invalidations and re-fetches) traveling over an on-chip interconnect (ring bus / mesh) at " +
      "relatively low latency. Once the two contending threads live on different NUMA nodes, the " +
      "same coherence traffic must instead cross a socket-to-socket interconnect, which carries " +
      "meaningfully higher per-hop latency than an intra-socket path — every single invalidate/fetch " +
      "round trip gets more expensive purely from physical distance and interconnect hops, before " +
      "considering anything else. Separately, cache-coherence protocols on NUMA systems are " +
      "typically directory-based: a remote node's request for a line may need to consult a directory " +
      "or snoop filter associated with whichever node's memory controller actually owns that " +
      "physical address, adding another cross-interconnect round trip specifically because the line " +
      "is homed remotely relative to the requester. So false sharing across NUMA nodes compounds two " +
      "costs — the coherence traffic itself (present even same-socket) and remote-memory-access " +
      "latency (present because the accessed physical memory isn't local to the requesting node) — " +
      "rather than just one. Fixing it requires both per-line padding (to eliminate the false " +
      "sharing itself) and NUMA-aware allocation such as first-touch placement or explicit " +
      "node-local allocation (e.g., numa_alloc_onnode on Linux), so that each thread's working set is " +
      "physically local to the node it actually runs on.",
  },
  {
    id: "concurrency-release-sequence-rmw-30",
    category: "concurrency",
    difficulty: "hard",
    title: "Release sequence: does a downstream relaxed RMW still synchronize-with the original release?",
    tags: ["atomics", "memory-order", "release-sequence", "happens-before"],
    type: "trace",
    prompt:
      "writer() runs once and performs a release store. Three separate threads then each call " +
      "bumper() exactly once, performing a relaxed fetch_add on the same atomic `counter`. " +
      "reader() spins on an acquire load until it observes counter's value has reached 4 — the " +
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
        "No — only an acquire load that reads the exact value written by the original release store (1) synchronizes-with that store; observing a later value produced by an unrelated relaxed fetch_add breaks the chain, so this is a data race on `payload`.",
        "Yes — writer()'s release store heads a release sequence on `counter`, and the release sequence rule extends that sequence through any subsequent side effects in counter's modification order that are themselves read-modify-write operations — here, the three relaxed fetch_add calls — regardless of which thread performs them and regardless of the memory_order used on those RMWs. When reader()'s acquire load reads the value produced by the last fetch_add in that unbroken RMW chain, it synchronizes-with writer()'s original release store; happens-before then transitively connects `payload = 99` to reader()'s subsequent read of `payload`, guaranteeing 99 even though reader() never directly observed the value the release store itself wrote.",
        "Yes, but only because there happen to be exactly three bumper threads; the release sequence rule caps out at a small bounded number of intervening RMWs and would silently break with a fourth.",
        "No — relaxed fetch_add operations can never participate in a release sequence; only release- or acq_rel-tagged read-modify-writes extend one, so this is a data race regardless of how many bumpers ran.",
      ],
      correctIndex: 1,
    },
    explanation:
      "A release sequence headed by a release operation A on an atomic object M is the maximal " +
      "contiguous run of side effects in M's modification order starting at A, where every " +
      "subsequent side effect in that run is an atomic read-modify-write operation — critically, the " +
      "standard imposes no requirement on which thread performs those RMWs, nor on what memory_order " +
      "they use; a memory_order_relaxed fetch_add qualifies exactly as well as an acq_rel one for " +
      "extending the sequence. Any acquire operation that reads a value written by any operation in " +
      "that release sequence — not only A's own store — synchronizes-with A. Here, writer()'s release " +
      "store heads the release sequence, and the three bumper() calls, each a relaxed RMW on the same " +
      "`counter`, extend it (as long as no non-RMW plain store from another thread interrupts the " +
      "chain, which would break it). reader()'s acquire load, upon observing the value left by the " +
      "final fetch_add, therefore synchronizes-with writer()'s original release store despite never " +
      "reading the literal value 1 that store wrote — happens-before is transitive, so " +
      "`payload = 99` happens-before reader()'s read of `payload`, guaranteeing 99 with no race. This " +
      "is a genuinely easy point to get wrong: it's tempting to assume synchronization only occurs " +
      "when the acquire operation reads the exact value the release operation wrote, but the release " +
      "sequence rule is specifically designed to let synchronization ride along an intervening chain " +
      "of RMWs (the canonical use case being multiple relaxed reference-count decrements between an " +
      "initial release and a final acquire). One historical wrinkle worth knowing: C++20 tightened " +
      "the release sequence definition to only ever include the head plus subsequent RMWs (dropping " +
      "an older allowance in C++11–17 for additional plain stores made by A's own thread), which " +
      "doesn't change the answer here since every continuation is already an RMW.",
  },
];
