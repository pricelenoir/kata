import type { TraceQuestion } from "@/types/question";

export const designPatternsQuestions: TraceQuestion[] = [
  {
    id: "design-patterns-meyers-singleton-01",
    category: "design-patterns",
    difficulty: "easy",
    title: "Meyer's Singleton and magic statics thread safety",
    tags: ["singleton", "magic-statics", "thread-safety", "c++11"],
    type: "trace",
    prompt:
      "Ten threads all call `Counter::instance().increment()` concurrently for the first " +
      "time, with no external locking. Compiled as C++11 or later. What happens?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Counter {
public:
    static Counter& instance() {
        static Counter c;   // function-local static
        return c;
    }
    void increment() { ++n_; }
    int get() const { return n_; }
private:
    Counter() = default;
    int n_ = 0;
};`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Undefined behavior — two threads may both construct `c` simultaneously, a data race",
        "Well-defined: the compiler guarantees exactly one thread runs the constructor, and every other thread that reaches the declaration concurrently blocks until it finishes",
        "Compile error: function-local statics cannot be used across threads",
        "Well-defined only if `-pthread` is passed at link time; otherwise it's UB",
      ],
      correctIndex: 1,
      },
    explanation:
      "Since C++11, [stmt.dcl]p4 mandates that initialization of a function-local static variable " +
      "is thread-safe: if control enters the declaration while it is being initialized by another " +
      "thread, the entering thread waits for completion. Compilers implement this with a hidden " +
      "guard variable and (on most ABIs) a double-checked pattern using acquire/release atomics or " +
      "a runtime lock — commonly nicknamed \"magic statics\". So exactly one thread runs `Counter()`, " +
      "all others block until it's done, and every thread then sees the fully-constructed object " +
      "with proper synchronization on the increments themselves still being the caller's responsibility " +
      "(here `increment()` itself is not synchronized, but the singleton's *construction* is safe). " +
      "Note MSVC only guarantees this since VS2015; older toolchains needed `/Zc:threadSafeInit`.",
    references: ["https://en.cppreference.com/w/cpp/language/storage_duration#Static_local_variables"],
  },
  {
    id: "design-patterns-singleton-destruction-order-02",
    category: "design-patterns",
    difficulty: "hard",
    title: "Cross-translation-unit Meyer's singletons and destruction order",
    tags: ["singleton", "static-initialization-order-fiasco", "destruction-order"],
    type: "trace",
    prompt:
      "`Logger` and `Config` are each Meyer's singletons defined in separate translation units. " +
      "`Logger`'s destructor writes a shutdown message using `Config::instance()`. Both singletons " +
      "get first-used (and thus first-constructed) during `main`, in the order shown. What happens " +
      "at program exit?",
    snippet: {
      language: "cpp",
      filename: "logger.cpp / config.cpp / main.cpp",
      code: `// config.cpp
class Config {
public:
    static Config& instance() { static Config c; return c; }
    std::string get(const std::string& key) { return data_[key]; }
private:
    std::unordered_map<std::string, std::string> data_{{"level", "info"}};
};

// logger.cpp
class Logger {
public:
    static Logger& instance() { static Logger l; return l; }
    ~Logger() {
        std::cout << "shutdown level=" << Config::instance().get("level") << "\\n";
    }
};

// main.cpp
int main() {
    Config::instance();   // constructed first
    Logger::instance();   // constructed second
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints \"shutdown level=info\" — construction order determines destruction order, and since Config was constructed first it is guaranteed to be destroyed after Logger",
        "Undefined behavior — Config may already be destroyed when Logger's destructor runs, since static destruction order across translation units is otherwise unspecified",
        "Compile error: a static local from another translation unit cannot be referenced in a destructor",
        "Prints \"shutdown level=\" (empty) deterministically, because Config's map is cleared before Logger's destructor runs",
      ],
      correctIndex: 0,
      },
    explanation:
      "Meyer's singletons sidestep the classic *static initialization order fiasco* for construction " +
      "(each is lazily constructed on first use, not at unspecified static-init time), but destruction " +
      "order is governed by the ordinary C++ rule: function-local statics are destroyed in the reverse " +
      "order of completion of their construction, and that rule holds across translation units too. " +
      "Because `Config::instance()` was invoked (and thus fully constructed) before `Logger::instance()` " +
      "in this run, `Config` is guaranteed to be destroyed strictly after `Logger`, so the access in " +
      "`~Logger()` is safe here. The danger is that this correctness is an accident of *use order*, not " +
      "a compile-time guarantee tied to declaration order — if some earlier code path had touched " +
      "`Logger::instance()` before `Config::instance()` (e.g. a log call during Config's own construction, " +
      "or a different startup path), the order would flip and `~Logger()` would read from an already-" +
      "destroyed `Config`, which is undefined behavior. This is exactly why singletons that depend on " +
      "each other during destruction are considered fragile even with magic statics.",
  },
  {
    id: "design-patterns-double-checked-locking-03",
    category: "design-patterns",
    difficulty: "hard",
    title: "Broken pre-C++11 double-checked locking singleton",
    tags: ["singleton", "double-checked-locking", "memory-order", "undefined-behavior"],
    type: "trace",
    prompt:
      "This hand-rolled double-checked-locking singleton predates `std::call_once` and magic " +
      "statics thinking, written the way it was commonly (and incorrectly) done pre-C++11, but " +
      "compiled with a modern optimizing C++17 compiler with no extra synchronization added. " +
      "Two threads call `instance()` for the first time concurrently. What can happen?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Widget {
public:
    static Widget* instance() {
        if (ptr_ == nullptr) {                 // 1st check, no lock
            std::lock_guard<std::mutex> lk(mtx_);
            if (ptr_ == nullptr) {              // 2nd check, locked
                ptr_ = new Widget();
            }
        }
        return ptr_;
    }
    int value = 42;
private:
    static Widget* ptr_;
    static std::mutex mtx_;
};
Widget* Widget::ptr_ = nullptr;
std::mutex Widget::mtx_;`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Always safe: the mutex inside the second check fully synchronizes construction",
        "A thread can see a non-null `ptr_` from the unlocked first check yet read `value` as garbage, because `new Widget()` is not a single atomic step — the store to `ptr_` can become visible before the constructor's writes are, absent an explicit release/acquire pairing",
        "Compile error: `ptr_` cannot be dereferenced before being assigned inside a lock",
        "Deadlock, because `mtx_` is locked twice by the same thread",
      ],
      correctIndex: 1,
      },
    explanation:
      "`new Widget()` conceptually involves allocating memory, running the constructor to write " +
      "`value = 42`, and then assigning the resulting address to `ptr_`. Nothing in this code stops the " +
      "compiler or CPU from reordering the write to `ptr_` ahead of the constructor's writes becoming " +
      "visible to other cores, because plain pointer reads/writes carry no memory-ordering guarantees. " +
      "A second thread executing the unlocked first check can therefore observe `ptr_ != nullptr` and " +
      "return it while `value` has not yet been written from that thread's point of view — reading " +
      "`value` is a data race and UB, not just \"maybe stale\". This is the textbook broken double-" +
      "checked-locking pattern (DCLP). The fix is either C++11 magic statics (a function-local static " +
      "`Widget`), or `std::call_once`, or making `ptr_` a `std::atomic<Widget*>` with explicit " +
      "`memory_order_release` on the store and `memory_order_acquire` on the unlocked load.",
    references: ["https://en.wikipedia.org/wiki/Double-checked_locking"],
  },
  {
    id: "design-patterns-call-once-04",
    category: "design-patterns",
    difficulty: "medium",
    title: "std::call_once as the correct fix for double-checked locking",
    tags: ["singleton", "call_once", "thread-safety"],
    type: "trace",
    prompt:
      "This version replaces manual double-checked locking with `std::call_once`. If the " +
      "initializer function throws on the first attempt (e.g. resource exhaustion), and a second " +
      "thread is concurrently blocked in `call_once` on the same `once_flag`, what happens?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Widget {
public:
    static Widget* instance() {
        std::call_once(flag_, [] {
            ptr_ = new Widget();     // may throw std::bad_alloc
        });
        return ptr_;
    }
private:
    static Widget* ptr_;
    static std::once_flag flag_;
};
Widget* Widget::ptr_ = nullptr;
std::once_flag Widget::flag_;`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The exception is swallowed by call_once; both threads return nullptr silently",
        "If the initializer throws, call_once propagates the exception out to the calling thread, and the flag is left as if the call never completed — another thread (or a later call) will retry the initializer",
        "Undefined behavior — call_once cannot be used with initializers that may throw",
        "The waiting thread deadlocks forever because the flag is permanently stuck in 'in progress' state",
      ],
      correctIndex: 1,
      },
    explanation:
      "Per [thread.once.callonce], if the invoked function exits via an exception, that exception " +
      "propagates to the caller of `call_once`, and the effects are as if the call never happened — " +
      "the `once_flag` is *not* marked completed. Any thread(s) that were blocked waiting for that first " +
      "call to finish are released and one of them becomes the new active initializer, retrying the " +
      "function; the flag only becomes permanently 'done' once some invocation of the callable returns " +
      "normally. This is precisely the property manual double-checked locking gets wrong by hand: it's " +
      "easy to accidentally mark a guard as 'initialized' before confirming the initializer actually " +
      "succeeded. `call_once` handles the exception-safety bookkeeping for you.",
    references: ["https://en.cppreference.com/w/cpp/thread/call_once"],
  },
  {
    id: "design-patterns-observer-dangling-05",
    category: "design-patterns",
    difficulty: "medium",
    title: "Observer holding a raw pointer back to a destroyed Subject",
    tags: ["observer", "raw-pointer", "dangling-pointer", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Subject;

struct Observer {
    Subject* subject;                 // raw back-pointer
    void notify() const;
};

struct Subject {
    std::vector<Observer*> observers;
    void attach(Observer* o) { observers.push_back(o); }
    ~Subject() {
        for (auto* o : observers) o->subject = nullptr;  // "best effort" cleanup
    }
    int state = 7;
};

void Observer::notify() const {
    std::cout << subject->state << "\\n";   // no null check!
}

int main() {
    Observer obs;
    {
        Subject s;
        obs.subject = &s;
        s.attach(&obs);
    }  // s destroyed here; Subject's dtor nulls obs.subject
    obs.notify();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints 7 — Subject's destructor already ran, but state is still readable",
        "Undefined behavior — Observer::notify() dereferences a null pointer (obs.subject was set to nullptr by ~Subject, but notify() never checks for that)",
        "Compile error: Subject is an incomplete type in Observer",
        "Prints garbage but is well-defined, since Subject::state is a plain int",
      ],
      correctIndex: 1,
      },
    explanation:
      "`~Subject()` does try to defensively null out each observer's back-pointer before the `Subject` " +
      "goes away — a common but incomplete mitigation. The bug is on the *Observer* side: `notify()` " +
      "unconditionally dereferences `subject` without checking for `nullptr`. After the block scope " +
      "ends, `obs.subject` is `nullptr`, and `obs.notify()` dereferences it, which is undefined behavior " +
      "(typically a segfault, but not guaranteed to be). Even the 'best effort' null-out only protects " +
      "against dereferencing a *dangling* pointer — it does nothing unless every read site also checks " +
      "for null, and it doesn't help at all against concurrent access. This is exactly the class of bug " +
      "`std::weak_ptr` observers are designed to eliminate: `.lock()` forces the caller to handle the " +
      "expired case at every use site rather than relying on manual bookkeeping in the subject.",
  },
  {
    id: "design-patterns-observer-weak-ptr-06",
    category: "design-patterns",
    difficulty: "medium",
    title: "Observer with weak_ptr but a missing lock() check",
    tags: ["observer", "weak_ptr", "shared_ptr", "lifetime"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Subject : std::enable_shared_from_this<Subject> {
    int state = 99;
};

struct Observer {
    std::weak_ptr<Subject> subject;
    void notify() const {
        auto sp = subject.lock();
        std::cout << sp->state << "\\n";   // BUG: sp not checked before use
    }
};

int main() {
    Observer obs;
    {
        auto s = std::make_shared<Subject>();
        obs.subject = s;
    }  // s's refcount drops to 0, Subject destroyed
    obs.notify();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Undefined behavior — lock() correctly returns an empty shared_ptr once the Subject is gone, but notify() dereferences it without checking, so sp->state is a null-pointer dereference",
        "Prints 99 — weak_ptr keeps the object alive as long as any Observer references it",
        "Throws std::bad_weak_ptr",
        "Compile error: cannot dereference a std::weak_ptr",
      ],
      correctIndex: 0,
      },
    explanation:
      "`weak_ptr` does exactly what it's supposed to here: it does *not* extend the `Subject`'s " +
      "lifetime, so once the last owning `shared_ptr` (`s`) goes out of scope, the `Subject` is " +
      "destroyed and `subject.lock()` correctly returns an empty `shared_ptr`. The bug is that the " +
      "fix isn't 'use weak_ptr' by itself — it's 'use weak_ptr *and* always check the result of " +
      "`lock()` before dereferencing'. Here `sp` is empty (`sp == nullptr`), and `sp->state` " +
      "dereferences a null `shared_ptr`, which is undefined behavior, not a thrown exception — " +
      "`operator->` and `operator*` on `shared_ptr` do not check for null. The `weak_ptr` pattern " +
      "only pays off when paired with an `if (auto sp = subject.lock())` guard at every use site.",
  },
  {
    id: "design-patterns-crtp-incomplete-07",
    category: "design-patterns",
    difficulty: "hard",
    title: "CRTP static polymorphism and incomplete-type-at-use",
    tags: ["crtp", "static-polymorphism", "template-method"],
    type: "trace",
    prompt: "Does this program compile, and if so what does it print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `template <typename Derived>
struct Base {
    void run() {
        static_cast<Derived*>(this)->step();
    }
    // no fallback step() defined in Base
};

struct Concrete : Base<Concrete> {
    void step() { std::cout << "Concrete::step\\n"; }
};

int main() {
    Concrete c;
    c.run();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: Base<Concrete> uses Concrete before it is fully defined",
        "Compiles and prints \"Concrete::step\" — by the time run() is instantiated and called, Concrete is a complete type, even though it was incomplete at the point Base<Concrete> was being defined as Concrete's base",
        "Infinite recursion at runtime between run() and step()",
        "Compile error: static_cast cannot convert Base<Derived>* to Derived*",
      ],
      correctIndex: 1,
      },
    explanation:
      "CRTP relies on a subtlety of two-phase lookup: at the point where `struct Concrete : Base<Concrete>` " +
      "is parsed, `Concrete` is indeed an incomplete type (still being defined), but `Base<Concrete>` is a " +
      "class *template*, and the body of `run()` is not instantiated until it's actually called — which " +
      "happens later, in `main()`, well after `Concrete` is complete. `static_cast<Derived*>(this)->step()` " +
      "is only compiled (and only needs `Derived` to be complete) at the point of instantiation, not at the " +
      "point of the template's textual definition. So this works precisely because member function bodies of " +
      "class templates are two-phase: uses of the complete type inside them are checked against the actual " +
      "template arguments only when instantiated. The failure mode described by 'incomplete type at point " +
      "of use' bites you only if you try to use `Derived`'s members *outside* a deferred/instantiation-time " +
      "context — e.g. in a non-template member of `Base` itself, or in a data member's type.",
  },
  {
    id: "design-patterns-crtp-infinite-recursion-08",
    category: "design-patterns",
    difficulty: "hard",
    title: "CRTP fallback method causing infinite recursion",
    tags: ["crtp", "static-polymorphism", "infinite-recursion"],
    type: "trace",
    prompt:
      "`Base` provides a *non-virtual* `step()` as a \"default\" fallback, intended to be hidden " +
      "by a derived class's own `step()`. `Sloppy` forgets to implement `step()`. What happens?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `template <typename Derived>
struct Base {
    void run() {
        static_cast<Derived*>(this)->step();
    }
    void step() {
        // "default" fallback behavior
        static_cast<Derived*>(this)->run();
    }
};

struct Sloppy : Base<Sloppy> {
    // forgot to define step()
};

int main() {
    Sloppy s;
    s.run();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: Sloppy must override step()",
        "Prints nothing useful but terminates normally — Base::step() is called once as a default",
        "Infinite recursion / stack overflow: Sloppy has no step() of its own so name lookup finds Base::step(), which itself calls run() again, calling step() again, forever",
        "Undefined behavior at compile time due to a cyclic template instantiation",
      ],
      correctIndex: 2,
      },
    explanation:
      "`static_cast<Derived*>(this)->step()` inside `run()` performs ordinary (non-virtual) member " +
      "lookup on `Derived`. Since `Sloppy` does not declare its own `step()`, lookup falls through to " +
      "the inherited `Base<Sloppy>::step()` — which is exactly the same as any normal (non-CRTP) name " +
      "hiding rule; CRTP gives no compile-time enforcement that `Derived` actually provides the expected " +
      "method. `Base::step()`'s fallback then calls `static_cast<Derived*>(this)->run()`, which calls " +
      "`step()` again, which calls `run()` again — an unbounded mutual recursion that overflows the " +
      "stack at runtime. This is the classic CRTP footgun: unlike a pure-virtual method in a runtime-" +
      "polymorphic base (which forces a compile error if unimplemented, or at minimum a link error for " +
      "an undefined pure virtual called at runtime), CRTP's 'expected interface' is enforced by nothing " +
      "but convention and, at best, `static_assert`/concepts the author has to add explicitly.",
  },
  {
    id: "design-patterns-policy-based-conflict-09",
    category: "design-patterns",
    difficulty: "medium",
    title: "Policy-based design with conflicting policy requirements",
    tags: ["policy-based-design", "templates", "compile-error"],
    type: "trace",
    prompt:
      "`SmartArray` is parameterized by a `CheckingPolicy`. `NoChecking` provides no `check()` " +
      "member at all (it's meant to be optimized away via a policy that never calls check), while " +
      "`BoundsChecking` does. What happens when `SmartArray<int, NoChecking>` is instantiated and " +
      "`operator[]` is actually called?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct NoChecking {
    // intentionally empty: no check() member
};

struct BoundsChecking {
    static void check(size_t idx, size_t size) {
        if (idx >= size) throw std::out_of_range("bad index");
    }
};

template <typename T, typename CheckingPolicy>
class SmartArray {
public:
    SmartArray(size_t n) : data_(n) {}
    T& operator[](size_t idx) {
        CheckingPolicy::check(idx, data_.size());   // always called unconditionally
        return data_[idx];
    }
private:
    std::vector<T> data_;
};

int main() {
    SmartArray<int, NoChecking> arr(10);
    arr[3] = 42;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Runs fine — NoChecking's absence of check() is treated as a no-op by the compiler",
        "Compile error inside operator[]: CheckingPolicy::check(idx, data_.size()) has no matching function, because NoChecking doesn't provide check(); the error surfaces at the instantiation of SmartArray<int, NoChecking>::operator[], often with a long template-nested diagnostic",
        "Runtime undefined behavior — check() is silently skipped via SFINAE",
        "Links fine but crashes at runtime with a pure virtual call",
      ],
      correctIndex: 1,
      },
    explanation:
      "Policy-based design lets you swap behavior via template parameters, but the policy's " +
      "*interface contract* is only checked at the point of use, unenforced by the language itself " +
      "unless you add `static_assert`/concepts. `operator[]` unconditionally calls " +
      "`CheckingPolicy::check(...)`; that's fine for `BoundsChecking`, but `NoChecking` supplies no " +
      "such member, so the call fails to compile the moment `operator[]` is instantiated for " +
      "`SmartArray<int, NoChecking>` — not when `SmartArray` itself is defined, since templates are " +
      "only checked at instantiation. The intended design (a no-op policy that avoids the check " +
      "entirely) requires `NoChecking` to actually define an empty `check()`, or requires the caller to " +
      "branch on the policy with `if constexpr` so the call is never even instantiated for policies " +
      "that don't support it. This is exactly the kind of hard-to-read template error Alexandrescu's " +
      "policy design is notorious for producing when two policies don't share a consistent surface.",
  },
  {
    id: "design-patterns-type-erasure-sbo-10",
    category: "design-patterns",
    difficulty: "hard",
    title: "Hand-rolled type erasure and small-buffer optimization",
    tags: ["type-erasure", "std-function", "sbo", "heap-allocation"],
    type: "trace",
    prompt:
      "This is a minimal hand-rolled `std::function`-like type-erasure wrapper with a 16-byte " +
      "inline buffer for small-buffer optimization (SBO). `BigCallable` has a `std::array<int, 8>` " +
      "capture (32 bytes), far exceeding the 16-byte inline buffer. What happens when it's stored " +
      "in `AnyCallable`?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class AnyCallable {
public:
    template <typename F>
    AnyCallable(F f) {
        if constexpr (sizeof(F) <= sizeof(buffer_) && alignof(F) <= alignof(std::max_align_t)) {
            new (&buffer_) F(std::move(f));
            invoke_ = [](void* storage) { return (*reinterpret_cast<F*>(storage))(); };
            heap_ = false;
        } else {
            ptr_ = new F(std::move(f));
            invoke_ = [](void* storage) { return (*reinterpret_cast<F*>(storage))(); };
            heap_ = true;
        }
    }
    int operator()() { return invoke_(heap_ ? ptr_ : static_cast<void*>(&buffer_)); }
private:
    alignas(std::max_align_t) unsigned char buffer_[16];
    void* ptr_ = nullptr;
    int (*invoke_)(void*) = nullptr;
    bool heap_ = false;
};

struct BigCallable {
    std::array<int, 8> data{1,2,3,4,5,6,7,8};
    int operator()() const { return data[0]; }
};

int main() {
    AnyCallable c(BigCallable{});
    std::cout << c() << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "sizeof(F) <= 16 is false for BigCallable, so the else branch runs: it heap-allocates via new F(...), and c() correctly prints 1",
        "Compile error: BigCallable is too large for the inline buffer",
        "Buffer overflow — placement-new writes 32 bytes into a 16-byte buffer_, corrupting ptr_/invoke_/heap_",
        "Undefined behavior because BigCallable is not trivially copyable",
      ],
      correctIndex: 0,
      },
    explanation:
      "`sizeof(BigCallable)` is 32 bytes (an 8-element `int` array), which exceeds " +
      "`sizeof(buffer_) == 16`, so the `if constexpr` condition is false at compile time and the " +
      "*else* branch is selected — the callable is heap-allocated via `new F(std::move(f))` and " +
      "`heap_` is set to `true`. `operator()` correctly dispatches to `ptr_` in that case, so the call " +
      "is well-defined and prints `1`. This illustrates the actual gotcha SBO-based type erasure " +
      "carries: whether a given callable heap-allocates or not is a *silent, size-dependent* branch " +
      "decided per instantiation — a capture that's one `int` too large (or has a lambda captured-by-" +
      "value struct with heavier state, e.g. capturing a `std::string` by value) silently falls off the " +
      "fast SBO path onto a heap allocation, with no compiler warning, which is exactly why profiling " +
      "`std::function`-heavy code can show surprising allocation hotspots.",
    references: ["https://en.cppreference.com/w/cpp/utility/functional/function"],
  },
  {
    id: "design-patterns-type-erasure-dangling-11",
    category: "design-patterns",
    difficulty: "hard",
    title: "Type erasure capturing a reference to a temporary",
    tags: ["type-erasure", "std-function", "lambda", "dangling-reference"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <functional>
#include <iostream>
#include <string>

std::function<const std::string&()> makeGetter(const std::string& s) {
    return [&s]() -> const std::string& { return s; };   // captures s by reference
}

int main() {
    std::function<const std::string&()> getter = makeGetter(std::string("hello"));
    std::cout << getter() << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints \"hello\" — std::function extends the lifetime of anything it captures",
        "Undefined behavior — the lambda captures the reference parameter s by reference, and the temporary std::string(\"hello\") bound to s is destroyed once makeGetter returns, leaving both the capture and the returned reference dangling",
        "Compile error: cannot capture a reference parameter by reference",
        "Prints an empty string, since std::string's SSO buffer is zero-initialized on destruction",
      ],
      correctIndex: 1,
      },
    explanation:
      "`makeGetter`'s parameter `s` is a `const std::string&` bound to the temporary " +
      "`std::string(\"hello\")` passed at the call site — a temporary bound to a *function parameter*, " +
      "not directly to a reference at its declaration, gets no lifetime extension and is destroyed when " +
      "`makeGetter` returns. The lambda `[&s]` captures `s` *by reference*, so the erased callable stored " +
      "inside the returned `std::function` holds a reference to a reference to an already-destroyed " +
      "temporary. `std::function`'s type erasure performs no lifetime management of anything the wrapped " +
      "callable happens to reference — it only owns the closure object itself (by value, copied/moved in). " +
      "Calling `getter()` reads through a dangling reference: undefined behavior. The fix is to capture " +
      "`s` by value (`[s]`) so the closure owns its own copy of the string.",
  },
  {
    id: "design-patterns-pimpl-rule-of-five-12",
    category: "design-patterns",
    difficulty: "medium",
    title: "PImpl and the implicitly-defaulted destructor with an incomplete type",
    tags: ["pimpl", "unique_ptr", "incomplete-type", "rule-of-five"],
    type: "trace",
    prompt:
      "`Widget.h` declares `~Widget()` implicitly (i.e. does not declare it at all, letting the " +
      "compiler generate it). What happens when a translation unit that only includes `Widget.h` " +
      "(not `Widget.cpp`) constructs and destroys a `Widget`?",
    snippet: {
      language: "cpp",
      filename: "Widget.h",
      code: `// Widget.h
#include <memory>

class Widget {
public:
    Widget();
    void doWork();
    // no destructor declared -- relying on the implicit one
private:
    class Impl;
    std::unique_ptr<Impl> pImpl_;
};

// Widget.cpp
#include "Widget.h"
struct Widget::Impl { int state = 0; };
Widget::Widget() : pImpl_(std::make_unique<Impl>()) {}
void Widget::doWork() { pImpl_->state++; }

// user.cpp
#include "Widget.h"
int main() {
    Widget w;
    w.doWork();
}   // w destroyed here`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compiles and runs fine — unique_ptr's default deleter works with any type, complete or not",
        "Compile error in user.cpp: the implicitly-generated ~Widget() calls unique_ptr<Impl>'s deleter, which requires Impl to be a complete type at the point of instantiation, and Impl is only complete inside Widget.cpp",
        "Links fine but crashes at runtime, since Impl's destructor is never called",
        "Compile error in Widget.cpp instead, because Impl is defined after it's used",
      ],
      correctIndex: 1,
      },
    explanation:
      "`std::unique_ptr<Impl>`'s default deleter (`default_delete<Impl>`) calls `delete` on the " +
      "stored pointer, and `delete` on an incomplete type is ill-formed — [expr.delete] requires " +
      "the pointee to be a complete type (except for the trivial case of a null pointer constant), " +
      "because the compiler must know `Impl`'s destructor and size to destroy it correctly. Because " +
      "no destructor is declared for `Widget`, the compiler implicitly generates one *at every point " +
      "the implicit destructor is needed* — which includes `user.cpp`, since that TU default-" +
      "constructs and destroys a `Widget` and only sees the forward declaration `class Impl;`. The " +
      "canonical PImpl fix is to declare `~Widget();` in the header (even with no other special " +
      "members needed) and define it `= default;` out-of-line in `Widget.cpp`, where `Impl` is a " +
      "complete type — the same reasoning applies to any implicitly-generated copy constructor, " +
      "forcing PImpl classes to explicitly declare-and-out-of-line-default the whole Rule-of-Five " +
      "suite (or at least move ctor/assignment and destructor) even when their bodies would otherwise " +
      "be trivial.",
    references: ["https://en.cppreference.com/w/cpp/language/pimpl"],
  },
  {
    id: "design-patterns-factory-ownership-13",
    category: "design-patterns",
    difficulty: "easy",
    title: "Factory returning a raw pointer and an ownership-transfer leak",
    tags: ["factory", "ownership", "raw-pointer", "memory-leak"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Shape { virtual ~Shape() = default; virtual double area() const = 0; };
struct Circle : Shape { double area() const override { return 3.14; } };

Shape* createShape(const std::string& kind) {
    if (kind == "circle") return new Circle();
    return nullptr;
}

void useShape() {
    Shape* s = createShape("circle");
    if (s->area() > 1.0) {
        std::cout << "big\\n";
        return;              // early return -- s is never deleted
    }
    delete s;
}

int main() {
    useShape();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints \"big\" and leaks the Circle — every early-return / exception path after a raw-pointer factory call must remember to delete, and this one doesn't",
        "Compile error: createShape must return a smart pointer",
        "Undefined behavior — s is used before being checked for null",
        "Prints \"big\" with no leak, since Circle has no members to free",
      ],
      correctIndex: 0,
      },
    explanation:
      "`createShape` returns an owning raw `Shape*` — the factory's contract (the caller must " +
      "eventually `delete` it) is documented nowhere in the type system, only in convention/comments. " +
      "`useShape()` takes ownership implicitly and does remember to `delete s` on one path, but the " +
      "early `return` inside the `if` branch skips that `delete` entirely, leaking the `Circle`. " +
      "(The object does have a `virtual ~Shape()`, so had `delete s` executed it would have correctly " +
      "invoked `~Circle()` via dynamic dispatch — the bug here is a leak, not slicing or UB.) A factory " +
      "returning `std::unique_ptr<Shape>` instead would make ownership self-documenting and exception/" +
      "early-return-safe automatically: the destructor runs when `s` goes out of scope on *every* exit " +
      "path, no manual bookkeeping required. This is precisely why 'factory returns raw pointer' is " +
      "considered an anti-pattern in modern C++ outside of narrow non-owning-view use cases.",
  },
  {
    id: "design-patterns-builder-dangling-14",
    category: "design-patterns",
    difficulty: "hard",
    title: "Builder chaining with a reference-returning getter on a temporary",
    tags: ["builder", "method-chaining", "dangling-reference", "temporaries"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class RequestBuilder {
public:
    RequestBuilder& setHost(std::string h) { host_ = std::move(h); return *this; }
    RequestBuilder& setPath(std::string p) { path_ = std::move(p); return *this; }
    const std::string& path() const { return path_; }   // returns a reference into *this
private:
    std::string host_;
    std::string path_;
};

int main() {
    const std::string& p =
        RequestBuilder().setHost("api.example.com").setPath("/v1/users").path();
    std::cout << p << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'Prints "/v1/users" safely',
        "Undefined behavior — the RequestBuilder temporary is destroyed at the end of the full expression, and p is a reference into a member of that now-destroyed temporary; binding p directly does not extend the temporary's lifetime because the reference is bound to a sub-object reached through a chain of function calls, not to the temporary itself",
        "Compile error: cannot bind const std::string& to a temporary's member",
        "Prints an empty string, since path_ is reset after the chain completes",
      ],
      correctIndex: 1,
      },
    explanation:
      "`RequestBuilder()` constructs a temporary; `.setHost(...)` and `.setPath(...)` return " +
      "`RequestBuilder&` referring back to that *same* temporary (fine, since it's still alive for the " +
      "rest of the full expression), but `.path()` returns `const std::string&` bound to a *member* of " +
      "the temporary. The C++ lifetime-extension rule ([class.temporary]) only extends a temporary's " +
      "lifetime when a reference is bound *directly* to it at the point of initialization; here `p` " +
      "is initialized from a reference returned by a function call, which is exactly the case the " +
      "extension rule explicitly does not cover (the same trap as returning `const std::string&` from " +
      "a function that binds to a local). The `RequestBuilder` temporary is destroyed at the end of " +
      "the full expression, taking `path_`'s storage with it, and `p` is left dangling before " +
      "`std::cout << p` even runs — undefined behavior, though it may 'look correct' if the freed " +
      "stack memory hasn't been reused yet.",
  },
  {
    id: "design-patterns-decorator-slicing-15",
    category: "design-patterns",
    difficulty: "medium",
    title: "Decorator pattern and object slicing when stored by value",
    tags: ["decorator", "object-slicing", "inheritance", "virtual-dispatch"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Coffee {
    virtual std::string describe() const { return "Coffee"; }
    virtual ~Coffee() = default;
};

struct WithMilk : Coffee {
    Coffee inner;   // WRONG: should hold a Coffee* / reference / smart pointer to decorate
    explicit WithMilk(Coffee c) : inner(std::move(c)) {}
    std::string describe() const override { return inner.describe() + " + Milk"; }
};

Coffee makeFancy(Coffee base) {
    WithMilk decorated(base);
    Coffee result = decorated;   // stored by value in a plain Coffee
    return result;
}

int main() {
    std::cout << makeFancy(Coffee{}).describe() << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        '"Coffee + Milk" — describe() is virtual so it always resolves to the most-derived override',
        '"Coffee" — Coffee result = decorated; slices WithMilk down to its Coffee base subobject, discarding the inner member entirely, so result.describe() calls Coffee::describe(), not WithMilk::describe()',
        "Compile error: cannot copy-construct a Coffee from a WithMilk by value",
        "Undefined behavior — inner is left uninitialized after slicing",
      ],
      correctIndex: 1,
      },
    explanation:
      "The Decorator pattern fundamentally requires decorators to be composed and referred to " +
      "*polymorphically* — through pointers or references to the common base — precisely so that " +
      "virtual dispatch keeps working through arbitrary layers of wrapping. `Coffee result = decorated;` " +
      "declares `result` with static type `Coffee`, and copy-initializing a `Coffee` from a `WithMilk` " +
      "invokes `Coffee`'s copy constructor, which only knows how to copy the `Coffee` base subobject — " +
      "the `WithMilk`-specific `inner` member (and the fact that the object was ever a `WithMilk`) is " +
      "silently discarded. This is classic object slicing. `result.describe()` is a virtual call, but " +
      "`result`'s dynamic type genuinely *is* `Coffee` now (the vptr was copied/reset to Coffee's " +
      "during slicing), so it dispatches to `Coffee::describe()` and prints just \"Coffee\" — the " +
      "\"+ Milk\" is gone, not because virtual dispatch failed, but because the derived object no " +
      "longer exists. Decorators must be stored/returned via `unique_ptr<Coffee>`/`Coffee&`/`Coffee*` " +
      "to avoid this.",
  },
  {
    id: "design-patterns-visitor-missing-override-16",
    category: "design-patterns",
    difficulty: "medium",
    title: "Classic Visitor pattern and adding a new visitable type",
    tags: ["visitor", "double-dispatch", "pure-virtual"],
    type: "trace",
    prompt:
      "A new shape, `Triangle`, is added to the hierarchy and its `accept()` is implemented, but " +
      "the author forgets to add a `visit(Triangle&)` overload to `AreaVisitor`. What happens?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Circle; struct Square; struct Triangle;

struct ShapeVisitor {
    virtual void visit(Circle&) = 0;
    virtual void visit(Square&) = 0;
    // no visit(Triangle&) added
    virtual ~ShapeVisitor() = default;
};

struct Shape { virtual void accept(ShapeVisitor&) = 0; virtual ~Shape() = default; };
struct Circle : Shape { void accept(ShapeVisitor& v) override { v.visit(*this); } };
struct Square : Shape { void accept(ShapeVisitor& v) override { v.visit(*this); } };
struct Triangle : Shape { void accept(ShapeVisitor& v) override { v.visit(*this); } };

struct AreaVisitor : ShapeVisitor {
    void visit(Circle&) override { std::cout << "circle area\\n"; }
    void visit(Square&) override { std::cout << "square area\\n"; }
};

int main() {
    AreaVisitor av;
    Triangle t;
    t.accept(av);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: Triangle::accept can't call v.visit(*this) since no visit(Triangle&) overload exists in ShapeVisitor",
        "Compile error: AreaVisitor is an abstract class (still has a pure virtual visit(Triangle&) from ShapeVisitor) and so cannot be instantiated — the error is caught at 'AreaVisitor av;', not inside Triangle::accept",
        "Compiles and links, but calling t.accept(av) silently does nothing at runtime",
        "Runtime crash: pure virtual function called",
      ],
      correctIndex: 0,
      },
    explanation:
      "Nothing about adding `Triangle` to the `Shape` hierarchy adds a corresponding " +
      "`visit(Triangle&)` to `ShapeVisitor` automatically — that has to be done by hand, which is " +
      "exactly the well-known weakness of the classic double-dispatch Visitor: extending the set of " +
      "*visitable* types requires touching the visitor base interface (and, transitively, every " +
      "concrete visitor), the mirror image of the Expression Problem. Here `ShapeVisitor` was never " +
      "given a `visit(Triangle&)` overload at all, so `Triangle::accept`'s call `v.visit(*this)` " +
      "(`*this` being `Triangle&`) fails to find a matching overload of `visit` in `ShapeVisitor` — a " +
      "hard compile error at the call site inside `Triangle::accept`, not merely an abstract-class " +
      "instantiation error. Had `ShapeVisitor::visit(Triangle&)` been declared pure virtual but left " +
      "unimplemented in `AreaVisitor`, the error would instead surface at `AreaVisitor av;` (cannot " +
      "instantiate an abstract class) — a different, arguably more useful diagnostic. Either way, the " +
      "compiler does catch the omission; it just doesn't catch it silently at runtime.",
  },
  {
    id: "design-patterns-variant-visit-exhaustive-17",
    category: "design-patterns",
    difficulty: "easy",
    title: "std::variant + std::visit exhaustiveness as a modern Visitor",
    tags: ["visitor", "std-variant", "std-visit", "compile-error"],
    type: "trace",
    prompt:
      "A new alternative, `double`, is added to `Shape`. The visitor lambda overload set passed " +
      "to `std::visit` is not updated to handle it. What happens?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <variant>
#include <iostream>
#include <string>

struct Circle { double r; };
struct Square { double s; };

using Shape = std::variant<Circle, Square, double>;   // double added later

struct AreaVisitor {
    double operator()(const Circle& c) const { return 3.14 * c.r * c.r; }
    double operator()(const Square& s) const { return s.s * s.s; }
    // no overload for double
};

int main() {
    Shape shape = 2.5;
    std::cout << std::visit(AreaVisitor{}, shape) << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: std::visit requires the visitor to be callable with every alternative type in the variant, and AreaVisitor has no operator()(double) overload",
        "Runtime std::bad_variant_access, since shape currently holds a double",
        "Compiles fine — operator()(const Circle&) is implicitly used as a fallback for unmatched types",
        "Prints 0, since double implicitly converts to Circle via aggregate initialization",
      ],
      correctIndex: 0,
      },
    explanation:
      "`std::visit`'s requirements ([variant.visit]) state that the visitor must be *invocable* " +
      "with every possible alternative type the variant could hold, checked at compile time regardless " +
      "of which alternative is actually active at runtime — this is precisely how `std::variant` + " +
      "`std::visit` gives Visitor-like exhaustiveness checking without hand-rolled `accept`/`visit` " +
      "boilerplate. `AreaVisitor` has no `operator()(double)`, so `std::visit(AreaVisitor{}, shape)` " +
      "fails to compile, with the diagnostic typically pointing at the invalid invocation inside " +
      "`std::visit`'s implementation rather than directly at the missing overload. This is the key " +
      "tradeoff versus classic double-dispatch Visitor: adding a new alternative to the `variant` " +
      "still requires updating every visitor, but the compiler enforces it centrally at every " +
      "`std::visit` call site, rather than requiring a separate abstract-base `visit(NewType&)` pure " +
      "virtual to be threaded through the whole visitor hierarchy by hand.",
    references: ["https://en.cppreference.com/w/cpp/utility/variant/visit"],
  },
  {
    id: "design-patterns-raii-rule-of-three-18",
    category: "design-patterns",
    difficulty: "medium",
    title: "RAII wrapper violating the Rule of Three — double free",
    tags: ["raii", "rule-of-three", "double-free", "copy-constructor"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class FileHandle {
public:
    explicit FileHandle(const char* path) : fp_(std::fopen(path, "r")) {}
    ~FileHandle() { if (fp_) std::fclose(fp_); }
    // no copy constructor / copy assignment declared -- compiler generates
    // a shallow member-wise copy of fp_ (a raw FILE*)
private:
    FILE* fp_;
};

void process(FileHandle fh) {   // taken by value -- triggers a copy
    // use fh...
}

int main() {
    FileHandle original("data.txt");
    process(original);          // copies original; both now share the same FILE*
}   // process's fh destructs (fclose), then original destructs (fclose again)`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Well-defined — RAII guarantees the resource is only freed once regardless of how many copies exist",
        "Undefined behavior — the implicit copy constructor shallow-copies the raw FILE* into fh, so both fh and original independently fclose() the same handle: a double free/double close",
        "Compile error: FileHandle cannot be passed by value because it manages a resource",
        "Well-defined — fclose() on an already-closed FILE* is a documented no-op",
      ],
      correctIndex: 1,
      },
    explanation:
      "RAII only guarantees correct cleanup if the class's copy/move semantics are actually managed " +
      "correctly — 'RAII' by itself is just 'acquire in the constructor, release in the destructor'; it " +
      "says nothing about what happens on copy unless the author also handles that. Because `FileHandle` " +
      "declares a custom destructor but no copy constructor or copy assignment operator, the compiler " +
      "still implicitly generates them (this predates the C++11 rule that a user-declared destructor " +
      "suppresses the implicit *move* operations, but copy operations are still implicitly generated " +
      "unless explicitly suppressed), and the implicit copy constructor performs a shallow, member-wise " +
      "copy — copying the raw `FILE*` value, not duplicating the underlying OS file handle. `process(original)` " +
      "creates `fh` as a bit-for-bit copy of `original`'s `fp_`. When `process` returns, `fh`'s destructor " +
      "calls `fclose(fp_)`; when `main` ends, `original`'s destructor calls `fclose()` on the *same* " +
      "already-closed `FILE*` — a double free, undefined behavior. This is exactly what the Rule of Three " +
      "(and Rule of Five) demands: any class managing a raw resource must explicitly define or `= delete` " +
      "its copy constructor/assignment (and ideally implement move semantics) rather than relying on the " +
      "implicit member-wise versions.",
    references: ["https://en.cppreference.com/w/cpp/language/rule_of_three"],
  },
  {
    id: "design-patterns-object-pool-uaf-19",
    category: "design-patterns",
    difficulty: "hard",
    title: "Object Pool — stale reference after an object is returned to the pool",
    tags: ["object-pool", "use-after-free", "dangling-reference"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Connection { public: int id = 0; std::string lastQuery; };

class ConnectionPool {
public:
    Connection& acquire() {
        if (free_.empty()) free_.push_back(std::make_unique<Connection>());
        auto conn = std::move(free_.back());
        free_.pop_back();
        Connection& ref = *conn;
        inUse_.push_back(std::move(conn));
        return ref;
    }
    void release(Connection& c) {
        for (auto it = inUse_.begin(); it != inUse_.end(); ++it) {
            if (it->get() == &c) {
                free_.push_back(std::move(*it));
                inUse_.erase(it);
                return;
            }
        }
    }
private:
    std::vector<std::unique_ptr<Connection>> free_, inUse_;
};

int main() {
    ConnectionPool pool;
    Connection& c1 = pool.acquire();
    c1.lastQuery = "SELECT 1";
    pool.release(c1);                 // c1 handed back; caller keeps using the reference

    Connection& c2 = pool.acquire();  // pool hands the SAME object back out
    c2.lastQuery = "SELECT 2";

    std::cout << c1.lastQuery << "\\n";  // c1 is stale but still 'valid' memory-wise
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'Prints "SELECT 1" — c1 and c2 are unrelated objects',
        'Prints "SELECT 2" — the pool reused the same underlying Connection for c2, and c1 is a stale alias to it that the caller kept using after releasing it; this compiles and \"works\" but is a logic bug, a use-after-release hazard specific to pooling',
        "Undefined behavior — c1 is a dangling reference after release()",
        "Compile error: c1 is a reference to a temporary",
      ],
      correctIndex: 1,
      },
    explanation:
      "This is well-defined memory-wise (unlike a true dangling-pointer UB case) but is a textbook " +
      "Object Pool correctness bug: `release()` doesn't destroy the `Connection`, it just moves the " +
      "owning `unique_ptr` from `inUse_` back to `free_` — the `Connection` object itself keeps living " +
      "at the same address. `c1` is a `Connection&` that was never invalidated by `release()`, so it " +
      "remains a 'valid' reference to that same object. When `pool.acquire()` is called again, the pool " +
      "happily hands out the exact same `Connection` (now aliased as `c2`) because it's sitting at the " +
      "front of `free_`. Writing through `c2` (`c2.lastQuery = \"SELECT 2\"`) is therefore also visible " +
      "through `c1`, since they're the same object — printing \"SELECT 2\", not \"SELECT 1\". The real-" +
      "world danger of Object Pools is exactly this: nothing stops a caller from continuing to hold and " +
      "use a reference/pointer after calling `release()`, since the pool has no way to invalidate " +
      "outstanding references — this is why pool-backed handles are often wrapped in a move-only RAII " +
      "'lease' type that nulls itself out on release, rather than exposing a raw `T&` from `acquire()`.",
  },
  {
    id: "design-patterns-flyweight-mutation-20",
    category: "design-patterns",
    difficulty: "hard",
    title: "Flyweight pattern — mutating shared intrinsic state",
    tags: ["flyweight", "shared-state", "aliasing"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class GlyphFlyweight {
public:
    explicit GlyphFlyweight(char c) : ch_(c) {}
    char ch_;   // intended to be shared, immutable "intrinsic" state
    void render(int x) const { std::cout << ch_ << "@" << x << " "; }
};

class GlyphFactory {
public:
    GlyphFlyweight& get(char c) {
        auto it = cache_.find(c);
        if (it != cache_.end()) return *it->second;
        auto [inserted, _] = cache_.emplace(c, std::make_unique<GlyphFlyweight>(c));
        return *inserted->second;
    }
private:
    std::unordered_map<char, std::unique_ptr<GlyphFlyweight>> cache_;
};

int main() {
    GlyphFactory factory;
    GlyphFlyweight& a1 = factory.get('a');
    GlyphFlyweight& a2 = factory.get('a');   // same shared flyweight as a1

    a1.render(0);
    a2.ch_ = 'X';   // caller mutates what it thinks is "its own" glyph
    a1.render(10);  // uses the SAME underlying flyweight as a2

    std::cout << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "a@0 a@10 — a1 and a2 are logically independent copies",
        "a@0 X@10 — a1 and a2 are references to the exact same cached GlyphFlyweight object, so mutating ch_ through a2 corrupts what a1 (and every other caller that requested 'a') sees, since Flyweight's whole premise is that intrinsic state is shared and assumed immutable by every holder",
        "Compile error: ch_ is not mutable through a const reference",
        "Undefined behavior — the unordered_map's iterator is invalidated by emplace",
      ],
      correctIndex: 1,
      },
    explanation:
      "The Flyweight pattern's entire value proposition is sharing one object among many logical " +
      "'users' to save memory — `GlyphFactory::get('a')` returns a reference to the *same* cached " +
      "`GlyphFlyweight` every time it's asked for `'a'`, by design. That only works safely if every " +
      "caller treats the shared object's intrinsic state as read-only; nothing in this code enforces " +
      "that (`ch_` is a public, non-const `char` member), so `a2.ch_ = 'X'` mutates the one-and-only " +
      "`'a'` flyweight in place. Since `a1` and `a2` are references to that same object, `a1.render(10)` " +
      "now prints `'X'`, not `'a'` — every other holder of the `'a'` flyweight elsewhere in the program " +
      "would see the same corruption. The fix is to make intrinsic state genuinely immutable (e.g. " +
      "`const char ch_`, only settable via the constructor, with no public mutators) so the type system " +
      "prevents exactly this kind of accidental cross-contamination between unrelated logical owners of " +
      "a shared flyweight.",
  },
  {
    id: "design-patterns-di-unique-ptr-21",
    category: "design-patterns",
    difficulty: "medium",
    title: "Constructor injection with unique_ptr rejecting a legitimate shared-ownership case",
    tags: ["dependency-injection", "unique_ptr", "ownership"],
    type: "trace",
    prompt:
      "`Service` takes ownership of its `Logger` dependency via `unique_ptr`. The application " +
      "wants a single shared `Logger` instance injected into two different services. Does this " +
      "compile?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Logger { virtual void log(const std::string&) = 0; virtual ~Logger() = default; };
struct ConsoleLogger : Logger { void log(const std::string& s) override { std::cout << s << "\\n"; } };

class ServiceA {
public:
    explicit ServiceA(std::unique_ptr<Logger> logger) : logger_(std::move(logger)) {}
private:
    std::unique_ptr<Logger> logger_;
};

class ServiceB {
public:
    explicit ServiceB(std::unique_ptr<Logger> logger) : logger_(std::move(logger)) {}
private:
    std::unique_ptr<Logger> logger_;
};

int main() {
    auto logger = std::make_unique<ConsoleLogger>();
    ServiceA a(std::move(logger));
    ServiceB b(std::move(logger));   // logger already moved-from
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compiles and runs fine — both services share the same Logger",
        "Compiles, but ServiceB is constructed with a null unique_ptr<Logger>, since logger was already moved-from by the ServiceA construction; unique_ptr's exclusive-ownership contract makes this ownership design incompatible with the two-owners requirement, and it fails at runtime rather than compile time here",
        "Compile error: unique_ptr cannot be moved twice",
        "Compile error: ServiceB's constructor is ambiguous",
      ],
      correctIndex: 1,
      },
    explanation:
      "`unique_ptr<Logger>` as the injected dependency type is a design decision that *bakes in* " +
      "single ownership: only one `Service` can ever own a given `Logger` instance at a time. " +
      "`std::move(logger)` transfers ownership into `ServiceA`'s `logger_`, leaving the local `logger` " +
      "variable in the valid-but-unspecified 'moved-from' state (for `unique_ptr` specifically, moved-" +
      "from means null). Passing it again to `ServiceB`'s constructor compiles fine — `std::move` is " +
      "just a cast, the language doesn't track 'already moved from' as a distinct type state — but " +
      "`ServiceB` ends up holding a null `logger_`; any call to `logger_->log(...)` inside `ServiceB` " +
      "is a null-pointer dereference, undefined behavior, discovered only at runtime (and only if that " +
      "code path is exercised, e.g. under test coverage that happens to hit it). This is the real " +
      "tradeoff: `unique_ptr` deliberately forecloses two-owners designs, forcing a redesign to " +
      "`shared_ptr<Logger>` (or a non-owning `Logger&`/`Logger*` passed alongside separately-managed " +
      "lifetime) the moment a legitimate shared-dependency requirement shows up — the compiler doesn't " +
      "flag the mismatch, it just silently produces a null dependency.",
  },
  {
    id: "design-patterns-di-shared-ptr-lifetime-22",
    category: "design-patterns",
    difficulty: "hard",
    title: "shared_ptr injection masking a cyclic-lifetime bug unique_ptr would have caught",
    tags: ["dependency-injection", "shared_ptr", "reference-cycle", "memory-leak"],
    type: "trace",
    prompt:
      "`Parent` and `Child` are wired together via constructor-injected `shared_ptr`s, each " +
      "holding a `shared_ptr` back to the other so either can reach the other at any time. What " +
      "happens after `main` returns?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Child;

struct Parent {
    std::shared_ptr<Child> child;
    ~Parent() { std::cout << "~Parent\\n"; }
};

struct Child {
    std::shared_ptr<Parent> parent;   // injected back-reference, also shared_ptr
    ~Child() { std::cout << "~Child\\n"; }
};

int main() {
    auto p = std::make_shared<Parent>();
    auto c = std::make_shared<Child>();
    p->child = c;
    c->parent = p;
    // p and c go out of scope here
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints \"~Child\" then \"~Parent\" — shared_ptr always tears down cycles correctly via reference counting",
        "Prints nothing — Parent and Child form a reference cycle (p->child keeps Child alive, c->parent keeps Parent alive), so neither's refcount ever reaches zero and both leak; a unique_ptr for the back-reference would have failed to compile the two-owners cycle outright, exposing the lifetime design flaw at compile time instead of leaking silently",
        "Runtime crash: stack overflow from recursive destructor calls",
        "Compile error: shared_ptr cannot form a cycle between two forward-declared types",
      ],
      correctIndex: 1,
      },
    explanation:
      "Each `shared_ptr` copy increments a control-block refcount, and an object is destroyed only " +
      "when its refcount hits zero. After `p->child = c; c->parent = p;`, the `Parent` object is kept " +
      "alive by two references (the local `p` and `c->parent`), and the `Child` object is kept alive by " +
      "two references (the local `c` and `p->child`). When `p` and `c` go out of scope at the end of " +
      "`main`, each drops the refcount by one — but each object's refcount is still `1`, held by the " +
      "*other* object's member, so neither destructor ever runs: nothing is printed, and both objects " +
      "leak for the life of the program. This is `shared_ptr`'s classic footgun as a dependency-" +
      "injection vehicle for bidirectional relationships: it silently 'solves' the two-owners problem " +
      "that `unique_ptr` would have refused to compile (you cannot copy a `unique_ptr` to wire up a " +
      "cycle), but at the cost of hiding a genuine lifetime bug until you notice the leak. The standard " +
      "fix is to make one direction (typically the back-reference, `Child::parent`) a `weak_ptr` instead, " +
      "breaking the cycle while still allowing the child to reach its parent via `.lock()`.",
    references: ["https://en.cppreference.com/w/cpp/memory/weak_ptr"],
  },
  {
    id: "design-patterns-null-object-side-effect-23",
    category: "design-patterns",
    difficulty: "medium",
    title: "Null Object pattern hiding an unexpected side effect",
    tags: ["null-object", "virtual-dispatch", "optional"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Logger { virtual void log(const std::string& msg) = 0; virtual ~Logger() = default; };

struct FileLogger : Logger {
    void log(const std::string& msg) override {
        std::cout << "[file] " << msg << "\\n";
        writeCount_++;
    }
    int writeCount_ = 0;
};

struct NullLogger : Logger {
    void log(const std::string&) override {
        // "do nothing" -- except it also touches shared telemetry
        ++g_callCount;
    }
};

int g_callCount = 0;

void runTask(Logger& logger) {
    logger.log("starting task");
    logger.log("task complete");
}

int main() {
    NullLogger nullLogger;   // used in place of a null check
    runTask(nullLogger);
    std::cout << "g_callCount = " << g_callCount << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "g_callCount = 0 — NullLogger::log is a true no-op",
        "g_callCount = 2 — NullLogger avoids the need for null checks at call sites, but its log() is not actually side-effect-free: it still increments shared global state on every call, which is easy to overlook precisely because callers assume 'null object' means 'nothing happens'",
        "Compile error: NullLogger must not override a pure virtual with an empty body",
        "Undefined behavior — logger is an unbound reference",
      ],
      correctIndex: 1,
      },
    explanation:
      "The whole appeal of the Null Object pattern is letting callers like `runTask` call " +
      "`logger.log(...)` unconditionally without an `if (logger != nullptr)` guard, trusting that the " +
      "'do nothing' object really does nothing. The bug here is that `NullLogger::log` isn't actually a " +
      "no-op — it increments a shared global counter `g_callCount`, a side effect a caller has no reason " +
      "to expect from something named 'Null'. `runTask` calls `logger.log(...)` twice, so `g_callCount` " +
      "ends at `2`. This is a real-world hazard specific to Null Object: because the pattern's entire " +
      "purpose is to be invisible to calling code, any accidental state mutation inside the 'null' " +
      "implementation is exactly the kind of bug that's easy to introduce (e.g. adding metrics/telemetry " +
      "to the null branch 'just for visibility') and easy to miss in review, compared to an explicit " +
      "`if (logger)` check or a `std::optional<Logger&>`-style API where the absence of behavior is " +
      "visible at every call site.",
  },
  {
    id: "design-patterns-chain-dangling-24",
    category: "design-patterns",
    difficulty: "hard",
    title: "Chain of Responsibility with a dangling raw-pointer link",
    tags: ["chain-of-responsibility", "raw-pointer", "dangling-pointer", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Handler {
    Handler* next = nullptr;
    virtual bool handle(int code) {
        if (canHandle(code)) return true;
        return next ? next->handle(code) : false;
    }
    virtual bool canHandle(int code) const = 0;
    virtual ~Handler() = default;
};

struct LowHandler : Handler { bool canHandle(int c) const override { return c < 10; } };
struct HighHandler : Handler { bool canHandle(int c) const override { return c >= 100; } };

Handler* buildChain() {
    LowHandler low;                 // local -- destroyed when buildChain() returns
    HighHandler high;
    low.next = &high;
    return &low;                    // returns pointer to a soon-to-be-destroyed local
}

int main() {
    Handler* chain = buildChain();
    std::cout << chain->handle(5) << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints 1 — the chain correctly finds LowHandler can handle code 5",
        "Undefined behavior — buildChain() returns a pointer to its local low, which (along with high, and the next link pointing to it) is destroyed when buildChain() returns; chain is left dangling before main ever calls handle() on it",
        "Compile error: cannot return the address of a local variable",
        "Prints 0 — the chain is empty by the time handle() runs",
      ],
      correctIndex: 1,
      },
    explanation:
      "`low` and `high` are both automatic (stack) locals of `buildChain()`, destroyed when that " +
      "function returns — including `low.next`, which pointed at `high`, another about-to-be-destroyed " +
      "local. `buildChain()` returns `&low`, a pointer to a local variable whose lifetime has already " +
      "ended by the time the caller receives it, the same fundamental bug as returning a reference to a " +
      "local. `main`'s `chain` is dangling from the moment it's assigned. `chain->handle(5)` dereferences " +
      "that dangling pointer — undefined behavior, not a well-defined `0` or `1`. In practice, because " +
      "the stack memory `low`/`high` occupied is likely still untouched immediately after " +
      "`buildChain()` returns (before any other function call disturbs that stack region), this may " +
      "*appear* to work and print `1`, making the bug easy to miss in casual testing — exactly the same " +
      "class of 'looks fine until it isn't' trap as any other dangling-pointer-to-local case. Chain of " +
      "Responsibility nodes built dynamically must own their links (e.g. via `unique_ptr<Handler>` chains, " +
      "or heap-allocated nodes with clear ownership) rather than pointing at stack locals.",
  },
  {
    id: "design-patterns-chain-cycle-25",
    category: "design-patterns",
    difficulty: "hard",
    title: "Chain of Responsibility with an accidental cycle",
    tags: ["chain-of-responsibility", "infinite-loop", "cyclic-reference"],
    type: "trace",
    prompt:
      "A maintainer rewires the chain while debugging and accidentally creates a cycle. No " +
      "handler in the loop can handle code `999`. What happens when `handle(999)` is called?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Handler {
    Handler* next = nullptr;
    virtual bool handle(int code) {
        if (canHandle(code)) return true;
        return next ? next->handle(code) : false;   // no cycle/visited guard
    }
    virtual bool canHandle(int code) const = 0;
    virtual ~Handler() = default;
};

struct AlwaysNo : Handler { bool canHandle(int) const override { return false; } };

int main() {
    AlwaysNo a, b, c;
    a.next = &b;
    b.next = &c;
    c.next = &a;      // accidental cycle back to a

    std::cout << a.handle(999) << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints 0 after checking each handler exactly once, since Handler correctly tracks which nodes it has already visited",
        "Infinite recursion / stack overflow — handle() keeps calling next->handle() around the a -> b -> c -> a cycle forever, since nothing detects that the chain has looped back on itself",
        "Compile error: Handler::next cannot point back to an already-linked node",
        "Undefined behavior at compile time due to a circular type dependency",
      ],
      correctIndex: 1,
      },
    explanation:
      "The classic Chain of Responsibility `handle()` implementation is a straight-line recursion/loop " +
      "over `next` with no notion of 'nodes already visited' — it implicitly assumes the chain is " +
      "acyclic (typically a singly linked list terminating in `nullptr`). Here `c.next = &a` closes the " +
      "chain into a cycle `a -> b -> c -> a -> ...`. Since none of `a`, `b`, `c` can handle code `999`, " +
      "every call reaches the `next ? next->handle(code) : false` branch and recurses into the next node " +
      "— forever, since the cycle never reaches a `nullptr` `next`. Each recursive call consumes stack " +
      "frame space, so this terminates only when the call stack is exhausted: a stack overflow, undefined " +
      "behavior. Because chains are frequently built/rewired dynamically (e.g. handlers registered from " +
      "multiple subsystems at startup), nothing about the pattern's typical raw-pointer-linked-list " +
      "implementation defends against an accidental cycle; a robust implementation would need either a " +
      "cycle-detection guard (e.g. a visited-set or a bounded traversal count) or a design that makes " +
      "cycles structurally impossible (e.g. an owning `vector<Handler*>` iterated linearly instead of " +
      "`next`-pointer traversal).",
  },
  {
    id: "design-patterns-prototype-shallow-copy-26",
    category: "design-patterns",
    difficulty: "hard",
    title: "Prototype pattern with a shallow clone() aliasing an owned resource",
    tags: ["prototype", "clone", "shallow-copy", "double-free"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Document {
    virtual Document* clone() const = 0;
    virtual ~Document() = default;
};

class Report : public Document {
public:
    explicit Report(size_t n) : buffer_(new int[n]), size_(n) {}
    ~Report() override { delete[] buffer_; }

    // naive clone(): compiler-generated-looking copy of the pointer, not the data
    Document* clone() const override {
        Report* copy = new Report(*this);   // uses implicit copy ctor
        return copy;
    }
private:
    int* buffer_;
    size_t size_;
};

int main() {
    Report original(100);
    Document* copy = original.clone();
    delete copy;   // ~Report runs: delete[] buffer_ frees the SHARED buffer
}   // original destructs here: delete[] buffer_ frees the SAME buffer again`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Well-defined — clone() deep-copies buffer_ because Report's implicit copy constructor always duplicates dynamically allocated members",
        "Undefined behavior (double free) — Report has no user-defined copy constructor, so new Report(*this) performs a shallow, member-wise copy that copies the buffer_ pointer value itself, leaving original and copy aliasing the same int[100]; both destructors delete[] the same buffer",
        "Compile error: Report(*this) is not a valid clone implementation",
        "Memory leak, not a double free — the copy never actually shares buffer_ with original",
      ],
      correctIndex: 1,
      },
    explanation:
      "The Prototype pattern's entire purpose is producing an independent copy via `clone()`, but " +
      "'clone' is only as correct as the copy constructor it relies on. `Report` declares no copy " +
      "constructor of its own, so `new Report(*this)` invokes the *implicitly-generated* one, which " +
      "performs a member-wise copy: `buffer_` (an `int*`) is copied as a pointer *value*, not as the " +
      "1600 bytes it points to. After `clone()`, `original.buffer_` and `copy->buffer_` (well, the " +
      "underlying `Report`'s `buffer_`) hold the identical address. `delete copy` runs `~Report()`, " +
      "which does `delete[] buffer_`, freeing that shared allocation. When `original` is later destroyed " +
      "at the end of `main`, its own `~Report()` calls `delete[] buffer_` again on the same " +
      "already-freed pointer — a double free, undefined behavior (heap corruption in practice, not a " +
      "guaranteed crash). Prototype implementations that manage owned resources must supply an explicit " +
      "deep-copying copy constructor (or a hand-written `clone()` that duplicates the buffer itself, " +
      "e.g. `new int[size_]` plus a `std::copy`), never rely on the implicit shallow one when raw owning " +
      "pointers are involved.",
  },
  {
    id: "design-patterns-mediator-lifetime-27",
    category: "design-patterns",
    difficulty: "hard",
    title: "Mediator pattern — colleague outliving the mediator",
    tags: ["mediator", "lifetime", "dangling-reference"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Mediator {
    virtual void notify(class Colleague* sender, const std::string& event) = 0;
    virtual ~Mediator() = default;
};

struct Colleague {
    Mediator* mediator;   // non-owning back-reference, no lifetime guarantee
    explicit Colleague(Mediator* m) : mediator(m) {}
    void trigger() { mediator->notify(this, "clicked"); }
};

struct ConcreteMediator : Mediator {
    void notify(Colleague*, const std::string& event) override {
        std::cout << "mediator handling: " << event << "\\n";
    }
};

Colleague makeColleague() {
    ConcreteMediator m;                 // local mediator
    return Colleague(&m);               // colleague outlives the mediator it points to
}

int main() {
    Colleague c = makeColleague();
    c.trigger();                        // mediator is long gone
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'Prints "mediator handling: clicked" safely',
        "Undefined behavior — makeColleague() returns a Colleague whose mediator points at a local ConcreteMediator destroyed when makeColleague() returns; c.trigger() dereferences a dangling Mediator* inside notify()",
        "Compile error: Colleague cannot store a pointer to a local Mediator",
        "Throws std::bad_function_call",
      ],
      correctIndex: 1,
      },
    explanation:
      "The Mediator pattern deliberately decouples colleagues from each other by routing all " +
      "communication through a mediator, but that decoupling says nothing about *lifetime* — the " +
      "mediator and its colleagues still need a well-defined ownership/lifetime relationship, which " +
      "this code never establishes. `ConcreteMediator m` inside `makeColleague()` is a stack local, " +
      "destroyed when `makeColleague()` returns; the `Colleague` it constructs stores a raw `Mediator*` " +
      "pointing at that soon-to-be-destroyed local, and that pointer is copied into the returned " +
      "`Colleague` value. By the time `main()` calls `c.trigger()`, `c.mediator` is dangling; " +
      "`mediator->notify(...)` dereferences it, undefined behavior. This mirrors the raw-pointer-" +
      "back-reference hazard seen in Observer and Chain of Responsibility: Mediator relationships are " +
      "commonly implemented with non-owning raw pointers/references specifically because the mediator " +
      "usually outlives its colleagues by construction (e.g. a UI dialog mediator owning its widgets) — " +
      "but nothing in the language enforces that assumption, and violating it (as here, returning a " +
      "colleague that outlives its stack-local mediator) is a silent lifetime bug with no compile-time " +
      "signal.",
  },
  {
    id: "design-patterns-strategy-missing-virtual-dtor-28",
    category: "design-patterns",
    difficulty: "hard",
    title: "Strategy pattern deleted through a base pointer with no virtual destructor",
    tags: ["strategy", "virtual-destructor", "polymorphic-deletion", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct SortStrategy {                       // no virtual destructor
    virtual void sort(std::vector<int>& v) = 0;
};

struct LoggingQuickSort : SortStrategy {
    std::vector<std::string> auditLog;       // owns heap-allocated storage (via vector)
    void sort(std::vector<int>& v) override {
        auditLog.push_back("sorted " + std::to_string(v.size()) + " elements");
        std::sort(v.begin(), v.end());
    }
    ~LoggingQuickSort() { std::cout << "LoggingQuickSort dtor, log size=" << auditLog.size() << "\\n"; }
};

class Sorter {
public:
    explicit Sorter(SortStrategy* s) : strategy_(s) {}
    ~Sorter() { delete strategy_; }          // deletes through the base pointer
    void run(std::vector<int>& v) { strategy_->sort(v); }
private:
    SortStrategy* strategy_;
};

int main() {
    std::vector<int> data{3, 1, 2};
    {
        Sorter s(new LoggingQuickSort());
        s.run(data);
    }   // Sorter destructs -> delete strategy_
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Well-defined — delete on a base pointer always calls the most-derived destructor regardless of virtuality",
        "Undefined behavior — deleting a LoggingQuickSort object through a SortStrategy* is only well-defined if SortStrategy has a virtual destructor; since it doesn't, only ~SortStrategy() (a no-op) runs, LoggingQuickSort::~LoggingQuickSort() is never invoked, and auditLog's internal heap buffer leaks",
        "Compile error: cannot delete an incomplete polymorphic type",
        "Compiles and prints the dtor message, but leaks auditLog's storage anyway",
      ],
      correctIndex: 1,
      },
    explanation:
      "`delete strategy_` where `strategy_` has static type `SortStrategy*` but dynamic type " +
      "`LoggingQuickSort*` is only well-defined behavior if the static type's destructor is virtual " +
      "([expr.delete]p3: 'if the static type differs from the dynamic type, the static type shall be a " +
      "base class ... and shall have a virtual destructor, or the behavior is undefined'). " +
      "`SortStrategy` declares no destructor at all, virtual or otherwise, so this is exactly the UB " +
      "case. In practice most implementations will simply *not* call `LoggingQuickSort::~LoggingQuickSort()` " +
      "at all (since without a vtable slot for the destructor, `delete` on a `SortStrategy*` only knows " +
      "to run `~SortStrategy()`, an implicit no-op) — the derived part of the object, including " +
      "`auditLog`'s internal dynamically-allocated buffer, is never destroyed, so it leaks, and the " +
      "'LoggingQuickSort dtor' message never prints. This is precisely why any base class intended to " +
      "be used polymorphically — including a Strategy interface deleted through a base pointer, as here " +
      "— must declare `virtual ~SortStrategy() = default;` (or otherwise guarantee it's never deleted " +
      "through the base, e.g. by using `unique_ptr<LoggingQuickSort>` with no base-pointer ownership at " +
      "all).",
    references: ["https://en.cppreference.com/w/cpp/language/destructor"],
  },
  {
    id: "design-patterns-command-dangling-receiver-29",
    category: "design-patterns",
    difficulty: "hard",
    title: "Command pattern capturing a dangling reference to its receiver",
    tags: ["command", "std-function", "dangling-reference", "lifetime"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <functional>
#include <vector>
#include <iostream>

struct Light { bool on = false; };

std::function<void()> makeToggleCommand(Light& light) {
    return [&light]() { light.on = !light.on; };   // captures light by reference
}

std::vector<std::function<void()>> g_undoStack;

void pressSwitch() {
    Light bulb;                                     // local Light
    g_undoStack.push_back(makeToggleCommand(bulb));  // command captures &bulb
    g_undoStack.back()();                            // fine: bulb still alive here
}   // bulb destroyed when pressSwitch() returns

int main() {
    pressSwitch();
    g_undoStack.back()();   // replaying the command later, after bulb is gone
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Well-defined — std::function keeps light alive as long as the command object exists",
        "Undefined behavior — the stored command captured Light& by reference to a local bulb that was destroyed when pressSwitch() returned; replaying the command from g_undoStack later dereferences a dangling reference",
        "Compile error: cannot capture a reference to a local in a lambda stored past its scope",
        "Throws std::bad_function_call when replayed after bulb is destroyed",
      ],
      correctIndex: 1,
      },
    explanation:
      "The Command pattern's whole point is decoupling *when* an action runs from *where* it was " +
      "created — commands are commonly stashed in an undo/redo stack or a queue and invoked much later. " +
      "That decoupling only works if the command owns (or otherwise guarantees the lifetime of) " +
      "everything it needs, which `makeToggleCommand` does not: it captures `light` *by reference* " +
      "(`[&light]`), and the `Light` it's given, `bulb`, is a local variable of `pressSwitch()` that is " +
      "destroyed the moment `pressSwitch()` returns. The first invocation `g_undoStack.back()()` inside " +
      "`pressSwitch()` is fine, since `bulb` is still alive then. But the command object itself, " +
      "captured inside a `std::function` and pushed onto the global `g_undoStack`, outlives `bulb` — " +
      "`std::function`'s type erasure copies/owns the *closure* (the reference itself), not the object " +
      "the reference refers to. The second call in `main()`, after `pressSwitch()` has returned, " +
      "dereferences a reference to an already-destroyed `Light` — undefined behavior. A receiver that " +
      "must outlive the command (as any replayable/undo-able command implies) needs to be captured by " +
      "value, by `shared_ptr`, or otherwise have its lifetime managed independently of the single call " +
      "site that first created the command.",
  },
  {
    id: "design-patterns-adapter-slicing-30",
    category: "design-patterns",
    difficulty: "hard",
    title: "Adapter pattern stored by value in a container of the target interface",
    tags: ["adapter", "object-slicing", "containers", "polymorphism"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Target { virtual std::string request() const { return "default"; } virtual ~Target() = default; };

class LegacyPrinter {
public:
    std::string legacyPrint() const { return "legacy output"; }
};

class PrinterAdapter : public Target {
public:
    explicit PrinterAdapter(LegacyPrinter p) : legacy_(std::move(p)) {}
    std::string request() const override { return legacy_.legacyPrint(); }
private:
    LegacyPrinter legacy_;
};

int main() {
    std::vector<Target> targets;          // container of Target BY VALUE
    targets.push_back(PrinterAdapter(LegacyPrinter{}));

    std::cout << targets[0].request() << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        '"legacy output" — the adapter\'s override is preserved when pushed into the vector',
        '"default" — std::vector<Target> stores Target objects by value; push_back(PrinterAdapter(...)) copy/move-constructs a Target from the PrinterAdapter temporary, slicing off the PrinterAdapter-specific parts (including legacy_ and its override), leaving a plain Target whose request() resolves to Target::request()',
        "Compile error: cannot push_back a PrinterAdapter into a vector<Target>",
        "Undefined behavior — legacy_ is left in a moved-from state after slicing",
      ],
      correctIndex: 1,
      },
    explanation:
      "Exactly like the Decorator-slicing case, the Adapter pattern needs polymorphic storage " +
      "(pointer/reference/smart-pointer to the `Target` interface) to keep working once objects are " +
      "put into a homogeneous container. `std::vector<Target>` stores `Target` objects *by value* — " +
      "each element genuinely has static and dynamic type `Target`, full stop, regardless of what was " +
      "used to construct it. `targets.push_back(PrinterAdapter(LegacyPrinter{}))` copy/move-constructs " +
      "a `Target` from the `PrinterAdapter` temporary, and `Target`'s (implicit) copy/move constructor " +
      "only knows how to construct the `Target` base subobject — `legacy_` and the fact that `request()` " +
      "was overridden are both discarded. `targets[0]` is a plain `Target`, and `targets[0].request()` " +
      "dispatches to `Target::request()`, printing `\"default\"`, not `\"legacy output\"`. To keep " +
      "adapters polymorphic inside a container, it must hold pointers/smart-pointers to the interface — " +
      "`std::vector<std::unique_ptr<Target>>` — not the interface type by value.",
  },
];