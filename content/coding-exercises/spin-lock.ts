import type { HarnessExercise } from "@/types/coding-exercise";

export const spinLock: HarnessExercise = {
  id: "spin-lock",
  title: "Spin lock",
  category: "concurrency",
  difficulty: "medium",
  tags: ["atomics", "memory ordering", "mutual exclusion"],
  mode: "harness",
  prompt: `Implement a spin lock: a mutual-exclusion lock that waits by spinning on an atomic flag in user space instead of sleeping in the kernel.

\`lock()\` returns once the calling thread holds the lock. \`try_lock()\` takes the lock only if it is free right now, and returns whether it did. \`unlock()\` releases it, and is only ever called by the holder.

Build it from atomics. No \`std::mutex\`, \`pthread_mutex_t\`, \`std::sync::Mutex\`, or any other OS-backed lock. The driver sends many threads through a critical section that increments a plain, non-atomic counter, so getting the atomic operation right is not enough: the memory ordering has to make each holder's writes visible to the next.

Spinning burns CPU, and the holder can be preempted while everyone else spins. The tests run more threads than there are CPUs, so a lock that never backs off or yields will run out of time.`,
  constraints: [
    "1 ≤ threads ≤ 8",
    "threads × iterations ≤ 400,000",
    "The program gets 2 CPUs; CPU time is summed across all threads",
  ],
  limits: { timeMs: 4000, memoryMb: 256, cpus: 2 },
  starterCode: {
    cpp: `// Every standard header is already included; nothing is \`using\`-imported.

class SpinLock {
public:
    void lock() {
    }

    bool try_lock() {
        return false;
    }

    void unlock() {
    }

private:
};
`,
    rust: `use std::sync::atomic::{AtomicBool, Ordering};

pub struct SpinLock {
    locked: AtomicBool,
}

impl SpinLock {
    pub fn new() -> Self {
        SpinLock { locked: AtomicBool::new(false) }
    }

    pub fn lock(&self) {
        todo!()
    }

    pub fn try_lock(&self) -> bool {
        todo!()
    }

    pub fn unlock(&self) {
        todo!()
    }
}
`,
  },
  driver: {
    cpp: `// Reads "<threads> <iterations>" and checks try_lock semantics, then
// mutual exclusion and visibility under contention.
int main() {
    int threads = 0, iterations = 0;
    std::cin >> threads >> iterations;

    SpinLock lock;
    bool first = lock.try_lock();   // free: must succeed
    bool second = lock.try_lock();  // held: must fail
    lock.unlock();
    bool third = lock.try_lock();   // free again
    lock.unlock();
    std::cout << "try_lock " << first << second << third << "\\n";

    long long counter = 0;  // deliberately not atomic: the lock protects it
    std::atomic<int> inside{0};
    std::atomic<bool> overlapped{false};
    std::vector<std::thread> workers;
    for (int t = 0; t < threads; ++t) {
        workers.emplace_back([&] {
            for (int i = 0; i < iterations; ++i) {
                lock.lock();
                if (inside.fetch_add(1, std::memory_order_relaxed) != 0) {
                    overlapped.store(true, std::memory_order_relaxed);
                }
                ++counter;
                inside.fetch_sub(1, std::memory_order_relaxed);
                lock.unlock();
            }
        });
    }
    for (auto& w : workers) w.join();

    std::cout << "counter " << counter << "\\n";
    std::cout << "overlaps " << (overlapped.load() ? "yes" : "none") << "\\n";
}
`,
    rust: `// Reads "<threads> <iterations>" and checks try_lock semantics, then
// mutual exclusion and visibility under contention.
struct KataCounter(std::cell::UnsafeCell<u64>);
// Deliberately unsynchronized: only the lock under test protects it.
unsafe impl Sync for KataCounter {}

fn main() {
    use std::io::Read;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input).unwrap();
    let mut nums = input.split_whitespace().map(|x| x.parse::<usize>().unwrap());
    let (threads, iterations) = (nums.next().unwrap(), nums.next().unwrap());

    let lock = Arc::new(SpinLock::new());
    let first = lock.try_lock();
    let second = lock.try_lock();
    lock.unlock();
    let third = lock.try_lock();
    lock.unlock();
    println!("try_lock {}{}{}", first as u8, second as u8, third as u8);

    let counter = Arc::new(KataCounter(std::cell::UnsafeCell::new(0)));
    let inside = Arc::new(AtomicUsize::new(0));
    let overlapped = Arc::new(AtomicBool::new(false));
    let workers: Vec<_> = (0..threads)
        .map(|_| {
            let (lock, counter) = (Arc::clone(&lock), Arc::clone(&counter));
            let (inside, overlapped) = (Arc::clone(&inside), Arc::clone(&overlapped));
            std::thread::spawn(move || {
                for _ in 0..iterations {
                    lock.lock();
                    if inside.fetch_add(1, Ordering::Relaxed) != 0 {
                        overlapped.store(true, Ordering::Relaxed);
                    }
                    unsafe { *counter.0.get() += 1 };
                    inside.fetch_sub(1, Ordering::Relaxed);
                    lock.unlock();
                }
            })
        })
        .collect();
    for w in workers {
        w.join().unwrap();
    }

    println!("counter {}", unsafe { *counter.0.get() });
    println!("overlaps {}", if overlapped.load(Ordering::Relaxed) { "yes" } else { "none" });
}
`,
  },
  examples: [
    {
      stdin: "1 1000\n",
      expected: "try_lock 101\ncounter 1000\noverlaps none\n",
    },
    {
      stdin: "4 20000\n",
      expected: "try_lock 101\ncounter 80000\noverlaps none\n",
    },
  ],
};
