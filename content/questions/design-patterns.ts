import type { TraceQuestion } from "@/types/question";

export const designPatternsQuestions: TraceQuestion[] = [
  {
    id: "design-patterns-meyers-singleton-01",
    category: "design-patterns",
    difficulty: "easy",
    title: "Concurrent first use of a Meyer's singleton",
    tags: ["singleton", "magic-statics", "thread-safety", "c++11"],
    type: "trace",
    prompt:
      "Ten threads all call `Counter::instance()` concurrently, with no external locking, and " +
      "none of them has called it before. Compiled as C++11 or later. What is guaranteed about " +
      "the initialization of `c`?",
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
        "Undefined behavior: two threads can run `Counter()` simultaneously on the same storage, a data race on construction",
        "Compile error: a function-local static with a private constructor cannot be initialized from multiple threads",
        "Well-defined only when `-pthread` is passed at link time; without it the guard variable is compiled out and construction races",
        "Well-defined: exactly one thread runs the constructor, and any thread reaching the declaration meanwhile blocks until it finishes",
      ],
      correctIndex: 3,
    },
    explanation:
      "Since C++11, [stmt.dcl]p4 mandates that initialization of a function-local static variable " +
      "is thread-safe: if control enters the declaration while it is being initialized by another " +
      "thread, the entering thread waits for completion. Compilers implement this with a hidden " +
      "guard variable and (on most ABIs) a double-checked pattern using acquire/release atomics or " +
      "a runtime lock, commonly nicknamed \"magic statics\". So exactly one thread runs `Counter()` " +
      "and all others block until it finishes, after which every thread sees a fully constructed " +
      "object. Only *construction* is covered, though: `increment()` does a non-atomic `++n_` with no " +
      "lock, so ten threads calling it concurrently still race on `n_`. The question asks about the " +
      "singleton's initialization, and that part is safe. MSVC only guarantees this since VS2015; " +
      "older toolchains needed `/Zc:threadSafeInit`.",
    references: ["https://en.cppreference.com/w/cpp/language/storage_duration#Static_local_variables"],
  },
  {
    id: "design-patterns-singleton-destruction-order-02",
    category: "design-patterns",
    difficulty: "hard",
    title: "A singleton destructor that uses another singleton",
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
        "Undefined behavior: destruction order for statics in different translation units is unspecified, and Config may already be gone",
        "Compile error: a static local defined in another translation unit cannot be referenced from a destructor",
        "Prints \"shutdown level=info\", with Config still fully alive when ~Logger() runs",
        "Prints \"shutdown level=\" with an empty value, Config's map having already been cleared",
      ],
      correctIndex: 2,
    },
    explanation:
      "Meyer's singletons sidestep the classic *static initialization order fiasco* for construction " +
      "(each is lazily constructed on first use, not at unspecified static-init time), but destruction " +
      "order is governed by the ordinary C++ rule: objects with static storage duration are destroyed " +
      "in the reverse order of completion of their construction, and that rule holds across translation " +
      "units too. Because `Config::instance()` was invoked (and thus fully constructed) before " +
      "`Logger::instance()` in this run, `Config` is destroyed strictly after `Logger`, so the access in " +
      "`~Logger()` is safe and the message prints with the real value. The danger is that the " +
      "correctness here is an accident of *use order*, not a compile-time guarantee tied to declaration " +
      "order. If some earlier code path had touched `Logger::instance()` before `Config::instance()` " +
      "(a log call during Config's own construction, say, or a different startup path), the order would " +
      "flip and `~Logger()` would read from an already-destroyed `Config`, which is undefined behavior. " +
      "Mutually dependent singletons stay fragile at shutdown even with magic statics.",
  },
  {
    id: "design-patterns-double-checked-locking-03",
    category: "design-patterns",
    difficulty: "hard",
    title: "A hand-rolled double-checked-locking singleton",
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
        "Always safe: the mutex around the second check fully synchronizes construction for every thread that reaches it",
        "Compile error: `ptr_` is a non-atomic static and cannot be read outside the lock that guards it",
        "Deadlock: `mtx_` ends up locked twice by the same thread on the first-construction path",
        "A thread can take the unlocked fast path, see a non-null `ptr_`, and then read `value` as garbage",
      ],
      correctIndex: 3,
    },
    explanation:
      "`new Widget()` conceptually involves allocating memory, running the constructor to write " +
      "`value = 42`, and then assigning the resulting address to `ptr_`. Nothing in this code stops the " +
      "compiler or CPU from making the write to `ptr_` visible before the constructor's writes are, " +
      "because plain pointer reads and writes carry no memory-ordering guarantees. A second thread " +
      "executing the unlocked first check can therefore observe `ptr_ != nullptr` and return it while " +
      "`value` has not yet been written from that thread's point of view. Reading `value` is then a " +
      "data race and undefined behavior, not merely \"maybe stale\". That is the textbook broken " +
      "double-checked-locking pattern (DCLP): the mutex only orders the threads that actually take it, " +
      "and the whole point of the outer check is to skip taking it. The fix is C++11 magic statics (a " +
      "function-local static `Widget`), or `std::call_once`, or making `ptr_` a `std::atomic<Widget*>` " +
      "with `memory_order_release` on the store and `memory_order_acquire` on the unlocked load.",
    references: ["https://en.wikipedia.org/wiki/Double-checked_locking"],
  },
  {
    id: "design-patterns-call-once-04",
    category: "design-patterns",
    difficulty: "medium",
    title: "std::call_once with an initializer that throws",
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
        "The exception is swallowed inside call_once and both threads return a null `ptr_` with no diagnostic",
        "Undefined behavior: call_once requires a non-throwing callable, and an escaping exception corrupts the once_flag",
        "The exception propagates out to the calling thread, the flag stays unset, and the waiting thread retries the initializer",
        "The waiting thread blocks forever, with the flag stuck permanently in its 'in progress' state",
      ],
      correctIndex: 2,
    },
    explanation:
      "Per [thread.once.callonce], if the invoked function exits via an exception, that exception " +
      "propagates to the caller of `call_once` and the effects are as if the call never happened: the " +
      "`once_flag` is *not* marked completed. Any threads blocked waiting for that first call to finish " +
      "are released, one of them becomes the new active initializer, and it retries the function. The " +
      "flag only becomes permanently done once some invocation of the callable returns normally. That " +
      "bookkeeping is the part hand-rolled double-checked locking usually gets wrong: it is easy to " +
      "mark a guard as initialized before confirming the initializer actually succeeded, after which " +
      "every subsequent caller happily returns a half-built or null singleton.",
    references: ["https://en.cppreference.com/w/cpp/thread/call_once"],
  },
  {
    id: "design-patterns-observer-dangling-05",
    category: "design-patterns",
    difficulty: "medium",
    title: "Observer with a raw back-pointer to its Subject",
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
    std::cout << subject->state << "\\n";
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
        "Prints 7: the Subject's storage is gone but `state` was a plain int and is still readable there",
        "Compile error: `Subject` is only forward-declared where `Observer` stores a pointer to it",
        "Undefined behavior: `Observer::notify()` dereferences a null pointer",
        "Prints an unspecified value, with the read itself still well-defined for a trivially destructible member",
      ],
      correctIndex: 2,
    },
    explanation:
      "`~Subject()` does try to defensively null out each observer's back-pointer before the `Subject` " +
      "goes away, which is a common but incomplete mitigation. The bug is on the *Observer* side: " +
      "`notify()` dereferences `subject` unconditionally. After the block scope ends `obs.subject` is " +
      "`nullptr`, and `obs.notify()` dereferences it, which is undefined behavior (typically a segfault, " +
      "but nothing guarantees that). The null-out only converts a dangling pointer into a null one; it " +
      "buys nothing unless every read site also checks, and it buys nothing at all if another thread is " +
      "mid-`notify()` while the destructor runs. Observer's defining feature is that the observer holds " +
      "a reference to something it does not own, so the pattern concentrates exactly this kind of " +
      "lifetime bookkeeping in one place. `std::weak_ptr` handles it better mainly because `.lock()` " +
      "forces the expired case to be dealt with at the use site rather than in the subject's destructor.",
  },
  {
    id: "design-patterns-observer-weak-ptr-06",
    category: "design-patterns",
    difficulty: "medium",
    title: "Observer holding its Subject through a weak_ptr",
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
        std::cout << sp->state << "\\n";
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
        "Prints 99: the weak_ptr keeps the Subject alive for as long as an Observer still refers to it",
        "Throws std::bad_weak_ptr, the control block having already released the Subject",
        "Compile error: `enable_shared_from_this` requires `shared_from_this()` rather than a raw `lock()` here",
        "Undefined behavior: `lock()` returns an empty shared_ptr and `sp->state` dereferences it",
      ],
      correctIndex: 3,
    },
    explanation:
      "`weak_ptr` does exactly what it is supposed to here: it does *not* extend the `Subject`'s " +
      "lifetime, so once the last owning `shared_ptr` (`s`) goes out of scope the `Subject` is " +
      "destroyed and `subject.lock()` correctly returns an empty `shared_ptr`. The fix was never " +
      "'use weak_ptr' on its own, it was 'use weak_ptr and check what `lock()` gives back'. Here `sp` " +
      "is empty, and `sp->state` dereferences a null `shared_ptr`. That is undefined behavior rather " +
      "than an exception: `operator->` and `operator*` on `shared_ptr` have a precondition that the " +
      "pointer is non-null and do not check it. `std::bad_weak_ptr` comes from the `shared_ptr(weak_ptr)` " +
      "constructor, not from `lock()`. The idiom that actually pays off is `if (auto sp = subject.lock())` " +
      "at every use site, which is the whole reason Observer implementations funnel notifications " +
      "through a single guarded accessor.",
  },
  {
    id: "design-patterns-crtp-incomplete-07",
    category: "design-patterns",
    difficulty: "hard",
    title: "CRTP base downcasting to the derived type",
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
        "Compile error: `Base<Concrete>` names `Concrete` while `Concrete` is still an incomplete type",
        "Compile error: `static_cast` cannot convert `Base<Derived>*` to `Derived*` without a virtual base",
        "Compiles and prints \"Concrete::step\"",
        "Infinite recursion at runtime, since `run()` and `step()` resolve to the same downcast target",
      ],
      correctIndex: 2,
    },
    explanation:
      "CRTP leans on a subtlety of how class templates are instantiated. At the point where " +
      "`struct Concrete : Base<Concrete>` is parsed, `Concrete` really is incomplete, but `Base<Concrete>` " +
      "is a class *template*, and the body of `run()` is not instantiated until it is actually called, " +
      "which happens later in `main()`, well after `Concrete` is complete. " +
      "`static_cast<Derived*>(this)->step()` is compiled (and only then needs `Derived` to be complete) " +
      "at the point of instantiation, not at the template's textual definition. Instantiating the class " +
      "`Base<Concrete>` instantiates only its member *declarations*, and `run()`'s declaration mentions " +
      "no member of `Derived`. The 'incomplete type at point of use' failure the pattern is often warned " +
      "about only bites when `Derived`'s members are needed outside an instantiation-time context, for " +
      "example in a data member's type or a default argument in `Base`.",
  },
  {
    id: "design-patterns-crtp-infinite-recursion-08",
    category: "design-patterns",
    difficulty: "hard",
    title: "CRTP base with a non-virtual default hook",
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
        "Compile error: Sloppy must declare its own step() to satisfy the CRTP contract",
        "Prints nothing but terminates normally, with Base::step() invoked once as the default",
        "Stack overflow at runtime from unbounded recursion between run() and step()",
        "Compile error: instantiating Base<Sloppy> recurses infinitely during template instantiation",
      ],
      correctIndex: 2,
    },
    explanation:
      "`static_cast<Derived*>(this)->step()` inside `run()` is ordinary, non-virtual member lookup on " +
      "`Derived`. `Sloppy` declares no `step()` of its own, so lookup walks up to the inherited " +
      "`Base<Sloppy>::step()`, following the same name-hiding rules any non-CRTP hierarchy would. " +
      "Nothing in CRTP forces `Derived` to supply the member the base assumed it would. " +
      "`Base::step()` then calls `static_cast<Derived*>(this)->run()`, which calls `step()`, which " +
      "calls `run()`, and so on until the stack is exhausted. Contrast a runtime-polymorphic base with " +
      "a pure virtual `step()`: omitting the override makes `Sloppy` abstract and the compiler refuses " +
      "to instantiate it at all. CRTP's expected interface is enforced by convention alone, unless the " +
      "author writes a `static_assert` or a concept to check it.",
  },
  {
    id: "design-patterns-policy-based-conflict-09",
    category: "design-patterns",
    difficulty: "medium",
    title: "Policy-based design with an empty checking policy",
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
        "Runs fine: the compiler treats NoChecking's absent check() as a no-op",
        "Compile error when SmartArray<int, NoChecking>::operator[] is instantiated: no member named 'check'",
        "Compile error where SmartArray is defined, before any instantiation of operator[] happens",
        "Runs with undefined behavior: the missing check() is silently dropped by SFINAE",
      ],
      correctIndex: 1,
    },
    explanation:
      "Policy-based design swaps behavior through template parameters, but a policy's interface " +
      "contract is checked only where it is used; the language enforces nothing on its own unless you " +
      "add a `static_assert` or a concept. `operator[]` calls `CheckingPolicy::check(...)` " +
      "unconditionally, which suits `BoundsChecking` fine, but `NoChecking` supplies no such member, so " +
      "the call is ill-formed the moment `operator[]` is instantiated for `SmartArray<int, NoChecking>`. " +
      "Clang reports `no member named 'check' in 'NoChecking'` with a note pointing at `arr[3]` as the " +
      "instantiation that requested it. No error appears where `SmartArray` itself is defined, since a " +
      "member function of a class template is only compiled once something calls it, which " +
      "is why a broken policy can sit in a header for months without anyone noticing. Making the " +
      "intended design work requires `NoChecking` to define an empty `check()`, or requires " +
      "`operator[]` to branch with `if constexpr` so the call is never instantiated for policies that " +
      "lack it.",
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
        "The else branch is selected, the callable is heap-allocated, and c() prints 1",
        "Compile error: the if constexpr condition rejects BigCallable as too large for the buffer",
        "Buffer overflow: placement-new writes 32 bytes into the 16-byte buffer_, corrupting ptr_ and invoke_",
        "Undefined behavior: reinterpret_cast to F* is only valid when F is trivially copyable",
      ],
      correctIndex: 0,
    },
    explanation:
      "`sizeof(BigCallable)` is 32 bytes (an 8-element `int` array), which exceeds " +
      "`sizeof(buffer_) == 16`, so the `if constexpr` condition is false at compile time and the else " +
      "branch is the only one instantiated. The callable is heap-allocated via `new F(std::move(f))`, " +
      "`heap_` becomes `true`, and `operator()` dispatches through `ptr_`, so the call is well-defined " +
      "and prints `1`. The interesting property here is not a bug but a cost: whether a given callable " +
      "heap-allocates is a silent, size-dependent decision made per instantiation. A capture one `int` " +
      "wider than the buffer, or a lambda that grows a `std::string` member, quietly falls off the SBO " +
      "fast path onto an allocation with no diagnostic at all. That is why `std::function`-heavy code " +
      "so often profiles with allocation hotspots nobody wrote deliberately. (This toy also leaks the " +
      "heap-allocated callable, since `AnyCallable` has no destructor; a real implementation needs a " +
      "type-erased destroy function alongside `invoke_`.)",
    references: ["https://en.cppreference.com/w/cpp/utility/functional/function"],
  },
  {
    id: "design-patterns-pimpl-rule-of-five-12",
    category: "design-patterns",
    difficulty: "medium",
    title: "PImpl with a compiler-generated destructor",
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
    struct Impl;
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
        "Compiles and runs fine: unique_ptr's default deleter works with any pointee, complete or not",
        "Compile error in user.cpp: \"cannot delete an incomplete type\", raised from unique_ptr<Impl>'s deleter",
        "Links fine but leaks Impl, since nothing in user.cpp can run ~Impl()",
        "Compile error in Widget.cpp instead, where Impl is defined after the header declares it",
      ],
      correctIndex: 1,
    },
    explanation:
      "`std::unique_ptr<Impl>`'s default deleter (`std::default_delete<Impl>`) calls `delete` on the " +
      "stored pointer, and [expr.delete] requires the pointee to be complete (a null pointer constant " +
      "being the only exception): the compiler needs `Impl`'s size and destructor to tear it down. " +
      "Since `Widget` declares no destructor, the compiler generates one wherever it is odr-used, and " +
      "`user.cpp` is such a place, because `main` builds and destroys a `Widget` while seeing only the " +
      "forward declaration `struct Impl;`. libc++ surfaces this as the static assertion \"cannot delete " +
      "an incomplete type\" inside `unique_ptr.h`, with an instantiation backtrace leading to " +
      "`~unique_ptr()`. The PImpl fix is to declare `~Widget();` in the header and define it " +
      "`= default;` out of line in `Widget.cpp`, where `Impl` is complete. The same argument applies to " +
      "the implicit move constructor and move assignment, which is why PImpl classes end up declaring " +
      "and out-of-line-defaulting most of the Rule of Five even when every body would be trivial.",
    references: ["https://en.cppreference.com/w/cpp/language/pimpl"],
  },
  {
    id: "design-patterns-factory-ownership-13",
    category: "design-patterns",
    difficulty: "easy",
    title: "Factory function returning a raw Shape pointer",
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
        "Prints \"big\" and leaks the Circle allocation",
        "Compile error: createShape must return a smart pointer to transfer ownership",
        "Undefined behavior: s is dereferenced before it is checked against nullptr",
        "Prints \"big\" with no leak, since Circle holds no members that need releasing",
      ],
      correctIndex: 0,
    },
    explanation:
      "`createShape` returns an owning raw `Shape*`, and the contract that the caller must eventually " +
      "`delete` it lives only in convention and comments, nowhere in the type system. `useShape()` does " +
      "remember to `delete s` on one path, but the early `return` inside the `if` skips it, so the " +
      "`Circle` is never freed. The virtual destructor on `Shape` is present and correct, so a `delete " +
      "s` that actually ran would dispatch to `~Circle()` properly; the defect is purely that one exit " +
      "path never reaches it. A factory returning `std::unique_ptr<Shape>` makes ownership " +
      "self-documenting and covers every exit path, early returns and thrown exceptions alike, with no " +
      "manual bookkeeping. That is the case against raw-pointer factories in modern C++, outside narrow " +
      "non-owning-view APIs where the factory keeps ownership itself.",
  },
  {
    id: "design-patterns-builder-dangling-14",
    category: "design-patterns",
    difficulty: "hard",
    title: "Builder chain ending in a reference-returning getter",
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
        'Prints "/v1/users" safely, p being bound to a member of a still-live builder',
        "Undefined behavior: p refers into a RequestBuilder temporary that no longer exists",
        "Compile error: a const std::string& cannot bind to a member of a temporary",
        "Prints an empty string, path_ having been reset once the chain completed",
      ],
      correctIndex: 1,
    },
    explanation:
      "`RequestBuilder()` creates a temporary, and `.setHost(...)` and `.setPath(...)` hand back " +
      "`RequestBuilder&` references to that same temporary, which is entirely fine while the full " +
      "expression is still running. The trouble is `.path()`, which returns a `const std::string&` " +
      "bound to a *member* of that temporary. Lifetime extension under [class.temporary] applies only " +
      "when a reference is bound directly to the temporary in its own initialization. Here `p` is " +
      "initialized from a reference that came back out of a function call, a case the rule pointedly " +
      "does not cover, so nothing extends anything. The builder is destroyed at the closing semicolon, " +
      "taking `path_`'s storage with it, and `p` dangles before `std::cout << p` ever executes. " +
      "Fluent builders invite this because the whole idiom is designed around never naming the " +
      "intermediate object, so the temporary's very short life is easy to forget. Binding the result " +
      "by value (`std::string p = ...`) or naming the builder as a local both avoid it.",
  },
  {
    id: "design-patterns-decorator-slicing-15",
    category: "design-patterns",
    difficulty: "hard",
    title: "Decorator chain invoked through base and derived pointers",
    tags: ["decorator", "virtual-dispatch", "default-arguments", "static-binding"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Coffee {
    virtual std::string describe(int sugars = 0) const {
        return "Coffee(" + std::to_string(sugars) + ")";
    }
    virtual ~Coffee() = default;
};

struct CoffeeDecorator : Coffee {
    explicit CoffeeDecorator(std::unique_ptr<Coffee> inner)
        : inner_(std::move(inner)) {}
protected:
    std::unique_ptr<Coffee> inner_;
};

struct WithMilk : CoffeeDecorator {
    using CoffeeDecorator::CoffeeDecorator;
    std::string describe(int sugars = 2) const override {
        return inner_->describe(sugars) + " + Milk";
    }
};

int main() {
    std::unique_ptr<Coffee> drink =
        std::make_unique<WithMilk>(std::make_unique<Coffee>());
    WithMilk* milky = static_cast<WithMilk*>(drink.get());

    std::cout << drink->describe() << "\\n";
    std::cout << milky->describe() << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        '"Coffee(0) + Milk" then "Coffee(2) + Milk": the two calls disagree on the sugars argument',
        '"Coffee(2) + Milk" twice: the default comes from WithMilk::describe, the override that runs',
        '"Coffee(0) + Milk" twice: the default comes from Coffee::describe for every call on the chain',
        "Compile error: an override may not change the default argument declared on the base's virtual",
      ],
      correctIndex: 0,
    },
    explanation:
      "Default arguments are looked up and substituted at the call site using the *static* type of the " +
      "expression, while the function body is selected at run time by virtual dispatch. Those two " +
      "decisions can come from different classes. `drink` has static type `Coffee*`, so " +
      "`drink->describe()` is rewritten as `drink->describe(0)` from `Coffee::describe`'s declaration, " +
      "then dispatches to `WithMilk::describe`, which forwards 0 inward and prints " +
      '"Coffee(0) + Milk". `milky` has static type `WithMilk*`, so the identical call on the identical ' +
      'object becomes `describe(2)` and prints "Coffee(2) + Milk". Nothing warns: redeclaring a ' +
      "default argument in an override is legal, and neither `-Wall` nor `-Wextra` flags it. Decorator " +
      "is unusually exposed to this because the pattern's contract is that a wrapped chain is always " +
      "handled through the base interface, so the *only* defaults that ever apply in production code " +
      "are the base's, and each forwarding layer re-invokes the operation on `inner_`, whose static " +
      "type is also the base, quietly re-substituting the base default at every hop if a layer forwards " +
      "without passing the parameter along. The fix is to keep virtual functions free of default " +
      "arguments: give the base a non-virtual `describe()` overload that supplies the default and " +
      "forwards to a virtual `describe(int)` that has none.",
    references: [
      "https://en.cppreference.com/w/cpp/language/default_arguments",
      "https://en.cppreference.com/w/cpp/language/virtual",
    ],
  },
  {
    id: "design-patterns-visitor-missing-override-16",
    category: "design-patterns",
    difficulty: "medium",
    title: "Adding a new type to a classic Visitor hierarchy",
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
        "Compile error inside Triangle::accept: no matching member function for the call v.visit(*this)",
        "Compile error at 'AreaVisitor av;': AreaVisitor is still abstract without a visit(Triangle&) override",
        "Compiles and links, but calling t.accept(av) silently does nothing at runtime",
        "Runtime crash: pure virtual function called",
      ],
      correctIndex: 0,
    },
    explanation:
      "Adding `Triangle` to the `Shape` hierarchy does nothing to `ShapeVisitor`; the matching " +
      "`visit(Triangle&)` has to be written by hand. That asymmetry is the known weakness of classic " +
      "double-dispatch Visitor: new *operations* are cheap (write another concrete visitor), but new " +
      "*visitable types* force a change to the visitor base interface and, transitively, to every " +
      "concrete visitor already written. Here `ShapeVisitor` never gained the overload, so inside " +
      "`Triangle::accept` the call `v.visit(*this)` has `Triangle&` for its argument and neither " +
      "`visit(Circle&)` nor `visit(Square&)` is viable. Clang reports `no matching member function for " +
      "call to 'visit'` at that line, with notes explaining that `Triangle` converts to neither " +
      "`Circle&` nor `Square&`. The abstract-class diagnostic at `AreaVisitor av;` is what you would " +
      "get from the *other* mistake, declaring `visit(Triangle&)` pure virtual in the base and " +
      "forgetting to override it in `AreaVisitor`. Both are caught at compile time; the pattern's cost " +
      "is the edit fan-out, not silent runtime breakage.",
  },
  {
    id: "design-patterns-variant-visit-exhaustive-17",
    category: "design-patterns",
    difficulty: "easy",
    title: "std::visit with a visitor that omits one alternative",
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
        "Compile error: the visitor is not invocable with the variant's double alternative",
        "Runtime std::bad_variant_access, since shape currently holds the unhandled alternative",
        "Compiles fine: operator()(const Circle&) serves as the fallback for unmatched alternatives",
        "Prints 0, since double is converted to Circle by aggregate initialization",
      ],
      correctIndex: 0,
    },
    explanation:
      "[variant.visit] requires the visitor to be invocable with every alternative the variant could " +
      "hold, checked at compile time no matter which alternative happens to be active. That is how " +
      "`std::variant` plus `std::visit` recovers Visitor's exhaustiveness guarantee without any " +
      "hand-written `accept`/`visit` scaffolding. `AreaVisitor` has no `operator()(double)`, so the " +
      "call is ill-formed: libc++ fails on the static assertion \"`std::visit` requires the visitor to " +
      "be exhaustive\", with clang's instantiation notes leading back through `__value_visitor` to the " +
      "call site. Aggregate initialization does not help, since a `double` will not implicitly convert " +
      "to `Circle`. Compared with classic double dispatch, adding an alternative still means updating " +
      "every visitor, but the enforcement is centralized at each `std::visit` call rather than spread " +
      "across a pure virtual threaded through an entire visitor hierarchy by hand.",
    references: ["https://en.cppreference.com/w/cpp/utility/variant/visit"],
  },
  {
    id: "design-patterns-object-pool-uaf-19",
    category: "design-patterns",
    difficulty: "hard",
    title: "Object pool with a reference held past release",
    tags: ["object-pool", "use-after-release", "aliasing", "lifetime"],
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
        'Prints "SELECT 1": c1 and c2 refer to unrelated Connection objects',
        'Prints "SELECT 2": acquire() hands the same Connection back out and c1 still aliases it',
        "Undefined behavior: c1 becomes a dangling reference the moment release() runs",
        "Compile error: c1 binds a reference to a temporary returned by acquire()",
      ],
      correctIndex: 1,
    },
    explanation:
      "Nothing here is undefined behavior, which is what makes it nasty. `release()` does not destroy " +
      "the `Connection`; it moves the owning `unique_ptr` from `inUse_` back into `free_`, and the " +
      "object goes on living at the same address. `c1` was never invalidated, so it remains a perfectly " +
      "valid reference to a live object that the pool now considers free. The next `acquire()` pops " +
      "`free_.back()`, the same `Connection`, and returns it as `c2`. Writing `c2.lastQuery = " +
      "\"SELECT 2\"` writes through to the one object both references name, so the program prints " +
      "\"SELECT 2\". Pooling creates this hazard by design: recycling storage instead of freeing it is " +
      "the entire point, and a pool has no way to reach out and invalidate references it handed out " +
      "earlier. Production pools usually return a move-only RAII lease that clears itself on release, " +
      "so that a stale handle is at least detectably empty rather than silently aliasing somebody " +
      "else's connection.",
  },
  {
    id: "design-patterns-flyweight-mutation-20",
    category: "design-patterns",
    difficulty: "medium",
    title: "Flyweight glyph cache handing out mutable references",
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
        "Prints \"a@0 X@10\"",
        "Prints \"a@0 a@10\", a1 and a2 being logically independent copies",
        "Compile error: ch_ cannot be assigned through the reference get() returns",
        "Undefined behavior: the emplace invalidates the iterator get() dereferences",
      ],
      correctIndex: 0,
    },
    explanation:
      "Flyweight earns its memory savings by handing the same object to every logical user, and " +
      "`GlyphFactory::get('a')` does just that: `a1` and `a2` are two references to one cached " +
      "`GlyphFlyweight`. The arrangement is only safe while every holder treats the shared intrinsic " +
      "state as read-only, and nothing in this code enforces that, since `ch_` is a public non-const " +
      "`char`. `a2.ch_ = 'X'` overwrites the single `'a'` glyph in place, so the later `a1.render(10)` " +
      "prints `X@10`, and so would every other part of the program holding the `'a'` flyweight. The " +
      "output is `a@0 X@10`. Making intrinsic state genuinely immutable (a `const char ch_` set only by " +
      "the constructor, with accessors instead of public members) lets the type system reject the " +
      "mutation rather than leaving unrelated callers to corrupt each other's glyphs.",
  },
  {
    id: "design-patterns-di-unique-ptr-21",
    category: "design-patterns",
    difficulty: "medium",
    title: "Injecting one unique_ptr dependency into two services",
    tags: ["dependency-injection", "unique_ptr", "ownership"],
    type: "trace",
    prompt:
      "`Service` takes ownership of its `Logger` dependency via `unique_ptr`. The application " +
      "wants a single shared `Logger` instance injected into two different services. What happens " +
      "when this is built and run?",
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
        "Compiles and runs fine, with both services sharing the same ConsoleLogger",
        "Compile error: a unique_ptr cannot be moved from twice",
        "Compile error: ServiceB's constructor call is ambiguous",
        "Compiles and runs to completion, with ServiceB's logger_ left null",
      ],
      correctIndex: 3,
    },
    explanation:
      "Choosing `unique_ptr<Logger>` as the injected dependency type bakes single ownership into the " +
      "design: one `Logger` instance, one owning `Service`. The first `std::move(logger)` transfers " +
      "ownership into `ServiceA::logger_` and leaves the local `logger` null, which is `unique_ptr`'s " +
      "specified moved-from state. Handing it to `ServiceB` afterwards still compiles, because " +
      "`std::move` is only a cast and the language tracks nothing about whether a variable has already " +
      "been moved from. This program then runs to completion and exits quietly, having silently " +
      "constructed `ServiceB` around a null dependency. The damage shows up later, the first time some " +
      "code path calls `logger_->log(...)` inside `ServiceB` and dereferences null. That is the honest " +
      "tradeoff of exclusive-ownership injection: it rules out the two-owners wiring the application " +
      "actually wanted, but it rules it out at runtime rather than at compile time. A genuinely shared " +
      "dependency wants `shared_ptr<Logger>`, or a non-owning `Logger&` whose lifetime is managed " +
      "elsewhere and outlives both services.",
  },
  {
    id: "design-patterns-di-shared-ptr-lifetime-22",
    category: "design-patterns",
    difficulty: "hard",
    title: "Parent and child injected with shared_ptrs to each other",
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
        "Prints \"~Child\" then \"~Parent\": reference counting tears the pair down in order",
        "Prints nothing: neither refcount reaches zero, and both objects leak",
        "Runtime crash: the two destructors recurse into each other until the stack is exhausted",
        "Compile error: shared_ptr cannot form a cycle between two forward-declared types",
      ],
      correctIndex: 1,
    },
    explanation:
      "Every `shared_ptr` copy bumps a control-block refcount, and an object dies only when its count " +
      "reaches zero. After `p->child = c; c->parent = p;`, the `Parent` is held by two references (the " +
      "local `p` and `c->parent`) and the `Child` by two as well (the local `c` and `p->child`). The " +
      "locals going out of scope at the end of `main` drops each count to one, held by the other " +
      "object's member, so neither destructor ever runs. No output appears and both objects survive " +
      "until the process exits. Reference counting cannot collect cycles; that requires a tracing " +
      "collector, which C++ does not have. What makes this specific to `shared_ptr`-flavored dependency " +
      "injection is that `unique_ptr` would have refused to build the cycle at all, since you cannot " +
      "copy one into a second owner. Reaching for `shared_ptr` to get past that compile error trades a " +
      "diagnostic for a silent leak. The usual repair is to make the back-reference `Child::parent` a " +
      "`weak_ptr`, which breaks the cycle while the child can still reach its parent through `.lock()`.",
    references: ["https://en.cppreference.com/w/cpp/memory/weak_ptr"],
  },
  {
    id: "design-patterns-null-object-side-effect-23",
    category: "design-patterns",
    difficulty: "medium",
    title: "Null Object logger used in place of a null check",
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

int g_callCount = 0;

struct NullLogger : Logger {
    void log(const std::string&) override {
        // "do nothing" -- except it also touches shared telemetry
        ++g_callCount;
    }
};

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
        "g_callCount = 0, since NullLogger::log has no observable effect",
        "g_callCount = 2, preceded by two '[file]' lines from FileLogger",
        "g_callCount = 2, with no other output",
        "Compile error: g_callCount is not visible from inside NullLogger::log",
      ],
      correctIndex: 2,
    },
    explanation:
      "Null Object exists so that callers like `runTask` can invoke `logger.log(...)` unconditionally, " +
      "with no `if (logger)` guard, trusting that the do-nothing implementation really does nothing. " +
      "`NullLogger::log` breaks that trust: it bumps the shared global `g_callCount`, a side effect no " +
      "caller would expect from a type named for its absence of behavior. `runTask` logs twice, so the " +
      "program prints `g_callCount = 2`. `FileLogger` is defined but never instantiated, so no `[file]` " +
      "lines appear. The hazard is structural rather than accidental: because the pattern's purpose is " +
      "to be invisible at every call site, a stray mutation inside the null implementation (telemetry " +
      "added 'just for visibility' is the usual culprit) has no natural place where a reviewer would " +
      "look for it. An explicit null check, or an API that returns `std::optional`, at least makes the " +
      "absence of behavior something the caller can see.",
  },
  {
    id: "design-patterns-chain-dangling-24",
    category: "design-patterns",
    difficulty: "medium",
    title: "A chain assembled on the stack",
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
        "Prints 1: the chain correctly finds that LowHandler can take code 5",
        "Prints 0: the chain is empty by the time handle() runs",
        "Compile error: a function cannot return the address of a local variable",
        "Undefined behavior: chain points at a local of buildChain() that no longer exists",
      ],
      correctIndex: 3,
    },
    explanation:
      "`low` and `high` are automatic locals of `buildChain()` and are both destroyed when it returns, " +
      "which also disposes of the `high` object that `low.next` was pointing at. Returning `&low` hands " +
      "the caller a pointer to storage whose lifetime has already ended, the same defect as returning a " +
      "reference to a local dressed up in pattern clothing. `main`'s `chain` is dangling from the " +
      "assignment onward, and `chain->handle(5)` dereferences it, which is undefined behavior rather " +
      "than a predictable `0` or `1`. In practice it often prints `1`, because the stack bytes `low` " +
      "and `high` occupied usually survive untouched until some later call reuses that region, so " +
      "casual testing sails right past it. Chains built at runtime need to own their links, whether " +
      "through a `unique_ptr<Handler> next` or heap-allocated nodes with an explicit owner, rather than " +
      "stitching together objects whose lifetimes end at a scope boundary.",
  },
  {
    id: "design-patterns-chain-cycle-25",
    category: "design-patterns",
    difficulty: "hard",
    title: "Chain of Responsibility wired into a cycle",
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
        "Prints 0 after checking each handler once, since Handler tracks the nodes it has visited",
        "Stack overflow: handle() recurses around a -> b -> c -> a and never reaches a null next",
        "Compile error: Handler::next cannot point back to an already-linked node",
        "Prints 0 after three hops, the traversal stopping when it revisits its starting node",
      ],
      correctIndex: 1,
    },
    explanation:
      "The textbook `handle()` is a straight walk down `next` with no memory of where it has been. It " +
      "assumes, without saying so anywhere, that the chain is a singly linked list ending in `nullptr`. " +
      "`c.next = &a` turns it into the cycle `a -> b -> c -> a`. None of the three can handle `999`, so " +
      "every call falls through to `next ? next->handle(code) : false` and recurses into the following " +
      "node, and the `nullptr` that would end the walk never arrives. Each hop pushes another stack " +
      "frame, so the program runs until the stack is exhausted. Chains get rewired at runtime by their " +
      "very nature, often from handler registrations scattered across subsystems at startup, and the " +
      "usual raw-pointer linked-list implementation offers no defense against a cycle sneaking in. " +
      "Making it robust takes either an explicit guard (a visited set, or a bounded hop count) or a " +
      "shape that cannot cycle at all, such as an owning `vector<Handler*>` iterated in order.",
  },
  {
    id: "design-patterns-prototype-shallow-copy-26",
    category: "design-patterns",
    difficulty: "hard",
    title: "Prototype clone() built on the implicit copy constructor",
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
        "Well-defined: Report's implicit copy constructor duplicates the array buffer_ points to",
        "Compile error: Report(*this) is not a valid way to implement clone()",
        "A memory leak rather than a double free, the copy having allocated a buffer of its own",
        "Undefined behavior: original and the clone both delete[] the same int array",
      ],
      correctIndex: 3,
    },
    explanation:
      "Prototype promises an independent copy, but `clone()` is only ever as good as the copy " +
      "constructor underneath it. `Report` declares none, so `new Report(*this)` runs the " +
      "implicitly-generated one, which copies members: `buffer_` is an `int*`, so the pointer value is " +
      "duplicated and the 400 bytes it addresses are not. `original` and the cloned `Report` walk away " +
      "holding the identical address. `delete copy` runs `~Report()` and frees that allocation; when " +
      "`original` is destroyed at the end of `main`, its destructor calls `delete[]` on the same " +
      "already-freed pointer. That is a double free and undefined behavior. In practice it usually " +
      "corrupts the allocator's bookkeeping quietly instead of crashing on the spot, so a run of this " +
      "program can exit with status 0 and still be badly wrong. " +
      "A prototype that owns a resource needs a deep-copying copy constructor, or a hand-written " +
      "`clone()` that allocates `new int[size_]` and `std::copy`s into it, instead of leaning on the " +
      "member-wise default.",
  },
  {
    id: "design-patterns-mediator-lifetime-27",
    category: "design-patterns",
    difficulty: "hard",
    title: "A colleague returned by value",
    tags: ["mediator", "lifetime", "dangling-reference"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Colleague;

struct Mediator {
    virtual void notify(Colleague* sender, const std::string& event) = 0;
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
        "Undefined behavior: c.mediator points at a ConcreteMediator destroyed inside makeColleague()",
        "Compile error: a Colleague cannot store a pointer to a local Mediator",
        "Prints nothing and returns normally, notify() being a no-op on a destroyed mediator",
      ],
      correctIndex: 1,
    },
    explanation:
      "Mediator decouples colleagues from each other by routing every message through a central " +
      "object, and says nothing whatsoever about lifetime. Somebody still has to guarantee the mediator " +
      "outlives the colleagues that point at it, and this code never does. `ConcreteMediator m` is a " +
      "stack local of `makeColleague()`; the `Colleague` built around `&m` copies that raw pointer out " +
      "as the return value, and `m` is destroyed at the closing brace. By the time `main` calls " +
      "`c.trigger()`, `c.mediator` refers to dead storage, and `mediator->notify(...)` dereferences it. " +
      "That is undefined behavior, though on most builds it cheerfully prints the expected message, " +
      "since the abandoned stack frame still holds an intact vtable pointer. The same back-reference " +
      "shows up in Observer and Chain of Responsibility for the same reason: it is normally correct, " +
      "since a mediator generally owns and outlives its colleagues (think a dialog owning its widgets), " +
      "and the language does nothing to check the one case where that assumption breaks.",
  },
  {
    id: "design-patterns-strategy-missing-virtual-dtor-28",
    category: "design-patterns",
    difficulty: "hard",
    title: "Sorter cleans up its strategy",
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
        "Well-defined: delete on a base pointer reaches the most-derived destructor regardless",
        "Compile error: an object of abstract type cannot be deleted through a base pointer",
        "Prints the destructor message, then leaks auditLog's storage anyway",
        "Undefined behavior: the destructor message never prints and auditLog's buffer leaks",
      ],
      correctIndex: 3,
    },
    explanation:
      "`delete strategy_` has static type `SortStrategy*` and dynamic type `LoggingQuickSort*`. " +
      "[expr.delete]p3 makes that well defined only when the static type is a base class with a virtual " +
      "destructor, and `SortStrategy` declares no destructor at all, so the program is undefined. What " +
      "implementations actually do is predictable: with no destructor slot in the vtable, `delete` on a " +
      "`SortStrategy*` runs only the implicit `~SortStrategy()`, so `~LoggingQuickSort()` never " +
      "executes, its message never prints, and the `std::vector<std::string>` member is never " +
      "destroyed, leaking its heap buffer and every string in it. Clang will even warn about it under " +
      "`-Wdelete-abstract-non-virtual-dtor`. Strategy interfaces are especially prone to this, because " +
      "the whole point of the pattern is that the context holds the abstract type and never names the " +
      "concrete one. Either declare `virtual ~SortStrategy() = default;` or make sure ownership never " +
      "flows through the base pointer.",
    references: ["https://en.cppreference.com/w/cpp/language/destructor"],
  },
  {
    id: "design-patterns-command-dangling-receiver-29",
    category: "design-patterns",
    difficulty: "hard",
    title: "Replaying a command from a global undo stack",
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
        "Well-defined: std::function keeps the captured Light alive as long as the command exists",
        "Undefined behavior: the replayed command writes through a reference to a destroyed Light",
        "Compile error: a lambda capturing a local by reference cannot be stored past that local's scope",
        "Throws std::bad_function_call on the second invocation",
      ],
      correctIndex: 1,
    },
    explanation:
      "Command exists to separate when an action runs from where it was created, which is what makes " +
      "undo stacks and deferred queues possible in the first place. That separation only holds if the " +
      "command guarantees the lifetime of everything it touches, and `makeToggleCommand` guarantees " +
      "nothing: `[&light]` captures by reference, and the `Light` handed to it is `bulb`, a local of " +
      "`pressSwitch()`. The first call, made while `pressSwitch()` is still on the stack, is fine. The " +
      "command outlives it, though, sitting in the global `g_undoStack` after `bulb` is gone. Type " +
      "erasure through `std::function` copies the closure object, meaning the reference itself, and has " +
      "no idea what that reference names. The replay in `main` therefore assigns through a reference " +
      "to destroyed storage, which is undefined behavior. Any receiver a command might be replayed " +
      "against has to be captured by value, held by `shared_ptr`, or owned somewhere that provably " +
      "outlives the stack the command lives on.",
  },
  {
    id: "design-patterns-adapter-slicing-30",
    category: "design-patterns",
    difficulty: "hard",
    title: "Adapter stored in a std::vector of the target type",
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
        '"default": the vector element ends up as a plain Target',
        '"legacy output": the adapter\'s override is preserved by push_back',
        "Compile error: a PrinterAdapter cannot be push_back'd into a vector<Target>",
        "Undefined behavior: legacy_ is left in a moved-from state inside the element",
      ],
      correctIndex: 0,
    },
    explanation:
      "Adapter needs the same polymorphic storage Decorator does. `std::vector<Target>` holds `Target` " +
      "objects by value, and every element has static *and* dynamic type `Target` no matter what was " +
      "used to construct it. The `PrinterAdapter` temporary binds to `push_back`'s `Target&&` parameter " +
      "(a reference to base happily binds to a derived object), and the move constructor that runs is " +
      "`Target`'s, which knows how to build a `Target` base subobject and nothing more. `legacy_` and " +
      "the `request()` override are dropped on the way in. `targets[0].request()` is a virtual call " +
      "that dispatches on a genuine `Target`, so it prints \"default\". No diagnostic appears anywhere " +
      "along the way, which is what makes slicing into containers such a durable bug: the code is well " +
      "formed and the adapter simply evaporates. Holding " +
      "`std::vector<std::unique_ptr<Target>>` keeps the adapters intact.",
  },
  {
    id: "design-patterns-composite-copy-31",
    category: "design-patterns",
    difficulty: "easy",
    title: "Copying a Composite menu tree",
    tags: ["composite", "unique_ptr", "copy-constructor", "compile-error"],
    type: "trace",
    prompt: "What happens when this program is built and run?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Component {
    virtual ~Component() = default;
    virtual void print() const = 0;
};

struct Leaf : Component {
    std::string name;
    explicit Leaf(std::string n) : name(std::move(n)) {}
    void print() const override { std::cout << name << "\\n"; }
};

struct Menu : Component {
    std::vector<std::unique_ptr<Component>> children;
    void add(std::unique_ptr<Component> c) { children.push_back(std::move(c)); }
    void print() const override {
        for (const auto& c : children) c->print();
    }
};

int main() {
    Menu file;
    file.add(std::make_unique<Leaf>("Open"));
    file.add(std::make_unique<Leaf>("Save"));

    Menu recent = file;                          // start from a copy of "file"
    recent.add(std::make_unique<Leaf>("report.txt"));
    recent.print();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compiles, but recent shares file's children, and both Menus delete them at scope exit",
        "Compiles and prints Open, Save, report.txt, recent holding deep copies of file's leaves",
        "Compile error: copying the vector of children requires copying a std::unique_ptr",
        "Compiles; the copy takes over file's children, leaving file empty, and prints three items",
      ],
      correctIndex: 2,
    },
    explanation:
      "`Menu` declares no copy constructor, so `Menu recent = file;` uses the implicit one, which " +
      "copies each member. Copying `children` means copying a `std::vector<std::unique_ptr<Component>>`, " +
      "and that means copy-constructing each `std::unique_ptr`, whose copy constructor is deleted. The " +
      "program does not compile. The error shows up in an odd place, though. `std::vector`'s copy " +
      "constructor is not constrained on its element type, so `std::is_copy_constructible_v<Menu>` " +
      "reports `true` and `Menu`'s copy constructor is not itself deleted. The failure appears only when " +
      "that constructor is instantiated, deep inside the standard library headers. GCC reports \"use of " +
      "deleted function 'std::unique_ptr<_Tp, _Dp>::unique_ptr(const std::unique_ptr<_Tp, _Dp>&)'\", " +
      "with \"required from here\" pointing at `struct Menu`. Clang reports \"call to implicitly-deleted " +
      "copy constructor of 'std::unique_ptr<Component>'\" (in C++20 mode as a note under a \"no matching " +
      "function for call to '__construct_at'\" error), and its backtrace ends at `Menu recent = file;` " +
      "with \"in implicit copy constructor for 'Menu' first required here\". None of the other three " +
      "behaviors can happen: `unique_ptr` " +
      "does not share ownership, does not deep-copy, and does not move silently out of an lvalue the " +
      "way `auto_ptr` used to. A Composite built on `unique_ptr` children is a strict ownership tree, so " +
      "copying one forces a decision about what a copy of a subtree means. The usual answer is to " +
      "combine it with Prototype: give `Component` a `virtual std::unique_ptr<Component> clone() const` " +
      "and have `Menu` write a copy constructor that clones each child.",
    references: ["https://en.cppreference.com/w/cpp/memory/unique_ptr"],
  },
  {
    id: "design-patterns-abstract-factory-covariant-32",
    category: "design-patterns",
    difficulty: "medium",
    title: "Abstract Factory override returning a derived unique_ptr",
    tags: ["abstract-factory", "covariant-return", "unique_ptr", "compile-error"],
    type: "trace",
    prompt: "What happens when this program is built and run?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Button {
    virtual ~Button() = default;
    virtual void paint() const = 0;
};

struct MacButton : Button {
    void paint() const override { std::cout << "mac button\\n"; }
};

struct WidgetFactory {
    virtual ~WidgetFactory() = default;
    virtual std::unique_ptr<Button> createButton() const = 0;
};

struct MacFactory : WidgetFactory {
    // more specific return type, so code holding a MacFactory gets a MacButton
    std::unique_ptr<MacButton> createButton() const override {
        return std::make_unique<MacButton>();
    }
};

int main() {
    std::unique_ptr<WidgetFactory> f = std::make_unique<MacFactory>();
    f->createButton()->paint();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: unique_ptr<MacButton> is not a valid covariant return type for the override",
        "Prints \"mac button\": the override is accepted as a covariant return type",
        "Prints \"mac button\", but the MacButton it creates is never deleted",
        "Undefined behavior: the base signature reinterprets the returned unique_ptr<MacButton> object",
      ],
      correctIndex: 0,
    },
    explanation:
      "An override must have the same return type as the function it overrides, with one exception: " +
      "covariant return types, which [class.virtual] permits only when both are pointers or both are " +
      "lvalue/rvalue references to classes, the derived one's class being derived from the base one's. " +
      "`std::unique_ptr<MacButton>` and `std::unique_ptr<Button>` are two unrelated class template " +
      "specializations. One implicitly converts to the other, but convertibility is not covariance. " +
      "Clang rejects the override with \"virtual function 'createButton' has a different return type " +
      "('unique_ptr<MacButton>') than the function it overrides (which has return type " +
      "'unique_ptr<Button>')\", and GCC with \"invalid covariant return type for 'virtual " +
      "std::unique_ptr<MacButton> MacFactory::createButton() const'\". Even if it compiled, it wouldn't " +
      "leak: the temporary `unique_ptr` in `f->createButton()->paint()` is destroyed at the end of the " +
      "full expression and deletes the button. Abstract Factory runs into this often, " +
      "because a concrete factory naturally wants to advertise which product family it builds, and with " +
      "raw-pointer returns (`MacButton* createButton()`) covariance would have allowed it. With smart " +
      "pointers the override has to return `std::unique_ptr<Button>`. If callers really need the " +
      "concrete type, the usual idiom is a private virtual returning a covariant raw `MacButton*`, wrapped " +
      "by a non-virtual public `create()` in each class that returns the right `unique_ptr`.",
    references: ["https://en.cppreference.com/w/cpp/language/virtual#Covariant_return_types"],
  },
  {
    id: "design-patterns-iterator-range-for-33",
    category: "design-patterns",
    difficulty: "medium",
    title: "Appending to a playlist mid-traversal",
    tags: ["iterator", "range-for", "iterator-invalidation", "containers"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Song { std::string title; };

class Playlist {
public:
    class Iterator {
    public:
        Iterator(const Playlist* pl, std::size_t i) : pl_(pl), i_(i) {}
        const Song& operator*() const { return pl_->songs_[i_]; }
        Iterator& operator++() { ++i_; return *this; }
        bool operator!=(const Iterator& o) const { return i_ != o.i_; }
    private:
        const Playlist* pl_;
        std::size_t i_;
    };

    void add(std::string t) { songs_.push_back({std::move(t)}); }
    Iterator begin() const { return {this, 0}; }
    Iterator end() const { return {this, songs_.size()}; }
private:
    std::vector<Song> songs_;
};

int main() {
    Playlist pl;
    pl.add("intro");
    pl.add("encore");
    pl.add("outro");

    for (const Song& s : pl) {
        std::cout << s.title << "\\n";
        if (s.title == "encore") pl.add("bonus");   // may reallocate songs_
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Undefined behavior: add() can reallocate songs_, invalidating the iterator the loop holds",
        "Prints intro, encore, outro, bonus: the loop picks up the song appended mid-traversal",
        "Undefined behavior: s refers into songs_, and it dangles as soon as add() reallocates",
        "Prints intro, encore, outro: bonus is appended, but the loop never reaches it",
      ],
      correctIndex: 3,
    },
    explanation:
      "Two facts settle this. First, [stmt.ranged] defines the range-based `for` as `auto __begin = " +
      "pl.begin(); auto __end = pl.end();` followed by a loop on `__begin != __end`, so `end()` is " +
      "evaluated exactly once, before the first iteration. `__end` holds index 3 permanently, and the " +
      "loop stops after \"outro\" no matter how many songs get appended. Second, this iterator stores " +
      "a `Playlist*` and an index and re-reads `pl_->songs_[i_]` on every dereference, so it never " +
      "holds an address into the vector's buffer and a reallocation can't invalidate it. (With the " +
      "1, 2, 4 doubling that libstdc++ and libc++ use, the fourth `push_back` doesn't even reallocate.) The reference `s` would " +
      "dangle after a reallocation, but nothing reads it after `add()` returns, and a dangling " +
      "reference that is never used is not undefined behavior. So the program is well defined and " +
      "quietly skips \"bonus\". That is the Iterator pattern's trade-off: it hides the container's " +
      "representation, which also means callers can no longer reason from `std::vector`'s invalidation " +
      "rules. Its iterators are exactly as robust as their author made them. Caching `const Song*` " +
      "instead of an index would have looked identical from the outside and made this loop undefined " +
      "behavior on any reallocation. A bespoke container should document what mutation during " +
      "traversal means, or, like `std::vector`, simply forbid it.",
    references: ["https://en.cppreference.com/w/cpp/language/range-for"],
  },
  {
    id: "design-patterns-proxy-lazy-const-34",
    category: "design-patterns",
    difficulty: "medium",
    title: "Lazy-loading proxy shared by two reader threads",
    tags: ["proxy", "lazy-initialization", "mutable", "data-race", "thread-safety"],
    type: "trace",
    prompt:
      "Both threads call `size()` on the same `const` proxy, and neither call has happened before. " +
      "What is the behavior of this program?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <memory>
#include <string>
#include <thread>
#include <vector>

struct Image {
    explicit Image(const std::string& path) { pixels.resize(1 << 20); }  // expensive decode
    std::vector<unsigned char> pixels;
};

class ImageProxy {
public:
    explicit ImageProxy(std::string path) : path_(std::move(path)) {}

    std::size_t size() const {
        if (!real_) real_ = std::make_unique<Image>(path_);   // load on first use
        return real_->pixels.size();
    }
private:
    std::string path_;
    mutable std::unique_ptr<Image> real_;
};

int main() {
    const ImageProxy proxy("hero.png");
    std::thread a([&] { std::cout << proxy.size() << "\\n"; });
    std::thread b([&] { std::cout << proxy.size() << "\\n"; });
    a.join();
    b.join();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: size() is a const member function, and it assigns to real_",
        "Well-defined: const member functions on a shared object are safe to call concurrently",
        "Undefined behavior: both threads can read and write real_ unsynchronized, a data race",
        "Well-defined but wasteful: both threads may decode the Image, and one copy is discarded",
      ],
      correctIndex: 2,
    },
    explanation:
      "`mutable` lets a `const` member function modify `real_`, so the code compiles, and that's " +
      "how a virtual proxy keeps lazy loading invisible behind a `const` interface. It also " +
      "hides a write inside what callers see as a read. Both threads can find `real_` empty and each " +
      "assign a fresh `unique_ptr`, while the other thread may be reading `real_` or dereferencing it. " +
      "Unsynchronized conflicting accesses to the same object, at least one of them a write, are a data " +
      "race under [intro.races], and a data race is undefined behavior. The \"benign race\" reading " +
      "doesn't hold up either: `unique_ptr` assignment is not atomic, and if thread B's assignment " +
      "destroys the `Image` thread A just installed, A's `real_->pixels.size()` can read a freed " +
      "object. Testing rarely shows any of this. The decode is fast enough that thread `a` usually " +
      "finishes before `b` starts, and in 40 local runs built with clang's `-fsanitize=thread`, " +
      "ThreadSanitizer never reported `real_` at all, because the two calls never actually overlapped. " +
      "A race that only appears under the right timing is still a race. The reason it surprises people is " +
      "that the standard library's own rule ([res.on.data.races]) is that `const` member functions may " +
      "be called concurrently, and most code assumes user types follow the same rule. A lazy proxy " +
      "that writes in a `const` function breaks that promise unless it synchronizes internally: a " +
      "`mutable std::once_flag` with `std::call_once`, or a `mutable std::mutex` around the check and " +
      "the load.",
    references: [
      "https://en.cppreference.com/w/cpp/language/multithread",
      "https://en.cppreference.com/w/cpp/thread/call_once",
    ],
  },
  {
    id: "design-patterns-bridge-temporary-impl-35",
    category: "design-patterns",
    difficulty: "medium",
    title: "Bridge constructed with an inline renderer argument",
    tags: ["bridge", "reference-member", "temporaries", "lifetime-extension", "dangling-reference"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Renderer {
    virtual ~Renderer() = default;
    virtual void drawCircle(double r) const = 0;
};

struct VectorRenderer : Renderer {
    void drawCircle(double r) const override {
        std::cout << "vector circle r=" << r << "\\n";
    }
};

class Shape {
public:
    explicit Shape(const Renderer& r) : renderer_(r) {}
    virtual ~Shape() = default;
    virtual void draw() const = 0;
protected:
    const Renderer& renderer_;   // the bridge to the implementation
};

class Circle : public Shape {
public:
    Circle(const Renderer& r, double radius) : Shape(r), radius_(radius) {}
    void draw() const override { renderer_.drawCircle(radius_); }
private:
    double radius_;
};

int main() {
    Circle c(VectorRenderer{}, 5.0);
    c.draw();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints \"vector circle r=5\": binding to a const reference extends the temporary to c's lifetime",
        "Undefined behavior: the VectorRenderer temporary is destroyed before c.draw() is ever called",
        "Compile error: a reference member of abstract type Renderer cannot be bound to a temporary",
        "Undefined behavior: renderer_ binds to a sliced Renderer copy, so draw() calls a pure virtual",
      ],
      correctIndex: 1,
    },
    explanation:
      "`VectorRenderer{}` is a temporary bound to the constructor's `const Renderer&` parameter. " +
      "[class.temporary] says a temporary bound to a reference parameter of a function call lives until " +
      "the end of the full-expression containing the call, which here is the declaration of `c`. " +
      "Lifetime extension applies only to a reference bound directly to the temporary in its own " +
      "initialization; it doesn't carry through the parameter into `Shape::renderer_`. When the " +
      "declaration finishes, the renderer is destroyed and `renderer_` refers to dead storage, so " +
      "`c.draw()` makes a virtual call through a dangling reference. That is undefined behavior. No " +
      "slicing is involved: a `const Renderer&` binds to the `VectorRenderer` object itself, which is " +
      "also why the abstract type is no obstacle. In practice the outcome depends on the build. With " +
      "Apple clang the program printed the expected line at `-O0`, crashed at `-O2`, and drew a " +
      "stack-use-after-scope report from AddressSanitizer. GCC 16 did the reverse: the expected line at " +
      "`-O2`, and at `-O0` an abort with \"pure virtual method called\", because the destroyed " +
      "renderer's vtable pointer had been reset to `Renderer`'s by its destructor. Neither compiler " +
      "warned under `-Wall -Wextra`. Bridge " +
      "is prone to this because the pattern exists so the abstraction can point at an implementation " +
      "it doesn't own. With a reference member, the caller is entirely responsible for the " +
      "implementor's lifetime, and an inline argument is the easiest way to get that wrong. Either store " +
      "the implementor as a `std::shared_ptr`/`std::unique_ptr`, or reject temporaries outright with a " +
      "deleted overload such as `Circle(const Renderer&&, double) = delete;`.",
    references: ["https://en.cppreference.com/w/cpp/language/reference_initialization#Lifetime_of_a_temporary"],
  },
  {
    id: "design-patterns-template-method-ctor-36",
    category: "design-patterns",
    difficulty: "hard",
    title: "Template Method run from the base constructor",
    tags: ["template-method", "pure-virtual", "constructors", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Report {
public:
    Report() { generate(); }          // build the report eagerly
    virtual ~Report() = default;

    void generate() {                 // template method: fixed skeleton
        header();
        body();
        footer();
    }
protected:
    virtual void header() { std::cout << "== report ==\\n"; }
    virtual void body() = 0;          // the step every report must supply
    virtual void footer() { std::cout << "== end ==\\n"; }
};

class SalesReport : public Report {
protected:
    void body() override { std::cout << "sales: 42\\n"; }
};

int main() {
    SalesReport r;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints the header, \"sales: 42\", and the footer, generate() dispatching to SalesReport::body",
        "Prints only the header and the footer; the pure hook is skipped while Report is constructed",
        "Undefined behavior: while Report's constructor runs, body() resolves to the pure Report::body",
        "Compile error: an abstract class's constructor cannot call a function that reaches a pure virtual",
      ],
      correctIndex: 2,
    },
    explanation:
      "While `Report`'s constructor runs, the `SalesReport` part of the object hasn't been constructed " +
      "yet, and [class.cdtor] says virtual calls made during construction resolve as if the object's " +
      "dynamic type were the class whose constructor is executing. `header()` therefore runs " +
      "`Report::header`, which is harmless, but `body()` resolves to `Report::body`, which is pure. " +
      "[class.abstract] states that making a virtual call to a pure virtual function, directly or " +
      "indirectly, for the object under construction from its constructor is undefined behavior. The " +
      "indirection is what lets it compile quietly: clang and GCC both warn by default about a pure " +
      "virtual call written directly in a constructor, but here the call sits inside the non-virtual " +
      "`generate()`, and neither says anything even with `-Wall -Wextra`. In practice the vtable slot " +
      "for `body` holds the runtime's `__cxa_pure_virtual` stub during construction. After printing " +
      "\"== report ==\", a clang/libc++ build aborts with \"libc++abi: Pure virtual function called!\", " +
      "and a GCC/libstdc++ build prints \"pure virtual method called\" then \"terminate called without " +
      "an active exception\" and aborts. Both behave the same at `-O0` and `-O2`. Template Method makes " +
      "this an easy mistake: " +
      "the template method is public, non-virtual, and looks like ordinary code you can call from " +
      "anywhere, which hides the fact that every step in it is a virtual call that doesn't work until " +
      "construction is complete. Run the skeleton after construction instead, from the caller or from a " +
      "factory function that builds the object and then calls `generate()`.",
    references: [
      "https://en.cppreference.com/w/cpp/language/abstract_class",
      "https://en.cppreference.com/w/cpp/language/virtual#During_construction_and_destruction",
    ],
  },
  {
    id: "design-patterns-state-self-transition-37",
    category: "design-patterns",
    difficulty: "hard",
    title: "State object that triggers its own transition",
    tags: ["state", "unique_ptr", "use-after-free", "lifetime"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class TrafficLight;

struct LightState {
    virtual ~LightState() = default;
    virtual void tick(TrafficLight& light) = 0;
};

class TrafficLight {
public:
    explicit TrafficLight(std::unique_ptr<LightState> s) : state_(std::move(s)) {}
    void setState(std::unique_ptr<LightState> s) { state_ = std::move(s); }
    void tick() { state_->tick(*this); }
private:
    std::unique_ptr<LightState> state_;
};

struct Yellow : LightState {
    void tick(TrafficLight&) override { std::cout << "yellow\\n"; }
};

struct Green : LightState {
    std::string name = "green";
    int ticks = 0;
    void tick(TrafficLight& light) override {
        if (++ticks == 2) light.setState(std::make_unique<Yellow>());
        std::cout << name << " tick " << ticks << "\\n";
    }
};

int main() {
    TrafficLight light(std::make_unique<Green>());
    light.tick();
    light.tick();
    light.tick();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Undefined behavior: setState() destroys the Green whose tick() is still running, then reads it",
        "Prints \"green tick 1\", \"green tick 2\", \"yellow\": the old state lives until tick() returns",
        "Compile error: Green::tick calls into TrafficLight, which LightState only forward-declares",
        "Prints \"green tick 1\", then \"yellow\" twice: the transition takes effect before the second message",
      ],
      correctIndex: 0,
    },
    explanation:
      "On the second tick, `Green::tick` calls `light.setState(...)`, and the move assignment `state_ = " +
      "std::move(s)` behaves like `reset(s.release())`: it installs the `Yellow`, then deletes the " +
      "object `state_` used to own. That object is the `Green` whose `tick()` is still on the call stack, " +
      "so it is destroyed before its own member function returns. `unique_ptr` defers nothing. The call " +
      "itself is allowed to continue, since destroying `*this` mid-call is legal in the same way `delete " +
      "this` is, but only as long as the function touches no member afterward. The next line reads " +
      "`name` and `ticks` out of the freed `Green`, a use-after-free and undefined behavior. (The code " +
      "does compile: a forward declaration is enough for `LightState`'s reference parameter, and " +
      "`TrafficLight` is complete by the time `Green::tick` calls `setState`.) On macOS, Apple clang and " +
      "GCC 16 builds both printed \"green tick 1\", then \" tick 0\" (the freed memory had already been " +
      "reused), then \"yellow\", and exited 0 at `-O0` and `-O2`. AddressSanitizer reports a " +
      "heap-use-after-free reached from `Green::tick`. The State pattern sets this up structurally: the object best placed to decide on a " +
      "transition is the current state, and the current state is precisely the object that a " +
      "transition destroys. Either make the transition the last thing the state does (copy anything " +
      "needed into locals and return straight after `setState`), or let the context apply it, for " +
      "example by having `tick()` return the next state, or by keeping the old one alive in a local in " +
      "`TrafficLight::tick` until the call returns.",
    references: ["https://en.cppreference.com/w/cpp/memory/unique_ptr/operator%3D"],
  },
  {
    id: "design-patterns-singleton-recursive-init-38",
    category: "design-patterns",
    difficulty: "hard",
    title: "Two Meyer's singletons whose constructors call each other",
    tags: ["singleton", "magic-statics", "recursive-initialization", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Logger {
public:
    static Logger& instance() { static Logger l; return l; }
    void log(const std::string& msg) { std::cout << msg << "\\n"; }
private:
    Logger();
};

class Registry {
public:
    static Registry& instance() { static Registry r; return r; }
    void add(const std::string& name) { names_.push_back(name); }
private:
    Registry() { Logger::instance().log("registry up"); }
    std::vector<std::string> names_;
};

Logger::Logger() { Registry::instance().add("logger"); }

int main() {
    Logger::instance().log("hello");
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints \"registry up\" then \"hello\": the nested call is handed the partly constructed Logger",
        "Compile error: constructors that call each other's instance() form a circular class dependency",
        "Stack overflow: every nested instance() call starts the static's constructor over from the top",
        "Undefined behavior: control re-enters Logger's static declaration while it's still initializing",
      ],
      correctIndex: 3,
    },
    explanation:
      "`main` calls `Logger::instance()`, which begins initializing `l` by running `Logger()`. That " +
      "constructor calls `Registry::instance()`, which begins initializing `r` by running `Registry()`, " +
      "and that constructor calls `Logger::instance()` again while `l` is still mid-initialization. " +
      "[stmt.dcl] covers exactly this: if control re-enters the declaration recursively while the " +
      "variable is being initialized, the behavior is undefined. The language never hands out a " +
      "half-built object here, and it doesn't restart the constructor either. The hidden guard " +
      "variable already says \"initialization in progress\", and the same thread-safety machinery that " +
      "makes concurrent first use of a Meyer's singleton safe now tells this thread to wait for an " +
      "initialization that only it can finish. What you see depends on the runtime. With libc++ (Apple " +
      "clang on macOS), `__cxa_guard_acquire` notices and aborts with \"libc++abi: __cxa_guard_acquire " +
      "detected recursive initialization: do you have a function-local static variable whose " +
      "initialization depends on that function?\". libstdc++ (GCC 16 on macOS) does not detect it: the " +
      "thread waits on the guard's condition variable for itself, and the program hangs with no output. " +
      "On Linux with glibc 2.32 or later, libstdc++'s guard first checks whether the process is still " +
      "single-threaded. This program is, so it throws `__gnu_cxx::recursive_init_error`, which escapes " +
      "`main` and ends in `std::terminate`. Once a second thread has been started, the same guard waits " +
      "on a futex for itself and deadlocks instead. Nothing at compile time catches it, since each class compiles fine alone and the " +
      "cycle exists only in runtime call order. Mutually dependent singletons usually come up in terms " +
      "of *destruction* order, where reverse-construction order often covers for them quietly. The " +
      "construction side has no such fallback. The fix is to break the cycle: " +
      "`Logger` shouldn't need `Registry` during its own construction (register lazily on first log, " +
      "say), or the two should be built in a fixed order by one owner that isn't a singleton.",
    references: ["https://en.cppreference.com/w/cpp/language/storage_duration#Static_local_variables"],
  },
];