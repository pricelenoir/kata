import type { Question } from "@/types/question";

export const cppQuestions: Question[] = [
  {
    id: "cpp-dangling-ref-01",
    category: "cpp",
    difficulty: "medium",
    title: "Returning a reference to a local variable",
    tags: ["references", "lifetime", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <string>

const std::string& getName() {
    std::string name = "Alice";
    return name;
}

int main() {
    const std::string& r = getName();
    std::cout << r << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'Prints "Alice"',
        "Compile error: cannot bind const reference to local",
        "Prints an empty string",
        "Undefined behavior: r is a dangling reference",
      ],
      correctIndex: 3,
    },
    explanation:
      "`name` is a local variable destroyed when `getName()` returns. Binding a `const&` " +
      "to a *temporary at the call site* extends that temporary's lifetime, but that rule " +
      "does not apply here: `name` is a named local, not a temporary, and returning a " +
      "reference to it does not extend its lifetime. `r` is left dangling; reading through " +
      'it is undefined behavior. In practice it may appear to print "Alice" because the ' +
      "stack memory hasn't been overwritten yet, which is what makes this bug " +
      "dangerous: it \"works\" until it doesn't.",
    references: [
      "https://en.cppreference.com/w/cpp/language/reference_initialization",
    ],
  },
  {
    id: "cpp-const-pointer-02",
    category: "cpp",
    difficulty: "easy",
    title: "const pointer vs. pointer-to-const",
    tags: ["const-correctness", "pointers"],
    type: "trace",
    prompt: "Which line(s) fail to compile?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int main() {
    int a = 10, b = 20;
    int* const p1 = &a;   // const pointer to int
    const int* p2 = &a;   // pointer to const int

    p1 = &b;    // (1)
    *p1 = 30;   // (2)
    p2 = &b;    // (3)
    *p2 = 40;   // (4)
}`,
      highlightLines: [6, 7, 8, 9],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Only (1)",
        "Only (4)",
        "(1) and (4)",
        "All four lines compile fine",
      ],
      correctIndex: 2,
    },
    explanation:
      "`p1` is a *const pointer* (`int* const`): the pointer itself is immutable, so " +
      "reassigning it at (1) fails, but `*p1 = 30` at (2) is fine since the pointee is " +
      "non-const. `p2` is a *pointer to const* (`const int*`): the pointer can be " +
      "reassigned freely at (3), but writing through it at (4) fails since the pointee is " +
      "treated as const. Read pointer declarations right-to-left from the variable name.",
  },
  {
    id: "cpp-const-cast-01",
    category: "cpp",
    difficulty: "medium",
    title: "const_cast on a reference to a const object",
    tags: ["const-correctness", "const_cast", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

void modify(const int& r) {
    int& mr = const_cast<int&>(r);
    mr = 100;
}

int main() {
    const int x = 42;
    modify(x);
    std::cout << x << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints 100",
        "Undefined behavior",
        "Compile error: const_cast cannot remove const from a reference binding",
        "Prints 42 on every conforming compiler",
      ],
      correctIndex: 1,
    },
    explanation:
      "`const_cast` only removes the `const` qualifier from the *type*: it does not change " +
      "whether the referred-to object was actually defined `const`. `x` is declared `const int`, " +
      "so it names a genuinely const object; writing through `mr` is undefined behavior per " +
      "[dcl.type.cv], independent of whether the write happens directly or through an " +
      "intermediate reference/pointer. `const_cast` is only safe to use for writing when the " +
      "underlying object is *not* itself const (e.g. it was reached through a `const` pointer/" +
      "reference to an otherwise non-const object). In practice, compilers may fold reads of `x` " +
      "to the compile-time-known value 42 since it is a const-initialized int, so this can print " +
      "42 even though the memory holding it was overwritten to 100. That mismatch is a vivid " +
      "illustration that this is UB the optimizer is entitled to exploit, not merely a case that " +
      "happens to work.",
    references: ["https://en.cppreference.com/w/cpp/language/const_cast"],
  },
  {
    id: "cpp-string-view-01",
    category: "cpp",
    difficulty: "hard",
    title: "Returning a string_view from a function taking const std::string&",
    tags: ["string_view", "lifetime", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <string>
#include <string_view>

std::string_view getFirstWord(const std::string& s) {
    return std::string_view(s).substr(0, s.find(' '));
}

int main() {
    std::string_view sv = getFirstWord("hello world");
    std::cout << sv << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints hello",
        "Prints hello world",
        "Undefined behavior: sv is a dangling view",
        "Compile error: cannot bind a std::string_view to a temporary std::string",
      ],
      correctIndex: 2,
    },
    explanation:
      "`getFirstWord(\"hello world\")` passes a `const char*` where `const std::string&` is " +
      "expected, so an implicit temporary `std::string` is materialized to bind to the parameter " +
      "`s`. `std::string_view` never owns character data; it is just a (pointer, length) view, " +
      "so the returned `string_view` points directly into that temporary's internal buffer. The " +
      "temporary is bound to a function parameter, not directly to a reference at its point of " +
      "declaration, so no lifetime extension applies: it is destroyed at the end of the full " +
      "expression `std::string_view sv = getFirstWord(\"hello world\");`, i.e. immediately after " +
      "`sv` is initialized from it. By the time `std::cout << sv` runs, `sv` is a dangling view " +
      "into freed (or reused) memory: undefined behavior. In practice this can still print " +
      "\"hello\" correctly, because \"hello world\" is short enough to live in the temporary " +
      "`std::string`'s small-string-optimization buffer on the stack, and that stack memory often " +
      "hasn't been overwritten yet by the time `sv` is read. That's the same \"looks fine until it " +
      "isn't\" trap as the dangling-reference example.",
    references: ["https://en.cppreference.com/w/cpp/string/basic_string_view"],
  },
  {
    id: "cpp-ref-pointer-alias-01",
    category: "cpp",
    difficulty: "easy",
    title: "Reference to a pointer",
    tags: ["references", "pointers", "aliasing"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

void reset(int*& rp) {
    rp = nullptr;
}

int main() {
    int x = 5;
    int* p = &x;
    reset(p);
    std::cout << (p == nullptr) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "1",
        "0",
        "Undefined behavior: rp is a dangling reference",
        "Compile error: cannot bind int*& to an int*",
      ],
      correctIndex: 0,
    },
    explanation:
      "`int*& rp` is a *reference to a pointer*: `rp` is not a new pointer, it's another name " +
      "for `p` itself, the same way `int& r = x` makes `r` another name for `x`. Assigning " +
      "`rp = nullptr` inside `reset` therefore assigns through the alias directly to `p` in " +
      "`main`, not to some local copy of the pointer value. After the call, `p` itself is " +
      "`nullptr`, so `p == nullptr` is `true`, printed as `1`. This is the classic pattern for " +
      "writing a function that needs to reseat a caller's pointer (the alternative being to take " +
      "`int**` and have the caller pass `&p`).",
  },
  {
    id: "cpp-lifetime-extension-01",
    category: "cpp",
    difficulty: "easy",
    title: "Binding a const reference to a temporary",
    tags: ["references", "lifetime", "temporaries"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <string>

int main() {
    const std::string& r = std::string("Hello") + " World";
    std::cout << r << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints Hello World",
        "Undefined behavior: r is a dangling reference",
        "Compile error: cannot bind const std::string& to a temporary",
        "Prints Hello",
      ],
      correctIndex: 0,
    },
    explanation:
      "`std::string(\"Hello\") + \" World\"` produces a prvalue temporary `std::string`. Because " +
      "that temporary is bound *directly* to the reference `r` at its point of declaration " +
      "(no function call in between), [class.temporary] extends the temporary's lifetime to " +
      "match `r`'s (here, the rest of `main`). This is the well-behaved counterpart to the " +
      "dangling-reference example: the rule only fails to help when the temporary is bound to " +
      "a reference *inside* a function and that reference is then returned or stored, since the " +
      "extension applies once, at the original binding, and does not propagate through further " +
      "indirection.",
    references: [
      "https://en.cppreference.com/w/cpp/language/reference_initialization",
    ],
  },
  {
    id: "cpp-lifetime-extension-02",
    category: "cpp",
    difficulty: "hard",
    title: "A const reference member initialized from a temporary",
    tags: ["references", "lifetime", "temporaries", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <string>

struct Wrapper {
    const std::string& ref;
    Wrapper(const std::string& s) : ref(s) {}
};

int main() {
    Wrapper w(std::string("temp"));
    std::cout << w.ref << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints temp",
        "Undefined behavior: w.ref is a dangling reference",
        "Compile error: cannot bind a reference member to a temporary",
        "Prints an empty string",
      ],
      correctIndex: 1,
    },
    explanation:
      "The temporary `std::string(\"temp\")` is bound to the constructor parameter `s`, and lifetime " +
      "extension applies once, at that binding: it extends the temporary to the lifetime of `s`, " +
      "which is just the constructor call. Binding the *member reference* `ref` to `s` in the " +
      "member-initializer list does not re-extend it again: [class.base.init] gives no special " +
      "lifetime treatment to reference members initialized from a reference parameter. So the " +
      "temporary is destroyed at the end of the full expression `Wrapper w(std::string(\"temp\"));`, " +
      "and `w.ref` is left dangling before `main`'s next statement even runs. This is the sharp " +
      "edge of storing `const&` members: it looks identical to the safe direct-binding case but " +
      "isn't, and compilers give no diagnostic. In practice this can still print \"temp\" because " +
      "the freed stack bytes haven't been reused yet, which is what makes it dangerous.",
  },
  {
    id: "cpp-overload-resolution-01",
    category: "cpp",
    difficulty: "medium",
    title: "Overloads on int&, const int&, and int&&",
    tags: ["overload-resolution", "references", "move-semantics"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

void f(int&) { std::cout << "lvalue\\n"; }
void f(const int&) { std::cout << "const lvalue\\n"; }
void f(int&&) { std::cout << "rvalue\\n"; }

int main() {
    int x = 1;
    const int cx = 2;
    f(x);
    f(cx);
    f(5);
    f(std::move(x));
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "lvalue / const lvalue / rvalue / rvalue",
        "lvalue / const lvalue / const lvalue / const lvalue",
        "const lvalue / const lvalue / rvalue / rvalue",
        "Compile error: f(x) is ambiguous between f(int&) and f(const int&)",
      ],
      correctIndex: 0,
    },
    explanation:
      "Overload resolution prefers the most specific viable match. `f(x)`: `x` is a modifiable " +
      "lvalue, so `f(int&)` is an exact match and is preferred over `f(const int&)` (no ambiguity: " +
      "a non-const lvalue always prefers the non-const overload when both are viable). `f(cx)`: " +
      "`cx` is const, so only `f(const int&)` is viable. `f(5)`: `5` is a prvalue, which binds to " +
      "`int&&` in preference to `const int&` when an rvalue-reference overload exists. " +
      "`f(std::move(x))`: `std::move` is just `static_cast<int&&>(x)`, producing an xvalue, which " +
      "again prefers `f(int&&)`. This is the mechanism copy and move overloads rely on.",
  },
  {
    id: "cpp-array-decay-01",
    category: "cpp",
    difficulty: "easy",
    title: "sizeof on an array and on an array parameter",
    tags: ["arrays", "pointers", "decay"],
    type: "trace",
    prompt:
      "Assuming a typical 64-bit platform (4-byte int, 8-byte pointer), what does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

void printSize(int arr[]) {
    std::cout << sizeof(arr) << std::endl;
}

int main() {
    int arr[10];
    std::cout << sizeof(arr) << std::endl;
    printSize(arr);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: ["40 then 40", "10 then 10", "8 then 8", "40 then 8"],
      correctIndex: 3,
    },
    explanation:
      "In `main`, `arr` genuinely has array type `int[10]`, so `sizeof(arr)` is `10 * sizeof(int) " +
      "= 40`. A function *parameter* declared `int arr[]` is not actually an array type though: " +
      "per [dcl.fct], a parameter of array type is adjusted to pointer type (`int arr[]` means " +
      "exactly the same thing as `int* arr`). Inside `printSize`, `arr` is just an `int*`, so " +
      "`sizeof(arr)` is `sizeof(int*) = 8`. This is why size information is always lost when an " +
      "array is passed to a function this way: the callee has no idea how many elements there " +
      "are unless it's passed separately (or the array is passed by reference, `int (&arr)[10]`, " +
      "which does preserve the array type and its size).",
  },
  {
    id: "cpp-rvo-01",
    category: "cpp",
    difficulty: "easy",
    title: "Constructor calls when returning a temporary by value",
    tags: ["rvo", "copy-elision", "move-semantics"],
    type: "trace",
    prompt: "Compiled as C++17 or later, what does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

struct Noisy {
    Noisy() { std::cout << "construct\\n"; }
    Noisy(const Noisy&) { std::cout << "copy\\n"; }
    Noisy(Noisy&&) { std::cout << "move\\n"; }
};

Noisy make() {
    return Noisy();
}

int main() {
    Noisy n = make();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: ["construct\\nmove", "construct\\ncopy", "construct\\ncopy\\ncopy", "construct"],
      correctIndex: 3,
    },
    explanation:
      "`return Noisy();` returns a prvalue, and `Noisy n = make();` initializes `n` directly from " +
      "that prvalue. Since C++17, this case (\"guaranteed copy elision\") is not merely an " +
      "optimization a compiler is *permitted* to perform: the language rules were changed so " +
      "that a prvalue used to initialize an object of the same type is constructed directly in " +
      "place, with no temporary and no copy/move constructor call involved at all ([class.copy." +
      "elision], [dcl.init]). Only the single `Noisy()` constructor call happens. This is " +
      "distinct from NRVO (returning a named local), which remains an optional optimization even " +
      "in C++17; see the sibling NRVO question.",
    references: ["https://en.cppreference.com/w/cpp/language/copy_elision"],
  },
  {
    id: "cpp-nrvo-01",
    category: "cpp",
    difficulty: "medium",
    title: "Returning one of two named locals by value",
    tags: ["nrvo", "copy-elision", "move-semantics"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

struct Noisy {
    Noisy() { std::cout << "construct\\n"; }
    Noisy(const Noisy&) { std::cout << "copy\\n"; }
    Noisy(Noisy&&) { std::cout << "move\\n"; }
};

Noisy make(bool flag) {
    Noisy a, b;
    if (flag) return a;
    return b;
}

int main() {
    Noisy n = make(true);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "construct\\nconstruct",
        "construct\\nconstruct\\ncopy",
        "construct\\nconstruct\\nmove",
        "construct\\nmove",
      ],
      correctIndex: 2,
    },
    explanation:
      "Unlike the mandatory elision for a prvalue return (`return Noisy();`), eliding the copy/" +
      "move of a *named* local variable (NRVO) is only ever an optional optimization, even in " +
      "C++17: [class.copy.elision] permits but never requires it. Here `make` has two distinct " +
      "named candidates, `a` and `b`, that could be returned depending on `flag`; a compiler " +
      "cannot generally elide in this shape because there isn't one single local object it can " +
      "construct `n` in place of ahead of time. So both `a` and `b` are constructed (\"construct\" " +
      "x2), and returning `a` (a named local about to go out of scope) implicitly selects the " +
      "move constructor over the copy constructor per the implicit-move-on-return rule " +
      "([class.copy.elision]p3), printing \"move\". Never rely on NRVO for correctness, only as a " +
      "possible performance optimization.",
  },
  {
    id: "cpp-move-semantics-01",
    category: "cpp",
    difficulty: "medium",
    title: "The state of a std::string after being moved from",
    tags: ["move-semantics", "std::string"],
    type: "trace",
    prompt:
      "After this runs, which statement correctly describes what can be said about s1?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <string>
#include <utility>

int main() {
    std::string s1 =
        "a long string that exceeds the small string optimization buffer size for sure";
    std::string s2 = std::move(s1);
    std::cout << s1.size() << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "s1.size() is guaranteed by the standard to be 0",
        "s1.size() is guaranteed to still equal s2.size()",
        "s1 is valid but unspecified; size() returns an unspecified value",
        "Calling s1.size() is undefined behavior until s1 is reassigned",
      ],
      correctIndex: 2,
    },
    explanation:
      "`std::move` casts `s1` to an rvalue reference, causing `s2`'s move constructor to run. " +
      "`std::basic_string`'s move constructor leaves the moved-from object in a *valid but " +
      "unspecified state* ([lib.types.movedfrom] / the general library-wide moved-from guarantee): " +
      "it is still a fully-formed `std::string` object on which any operation with no " +
      "preconditions (like `size()`, `empty()`, or assignment) is well-defined, but the standard " +
      "does not fix what value `size()` returns. In practice, mainstream implementations reset a " +
      "moved-from long string to empty (because they steal its heap buffer and reset the source " +
      "to its default-constructed state), so `0` is what you'll observe on libstdc++/libc++/MSVC " +
      "STL, but code that depends on that across implementations is relying on QoI, not the standard.",
    references: ["https://en.cppreference.com/w/cpp/string/basic_string/basic_string"],
  },
  {
    id: "cpp-move-cast-01",
    category: "cpp",
    difficulty: "easy",
    title: "std::move on a type with no move constructor",
    tags: ["move-semantics", "std::move"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <string>

struct NoMove {
    std::string data;
    NoMove(const std::string& s) : data(s) {}
    NoMove(const NoMove& other) : data(other.data) { std::cout << "copy\\n"; }
    // no move constructor declared, and none is implicitly generated
    // because a copy constructor is user-declared
};

int main() {
    NoMove a("hello");
    NoMove b(std::move(a));
    std::cout << a.data << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "copy\\nhello",
        "copy\\n(empty string)",
        "(no output)\\nhello",
        "Compile error: no matching constructor for std::move(a)",
      ],
      correctIndex: 0,
    },
    explanation:
      "`std::move` is nothing more than `static_cast<NoMove&&>(a)`: it does not itself move " +
      "anything, it just produces an rvalue-typed expression and lets overload resolution decide " +
      "what happens next. `NoMove` declares a copy constructor, which (per [class.copy.ctor]) " +
      "suppresses the implicit generation of a move constructor entirely. With no `NoMove(NoMove" +
      "&&)` candidate available, the rvalue `std::move(a)` still binds to the copy constructor's " +
      "`const NoMove&` parameter: the copy constructor runs (\"copy\" is printed), and `a.data` " +
      "is left completely untouched (\"hello\"). This is the classic trap of assuming `std::move` " +
      "guarantees a move: it only *enables* move overload resolution if a move overload exists.",
  },
  {
    id: "cpp-object-slicing-01",
    category: "cpp",
    difficulty: "medium",
    title: "Passing a Derived object where Base is expected",
    tags: ["object-slicing", "polymorphism", "inheritance"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

struct Base {
    virtual void speak() const { std::cout << "Base\\n"; }
};

struct Derived : Base {
    void speak() const override { std::cout << "Derived\\n"; }
    int extra = 42;
};

void print(Base b) {
    b.speak();
}

int main() {
    Derived d;
    print(d);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Derived",
        "Compile error: cannot pass a polymorphic Derived by value as Base",
        "Base",
        "Undefined behavior",
      ],
      correctIndex: 2,
    },
    explanation:
      "`print` takes its parameter *by value* as `Base`. Constructing `b` from `d` invokes " +
      "`Base`'s (implicitly-defined) copy constructor, which only copies the `Base` subobject: " +
      "`Derived::extra` and, critically, `Derived`'s vtable pointer are not part of a `Base` " +
      "object and are simply not copied. `b` is a genuine, complete `Base` object, not a " +
      "`Derived` disguised as one, so `b.speak()` dispatches virtually to `Base::speak()`. This " +
      "is *object slicing*: passing/assigning a derived object by value where a base type is " +
      "expected silently discards the derived part and any polymorphic behavior with it. The fix " +
      "is to take `Base&`, `const Base&`, or `Base*`/smart pointer instead.",
  },
  {
    id: "cpp-object-slicing-02",
    category: "cpp",
    difficulty: "medium",
    title: "A vector of Base, filled with Derived",
    tags: ["object-slicing", "polymorphism", "containers"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <vector>

struct Base {
    virtual void speak() const { std::cout << "Base "; }
    virtual ~Base() = default;
};

struct Derived : Base {
    void speak() const override { std::cout << "Derived "; }
};

int main() {
    std::vector<Base> v;
    Derived d;
    v.push_back(d);
    for (auto& b : v) b.speak();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: ["Derived", "Base", "Compile error: std::vector<Base> cannot hold Derived objects", "Undefined behavior"],
      correctIndex: 1,
    },
    explanation:
      "`std::vector<Base>` stores `Base` objects by value, contiguously, each occupying exactly " +
      "`sizeof(Base)` bytes; it is not a container of polymorphic handles like `vector<unique_ptr" +
      "<Base>>` would be. `v.push_back(d)` copy-constructs a new `Base` element from `d`, slicing " +
      "off everything that makes `d` a `Derived` (same mechanism as the by-value-parameter " +
      "slicing case). The element stored in `v` is truly, dynamically, a `Base`, so `b.speak()` " +
      "prints \"Base\" once. This is a common real-world bug: reaching for `vector<Base>` for a " +
      "collection of \"shapes\" or \"events\" when polymorphism is required silently produces a " +
      "container that can never actually hold anything but the base behavior. The fix is a " +
      "container of pointers or `std::variant`.",
  },
  {
    id: "cpp-shared-ptr-cycle-01",
    category: "cpp",
    difficulty: "medium",
    title: "Two nodes pointing at each other",
    tags: ["shared_ptr", "smart-pointers", "memory-leak"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <memory>

struct Node {
    std::shared_ptr<Node> next;
    ~Node() { std::cout << "destroyed\\n"; }
};

int main() {
    auto a = std::make_shared<Node>();
    auto b = std::make_shared<Node>();
    a->next = b;
    b->next = a;
    std::cout << "end of main\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "end of main\\ndestroyed\\ndestroyed",
        "destroyed\\ndestroyed\\nend of main",
        "end of main, with no destructor output",
        "Undefined behavior: double free when a and b go out of scope",
      ],
      correctIndex: 2,
    },
    explanation:
      "`std::shared_ptr` uses reference counting, and reference counting cannot collect cycles. " +
      "After `a->next = b; b->next = a;`, each `Node`'s control block has a use count of 2: one " +
      "from the local variable (`a` or `b`) and one from the other node's `next` member. When " +
      "`a` and `b` go out of scope at the end of `main`, each decrement only brings the " +
      "respective use count from 2 to 1. Each node is still kept alive by the other's `next` " +
      "pointer, so neither use count ever reaches 0 and neither destructor runs. \"end of main\" " +
      "prints, but \"destroyed\" never does; the two `Node`s (and their `shared_ptr` cycle) leak " +
      "for the remainder of the program. The standard fix is to make one direction of a " +
      "parent/child or doubly-linked relationship a `std::weak_ptr` instead.",
    references: ["https://en.cppreference.com/w/cpp/memory/shared_ptr"],
  },
  {
    id: "cpp-weak-ptr-lock-01",
    category: "cpp",
    difficulty: "medium",
    title: "weak_ptr::lock after the owning shared_ptr goes out of scope",
    tags: ["weak_ptr", "shared_ptr", "smart-pointers"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <memory>

int main() {
    std::weak_ptr<int> wp;
    {
        auto sp = std::make_shared<int>(42);
        wp = sp;
    }
    if (auto locked = wp.lock()) {
        std::cout << *locked << std::endl;
    } else {
        std::cout << "expired\\n";
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "42",
        "Undefined behavior: dereferencing a dangling weak_ptr",
        "Compile error: weak_ptr has no lock() member",
        "expired",
      ],
      correctIndex: 3,
    },
    explanation:
      "`std::weak_ptr` does not extend the lifetime of the object it observes: it only keeps the " +
      "*control block* alive, letting it safely query whether the object still exists. When `sp` " +
      "goes out of scope at the end of the inner block, the last owning `shared_ptr` is destroyed " +
      "and the `int` is deallocated, even though `wp` (and the control block) still exist. " +
      "`wp.lock()` atomically checks the use count and, finding it zero, returns an empty " +
      "`shared_ptr<int>` rather than a dangling one, which is why `lock()` exists " +
      "instead of some raw `wp.get()`. The empty `shared_ptr` is falsy in the `if`, so \"expired\" " +
      "is printed; there is no UB here specifically because `lock()` was used correctly instead " +
      "of assuming the pointee is still alive.",
    references: ["https://en.cppreference.com/w/cpp/memory/weak_ptr/lock"],
  },
  {
    id: "cpp-iterator-invalidation-01",
    category: "cpp",
    difficulty: "medium",
    title: "Holding a vector iterator across repeated push_back calls",
    tags: ["iterators", "vector", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <vector>

int main() {
    std::vector<int> v = {1, 2, 3};
    auto it = v.begin();
    for (int i = 0; i < 1000; ++i) {
        v.push_back(i);
    }
    std::cout << *it << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "1",
        "Undefined behavior: it is a dangling iterator",
        "1000",
        "A garbage value, but not undefined behavior",
      ],
      correctIndex: 1,
    },
    explanation:
      "`std::vector` stores its elements in one contiguous heap buffer. When `push_back` needs " +
      "more capacity than the buffer currently has, it allocates a new, larger buffer, moves/" +
      "copies every existing element over, and frees the old buffer. Per [vector.modifiers], " +
      "this invalidates *all* iterators, pointers, and references into the old buffer, unless the " +
      "new size is within the vector's already-reserved capacity. `v` starts with capacity for " +
      "only 3 elements, so well before the loop reaches 1000 push_backs, at least one reallocation " +
      "happens, and `it`, which was never refreshed, becomes a dangling iterator into freed " +
      "memory. Dereferencing it afterward is undefined behavior, regardless of what value it " +
      "appears to print.",
    references: ["https://en.cppreference.com/w/cpp/container/vector#Iterator_invalidation"],
  },
  {
    id: "cpp-iterator-invalidation-02",
    category: "cpp",
    difficulty: "medium",
    title: "Erasing one key from a three-key map",
    tags: ["iterators", "map", "erase"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <map>

int main() {
    std::map<int, int> m = {{1, 10}, {2, 20}, {3, 30}};
    auto it1 = m.find(1);
    auto it2 = m.find(2);
    m.erase(it1);
    std::cout << it2->second << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "20",
        "Undefined behavior: erasing from a map invalidates all of its iterators",
        "10",
        "Undefined behavior: rebalancing may relocate the other elements",
      ],
      correctIndex: 0,
    },
    explanation:
      "`std::map` is node-based (typically a red-black tree): each element lives in its own " +
      "heap-allocated node, and iterators are effectively pointers to nodes. Per [associative." +
      "reqmts], `erase` invalidates only iterators and references *to the erased element*: every " +
      "other iterator into the container remains valid, because erasing one node doesn't move or " +
      "reallocate any of the others (unlike `std::vector`, where erase/insert can shift or " +
      "reallocate the whole backing array). `it1` is invalidated by `m.erase(it1)`, but `it2` " +
      "still validly points at the node for key `2`, so `it2->second` is well-defined and prints " +
      "`20`. `std::unordered_map` gives the same erase-only-invalidates-the-erased-element " +
      "guarantee, though it can invalidate iterators on *insertion* if a rehash occurs.",
  },
  {
    id: "cpp-map-complexity-01",
    category: "cpp",
    difficulty: "easy",
    title: "map vs. unordered_map complexity guarantees",
    tags: ["map", "unordered_map", "complexity"],
    type: "trace",
    prompt:
      "You need a container keyed by unique integers with fast lookups; iteration order doesn't " +
      "matter. Which statement correctly compares std::map<int, V> and std::unordered_map<int, V>?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both are O(1) average lookup; std::map is preferred only for small n",
        "std::map lookup is O(1); std::unordered_map lookup is O(log n)",
        "Both containers guarantee O(log n) worst-case lookup",
        "std::map is O(log n) worst-case; std::unordered_map is O(1) average, O(n) worst-case",
      ],
      correctIndex: 3,
    },
    explanation:
      "`std::map` is required by the standard to be implemented as a balanced binary search tree " +
      "(in practice always a red-black tree), giving `find`/`insert`/`erase` guaranteed O(log n) " +
      "complexity in every case, plus sorted iteration order for free. `std::unordered_map` is a " +
      "hash table: its *average* complexity for those operations is O(1), which is what makes it " +
      "attractive, but its *worst-case* complexity is O(n): if many keys collide into the same " +
      "bucket (whether from bad luck, a poor hash function, or an adversarial input designed to " +
      "cause collisions), every lookup in that bucket degrades to a linear scan. Neither container " +
      "gives a worst-case O(1) guarantee; that distinction matters a great deal in latency-" +
      "sensitive or adversarial-input contexts.",
    references: [
      "https://en.cppreference.com/w/cpp/container/map",
      "https://en.cppreference.com/w/cpp/container/unordered_map",
    ],
  },
  {
    id: "cpp-vector-reserve-01",
    category: "cpp",
    difficulty: "medium",
    title: "A pointer into a vector after reserve() and further push_backs",
    tags: ["vector", "reserve", "iterator-invalidation"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <vector>

int main() {
    std::vector<int> v;
    v.reserve(10);
    v.push_back(1);
    int* p = &v[0];
    for (int i = 0; i < 5; ++i) v.push_back(i);
    std::cout << (p == &v[0]) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "1",
        "0",
        "Undefined behavior: p is invalidated by the later push_back calls",
        "Implementation-defined: reserve is only a hint",
      ],
      correctIndex: 0,
    },
    explanation:
      "`v.reserve(10)` immediately allocates a buffer with capacity for 10 elements and does not " +
      "reallocate again until `size()` would need to exceed that capacity. After `reserve`, the " +
      "vector holds `1` element (from `push_back(1)`), then 5 more are pushed for a total of 6, " +
      "still within the reserved capacity of 10. Per [vector.reserve], `push_back` only " +
      "invalidates iterators/pointers/references when it actually reallocates; since no " +
      "reallocation occurs here, `p` (taken after the `reserve`) continues to point at the same, " +
      "still-valid storage, and `&v[0]` is unchanged, so `p == &v[0]` is `true` (`1`). This is the " +
      "standard technique for keeping pointers/iterators stable across a known number of " +
      "insertions: reserve enough capacity up front.",
    references: ["https://en.cppreference.com/w/cpp/container/vector/reserve"],
  },
  {
    id: "cpp-template-overload-01",
    category: "cpp",
    difficulty: "hard",
    title: "Non-template vs. template overload resolution",
    tags: ["templates", "overload-resolution"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

template <typename T>
void f(T) { std::cout << "template\\n"; }

void f(int) { std::cout << "non-template\\n"; }

int main() {
    f(42);
    f(3.14);
    f('c');
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "non-template / template / template",
        "non-template / non-template / non-template",
        "template / template / template",
        "non-template / non-template / template",
      ],
      correctIndex: 0,
    },
    explanation:
      "`f(42)`: both `f(int)` and the instantiation `f<int>(int)` are exact-match, equally-good " +
      "candidates by conversion ranking, so [over.match.best]'s explicit tie-break rule applies: " +
      "a non-template function is preferred over an equally-good function template specialization. " +
      "`f(3.14)`: `f<double>(double)` is an exact match for the `double` argument, while `f(int)` " +
      "requires a floating-to-integral conversion (worse than exact match), so the template wins " +
      "outright; the tie-break rule never comes into play because the candidates aren't equally " +
      "good. `f('c')`: `f<char>(char)` is an exact match, while `f(int)` requires only an integral " +
      "*promotion* char→int, and promotions rank worse than exact matches, so the template wins again. " +
      "The tie-break toward non-templates only matters when the two candidates are otherwise " +
      "indistinguishable.",
  },
  {
    id: "cpp-sso-01",
    category: "cpp",
    difficulty: "medium",
    title: "std::string::data() before and after assigning a longer string",
    tags: ["std::string", "sso", "implementation-defined"],
    type: "trace",
    prompt:
      "On a typical modern implementation (libstdc++, libc++, or MSVC STL), what does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <string>

int main() {
    std::string s = "short";
    const char* p1 = s.data();
    s = "this is a much longer string that will not fit in the small buffer";
    const char* p2 = s.data();
    std::cout << (p1 == p2) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "1",
        "Undefined behavior: p1 dangles once s is reassigned",
        "0",
        "1 on some implementations, 0 on others",
      ],
      correctIndex: 2,
    },
    explanation:
      "Small String Optimization is not mandated by the standard, but every major implementation " +
      "does it: a `std::string` whose content fits within an implementation-defined inline buffer " +
      "(commonly 15 or 22 characters, embedded directly in the `std::string` object) stores its " +
      "characters there instead of on the heap, avoiding an allocation. `\"short\"` fits in that " +
      "buffer, so `p1` points into `s`'s own storage. The second string is long enough to exceed " +
      "the SSO capacity on all mainstream implementations, forcing `s` to allocate a new heap " +
      "buffer and switch representations, so `p2` points somewhere entirely different. `p1 == p2` " +
      "is `false` (`0`). This is a good reminder that `std::string::data()`/`c_str()` pointers " +
      "are only stable until the *next* mutating operation, and that the boundary at which a " +
      "string \"goes to the heap\" is implementation-defined, not portable, and not something to " +
      "hardcode logic around.",
    references: ["https://en.cppreference.com/w/cpp/string/basic_string"],
  },
  {
    id: "cpp-ctad-01",
    category: "cpp",
    difficulty: "easy",
    title: "CTAD: braces vs. parentheses",
    tags: ["ctad", "templates", "vector"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <vector>

int main() {
    std::vector v1{1, 2, 3};
    std::vector v2(5, 1);
    std::cout << v1.size() << " " << v2.size() << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "3 2",
        "Compile error: std::vector requires an explicit template argument",
        "3 1",
        "3 5",
      ],
      correctIndex: 3,
    },
    explanation:
      "Class template argument deduction (C++17) both deduces `T = int` for `std::vector<int>` " +
      "here, but the two initializations select genuinely different constructors, exactly as they " +
      "would with the type spelled out explicitly. `v1{1, 2, 3}` uses brace-init, which prefers " +
      "the `initializer_list<int>` constructor whenever one exists and is viable, producing a " +
      "3-element vector holding `1, 2, 3`. `v2(5, 1)` uses parens, which never considers " +
      "`initializer_list` constructors, so overload resolution instead matches `vector(size_type " +
      "count, const T& value)`, producing a 5-element vector where every element is `1`. So " +
      "`v1.size()` is `3` and `v2.size()` is `5`. The brace-vs-paren distinction (not CTAD itself) " +
      "is the actual source of the surprise here: it's the same `std::vector(5, 1)` vs. `std::" +
      "vector{5, 1}` trap that predates CTAD, just easier to trip over once the type name is elided.",
    references: ["https://en.cppreference.com/w/cpp/language/class_template_argument_deduction"],
  },
  {
    id: "cpp-structured-bindings-01",
    category: "cpp",
    difficulty: "easy",
    title: "Structured bindings declared with auto",
    tags: ["structured-bindings", "c++17"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <utility>

int main() {
    std::pair<int, int> p = {1, 2};
    auto [a, b] = p;
    a = 100;
    std::cout << p.first << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "100",
        "Undefined behavior: a and b alias p's members directly",
        "1",
        "Compile error: structured bindings are read-only",
      ],
      correctIndex: 2,
    },
    explanation:
      "`auto [a, b] = p;` (with `auto`, not `auto&`) introduces a hidden, uniquely-named variable " +
      "that is *copy-initialized from `p`* (call it `e`). `a` and `b` are not new variables in " +
      "the usual sense; per [dcl.struct.bind] they are names that refer to `e.first` and " +
      "`e.second`, i.e. to the members of the copy, not of `p`. So `a = 100` mutates the hidden " +
      "copy's `first` member, leaving `p.first` completely unaffected, and the program prints `1`. " +
      "To actually bind to `p`'s own members (so writes are observed through `p`), the declaration " +
      "must say `auto& [a, b] = p;`, which makes the hidden variable a reference to `p` instead of " +
      "a copy.",
    references: ["https://en.cppreference.com/w/cpp/language/structured_binding"],
  },
  {
    id: "cpp-concepts-01",
    category: "cpp",
    difficulty: "easy",
    title: "Calling a Numeric-constrained template with std::string",
    tags: ["concepts", "templates", "c++20"],
    type: "trace",
    prompt: "Compiled as C++20, what happens when this is compiled?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <concepts>
#include <iostream>
#include <string>

template <typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

template <Numeric T>
T add(T a, T b) {
    return a + b;
}

int main() {
    std::cout << add(std::string("a"), std::string("b")) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'Prints "ab"',
        "Undefined behavior",
        'Compile error: ambiguous overload for add(std::string, std::string)',
        "Compile error: std::string does not satisfy the Numeric constraint",
      ],
      correctIndex: 3,
    },
    explanation:
      "`add` is constrained with `template <Numeric T>`, shorthand for a `requires Numeric<T>` " +
      "clause. `Numeric<std::string>` evaluates `std::integral<std::string> || std::floating_point" +
      "<std::string>`, both of which are `false`, so the constraint is not satisfied for `T = std" +
      "::string`, even though `std::string` does support `operator+` and the function body would " +
      "otherwise compile just fine. Because the constraint check happens during overload " +
      "resolution rather than by instantiating the body and hoping for the best (as pre-concepts " +
      "SFINAE tricks did), the compiler produces a direct, readable diagnostic (\"candidate " +
      "template ignored: constraints not satisfied... because std::string does not satisfy " +
      "integral\") rather than a wall of template-instantiation errors from deep inside the " +
      "function body. This is the main practical win concepts offer over unconstrained templates.",
    references: ["https://en.cppreference.com/w/cpp/language/constraints"],
  },
  {
    id: "cpp-ranges-01",
    category: "cpp",
    difficulty: "hard",
    title: "std::views::filter and a later push_back",
    tags: ["ranges", "views", "c++20"],
    type: "trace",
    prompt: "Compiled as C++20, what does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <vector>
#include <ranges>

int main() {
    std::vector<int> v = {1, 2, 3, 4, 5};
    auto view = v | std::views::filter([](int n) { return n % 2 == 0; });
    v.push_back(6);
    for (int n : view) std::cout << n << " ";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "2 4",
        "2 4 6",
        "1 2 3 4 5 6",
        "Undefined behavior: v is modified while a view over it exists",
      ],
      correctIndex: 1,
    },
    explanation:
      "`std::views::filter` produces a *view*: a lightweight, lazy adaptor that stores a reference " +
      "to `v` and the predicate, but does not eagerly copy or evaluate anything at the point " +
      "`view` is created. No filtering actually happens until the view is iterated. By the time " +
      "the range-`for` loop calls `begin()`/`end()` on `view`, `v` already has `6` appended to it, " +
      "so the filter walks over `v`'s *current* contents (`{1,2,3,4,5,6}`) and yields the even " +
      "elements it finds at iteration time: `2 4 6`. (This program is not itself UB: `push_" +
      "back` here doesn't necessarily reallocate away any iterators the view is holding, because " +
      "the view holds a reference to the container and re-fetches `begin()`/`end()` from it, not " +
      "a stashed pair of iterators.) The general lesson is that views observe the underlying range " +
      "at the moment of iteration, not at the moment the view expression was written. That's a " +
      "frequent source of surprise when a view is built once and consumed later after the source " +
      "has changed.",
    references: ["https://en.cppreference.com/w/cpp/ranges/filter_view"],
  },
  {
    id: "cpp-coroutines-01",
    category: "cpp",
    difficulty: "hard",
    title: "A coroutine taking a const std::string& parameter",
    tags: ["coroutines", "lifetime", "undefined-behavior", "c++20"],
    type: "trace",
    prompt: "Compiled as C++20, what happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <coroutine>
#include <iostream>
#include <string>

struct Task {
    struct promise_type {
        Task get_return_object() {
            return Task{std::coroutine_handle<promise_type>::from_promise(*this)};
        }
        std::suspend_always initial_suspend() { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        void return_void() {}
        void unhandled_exception() {}
    };
    std::coroutine_handle<promise_type> handle;
};

Task logValue(const std::string& value) {
    std::cout << "value: " << value << std::endl;
    co_return;
}

int main() {
    Task t = logValue(std::string("hello"));
    t.handle.resume();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'Reliably prints "value: hello"',
        "Undefined behavior: value is a dangling reference",
        "Compile error: cannot bind a coroutine reference parameter to a temporary",
        "Prints an empty string, always",
      ],
      correctIndex: 1,
    },
    explanation:
      "Coroutine parameters that are references are *not* copied into the coroutine frame: only " +
      "the reference itself is stored there, the same as an ordinary function. `logValue`'s " +
      "`initial_suspend` returns `suspend_always`, so calling `logValue(...)` constructs the frame " +
      "(binding `value` to the temporary `std::string(\"hello\")`) and immediately suspends before " +
      "any of the function body runs, returning control (and the `Task`) back to `main`. The " +
      "temporary was bound to the call's reference *parameter*, not directly to a reference " +
      "declared with static/automatic storage duration, so its lifetime is not extended past the " +
      "end of the full expression `Task t = logValue(std::string(\"hello\"));`; it is destroyed at " +
      "that semicolon. By the time `t.handle.resume()` actually runs the body and reads `value`, " +
      "the reference is dangling: undefined behavior. In practice this often still prints " +
      "\"hello\" because the stack slot the temporary occupied hasn't been reused yet, which is " +
      "why this bug is easy to ship and hard to catch in testing. The general rule: never " +
      "let a coroutine hold a reference across a suspension point unless the referent's lifetime " +
      "is independently guaranteed to outlive the coroutine.",
  },
  {
    id: "cpp-signed-overflow-01",
    category: "cpp",
    difficulty: "medium",
    title: "Adding 1 to INT_MAX and to UINT_MAX",
    tags: ["undefined-behavior", "integer-overflow", "unsigned"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <limits>

int main() {
    int max = std::numeric_limits<int>::max();
    unsigned int umax = std::numeric_limits<unsigned int>::max();
    std::cout << (max + 1) << std::endl;
    std::cout << (umax + 1) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Undefined behavior for max + 1; a well-defined 0 for umax + 1",
        "-2147483648 then 0: both are well-defined two's-complement wraparound",
        "Undefined behavior for both max + 1 and umax + 1",
        "Compile error: mixing signed and unsigned operands is ill-formed",
      ],
      correctIndex: 0,
    },
    explanation:
      "Per [expr.pre], an expression whose result is not representable in its type has undefined " +
      "behavior, which is what `max + 1` does. C++20 does fix the *representation* of signed " +
      "integers as two's complement, but that says nothing about what happens on overflow: the " +
      "operation itself is still undefined, even though unoptimized code will typically appear to " +
      "wrap to `INT_MIN`, i.e. `-2147483648`. An optimizer is entitled to assume signed overflow " +
      "never happens and transform the code accordingly (e.g. constant-folding, eliminating " +
      "\"impossible\" overflow checks), so relying on wraparound is a real, exploitable bug, not " +
      "just a style nit. Unsigned integer arithmetic, by contrast, is explicitly defined by " +
      "[basic.fundamental] to be performed modulo 2^N: `umax + 1` is guaranteed to wrap to `0`, " +
      "no exceptions. That asymmetry is why mixing signed and unsigned arithmetic, or " +
      "using signed types for things like loop counters near their bounds, is a recurring source " +
      "of subtle bugs.",
  },
  {
    id: "cpp-bounds-checking-01",
    category: "cpp",
    difficulty: "easy",
    title: "operator[] vs. at() for out-of-bounds access",
    tags: ["vector", "bounds-checking", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <vector>

int main() {
    std::vector<int> v = {1, 2, 3};
    std::cout << v[10] << std::endl;
    std::cout << v.at(10) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both print an unspecified garbage value; neither performs a bounds check",
        "v[10] is undefined behavior; v.at(10) throws std::out_of_range, terminating the program",
        "Both throw std::out_of_range",
        "Compile error: index 10 is out of range for a 3-element vector",
      ],
      correctIndex: 1,
    },
    explanation:
      "`std::vector::operator[]` has no bounds-checking requirement: [vector.access] specifies " +
      "its precondition as `pos < size()`, and violating a precondition is undefined behavior, not " +
      "a guaranteed crash or a guaranteed garbage read; it might read adjacent heap memory, " +
      "segfault, or (with a hardened standard library / sanitizer build) abort deterministically. " +
      "`std::vector::at()`, by contrast, is specified to perform a bounds check and throw `std::" +
      "out_of_range` if the index is invalid. It exists precisely to trade `operator[]`'s zero-" +
      "overhead-when-correct behavior for safety at a small runtime cost. Since neither call here " +
      "is inside a `try`/`catch`, the exception from `v.at(10)` propagates out of `main` uncaught, " +
      "which calls `std::terminate`. In a real predict-the-output sense, note that the `v[10]` " +
      "line already being UB technically makes anything after it unpredictable too, so mixing " +
      "unchecked and checked access like this is worth avoiding on its own merits.",
    references: ["https://en.cppreference.com/w/cpp/container/vector/at"],
  },
  {
    id: "cpp-virtual-ctor-01",
    category: "cpp",
    difficulty: "medium",
    title: "Calling a virtual function from a base class constructor",
    tags: ["virtual-functions", "constructors", "polymorphism"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

struct Base {
    Base() { init(); }
    virtual void init() { std::cout << "Base::init\\n"; }
};

struct Derived : Base {
    void init() override { std::cout << "Derived::init\\n"; }
};

int main() {
    Derived d;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing is printed: virtual calls are skipped during construction",
        "Derived::init",
        "Undefined behavior: calling a virtual function from a constructor",
        "Base::init",
      ],
      correctIndex: 3,
    },
    explanation:
      "Constructing a `Derived` first runs `Base`'s constructor, and during that constructor's " +
      "execution the object's dynamic type, for purposes of virtual dispatch, is `Base`, not " +
      "`Derived`. Per [class.cdtor], while a base class constructor is running, the object behaves " +
      "as if it were of the base type: the `Derived`-specific parts of the object (including its " +
      "override of `init`) haven't been constructed yet, so the vtable pointer in effect at that " +
      "point resolves virtual calls to `Base`'s own members. So `Base()`'s call to `init()` " +
      "dispatches to `Base::init()`, printing \"Base::init\", even though `init` is `virtual` and " +
      "the complete object is ultimately a `Derived`. This is well-defined (not UB) but is a " +
      "famous gotcha, since it violates the intuition that virtual calls always resolve to \"the " +
      "most-derived override\": that intuition only holds once construction has finished.",
    references: ["https://en.cppreference.com/w/cpp/language/virtual"],
  },
  {
    id: "cpp-static-init-order-01",
    category: "cpp",
    difficulty: "hard",
    title: "A global that reads another file's global",
    tags: ["static-initialization", "undefined-behavior", "translation-units"],
    type: "trace",
    prompt:
      "Given these two translation units linked into one program, what can be said about the " +
      "output when the program runs?",
    snippet: {
      language: "cpp",
      filename: "a.cpp / b.cpp",
      code: `// --- b.h ---
struct B {
    static int value;
};

// --- b.cpp ---
#include "b.h"
int B::value = 42;

// --- a.cpp ---
#include <iostream>
#include "b.h"

struct A {
    A() { std::cout << "A sees B::value = " << B::value << std::endl; }
};
A globalA;   // a non-local static object with dynamic initialization

// --- main.cpp ---
int main() {}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Always prints \"A sees B::value = 42\": initialization order across files is well-defined",
        "Undefined behavior: B::value is read before its dynamic initializer has necessarily run",
        "Compile error: B::value is used in A's constructor before b.cpp is compiled",
        "Unspecified: this may print 0 or 42 depending on the toolchain and link order",
      ],
      correctIndex: 3,
    },
    explanation:
      "Per [basic.start.dynamic], the relative order of dynamic initialization of non-local static-" +
      "storage-duration objects defined in *different* translation units is unspecified (only " +
      "initialization order *within a single* translation unit is guaranteed to follow declaration " +
      "order). `B::value` is zero-initialized (to `0`) during static, constant initialization " +
      "before any dynamic initialization runs anywhere in the program, but whether `B::value`'s " +
      "dynamic initializer (`= 42`) has already run *before* `globalA`'s constructor executes " +
      "depends entirely on which translation unit's dynamic initializers the linker/runtime " +
      "happens to sequence first, commonly but not reliably related to link order. This is " +
      "the classic \"static initialization order fiasco\": the program may print `42` on one " +
      "toolchain/link order and silently print `0` on another (or after an innocuous build change " +
      "reorders object files), with no compiler diagnostic either way. The standard mitigation is " +
      "the \"construct on first use\" idiom: wrapping `B::value` in a function-local static, whose " +
      "initialization order relative to other function-local statics *is* well-defined (first use " +
      "triggers initialization, guaranteed at most once, thread-safely since C++11).",
    references: [
      "https://isocpp.org/wiki/faq/ctors#static-init-order",
      "https://en.cppreference.com/w/cpp/language/initialization#Non-local_variables",
    ],
  },
  {
    id: "cpp-exception-safety-01",
    category: "cpp",
    difficulty: "hard",
    title: "Throwing from a constructor after its members are constructed",
    tags: ["exceptions", "constructors", "exception-safety"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <stdexcept>

struct Resource {
    Resource() { std::cout << "Resource acquired\\n"; }
    ~Resource() { std::cout << "Resource released\\n"; }
};

struct Widget {
    Resource r1;
    Resource r2;
    Widget() : r1(), r2() {
        throw std::runtime_error("construction failed");
    }
    ~Widget() { std::cout << "Widget destroyed\\n"; }
};

int main() {
    try {
        Widget w;
    } catch (const std::exception& e) {
        std::cout << "caught: " << e.what() << std::endl;
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Resource acquired\\nResource acquired\\nResource released\\nResource released\\ncaught: construction failed",
        "Resource acquired\\nResource acquired\\nWidget destroyed\\nResource released\\nResource released\\ncaught: construction failed",
        "Resource acquired\\nResource acquired\\ncaught: construction failed",
        "Undefined behavior: throwing from a constructor always corrupts the object",
      ],
      correctIndex: 0,
    },
    explanation:
      "Member initializers run before the constructor body, in declaration order, so `r1` and `r2` " +
      "are both fully constructed (\"Resource acquired\" x2) before `Widget`'s constructor body " +
      "throws. Per [class.base.init] and [except.ctor], when an exception exits a constructor, the " +
      "object under construction is never considered to have completed construction, so its own " +
      "destructor (`Widget::~Widget`) is *not* invoked; an object whose constructor never finished " +
      "does not \"exist\" to be destroyed. However, stack unwinding still automatically destroys " +
      "every subobject (base classes and non-static data members) that *had* already finished " +
      "constructing, in the reverse of their construction order, so `r2` and then `r1` are " +
      "destroyed (\"Resource released\" x2) even though `Widget::~Widget` never runs. This is why " +
      "RAII members are safe even when a constructor fails partway through: each already-" +
      "constructed member cleans itself up, and there is no leak here, but it is also why a " +
      "`Widget::~Widget` body (e.g. logging \"widget destroyed\", releasing a resource acquired " +
      "manually rather than via an RAII member) would never run on this path, a common source of " +
      "resource leaks when acquisition isn't itself RAII-wrapped.",
    references: ["https://en.cppreference.com/w/cpp/language/constructor"],
  },
  {
    id: "cpp-sfinae-01",
    category: "cpp",
    difficulty: "hard",
    title: "Detecting a nested value_type with std::void_t",
    tags: ["templates", "sfinae", "type-traits", "metaprogramming"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <type_traits>

template <typename T, typename = void>
struct has_value_type : std::false_type {};

template <typename T>
struct has_value_type<T, std::void_t<typename T::value_type>> : std::true_type {};

struct A { using value_type = int; };
struct B {};

int main() {
    std::cout << has_value_type<A>::value << has_value_type<B>::value << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "11",
        "01",
        "10",
        "Compile error: B::value_type does not exist",
      ],
      correctIndex: 2,
    },
    explanation:
      "The primary template `has_value_type<T, typename = void>` defaults its second parameter to " +
      "`void` and inherits from `false_type`. The partial specialization `has_value_type<T, std::" +
      "void_t<typename T::value_type>>` is more specialized and is preferred whenever `typename T::" +
      "value_type` is a valid type expression, since `std::void_t<...>` then evaluates to `void`, " +
      "matching the primary's default. For `A`, `A::value_type` is well-formed, so the specialization " +
      "matches and `has_value_type<A>::value` is `true`. For `B`, `B::value_type` does not exist, so " +
      "substituting it into `void_t<typename T::value_type>` fails. Per SFINAE (\"substitution " +
      "failure is not an error\", [temp.deduct]), this failure occurs in the immediate context of " +
      "template argument deduction for the partial specialization and is silently discarded rather " +
      "than raising a hard error, falling back to the primary template's `false_type`. Output: `10`.",
    references: ["https://en.cppreference.com/w/cpp/types/void_t"],
  },
  {
    id: "cpp-template-template-01",
    category: "cpp",
    difficulty: "medium",
    title: "std::vector as a single-parameter template template argument",
    tags: ["templates", "template-template-parameters", "c++17"],
    type: "trace",
    prompt: "Compiled as C++20, what happens when this is compiled?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <vector>

template <template <typename> class TT>
struct Trait {
    static void show() { std::cout << "matched\\n"; }
};

int main() {
    Trait<std::vector>::show();  // std::vector has two template params (second defaulted)
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "matched: legal since C++17's relaxed matching rules (P0522)",
        "Compile error: std::vector takes two template parameters but TT expects one",
        "matched: this has been legal since C++03",
        "Compile error: std::vector cannot be a template template argument at all",
      ],
      correctIndex: 0,
    },
    explanation:
      "Prior to C++17, [temp.arg.template] required a template template *argument*'s parameter list " +
      "to match the corresponding template template *parameter*'s list exactly, parameter-for-" +
      "parameter: `std::vector<T, Allocator = std::allocator<T>>` has two parameters, so it could " +
      "not bind to `template <typename> class TT`, which expects exactly one. P0522R0, adopted for " +
      "C++17, relaxed this: a template template argument may now have additional trailing parameters " +
      "as long as they have default arguments, so `std::vector` (whose second parameter, `Allocator`, " +
      "is defaulted) successfully matches `TT`. Under C++20 (which retains this relaxed rule), `Trait" +
      "<std::vector>` compiles and instantiates cleanly, printing \"matched\", a change that quietly " +
      "fixed a very common pain point for anyone writing generic container-adaptor code.",
    references: ["https://en.cppreference.com/w/cpp/language/template_parameters"],
  },
  {
    id: "cpp-nttp-01",
    category: "cpp",
    difficulty: "hard",
    title: "A class type as a non-type template parameter",
    tags: ["templates", "nttp", "c++20", "structural-types"],
    type: "trace",
    prompt: "Compiled as C++20, what happens when this is compiled?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

class Vec2 {
public:
    constexpr Vec2(int x, int y) : x_(x), y_(y) {}
    int x_, y_;
private:
    int cachedNorm_ = 0;
};

template <Vec2 V>
struct Fixed {
    static constexpr int sum = V.x_ + V.y_;
};

int main() {
    constexpr Vec2 v{3, 4};
    Fixed<v> f;
    std::cout << f.sum << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "7",
        "Compile error: Vec2 is not a structural type",
        "0: only the public members participate in the template argument",
        "Undefined behavior: reading V.x_ and V.y_ from a template parameter object",
      ],
      correctIndex: 1,
    },
    explanation:
      "C++20 permits class types as non-type template parameters ([temp.param]), but only for " +
      "*structural types*: the type must be a literal type, and every base class and non-static data " +
      "member must be public and non-mutable, with each member's own type also required to be " +
      "structural. `Vec2` declares `cachedNorm_` as a private data member, which violates that " +
      "requirement outright. It doesn't matter that `cachedNorm_` is never referenced by `Fixed`; " +
      "the structural-type check applies to the whole class, not just the members actually used. " +
      "`template <Vec2 V>` is therefore ill-formed as soon as it's instantiated with any `Vec2` " +
      "value, since `Vec2` itself can never satisfy the structural-type requirement. This is a hard " +
      "compile error, not something that depends on which members `Fixed` happens to touch.",
    references: ["https://en.cppreference.com/w/cpp/language/template_parameters#Non-type_template_parameter"],
  },
  {
    id: "cpp-variadic-pack-01",
    category: "cpp",
    difficulty: "hard",
    title: "Three increments in one call",
    tags: ["variadic-templates", "evaluation-order", "sequencing"],
    type: "trace",
    prompt: "What does this program print, or is it undefined behavior?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

template <typename... Args>
void printAll(Args... args) {
    (std::cout << ... << args) << '\\n';
}

int main() {
    int i = 0;
    printAll(++i, ++i, ++i);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "123",
        "321",
        "Unspecified: args ends up holding some permutation of 1, 2, 3",
        "Undefined behavior: i is modified three times with no sequencing between them",
      ],
      correctIndex: 2,
    },
    explanation:
      "Per [expr.call]p8, the initialization of each function parameter, including evaluation of its " +
      "argument expression, is *indeterminately sequenced* with respect to every other parameter's " +
      "initialization, not unsequenced. Indeterminately sequenced means each side effect runs to " +
      "completion strictly before or after the others (never interleaved), which is precisely what " +
      "rules out undefined behavior here; it only leaves unspecified *which* order they occur in. So " +
      "the three `++i` expressions each fully execute in some order, `i` deterministically ends at " +
      "`3`, but the value each particular `++i` produced (and therefore which of `1`, `2`, `3` gets " +
      "bound to `args`'s first, second, and third elements) depends entirely on that unspecified " +
      "evaluation order. The fold expression `(cout << ... << args)` then prints whatever `args` " +
      "ended up holding in a fixed left-to-right order, but which permutation that is isn't fixed " +
      "by the standard, only by the implementation's calling convention/ABI.",
    references: ["https://en.cppreference.com/w/cpp/language/eval_order"],
  },
  {
    id: "cpp-fold-expr-01",
    category: "cpp",
    difficulty: "hard",
    title: "Left fold vs. right fold over the same pack",
    tags: ["templates", "fold-expressions", "c++17"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

template <typename... Args>
auto leftFold(Args... args) {
    return (... - args);
}

template <typename... Args>
auto rightFold(Args... args) {
    return (args - ...);
}

int main() {
    std::cout << leftFold(1, 2, 3, 4) << " " << rightFold(1, 2, 3, 4) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "-8 -2",
        "-2 -8",
        "-8 -8",
        "Compile error: fold expressions require an explicit initial value for operator-",
      ],
      correctIndex: 0,
    },
    explanation:
      "A unary left fold `(... op pack)` expands, per [expr.prim.fold], to `(((E1 op E2) op E3) ... op " +
      "EN)`, left-associated. `leftFold(1,2,3,4)` therefore computes `((1 - 2) - 3) - 4 = ((-1) - 3) " +
      "- 4 = (-4) - 4 = -8`. A unary right fold `(pack op ...)` instead expands to `(E1 op (E2 op (... " +
      "op EN)))`, right-associated. `rightFold(1,2,3,4)` computes `1 - (2 - (3 - 4)) = 1 - (2 - (-1)) " +
      "= 1 - 3 = -2`. Because `-` is neither associative nor commutative, folding the exact same " +
      "operands with the exact same operator in the two directions produces genuinely different " +
      "results. Both spellings compile silently, and nothing about the syntax `... - args` vs. " +
      "`args - ...` visually screams \"these differ,\" making fold-direction a real footgun anytime " +
      "the folded operator isn't associative (unlike, say, `+` on integers, where direction is moot).",
    references: ["https://en.cppreference.com/w/cpp/language/fold"],
  },
  {
    id: "cpp-crtp-01",
    category: "cpp",
    difficulty: "hard",
    title: "sizeof(Derived) inside a CRTP base class",
    tags: ["templates", "crtp", "static-polymorphism", "incomplete-type"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstddef>

template <typename Derived>
struct Base {
    char buffer[sizeof(Derived)];
};

struct Derived : Base<Derived> {
    int payload;
};

int main() {}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compiles fine; buffer is sized to sizeof(Derived) once Derived is fully defined",
        "Compile error: invalid application of sizeof to the incomplete type Derived",
        "Compiles, but buffer has size 0",
        "Undefined behavior at runtime when Derived is constructed",
      ],
      correctIndex: 1,
    },
    explanation:
      "When `struct Derived : Base<Derived>` is defined, the compiler must instantiate `Base<Derived>` " +
      "to determine `Derived`'s base-class layout, and at that exact point, `Derived` itself is still " +
      "an incomplete type: its own class-specifier hasn't finished parsing yet. `sizeof` requires a " +
      "complete type ([expr.sizeof]), so `sizeof(Derived)` used inside `Base<Derived>`'s instantiation " +
      "is a hard compile error, not a deferred or lazily-resolved computation. This is the \"curiously " +
      "incomplete type\" trap inherent to CRTP: a CRTP base may freely declare pointers/references to " +
      "`Derived` and may call member functions on a `Derived*` from inside function *bodies* (those " +
      "are only instantiated on first use, by which point `Derived` is complete), but anything that " +
      "needs `Derived` to be complete right there in the base's own member declarations (`sizeof`, " +
      "a by-value `Derived` member, etc.) fails. That's why real CRTP bases stick to " +
      "`Derived*`/`Derived&` and defer all actual member access to deferred-instantiation function bodies.",
    references: ["https://en.cppreference.com/w/cpp/language/crtp"],
  },
  {
    id: "cpp-concepts-subsumption-01",
    category: "cpp",
    difficulty: "hard",
    title: "Overloads constrained by Integral and SignedIntegral",
    tags: ["concepts", "subsumption", "c++20", "overload-resolution"],
    type: "trace",
    prompt: "Compiled as C++20, what does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <concepts>
#include <iostream>

template <typename T>
concept Integral = std::integral<T>;

template <typename T>
concept SignedIntegral = Integral<T> && std::signed_integral<T>;

template <Integral T>
void f(T) { std::cout << "Integral\\n"; }

template <SignedIntegral T>
void f(T) { std::cout << "SignedIntegral\\n"; }

int main() {
    f(42);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Integral: the less-constrained overload wins",
        "Integral: it is declared first",
        "Compile error: ambiguous call to overloaded function f(42)",
        "SignedIntegral",
      ],
      correctIndex: 3,
    },
    explanation:
      "Both `f` overloads are viable, equally-good candidates for `f(42)` in every respect except their " +
      "constraints, so [temp.constr.order] breaks the tie via *subsumption*: a candidate whose " +
      "constraints are subsumed by another's is considered less specialized. `SignedIntegral<T>`'s " +
      "definition literally conjoins `Integral<T> && std::signed_integral<T>`, so, matching atomic " +
      "constraints syntactically as subsumption requires, `SignedIntegral<T>` subsumes `Integral<T>`, " +
      "making the `SignedIntegral` overload strictly more specialized. Partial ordering by constraints " +
      "therefore selects it over the `Integral` overload, printing \"SignedIntegral\" rather than " +
      "triggering ambiguity. Note subsumption is purely syntactic, not semantic: `SignedIntegral` only " +
      "subsumes `Integral` because it spells out `Integral<T>` as one of its own atomic constraints. " +
      "A differently-written concept that happened to accept exactly the same set of types would " +
      "*not* subsume anything and the call would instead be ambiguous.",
    references: ["https://en.cppreference.com/w/cpp/language/constraints#Partial_ordering_of_constraints"],
  },
  {
    id: "cpp-template-specialization-01",
    category: "cpp",
    difficulty: "hard",
    title: "An explicit specialization alongside a pointer overload",
    tags: ["templates", "specialization", "overload-resolution"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

template <typename T>
void f(T) { std::cout << "primary\\n"; }

template <>
void f<int>(int) { std::cout << "specialization<int>\\n"; }

template <typename T>
void f(T*) { std::cout << "pointer overload\\n"; }

int main() {
    int* p = nullptr;
    f(p);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "pointer overload",
        "specialization<int>",
        "primary",
        "Compile error: ambiguous call to overloaded function f",
      ],
      correctIndex: 0,
    },
    explanation:
      "Overload resolution operates over the set of function templates and non-template functions " +
      "visible at the call site, here `f(T)` and `f(T*)`, never over explicit specializations " +
      "directly; `template<> void f<int>(int)` doesn't introduce a new overload, it only supplies an " +
      "alternate definition for one particular instantiation of the *primary* template `f(T)`. For " +
      "`f(p)` with `p` an `int*`, both `f(T)` (deducing `T = int*`) and `f(T*)` (deducing `T = int`) " +
      "are viable, and partial ordering of function templates ([temp.func.order]) picks `f(T*)` as " +
      "strictly more specialized. Since `f(T)` was never selected for this call, the `int` " +
      "specialization of `f(T)` is entirely irrelevant here: the program prints \"pointer overload\", " +
      "not \"specialization<int>\". This is the classic reason explicit function-template " +
      "specialization is considered a footgun when mixed with overloading of the same name: " +
      "specializing a template doesn't compose with overload resolution the way many engineers assume.",
    references: ["https://en.cppreference.com/w/cpp/language/template_specialization"],
  },
  {
    id: "cpp-two-phase-lookup-01",
    category: "cpp",
    difficulty: "hard",
    title: "Dependent qualified names inside a function template",
    tags: ["templates", "two-phase-lookup", "dependent-names"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

template <typename T>
struct Container {
    using value_type = T;
    template <typename U>
    static void tag() { std::cout << "tag\\n"; }
};

template <typename T>
void run() {
    Container<T>::value_type v{};
    Container<T>::tag<int>();
}

int main() {
    run<int>();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compiles fine and prints tag",
        "Compile error only on the tag<int>() line; value_type is inferred as a type automatically",
        "Compile error: missing 'typename' before Container<T>::value_type, and missing 'template' before tag<int>",
        "Compile error only on the value_type line; tag<int>() parses correctly",
      ],
      correctIndex: 2,
    },
    explanation:
      "`T` is a template parameter, so `Container<T>` is a dependent type whose members cannot be " +
      "looked up until instantiation (phase two); during phase one (parsing), the compiler has no " +
      "idea whether `Container<T>::value_type` names a type or something else, so per [temp.res] it " +
      "defaults to assuming a dependent qualified name is *not* a type unless prefixed with " +
      "`typename`. Similarly, `Container<T>::tag` is a dependent name, so `Container<T>::tag<int>` is " +
      "by default parsed as `(Container<T>::tag) < int > (...)`, a less-than comparison, rather " +
      "than a template-id, unless disambiguated with the `template` keyword ([temp.names]) as " +
      "`Container<T>::template tag<int>`. Both omissions here are hard, unconditional compile errors " +
      "(not warnings), which is why generic library code is littered with `typename`/" +
      "`template` disambiguators the instant a dependent qualified name is used as a type or template.",
    references: ["https://en.cppreference.com/w/cpp/language/dependent_name"],
  },
  {
    id: "cpp-adl-01",
    category: "cpp",
    difficulty: "medium",
    title: "One name, two namespaces",
    tags: ["adl", "namespaces", "overload-resolution"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

namespace ns {
    struct Widget {};
    void process(Widget) { std::cout << "ns::process\\n"; }
}

void process(ns::Widget) { std::cout << "::process\\n"; }

int main() {
    ns::Widget w;
    process(w);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "::process",
        "ns::process",
        "Compile error: call to process(w) is ambiguous between ::process and ns::process",
        "Compile error: ns::process is not visible from main",
      ],
      correctIndex: 2,
    },
    explanation:
      "`process(w)` is an unqualified call, so its candidate set is the union of ordinary unqualified " +
      "lookup (which finds `::process`, visible in scope at the call site) and argument-dependent " +
      "lookup ([basic.lookup.argdep]), which additionally searches the namespaces associated with " +
      "each argument's type. Here `w`'s type is `ns::Widget`, so ADL silently adds `ns::process` to " +
      "the candidate set too, even though it was never named or `using`-declared in `main`. Both " +
      "`::process(ns::Widget)` and `ns::process(ns::Widget)` are exact, equally-good matches for the " +
      "call, and neither is more specialized than the other (unrelated, non-template functions with " +
      "identical parameter lists), so [over.match.best] cannot break the tie: the call is ambiguous, " +
      "a compile error, not a silent pick of one over the other. This is the ADL surprise that " +
      "bites when a codebase defines both a project-global utility function and a namespace-scoped " +
      "one with the same name and signature.",
    references: ["https://en.cppreference.com/w/cpp/language/adl"],
  },
  {
    id: "cpp-ctad-guide-01",
    category: "cpp",
    difficulty: "medium",
    title: "CTAD for a class template with an iterator-pair constructor",
    tags: ["ctad", "deduction-guides", "templates"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <vector>

template <typename T>
struct Wrapper {
    std::vector<T> data;
    template <typename Iter>
    Wrapper(Iter first, Iter last) : data(first, last) {}
};

int main() {
    std::vector<int> v = {1, 2, 3};
    Wrapper w(v.begin(), v.end());
    std::cout << w.data.size() << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "3",
        "Compile error: CTAD cannot deduce T for Wrapper",
        "0",
        "Compile error: Wrapper is not an aggregate and cannot use CTAD at all",
      ],
      correctIndex: 1,
    },
    explanation:
      "CTAD synthesizes an implicit deduction guide from each constructor by combining the class " +
      "template's own parameters with any additional constructor-template parameters; for `template" +
      "<typename Iter> Wrapper(Iter, Iter)`, the guide becomes `template<typename T, typename Iter> " +
      "Wrapper(Iter, Iter) -> Wrapper<T>`. `T` never appears anywhere in the constructor's parameter " +
      "types, only `Iter` does, so `T` sits in a non-deducible context for this guide: nothing in " +
      "the call `Wrapper(v.begin(), v.end())` lets the compiler infer what `T` should be. With no " +
      "other viable guide, class template argument deduction fails outright, a compile error, even " +
      "though the constructor body would work perfectly well if `T` could somehow be supplied. The " +
      "fix is a user-provided deduction guide, e.g. `template<typename Iter> Wrapper(Iter, Iter) -> " +
      "Wrapper<typename std::iterator_traits<Iter>::value_type>;`, which tells the compiler explicitly " +
      "how to compute `T` from `Iter`.",
    references: ["https://en.cppreference.com/w/cpp/language/class_template_argument_deduction"],
  },
  {
    id: "cpp-forwarding-ref-01",
    category: "cpp",
    difficulty: "hard",
    title: "T&& in a class template member vs. a function template",
    tags: ["templates", "forwarding-references", "reference-collapsing"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <utility>

template <typename T>
struct Holder {
    void set(T&& value) {   // T is fixed by the class template, NOT a deduced context here
        std::cout << "Holder::set(T&&)\\n";
    }
};

template <typename T>
void wrapper(T&& value) {   // forwarding reference (a deduced context)
    std::cout << "wrapper(T&&)\\n";
}

int main() {
    Holder<int> h;
    int x = 5;
    h.set(x);        // (1)
    wrapper(x);       // (2)
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints Holder::set(T&&) then wrapper(T&&)",
        "Compile error at h.set(x): rvalue reference to int cannot bind to lvalue x",
        "Prints wrapper(T&&) only; h.set(x) copies x into a temporary",
        "Compile error at wrapper(x): T&& cannot bind to an lvalue",
      ],
      correctIndex: 1,
    },
    explanation:
      "A parameter of type `T&&` is a forwarding reference only when `T` is deduced *for that specific " +
      "call*, i.e. `T` is a template parameter of the immediately-enclosing function template " +
      "([temp.deduct.call]p3). In `wrapper`, `T` is deduced fresh on every call, so `T&&` is a genuine " +
      "forwarding reference: for the lvalue argument `x` (type `int`), `T` deduces to `int&`, and " +
      "reference collapsing ([dcl.ref], `& + && -> &`) turns `T&&` = `int& &&` into `int&`, an " +
      "ordinary lvalue reference, which happily binds to `x`. In `Holder<T>::set`, by contrast, `T` " +
      "was already fixed when `Holder<int>` was instantiated. It is not a parameter of `set` itself, " +
      "so `T&&` inside `set` is just `int&&`, an ordinary rvalue reference with no deduction and no " +
      "collapsing involved. An rvalue reference cannot bind to the lvalue `x`, so `h.set(x)` is a hard " +
      "compile error, precisely why \"forwarding reference\" is a narrower, more precise term than " +
      "the older colloquial \"universal reference\": `T&&` only behaves specially when `T` is deduced " +
      "at that call.",
    references: ["https://en.cppreference.com/w/cpp/language/reference#Forwarding_references"],
  },
  {
    id: "cpp-virtual-inheritance-01",
    category: "cpp",
    difficulty: "medium",
    title: "Counting bases in a diamond",
    tags: ["virtual-inheritance", "multiple-inheritance", "object-layout"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

struct Base { int value = 1; };
struct Left : virtual Base {};
struct Right : virtual Base {};
struct Bottom : Left, Right {};

int main() {
    Bottom b;
    b.value = 42;
    std::cout << static_cast<Left&>(b).value << " "
              << static_cast<Right&>(b).value << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "42 42",
        "Compile error: b.value is ambiguous between Left::Base::value and Right::Base::value",
        "Compile error: Bottom must explicitly initialize the virtual base Base",
        "42 1",
      ],
      correctIndex: 0,
    },
    explanation:
      "Without `virtual`, `Bottom` would contain two independent `Base` subobjects (one via `Left`, " +
      "one via `Right`), making `b.value` ambiguous ([class.member.lookup]) and forcing explicit `b." +
      "Left::value` / `b.Right::value` disambiguation. Declaring `Left`/`Right`'s inheritance as " +
      "`virtual` changes the object model entirely: [class.mi] guarantees that however many paths " +
      "lead to a virtual base, the most-derived object (`Bottom`) contains exactly *one* shared `Base` " +
      "subobject, with `Left` and `Right` each holding an (implementation-defined) offset to that " +
      "single shared instance rather than embedding their own copy. `b.value` is therefore " +
      "unambiguous and names that one shared subobject's member; writing through it is visible " +
      "identically through both `static_cast<Left&>(b)` and `static_cast<Right&>(b)`, since both " +
      "ultimately resolve to the same `Base` subobject. This is the entire point of virtual " +
      "inheritance: it solves the diamond-problem duplication, at the cost of extra indirection.",
    references: ["https://en.cppreference.com/w/cpp/language/derived_class#Virtual_base_classes"],
  },
  {
    id: "cpp-dynamic-cast-01",
    category: "cpp",
    difficulty: "medium",
    title: "dynamic_cast from Left* to Right* in a diamond",
    tags: ["rtti", "dynamic_cast", "virtual-inheritance"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

struct Base { virtual ~Base() = default; };
struct Left : virtual Base {};
struct Right : virtual Base {};
struct Bottom : Left, Right {};

int main() {
    Bottom b;
    Left* l = &b;
    Right* r = dynamic_cast<Right*>(l);
    std::cout << (r != nullptr) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Undefined behavior: cross-casting through virtual inheritance is UB",
        "0: the cast fails at runtime",
        "Compile error: dynamic_cast cannot cross-cast between sibling base classes",
        "1",
      ],
      correctIndex: 3,
    },
    explanation:
      "`dynamic_cast` requires a polymorphic source type (at least one virtual function), which `Left` " +
      "satisfies here only because `Base` declares a virtual destructor that propagates through the " +
      "hierarchy. Given a polymorphic pointer, `dynamic_cast<Right*>(l)` doesn't check whether `Left` " +
      "statically derives from `Right` (it doesn't); it consults the runtime type information for " +
      "`l`'s actual, most-derived object (`Bottom`) and asks whether `Right` is one of *its* base " +
      "subobjects, a legal \"cross-cast,\" moving sideways within the same complete object rather " +
      "than strictly up or down one inheritance chain. Since `Bottom` does contain a `Right` " +
      "subobject, the cast succeeds at runtime and returns a valid, correctly-adjusted `Right*`, so " +
      "`r != nullptr` and the program prints `1`. `static_cast<Right*>(l)` would be ill-formed here " +
      "instead, since `Left` and `Right` aren't statically related. Cross-casting is exactly the " +
      "capability that requires RTTI and `dynamic_cast`.",
    references: ["https://en.cppreference.com/w/cpp/language/dynamic_cast"],
  },
  {
    id: "cpp-noexcept-move-01",
    category: "cpp",
    difficulty: "hard",
    title: "Two emplace_backs and one reallocation",
    tags: ["noexcept", "move-semantics", "vector", "exception-safety"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <vector>

struct Widget {
    Widget() = default;
    Widget(const Widget&) { std::cout << "copy "; }
    Widget(Widget&&) noexcept(false) { std::cout << "move "; }  // move ctor exists but is NOT noexcept
};

int main() {
    std::vector<Widget> v;
    v.reserve(1);
    v.emplace_back();
    v.emplace_back();  // triggers reallocation
    std::cout << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "copy",
        "move",
        "copy copy",
        "move move",
      ],
      correctIndex: 0,
    },
    explanation:
      "Reallocation must relocate every already-constructed element from the old buffer to the new " +
      "one, and the strong exception-safety guarantee documented for that operation ([vector." +
      "modifiers]) makes the choice of how delicate: `std::vector` uses `std::move_if_noexcept` rather " +
      "than an unconditional `std::move`, which only actually selects the move constructor if that " +
      "move constructor is `noexcept` (or if there is no usable copy constructor at all). Here `Widget" +
      "(Widget&&) noexcept(false)` is explicitly not noexcept, and a copy constructor is available, so " +
      "relocation of the one existing element falls back to copying it, printing \"copy\". The second " +
      "element is constructed directly in place in the new buffer by `emplace_back`, a fresh default " +
      "construction rather than a relocation, so it produces no \"copy\"/\"move\" output at all. This is the " +
      "practical reason to always mark move constructors `noexcept` when they truly can't throw: an " +
      "easily-overlooked missing `noexcept` silently downgrades every vector reallocation of that type " +
      "from O(1)-per-element moves to O(1)-per-element copies.",
    references: ["https://en.cppreference.com/w/cpp/utility/move_if_noexcept"],
  },
  {
    id: "cpp-placement-new-01",
    category: "cpp",
    difficulty: "hard",
    title: "Placement new twice into the same buffer",
    tags: ["placement-new", "std::launder", "object-lifetime", "c++17"],
    type: "trace",
    prompt: "What does this program print, or is it undefined behavior?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <new>

struct Widget {
    const int id;
    Widget(int i) : id(i) {}
};

int main() {
    alignas(Widget) unsigned char buffer[sizeof(Widget)];
    Widget* w1 = new (buffer) Widget(1);
    Widget* w2 = new (buffer) Widget(2);   // reuses the storage; ends w1's lifetime
    std::cout << w1->id << std::endl;       // accessing through the OLD pointer
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "2: w1 transparently refers to the new object",
        "Compile error: placement new cannot reuse storage still occupied by a live object",
        "1: the storage still holds the original object's value",
        "Undefined behavior: w1->id is read after the storage was reused",
      ],
      correctIndex: 3,
    },
    explanation:
      "[basic.life]p8 does permit a pointer to an object whose storage was reused by a new object of " +
      "the *same type* to be used, without `std::launder`, to name that new object, but that " +
      "exception explicitly excludes types containing `const`-qualified or reference-typed " +
      "subobjects. `Widget::id` is `const int`, so `Widget` fails this condition entirely; accessing " +
      "`w1->id` after `w2` was placement-new'd into the same buffer is undefined behavior, because the " +
      "compiler is permitted to assume `w1->id` still holds its *original* value `1`. A `const` " +
      "member's value is assumed immutable for its object's whole lifetime, and real compilers do " +
      "cache/const-fold reads through `w1` on exactly this assumption, even though the underlying " +
      "bytes now hold `2`. `std::launder` (C++17) exists precisely for this case: `*std::launder(w1)` " +
      "produces a pointer the compiler cannot assume aliases the dead object, forcing an honest read " +
      "of whatever currently occupies that storage; using `w2` directly works too, since it was never " +
      "tainted by the old object's const-ness assumptions.",
    references: ["https://en.cppreference.com/w/cpp/utility/launder"],
  },
  {
    id: "cpp-alignment-01",
    category: "cpp",
    difficulty: "medium",
    title: "Allocating an alignas(64) type with plain new",
    tags: ["alignment", "alignas", "operator-new", "c++17"],
    type: "trace",
    prompt: "Compiled as C++17 or later, what does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <cstdint>

struct alignas(64) CacheLine {
    int value;
};

int main() {
    CacheLine* p = new CacheLine{42};
    std::cout << (reinterpret_cast<std::uintptr_t>(p) % 64 == 0) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "1: new honors the alignas(64) requirement",
        "0: new only guarantees alignof(std::max_align_t)",
        "Compile error: alignas cannot exceed the platform's max_align_t",
        "Undefined behavior: over-aligned dynamic allocation is never guaranteed",
      ],
      correctIndex: 0,
    },
    explanation:
      "Before C++17, `operator new`'s guaranteed alignment was only `alignof(std::max_align_t)` " +
      "(commonly 16 on 64-bit platforms), so allocating a type with a larger `alignas` requirement via " +
      "plain `new` was technically unspecified, a real, frequently-hit portability trap for SIMD or " +
      "cache-line-aligned types. C++17 (P0035R4) fixed this at the language level: a `new`-expression " +
      "for a type whose alignment exceeds `__STDCPP_DEFAULT_NEW_ALIGNMENT__` now selects an overload " +
      "of `operator new` taking `std::align_val_t`, and the allocation function is required to honor " +
      "that alignment. `CacheLine` has `alignas(64)`, so `new CacheLine{42}` under C++17 is guaranteed " +
      "to return a pointer that's a multiple of 64, and the program reliably prints `1`. This is a " +
      "meaningful practical upgrade: before C++17, avoiding false sharing or satisfying SIMD alignment " +
      "for heap-allocated objects required a custom allocator; since C++17 plain `new`/`delete` handle " +
      "it correctly out of the box.",
    references: ["https://en.cppreference.com/w/cpp/memory/new/operator_new"],
  },
  {
    id: "cpp-type-punning-01",
    category: "cpp",
    difficulty: "hard",
    title: "Union type punning vs. std::bit_cast",
    tags: ["type-punning", "undefined-behavior", "bit_cast", "c++20"],
    type: "trace",
    prompt: "What does this program print, and is either function's approach undefined behavior?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <bit>
#include <cstdint>
#include <iostream>

float bitsToFloatUB(uint32_t bits) {
    union U { uint32_t i; float f; };
    U u;
    u.i = bits;
    return u.f;  // reading the non-active union member
}

float bitsToFloatWellDefined(uint32_t bits) {
    return std::bit_cast<float>(bits);
}

int main() {
    uint32_t bits = 0x3F800000;  // 1.0f in IEEE-754
    std::cout << bitsToFloatUB(bits) << " " << bitsToFloatWellDefined(bits) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "1 1: both approaches are well-defined in C++20",
        "Compile error: a union cannot mix uint32_t and float members",
        "1 1, but only bitsToFloatWellDefined is well-defined by the standard",
        "0 0: an inactive union member always reads as zero",
      ],
      correctIndex: 2,
    },
    explanation:
      "C++'s union-based type punning (write `u.i`, read `u.f`) is, strictly, undefined behavior. " +
      "[class.union.general] does not carve out the exception C11 does (6.5.2.3, which explicitly " +
      "permits reading through a different union member for compatible-layout purposes); in C++ it is " +
      "a widely-supported *implementation extension*, not a standard-sanctioned technique, so " +
      "`bitsToFloatUB` is UB even though GCC, Clang, and MSVC all implement it as a bytewise " +
      "reinterpretation matching programmer intent. `std::bit_cast<To>(from)` (C++20, `<bit>`) is the " +
      "standard's actual answer: given `sizeof(To) == sizeof(From)` and both trivially copyable, it " +
      "performs a well-defined, `constexpr`-capable bytewise reinterpretation with no UB and no " +
      "aliasing violation, conceptually a `memcpy`, unlike a `reinterpret_cast<float*>` dereference, " +
      "which violates the strict aliasing rule. On any conforming IEEE-754 platform both functions " +
      "produce the bit pattern for `1.0f` and print \"1 1\", but only one of the two paths is " +
      "standard-guaranteed to do so.",
    references: ["https://en.cppreference.com/w/cpp/numeric/bit_cast"],
  },
  {
    id: "cpp-odr-01",
    category: "cpp",
    difficulty: "hard",
    title: "One header, two different builds, one program",
    tags: ["odr", "translation-units", "undefined-behavior", "ifndr"],
    type: "trace",
    prompt:
      "Given these translation units, compiled and linked into one program, what happens when it runs?",
    snippet: {
      language: "cpp",
      filename: "util.h / a.cpp / b.cpp / main.cpp",
      code: `// --- util.h ---
inline int compute(int x) {
#ifdef FAST_BUILD
    return x * 2;
#else
    return x + x + 1;
#endif
}

// --- a.cpp ---
#define FAST_BUILD
#include "util.h"
int fromA() { return compute(10); }

// --- b.cpp ---
#include "util.h"     // FAST_BUILD not defined here
int fromB() { return compute(10); }

// --- main.cpp ---
#include <iostream>
int fromA();
int fromB();
int main() {
    std::cout << fromA() << " " << fromB() << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "20 21: each translation unit uses its own definition of compute",
        "Link error: duplicate symbol compute",
        "Compile error: compute is defined with two conflicting bodies",
        "Ill-formed, no diagnostic required: one definition is silently used for both calls",
      ],
      correctIndex: 3,
    },
    explanation:
      "`compute` is `inline`, which per [basic.def.odr] obligates every translation unit defining it to " +
      "use an *identical* definition; `a.cpp` and `b.cpp` violate this because `FAST_BUILD` makes the " +
      "two TUs see genuinely different bodies. Because cross-translation-unit ODR violations generally " +
      "can't be detected during compilation (each TU is self-consistent in isolation) or, typically, at " +
      "link time (inline function definitions are usually emitted into a COMDAT-like section, and the " +
      "linker just discards all-but-one duplicate without comparing contents), the standard classifies " +
      "this as \"ill-formed, no diagnostic required\": no error or warning is owed, despite the " +
      "program's behavior being technically undefined. In practice the linker keeps exactly one of the " +
      "two definitions (often whichever object file it processes first, which is toolchain- and build-order-" +
      "dependent) and both `fromA()` and `fromB()` end up calling that single merged definition, so " +
      "the program is far more likely to print `20 20` or `21 21` than the intuitively-expected `20 " +
      "21`. This is a classic real-world bug wherever a macro or feature flag silently changes an " +
      "inline/template function's definition across a shared header.",
    references: ["https://en.cppreference.com/w/cpp/language/definition"],
  },
  {
    id: "cpp-name-hiding-01",
    category: "cpp",
    difficulty: "medium",
    title: "A derived-class function with the same name as base overloads",
    tags: ["name-hiding", "overload-resolution", "inheritance"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <string>

struct Base {
    void greet() { std::cout << "Base::greet()\\n"; }
    void greet(int n) { std::cout << "Base::greet(int)\\n"; }
};

struct Derived : Base {
    void greet(const std::string& name) { std::cout << "Derived::greet(string)\\n"; }
};

int main() {
    Derived d;
    d.greet(5);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Base::greet(int)",
        "Base::greet()",
        "Compile error: 5 cannot be converted to const std::string&",
        "Derived::greet(string)",
      ],
      correctIndex: 2,
    },
    explanation:
      "When `Derived` declares any member function named `greet`, that declaration *hides* every " +
      "member named `greet` in `Base`, regardless of parameter list. Name lookup ([basic.scope." +
      "hiding], [class.member.lookup]) resolves the name `greet` to whichever scope first contains a " +
      "declaration of that name and stops there; it does not merge overload sets across a derived/base " +
      "boundary the way ordinary same-scope overloading does. So `d.greet(5)` only ever considers " +
      "`Derived::greet(const std::string&)`. `Base::greet(int)`, otherwise a perfect match, is never " +
      "even a candidate. `int` has no implicit conversion to `std::string` (there is no `std::string" +
      "(int)` constructor), so overload resolution fails outright: a compile error, not a silent call " +
      "to the \"wrong\" function. The standard fix is a `using Base::greet;` declaration inside " +
      "`Derived`, which pulls the base overload set into `Derived`'s scope to participate alongside " +
      "the derived overloads.",
    references: ["https://en.cppreference.com/w/cpp/language/using_declaration"],
  },
  {
    id: "cpp-atomic-shared-ptr-01",
    category: "cpp",
    difficulty: "medium",
    title: "One global shared_ptr, two threads",
    tags: ["shared_ptr", "atomics", "concurrency", "c++20"],
    type: "trace",
    prompt:
      "Two threads share a single global std::shared_ptr<Widget> g_ptr (not std::atomic<shared_ptr<" +
      "Widget>>, just a plain shared_ptr<Widget>). One thread runs `g_ptr = std::make_shared<Widget>" +
      "(...)` to publish a new value; the other concurrently runs `Widget copy = *g_ptr;` to read the " +
      "current one, with no external synchronization (mutex, atomic wrapper, etc.). Is this safe?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: the reference count is always updated atomically",
        "No: concurrent read and write of the same shared_ptr object is a data race",
        "No: a shared_ptr can never be shared across threads at all",
        "Yes, provided Widget's own constructor is thread-safe",
      ],
      correctIndex: 1,
    },
    explanation:
      "`std::shared_ptr`'s thread-safety guarantee ([util.smartptr.shared]) is narrower than it sounds: " +
      "only the *reference-count* increments/decrements are atomic, so two *different* `shared_ptr` " +
      "instances that happen to share a control block can safely be copied/destroyed concurrently from " +
      "different threads. But `g_ptr = ...` and `*g_ptr` here are reading and writing *the same " +
      "`shared_ptr` object* concurrently. That object's internal (pointer, control-block-pointer) " +
      "pair is not itself protected by any atomicity guarantee, so this is an ordinary, unsynchronized " +
      "concurrent read/write of shared memory: a data race, undefined behavior, no different in kind " +
      "from racing on a plain `int`. Before C++20, the sanctioned fix was the free functions `std::" +
      "atomic_load`/`std::atomic_store` (and `_explicit` variants) operating on a `shared_ptr*`; C++20 " +
      "formalizes this as `std::atomic<std::shared_ptr<T>>`, giving genuine atomic load/store/exchange/" +
      "compare-exchange on the whole `shared_ptr` value with no race.",
    references: ["https://en.cppreference.com/w/cpp/memory/shared_ptr/atomic2"],
  },
  {
    id: "cpp-coroutine-eager-01",
    category: "cpp",
    difficulty: "medium",
    title: "A coroutine with a suspend_never initial_suspend",
    tags: ["coroutines", "c++20", "suspension"],
    type: "trace",
    prompt: "Compiled as C++20, what does this program print (and in what order)?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <coroutine>
#include <iostream>

struct Task {
    struct promise_type {
        Task get_return_object() { return {}; }
        std::suspend_never initial_suspend() { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        void return_void() {}
        void unhandled_exception() {}
    };
};

Task greet() {
    std::cout << "before suspend\\n";
    co_await std::suspend_always{};
    std::cout << "after suspend\\n";
}

int main() {
    std::cout << "calling greet()\\n";
    Task t = greet();
    std::cout << "back in main\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "calling greet()\\nback in main\\nbefore suspend\\nafter suspend",
        "calling greet()\\nbefore suspend\\nback in main",
        "calling greet()\\nbefore suspend\\nafter suspend\\nback in main",
        "calling greet()\\nback in main",
      ],
      correctIndex: 1,
    },
    explanation:
      "`initial_suspend()` returning `std::suspend_never` means its `await_ready()` returns `true`, so " +
      "the coroutine's very first suspension point is skipped: the body starts running *eagerly, " +
      "synchronously*, inside the call `greet()` itself, before `greet()` ever returns control to its " +
      "caller. Execution proceeds through \"before suspend\" and reaches the *explicit* `co_await std" +
      "::suspend_always{}`, whose `await_ready()` is `false`, so this genuinely suspends the coroutine " +
      "and returns control to `main` right there. The call expression `greet()` finishes evaluating " +
      "(producing the `Task`) immediately after that suspension, not after the coroutine finishes. " +
      "\"back in main\" then prints. Because `Task::get_return_object` discards the `coroutine_handle` " +
      "entirely (returns a bare `Task{}`), nothing ever calls `.resume()` on the suspended coroutine, " +
      "so \"after suspend\" never prints and the frame is abandoned for the rest of the program. This " +
      "illustrates both the eager-vs-lazy-start distinction controlled by `initial_suspend` and the " +
      "real danger of discarding a coroutine's handle.",
    references: ["https://en.cppreference.com/w/cpp/language/coroutines"],
  },
  {
    id: "cpp-ranges-dangling-01",
    category: "cpp",
    difficulty: "hard",
    title: "Returning a filter view from a function taking const vector&",
    tags: ["ranges", "views", "dangling", "c++20"],
    type: "trace",
    prompt: "Compiled as C++20, what happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <ranges>
#include <vector>

auto evens(const std::vector<int>& v) {
    return v | std::views::filter([](int n) { return n % 2 == 0; });
}

int main() {
    auto view = evens({2, 4, 6, 7, 8});  // temporary vector bound to const&
    for (int n : view) std::cout << n << " ";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "2 4 6 8",
        "Undefined behavior: the returned view references a destroyed temporary",
        "Compile error: a braced-init-list cannot bind to a const std::vector<int>&",
        "(empty output)",
      ],
      correctIndex: 1,
    },
    explanation:
      "`v | std::views::filter(pred)` for an lvalue range `v` composes a `filter_view` that internally " +
      "stores a `ref_view<const std::vector<int>>`, i.e. the view holds a *reference* to `v`, not a " +
      "copy of its elements, in keeping with the \"views are cheap to copy, non-owning\" philosophy of " +
      "C++20 ranges ([range.filter]). The temporary `std::vector<int>{2,4,6,7,8}` in `evens({2,4,6,7," +
      "8})` is bound to the function *parameter* `v`, and, as with any temporary bound to a reference " +
      "parameter rather than directly at a reference's point of declaration, no lifetime extension " +
      "applies; it's destroyed at the end of the full expression, i.e. once `evens(...)` returns. The " +
      "`filter_view` returned by `evens` therefore already references a destroyed `std::vector` by the " +
      "time it's stored in `main`'s `view`, and iterating it in the range-`for` loop dereferences a " +
      "dangling reference: undefined behavior, the same bug as returning a dangling reference except " +
      "now hidden behind range-adaptor composition, where nothing about `v | views::filter(pred)` " +
      "visually suggests a reference is being captured.",
    references: ["https://en.cppreference.com/w/cpp/ranges/filter_view"],
  },
  {
    id: "cpp-bitfield-01",
    category: "cpp",
    difficulty: "medium",
    title: "sizeof a struct of three 3-bit bit-fields",
    tags: ["bit-fields", "implementation-defined", "layout"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

struct Flags {
    unsigned char a : 3;
    unsigned char b : 3;
    unsigned char c : 3;
};

int main() {
    std::cout << sizeof(Flags) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Always exactly 2: bit-fields are packed as tightly as possible",
        "Implementation-defined: the standard does not fix how bit-fields are packed",
        "Always exactly 3: one full byte is allocated per bit-field",
        "Compile error: bit-field width must evenly divide the underlying type's size",
      ],
      correctIndex: 1,
    },
    explanation:
      "[class.bit] leaves the allocation of bit-fields to storage units largely implementation-defined: " +
      "whether adjacent bit-fields are packed into the same underlying storage unit, whether a bit-" +
      "field may straddle an alignment boundary, and how much padding (if any) separates or follows " +
      "them are all left to the implementation/ABI, not fixed by the language. Three 3-bit fields need " +
      "only 9 bits, and on most mainstream ABIs (Itanium C++ ABI, used by GCC/Clang) they do pack into " +
      "2 bytes (`sizeof(Flags) == 2`), but nothing in the standard *requires* that outcome. A " +
      "conforming implementation could allocate a full byte per bit-field, refuse to let a bit-field " +
      "span byte boundaries, or add trailing padding, all without violating any rule. This is " +
      "why bit-fields are useful for expressing intent (\"I only need 3 bits here\") but are not a " +
      "portable tool for controlling exact memory layout across compilers/platforms.",
    references: ["https://en.cppreference.com/w/cpp/language/bit_field"],
  },
  {
    id: "cpp-mi-pointer-adjust-01",
    category: "cpp",
    difficulty: "hard",
    title: "Upcasting to the second base under multiple inheritance",
    tags: ["multiple-inheritance", "pointer-adjustment", "static_cast"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

struct A { int a = 1; };
struct B { int b = 2; };
struct C : A, B { int c = 3; };

int main() {
    C obj;
    C* pc = &obj;
    B* pb = pc;                     // implicit upcast
    void* rawA = static_cast<void*>(pc);
    void* rawB = static_cast<void*>(pb);
    std::cout << (rawA == rawB) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "1: pb and pc both denote the same complete object obj",
        "Compile error: cannot implicitly convert C* to B* in a multiply-inherited class",
        "0: the conversion adjusts the pointer to the B subobject's own address",
        "Undefined behavior: pb is left uninitialized because B is not C's first base",
      ],
      correctIndex: 2,
    },
    explanation:
      "In a class with multiple, non-virtual base classes, the compiler lays the base subobjects out " +
      "sequentially, with `A` first (so `C*` and `A*` to the same object are typically numerically " +
      "equal, since `A` is `C`'s first base), followed by `B`, followed by `C`'s own members. " +
      "Converting `C*` to `B*` (even implicitly, as in `B* pb = pc;`) is required by [expr.static." +
      "cast]/[conv.ptr] to yield a pointer to the *actual* `B` subobject, which lives at an offset " +
      "(commonly `sizeof(A)`, though the exact figure is implementation-defined) from the start of the " +
      "complete object. The compiler silently *adjusts* the pointer's numeric value during this " +
      "conversion, not merely relabeling the same address the way an upcast to the first base would. " +
      "`pc` and `pb` therefore hold genuinely different addresses despite denoting subobjects of the " +
      "same `obj`, so casting both to `void*` (which preserves whatever address each pointer currently " +
      "holds, per [expr.static.cast]) yields two different values, printing `0`. This pointer-" +
      "adjustment mechanic is exactly what makes multiple inheritance more expensive than single " +
      "inheritance at the ABI level.",
    references: ["https://en.cppreference.com/w/cpp/language/static_cast"],
  },
  {
    id: "cpp-constinit-01",
    category: "cpp",
    difficulty: "easy",
    title: "Incrementing a constinit global",
    tags: ["constinit", "constexpr", "const", "c++20", "static-initialization"],
    type: "trace",
    prompt: "Compiled as C++20, what does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

constinit int counter = 10;

void increment() {
    counter += 1;    // (1)
}

int main() {
    increment();
    std::cout << counter << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "11",
        "Compile error at (1): counter cannot be modified after initialization",
        "10: constinit variables live in read-only memory",
        "Compile error: constinit requires the variable to also be declared const or constexpr",
      ],
      correctIndex: 0,
    },
    explanation:
      "`constinit` (C++20) is purely an initialization-time guarantee, not a mutability constraint: it " +
      "requires a variable with static or thread storage duration to be initialized with a constant " +
      "expression, forcing static (compile/link-time) initialization and eliminating any possibility " +
      "of that variable being subject to the dynamic-initialization-order fiasco ([basic.start." +
      "static]), but the resulting variable is otherwise an entirely ordinary, mutable `int`. This is " +
      "distinct from both `const` (fixes the value for the object's lifetime but says nothing about " +
      "*when* initialization happens) and `constexpr` (implies `const` and additionally requires the " +
      "variable to be usable in constant expressions itself). Since `counter` is not `const`, " +
      "`increment()`'s `counter += 1;` is a completely ordinary, legal mutation, and the program prints " +
      "`11`. The practical use case for `constinit` is exactly this: a genuinely mutable global/static " +
      "that must never be subject to dynamic-initialization-order surprises, e.g. a counter or flag " +
      "read very early during program startup, before `main` runs.",
    references: ["https://en.cppreference.com/w/cpp/language/constinit"],
  },
  {
    id: "cpp-false-sharing-01",
    category: "cpp",
    difficulty: "hard",
    title: "Two counters in one struct",
    tags: ["false-sharing", "atomic", "cache-line", "concurrency", "performance"],
    type: "trace",
    prompt:
      "Two threads run concurrently, each hammering a different atomic counter " +
      "in the same struct on separate CPU cores. What is true about this program?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <atomic>
#include <thread>

struct Counters {
    std::atomic<long> a{0};
    std::atomic<long> b{0};   // (1) adjacent to 'a', no padding between them
};

Counters counters;

void bumpA() {
    for (long i = 0; i < 100'000'000; ++i)
        counters.a.fetch_add(1, std::memory_order_relaxed);
}

void bumpB() {
    for (long i = 0; i < 100'000'000; ++i)
        counters.b.fetch_add(1, std::memory_order_relaxed);
}

int main() {
    std::thread t1(bumpA);
    std::thread t2(bumpB);
    t1.join();
    t2.join();
    // counters.a == counters.b == 100'000'000, always
}`,
      highlightLines: [5, 6],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Data race: reading counters.a and counters.b from different threads without a mutex is undefined behavior",
        "Compile error: two std::atomic members cannot be declared adjacently in the same struct",
        "The final values are always correct, but the program runs far slower than with 'a' and 'b' on separate cache lines",
        "The final values are correct, and separating 'a' and 'b' would not change the runtime",
      ],
      correctIndex: 2,
    },
    explanation:
      "Each `std::atomic<long>` operation here is individually correct and race-free by " +
      "definition: `std::atomic` provides synchronization, so there is no data race and no " +
      "UB. `sizeof(Counters)` is only 16 bytes (two 8-byte `atomic<long>`s with no padding " +
      "between them), so `a` and `b` almost always land in the *same* 64-byte cache line. " +
      "Under the MESI(-like) cache-coherence protocol, a core must gain exclusive ownership " +
      "of a cache line before writing to it. Even though thread 1 only ever touches `a` and " +
      "thread 2 only ever touches `b`, every `fetch_add` on either field invalidates the " +
      "*whole line* in the other core's cache, forcing a coherence transaction (RFO: read " +
      "for ownership) before the next access can proceed. The two cores end up ping-ponging " +
      "ownership of that one cache line back and forth on every single increment, even " +
      "though there is no logical sharing of data at all. This is false sharing: correctness " +
      "is untouched, but throughput can drop by an order of magnitude or more versus the " +
      "same code with `a` and `b` on separate cache lines (e.g. via `alignas(64)` padding). " +
      "This is a classic, extremely common performance bug in concurrent counter/statistics " +
      "structures.",
    references: [
      "https://en.cppreference.com/w/cpp/atomic/atomic",
      "https://en.wikipedia.org/wiki/False_sharing",
    ],
  },
  {
    id: "cpp-struct-padding-01",
    category: "cpp",
    difficulty: "medium",
    title: "Two structs, same three members",
    tags: ["alignment", "padding", "sizeof", "struct-layout"],
    type: "trace",
    prompt:
      "On a typical x86-64 target (8-byte-aligned double, 4-byte-aligned int, " +
      "no #pragma pack), what does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

struct A {
    char c;    // (1)
    double d;
    int i;
};

struct B {
    double d;  // (2)
    int i;
    char c;
};

int main() {
    std::cout << sizeof(A) << " " << sizeof(B) << std::endl;
}`,
      highlightLines: [4, 10],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "13 13",
        "16 16",
        "24 24",
        "24 16",
      ],
      correctIndex: 3,
    },
    explanation:
      "C++ lays out members in declaration order and inserts padding so each member " +
      "satisfies its own alignment (it may *not* reorder members; that would break " +
      "compatibility with C and with `offsetof`/reinterpret patterns). In `A`: `char c` " +
      "takes offset 0 (1 byte), but `double d` needs 8-byte alignment, so 7 padding bytes " +
      "are inserted before it (offset 8..15); `int i` follows at offset 16..19 (naturally " +
      "aligned since 16 is a multiple of 4); the whole struct's size must then be rounded " +
      "up to a multiple of its strictest member alignment (8, from `double`), so 4 trailing " +
      "padding bytes are added after `i`, giving `sizeof(A) == 1 + 7 + 8 + 4 + 4 == 24`. In " +
      "`B`, putting the largest-alignment member first avoids the internal gap: `double d` " +
      "at offset 0..7, `int i` at offset 8..11 (already aligned), `char c` at offset 12 (1 " +
      "byte), and only 3 trailing padding bytes are needed to round the total up to a " +
      "multiple of 8, giving `sizeof(B) == 8 + 4 + 1 + 3 == 16`. Same three members, same " +
      "total 'useful' bytes (13), but reordering from worst-to-best alignment to " +
      "best-to-worst alignment saves 8 bytes per instance here, a well-known technique for " +
      "shrinking hot data structures and improving cache-line utilization at scale.",
    references: [
      "https://en.cppreference.com/w/cpp/language/object#Alignment",
      "https://en.cppreference.com/w/c/language/struct#Padding_and_offsets",
    ],
  },
  {
    id: "cpp-ebo-01",
    category: "cpp",
    difficulty: "hard",
    title: "Empty struct, base or member",
    tags: ["ebo", "empty-base-optimization", "sizeof", "inheritance"],
    type: "trace",
    prompt:
      "On a typical x86-64 target, what does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

struct Empty {};   // no members

struct WithEmptyBase : Empty {   // (1) Empty inherited as a base class
    int x;
};

struct WithEmptyMember {         // (2) Empty stored as an ordinary data member
    Empty e;
    int x;
};

int main() {
    std::cout << sizeof(WithEmptyBase) << " " << sizeof(WithEmptyMember) << std::endl;
}`,
      highlightLines: [5, 9],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "4 4",
        "8 8",
        "5 8",
        "4 8",
      ],
      correctIndex: 3,
    },
    explanation:
      "`sizeof` of any complete object type must be at least 1, so a *standalone* `Empty` " +
      "has `sizeof(Empty) == 1`. But the C++ standard explicitly permits (and every major " +
      "compiler implements) the Empty Base Optimization (EBO): a base class subobject with " +
      "no data members and no virtual functions can be laid out to take zero additional " +
      "space, *as long as* it doesn't alias another subobject of the same type at the same " +
      "address (the standard only requires distinct objects to have distinct addresses). " +
      "`WithEmptyBase` therefore has the same layout as a plain `struct { int x; }`: just " +
      "the 4 bytes for `x`, so `sizeof(WithEmptyBase) == 4`. EBO applies only to *base " +
      "classes*, not to ordinary data members: a member subobject is a distinct object " +
      "that still needs its own address and must occupy at least 1 byte, so `Empty e` in " +
      "`WithEmptyMember` costs 1 byte, and then 3 bytes of padding are inserted before `x` " +
      "to satisfy `int`'s 4-byte alignment, giving `sizeof(WithEmptyMember) == 1 + 3 + 4 == " +
      "8`. This asymmetry is exactly why library authors (e.g. for a custom allocator or a " +
      "comparator stored inside a container) deliberately inherit from an empty policy " +
      "class instead of storing it as a member, when they want to avoid paying for it in " +
      "`sizeof`.",
    references: [
      "https://en.cppreference.com/w/cpp/language/ebo",
    ],
  },
  {
    id: "cpp-unsigned-loop-underflow-01",
    category: "cpp",
    difficulty: "medium",
    title: "Counting down with an unsigned index",
    tags: ["size_t", "unsigned-integer", "underflow", "undefined-behavior", "loops"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <vector>
#include <iostream>

int main() {
    std::vector<int> v = {10, 20, 30};

    for (std::size_t i = v.size() - 1; i >= 0; --i) {  // (1)
        std::cout << v[i] << " ";
    }
}`,
      highlightLines: [7],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints \"30 20 10 \" and stops cleanly once i reaches 0",
        "Infinite loop, but i stays within [0, v.size()), so nothing out of bounds is read",
        "Prints \"30 20 10 \", then indexes far out of bounds once i wraps to SIZE_MAX: undefined behavior",
        "Compile error: comparing size_t to the signed literal 0 is ill-formed",
      ],
      correctIndex: 2,
    },
    explanation:
      "`std::size_t` is an unsigned integer type, so for *every* value it can hold, `i >= 0` " +
      "is trivially true, so the comparison can never terminate the loop (compilers with " +
      "`-Wall`/`-Wextra` even warn: 'comparison of unsigned expression >= 0 is always " +
      "true'). The loop correctly prints `30 20 10` while `i` is 2, 1, 0, but the *next* " +
      "`--i` on `i == 0` doesn't produce -1: `size_t` has no negative values, so the " +
      "result wraps around modulo 2^64 to `SIZE_MAX` (18446744073709551615 on a typical " +
      "64-bit target). The loop condition is still true, so execution continues indexing " +
      "`v[SIZE_MAX]`, `v[SIZE_MAX - 1]`, and so on, wildly out-of-bounds reads through " +
      "`operator[]` (which does not bounds-check), which is undefined behavior. In practice " +
      "this typically manifests as printing a long stream of garbage values as it walks " +
      "backward through unrelated process memory, and eventually crashing with a " +
      "segmentation fault once it reaches unmapped memory (verified: this program printed " +
      "'30 20 10' followed by thousands of garbage integers before being killed). Note that " +
      "this bug is even worse if `v` is empty: `v.size() - 1` underflows to `SIZE_MAX` " +
      "*before the loop even starts*. The standard fix is to iterate with a signed type, " +
      "use reverse iterators (`v.rbegin()`/`v.rend()`), or restructure as `for (size_t i = " +
      "v.size(); i-- > 0; )`.",
    references: [
      "https://en.cppreference.com/w/cpp/types/size_t",
      "https://en.cppreference.com/w/cpp/language/implicit_conversion#Integral_conversions",
    ],
  },
  {
    id: "cpp-pointer-past-end-01",
    category: "cpp",
    difficulty: "hard",
    title: "One-past-the-end vs. two-past-the-end pointer arithmetic",
    tags: ["pointer-arithmetic", "undefined-behavior", "arrays"],
    type: "trace",
    prompt:
      "Which statement correctly describes the well-defined-ness of forming and using " +
      "these pointers?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int arr[4] = {10, 20, 30, 40};

int* p_end   = arr + 4;   // (1) one-past-the-end
int* p_past  = arr + 5;   // (2) two-past-the-end

bool cmp  = (p_end == arr + 4);  // (3)
int  bad1 = *p_end;              // (4)
int  bad2 = *p_past;             // (5)`,
      highlightLines: [3, 4, 6, 7, 8],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "All five lines are well-defined as long as nothing is written through the pointers",
        "Only line 5 (*bad2) is undefined behavior; forming and dereferencing p_end is fine",
        "Line 2 is already undefined behavior before any dereference, and lines 4 and 5 are too; only lines 1 and 3 are fine",
        "Compile error: pointer arithmetic past the last element is rejected at compile time",
      ],
      correctIndex: 2,
    },
    explanation:
      "The standard grants array pointer arithmetic a narrow special case: for an array of " +
      "N elements, computing a pointer to one-past-the-end (`arr + N`, here `arr + 4`) is " +
      "well-defined to *form*, and it may be *compared* against other pointers into the " +
      "array (that's what makes `for (p = begin; p != end; ++p)` legal), but it may never " +
      "be *dereferenced*. So line 1 and line 3 are fine, but line 4 (`*p_end`) is undefined " +
      "behavior. Line 2 goes a step further: computing `arr + 5` (two past the end) is " +
      "undefined behavior the moment the pointer arithmetic is performed, regardless of " +
      "whether the result is ever used or dereferenced; the standard simply does not define " +
      "the behavior of pointer arithmetic that produces an address further than one past " +
      "the last element (or before the first element). Line 5 compounds this with an " +
      "additional dereference of an already-UB pointer. This distinction (one-past-the-end " +
      "is a first-class, well-defined 'sentinel' pointer value, but nothing beyond it is " +
      "even safe to *compute*) is exactly why standard-library algorithms are built around " +
      "`[begin, end)` half-open ranges and never form or expect an `end + 1` iterator.",
    references: [
      "https://en.cppreference.com/w/cpp/language/expressions#Pointer_arithmetic",
      "https://eel.is/c++draft/expr.add",
    ],
  },
  {
    id: "cpp-strict-aliasing-01",
    category: "cpp",
    difficulty: "hard",
    title: "Reading a float through an int*",
    tags: ["strict-aliasing", "reinterpret_cast", "undefined-behavior", "optimization"],
    type: "trace",
    prompt:
      "Compiled with optimizations enabled (e.g. -O2), what does this program most likely print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

int bumpAndRead(float* f, int* i) {
    *i = 0;       // (1) write through int*
    *f = 3.14f;   // (2) write through float* to the SAME address
    return *i;    // (3) re-read through int*
}

int main() {
    float value = 1.0f;
    int* asInt = reinterpret_cast<int*>(&value);  // (4) unrelated-type alias
    std::cout << bumpAndRead(&value, asInt) << std::endl;
}`,
      highlightLines: [4, 5, 6, 11],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "1078523331: *i observes the bit pattern of 3.14f, as guaranteed by the standard",
        "Compile error: reinterpret_cast cannot convert between float* and int*",
        "3: *i is truncated to the integer value of 3.14f",
        "0: the store through f is assumed not to affect *i, so the return is constant-folded",
      ],
      correctIndex: 3,
    },
    explanation:
      "The strict aliasing rule (`[basic.lval]`) says an object may only be accessed through " +
      "a glvalue of its own type (or a handful of exceptions like `char`/`unsigned char`/" +
      "`std::byte`). Here `value` has type `float`, but `asInt` is a `int*` obtained via " +
      "`reinterpret_cast`. Accessing `value` through `*asInt` (i.e. through parameter `i`) " +
      "is a strict-aliasing violation, and the *cast itself* is well-defined but *using* the " +
      "resulting pointer to access the `float` object as an `int` is undefined behavior. The " +
      "practical danger is exactly what strict aliasing exists to enable: the optimizer is " +
      "allowed to assume `f` and `i` cannot point into the same storage, so it may reorder or " +
      "eliminate loads/stores as if they were independent. In `bumpAndRead`, that license lets " +
      "the compiler conclude the store `*f = 3.14f` cannot possibly change what `*i` reads, so " +
      "it can constant-propagate the `0` written on line 1 straight through to the `return`, " +
      "never re-reading memory at all. Verified directly: compiled at `-O0` (no such " +
      "optimization applied) this program prints `1078523331`: the actual bit pattern of " +
      "`3.14f` reinterpreted as `int`, matching a naive 'the pointers really do alias' mental " +
      "model; compiled at `-O2`, it prints `0`; and rebuilding at `-O2 -fno-strict-aliasing` " +
      "restores `1078523331`. Both outputs are 'correct' in the sense that undefined behavior " +
      "permits any result; the point is that the program's meaning silently changes across " +
      "optimization levels, which is precisely why `reinterpret_cast`-based type punning is " +
      "a landmine in real numerical/bit-twiddling code (the classic historical example being " +
      "Quake's fast inverse square root).",
    references: [
      "https://en.cppreference.com/w/cpp/language/reinterpret_cast",
      "https://en.cppreference.com/w/cpp/language/object#Strict_aliasing",
    ],
  },
  {
    id: "cpp-cache-line-padding-01",
    category: "cpp",
    difficulty: "medium",
    title: "Four alignas(64) counters in a row",
    tags: ["alignas", "cache-line", "false-sharing", "sizeof", "performance"],
    type: "trace",
    prompt: "On a typical x86-64 target with 64-byte cache lines, what does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <atomic>
#include <iostream>

struct alignas(64) PaddedCounter {   // (1) force cache-line alignment + size
    std::atomic<long> value{0};
};

PaddedCounter counters[4];           // (2) each counter gets its own line

int main() {
    std::cout << sizeof(PaddedCounter) << " "
              << sizeof(counters)     << " "
              << (reinterpret_cast<char*>(&counters[1])
                  - reinterpret_cast<char*>(&counters[0]))
              << std::endl;
}`,
      highlightLines: [4, 8],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "8 32 8",
        "64 64 0",
        "Compile error: alignas cannot be combined with a class containing a std::atomic member",
        "64 256 64",
      ],
      correctIndex: 3,
    },
    explanation:
      "`alignas(64)` on `PaddedCounter` sets its *alignment requirement* to 64, and the " +
      "language rule that every array element must satisfy that same alignment forces the " +
      "compiler to round the type's *size* up to a multiple of 64 as well (otherwise " +
      "`counters[1]` couldn't also start at a 64-byte boundary). `std::atomic<long>` " +
      "contributes only 8 live bytes, so the remaining 56 bytes of each `PaddedCounter` are " +
      "pure trailing padding: `sizeof(PaddedCounter) == 64` (verified by compilation). With " +
      "`PaddedCounter counters[4]`, each element therefore occupies a full cache line and " +
      "the whole array is `sizeof(counters) == 64 * 4 == 256` bytes, with consecutive " +
      "elements exactly 64 bytes apart, confirmed by the pointer-difference computation, " +
      "which prints `64`. The upshot: if four threads each hammer `counters[k].value` for a " +
      "different `k`, no two threads' counters can ever land in the same cache line, " +
      "eliminating the false-sharing / MESI-invalidation ping-pong that would occur if the " +
      "four atomics were packed tightly (e.g. in a plain `std::atomic<long> counters[4]`, " +
      "which would pack 8 counters per 64-byte line). The cost is real: 8x the memory " +
      "footprint for this array, which is the classic space/throughput tradeoff of padding " +
      "for cache-line isolation.",
    references: [
      "https://en.cppreference.com/w/cpp/language/alignas",
      "https://en.cppreference.com/w/cpp/language/object#Alignment",
    ],
  },
  {
    id: "cpp-span-dangling-01",
    category: "cpp",
    difficulty: "hard",
    title: "A std::span over a vector, followed by push_backs",
    tags: ["span", "vector", "iterator-invalidation", "lifetime", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <vector>
#include <span>
#include <iostream>

int main() {
    std::vector<int> v = {1, 2, 3};
    std::span<int> s(v);              // (1) view over v's current buffer

    for (int i = 0; i < 20; ++i)
        v.push_back(i + 10);          // (2) may trigger reallocation

    std::cout << s[0] << std::endl;   // (3) read through s
}`,
      highlightLines: [7, 10, 12],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints 1: the span tracks v and stays valid across push_back",
        "Compile error: std::span cannot be constructed directly from a std::vector",
        "Undefined behavior: s still points at v's original, now-freed buffer",
        "Prints 10: the span re-points itself at v's new buffer after reallocation",
      ],
      correctIndex: 2,
    },
    explanation:
      "`std::span<int> s(v)` does exactly what `std::span` is documented to do: it stores a " +
      "raw `(pointer, size)` pair pointing at `v`'s *current* contiguous buffer at " +
      "construction time. It is a non-owning view with no relationship to `v` afterward; it " +
      "does not observe or react to any subsequent mutation of `v`. `v` starts with capacity " +
      "3 (holding `{1, 2, 3}`); the loop calls `push_back` 20 times, and once the element " +
      "count exceeds the current capacity, `std::vector` must allocate a new, larger buffer, " +
      "move/copy the existing elements into it, and free the old buffer, invalidating every " +
      "pointer, reference, and iterator into the old storage. `s` still holds the address of " +
      "the freed original buffer, so `s[0]` dereferences freed memory: undefined behavior. " +
      "Verified directly: `v.capacity()` was 3 before the loop and 24 after (confirming " +
      "reallocation occurred), and the program printed `4` for `s[0]`, neither `1` nor any " +
      "value that would make sense from the current contents of `v`, just whatever garbage " +
      "happened to occupy that freed memory. The exact same hazard applies to " +
      "`std::string_view` over a `std::string` that gets reallocated (e.g. by `append` or " +
      "`operator+=` exceeding SSO/capacity), and to any span/view taken over a container " +
      "that is mutated in a way that can invalidate its storage.",
    references: [
      "https://en.cppreference.com/w/cpp/container/span",
      "https://en.cppreference.com/w/cpp/container/vector#Iterator_invalidation",
    ],
  },
  {
    id: "cpp-memory-order-relaxed-01",
    category: "cpp",
    difficulty: "hard",
    title: "Two threads, one relaxed counter",
    tags: ["atomics", "memory-order", "concurrency", "c++11"],
    type: "trace",
    prompt:
      "Two threads each run this worker function 100,000 iterations, incrementing a " +
      "shared std::atomic<int> with memory_order_relaxed. What does main print after " +
      "both threads join?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <atomic>
#include <thread>
#include <iostream>

std::atomic<int> counter{0};

void worker() {
    for (int i = 0; i < 100000; ++i) {
        counter.fetch_add(1, std::memory_order_relaxed);
    }
}

int main() {
    std::thread t1(worker);
    std::thread t2(worker);
    t1.join();
    t2.join();
    std::cout << counter.load(std::memory_order_relaxed) << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Always exactly 200000",
        "Some value less than 200000: increments can be lost",
        "Undefined behavior: relaxed is not enough of a guarantee for a shared counter",
        "Compile error: fetch_add requires at least memory_order_acquire",
      ],
      correctIndex: 0,
    },
    explanation:
      "A very common misconception is that `memory_order_relaxed` weakens the atomic " +
      "operation itself, as if fetch_add could 'lose' an increment the way an " +
      "unsynchronized `counter++` on a plain `int` can. It doesn't: every " +
      "`std::atomic<T>` read-modify-write is required to be atomic no matter which " +
      "memory order tag you pass; the tag never changes *what* the operation does " +
      "to the atomic object, only what ordering/visibility guarantees accompany it " +
      "for *other* memory operations around it. 200,000 total increments across two " +
      "threads is always exactly 200,000; there is no lost-update window. What " +
      "relaxed genuinely does NOT give you is a synchronizes-with relationship: " +
      "there is no happens-before edge established between one thread's fetch_add " +
      "and another thread's later observation of it, so relaxed atomics must not be " +
      "used as a proxy for 'and therefore my other, non-atomic writes sequenced " +
      "before this one are now visible to the other thread'; that inference " +
      "requires acquire/release (or seq_cst), not relaxed. Relaxed is appropriate " +
      "precisely when you only need the atomicity of the counter value itself (e.g. " +
      "statistics counters) and nothing else in the program depends on its value to " +
      "infer visibility of unrelated memory.",
    references: [
      "https://en.cppreference.com/w/cpp/atomic/memory_order",
      "https://en.cppreference.com/w/cpp/atomic/atomic/fetch_add",
    ],
  },
  {
    id: "cpp-double-checked-locking-01",
    category: "cpp",
    difficulty: "hard",
    title: "Double-checked locking singleton",
    tags: ["concurrency", "singleton", "data-race", "undefined-behavior"],
    type: "trace",
    prompt:
      "This is the classic 'double-checked locking' singleton, written with a plain " +
      "(non-atomic) pointer. Thread A calls instance() first and is in the middle of " +
      "constructing the Singleton (inside the locked region) when Thread B calls " +
      "instance() concurrently and evaluates the first, unlocked `if (!instance_)`. " +
      "Is this program correct?",
    snippet: {
      language: "cpp",
      filename: "singleton.cpp",
      code: `#include <mutex>

class Singleton {
public:
    static Singleton* instance() {
        if (!instance_) {                     // (1) unlocked check
            std::lock_guard<std::mutex> lock(mutex_);
            if (!instance_) {                 // (2) locked check
                instance_ = new Singleton();  // (3) construct + publish
            }
        }
        return instance_;
    }

private:
    Singleton() = default;
    static Singleton* instance_;
    static std::mutex mutex_;
};

Singleton* Singleton::instance_ = nullptr;
std::mutex Singleton::mutex_;`,
      highlightLines: [6, 9],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It's correct: instance_ is assigned only once, inside the lock",
        "It's a data race and undefined behavior: Thread B can see a non-null " +
          "pointer to a partially-constructed Singleton",
        "It's a compile error: instance_ cannot be read outside the lock_guard's scope",
        "It's correct on every real platform: new returns only once construction " +
          "has fully completed",
      ],
      correctIndex: 1,
    },
    explanation:
      "Within Thread A, `new Singleton()` is sequenced so the constructor runs " +
      "before the resulting pointer is assigned to instance_; that ordering is " +
      "guaranteed *within Thread A*. The problem is that sequenced-before is a " +
      "single-thread guarantee; nothing here creates a synchronizes-with edge to " +
      "Thread B. The unlocked read at (1) and the write at (3) access the same " +
      "non-atomic object from different threads with no synchronization between " +
      "them, which is a data race, and a data race is undefined behavior by the " +
      "language standard, full stop, independent of what any particular compiler " +
      "or CPU does. Concretely, that UB manifests as: the compiler is free to " +
      "reorder or otherwise optimize as if no other thread touches instance_ " +
      "(it may not, but nothing forbids it either), and even with no compiler " +
      "reordering at all, weakly-ordered hardware can make the write to " +
      "instance_ globally visible to Thread B before the constructor's writes to " +
      "the object it points to are visible on Thread B's core, since nothing " +
      "establishes a memory barrier between them. Thread B then sees a non-null, " +
      "not-fully-constructed Singleton*. The standard fix is to make instance_ a " +
      "std::atomic<Singleton*>, storing it with memory_order_release inside the " +
      "lock and loading it with memory_order_acquire at both checks (or, simpler, " +
      "use a function-local static, which C++11 guarantees is initialized exactly " +
      "once in a thread-safe way).",
    references: [
      "https://en.cppreference.com/w/cpp/language/storage_duration#Static_local_variables",
      "https://en.cppreference.com/w/cpp/atomic/memory_order",
    ],
  },
  {
    id: "cpp-cas-weak-spurious-01",
    category: "cpp",
    difficulty: "hard",
    title: "Choosing between the weak and strong CAS",
    tags: ["atomics", "compare-exchange", "lock-free", "concurrency"],
    type: "trace",
    prompt:
      "push() below uses compare_exchange_weak inside a while loop to publish a new " +
      "head node onto a lock-free stack. Why is compare_exchange_weak preferred here " +
      "over compare_exchange_strong, and what would go wrong if the exact same call " +
      "were instead used once, outside any loop, inside a plain `if`?",
    snippet: {
      language: "cpp",
      filename: "stack.cpp",
      code: `#include <atomic>

struct Node { int value; Node* next; };
std::atomic<Node*> head{nullptr};

void push(Node* n) {
    n->next = head.load(std::memory_order_relaxed);
    while (!head.compare_exchange_weak(
               n->next, n,
               std::memory_order_release,
               std::memory_order_relaxed)) {
        // on failure, n->next has been updated to the current head; retry
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "There is no behavioral difference; weak vs. strong is a naming convention " +
          "and both compile to identical code everywhere",
        "compare_exchange_weak is only legal inside a loop condition; using it in a " +
          "bare if fails to compile",
        "compare_exchange_strong is the one meant for loops, since it retries " +
          "internally; weak is meant to be called exactly once",
        "compare_exchange_weak may fail spuriously even when the comparison holds, " +
          "which a retry loop absorbs but a bare if misreports as a real failure",
      ],
      correctIndex: 3,
    },
    explanation:
      "On architectures without a native single-instruction CAS (notably ARM/" +
      "AArch64's load-linked/store-conditional model), compare_exchange_strong is " +
      "typically implemented as a small internal retry loop around the weak " +
      "primitive so it can offer the guarantee that it only returns false when the " +
      "comparison genuinely failed. compare_exchange_weak skips that internal " +
      "loop and is allowed to report failure even when *object == expected really " +
      "did hold, because the LL/SC pair can be invalidated by things unrelated to " +
      "the value itself (a context switch, another memory access to the same " +
      "cache line, etc.). When the call site is already inside a retry loop (as " +
      "in any correct CAS-based lock-free algorithm), a spurious failure just means " +
      "one more harmless trip around the loop with (for a failed compare_exchange) " +
      "n->next freshly reloaded with the current head, and you skip the redundant " +
      "internal retry loop that _strong would otherwise perform, so weak is " +
      "strictly cheaper in this position. Outside a loop, though, compare_exchange " +
      "is being asked to answer a single yes/no question ('did the exchange happen " +
      "right now'), and _weak is explicitly permitted to answer 'no' incorrectly; " +
      "using it there silently converts a possibly-successful operation into a " +
      "reported failure with no way to tell the difference from a real ABA/" +
      "concurrent-modification failure.",
    references: [
      "https://en.cppreference.com/w/cpp/atomic/atomic/compare_exchange",
    ],
  },
  {
    id: "cpp-aba-problem-01",
    category: "cpp",
    difficulty: "hard",
    title: "Preempted in the middle of a pop",
    tags: ["atomics", "compare-exchange", "lock-free", "aba", "concurrency"],
    type: "trace",
    prompt:
      "pop() and push() implement a lock-free stack using CAS on a raw Node* head. " +
      "Consider this interleaving: Thread 1 calls pop(), reads old_head = A (with " +
      "A->next == B), then is preempted right before its compare_exchange_weak " +
      "runs. Meanwhile Thread 2 fully executes: pop() twice (removing A, then B, " +
      "so head becomes nullptr), frees node A, allocates a brand-new node that the " +
      "allocator happens to place at A's old address (call it A again), and pushes " +
      "it, followed by pushing some other node C, then pushing the original A " +
      "address again so that head == A once more (but now A->next == C, not B). " +
      "Thread 1 now resumes and executes its compare_exchange_weak(old_head, " +
      "old_head->next, ...) where old_head is still the address A and old_head-" +
      ">next is still the stale value B. What happens, and what is this failure " +
      "mode called?",
    snippet: {
      language: "cpp",
      filename: "stack.cpp",
      code: `#include <atomic>

struct Node { int value; Node* next; };
std::atomic<Node*> head{nullptr};

Node* pop() {
    Node* old_head = head.load(std::memory_order_acquire);
    while (old_head &&
           !head.compare_exchange_weak(
               old_head, old_head->next,
               std::memory_order_acq_rel,
               std::memory_order_acquire)) {
        // old_head reloaded with the current head on failure; retry
    }
    return old_head;
}

void push(Node* n) {
    n->next = head.load(std::memory_order_relaxed);
    while (!head.compare_exchange_weak(
               n->next, n,
               std::memory_order_release,
               std::memory_order_relaxed)) {}
}`,
      highlightLines: [9, 10, 11, 12],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The ABA problem: the CAS succeeds on the unchanged address and sets head " +
          "to a stale next pointer, corrupting the stack",
        "Priority inversion: Thread 1, holding a resource Thread 2 needs, is " +
          "starved because it runs at lower scheduling priority",
        "False sharing: head and the Node fields live on the same cache line, so " +
          "the two threads make the program slow but not incorrect",
        "Livelock: both threads keep retrying their compare_exchange_weak calls " +
          "forever without either one making progress",
      ],
      correctIndex: 0,
    },
    explanation:
      "This is the textbook ABA problem: head's value went A -> B -> nullptr -> " +
      "A' (a new object, coincidentally reusing address A) -> ... -> A (the same " +
      "address reused again after being pushed back). Thread 1's CAS only checks " +
      "'does head currently equal the address I remember (A)?'; it has no way to " +
      "detect that the object at address A is not the same logical node it read " +
      "before, and that the intervening B has since been popped and possibly " +
      "freed. The compare succeeds, and Thread 1 sets head to old_head->next, " +
      "which it computed from the *original* A node it read (pointing at B), but " +
      "the current A node's real next is C, and B may already be freed memory. " +
      "The stack's head pointer is now corrupted, pointing at a node (B) that has " +
      "been evicted from the structure (or worse, deallocated), which is a much " +
      "more dangerous outcome than either priority inversion or false sharing " +
      "(neither of which involves CAS producing a wrong-but-'successful' result) " +
      "or livelock (no thread is stuck retrying here; the CAS deceptively " +
      "succeeds on the first try). Standard mitigations include tagging the " +
      "pointer with a monotonically increasing counter packed alongside it " +
      "(double-width CAS / std::atomic<TaggedPtr>), hazard pointers, or epoch-" +
      "based reclamation, all of which make 'the same address came back' " +
      "distinguishable from 'the same logical value is still there'.",
    references: [
      "https://en.cppreference.com/w/cpp/atomic/atomic/compare_exchange",
    ],
  },
  {
    id: "cpp-volatile-not-atomic-01",
    category: "cpp",
    difficulty: "hard",
    title: "A volatile flag between two threads",
    tags: ["volatile", "concurrency", "data-race", "undefined-behavior"],
    type: "trace",
    prompt:
      "producer() writes data then sets flag; consumer() spins on flag before " +
      "(implicitly) reading data. flag is declared volatile bool. Is this program " +
      "correct C++, and is volatile doing what the programmer probably intended?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <thread>

volatile bool flag = false;
int data = 0;

void producer() {
    data = 42;
    flag = true;
}

void consumer() {
    while (!flag) {
        // spin until flag is set
    }
    // ... use data here, expecting to see 42
}

int main() {
    std::thread p(producer);
    std::thread c(consumer);
    p.join();
    c.join();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Correct: volatile forces every access to go to memory and stops the " +
          "compiler caching flag in a register, which is the signaling needed here",
        "A data race and undefined behavior: volatile provides no atomicity and " +
          "establishes no happens-before relationship across threads",
        "Incorrect only because flag should also be declared static; with static " +
          "added, volatile alone is sufficient here",
        "Correct on x86 but undefined behavior on weakly-ordered architectures " +
          "like ARM: the standard's guarantee for volatile is platform-dependent",
      ],
      correctIndex: 1,
    },
    explanation:
      "C++'s volatile and Java's volatile are unrelated despite the shared " +
      "keyword. C++ volatile guarantees only that accesses to the volatile object " +
      "are treated as observable side effects that the compiler must not remove, " +
      "merge, or reorder past other volatile accesses, which is the contract signal " +
      "handlers and memory-mapped I/O registers need (the hardware/OS may change " +
      "the value 'behind the compiler's back', so every read must actually hit " +
      "memory). It says nothing about atomicity (a multi-byte volatile object can " +
      "still tear) and nothing about visibility or ordering across *threads*; no " +
      "synchronizes-with edge is created, so there's no happens-before " +
      "relationship between producer's writes and consumer's reads. That makes " +
      "both `flag` (a data race on the flag itself) and, more insidiously, `data` " +
      "(read with no synchronization at all, not even volatile) undefined " +
      "behavior. In practice this can 'happen to work' on x86 with an unoptimized " +
      "build purely by luck of the codegen, which is precisely what makes the bug " +
      "dangerous, but choice D's framing is still wrong: the standard's " +
      "guarantee (or lack thereof) does not vary by platform; only how visibly the " +
      "resulting UB manifests does. The correct fix is std::atomic<bool> with " +
      "release/acquire ordering on flag (see the companion acquire/release " +
      "question in this set for why that pairing does work).",
    references: [
      "https://en.cppreference.com/w/cpp/language/cv",
      "https://en.cppreference.com/w/cpp/atomic/memory_order",
    ],
  },
  {
    id: "cpp-thread-local-01",
    category: "cpp",
    difficulty: "medium",
    title: "One counter, three different callers",
    tags: ["thread_local", "concurrency", "storage-duration"],
    type: "trace",
    prompt:
      "counter is thread_local. t1 calls increment_and_print(3), t2 calls " +
      "increment_and_print(5) concurrently, then after both are joined, main " +
      "itself calls increment_and_print(1). What values get printed for counter " +
      "in the three calls (t1's line, t2's line, and main's line)? (The two " +
      "threads' lines may print in either relative order, but focus on the " +
      "*values*.)",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <thread>
#include <mutex>

thread_local int counter = 0;
std::mutex io_mutex;

void increment_and_print(int times) {
    for (int i = 0; i < times; ++i) {
        ++counter;
    }
    std::lock_guard<std::mutex> lock(io_mutex);
    std::cout << "thread " << std::this_thread::get_id()
               << ": " << counter << std::endl;
}

int main() {
    std::thread t1(increment_and_print, 3);
    std::thread t2(increment_and_print, 5);
    t1.join();
    t2.join();
    increment_and_print(1);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "3, 8, and 9: counter is really one shared global underneath",
        "Compile error: a thread_local cannot be read from a function called on " +
          "more than one thread",
        "0, 0, and 0: the initializer is re-run on every access to counter",
        "3, 5, and 1: each thread gets its own zero-initialized instance of counter",
      ],
      correctIndex: 3,
    },
    explanation:
      "thread_local gives each thread of execution its own separate instance of " +
      "the variable, with its own storage duration tied to that thread's lifetime. " +
      "The initializer (`= 0` here) runs independently for each thread the first " +
      "time that thread touches the variable (for a function-local thread_local " +
      "it would be on first control flow through the declaration; for this " +
      "namespace-scope thread_local it's initialized before first use in each " +
      "thread). t1's three increments only ever touch t1's copy (starting from " +
      "its own zero), producing 3; t2's five increments only touch t2's separate " +
      "copy, producing 5; main's own copy of counter was never touched before its " +
      "own call, so incrementing it once produces 1. Nothing here is shared, so " +
      "there's no synchronization hazard on counter itself either (the mutex in " +
      "this example is only protecting std::cout, which genuinely is shared). The " +
      "only nondeterminism in this program is the relative order the two lines " +
      "print in, since t1 and t2 run concurrently; the numeric values printed " +
      "are fully deterministic.",
    references: [
      "https://en.cppreference.com/w/cpp/language/storage_duration#Thread_storage_duration",
    ],
  },
  {
    id: "cpp-atomic-lock-free-01",
    category: "cpp",
    difficulty: "medium",
    title: "std::atomic over a 12-byte struct",
    tags: ["atomics", "is_lock_free", "concurrency"],
    type: "trace",
    prompt:
      "MyStruct is a plain 12-byte trivially-copyable struct (three ints, no " +
      "padding tricks). Is std::atomic<MyStruct> guaranteed to be lock-free, and " +
      "is value.load() still a correct, race-free way to read it if " +
      "is_lock_free() returns false?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <atomic>
#include <cstdio>

struct MyStruct {
    int a;
    int b;
    int c;
};  // sizeof(MyStruct) == 12, not a power of two

int main() {
    std::atomic<MyStruct> value{MyStruct{1, 2, 3}};
    std::printf("lock_free: %d\\n", value.is_lock_free());
    MyStruct read = value.load();
    std::printf("%d %d %d\\n", read.a, read.b, read.c);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes, always: every std::atomic specialization is lock-free by definition",
        "Not guaranteed: a 12-byte type may fall back to an internal lock, and " +
          "load() is still correct and atomic either way",
        "Compile error: std::atomic<T> is only valid for T of size 1, 2, 4, 8, " +
          "or 16 bytes",
        "Undefined behavior: instantiating std::atomic on a type that has no " +
          "native atomic width is UB",
      ],
      correctIndex: 1,
    },
    explanation:
      "std::atomic<T> is well-formed for any trivially copyable T (MyStruct " +
      "qualifies), and it always gives you correct atomic semantics for load, " +
      "store, and (where applicable) compare_exchange; that correctness " +
      "guarantee is unconditional. What is *not* guaranteed is that the " +
      "implementation can provide it lock-free: many platforms only have native " +
      "atomic RMW/CAS instructions at specific widths, and a 12-byte object " +
      "doesn't match any of them, so the standard library commonly implements " +
      "std::atomic<MyStruct> using an internal lock (a hidden mutex or " +
      "equivalent) rather than a hardware atomic instruction. is_lock_free() is " +
      "a runtime query (because it can legitimately vary by target, e.g. whether " +
      "double-width CAS is available) that tells you which strategy your build " +
      "actually got; is_always_lock_free is the compile-time equivalent when the " +
      "answer is known unconditionally. The key exam-relevant takeaway: 'atomic' " +
      "in C++ is a correctness/API guarantee, not a performance guarantee: never " +
      "assume std::atomic<T> is wait-free or even lock-free for an arbitrary T " +
      "without checking, especially for struct types.",
    references: [
      "https://en.cppreference.com/w/cpp/atomic/atomic/is_lock_free",
      "https://en.cppreference.com/w/cpp/atomic/atomic",
    ],
  },
  {
    id: "cpp-acquire-release-01",
    category: "cpp",
    difficulty: "hard",
    title: "Handing off data with a release and an acquire",
    tags: ["atomics", "memory-order", "acquire-release", "concurrency"],
    type: "trace",
    prompt:
      "producer() writes a plain (non-atomic) int data, then does a release-store " +
      "to std::atomic<bool> ready. consumer() spin-waits with an acquire-load on " +
      "ready. Once consumer observes ready == true, is it guaranteed to see " +
      "data == 42, with no UB? And what would break if both the store and the " +
      "load instead used memory_order_relaxed?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <atomic>
#include <thread>

std::atomic<bool> ready{false};
int data = 0;

void producer() {
    data = 42;                                     // plain, non-atomic write
    ready.store(true, std::memory_order_release);
}

void consumer() {
    while (!ready.load(std::memory_order_acquire)) {
        // spin
    }
    // is data guaranteed to be 42 here?
}`,
      highlightLines: [8, 13],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: the release/acquire pair creates a happens-before edge, so data == " +
          "42 is guaranteed; with relaxed on both sides that edge is gone and " +
          "reading data becomes a data race",
        "Yes with acquire/release, and it would stay correct with relaxed/relaxed, " +
          "since memory_order only orders the atomic variable itself",
        "No, not guaranteed even as written: data is not atomic, so accessing it " +
          "from either thread is undefined behavior regardless",
        "No: acquire/release can only order operations on ready itself, so data " +
          "still needs a mutex around it",
      ],
      correctIndex: 0,
    },
    explanation:
      "This is the canonical, correct use of acquire/release: it is precisely " +
      "the mechanism the standard provides for safely publishing plain data " +
      "across threads without a mutex. The rule ([atomics.order]) is that a " +
      "release operation on an atomic object M, if it is read by an acquire " +
      "operation on M that observes the value written (or a value later in the " +
      "release sequence), synchronizes-with that acquire operation. Combined " +
      "with ordinary sequenced-before within each thread (data = 42 is sequenced " +
      "before the release-store; the acquire-load is sequenced before the use of " +
      "data), this chains into a happens-before relationship from the write of " +
      "data to the read of data, which is exactly what's required to make an " +
      "access to a non-atomic object race-free across threads. So option A is " +
      "correct, and data == 42 is guaranteed the moment consumer observes " +
      "ready == true. Swap both operations to memory_order_relaxed and that " +
      "chain breaks at the first link: relaxed operations on ready are still " +
      "atomic (no torn reads of the bool) but no longer synchronize-with anything, " +
      "so there is no happens-before edge forcing data's write to become visible " +
      "before ready's write does, on either the compiler or hardware side. The " +
      "consumer could legally observe ready == true while data is still 0 (or, " +
      "on a real weakly-ordered CPU, actually would on occasion), and because " +
      "that read of data races with producer's write with no synchronization at " +
      "all, it is undefined behavior, not merely 'reads a stale but valid value'. " +
      "Option D is a common but incorrect belief: acquire/release's entire point " +
      "is to order *surrounding* non-atomic memory operations, not just the " +
      "atomic variable itself.",
    references: [
      "https://en.cppreference.com/w/cpp/atomic/memory_order",
      "https://en.cppreference.com/w/cpp/atomic/atomic/store",
    ],
  },
  {
    id: "cpp-data-race-ub-01",
    category: "cpp",
    difficulty: "hard",
    title: "A spin loop with no locks and no atomics",
    tags: ["data-race", "undefined-behavior", "concurrency", "optimization"],
    type: "trace",
    prompt:
      "worker() spins on a plain (non-atomic, non-volatile) bool, incrementing a " +
      "plain long long counter, until main sets stop = true from a different " +
      "thread with no synchronization at all. Compiled with optimizations (-O2), " +
      "does the worker thread reliably observe the update and terminate its loop?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <thread>

bool stop = false;
long long counter = 0;

void worker() {
    while (!stop) {
        ++counter;
    }
}

int main() {
    std::thread t(worker);
    // ... some time later, from main, with no synchronization whatsoever:
    stop = true;
    t.join();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Not necessarily: this is a data race and undefined behavior, and the " +
          "optimizer may hoist the read of stop out of the loop entirely",
        "Yes: plain bool and int accesses are single machine instructions on " +
          "mainstream hardware, so the update shows up almost immediately",
        "Yes, but only because bool is exactly 1 byte, and 1-byte objects are " +
          "always read and written atomically",
        "No: the program fails to compile, since worker reads a variable it " +
          "never captures",
      ],
      correctIndex: 0,
    },
    explanation:
      "The recurring theme across this whole topic cluster: a data race in C++ " +
      "is undefined behavior by definition ([intro.races]), and UB is not " +
      "limited to 'torn values' or other narrowly-hardware-flavored corruption: " +
      "the standard permits the implementation to do anything, including " +
      "optimizations that are perfectly sound *under the no-data-races " +
      "assumption* but produce results a naive reading of the source would never " +
      "predict. Here, since stop is never written to inside worker() (from the " +
      "compiler's perspective, analyzing that one thread of execution in " +
      "isolation, as the abstract machine permits it to), and the language " +
      "guarantees no other thread can race on it without that being UB (which the " +
      "compiler is entitled to assume doesn't happen), the compiler is licensed " +
      "to treat `stop` as invariant across the loop body and cache its value in a " +
      "register once, never reloading it from memory again, an entirely legal " +
      "transformation of `while (!stop) ++counter;` into `if (!stop) { while " +
      "(true) ++counter; }`. Main's write to stop from another thread never gets " +
      "observed, and worker spins forever. This is not a theoretical curiosity: " +
      "it is a well-documented real-world footgun (this exact 'while(!flag) spin " +
      "loop with a plain bool' pattern has caused genuine infinite-loop bugs at " +
      "-O2/-O3 with real compilers) that motivates why std::atomic<bool> (or at " +
      "minimum, historically, volatile as an ad hoc workaround, which has its own " +
      "problems; see the companion volatile question) exists. The count itself " +
      "not being torn (options B/C reasoning) misses the point entirely: the " +
      "danger here isn't a corrupted value, it's the compiler eliminating the " +
      "re-read altogether.",
    references: [
      "https://en.cppreference.com/w/cpp/language/memory_model#Threads_and_data_races",
      "https://en.cppreference.com/w/cpp/atomic/atomic",
    ],
  },
  {
    id: "cpp-float-associativity-01",
    category: "cpp",
    difficulty: "medium",
    title: "Adding 0.1, 0.2, and 0.3 in two different orders",
    tags: ["floating-point", "ieee-754", "numerics"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdio>

int main() {
    double a = 0.1, b = 0.2, c = 0.3;
    double left = (a + b) + c;
    double right = a + (b + c);
    printf("%.17g\\n", left);
    printf("%.17g\\n", right);
    printf("%s\\n", (left == right) ? "equal" : "not equal");
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "0.59999999999999998\\n0.59999999999999998\\nequal",
        "0.60000000000000009\\n0.60000000000000009\\nequal",
        "Compile error: floating-point comparison with == requires an explicit epsilon",
        "0.60000000000000009\\n0.59999999999999998\\nnot equal",
      ],
      correctIndex: 3,
    },
    explanation:
      "Real (base-2, finite-precision) floating-point addition is not associative: each `+` " +
      "rounds its result to the nearest representable `double`, and *which* intermediate " +
      "value gets rounded depends on evaluation order. `0.1` and `0.2` are themselves not " +
      "exactly representable in binary, and `(0.1 + 0.2)` rounds to a value slightly above " +
      "the true sum; adding `0.3` to that already-rounded value produces " +
      "`0.60000000000000009` (printed with `%.17g` to show the full precision). Evaluating " +
      "`0.2 + 0.3` first rounds to a value that, when `0.1` is added, lands exactly on " +
      "`0.59999999999999998`, the closest `double` to `0.6`, but a *different* closest " +
      "double than the other grouping produced. The two results differ in their last bit, so " +
      "`left == right` is `false`. This is precisely why associativity cannot be assumed for " +
      "`double`/`float` arithmetic, and why compilers must not reorder floating-point " +
      "additions under strict IEEE 754 semantics (`-ffast-math` explicitly opts out of this " +
      "guarantee).",
    references: [
      "https://en.cppreference.com/w/cpp/language/operator_arithmetic",
      "https://en.wikipedia.org/wiki/IEEE_754",
    ],
  },
  {
    id: "cpp-nan-comparison-01",
    category: "cpp",
    difficulty: "medium",
    title: "Four comparisons involving NaN",
    tags: ["floating-point", "ieee-754", "nan", "numerics"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdio>
#include <limits>

int main() {
    double nan = std::numeric_limits<double>::quiet_NaN();
    printf("%s\\n", (nan == nan) ? "true" : "false");
    printf("%s\\n", (nan != nan) ? "true" : "false");
    printf("%s\\n", (nan < 1.0) ? "true" : "false");
    printf("%s\\n", (nan > 1.0) ? "true" : "false");
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "true\\nfalse\\nfalse\\nfalse",
        "false\\ntrue\\nfalse\\nfalse",
        "false\\nfalse\\nfalse\\nfalse",
        "Compile error: NaN cannot be compared with relational operators",
      ],
      correctIndex: 1,
    },
    explanation:
      "IEEE 754 defines every ordered comparison (`==`, `<`, `<=`, `>`, `>=`) involving a NaN " +
      "operand to be `false`, including `nan == nan`: NaN compares unequal to *everything*, " +
      "itself included. `!=` is the negation of `==`, so it is the one comparison here that " +
      "yields `true`: `nan != nan` holds precisely because `nan == nan` does not. `nan < 1.0` " +
      "and `nan > 1.0` are both `false` because NaN is unordered with respect to every real " +
      "number: neither less-than nor greater-than holds. That is why `x != x` is a " +
      "common (if obscure) idiom for detecting NaN before `std::isnan` became the preferred, " +
      "self-documenting way to do it.",
    references: [
      "https://en.cppreference.com/w/cpp/numeric/math/nan",
      "https://en.cppreference.com/w/cpp/numeric/math/isnan",
    ],
  },
  {
    id: "cpp-integer-division-01",
    category: "cpp",
    difficulty: "easy",
    title: "Integer division and modulo with a negative operand",
    tags: ["integers", "division", "modulo", "undefined-behavior"],
    type: "trace",
    prompt: "What does this program print, under C++11 and later?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <cstdio>

int main() {
    int q = -7 / 2;
    int r = -7 % 2;
    printf("%d\\n", q);
    printf("%d\\n", r);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "-3\\n-1",
        "-4\\n1",
        "-3\\n1",
        "-4\\n-1",
      ],
      correctIndex: 0,
    },
    explanation:
      "Since C++11 ([expr.mul]p4), integer division is defined to truncate *toward zero* " +
      "(not floor toward negative infinity), and `%` is defined so that `(a/b)*b + a%b == a` " +
      "holds exactly, meaning the result of `%` always takes the sign of the dividend `a` " +
      "(or is zero). `-7 / 2` mathematically is `-3.5`; truncating toward zero rounds that " +
      "*up* to `-3` (not down to `-4`, which is what floor division would give). Then " +
      "`-7 % 2` is forced to satisfy `(-3)*2 + r == -7`, i.e. `r == -1`. Before C++11 this " +
      "rounding direction was implementation-defined (most platforms already truncated " +
      "toward zero, matching hardware `idiv`, but it wasn't guaranteed by the standard); " +
      "C++11 locked in truncation-toward-zero as the only conforming behavior. This differs " +
      "from Python's `//` and `%`, which floor instead, a frequent source of off-by-one " +
      "bugs when porting numeric code between the two languages.",
    references: [
      "https://en.cppreference.com/w/cpp/language/operator_arithmetic",
    ],
  },
  {
    id: "cpp-consteval-01",
    category: "cpp",
    difficulty: "medium",
    title: "constexpr and consteval called with a non-const local",
    tags: ["consteval", "constexpr", "c++20", "compile-time"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `consteval int squareConsteval(int x) {
    return x * x;
}

constexpr int squareConstexpr(int x) {
    return x * x;
}

int main() {
    int runtimeVal = 5;

    int a = squareConstexpr(runtimeVal);   // (1)
    int b = squareConsteval(runtimeVal);   // (2)

    return a + b;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compiles fine: both (1) and (2) fall back to ordinary runtime evaluation",
        "Compile error at (1): squareConstexpr must be evaluated at compile time",
        "Compile error at (2): squareConsteval(runtimeVal) is not a constant expression",
        "Compile error at both (1) and (2): neither runtimeVal nor its uses can appear in a constexpr/consteval context",
      ],
      correctIndex: 2,
    },
    explanation:
      "`constexpr` on a function only means the function is *permitted* to run at compile " +
      "time when its arguments happen to be constant expressions; when they aren't (as with " +
      "`runtimeVal`, an ordinary non-const local variable), the compiler silently falls back " +
      "to a normal runtime call; line (1) compiles and runs exactly like a plain function. " +
      "`consteval` (C++20, [dcl.constexpr]) is stricter: it declares an *immediate function*, " +
      "which the standard requires to produce a constant expression for every single " +
      "invocation, with no runtime fallback permitted. Since `runtimeVal` is not usable in a " +
      "constant expression, line (2)'s call `squareConsteval(runtimeVal)` cannot be evaluated " +
      "at compile time, and the standard mandates this be a hard compile error rather than " +
      "silently degrading to a runtime call. Calling `squareConsteval` with a genuine " +
      "constant, e.g. `squareConsteval(10)`, would compile without issue. `consteval` exists " +
      "precisely for cases (like reflection helpers or compile-time-only APIs) where a " +
      "runtime fallback would be a correctness bug rather than a convenience.",
    references: [
      "https://en.cppreference.com/w/cpp/language/consteval",
      "https://en.cppreference.com/w/cpp/language/constexpr",
    ],
  },
  {
    id: "cpp-decltype-auto-01",
    category: "cpp",
    difficulty: "hard",
    title: "auto vs decltype(auto) in return-type deduction",
    tags: ["decltype", "auto", "return-type-deduction", "references"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <vector>

class Matrix {
    std::vector<int> data{1, 2, 3};
public:
    auto get(size_t i) { return data[i]; }             // (1) auto
    decltype(auto) getRef(size_t i) { return data[i]; } // (2) decltype(auto)
};

int main() {
    Matrix m;

    m.getRef(0) = 100;                 // modify through (2)
    std::cout << m.getRef(0) << "\\n";

    auto copy = m.get(0);              // read through (1)
    copy = 999;                        // modify the local copy only
    std::cout << m.get(0) << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "100\\n999",
        "100\\n100",
        "1\\n1",
        "Compile error: get(0) and getRef(0) have conflicting return types for the same expression data[i]",
      ],
      correctIndex: 1,
    },
    explanation:
      "`data[i]` calls `std::vector<int>::operator[]`, whose declared return type is `int&`. " +
      "With plain `auto` as the return type, deduction works like template argument " +
      "deduction: it strips references and top-level cv-qualifiers from the expression's " +
      "type, so `get` is deduced to return `int` *by value*: `m.get(0)` yields a fresh " +
      "copy of the element every call, and mutating that copy (`copy = 999`) has no effect " +
      "on `m`. `decltype(auto)`, by contrast, computes the return type as exactly " +
      "`decltype(data[i])`, which is `int&`: the reference is preserved verbatim, so " +
      "`getRef` really does hand back a reference into `m`'s internal storage, and " +
      "`m.getRef(0) = 100` mutates `m` itself. The second `std::cout` line reads `100` " +
      "(the mutation through `getRef` persisted) rather than `999` (the local copy's " +
      "mutation never touched `m`). This is the classic trap of reaching for `auto` on a " +
      "getter that is meant to expose a mutable reference: it compiles, it looks correct, " +
      "and it silently returns copies instead.",
    references: [
      "https://en.cppreference.com/w/cpp/language/auto",
      "https://en.cppreference.com/w/cpp/language/decltype",
    ],
  },
  {
    id: "cpp-move-const-01",
    category: "cpp",
    difficulty: "hard",
    title: "One const Widget, two constructors",
    tags: ["move-semantics", "std::move", "const", "overload-resolution"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <utility>

struct Widget {
    Widget() = default;
    Widget(const Widget&) { std::cout << "copy ctor\\n"; }
    Widget(Widget&&) noexcept { std::cout << "move ctor\\n"; }
};

int main() {
    const Widget a;
    Widget b(std::move(a));
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "move ctor",
        "copy ctor",
        "Compile error: cannot call std::move on a const object",
        "Compile error: no viable constructor for Widget b(std::move(a))",
      ],
      correctIndex: 1,
    },
    explanation:
      "`std::move(a)` is just `static_cast<const Widget&&>(a)`: it preserves whatever " +
      "cv-qualification `a` already has, so casting a `const Widget` produces a `const " +
      "Widget&&`, not a plain `Widget&&`. Overload resolution then looks for the best-match " +
      "constructor for an argument of type `const Widget&&`: the move constructor's " +
      "parameter is `Widget&&` (non-const), which a `const` rvalue cannot bind to, so it is " +
      "not viable. The copy constructor's parameter is `const Widget&`, and a `const " +
      "Widget&&` binds to `const Widget&` perfectly well (an rvalue reference is still an " +
      "rvalue, and `const T&` binds to any value category). So the copy constructor is " +
      "selected, quietly, with no warning and no error, and `\"copy ctor\"` is printed. " +
      "This is a genuinely dangerous gotcha: the code *looks* like it opts into a move, " +
      "compiles cleanly, and silently degrades to a full copy instead, which can be a real " +
      "performance cliff in code that assumes `std::move` guarantees move semantics.",
    references: [
      "https://en.cppreference.com/w/cpp/utility/move",
      "https://en.cppreference.com/w/cpp/language/overload_resolution",
    ],
  },
  {
    id: "cpp-forwarding-ref-lvalue-01",
    category: "cpp",
    difficulty: "medium",
    title: "Two functions, both taking &&",
    tags: ["templates", "forwarding-references", "rvalue-references", "overload-resolution"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

template <typename T>
void forwardRef(T&& x) {     // deduced context: forwarding reference
    std::cout << "forwardRef\\n";
}

void fixedRRef(int&& x) {    // non-template: ordinary fixed rvalue reference
    std::cout << "fixedRRef\\n";
}

int main() {
    int val = 42;
    forwardRef(val);   // (1)
    fixedRRef(val);     // (2)
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints forwardRef then fixedRRef: both accept the lvalue",
        "Compile error at (1): T&& cannot bind to an lvalue any more than int&& can",
        "Compile error at (2) only: int&& cannot bind to the lvalue val",
        "Both lines compile, but (2) is undefined behavior at runtime rather than a compile error",
      ],
      correctIndex: 2,
    },
    explanation:
      "`T&&` is a forwarding reference only when `T` is a template parameter deduced *for " +
      "that specific call* ([temp.deduct.call]p3), exactly the situation in `forwardRef`. " +
      "Calling it with the lvalue `val` (type `int`) deduces `T` as `int&`; reference " +
      "collapsing ([dcl.ref]: `& + && -> &`) then turns the parameter type `T&&` = " +
      "`int& &&` into plain `int&`, an ordinary lvalue reference that binds to `val` without " +
      "issue; line (1) compiles and runs. `fixedRRef`, by contrast, is an ordinary " +
      "non-template function: its parameter type `int&&` is fixed at declaration, with no " +
      "deduction and therefore no collapsing possible. An rvalue reference can only bind to " +
      "rvalues (temporaries, or values explicitly cast via `std::move`), and `val` is a " +
      "named lvalue, so `fixedRRef(val)` fails overload resolution outright: a hard compile " +
      "error (\"cannot bind rvalue reference of type 'int&&' to lvalue of type 'int'\"). The " +
      "contrast is the whole point of the forwarding-reference machinery: syntactically " +
      "identical `T&&`/`int&&` spelling, but only the deduced-template-parameter form gets " +
      "the special dual-binding behavior.",
    references: [
      "https://en.cppreference.com/w/cpp/language/reference#Forwarding_references",
      "https://en.cppreference.com/w/cpp/language/reference",
    ],
  },
  {
    id: "cpp-variant-visit-01",
    category: "cpp",
    difficulty: "medium",
    title: "std::visit and std::get on the same variant",
    tags: ["std::variant", "std::visit", "exceptions", "c++17"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>
#include <string>
#include <variant>

template <class... Ts>
struct overloaded : Ts... { using Ts::operator()...; };
template <class... Ts>
overloaded(Ts...) -> overloaded<Ts...>;

int main() {
    std::variant<int, std::string> v = std::string("hello");

    std::visit(overloaded{
        [](int i) { std::cout << "int: " << i << "\\n"; },
        [](const std::string& s) { std::cout << "string: " << s << "\\n"; }
    }, v);

    try {
        int x = std::get<int>(v);
        std::cout << "got int: " << x << "\\n";
    } catch (const std::bad_variant_access& e) {
        std::cout << "bad_variant_access\\n";
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "string: hello\\nbad_variant_access",
        "string: hello\\ngot int: 0",
        "Compile error: overloaded{...} cannot deduce a single callable matching v's alternatives",
        "int: 0\\nbad_variant_access",
      ],
      correctIndex: 0,
    },
    explanation:
      "`v` currently holds the `std::string` alternative. `std::visit` dispatches to " +
      "whichever `operator()` overload matches the alternative *actually* active: the " +
      "`overloaded` helper merges a set of lambdas into one callable via multiple inheritance " +
      "and `using`-declarations that pull every base's `operator()` into a single overload " +
      "set, so the compiler picks the `const std::string&` overload and prints " +
      "`\"string: hello\"`. `std::get<int>(v)`, by contrast, is a checked direct access that " +
      "asserts a *specific* alternative is active regardless of what actually is; since `v` " +
      "holds a `std::string`, not an `int`, this throws `std::bad_variant_access` " +
      "([variant.get]) rather than returning a garbage or default value; there is no " +
      "silent UB path here, unlike a raw union. The broader lesson is `std::visit` is the " +
      "*safe*, exhaustive way to interact with a variant (the compiler enforces that every " +
      "alternative has a matching callable at the call site), while `std::get<T>` is a " +
      "runtime bet that must be guarded with `std::holds_alternative<T>` or a try/catch if " +
      "you aren't certain which alternative is live.",
    references: [
      "https://en.cppreference.com/w/cpp/utility/variant/get",
      "https://en.cppreference.com/w/cpp/utility/variant/visit",
    ],
  },
  {
    id: "cpp-sort-comparator-ub-01",
    category: "cpp",
    difficulty: "hard",
    title: "Sorting 100,000 ints with <=",
    tags: ["std::sort", "undefined-behavior", "comparators", "algorithms"],
    type: "trace",
    prompt:
      "This program sorts a vector using <= instead of < as the comparator. What is true about its behavior?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <algorithm>
#include <vector>
#include <random>
#include <iostream>

int main() {
    std::vector<int> v(100000);
    std::mt19937 rng(42);
    for (auto& x : v) x = rng() % 1000;

    std::sort(v.begin(), v.end(),
               [](int a, int b) { return a <= b; });

    std::cout << "sorted, size=" << v.size() << "\\n";
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It's fine: treating equal elements as 'less' only costs a few extra swaps",
        "Undefined behavior: the comparator is not a strict weak ordering, so the sort can crash or hang rather than merely mis-sort",
        "It compiles and always produces a correctly sorted, merely less efficient result",
        "Compile error: std::sort requires the comparator to use operator< exactly, not <=",
      ],
      correctIndex: 1,
    },
    explanation:
      "`std::sort`'s comparator is required by the standard to establish a *strict weak " +
      "ordering* ([alg.sorting]/[algorithms.requirements]): irreflexive (`comp(a, a)` must " +
      "be `false`), asymmetric, and transitive. `a <= b` violates irreflexivity outright: " +
      "`comp(a, a)` (`a <= a`) is `true` for every `a`, so the precondition is broken and " +
      "the call is undefined behavior, full stop, regardless of whether the output *looks* " +
      "sorted for small inputs. This isn't a hypothetical: introspective sort/quicksort-based " +
      "implementations use the comparator's ordering guarantees to bound recursion depth and " +
      "partition indices; when those guarantees don't hold, the algorithm can walk indices " +
      "outside the valid range of the container, producing an out-of-bounds read/write, not " +
      "just a wrong order. The exact failure mode is library-implementation-dependent: " +
      "verified directly, this program built against libstdc++ (real GCC) crashes with " +
      "SIGBUS once the input is large enough to hit the buggy code path, while the same " +
      "source built against libc++ (Clang's default on macOS) instead spins in a " +
      "near-infinite loop rather than crashing outright. Either way the result is squarely " +
      "outside 'just a wrong order': it's exactly the kind of 'passed code review, corrupted " +
      "memory or hung in production' bug this precondition exists to prevent. The fix is " +
      "trivial: use `a < b` (or, for descending order, `a > b`), strict, never comparing an " +
      "element as less than itself.",
    references: [
      "https://en.cppreference.com/w/cpp/algorithm/sort",
      "https://en.cppreference.com/w/cpp/named_req/Compare",
    ],
  },
  {
    id: "cpp-fill-raii-destructor-01",
    category: "cpp",
    difficulty: "easy",
    title: "Release the buffer in the destructor",
    tags: ["raii", "destructors", "memory-management", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so the destructor releases the array Buffer owns, " +
      "without leaking memory or triggering undefined behavior.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Buffer {
public:
    explicit Buffer(size_t n) : data_(new int[n]) {}
    ~Buffer() {
        /*BLANK_1*/
    }
private:
    int* data_;
};`,
    },
    blanks: [{ id: "1", acceptedAnswers: ["delete[] data_;", "delete [] data_;"] }],
    canonicalCode: `class Buffer {
public:
    explicit Buffer(size_t n) : data_(new int[n]) {}
    ~Buffer() {
        delete[] data_;
    }
private:
    int* data_;
};`,
    explanation:
      "`data_` was allocated with the array form `new int[n]`, so it must be released with " +
      "the matching `delete[] data_;`. Pairing an array allocation with a scalar `delete " +
      "data_;` is undefined behavior: the allocator's per-allocation bookkeeping (e.g. the " +
      "stored element count needed to call each element's destructor) is written and " +
      "consumed differently for the scalar vs. array forms, and mismatching them corrupts " +
      "that bookkeeping rather than just leaking. Omitting the delete entirely leaks the " +
      "array for as long as the Buffer's owner keeps allocating and destroying instances.",
    references: ["https://en.cppreference.com/w/cpp/language/delete"],
  },
  {
    id: "cpp-fill-move-ctor-01",
    category: "cpp",
    difficulty: "medium",
    title: "Leave the moved-from object safely destructible",
    tags: ["move-semantics", "raii", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so that after a Buffer is moved from, both the " +
      "moved-from and moved-to objects can be safely destroyed without a double-free.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Buffer {
public:
    Buffer(Buffer&& other) noexcept
        : data_(other.data_), size_(other.size_) {
        /*BLANK_1*/
    }
    ~Buffer() { delete[] data_; }
private:
    int* data_;
    size_t size_;
};`,
    },
    blanks: [
      {
        id: "1",
        acceptedAnswers: [
          "other.data_ = nullptr;",
          "other.data_ = nullptr; other.size_ = 0;",
          "other.size_ = 0; other.data_ = nullptr;",
        ],
      },
    ],
    canonicalCode: `class Buffer {
public:
    Buffer(Buffer&& other) noexcept
        : data_(other.data_), size_(other.size_) {
        other.data_ = nullptr;
    }
    ~Buffer() { delete[] data_; }
private:
    int* data_;
    size_t size_;
};`,
    explanation:
      "The member-initializer list already copies the pointer value out of `other`, so " +
      "without this line both `this->data_` and `other.data_` point at the same array. When " +
      "`other`'s destructor runs (and it will, since a moved-from object is still a live object " +
      "that gets destroyed normally), it calls `delete[] data_` on a pointer this object also " +
      "owns, freeing memory this object still thinks is valid: a double-free the moment " +
      "either object is destroyed or dereferenced again. Setting `other.data_ = nullptr;` " +
      "leaves `other` in the standard library's expected moved-from state: valid (its " +
      "destructor is safe, since `delete[] nullptr` is a no-op) but unspecified beyond that.",
    references: ["https://en.cppreference.com/w/cpp/language/move_constructor"],
  },
  {
    id: "cpp-fill-const-pointer-param-01",
    category: "cpp",
    difficulty: "easy",
    title: "A parameter that can read but not modify",
    tags: ["const-correctness", "pointers", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the parameter type so `print` can read through `p`, but the " +
      "function body would fail to compile if it tried to write through it.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `void print(/*BLANK_1*/ p) {
    std::cout << *p << std::endl;
}`,
    },
    blanks: [
      {
        id: "1",
        acceptedAnswers: ["const int*", "const int *", "int const*", "int const *"],
      },
    ],
    canonicalCode: `void print(const int* p) {
    std::cout << *p << std::endl;
}`,
    explanation:
      "`const int*` is a pointer to `const int`: the pointee is treated as const through " +
      "this pointer, so `*p = 5;` inside the function would be a compile error, while reading " +
      "`*p` remains fine. This is distinct from `int* const p` (a const pointer to non-const " +
      "int, which would let you modify `*p` but not reseat `p` itself); read pointer " +
      "declarations right-to-left from the parameter name to tell them apart.",
    references: ["https://en.cppreference.com/w/cpp/language/cv"],
  },
  {
    id: "cpp-fill-self-assignment-01",
    category: "cpp",
    difficulty: "medium",
    title: "Guard copy-assignment against self-assignment",
    tags: ["operator-overloading", "copy-assignment", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so that `buf = buf;` doesn't corrupt the object.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `Buffer& Buffer::operator=(const Buffer& other) {
    if (/*BLANK_1*/) {
        return *this;
    }
    delete[] data_;
    data_ = new int[other.size_];
    std::copy(other.data_, other.data_ + other.size_, data_);
    size_ = other.size_;
    return *this;
}`,
    },
    blanks: [{ id: "1", acceptedAnswers: ["this == &other", "&other == this"] }],
    canonicalCode: `Buffer& Buffer::operator=(const Buffer& other) {
    if (this == &other) {
        return *this;
    }
    delete[] data_;
    data_ = new int[other.size_];
    std::copy(other.data_, other.data_ + other.size_, data_);
    size_ = other.size_;
    return *this;
}`,
    explanation:
      "Without this check, `buf = buf;` binds `other` to the same object as `*this`. The " +
      "function then does `delete[] data_`, freeing the very array `other.data_` points at, " +
      "and immediately reads from that freed memory on the next line, undefined behavior " +
      "usually manifesting as garbage data or a crash. `this == &other` compares addresses " +
      "(not contents), so it correctly detects self-assignment even for objects that would " +
      "otherwise compare equal by value, and it's the standard idiom for exception- and " +
      "self-assignment-safe copy-assignment operators that manage a resource manually.",
    references: ["https://en.cppreference.com/w/cpp/language/copy_assignment"],
  },
  {
    id: "cpp-fill-virtual-destructor-01",
    category: "cpp",
    difficulty: "easy",
    title: "Make polymorphic deletion safe",
    tags: ["virtual-destructor", "polymorphism", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the missing keyword so that `delete` through a `Base*` " +
      "pointing at a `Derived` correctly runs both destructors.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Base {
public:
    /*BLANK_1*/ ~Base() { std::cout << "Base cleanup\\n"; }
};
class Derived : public Base {
public:
    ~Derived() { std::cout << "Derived cleanup\\n"; }
};`,
    },
    blanks: [{ id: "1", acceptedAnswers: ["virtual"] }],
    canonicalCode: `class Base {
public:
    virtual ~Base() { std::cout << "Base cleanup\\n"; }
};
class Derived : public Base {
public:
    ~Derived() { std::cout << "Derived cleanup\\n"; }
};`,
    explanation:
      "Without `virtual` on `~Base()`, calling `delete` through a `Base*` that actually points " +
      "at a `Derived` object only invokes `~Base()`: `~Derived()` is never called (skipping " +
      "any cleanup it does), and the behavior is technically undefined per the standard for " +
      "deleting a polymorphic object through a pointer to a base class with a non-virtual " +
      "destructor. Marking `~Base()` virtual makes the destructor call go through the vtable " +
      "like any other virtual call, so it correctly resolves to `~Derived()` first, which then " +
      "implicitly chains to `~Base()`.",
    references: ["https://en.cppreference.com/w/cpp/language/destructor"],
  },
  {
    id: "cpp-fill-unique-ptr-move-01",
    category: "cpp",
    difficulty: "easy",
    title: "Transfer ownership into a by-value parameter",
    tags: ["smart-pointers", "unique_ptr", "move-semantics", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank at the call site so ownership of the int actually " +
      "transfers into `consume`.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `void consume(std::unique_ptr<int> p) {
    std::cout << *p << std::endl;
}

int main() {
    std::unique_ptr<int> owner = std::make_unique<int>(99);
    consume(/*BLANK_1*/);
}`,
    },
    blanks: [{ id: "1", acceptedAnswers: ["std::move(owner)"] }],
    canonicalCode: `void consume(std::unique_ptr<int> p) {
    std::cout << *p << std::endl;
}

int main() {
    std::unique_ptr<int> owner = std::make_unique<int>(99);
    consume(std::move(owner));
}`,
    explanation:
      "`std::unique_ptr`'s copy constructor is deleted (it can only be moved, never copied), " +
      "so passing the lvalue `owner` directly would fail to compile. `std::move(owner)` " +
      "produces an rvalue reference, selecting `unique_ptr`'s move constructor to construct " +
      "the by-value parameter `p`, which transfers ownership of the pointee into `consume`. " +
      "After this call, `owner` is left in the moved-from empty state (`owner == nullptr`) and " +
      "must not be dereferenced.",
    references: ["https://en.cppreference.com/w/cpp/memory/unique_ptr"],
  },
  {
    id: "cpp-fill-static-assert-arithmetic-01",
    category: "cpp",
    difficulty: "medium",
    title: "Constrain a template to arithmetic types",
    tags: ["templates", "type-traits", "static_assert", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so `doubleIt` fails to compile for non-arithmetic " +
      "types like `std::string`, instead of silently doing the wrong thing.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `template <typename T>
T doubleIt(T x) {
    static_assert(/*BLANK_1*/, "T must be arithmetic");
    return x * 2;
}`,
    },
    blanks: [
      {
        id: "1",
        acceptedAnswers: [
          "std::is_arithmetic_v<T>",
          "std::is_arithmetic<T>::value",
        ],
      },
    ],
    canonicalCode: `template <typename T>
T doubleIt(T x) {
    static_assert(std::is_arithmetic_v<T>, "T must be arithmetic");
    return x * 2;
}`,
    explanation:
      "`std::is_arithmetic_v<T>` (the variable-template shorthand for " +
      "`std::is_arithmetic<T>::value`) is `true` for integer and floating-point types and " +
      "`false` otherwise. Placed in a `static_assert`, it turns an instantiation with an " +
      "unsupported `T` (say `doubleIt(std::string(\"hi\"))`, where `x * 2` wouldn't compile " +
      "anyway but with a much more confusing error buried in template internals) into a " +
      "clear, immediate compile error with your own message. This is the pre-C++20 idiom for " +
      "constraining a template; a `requires std::is_arithmetic_v<T>` clause is the C++20 " +
      "concepts equivalent.",
    references: ["https://en.cppreference.com/w/cpp/types/is_arithmetic"],
  },
  {
    id: "cpp-fill-erase-in-loop-01",
    category: "cpp",
    difficulty: "medium",
    title: "Erase elements while iterating a vector",
    tags: ["iterators", "iterator-invalidation", "stl", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so this loop correctly removes every even number " +
      "from `v` without invalidating `it` or skipping elements.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `for (auto it = v.begin(); it != v.end(); ) {
    if (*it % 2 == 0) {
        it = /*BLANK_1*/;
    } else {
        ++it;
    }
}`,
    },
    blanks: [{ id: "1", acceptedAnswers: ["v.erase(it)"] }],
    canonicalCode: `for (auto it = v.begin(); it != v.end(); ) {
    if (*it % 2 == 0) {
        it = v.erase(it);
    } else {
        ++it;
    }
}`,
    explanation:
      "`vector::erase` invalidates the erased element's iterator and every iterator after it " +
      "(since later elements shift down to fill the gap), so continuing to use `it` after " +
      "erasing without reassigning it is undefined behavior. `erase` returns a valid iterator " +
      "to the element that now occupies the erased position, which is exactly what the loop " +
      "needs to keep going correctly. Assigning that return value back to `it` is what makes " +
      "this the standard erase-while-iterating idiom, and it's why the loop's increment can't " +
      "just be `++it` in its for-clause: the even-number branch must NOT also increment.",
    references: ["https://en.cppreference.com/w/cpp/container/vector/erase"],
  },
  {
    id: "cpp-fill-weak-ptr-parent-01",
    category: "cpp",
    difficulty: "hard",
    title: "Break the parent/child reference cycle",
    tags: ["smart-pointers", "shared_ptr", "weak_ptr", "reference-cycle", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in both blanks so a child can still reach its parent, but the " +
      "parent/child relationship no longer leaks memory through a reference cycle.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Node {
public:
    std::/*BLANK_1*/<Node> parent;
    std::vector<std::shared_ptr<Node>> children;
};

void attach(std::shared_ptr<Node> parent, std::shared_ptr<Node> child) {
    child->parent = /*BLANK_2*/;
    parent->children.push_back(child);
}`,
    },
    blanks: [
      { id: "1", acceptedAnswers: ["weak_ptr"] },
      { id: "2", acceptedAnswers: ["parent"] },
    ],
    canonicalCode: `class Node {
public:
    std::weak_ptr<Node> parent;
    std::vector<std::shared_ptr<Node>> children;
};

void attach(std::shared_ptr<Node> parent, std::shared_ptr<Node> child) {
    child->parent = parent;
    parent->children.push_back(child);
}`,
    explanation:
      "If `parent` were also a `shared_ptr<Node>`, every parent/child pair would hold a " +
      "`shared_ptr` to each other: a reference cycle where each object's use_count never " +
      "reaches zero, so neither is ever destroyed even after every external `shared_ptr` to " +
      "the tree goes out of scope: a genuine memory leak, not a bug that crashes anything. " +
      "`std::weak_ptr<Node>` observes the object without contributing to its reference count, " +
      "breaking the cycle while still letting a child reach its parent via `parent.lock()` " +
      "(which returns a `shared_ptr` if the parent is still alive, or an empty one if not). A " +
      "`shared_ptr` converts implicitly to a `weak_ptr` on assignment, so `child->parent = " +
      "parent;` just works without an explicit cast.",
    references: ["https://en.cppreference.com/w/cpp/memory/weak_ptr"],
  },
  {
    id: "cpp-fill-rule-of-five-move-assign-01",
    category: "cpp",
    difficulty: "medium",
    title: "Supply the missing move-assignment operator",
    tags: ["rule-of-five", "move-semantics", "raii", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the missing move-assignment operator's signature so this class " +
      "satisfies the Rule of Five and a std::vector<Buffer> will move, not copy, " +
      "its elements when it reallocates.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Buffer {
public:
    Buffer(const Buffer& other);
    Buffer& operator=(const Buffer& other);
    Buffer(Buffer&& other) noexcept;
    /*BLANK_1*/ {
        if (this != &other) {
            delete[] data_;
            data_ = other.data_;
            size_ = other.size_;
            other.data_ = nullptr;
            other.size_ = 0;
        }
        return *this;
    }
    ~Buffer() { delete[] data_; }
private:
    int* data_;
    size_t size_;
};`,
    },
    blanks: [
      {
        id: "1",
        acceptedAnswers: [
          "Buffer& operator=(Buffer&& other) noexcept",
          "Buffer &operator=(Buffer&& other) noexcept",
          "Buffer& operator=(Buffer &&other) noexcept",
          "Buffer &operator=(Buffer &&other) noexcept",
        ],
      },
    ],
    canonicalCode: `class Buffer {
public:
    Buffer(const Buffer& other);
    Buffer& operator=(const Buffer& other);
    Buffer(Buffer&& other) noexcept;
    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            delete[] data_;
            data_ = other.data_;
            size_ = other.size_;
            other.data_ = nullptr;
            other.size_ = 0;
        }
        return *this;
    }
    ~Buffer() { delete[] data_; }
private:
    int* data_;
    size_t size_;
};`,
    explanation:
      "A class that manually manages a resource (here, `data_`) and defines any one of the " +
      "destructor, copy constructor, copy-assignment, move constructor, or move-assignment " +
      "operator almost always needs all five (the Rule of Five), since the compiler won't safely " +
      "synthesize the others once you've shown intent to manage the resource yourself. The " +
      "move-assignment operator's signature, `Buffer& operator=(Buffer&& other) noexcept`, " +
      "takes an rvalue reference so it's selected for assignments from expiring temporaries or " +
      "`std::move`-cast lvalues, and marking it `noexcept` is what lets containers like " +
      "`std::vector<Buffer>` move rather than copy elements during reallocation. Its body frees " +
      "this object's existing resource, steals `other`'s pointer, and nulls out `other`'s " +
      "pointer so both objects remain safely destructible afterward.",
    references: ["https://en.cppreference.com/w/cpp/language/rule_of_three"],
  },
  {
    id: "cpp-fill-strong-exception-guarantee-01",
    category: "cpp",
    difficulty: "hard",
    title: "Provide the strong exception guarantee with copy-and-swap",
    tags: ["exception-safety", "copy-and-swap", "raii", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so that if constructing `temp` throws, `*this` is " +
      "left completely unchanged: the strong exception guarantee.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Widget {
public:
    Widget& operator=(const Widget& other) {
        Widget temp(other);
        /*BLANK_1*/
        return *this;
    }
    void swap(Widget& other) noexcept {
        std::swap(data_, other.data_);
    }
private:
    int* data_;
};`,
    },
    blanks: [{ id: "1", acceptedAnswers: ["swap(temp);", "this->swap(temp);"] }],
    canonicalCode: `class Widget {
public:
    Widget& operator=(const Widget& other) {
        Widget temp(other);
        swap(temp);
        return *this;
    }
    void swap(Widget& other) noexcept {
        std::swap(data_, other.data_);
    }
private:
    int* data_;
};`,
    explanation:
      "`Widget temp(other);` does all of the work that could possibly fail (allocating and " +
      "copying) into a fully independent temporary, before touching `*this` at all. If that " +
      "constructor throws, `*this` hasn't been modified in any way and the exception propagates " +
      "cleanly. `swap(temp);` then exchanges `*this`'s and `temp`'s internals; because `swap` is " +
      "`noexcept` (a plain pointer exchange can't fail), this second step is guaranteed not to " +
      "throw, so the operator either fully succeeds or has no visible effect at all, exactly " +
      "the strong exception guarantee. `temp` then goes out of scope holding the old resource, " +
      "which its destructor releases. This is the classic copy-and-swap idiom, and it's why the " +
      "unified `operator=` also happens to be self-assignment-safe for free.",
    references: ["https://en.cppreference.com/w/cpp/language/copy_assignment"],
  },
  {
    id: "cpp-fill-atomic-memory-order-01",
    category: "cpp",
    difficulty: "hard",
    title: "Order the producer's write before the consumer's read",
    tags: ["atomics", "memory-model", "concurrency", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in both blanks so the consumer is guaranteed to see the fully " +
      "written `payload` once it observes `ready == true`.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::atomic<bool> ready{false};
int payload = 0;

void producer() {
    payload = 42;
    ready.store(true, /*BLANK_1*/);
}

void consumer() {
    while (!ready.load(/*BLANK_2*/)) {}
    std::cout << payload << std::endl;
}`,
    },
    blanks: [
      {
        id: "1",
        acceptedAnswers: ["std::memory_order_release", "std::memory_order::release"],
      },
      {
        id: "2",
        acceptedAnswers: ["std::memory_order_acquire", "std::memory_order::acquire"],
      },
    ],
    canonicalCode: `std::atomic<bool> ready{false};
int payload = 0;

void producer() {
    payload = 42;
    ready.store(true, std::memory_order_release);
}

void consumer() {
    while (!ready.load(std::memory_order_acquire)) {}
    std::cout << payload << std::endl;
}`,
    explanation:
      "`payload` is an ordinary, non-atomic `int`, so its write in `producer` and read in " +
      "`consumer` only have a defined happens-before relationship if the atomic operations " +
      "around them establish one, and a release store paired with an acquire load does exactly " +
      "that. `memory_order_release` on the store prevents any earlier memory operation " +
      "(including `payload = 42;`) from being reordered after it, and `memory_order_acquire` on " +
      "the load prevents any later operation (the `std::cout` read of `payload`) from being " +
      "reordered before it. Once the consumer's load observes `true`, the release-acquire pair " +
      "guarantees it also sees every write that happened-before the release in the producer. " +
      "If either side used `memory_order_relaxed` instead, `ready` itself would still be read " +
      "and written atomically, but no happens-before edge would exist, so the read of " +
      "`payload` would be a data race with no guarantee of seeing `42`.",
    references: ["https://en.cppreference.com/w/cpp/atomic/memory_order"],
  },
  {
    id: "cpp-fill-perfect-forwarding-01",
    category: "cpp",
    difficulty: "hard",
    title: "Preserve an argument's value category through a wrapper",
    tags: ["templates", "forwarding-references", "move-semantics", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in both blanks so `wrapper` accepts both lvalues and rvalues and " +
      "forwards each to `process` with its original value category preserved.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `template <typename T>
void wrapper(/*BLANK_1*/ arg) {
    process(/*BLANK_2*/);
}`,
    },
    blanks: [
      { id: "1", acceptedAnswers: ["T&&", "T &&"] },
      { id: "2", acceptedAnswers: ["std::forward<T>(arg)"] },
    ],
    canonicalCode: `template <typename T>
void wrapper(T&& arg) {
    process(std::forward<T>(arg));
}`,
    explanation:
      "`T&&` in a deduced template context is a forwarding reference, not an rvalue reference: " +
      "reference collapsing means it binds to an lvalue argument by deducing `T` as `U&` " +
      "(collapsing to `arg`'s type `U&`), and to an rvalue by deducing `T` as plain `U`. Naming " +
      "`arg` inside the body always yields an lvalue (it has a name), so passing it straight " +
      "through would always call `process`'s lvalue overload even when the original argument " +
      "was an rvalue. `std::forward<T>(arg)` conditionally casts `arg` back to an rvalue only " +
      "when `T` was deduced as a non-reference type, exactly reconstructing the original value " +
      "category, which is why `std::forward` (not `std::move`, which unconditionally casts to " +
      "rvalue) is the correct tool for a forwarding wrapper.",
    references: ["https://en.cppreference.com/w/cpp/utility/forward"],
  },
  {
    id: "cpp-fill-crtp-01",
    category: "cpp",
    difficulty: "hard",
    title: "Call into the derived class through CRTP",
    tags: ["crtp", "templates", "static-polymorphism", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in both blanks so `Base::interface()` correctly dispatches to " +
      "`Concrete::implementation()` at compile time, with no virtual functions involved.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `template <typename Derived>
class Base {
public:
    void interface() {
        static_cast</*BLANK_1*/&>(*this).implementation();
    }
};

class Concrete : public /*BLANK_2*/<Concrete> {
public:
    void implementation() { std::cout << "Concrete\\n"; }
};`,
    },
    blanks: [
      { id: "1", acceptedAnswers: ["Derived"] },
      { id: "2", acceptedAnswers: ["Base"] },
    ],
    canonicalCode: `template <typename Derived>
class Base {
public:
    void interface() {
        static_cast<Derived&>(*this).implementation();
    }
};

class Concrete : public Base<Concrete> {
public:
    void implementation() { std::cout << "Concrete\\n"; }
};`,
    explanation:
      "In the Curiously Recurring Template Pattern, `Concrete` inherits from `Base<Concrete>`, " +
      "passing itself as `Base`'s template argument, so inside `Base`, `Derived` is a concrete, " +
      "fully-known type at compile time, not a runtime abstraction. `static_cast<Derived&>" +
      "(*this)` is safe (not `dynamic_cast`, which would imply runtime polymorphism this pattern " +
      "deliberately avoids) precisely because every actual instantiation of `Base<Derived>` is " +
      "known to be a base subobject of exactly that `Derived`. Calling `.implementation()` on " +
      "the cast reference resolves at compile time to `Concrete::implementation()` with no " +
      "vtable indirection at all. CRTP achieves the shape of polymorphism (a common interface " +
      "dispatching to per-type behavior) with zero runtime dispatch cost.",
    references: ["https://en.cppreference.com/w/cpp/language/crtp"],
  },
  {
    id: "cpp-fill-optional-01",
    category: "cpp",
    difficulty: "easy",
    title: "Signal absence with std::optional",
    tags: ["std-optional", "modern-cpp", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so `findValue` returns an empty `std::optional<int>` " +
      "when `target` isn't found in `v`, rather than any particular int value.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::optional<int> findValue(const std::vector<int>& v, int target) {
    auto it = std::find(v.begin(), v.end(), target);
    if (it == v.end()) {
        return /*BLANK_1*/;
    }
    return *it;
}`,
    },
    blanks: [{ id: "1", acceptedAnswers: ["std::nullopt", "{}"] }],
    canonicalCode: `std::optional<int> findValue(const std::vector<int>& v, int target) {
    auto it = std::find(v.begin(), v.end(), target);
    if (it == v.end()) {
        return std::nullopt;
    }
    return *it;
}`,
    explanation:
      "Before `std::optional`, a \"not found\" `int` result had to be smuggled through an " +
      "out-of-band sentinel value (like `-1`) that the caller had to know to check for, or an " +
      "extra out-parameter/bool pair. `std::optional<int>` makes absence a first-class part of " +
      "the return type itself, and `std::nullopt` is the canonical constant representing that " +
      "empty state, implicitly convertible to any `std::optional<T>`. The caller then checks for " +
      "a value with `if (result)` or `result.has_value()` before calling `*result` or " +
      "`result.value()`, making the possibility of absence explicit and checkable at compile " +
      "time rather than relying on a convention the caller might forget.",
    references: ["https://en.cppreference.com/w/cpp/utility/optional"],
  },
  {
    id: "cpp-fill-guaranteed-copy-elision-01",
    category: "cpp",
    difficulty: "medium",
    title: "Rely on guaranteed copy elision, not just RVO",
    tags: ["copy-elision", "rvo", "modern-cpp", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so `makeWidget` is guaranteed (as of C++17, not " +
      "merely permitted) to construct the `Widget` directly in the caller's storage, printing " +
      "only \"construct\" and never \"copy\" or \"move\".",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `struct Widget {
    Widget() { std::cout << "construct\\n"; }
    Widget(const Widget&) { std::cout << "copy\\n"; }
    Widget(Widget&&) { std::cout << "move\\n"; }
};

/*BLANK_1*/ makeWidget() {
    return Widget{};
}`,
    },
    blanks: [{ id: "1", acceptedAnswers: ["Widget", "auto"] }],
    canonicalCode: `struct Widget {
    Widget() { std::cout << "construct\\n"; }
    Widget(const Widget&) { std::cout << "copy\\n"; }
    Widget(Widget&&) { std::cout << "move\\n"; }
};

Widget makeWidget() {
    return Widget{};
}`,
    explanation:
      "With the return type declared `Widget` (by value) and the return statement a prvalue of " +
      "that exact type (`Widget{}`), C++17 mandates that no temporary is materialized at all: " +
      "the `Widget{}` is constructed directly in the storage the caller provides for the result. " +
      "This is stronger than pre-C++17 RVO/NRVO, which were only permitted optimizations (a " +
      "compiler could still legally copy or move); as of C++17, [class.copy.elision] requires " +
      "elision for this prvalue case, so the copy and move constructors need not even be " +
      "accessible. Had the return type instead been `Widget&` or the function returned a named " +
      "local variable, the guarantee wouldn't apply the same way: a named local still only " +
      "qualifies for the weaker, optional NRVO.",
    references: ["https://en.cppreference.com/w/cpp/language/copy_elision"],
  },
  {
    id: "cpp-fill-noexcept-move-01",
    category: "cpp",
    difficulty: "medium",
    title: "Let std::vector move elements during reallocation",
    tags: ["noexcept", "move-semantics", "std-vector", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so that when a std::vector<Buffer> reallocates, it " +
      "moves existing elements into the new storage instead of copying them.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Buffer {
public:
    Buffer(Buffer&& other) /*BLANK_1*/
        : data_(other.data_), size_(other.size_) {
        other.data_ = nullptr;
    }
    ~Buffer() { delete[] data_; }
private:
    int* data_;
    size_t size_;
};`,
    },
    blanks: [{ id: "1", acceptedAnswers: ["noexcept", "noexcept(true)"] }],
    canonicalCode: `class Buffer {
public:
    Buffer(Buffer&& other) noexcept
        : data_(other.data_), size_(other.size_) {
        other.data_ = nullptr;
    }
    ~Buffer() { delete[] data_; }
private:
    int* data_;
    size_t size_;
};`,
    explanation:
      "When `std::vector` grows past its capacity, it must relocate every existing element into " +
      "new storage, and it internally chooses between moving and copying via " +
      "`std::move_if_noexcept`. If a move could throw partway through relocation, the vector " +
      "could be left in a corrupted, partially-moved-from state with no way to roll back, " +
      "violating the strong exception guarantee `push_back` otherwise offers, so the standard " +
      "requires falling back to the (slower, but safely rollback-able) copy constructor whenever " +
      "the move constructor isn't marked `noexcept`. Marking `Buffer`'s move constructor " +
      "`noexcept` tells `std::vector` it's safe to use it during reallocation, restoring the " +
      "expected O(1)-amortized, move-based growth behavior instead of silently degrading to " +
      "copies.",
    references: ["https://en.cppreference.com/w/cpp/utility/move_if_noexcept"],
  },
  {
    id: "cpp-fill-lambda-capture-dangling-01",
    category: "cpp",
    difficulty: "medium",
    title: "Capture a local counter in a returned lambda",
    tags: ["lambdas", "captures", "dangling-reference", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so the returned lambda keeps its own counter that " +
      "stays valid after `makeCounter` returns, instead of referencing a destroyed local.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::function<int()> makeCounter() {
    int count = 0;
    return [/*BLANK_1*/]() mutable {
        return ++count;
    };
}`,
    },
    blanks: [{ id: "1", acceptedAnswers: ["count", "=", "count = count"] }],
    canonicalCode: `std::function<int()> makeCounter() {
    int count = 0;
    return [count]() mutable {
        return ++count;
    };
}`,
    explanation:
      "`count` is a local variable of `makeCounter` with automatic storage duration that is " +
      "destroyed when `makeCounter` returns, but the lambda itself outlives that call, since " +
      "it's returned to (and invoked later by) the caller. Capturing it by reference (`[&count]` " +
      "or `[&]`) would store a reference to that already-destroyed stack slot, so every " +
      "subsequent call through the returned `std::function` would read and write freed stack " +
      "memory: a classic dangling-reference bug. Capturing by value (`[count]`) instead copies the " +
      "`int` into the closure object, which then owns an independent copy with the closure's own " +
      "lifetime; `mutable` is required because by-value captures are `const` inside `operator()` " +
      "by default, and this lambda needs to increment its copy across calls.",
    references: ["https://en.cppreference.com/w/cpp/language/lambda"],
  },
  {
    id: "cpp-fill-enable-shared-from-this-01",
    category: "cpp",
    difficulty: "hard",
    title: "Hand out a shared_ptr to yourself safely",
    tags: ["shared_ptr", "enable_shared_from_this", "smart-pointers", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so `getShared` returns a `shared_ptr<Session>` that " +
      "shares the same control block as whatever `shared_ptr` already owns `this`.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `class Session : public std::enable_shared_from_this<Session> {
public:
    std::shared_ptr<Session> getShared() {
        return /*BLANK_1*/;
    }
};`,
    },
    blanks: [{ id: "1", acceptedAnswers: ["shared_from_this()", "this->shared_from_this()"] }],
    canonicalCode: `class Session : public std::enable_shared_from_this<Session> {
public:
    std::shared_ptr<Session> getShared() {
        return shared_from_this();
    }
};`,
    explanation:
      "`std::enable_shared_from_this<Session>` gives `Session` a hidden `std::weak_ptr<Session>` " +
      "that gets initialized to observe the correct control block the first time a `shared_ptr` " +
      "takes ownership of the object. `shared_from_this()` locks that `weak_ptr`, producing a new " +
      "`shared_ptr<Session>` that shares the exact same control block (and reference count) as " +
      "every other `shared_ptr` already managing the object. The unsafe alternative, `return " +
      "std::shared_ptr<Session>(this);`, would construct a brand-new, wholly unrelated control " +
      "block with its own independent reference count, leading to the object being destroyed " +
      "twice (once by each control block reaching zero), a double-free the moment both go out of " +
      "scope.",
    references: ["https://en.cppreference.com/w/cpp/memory/enable_shared_from_this"],
  },
  {
    id: "cpp-fill-tie-unpack-01",
    category: "cpp",
    difficulty: "medium",
    title: "Unpack a pair into already-declared variables",
    tags: ["std-tie", "structured-bindings", "std-pair", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so the pair returned by `insert` unpacks into the " +
      "already-declared `it` and `inserted` variables.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `std::map<std::string, int> m;
std::map<std::string, int>::iterator it;
bool inserted;

/*BLANK_1*/ = m.insert({"key", 42});`,
    },
    blanks: [{ id: "1", acceptedAnswers: ["std::tie(it, inserted)"] }],
    canonicalCode: `std::map<std::string, int> m;
std::map<std::string, int>::iterator it;
bool inserted;

std::tie(it, inserted) = m.insert({"key", 42});`,
    explanation:
      "`std::map::insert` returns `std::pair<iterator, bool>`: the iterator to the (possibly " +
      "pre-existing) element and whether an insertion actually happened. `std::tie(it, " +
      "inserted)` builds a `std::tuple` of lvalue references bound to the already-declared `it` " +
      "and `inserted` variables, so assigning the pair to it copies each member into the " +
      "corresponding pre-existing variable via `std::tuple`'s converting assignment from " +
      "`std::pair`. A structured binding (`auto [it, inserted] = m.insert(...)`) looks similar " +
      "but always introduces brand-new variables scoped to the declaration and cannot target " +
      "ones that already exist in an outer scope, which is exactly the situation `std::tie` is " +
      "for.",
    references: ["https://en.cppreference.com/w/cpp/utility/tuple/tie"],
  },
  {
    id: "cpp-fill-unique-ptr-custom-deleter-01",
    category: "cpp",
    difficulty: "hard",
    title: "Close a FILE* instead of deleting it",
    tags: ["smart-pointers", "unique_ptr", "raii", "fill-in-blank"],
    type: "fill-in-blank",
    prompt:
      "Fill in the blank so `file` automatically closes the FILE* with " +
      "`closeFile` when it goes out of scope, instead of calling `delete` on it.",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `void closeFile(FILE* fp) {
    if (fp) std::fclose(fp);
}

/*BLANK_1*/ file(std::fopen("data.txt", "r"), closeFile);`,
    },
    blanks: [
      {
        id: "1",
        acceptedAnswers: [
          "std::unique_ptr<FILE, decltype(&closeFile)>",
          "std::unique_ptr<FILE, void(*)(FILE*)>",
        ],
      },
    ],
    canonicalCode: `void closeFile(FILE* fp) {
    if (fp) std::fclose(fp);
}

std::unique_ptr<FILE, decltype(&closeFile)> file(std::fopen("data.txt", "r"), closeFile);`,
    explanation:
      "`FILE*` is a C-API handle that must be released with `std::fclose`, not `delete`: " +
      "`std::unique_ptr`'s default deleter (which calls `delete`) would be undefined behavior " +
      "here, since the pointee was never allocated with `new`. `std::unique_ptr`'s second " +
      "template parameter lets you supply a custom deleter type; `decltype(&closeFile)` yields " +
      "the function pointer type `void(*)(FILE*)`, matching what `unique_ptr` needs to store and " +
      "invoke on destruction. The constructor then takes both the raw pointer from `fopen` and " +
      "`closeFile` itself (a value of that function pointer type) as the deleter instance to " +
      "store, so `file`'s destructor calls `closeFile(file.get())` automatically. This is the " +
      "standard RAII wrapper for `FILE*`, sockets, and other non-`new`-allocated resources.",
    references: ["https://en.cppreference.com/w/cpp/memory/unique_ptr"],
  },
  {
    id: "cpp-seq-points-01",
    category: "cpp",
    difficulty: "hard",
    title: "Two increments of the same variable in one statement",
    tags: ["sequence-points", "undefined-behavior", "evaluation-order"],
    type: "trace",
    prompt:
      "Compiled as C++17 or later, which tightened several evaluation-order rules, what does the statement `i = i++ + ++i;` do?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <iostream>

int main() {
    int i = 5;
    i = i++ + ++i;
    std::cout << i << std::endl;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Unspecified behavior: the standard permits a small set of outcomes such as 13 or 14, and the compiler must pick one consistently.",
        "C++17 fixed the evaluation order of operands, so this now produces one specific portable value on every conforming compiler.",
        "Compile error: a scalar object may not be modified twice within one expression, and the front end is required to reject it.",
        "Undefined behavior, still. The two modifications of i are unsequenced with respect to each other, which C++17 did not change.",
      ],
      correctIndex: 3,
    },
    explanation:
      "Before C++17 this expression had two separate defects. The order of evaluation of the two operands of `+` was unspecified, and, independently and more seriously, `i` was modified twice with nothing sequencing those modifications relative to each other, which [intro.execution] makes undefined outright. C++17, via P0145, tightened sequencing for specific constructs: the right operand of a built-in assignment is now sequenced before the left, and several other operators gained left-to-right guarantees. Binary `+` was not among them, so `i++` and `++i` remain unsequenced with respect to each other, and the modification-twice rule is untouched regardless. The statement is therefore undefined in C++17, C++20 and C++23 exactly as it was in C++11. Compilers know it too: Clang emits `warning: multiple unsequenced modifications to 'i' [-Wunsequenced]` and then prints 12, which is neither of the two values people usually predict. The common misreading is that P0145 fixed expressions of this shape; it fixed the order in which subexpressions run, not the legality of writing the same object twice without sequencing.",
    references: [
      "https://en.cppreference.com/w/cpp/language/eval_order",
      "https://wg21.link/p0145",
    ],
  },
  {
    id: "cpp-raii-rule-of-three-01",
    category: "cpp",
    difficulty: "medium",
    title: "RAII file handle passed by value",
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
        "Well-defined: RAII guarantees the resource is released once, however many copies exist",
        "Compile error: FileHandle cannot be passed by value while it manages a resource",
        "Well-defined: fclose() on an already-closed FILE* is a documented no-op",
        "Undefined behavior: fh and original each fclose() the very same FILE*",
      ],
      correctIndex: 3,
    },
    explanation:
      "RAII by itself only says 'acquire in the constructor, release in the destructor'. It says " +
      "nothing about what a copy means, and that gap is the whole bug here. `FileHandle` declares a " +
      "destructor but no copy constructor or copy assignment, and a user-declared destructor suppresses " +
      "only the implicit *move* operations; the copy operations are still generated (deprecated, but " +
      "generated) and do a shallow member-wise copy. That copies the `FILE*` value, not the underlying " +
      "OS file description. `process(original)` therefore gives `fh` a bit-for-bit duplicate of " +
      "`original.fp_`. When `process` returns, `~FileHandle()` calls `fclose(fp_)`; when `main` ends, " +
      "`original`'s destructor calls `fclose()` on the same pointer again, which is a double close and " +
      "undefined behavior. The Rule of Three exists for precisely this shape of class: anything owning " +
      "a raw resource has to define or `= delete` its copy constructor and copy assignment (and " +
      "usually provide move operations) rather than inherit the member-wise defaults.",
    references: ["https://en.cppreference.com/w/cpp/language/rule_of_three"],
  },
  {
    id: "cpp-lambda-ref-param-dangling-01",
    category: "cpp",
    difficulty: "hard",
    title: "Returning a std::function that captures its parameter by reference",
    tags: ["lambda", "std-function", "dangling-reference", "lifetime"],
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
        "Undefined behavior: the stored callable reads through a reference to an already-destroyed temporary",
        "Prints \"hello\": std::function extends the lifetime of whatever the wrapped callable refers to",
        "Compile error: a reference parameter cannot itself be captured by reference",
        "Prints an empty string, std::string's buffer having been zeroed out by its destructor",
      ],
      correctIndex: 0,
    },
    explanation:
      "`makeGetter`'s parameter `s` is a `const std::string&` bound to the temporary " +
      "`std::string(\"hello\")` created at the call site. Lifetime extension applies only when a " +
      "reference is bound directly to a temporary in its own initialization; binding to a function " +
      "parameter buys nothing, so that temporary dies at the end of the full expression containing the " +
      "call to `makeGetter`. The lambda `[&s]` captures `s` by reference, so the callable stored " +
      "inside the returned `std::function` ends up referring to storage that is already gone. " +
      "`std::function` owns a copy of the closure object and nothing else; it has no way to know " +
      "what the closure's references point at, let alone keep those alive. Calling `getter()` reads " +
      "through the dead reference, which is undefined behavior. Capturing by value with `[s]` gives the " +
      "closure its own copy and fixes it.",
  },
];
