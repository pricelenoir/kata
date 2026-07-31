import type { TraceQuestion } from "@/types/question";

export const rustQuestions: TraceQuestion[] = [
  {
    id: "rust-move-semantics-01",
    category: "rust",
    difficulty: "medium",
    title: "Using a String after passing it to a function by value",
    tags: ["ownership", "move-semantics", "compile-error"],
    type: "trace",
    prompt: "What happens when this code is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn take_ownership(s: String) {
    println!("took: {}", s);
}

fn main() {
    let s = String::from("hello");
    take_ownership(s);
    println!("still have: {}", s);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'Prints "took: hello" then "still have: hello"',
        "Compile error: `take_ownership` must take `s` by reference, not by value",
        "Compiles and runs, but `s` is left in a valid-but-unspecified state after the call",
        "Compile error on the final `println!`: borrow of moved value: `s`",
      ],
      correctIndex: 3,
    },
    explanation:
      "`String` does not implement `Copy`, so passing `s` by value into `take_ownership` " +
      "*moves* it: ownership of the heap buffer transfers into the function, and the " +
      "binding `s` in `main` is no longer valid. `rustc` rejects the subsequent " +
      "`println!(\"still have: {}\", s)` with error[E0382]: borrow of moved value: `s`, " +
      'pointing at the move site ("value moved here") and the later use ("value borrowed ' +
      'here after move"). This is a deliberate contrast with C++: `std::move(s)` (or ' +
      "passing by value) in C++ *compiles fine* and leaves the moved-from object in a " +
      "valid-but-unspecified state. Using it afterward is legal but silently wrong, a " +
      "runtime footgun that only shows up as a bug report, not a build failure. Rust's " +
      "move semantics turn that same class of bug into a compile-time error: the compiler " +
      "statically tracks which bindings still own their value and refuses to compile code " +
      "that reads through one that's been moved out from under it. The fix is to either " +
      "clone (`s.clone()`), borrow (`&s`), or restructure so the move happens last.",
    references: [
      "https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#ways-that-variables-and-data-interact-move",
      "https://doc.rust-lang.org/error_codes/E0382.html",
    ],
  },
  {
    id: "rust-borrow-xor-mutable-01",
    category: "rust",
    difficulty: "medium",
    title: "Holding a reference into a Vec across a push",
    tags: ["borrowing", "aliasing", "compile-error"],
    type: "trace",
    prompt: "What happens when this code is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn main() {
    let mut v = vec![1, 2, 3];
    let first = &v[0];
    v.push(4);
    println!("first: {}", first);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints \"first: 1\"; `push` reallocates, but `first` still holds the old value",
        "Compile error: cannot borrow `v` as mutable because it is also borrowed as immutable",
        "Undefined behavior: `first` may dangle once `push` reallocates the backing buffer",
        "Compiles fine; `first` and the `push` call operate on unrelated parts of `v`",
      ],
      correctIndex: 1,
    },
    explanation:
      "Rust's core aliasing rule is XOR mutability: for any value, you may have *either* " +
      "one live `&mut` borrow *or* any number of live `&` borrows, never both at once. " +
      "Here `first` is an immutable borrow of `v[0]` that is still alive (it's used in the " +
      "final `println!`), so the `v.push(4)` on the next line (which needs `&mut v`) " +
      "conflicts with it. `rustc` reports error[E0502]: cannot borrow `v` as mutable " +
      "because it is also borrowed as immutable, annotating `first`'s borrow as \"immutable " +
      'borrow occurs here" and the push as "mutable borrow occurs here", with "immutable ' +
      'borrow later used here" pointing at the `println!`. This rule exists precisely to ' +
      "rule out the underlying memory-safety hazard: `Vec::push` can reallocate the " +
      "backing buffer, which would leave `first` pointing at freed memory. In C++ that's " +
      "exactly the kind of iterator/reference invalidation bug that compiles and only " +
      "misbehaves at runtime. Rust's borrow checker catches it statically instead.",
    references: [
      "https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html#mutable-references",
      "https://doc.rust-lang.org/error_codes/E0502.html",
    ],
  },
  {
    id: "rust-dangling-ref-compile-error-01",
    category: "rust",
    difficulty: "medium",
    title: "Returning a reference to a local with an explicit lifetime annotation",
    tags: ["lifetime", "references", "compile-error"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn get_name<'a>() -> &'a String {
    let name = String::from("Alice");
    &name
}

fn main() {
    let r = get_name();
    println!("{}", r);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'Prints "Alice"',
        "Undefined behavior: `r` dangles into `get_name`'s dead stack frame",
        "Compile error: cannot return reference to local variable `name`",
        "Prints an empty string",
      ],
      correctIndex: 2,
    },
    explanation:
      "`name` is a local `String` owned by `get_name` and dropped the moment the function " +
      "returns. Giving the return type an explicit lifetime, `&'a String`, doesn't grant " +
      "`name` that lifetime: it only tells the compiler what the caller is promised, and " +
      "the compiler then checks whether the function can actually deliver on that promise. " +
      "It can't: `&name` borrows a value that's about to be destroyed. `rustc` rejects this " +
      "with error[E0515]: cannot return reference to local variable `name`, annotated " +
      '"returns a reference to data owned by the current function". This is the direct ' +
      "Rust analog of the classic C++ bug (a function returning `const std::string&` to a " +
      "local), but where C++ happily compiles it and leaves you with a dangling reference " +
      "whose use is undefined behavior (it may \"work\" by accident until stack memory " +
      "gets reused), Rust's borrow checker proves the reference would outlive its referent " +
      "and refuses to build the program at all. The bug is caught before it ever ships, " +
      "not discovered in production.",
    references: [
      "https://doc.rust-lang.org/error_codes/E0515.html",
      "https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html",
    ],
  },
  {
    id: "rust-static-lifetime-01",
    category: "rust",
    difficulty: "hard",
    title: "Box::leak and the 'static lifetime bound",
    tags: ["lifetime", "static", "heap-allocation"],
    type: "trace",
    prompt:
      "This function takes a heap-allocated `String` and hands back a `&'static str` " +
      "pointing at it. Does this compile, and is the returned reference genuinely valid " +
      "for `'static`?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn make_static(s: String) -> &'static str {
    Box::leak(s.into_boxed_str())
}

fn main() {
    let owned = String::from("hello from the heap");
    let leaked: &'static str = make_static(owned);
    println!("{}", leaked);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: `'static` requires a compile-time constant, and `s` is heap-allocated at runtime",
        "Compile error: `s` is dropped at the end of `make_static`, leaving a dangling reference",
        "Compiles, but reading through `leaked` is technically undefined behavior",
        "Compiles and runs correctly, printing \"hello from the heap\"",
      ],
      correctIndex: 3,
    },
    explanation:
      "The common misconception is that `'static` means \"a compile-time constant or " +
      "string literal baked into the binary.\" It doesn't: `'static` only means \"this " +
      "reference is valid for the remainder of the program's execution.\" String literals " +
      "(`&'static str`) satisfy that because they live in the binary's read-only data for " +
      "the whole run, but that's just one way to earn the bound, not the definition of it. " +
      "`Box::leak` is the other, more surprising way: it consumes a `Box<T>` and returns " +
      "`&'static mut T`, intentionally forgetting to ever free the allocation. Because " +
      "nothing will deallocate it before the process exits, the compiler can soundly hand " +
      "out a `'static` reference to it: the memory really will outlive every other borrow " +
      "in the program, it's just leaked rather than const. This code compiles cleanly and " +
      "prints \"hello from the heap\": `s.into_boxed_str()` converts the owned `String` " +
      "into a `Box<str>`, and `Box::leak` hands back exactly the `&'static str` the " +
      "signature promises. The tradeoff is real, though: that memory is never reclaimed " +
      "for the life of the process, so `Box::leak` is a deliberate, situational tool (e.g. " +
      "for data that's genuinely meant to live forever), not a casual way to dodge lifetime errors.",
    references: [
      "https://doc.rust-lang.org/std/boxed/struct.Box.html#method.leak",
      "https://doc.rust-lang.org/reference/trait-bounds.html#lifetime-bounds",
      "https://doc.rust-lang.org/rust-by-example/scope/lifetime/static_lifetime.html",
    ],
  },
  {
    id: "rust-lifetime-elision-01",
    category: "rust",
    difficulty: "hard",
    title: "Lifetime elision with one input reference vs. two",
    tags: ["lifetime", "elision", "compile-error"],
    type: "trace",
    prompt:
      "Both functions below take `&str` and return `&str` with no explicit lifetime " +
      "annotations. Which one(s) compile as written?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `// (1)
fn first_word(s: &str) -> &str {
    s.split_whitespace().next().unwrap_or("")
}

// (2)
fn longer(a: &str, b: &str) -> &str {
    if a.len() >= b.len() { a } else { b }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both compile; the compiler infers lifetimes for both from the elision rules",
        "Only `first_word` compiles; `longer` fails with a missing lifetime specifier error",
        "Only `longer` compiles; `first_word` needs an explicit lifetime on its return type",
        "Neither compiles; any free function returning `&str` requires explicit lifetime annotations",
      ],
      correctIndex: 1,
    },
    explanation:
      "The elision rules apply in order: (1) each elided reference parameter gets its own " +
      "fresh lifetime; (2) if there is *exactly one* input lifetime (elided or explicit), " +
      "it is assigned to every elided output lifetime; (3) if one of the parameters is " +
      "`&self`/`&mut self`, its lifetime is assigned to every elided output lifetime. " +
      "`first_word(s: &str) -> &str` has one input reference, so rule 2 fires: the " +
      "compiler desugars it to `fn first_word<'a>(s: &'a str) -> &'a str` and it compiles " +
      "with no annotations needed. `longer(a: &str, b: &str) -> &str` has *two* input " +
      "references, so rule 1 gives them independent lifetimes `'a` and `'b`, rule 2 " +
      "doesn't apply (more than one input lifetime), and rule 3 doesn't apply (no " +
      "`&self`). The compiler is left with an elided output lifetime and no rule to " +
      "resolve it, so `rustc` rejects it with error[E0106]: missing lifetime specifier, " +
      'noting "this function\'s return type contains a borrowed value, but the signature ' +
      'does not say whether it is borrowed from `a` or `b`." This isn\'t a defect in the ' +
      "elision rules; it's the compiler correctly refusing to guess: the caller's borrow " +
      "checking downstream genuinely depends on which parameter the return value aliases, " +
      "so `longer` must be written as `fn longer<'a>(a: &'a str, b: &'a str) -> &'a str`.",
    references: [
      "https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html#lifetime-elision",
      "https://doc.rust-lang.org/reference/lifetime-elision.html",
      "https://doc.rust-lang.org/error_codes/E0106.html",
    ],
  },
  {
    id: "rust-struct-lifetime-param-01",
    category: "rust",
    difficulty: "medium",
    title: "Reference-typed struct fields and lifetime elision",
    tags: ["lifetime", "structs", "compile-error"],
    type: "trace",
    prompt: "What happens when this code is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `struct Parser {
    input: &str,
    pos: usize,
}

fn main() {
    let text = String::from("1 + 2");
    let p = Parser { input: &text, pos: 0 };
    println!("{}", p.input);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compiles fine; Rust infers that `input` borrows from `text` in `main`",
        "Compiles, but `p.input` becomes a dangling pointer once `text` is dropped",
        "Compile error: struct fields cannot hold references, only owned types like `String`",
        "Compile error: missing lifetime specifier; `Parser` needs a lifetime parameter",
      ],
      correctIndex: 3,
    },
    explanation:
      "Unlike a function parameter, a struct definition has no call site the compiler can " +
      "look at to infer how long a reference field needs to stay valid, so elision never " +
      "applies to struct fields, and any reference-typed field requires an explicit " +
      "lifetime parameter on the struct itself. `rustc` rejects `input: &str` with " +
      "error[E0106]: missing lifetime specifier, suggesting exactly the fix: " +
      "`struct Parser<'a> { input: &'a str, pos: usize }`. That `'a` isn't decorative: " +
      "it's a constraint the compiler enforces on every instance: a `Parser<'a>` cannot " +
      "outlive the data `'a` refers to, and the borrow checker rejects any attempt to let " +
      "a `Parser` (or a reference to one) escape the scope of the string it borrows from. " +
      "In other words, the lifetime parameter makes the struct's implicit dependency on " +
      "borrowed data explicit and checkable, closing off the whole class of \"struct holds " +
      "a pointer to something that's already gone\" bugs that are easy to introduce " +
      "silently in C++.",
    references: [
      "https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html#lifetime-annotations-in-struct-definitions",
      "https://doc.rust-lang.org/error_codes/E0106.html",
    ],
  },
  {
    id: "rust-two-mutable-borrows-01",
    category: "rust",
    difficulty: "medium",
    title: "Creating two mutable references to the same value",
    tags: ["borrowing", "aliasing", "compile-error"],
    type: "trace",
    prompt: "What happens when this code is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `struct Counter {
    value: i32,
}

impl Counter {
    fn increment(&mut self) {
        self.value += 1;
    }
}

fn main() {
    let mut c = Counter { value: 0 };
    let r1 = &mut c;
    let r2 = &mut c;
    r1.increment();
    r2.increment();
    println!("{}", c.value);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints 2; both `increment()` calls apply in sequence",
        "Compile error: cannot borrow `c` as mutable more than once at a time",
        "Undefined behavior: `r1` and `r2` alias the same memory as two mutable pointers",
        "Compile error: `Counter` must derive `Copy` before it can be borrowed twice",
      ],
      correctIndex: 1,
    },
    explanation:
      "This is the same aliasing rule as an `&mut` vs `&` conflict, just applied to two " +
      "`&mut` borrows instead: at most one mutable borrow of a value may be alive at a " +
      "time. A second `&mut` cannot coexist with a first one that is still in use, and it " +
      "makes no difference that the two are dereferenced on separate lines. Here `r1 = &mut " +
      "c` is still alive (it's used in `r1.increment()` after `r2` is created), so `let " +
      "r2 = &mut c;` conflicts with it. `rustc` reports error[E0499]: cannot borrow `c` as " +
      'mutable more than once at a time, marking `r1`\'s borrow as "first mutable borrow ' +
      'occurs here" and `r2`\'s as "second mutable borrow occurs here." The rule exists ' +
      "because two live `&mut` references to the same data would let two independent code " +
      "paths mutate it unsynchronized, exactly the aliasing hazard that, in C++, two " +
      "non-const pointers/references to the same object allow silently and that can " +
      "produce subtle bugs (or, in concurrent code, full-blown data races). Rust's borrow " +
      "checker rules it out statically, in single-threaded code exactly the same way it " +
      "does across threads.",
    references: [
      "https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html#mutable-references",
      "https://doc.rust-lang.org/error_codes/E0499.html",
    ],
  },
  {
    id: "rust-nll-01",
    category: "rust",
    difficulty: "medium",
    title: "Borrow region versus enclosing block scope",
    tags: ["ownership", "borrowing", "nll", "lifetimes"],
    type: "trace",
    prompt: "What happens when this program is compiled and run?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn main() {
    let mut v = vec![1, 2, 3];
    let first = &v[0];
    println!("first: {}", first);
    v.push(4);
    println!("{:?}", v);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints `first: 1` then `[1, 2, 3, 4]`",
        "Compile error: cannot borrow `v` as mutable because it is also borrowed as immutable",
        "Undefined behavior: `first` becomes a dangling reference once `push` reallocates",
        "Compile error: `first` does not live long enough",
      ],
      correctIndex: 0,
    },
    explanation:
      "This compiles and runs cleanly under NLL (non-lexical lifetimes). The borrow " +
      "checker doesn't treat `first`'s borrow of `v` as live for the rest of the enclosing " +
      "block: it computes liveness from actual control flow and ends the borrow at " +
      "`first`'s *last use*, which is the `println!` on the line before `v.push(4)`. By " +
      "the time `push` needs a mutable borrow of `v`, the immutable borrow through `first` " +
      "has already ended, so the two borrows never overlap and the compiler accepts it. " +
      "Before NLL shipped (stabilized with Rust 2018 via RFC 2094, later backported to all " +
      "editions in 1.36), the checker used purely lexical scoping: a borrow was considered " +
      "live for the entire syntactic block containing its introduction, regardless of " +
      "whether it was used again. Under that older model this exact program was rejected: " +
      "`first`'s borrow was treated as still 'in scope' all the way to the closing `}` " +
      "of `main`, so `v.push(4)` collided with it and produced a `cannot borrow v as " +
      "mutable because it is also borrowed as immutable` error, even though `first` is " +
      "never read after the first `println!`. NLL is why patterns like 'borrow, use, then " +
      "mutate later in the same block' just work in modern Rust without restructuring the " +
      "code into nested scopes.",
    references: [
      "https://rust-lang.github.io/rfcs/2094-nll.html",
      "https://doc.rust-lang.org/reference/introduction.html",
      "https://blog.rust-lang.org/2018/12/06/Rust-1.31-and-rust-2018.html",
    ],
  },
  {
    id: "rust-copy-vs-clone-01",
    category: "rust",
    difficulty: "medium",
    title: "Reassigning an i32 versus reassigning a String",
    tags: ["ownership", "copy", "clone", "move-semantics"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn main() {
    let a = 5;
    let b = a;
    println!("a = {}, b = {}", a, b);

    let s1 = String::from("hello");
    let s2 = s1;
    println!("s1 = {}, s2 = {}", s1, s2);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error on `let b = a;`: `i32` does not implement `Copy`",
        "Compiles and prints `a = 5, b = 5` then `s1 = hello, s2 = hello`",
        "Compile error on the second `println!`: borrow of moved value: `s1`",
        "Compiles and prints `a = 5, b = 5` then `s1 = , s2 = hello` (s1 is left empty)",
      ],
      correctIndex: 2,
    },
    explanation:
      "`i32` implements `Copy`, so `let b = a;` performs an implicit bitwise copy: `a` and " +
      "`b` are two fully independent `i32`s, and `a` remains perfectly usable afterward: " +
      "no move happens at all for `Copy` types, `let b = a;` never invalidates `a`. `String` " +
      "does not implement `Copy` (it owns a heap allocation), so it moves by default: " +
      "`let s2 = s1;` transfers ownership of the heap buffer to `s2` and the compiler marks " +
      "`s1` as no longer valid; reading it in the second `println!` is caught at compile " +
      "time with `error[E0382]: borrow of moved value: \\`s1\\``, and rustc even suggests " +
      "the fix: `let s2 = s1.clone();`. That asymmetry is the whole design: for `Copy` " +
      "types duplication is silent and automatic, while `String` demands an explicit, " +
      "potentially expensive (heap-allocating) `.clone()` call to get an independently-owned " +
      "second copy instead of a move, so the cost is never hidden from the reader.",
    references: [
      "https://doc.rust-lang.org/std/marker/trait.Copy.html",
      "https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#stack-only-data-copy",
    ],
  },
  {
    id: "rust-no-iterator-invalidation-01",
    category: "rust",
    difficulty: "medium",
    title: "Pushing to a Vec while iterating over it",
    tags: ["ownership", "borrowing", "iterators", "vec", "compile-error"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn main() {
    let mut v = vec![1, 2, 3];
    for x in &v {
        v.push(*x);
    }
    println!("{:?}", v);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Undefined behavior, same as C++; may crash or silently corrupt memory if `v` reallocates mid-loop",
        "Compiles fine and runs forever, since each pushed element is also visited by the loop",
        "Compile error: cannot borrow `v` as mutable because it is also borrowed as immutable",
        "Compiles and prints `[1, 2, 3, 1, 2, 3]`",
      ],
      correctIndex: 2,
    },
    explanation:
      "`for x in &v` holds an immutable borrow of `v` for the duration of the loop (the " +
      "iterator itself borrows `v`, and that borrow is 'later used' on every loop " +
      "iteration, so NLL can't shrink it to end early). `v.push(*x)` inside the loop body " +
      "needs a mutable borrow of `v` while that immutable borrow is still active, which " +
      "violates Rust's aliasing rules and is rejected at compile time: `error[E0502]: " +
      "cannot borrow \\`v\\` as mutable because it is also borrowed as immutable`, with the " +
      "compiler pointing at the `for x in &v` line as where the immutable borrow occurs and " +
      "is 'later used here'. Contrast this with C++: `for (int x : v) { v.push_back(x); }` " +
      "over a `std::vector<int>` compiles without complaint. At runtime, once `push_back` " +
      "needs to grow beyond the vector's current capacity, it reallocates the backing " +
      "buffer, and the range-for's underlying iterator (still pointing into the old, now-" +
      "freed buffer) becomes dangling. Continuing to iterate is undefined behavior: it " +
      "might loop forever, crash, or silently read garbage, and none of that is caught by " +
      "the C++ compiler. Rust turns this entire class of bug into a compile-time error " +
      "instead of a runtime landmine.",
    references: [
      "https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html",
      "https://doc.rust-lang.org/error_codes/E0502.html",
    ],
  },
  {
    id: "rust-mem-swap-replace-01",
    category: "rust",
    difficulty: "hard",
    title: "std::mem::replace on a field behind &mut self",
    tags: ["ownership", "mem-replace", "mem-swap", "borrowing"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `struct Buffer {
    data: Vec<i32>,
}

impl Buffer {
    fn take_data(&mut self) -> Vec<i32> {
        std::mem::replace(&mut self.data, Vec::new())
    }
}

fn main() {
    let mut b = Buffer { data: vec![1, 2, 3] };
    let taken = b.take_data();
    println!("taken = {:?}", taken);
    println!("b.data = {:?}", b.data);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "`taken = [1, 2, 3]` then `b.data = [1, 2, 3]` (data is only borrowed, not taken)",
        "Compile error: cannot move out of `self.data` which is behind a mutable reference",
        "`taken = [1, 2, 3]` then `b.data = []`",
        "`taken = []` then `b.data = [1, 2, 3]`",
      ],
      correctIndex: 2,
    },
    explanation:
      "You only have `&mut self`, not ownership of `*self`, so `self.data` alone (a bare " +
      "move out of a field behind a `&mut` reference) does not compile: try it and rustc " +
      "gives `error[E0507]: cannot move out of \\`self.data\\` which is behind a mutable " +
      "reference`, because moving out would leave `*self` partially uninitialized while the " +
      "caller still holds a live `&mut Buffer` pointing at it. `std::mem::replace(&mut " +
      "self.data, Vec::new())` sidesteps this: in one atomic operation it writes the " +
      "placeholder `Vec::new()` into `self.data` and returns the *old* value by ownership. " +
      "`*self` is never left in an invalid state (the field always holds a valid `Vec<i32>`, " +
      "just a different one before and after), so the borrow checker is satisfied. The " +
      "result: `take_data` returns the original `vec![1, 2, 3]` by value (`taken`), and " +
      "`b.data` is left holding the empty placeholder vec that was swapped in. This is the " +
      "standard pattern for pulling an owned value out of a struct field inside a `&mut " +
      "self` method. `std::mem::swap` is the more general two-way version when you want to " +
      "exchange two existing values instead of substituting a fresh placeholder.",
    references: [
      "https://doc.rust-lang.org/std/mem/fn.replace.html",
      "https://doc.rust-lang.org/std/mem/fn.swap.html",
      "https://doc.rust-lang.org/error_codes/E0507.html",
    ],
  },
  {
    id: "rust-reborrow-01",
    category: "rust",
    difficulty: "hard",
    title: "Passing the same &mut reference to two calls in a row",
    tags: ["ownership", "borrowing", "reborrow", "mutable-references"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn increment(x: &mut i32) {
    *x += 1;
}

fn main() {
    let mut val = 10;
    let r = &mut val;
    increment(r);
    increment(r);
    println!("{}", r);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "11; only the first call to `increment` succeeds, `r` is moved after that",
        "Compile error: use of moved value: `r` (the first call to `increment` moves it)",
        "12",
        "10; `increment` receives a copy, `val` is never actually modified",
      ],
      correctIndex: 2,
    },
    explanation:
      "`&mut i32` is not `Copy`, so passing `r` by value would ordinarily move it, and a " +
      "moved-from variable can't be used again. But `increment(r)` doesn't move `r` here: " +
      "because `increment` expects a `&mut i32` and `r` already is one, the compiler " +
      "implicitly performs a *reborrow*, rewriting the call as `increment(&mut *r)`. That " +
      "produces a fresh, temporary `&mut i32` borrowed from `*r` with a lifetime scoped to " +
      "the call, rather than consuming `r` itself. Once `increment` returns, that temporary " +
      "reborrow's lifetime ends and `r` is fully usable again, which is exactly why the " +
      "second `increment(r)` call and the final `println!(\"{}\", r)` both compile. Each " +
      "call increments `val` through the reborrow, so the two calls take `val` from 10 to " +
      "11 to 12, and `r` prints `12`. If Rust didn't have implicit reborrowing and `&mut " +
      "T` moved by value on every use like any other non-`Copy` type, the first " +
      "`increment(r)` would move `r` into the function, and the second `increment(r)` would " +
      "fail to compile with `error[E0382]: use of moved value: \\`r\\``.",
    references: [
      "https://doc.rust-lang.org/nomicon/references.html",
      "https://doc.rust-lang.org/reference/expressions.html#mutable-references",
    ],
  },
  {
    id: "rust-slice-oob-panic-01",
    category: "rust",
    difficulty: "medium",
    title: "Indexing a fixed-size array with an out-of-range runtime index",
    tags: ["panic", "slices", "arrays", "bounds-checking", "undefined-behavior"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn get_index() -> usize {
    5
}

fn main() {
    let arr = [10, 20, 30];
    let i = get_index();
    println!("before");
    println!("{}", arr[i]);
    println!("after");
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: index 5 is out of bounds for an array of length 3",
        "Undefined behavior, same as C++'s `operator[]`; reads whatever memory happens to follow `arr`",
        "Prints `before`, then panics: `index out of bounds: the len is 3 but the index is 5`",
        "Prints `before`, `0`, `after`; out-of-bounds reads default to `0`",
      ],
      correctIndex: 2,
    },
    explanation:
      "`arr[i]` on a Rust array/slice always performs a bounds check at runtime. Since `i` " +
      "comes from a function call the compiler can't const-evaluate away, it can't be " +
      "caught at compile time; the check happens when the code actually runs. `before` " +
      "prints, then indexing with `i == 5` against a length-3 array trips the check and " +
      "panics with `thread 'main' panicked at ...: index out of bounds: the len is 3 but " +
      "the index is 5`, unwinding the thread before `after` (or the value) is ever printed. " +
      "This is a deliberate, explicit contrast with C++: `std::vector<int>::operator[]` and " +
      "raw array indexing perform *no* bounds check whatsoever: `arr[5]` on a 3-element " +
      "C++ array compiles and 'runs', just reading whatever bytes happen to sit past the " +
      "end of the buffer, which is undefined behavior (it might crash, might silently " +
      "return garbage, might corrupt unrelated memory). Rust trades that silent UB for a " +
      "loud, deterministic panic. When you don't want a panic on out-of-range access, " +
      "`arr.get(i)` returns `Option<&T>` (`Some(&value)` in bounds, `None` out of bounds), " +
      "letting you handle the failure explicitly instead of crashing or reading garbage.",
    references: [
      "https://doc.rust-lang.org/std/primitive.slice.html#method.get",
      "https://doc.rust-lang.org/book/ch09-01-unrecoverable-errors-with-panic.html",
    ],
  },
  {
    id: "rust-temp-lifetime-extension-01",
    category: "rust",
    difficulty: "hard",
    title: "Borrowing a temporary in a let binding vs. returning one from a function",
    tags: ["lifetimes", "temporaries", "compile-error", "borrowing"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn make_ref<'a>() -> &'a String {
    &String::from("hi")
}

fn main() {
    let r = &String::from("hi");
    println!("r = {}", r);

    let r2 = make_ref();
    println!("r2 = {}", r2);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error inside `make_ref` only: `cannot return reference to temporary value`; `let r = &String::from(\"hi\");` in `main` is fine on its own",
        "Compile error on both `let r = ...` in `main` and inside `make_ref`; a reference can never bind directly to a temporary",
        "Compiles and runs fine, printing `r = hi` then `r2 = hi`",
        "Compile error only on `let r2 = make_ref();` in `main`, not inside `make_ref` itself",
      ],
      correctIndex: 0,
    },
    explanation:
      "`let r = &String::from(\"hi\");` genuinely compiles. Rust's temporary lifetime " +
      "extension rule says that when a `let` statement's initializer directly borrows a " +
      "temporary, that temporary's lifetime is extended to match the binding's scope " +
      "instead of being dropped at the end of the statement, conceptually similar to " +
      "C++'s rule that binding a `const&` to a temporary extends its lifetime. So `r` " +
      "stays valid for the rest of `main`, and the first `println!` works fine. That " +
      "extension is strictly local to the `let` statement doing the direct capture; it " +
      "does not cross function boundaries. Inside `make_ref`, `&String::from(\"hi\")` " +
      "borrows a temporary that belongs to `make_ref`'s own body; there is no enclosing " +
      "`let` in *that* function binding it directly, so the temporary is dropped when the " +
      "expression's scope ends, which, since it's the tail expression of the function, is " +
      "essentially immediately, before the caller ever sees it. Returning a reference into " +
      "it is rejected outright by the borrow checker with `error[E0515]: cannot return " +
      "reference to temporary value`, pointing at 'temporary value created here' and " +
      "'returns a reference to data owned by the current function'. Because that's a hard " +
      "compile error, the whole program fails to build. The fact that the `let r = ...` " +
      "line in `main` is independently fine doesn't save the file; `make_ref` alone sinks " +
      "the build.",
    references: [
      "https://doc.rust-lang.org/reference/destructors.html#temporary-lifetime-extension",
      "https://doc.rust-lang.org/error_codes/E0515.html",
    ],
  },
  {
    id: "rust-drop-order-01",
    category: "rust",
    difficulty: "medium",
    title: "An explicit drop() call vs. end-of-scope destruction order",
    tags: ["drop", "raii", "destructors", "resource-management"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `struct Resource(&'static str);

impl Drop for Resource {
    fn drop(&mut self) {
        println!("Dropping {}", self.0);
    }
}

fn main() {
    let a = Resource("a");
    let b = Resource("b");
    let c = Resource("c");
    println!("Created {}, {}, {}", a.0, b.0, c.0);
    drop(b);
    println!("End of main");
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "`Created a, b, c` / `Dropping b` / `End of main` / `Dropping c` / `Dropping a`",
        "`Created a, b, c` / `End of main` / `Dropping a` / `Dropping b` / `Dropping c`",
        "`Created a, b, c` / `End of main` / `Dropping c` / `Dropping b` / `Dropping a`",
        "Compile error: cannot drop `b` while `a` and `c` are still in scope",
      ],
      correctIndex: 0,
    },
    explanation:
      "`drop(b)` is just `std::mem::drop`, a tiny generic function that takes its argument " +
      "*by value* and immediately does nothing with it: the moment `drop`'s body returns, " +
      "its parameter (now owning what used to be `b`) goes out of scope and `Resource`'s " +
      "`Drop::drop` runs right there. That's why `Dropping b` prints before `End of main`: " +
      "calling `drop(b)` forces `b`'s destructor to run early, at that exact point in the " +
      "code, instead of waiting for the end of the block. This is the idiomatic way to " +
      "release a resource (a lock guard, a file handle, a connection) ahead of schedule " +
      "without wrapping it in an extra nested `{ }` scope. After `drop(b)` runs, `b` is " +
      "gone; `main` finishes with only `a` and `c` still live. At the closing `}` of " +
      "`main`, remaining locals are dropped in reverse declaration order, matching C++: " +
      "`c` was declared after `a`, so `c` drops first, then `a`, giving the final two " +
      "lines `Dropping c` then `Dropping a`.",
    references: [
      "https://doc.rust-lang.org/std/ops/trait.Drop.html",
      "https://doc.rust-lang.org/std/mem/fn.drop.html",
      "https://doc.rust-lang.org/reference/destructors.html",
    ],
  },
  {
    id: "rust-dyn-vs-generic-01",
    category: "rust",
    difficulty: "medium",
    title: "Storing two concrete types in a Vec<Box<dyn Trait>>",
    tags: ["trait-objects", "dyn", "generics", "monomorphization", "dispatch"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `trait Shape {
    fn area(&self) -> f64;
}

struct Circle {
    radius: f64,
}

struct Square {
    side: f64,
}

impl Shape for Circle {
    fn area(&self) -> f64 {
        std::f64::consts::PI * self.radius * self.radius
    }
}

impl Shape for Square {
    fn area(&self) -> f64 {
        self.side * self.side
    }
}

fn total_area(shapes: &[Box<dyn Shape>]) -> f64 {
    shapes.iter().map(|s| s.area()).sum()
}

fn main() {
    let shapes: Vec<Box<dyn Shape>> = vec![
        Box::new(Circle { radius: 1.0 }),
        Box::new(Square { side: 2.0 }),
    ];
    println!("{:.2}", total_area(&shapes));
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "7.14",
        "Compile error: `Circle` and `Square` are different types and cannot share a `Vec`",
        "4.00; only the last element's area is counted",
        "Compile error: `dyn Shape` is unsized and cannot be stored in a `Vec`",
      ],
      correctIndex: 0,
    },
    explanation:
      "`Circle`'s area is `PI * 1.0^2 ≈ 3.14159` and `Square`'s is `2.0^2 = 4.0`, summing to " +
      "`7.14159...`, printed as `7.14`. The reason this compiles at all is `Box<dyn Shape>`: " +
      "each box stores a fat pointer: a pointer to the heap-allocated value plus a pointer to " +
      "a vtable of `Shape`'s methods for whichever concrete type was boxed. Because every " +
      "element of the `Vec` has the *same* type, `Box<dyn Shape>`, regardless of what concrete " +
      "type is behind it, the `Vec` itself is perfectly homogeneous; the heterogeneity is " +
      "hidden behind indirection and resolved at runtime via the vtable (dynamic dispatch). " +
      "Contrast this with a generic version, `fn total_area<T: Shape>(shapes: &[T])`: " +
      "monomorphization compiles a separate, specialized copy of that function per concrete `T` " +
      "(faster, inlinable, no vtable), but it requires the *compiler* to know a single concrete " +
      "`T` for the whole slice. Trying `vec![Circle { radius: 1.0 }, Square { side: 2.0 }]` " +
      "directly fails to type-check with a mismatched-types error, because a `Vec<T>` literal " +
      "needs every element to be the same concrete `T`. Generics buy you speed, trait objects " +
      "buy you heterogeneity, and you cannot have both for the same collection.",
    references: [
      "https://doc.rust-lang.org/book/ch18-02-trait-objects.html",
      "https://doc.rust-lang.org/reference/types/trait-object.html",
    ],
  },
  {
    id: "rust-object-safety-01",
    category: "rust",
    difficulty: "hard",
    title: "A trait with a generic method used behind &dyn",
    tags: ["trait-objects", "dyn", "object-safety", "vtable", "compile-error"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `trait Converter {
    fn convert<T>(&self, value: T) -> String;
}

struct Doubler;

impl Converter for Doubler {
    fn convert<T>(&self, value: T) -> String {
        format!("converted")
    }
}

fn use_converter(c: &dyn Converter) {
    let _ = c;
}

fn main() {
    let d = Doubler;
    use_converter(&d);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'Compiles fine; calling `c.convert(x)` monomorphizes per call site even through `&dyn Converter`',
        "Compile error: the trait `Converter` is not dyn compatible; method `convert` has generic type parameters",
        "Compile error: cannot find type `T` in this scope",
        "Compiles, but calling `c.convert(42)` panics at runtime with 'unsupported generic dispatch'",
      ],
      correctIndex: 1,
    },
    explanation:
      "rustc rejects this with E0038: `the trait \\`Converter\\` is not dyn compatible`, pointing " +
      "at `convert`'s generic parameter `T` as the cause. (This property used to be called " +
      "'object safety' and older error text read 'cannot be made into an object'; recent " +
      "rustc renamed it 'dyn compatible', same underlying rule.) A `dyn Trait` value is a fat " +
      "pointer to data plus a vtable: a fixed, finite array of function pointers, one entry " +
      "per method, built once for each concrete type that implements the trait. A generic " +
      "method like `fn convert<T>(&self, value: T)` has no single function pointer to put in " +
      "that slot: `convert::<i32>`, `convert::<String>`, `convert::<MyStruct>`, etc. are all " +
      "different monomorphized functions, and the set of `T`s a caller might use is unbounded " +
      "and not known when the vtable is built. Static dispatch through `<C: Converter>` sidesteps " +
      "this entirely because the compiler resolves `T` at each call site during monomorphization; " +
      "there's no vtable to populate. The other common violations are a method that takes " +
      "`self` by value (a `dyn Trait` is unsized, so it can't be passed by value) and a " +
      "method that mentions `Self` outside the receiver, such as one returning `Self`. The " +
      "standard escape hatch for all of them is a `where Self: Sized` bound on the offending " +
      "method: that excludes it from the vtable entirely, so the trait stays dyn compatible " +
      "and the method simply isn't callable on a `dyn Trait`.",
    references: [
      "https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility",
      "https://doc.rust-lang.org/error_codes/E0038.html",
    ],
  },
  {
    id: "rust-box-recursive-type-01",
    category: "rust",
    difficulty: "hard",
    title: "A linked-list node holding Option<Node> directly",
    tags: ["box", "recursive-type", "sizeof", "compile-error"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `struct Node {
    value: i32,
    next: Option<Node>,
}

fn main() {
    let n = Node { value: 1, next: None };
    let _ = n;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compiles; `Node`'s size is computed lazily the first time a value is constructed",
        "Compiles, but every `Node` allocates on the heap automatically",
        "Compile error: `Node` does not implement `Default`",
        "Compile error: recursive type `Node` has infinite size",
      ],
      correctIndex: 3,
    },
    explanation:
      "rustc reports E0072: `recursive type \\`Node\\` has infinite size`, flagging the `next: " +
      "Option<Node>` field as 'recursive without indirection', and even suggests the fix inline: " +
      "wrap it as `Option<Box<Node>>`. `size_of::<Node>()` must be a single fixed number known " +
      "at compile time. But to compute the size of `Node`, the compiler needs the size of the " +
      "`Option<Node>` field, which needs the size of `Node` again, which needs the size of " +
      "`Option<Node>` again... the layout computation cycles forever (rustc's second diagnostic, " +
      "E0391, names this explicitly: 'cycle detected when computing layout of `Node`'). Wrapping " +
      "the self-referential field in `Box<Node>` breaks the cycle: regardless of what `Node` " +
      "contains, a `Box<T>` is always exactly one pointer wide (8 bytes on a 64-bit target), so " +
      "`Option<Box<Node>>`'s size no longer depends on `Node`'s size; it's fixed, and the " +
      "recursive data itself lives on the heap, one allocation per link. Confirmed with " +
      "`std::mem::size_of::<Node>()` after the fix: it prints `16` (an `i32` padded to 8-byte " +
      "alignment plus an 8-byte niche-optimized pointer for `Option<Box<Node>>`), independent of " +
      "how deep the list actually gets at runtime.",
    references: [
      "https://doc.rust-lang.org/book/ch15-01-box.html",
      "https://doc.rust-lang.org/error_codes/E0072.html",
    ],
  },
  {
    id: "rust-associated-type-01",
    category: "rust",
    difficulty: "hard",
    title: "Two Iterator impls for one type with different Item types",
    tags: ["associated-types", "generics", "iterator", "coherence", "compile-error"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `struct Counter {
    count: i32,
}

impl Iterator for Counter {
    type Item = i32;
    fn next(&mut self) -> Option<i32> {
        self.count += 1;
        Some(self.count)
    }
}

impl Iterator for Counter {
    type Item = String;
    fn next(&mut self) -> Option<String> {
        self.count += 1;
        Some(self.count.to_string())
    }
}

fn main() {
    let mut c = Counter { count: 0 };
    println!("{:?}", c.next());
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints `Some(1)`; the first `impl Iterator for Counter` is used",
        "Compile error: conflicting implementations of trait `Iterator` for type `Counter`",
        "Prints `Some(\"1\")`; the second `impl` shadows the first",
        "Compiles; `c.next()` is ambiguous and requires `Iterator::<i32>::next(&mut c)` turbofish syntax to pick one",
      ],
      correctIndex: 1,
    },
    explanation:
      "rustc rejects this with E0119: `conflicting implementations of trait \\`Iterator\\` for " +
      "type \\`Counter\\``, pointing at both `impl` blocks. Rust's trait coherence rule allows at " +
      "most one implementation of a given trait for a given type, full stop, and `Iterator`'s " +
      "signature is `trait Iterator { type Item; fn next(&mut self) -> Option<Self::Item>; }`, " +
      "so `impl Iterator for Counter` names only the trait and the type; `type Item = ...` is a " +
      "detail chosen *inside* that one impl, not a second axis you can vary across multiple " +
      "impls. That's the whole point of an associated type versus a generic trait parameter: had " +
      "`Iterator` instead been declared `trait Iterator<T> { fn next(&mut self) -> Option<T>; }`, " +
      "then `Counter` could implement `Iterator<i32>` *and* `Iterator<String>` simultaneously: " +
      "each instantiation `Iterator<i32>` and `Iterator<String>` is a distinct trait as far as " +
      "coherence is concerned, exactly like `impl Parse<i32> for Wrapper` and `impl Parse<String> " +
      "for Wrapper` legally coexisting for a hand-rolled generic trait. Associated types trade " +
      "that flexibility for inference ergonomics: given only a `Counter`, code can write " +
      "`Counter::Item` and get one unambiguous answer instead of forcing every caller of " +
      "`.next()` to specify which `Iterator<T>` they meant.",
    references: [
      "https://doc.rust-lang.org/book/ch20-02-advanced-traits.html",
      "https://doc.rust-lang.org/error_codes/E0119.html",
    ],
  },
  {
    id: "rust-default-trait-method-01",
    category: "rust",
    difficulty: "medium",
    title: "A trait default method with one implementor overriding it",
    tags: ["default-methods", "traits"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `trait Greet {
    fn name(&self) -> String;

    fn greeting(&self) -> String {
        format!("Hello, {}!", self.name())
    }
}

struct Person {
    name: String,
}

impl Greet for Person {
    fn name(&self) -> String {
        self.name.clone()
    }
}

struct Robot {
    id: u32,
}

impl Greet for Robot {
    fn name(&self) -> String {
        format!("Unit-{}", self.id)
    }

    fn greeting(&self) -> String {
        format!("BEEP BOOP {} ONLINE", self.name().to_uppercase())
    }
}

fn main() {
    let p = Person { name: "Ada".to_string() };
    let r = Robot { id: 7 };
    println!("{}", p.greeting());
    println!("{}", r.greeting());
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Hello, Ada! / Hello, Unit-7!",
        "Hello, Ada! / BEEP BOOP UNIT-7 ONLINE",
        "Compile error: `Person` must implement `greeting`",
        "BEEP BOOP ADA ONLINE / BEEP BOOP UNIT-7 ONLINE",
      ],
      correctIndex: 1,
    },
    explanation:
      "`Greet` only *requires* implementors to supply `name`; `greeting` has a provided default " +
      "body that calls `self.name()`. `Person` implements just `name`, so `p.greeting()` falls " +
      "through to the trait's default body and prints `Hello, Ada!`. `Robot` implements `name` " +
      "*and* supplies its own `greeting`, which shadows the default entirely: its version " +
      "doesn't even call the default, it builds its own string from `self.name()`, so " +
      "`r.greeting()` prints `BEEP BOOP UNIT-7 ONLINE`. This is the core trade default methods " +
      "offer: a trait author writes shared, sensible behavior once in terms of the trait's " +
      "required methods, and each implementor gets it 'for free' by implementing only the " +
      "minimal required surface, while retaining the option to override any default method " +
      "individually, per type, without touching the trait definition or the other implementors.",
    references: ["https://doc.rust-lang.org/book/ch10-02-traits.html#default-implementations"],
  },
  {
    id: "rust-operator-overload-01",
    category: "rust",
    difficulty: "medium",
    title: "std::ops::Add implemented for one struct but not the other",
    tags: ["operator-overloading", "std::ops", "Add", "associated-types", "compile-error"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::ops::Add;

#[derive(Debug, Clone, Copy)]
struct Point {
    x: i32,
    y: i32,
}

impl Add for Point {
    type Output = Point;

    fn add(self, other: Point) -> Point {
        Point {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

struct Meters(f64);

fn main() {
    let a = Point { x: 1, y: 2 };
    let b = Point { x: 3, y: 4 };
    let c = a + b;
    println!("{:?}", c);

    let m1 = Meters(1.0);
    let m2 = Meters(2.0);
    let m3 = m1 + m2;
    let _ = m3;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Point { x: 4, y: 6 }; then compiles and runs to completion",
        "Point { x: 4, y: 6 }; then panics at runtime evaluating `m1 + m2`",
        "Compile error: `type Output` must match the `Self` type in every `Add` implementation",
        "Compile error on `m1 + m2`: cannot add `Meters` to `Meters`",
      ],
      correctIndex: 3,
    },
    explanation:
      "The `a + b` expression desugars to `Add::add(a, b)` because `Point` implements " +
      "`std::ops::Add<Point>`; had that impl printed on its own it would show `Point { x: 4, y: " +
      "6 }`. But the file as a whole does not compile: `m1 + m2` also desugars to `Add::add(m1, " +
      "m2)`, and `Meters` never implements `Add`; rustc reports E0369: `cannot add \\`Meters\\` " +
      "to \\`Meters\\``, with a note that 'an implementation of `Add` might be missing for " +
      "`Meters`'. Since a single `rustc` invocation must type-check the whole crate, this one " +
      "unsatisfied trait bound fails the build, and the otherwise-valid `Point` arithmetic never " +
      "gets to run. On the `type Output` question: it names the type produced by `+`: here " +
      "`Output = Point`, so `a + b` has type `Point`, but `Output` need not equal `Self` (e.g. " +
      "`impl Add<f64> for Point` could sensibly return `Point` scaled, or a newtype could define " +
      "`impl Mul<Meters> for f64` with `Output = Meters`); it's the associated type that lets " +
      "operator overloads express asymmetric or type-changing arithmetic, not just closed " +
      "self-to-self addition.",
    references: [
      "https://doc.rust-lang.org/std/ops/trait.Add.html",
      "https://doc.rust-lang.org/error_codes/E0369.html",
    ],
  },
  {
    id: "rust-blanket-impl-orphan-rule-01",
    category: "rust",
    difficulty: "hard",
    title: "Implementing std::fmt::Display for Vec<i32>",
    tags: ["orphan-rule", "blanket-impl", "coherence", "compile-error"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::fmt;

impl fmt::Display for Vec<i32> {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

fn main() {
    let v: Vec<i32> = vec![1, 2, 3];
    println!("{}", v);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints `[1, 2, 3]`; the impl delegates straight to `Vec`'s `Debug` output",
        "Compile error: only traits defined in the current crate can be implemented for types defined outside of the crate",
        "Compile error: the trait `Display` is not implemented for `Vec<i32>`",
        "Compiles, but conflicts with any other crate that does the same thing, causing a link-time error",
      ],
      correctIndex: 1,
    },
    explanation:
      "rustc rejects this with E0117: `only traits defined in the current crate can be " +
      "implemented for types defined outside of the crate`, noting `Vec is not defined in the " +
      "current crate`. This is the orphan rule: to implement a trait for a type, at least one of " +
      "the trait or the type must be local to your crate. Here both `Display` and `Vec` come " +
      "from `std`, and neither is local, so it's forbidden. The rule exists for global coherence: " +
      "if two unrelated crates were each allowed to define `impl Display for Vec<i32>`, a " +
      "program depending on both would have two conflicting impls and no principled way to pick " +
      "one. The fix is the newtype pattern: `struct MyList(Vec<i32>); impl fmt::Display for " +
      "MyList { ... }` compiles cleanly, because `MyList` is local even though `Display` isn't. " +
      "Blanket impls are the other side of the same rule, not an exception to it: `impl<T: " +
      "fmt::Display> Summary for T { ... }` (for a locally-defined `trait Summary`) compiles " +
      "fine and applies to every `Display` type including foreign ones like `i32`, because the " +
      "trait being implemented, `Summary`, is local; the orphan rule only inspects the trait " +
      "and the type of the `impl`, not the bound's type parameter.",
    references: [
      "https://doc.rust-lang.org/book/ch10-02-traits.html#implementing-a-trait-on-a-type",
      "https://doc.rust-lang.org/error_codes/E0117.html",
      "https://doc.rust-lang.org/reference/items/implementations.html#orphan-rules",
    ],
  },
  {
    id: "rust-rc-not-send-01",
    category: "rust",
    difficulty: "medium",
    title: "Moving an Rc<T> into a spawned thread",
    tags: ["rc", "send", "threading", "smart-pointers"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::rc::Rc;
use std::thread;

fn main() {
    let data = Rc::new(42);
    let handle = thread::spawn(move || {
        println!("{}", data);
    });
    handle.join().unwrap();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compiles and runs, printing 42; Rc's reference count is atomic, just like std::shared_ptr's",
        "Compile error, but only because the closure doesn't return a value; unrelated to `Rc`",
        "Compiles, but the spawned thread panics at runtime with a data-race detector error",
        "Compile error: `Rc<i32>` cannot be sent between threads safely; `Send` is not implemented for `Rc<i32>`",
      ],
      correctIndex: 3,
    },
    explanation:
      "`Rc<T>` uses a plain (non-atomic) `Cell<usize>` internally for its strong/weak " +
      "counts: incrementing and decrementing it from two threads at once would be a " +
      "data race, so `Rc<T>` deliberately does not implement `Send` (nor `Sync`). " +
      "`thread::spawn` requires its closure to be `Send + 'static` because the closure " +
      "and everything it captures moves onto a new OS thread; the real rustc diagnostic " +
      "is `error[E0277]: \\`Rc<i32>\\` cannot be sent between threads safely`, with a note " +
      "that `Send` is not implemented for `Rc<i32>` and is required by a bound on " +
      "`thread::spawn`. This is the compiler catching, at compile time, exactly the bug " +
      "class C++ leaves you to find at runtime (or never): `std::shared_ptr`'s control " +
      "block increments/decrements its reference count with atomic operations " +
      "*unconditionally*, whether or not the `shared_ptr` is ever touched by more than " +
      "one thread; every single-threaded program using `shared_ptr` pays that atomic " +
      "RMW cost for safety it doesn't need. Rust flips the default: `Rc<T>` is the cheap, " +
      "non-atomic, single-threaded-only option, and you opt into the atomic cost " +
      "explicitly by using `Arc<T>` instead, which *does* implement `Send`/`Sync` (when " +
      "`T: Send + Sync`) and would let this exact program compile and run.",
    references: [
      "https://doc.rust-lang.org/std/rc/struct.Rc.html",
      "https://doc.rust-lang.org/std/marker/trait.Send.html",
      "https://en.cppreference.com/w/cpp/memory/shared_ptr",
    ],
  },
  {
    id: "rust-arc-01",
    category: "rust",
    difficulty: "medium",
    title: "Assigning to a field through an Arc<T> handle",
    tags: ["arc", "interior-mutability", "smart-pointers"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::sync::Arc;

struct Counter {
    value: i32,
}

fn main() {
    let counter = Arc::new(Counter { value: 0 });
    let counter2 = Arc::clone(&counter);
    counter2.value += 1;
    println!("{}", counter.value);
}`,
      highlightLines: [10],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: cannot assign to `value` through an `Arc`; `DerefMut` is not implemented for `Arc<Counter>`",
        "Compiles and prints 1; `Arc::clone` hands back a mutable handle to the same allocation",
        "Compile error: `Arc::clone` requires `Counter: Clone`",
        "Compiles and prints 0; the mutation through `counter2` doesn't affect `counter`'s copy",
      ],
      correctIndex: 0,
    },
    explanation:
      "`Arc::clone` doesn't clone the `Counter`: it bumps the atomic strong count and " +
      "hands back another `Arc<Counter>` pointing at the *same* heap allocation, so any " +
      "reading that assumes two independent copies is wrong on that front too. But the " +
      "real problem is line 10: `Arc<T>` only implements `Deref<Target = T>`, not " +
      "`DerefMut`; by design, since an arbitrary number of `Arc` handles can alias the " +
      "same `T` at once, handing out `&mut T` through any one of them would violate " +
      "Rust's aliasing rules instantly. The actual rustc diagnostic is " +
      "`error[E0594]: cannot assign to data in an \\`Arc\\`` with the help note " +
      "`trait \\`DerefMut\\` is required to modify through a dereference, but it is not " +
      "implemented for \\`Arc<Counter>\\``. `Arc<T>` alone only buys you thread-safe " +
      "*shared, immutable* access; for shared *mutable* state you need to pair it with " +
      "an interior-mutability type, e.g. `Arc<Mutex<Counter>>` or `Arc<RwLock<Counter>>` " +
      "(covered in depth elsewhere), or use `Arc::get_mut`, which only returns " +
      "`Some(&mut T)` when the strong+weak count is exactly 1. `Rc<T>` has the identical " +
      "restriction for the same reason, minus the thread-safety angle.",
    references: [
      "https://doc.rust-lang.org/std/sync/struct.Arc.html",
      "https://doc.rust-lang.org/std/sync/struct.Arc.html#method.get_mut",
    ],
  },
  {
    id: "rust-refcell-runtime-panic-01",
    category: "rust",
    difficulty: "medium",
    title: "Two overlapping borrow_mut() calls on one RefCell",
    tags: ["refcell", "interior-mutability", "runtime-panic", "borrow-checking"],
    type: "trace",
    prompt: "What happens when this program is compiled and run?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::cell::RefCell;

fn main() {
    let data = RefCell::new(vec![1, 2, 3]);

    let borrow1 = data.borrow_mut();
    let borrow2 = data.borrow_mut();

    println!("{:?} {:?}", borrow1, borrow2);
}`,
      highlightLines: [6, 7],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: cannot borrow `data` as mutable more than once at a time",
        "Compiles fine, then panics at runtime: `thread 'main' panicked at ...: RefCell already borrowed`",
        "Compiles and runs fine, printing both borrows; `RefCell` allows multiple live `borrow_mut()`s",
        "Compiles fine, then panics at runtime with a stack overflow",
      ],
      correctIndex: 1,
    },
    explanation:
      "`RefCell<T>` exists precisely to let you have interior mutability that the " +
      "*compiler* can't verify at compile time: instead of the borrow checker rejecting " +
      "two simultaneous mutable borrows the way it would for a plain `&mut Vec<i32>`, " +
      "`RefCell` tracks borrows with a runtime counter and enforces the same xor-mutability " +
      "invariant (any number of shared borrows, XOR exactly one mutable borrow) by " +
      "panicking when it's violated. This program compiles cleanly: `borrow_mut()` " +
      "returns a `RefMut<T>` guard, and nothing about acquiring a second one is a static " +
      "type error. At runtime, though, `borrow1` is still alive (it's used on line 9) " +
      "when `borrow2 = data.borrow_mut()` runs, so the second call finds the cell already " +
      "mutably borrowed and panics. On this toolchain that panic reads " +
      "`thread 'main' panicked at main.rs:7:24:\\nRefCell already borrowed`; that string " +
      "comes from `RefCell`'s internal `BorrowMutError`'s `Display` impl (the standard " +
      "library ships without the `debug_refcell` feature that would additionally print " +
      "the location of the first, still-live borrow). The lesson: `RefCell` doesn't " +
      "relax Rust's aliasing rule, it just moves *when* a violation is caught (from a " +
      "compile error to a runtime panic), which is strictly more dangerous in production " +
      "but useful when a borrow pattern is provably fine at a level the borrow checker " +
      "can't see (e.g. borrows that are lexically overlapping but logically disjoint).",
    references: [
      "https://doc.rust-lang.org/std/cell/struct.RefCell.html",
      "https://doc.rust-lang.org/std/cell/struct.RefCell.html#method.borrow_mut",
    ],
  },
  {
    id: "rust-rc-refcell-cycle-01",
    category: "rust",
    difficulty: "hard",
    title: "Two Rc<Node>s storing an Rc to each other",
    tags: ["rc", "refcell", "memory-leak", "weak", "cycle"],
    type: "trace",
    prompt:
      "`a` and `b` are wired into a cycle via `Rc`. What prints, and what happens to their memory when `main` returns?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::cell::RefCell;
use std::rc::Rc;

struct Node {
    value: i32,
    next: RefCell<Option<Rc<Node>>>,
    prev: RefCell<Option<Rc<Node>>>,
}

impl Drop for Node {
    fn drop(&mut self) {
        println!("Dropping Node {}", self.value);
    }
}

fn main() {
    let a = Rc::new(Node { value: 1, next: RefCell::new(None), prev: RefCell::new(None) });
    let b = Rc::new(Node { value: 2, next: RefCell::new(None), prev: RefCell::new(None) });

    *a.next.borrow_mut() = Some(Rc::clone(&b));
    *b.prev.borrow_mut() = Some(Rc::clone(&a));

    println!("a count = {}, b count = {}", Rc::strong_count(&a), Rc::strong_count(&b));
}`,
      highlightLines: [20, 21],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "a count = 2, b count = 2; then both Nodes print \"Dropping Node\" when `main` returns",
        "a count = 1, b count = 1; `RefCell` prevents the wrapped `Rc::clone` from incrementing the count",
        "Compile error: `Node` cannot store a `RefCell<Option<Rc<Node>>>` that refers to its own type",
        "a count = 2, b count = 2; `main` returns silently. Neither \"Dropping Node\" line ever prints, and both Nodes are leaked",
      ],
      correctIndex: 3,
    },
    explanation:
      "The struct definition compiles fine: `Rc<Node>` is a fixed-size pointer, so " +
      "`Node` containing one isn't an infinitely-sized recursive type, and `RefCell` is " +
      "what makes it legal to mutate `next`/`prev` after construction through a shared " +
      "`Rc`. After the two `*x.field.borrow_mut() = Some(Rc::clone(...))` lines, `a` is " +
      "owned by both the `a` local binding and by `b.prev`, and `b` is owned by both the " +
      "`b` local binding and `a.next`; so `strong_count` is 2 for each, printing " +
      "`a count = 2, b count = 2`. When `main` returns, the local bindings `a` and `b` " +
      "are dropped, each decrementing its target's count from 2 to 1, but never to 0, " +
      "because each node is still kept alive by the *other* node's field. Neither " +
      "`Drop::drop` ever runs, so neither \"Dropping Node\" line prints, and the heap " +
      "allocations for both `Node`s are leaked for the life of the process. This is the " +
      "exact same failure mode as a `std::shared_ptr` reference cycle in C++ (a cycle of " +
      "strong owners can never reach a zero refcount), and the fix is identical in shape: " +
      "make the back-reference (here, `prev`) a `std::rc::Weak<Node>` instead of an " +
      "`Rc<Node>`. A `Weak` participates in the weak count, not the strong count, so it " +
      "doesn't keep the pointee alive; dereferencing it via `.upgrade()` returns " +
      "`Option<Rc<Node>>`, `None` once the strong count has actually hit zero.",
    references: [
      "https://doc.rust-lang.org/book/ch15-06-reference-cycles.html",
      "https://doc.rust-lang.org/std/rc/struct.Weak.html",
    ],
  },
  {
    id: "rust-cell-vs-refcell-01",
    category: "rust",
    difficulty: "medium",
    title: "Cell<T> vs. RefCell<T> for interior mutability",
    tags: ["cell", "refcell", "interior-mutability", "copy"],
    type: "trace",
    prompt: "What happens when this program is compiled and run?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::cell::{Cell, RefCell};

struct Stats {
    hits: Cell<i32>,
    log: RefCell<Vec<i32>>,
}

fn main() {
    let stats = Stats { hits: Cell::new(0), log: RefCell::new(Vec::new()) };

    stats.hits.set(stats.hits.get() + 1);
    stats.log.borrow_mut().push(stats.hits.get());

    println!("hits = {}, log = {:?}", stats.hits.get(), stats.log.borrow());
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compiles and runs fine, printing `hits = 1, log = [1]`",
        "Compile error: `Cell<i32>` requires calling `.borrow()` before `.get()`, the same as `RefCell`",
        "Compiles, but panics at runtime with `RefCell already borrowed` on the `log.borrow_mut()` call",
        "Compile error: `Vec<i32>` does not implement `Copy`, so `RefCell<Vec<i32>>` is not a legal field type",
      ],
      correctIndex: 0,
    },
    explanation:
      "`Cell<T>` and `RefCell<T>` both give interior mutability (mutating through a `&self` " +
      "reference), but by different mechanisms with different requirements. `Cell<T>` " +
      "never hands out a reference to its contents at all (`.get()` *copies* the current " +
      "value out and `.set()` *copies* a new value in), so it works for any `T`, but its " +
      "`get()` method specifically requires `T: Copy` (that's how it can return a `T` by " +
      "value without leaving the cell empty). Because no reference is ever live, there's " +
      "nothing to alias and nothing to check: no runtime borrow tracking, no possibility " +
      "of a `BorrowMutError`-style panic, effectively free. `hits: Cell<i32>` fits this " +
      "perfectly since `i32: Copy`. `RefCell<T>` works for *any* `T`, including non-`Copy` " +
      "types like `Vec<i32>`, by handing out `Ref<T>`/`RefMut<T>` guards and dynamically " +
      "enforcing xor-mutability, at the cost of a runtime check (and a possible panic, " +
      "see the sibling question on `RefCell` panics). Trying to use `Cell<Vec<i32>>::get()` " +
      "instead would fail to compile with `error[E0599]: the method \\`get\\` exists ... " +
      "but its trait bounds were not satisfied ... \\`Vec<i32>: Copy\\``, which is exactly " +
      "why `log` here is a `RefCell`, not a `Cell`. This program does neither of those " +
      "wrong things: it prints `hits = 1, log = [1]` cleanly.",
    references: [
      "https://doc.rust-lang.org/std/cell/index.html",
      "https://doc.rust-lang.org/std/cell/struct.Cell.html",
      "https://doc.rust-lang.org/std/cell/struct.RefCell.html",
    ],
  },
  {
    id: "rust-impl-trait-position-01",
    category: "rust",
    difficulty: "hard",
    title: "impl Trait in argument position vs. return position",
    tags: ["impl-trait", "generics", "iterators", "static-dispatch"],
    type: "trace",
    prompt:
      "`evens_doubled` returns `impl Iterator<Item = i32>` rather than naming a concrete type. Why is that necessary here, and what does it cost at runtime?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn evens_doubled(nums: Vec<i32>) -> impl Iterator<Item = i32> {
    nums.into_iter().filter(|n| n % 2 == 0).map(|n| n * 2)
}

fn main() {
    let result: Vec<i32> = evens_doubled(vec![1, 2, 3, 4, 5, 6]).collect();
    println!("{:?}", result);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The chain's concrete type is built from unnameable closure types; `impl Trait` returns it unboxed, so the calls stay statically dispatched and inlinable",
        "`Iterator` is not dyn compatible, so `Box<dyn Iterator<Item = i32>>` is unavailable here; `impl Trait` is the only way to return an iterator at all",
        "It erases the concrete type behind a vtable at the return boundary, giving it the same runtime cost as `Box<dyn Iterator<Item = i32>>` would have",
        "It is purely stylistic; swapping the signature to `-> Vec<i32>` and calling `.collect()` inside the function would behave identically in every respect",
      ],
      correctIndex: 0,
    },
    explanation:
      "`impl Trait` means two different things depending on position. In *argument* " +
      "position, `fn f(x: impl Trait)` is pure sugar for a generic type parameter with a " +
      "trait bound (`fn f<T: Trait>(x: T)`), the compiler monomorphizes it exactly the " +
      "same way; no runtime dispatch is involved either way. In *return* position, though, " +
      "there's no caller-chosen type parameter to substitute: `impl Trait` instead lets " +
      "the function return a specific, concrete, but *unnameable* type (an existential " +
      "type, from the caller's point of view) chosen entirely by the function body. " +
      "`nums.into_iter().filter(...).map(...)` has a real concrete type (something like " +
      "`Map<Filter<std::vec::IntoIter<i32>, {closure}>, {closure}>`), but closures each " +
      "have a unique, compiler-generated, syntactically unwritable type, so there's no way " +
      "to spell that return type in source even if you wanted to. `-> impl Iterator<Item " +
      "= i32>` sidesteps that by telling the compiler \"return *some* concrete type " +
      "implementing this trait, and let callers only know the trait, not the type.\" " +
      "Crucially this is still static dispatch: the compiler knows the real concrete type " +
      "at the definition site, so the returned iterator's `.next()` calls can be " +
      "monomorphized and inlined into `main` just like any other generic code: zero " +
      "vtable indirection, zero heap allocation. `Box<dyn Iterator<Item = i32>>` would " +
      "also compile (`Iterator` is dyn compatible; `Box<dyn Iterator<...>>` is idiomatic " +
      "elsewhere), but it's a different, strictly more expensive choice: a heap " +
      "allocation for the box plus a dynamic call through a vtable on every `.next()`, " +
      "and the optimizer generally can't see through that indirection to inline anything.",
    references: [
      "https://doc.rust-lang.org/reference/types/impl-trait.html",
      "https://doc.rust-lang.org/rust-by-example/trait/impl_trait.html",
    ],
  },
  {
    id: "rust-monomorphization-01",
    category: "rust",
    difficulty: "hard",
    title: "A generic type parameter vs. a &dyn Trait parameter in codegen",
    tags: ["generics", "monomorphization", "dyn-trait", "code-size", "static-dispatch"],
    type: "trace",
    prompt:
      "`add_one` is a generic function called with `i32`, `f64`, and a custom `Meters` type. What does the compiler actually emit, and how would that change if `add_one` took a `&dyn Trait` object instead?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn add_one<T: std::ops::Add<Output = T> + From<u8>>(x: T) -> T {
    x + T::from(1u8)
}

struct Meters(f64);

impl std::ops::Add for Meters {
    type Output = Meters;
    fn add(self, other: Meters) -> Meters {
        Meters(self.0 + other.0)
    }
}
impl From<u8> for Meters {
    fn from(v: u8) -> Self { Meters(v as f64) }
}

fn main() {
    let a = add_one(5i32);
    let b = add_one(5.0f64);
    let c = add_one(Meters(5.0));
    println!("{} {} {}", a, b, c.0);
}`,
      highlightLines: [18, 19, 20],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The compiler emits three separate specialized copies of `add_one`'s machine code, one per concrete type, each inlinable at its own call site with no indirection",
        "The compiler emits a single generic implementation of `add_one` that dispatches on a hidden runtime type tag, so binary size stays constant no matter how many types call it",
        "The compiler emits one copy of `add_one` per call site regardless of type, and later deduplicates the `i32` and `f64` copies during codegen since both are numeric",
        "Because `T` has trait bounds, `add_one::<T>` is compiled exactly like a function taking `&dyn Add<Output = T>`; a single shared implementation invoked through a vtable",
      ],
      correctIndex: 0,
    },
    explanation:
      "Generic functions in Rust are compiled via monomorphization, the same strategy " +
      "C++ templates use: for every distinct set of concrete type arguments a generic " +
      "function is instantiated with, the compiler stamps out a fully separate, fully " +
      "specialized copy of its machine code: here, `add_one::<i32>`, `add_one::<f64>`, " +
      "and `add_one::<Meters>` are three independent functions by the time codegen " +
      "finishes, with no shared implementation or runtime branching between them. Each " +
      "one is compiled and optimized as if it had been hand-written for that exact type: " +
      "the `T::from(1u8)` call resolves to a concrete `From` impl at compile time, the " +
      "`+` resolves to a concrete `Add::add`, and because there's no indirection at all, " +
      "the optimizer is free to inline each instantiation directly into its call site in " +
      "`main`. The cost is binary size: every additional concrete type `add_one` gets " +
      "called with adds another full copy of its (post-inlining, post-optimization) code " +
      "to the binary, which is the classic 'generic code bloat' tradeoff. `dyn Trait` " +
      "buys back that size at the cost of speed: a function taking `&dyn Trait` compiles " +
      "to exactly *one* shared, non-duplicated implementation, and every call goes " +
      "through a vtable pointer lookup to find the right `add`/`from` at runtime. That " +
      "single implementation can't be specialized per concrete type and generally can't " +
      "be inlined across the virtual-call boundary, but it also doesn't grow the binary " +
      "as more types are used with it. Monomorphization trades binary size for speed and " +
      "inlinability; `dyn Trait` trades speed and inlinability for a flat, bounded binary " +
      "footprint.",
    references: [
      "https://doc.rust-lang.org/book/ch10-01-syntax.html#performance-of-code-using-generics",
      "https://doc.rust-lang.org/reference/items/generics.html",
    ],
  },
  {
    id: "rust-phantomdata-01",
    category: "rust",
    difficulty: "hard",
    title: "PhantomData<T> in a hand-rolled smart pointer",
    tags: ["phantomdata", "unsafe", "raw-pointers", "variance", "drop-check"],
    type: "trace",
    prompt:
      "This `MyBox<T>` wraps a raw pointer and manually drops what it points to. `ptr: *mut T` already mentions `T`, so what does the `_marker: PhantomData<T>` field actually change about this code?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::marker::PhantomData;

struct MyBox<T> {
    ptr: *mut T,
    _marker: PhantomData<T>,
}

impl<T> MyBox<T> {
    fn new(value: T) -> Self {
        let boxed = Box::new(value);
        MyBox { ptr: Box::into_raw(boxed), _marker: PhantomData }
    }
}

impl<T> Drop for MyBox<T> {
    fn drop(&mut self) {
        unsafe {
            drop(Box::from_raw(self.ptr));
        }
    }
}

fn main() {
    let b = MyBox::new(5);
    unsafe {
        println!("{}", *b.ptr);
    }
}`,
      highlightLines: [4, 5],
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Nothing about whether this struct compiles or how large it is; it is a soundness signal to the compiler's drop-check and variance analysis",
        "Removing `_marker` causes `error[E0392]: type parameter T is never used`, since raw pointers don't count as a real use of `T`",
        "Removing `_marker` makes `MyBox<T>` fail to implement `Send`/`Sync` for any `T`, even `T: Send + Sync`; only `PhantomData<T>` can grant those auto traits",
        "Removing `_marker` makes `MyBox<i32>` a different size than `MyBox<String>`, since `PhantomData<T>` is sized according to `T`",
      ],
      correctIndex: 0,
    },
    explanation:
      "`PhantomData<T>` is zero-sized and adds no runtime memory or performance cost: " +
      "`size_of::<MyBox<i32>>()` and `size_of::<MyBox<String>>()` are both just the size " +
      "of one pointer (8 bytes on a 64-bit target), identical whether `_marker` is present " +
      "or not. And because `ptr: *mut T` already mentions `T` in a real field, removing " +
      "`_marker` here does *not* trigger `E0392`: that error only fires when a type " +
      "parameter appears nowhere in any field at all (e.g. a struct with only " +
      "`id: u32` and a phantom `T`), which isn't this case. Auto traits like `Send`/" +
      "`Sync` aren't 'granted' by `PhantomData` either: they're inferred from *every* " +
      "field's own `Send`/`Sync`-ness, and `*mut T` is unconditionally `!Send`/`!Sync` " +
      "regardless of `T` or the marker; a real smart pointer needs an explicit " +
      "`unsafe impl<T: Send> Send for MyBox<T> {}` either way, since the compiler can't " +
      "verify that a raw-pointer-based type's unsafe internals are actually thread-safe. " +
      "So why include it? Because the compiler treats a raw pointer as *not* owning its " +
      "pointee for the purposes of drop-check and variance: it has no way to know, just " +
      "from `*mut T`, that your unsafe `Drop` impl actually drops a real `T` through that " +
      "pointer, the way it would automatically know if the field were a `Box<T>` or a " +
      "bare `T`. `PhantomData<T>` (or, when only a lifetime is at stake, `PhantomData<&'a " +
      "T>`) is exactly the standard library's own trick for this: `Vec`'s internal " +
      "`RawVec` carries a `PhantomData<T>` alongside its `NonNull<T>` for the same reason, " +
      "to make the type behave, for variance and drop-check soundness analysis, as if " +
      "it directly contained a `T`, closing a soundness gap that matters most once `T` " +
      "carries a borrowed lifetime your `Drop` impl might otherwise be allowed to outlive.",
    references: [
      "https://doc.rust-lang.org/nomicon/phantom-data.html",
      "https://doc.rust-lang.org/std/marker/struct.PhantomData.html",
      "https://doc.rust-lang.org/nomicon/dropck.html",
    ],
  },
  {
    id: "rust-send-sync-01",
    category: "rust",
    difficulty: "medium",
    title: "Sharing an Arc<Cell<u32>> counter across two threads",
    tags: ["send", "sync", "thread-safety", "arc", "cell", "marker-traits"],
    type: "trace",
    prompt: "What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::cell::Cell;
use std::sync::Arc;
use std::thread;

fn main() {
    let counter = Arc::new(Cell::new(0u32));
    let mut handles = Vec::new();

    for _ in 0..2 {
        let counter = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            counter.set(counter.get() + 1);
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    println!("{}", counter.get());
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compiles and prints `2`: `Arc`'s atomic refcount synchronizes access to the whole `Arc<Cell<u32>>`, including the `Cell` it points at",
        "Compiles, but prints `1` or `2` nondeterministically, since `counter.set(counter.get() + 1)` is a non-atomic read-modify-write on the shared `Cell`",
        "Compile error: `Cell<u32>` cannot be shared between threads safely; `Sync` is not implemented for `Cell<u32>`, which `Arc<Cell<u32>>: Send` requires",
        "Compile error: `Cell<u32>` cannot be sent between threads safely; `Send` is not implemented for `Cell<u32>`, so the cloned `Arc` cannot be moved into the closure",
      ],
      correctIndex: 2,
    },
    explanation:
      "rustc rejects this with `error[E0277]: \\`Cell<u32>\\` cannot be shared between " +
      "threads safely`, and the notes are the whole lesson: `the trait \\`Sync\\` is not " +
      "implemented for \\`Cell<u32>\\``, `required for \\`Arc<Cell<u32>>\\` to implement " +
      "\\`Send\\``, `required because it appears within the type of this closure`, " +
      "`required by a bound in \\`thread::spawn\\``. `Send` and `Sync` are auto traits, " +
      "derived structurally from a type's fields, but `Arc` overrides that derivation with " +
      "explicit `unsafe impl<T: ?Sized + Sync + Send> Send for Arc<T>` and the matching " +
      "`Sync` impl. Note the bound: `Arc<T>` is `Send` only if `T` is **both** `Send` " +
      "*and* `Sync`. That asymmetry is the point: handing an `Arc<T>` to another thread " +
      "doesn't move the `T`, it hands out a second `&T` alias to the same object, so it " +
      "demands `T: Sync` (shareable by reference), not just `T: Send`. `Cell<u32>` *is* " +
      "`Send`: moving a bare `Cell<u32>` into one spawned thread compiles fine, which is " +
      "why choice 4's diagnosis is wrong. What `Cell` is not is `Sync`, since it wraps an " +
      "`UnsafeCell`, which carries the standard library's only `impl<T: ?Sized> !Sync`, " +
      "and `Cell::set` mutates through `&self` with a plain non-atomic store. Two threads " +
      "holding `&Cell<u32>` could tear or lose that write, so the type system refuses to " +
      "produce the second `&`. Two sharper corollaries: the error has nothing to do with " +
      "mutation at the call site, since a closure that only ever called `counter.get()` fails " +
      "identically, because `Sync` governs whether `&T` may cross a thread boundary at " +
      "all; and `thread::scope` doesn't rescue it either, since scoped threads relax only " +
      "the `'static` requirement, not `Send`. The fixes replace the payload, not the " +
      "pointer: `Arc<AtomicU32>` (`AtomicU32` is `Sync`, and `fetch_add` is a genuine " +
      "atomic RMW) or `Arc<Mutex<u32>>` (`Mutex<T>: Sync` whenever `T: Send`). The C++ " +
      "analogue, `shared_ptr<uint32_t>` copied into two `std::thread`s that each run " +
      "`*p = *p + 1`, compiles without a murmur: `shared_ptr`'s control block is " +
      "atomically refcounted, but that says nothing about the pointee, and C++ has no " +
      "type-level counterpart to `Sync`. The thread-safety contract of the referent is " +
      "documentation, and violating it is UB you find with TSan, if at all.",
    references: [
      "https://doc.rust-lang.org/std/marker/trait.Sync.html",
      "https://doc.rust-lang.org/std/sync/struct.Arc.html#thread-safety",
      "https://doc.rust-lang.org/nomicon/send-and-sync.html",
      "https://doc.rust-lang.org/error_codes/E0277.html",
    ],
  },
  {
    id: "rust-arc-mutex-01",
    category: "rust",
    difficulty: "medium",
    title: "Ten threads incrementing an Arc<Mutex<i32>>",
    tags: ["arc", "mutex", "shared-state", "interior-mutability"],
    type: "trace",
    prompt: "What does this program print, and is the result deterministic?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        let handle = thread::spawn(move || {
            let mut num = counter.lock().unwrap();
            *num += 1;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("Result: {}", *counter.lock().unwrap());
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Result: 10, deterministically",
        "Result: some value less than 10, nondeterministically, due to a lost-update race between threads",
        "Compile error: `Arc<Mutex<i32>>` does not implement `Clone`, so it cannot be cloned once per loop iteration",
        "Result: 10, but only by luck; `*num += 1` is not atomic, so this is technically a data race that happens not to manifest here",
      ],
      correctIndex: 0,
    },
    explanation:
      "Always `Result: 10`, deterministically. This pattern needs both wrappers because " +
      "they solve two unrelated problems. `Arc` (atomic reference count) provides shared " +
      "*ownership*: `Arc::clone` bumps an atomic counter and hands back a new handle to the " +
      "same heap allocation, so all ten spawned threads (plus `main` after they've all " +
      "finished) can hold a valid handle to the same `Mutex<i32>` even though `main`'s " +
      "original `counter` binding is only one of eleven owners. But `Arc<T>` only ever " +
      "hands out `&T`, never `&mut T`: it has no interior mutability of its own, so " +
      "`Arc<i32>` alone would be read-only sharing; you couldn't mutate the count through " +
      "it at all. `Mutex` supplies exactly that missing piece: interior mutability with " +
      "runtime-enforced mutual exclusion; `lock()` blocks until it's the sole holder of " +
      "the guard, so `*num += 1` can never race with another thread's increment. But " +
      "`Mutex<i32>` alone doesn't solve the *ownership* problem: a bare `Mutex<i32>` moved " +
      "into the first `thread::spawn` closure is consumed by that closure, leaving nothing " +
      "for the other nine; that's a `use of moved value` compile error before you even get " +
      "to the race question. Neither wrapper is sufficient by itself; `Arc<Mutex<T>>` " +
      "layers 'many owners' (Arc) on top of 'safe mutation through a shared reference' " +
      "(Mutex), which is exactly what concurrently mutating shared state across threads " +
      "requires.",
    references: [
      "https://doc.rust-lang.org/std/sync/struct.Arc.html",
      "https://doc.rust-lang.org/std/sync/struct.Mutex.html",
      "https://doc.rust-lang.org/book/ch16-03-shared-state.html",
    ],
  },
  {
    id: "rust-mpsc-channel-01",
    category: "rust",
    difficulty: "medium",
    title: "Calling recv() after every mpsc Sender has been dropped",
    tags: ["mpsc", "channels", "message-passing", "ownership"],
    type: "trace",
    prompt:
      "The spawned thread clones `tx`, then drops both the clone and the original; every " +
      "`Sender` is gone before `main` calls `rx.recv()`. What does `recv()` return?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel::<i32>();

    let handle = thread::spawn(move || {
        let tx2 = tx.clone();
        drop(tx2);
        drop(tx);
        // both the clone and the original sender are dropped here
    });
    handle.join().unwrap();

    match rx.recv() {
        Ok(val) => println!("got: {}", val),
        Err(e) => println!("recv error: {:?}", e),
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It blocks forever; `Receiver` has no way to know a `Sender` won't eventually show up",
        "`Ok(0)`; a default sentinel value is delivered to signal that the channel has closed",
        "`Err(RecvError)`, returned immediately rather than blocking on the empty channel",
        "The program panics with 'called `Result::unwrap()` on an `Err` value'",
      ],
      correctIndex: 2,
    },
    explanation:
      "Rust's channel embodies 'do not communicate by sharing memory; share memory by " +
      "communicating': instead of a `Mutex`-guarded queue, ownership of each message " +
      "moves from `Sender` to `Receiver`. The channel internally tracks how many live " +
      "`Sender` handles exist (each `.clone()` increments that count, each drop " +
      "decrements it). Here the spawned thread clones `tx`, then drops the clone, then " +
      "drops the original: after `handle.join()` returns, the live-sender count is " +
      "provably zero. When `main` then calls `rx.recv()`, the channel doesn't block " +
      "waiting for a message that can now never arrive; it immediately returns `Err" +
      "(RecvError)`, since a `Sender`-side disconnect is exactly the condition `recv` is " +
      "documented to report that way. This is a case where Rust's ownership tracking pays " +
      "off directly in API design: because the compiler enforces that a `Sender` clone is " +
      "either live or dropped (no in-between, no manual refcounting bugs), the channel can " +
      "give a precise answer instead of hanging indefinitely, which is the failure mode " +
      "you'd risk with a hand-rolled queue-plus-condvar in C++ if you forgot to signal " +
      "closure explicitly.",
    references: [
      "https://doc.rust-lang.org/std/sync/mpsc/struct.Receiver.html#method.recv",
      "https://doc.rust-lang.org/std/sync/mpsc/struct.RecvError.html",
      "https://doc.rust-lang.org/book/ch16-02-message-passing.html",
    ],
  },
  {
    id: "rust-deadlock-01",
    category: "rust",
    difficulty: "hard",
    title: "Two threads locking two mutexes in opposite orders",
    tags: ["deadlock", "mutex", "misconception", "safe-rust"],
    type: "trace",
    prompt:
      "Thread A locks `mutex_a`, sleeps, then tries to lock `mutex_b`. Thread B locks " +
      "`mutex_b`, sleeps, then tries to lock `mutex_a`; the opposite order. No `unsafe` " +
      "code is used anywhere. Does this compile, and what happens when it runs?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

fn main() {
    let mutex_a = Arc::new(Mutex::new(0));
    let mutex_b = Arc::new(Mutex::new(0));

    let a1 = Arc::clone(&mutex_a);
    let b1 = Arc::clone(&mutex_b);
    let t1 = thread::spawn(move || {
        let _guard_a = a1.lock().unwrap();
        thread::sleep(Duration::from_millis(100));
        let _guard_b = b1.lock().unwrap(); // waits on mutex_b
    });

    let a2 = Arc::clone(&mutex_a);
    let b2 = Arc::clone(&mutex_b);
    let t2 = thread::spawn(move || {
        let _guard_b = b2.lock().unwrap();
        thread::sleep(Duration::from_millis(100));
        let _guard_a = a2.lock().unwrap(); // waits on mutex_a
    });

    t1.join().unwrap();
    t2.join().unwrap();
    println!("done");
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: the borrow checker detects the circular lock dependency between mutex_a and mutex_b and refuses to compile",
        "Compiles and runs fine; std::sync::Mutex internally orders lock acquisition to avoid deadlock",
        "Compiles fine, but deadlocks at runtime: both threads block forever, each holding the lock the other is waiting on",
        "Compiles fine and completes nondeterministically; whichever thread locked first eventually times out and releases its lock",
      ],
      correctIndex: 2,
    },
    explanation:
      "This compiles cleanly and, when run, hangs forever: `t1` holds `mutex_a` and blocks " +
      "waiting for `mutex_b`, while `t2` holds `mutex_b` and blocks waiting for `mutex_a`: " +
      "classic circular-wait deadlock, confirmed by actually running it (`join()` never " +
      "returns). The nuance worth pinning down is what the borrow checker actually " +
      "promises. It guarantees no *data race* (no two threads touching the same memory " +
      "where at least one write happens without synchronization) by making `Mutex<T>` the " +
      "*only* way to get a `&mut T` into the shared `i32`, and that path is required to go " +
      "through `lock()`. But lock *acquisition order across two independent mutexes* is a " +
      "purely runtime, logical property that has nothing to do with aliasing or data " +
      "races: `std::sync::Mutex::lock` just blocks the calling thread until it can " +
      "acquire the lock, with no built-in deadlock detection or global lock ordering. The " +
      "type system has no way to see 'thread A will eventually want mutex_b while holding " +
      "mutex_a'; that's a whole-program control-flow fact, not a type fact. So 'Rust " +
      "prevents concurrency bugs' is true only for the specific bug class of data races; " +
      "deadlocks, livelocks, and priority inversion are all still possible in 100% safe " +
      "Rust, with no `unsafe` involved anywhere in this example. The fix is the same " +
      "discipline C++ requires: always acquire multiple locks in a single globally-" +
      "consistent order (or use `std::sync::TryLockError`-based backoff, or collapse both " +
      "values under one `Mutex`).",
    references: [
      "https://doc.rust-lang.org/std/sync/struct.Mutex.html",
      "https://doc.rust-lang.org/book/ch16-03-shared-state.html",
    ],
  },
  {
    id: "rust-unsafe-dangling-raw-ptr-01",
    category: "rust",
    difficulty: "hard",
    title: "Dereferencing a raw pointer built from a callee's local",
    tags: ["unsafe", "raw-pointers", "undefined-behavior"],
    type: "trace",
    prompt:
      "`dangling()` hands back a raw pointer built from one of its own locals. What " +
      "happens when `main` dereferences that pointer inside the `unsafe` block?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn dangling() -> *const i32 {
    let x = 42;
    &x as *const i32
}

fn main() {
    let ptr = dangling();
    unsafe {
        println!("{}", *ptr);
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compile error: cannot return a pointer to a local variable",
        "Undefined behavior: it may print 42, print garbage, or do something else entirely",
        "Runtime panic: 'attempt to dereference a dangling pointer'",
        "Guaranteed to print 42; a raw pointer keeps its pointee's stack slot alive, just like a reference would",
      ],
      correctIndex: 1,
    },
    explanation:
      "This compiles. Recent rustc emits a `dangling_pointers_from_locals` warning " +
      "(`function returns a dangling pointer to dropped local variable \\`x\\``), but only " +
      "a warning, since merely creating a dangling raw pointer is safe. Running it then " +
      "invokes genuine undefined behavior at `*ptr`, identical in kind to " +
      "dereferencing a freed `int*` in C++. `x` is destroyed when `dangling()` returns, so " +
      "`ptr` points at a stack slot that's since been reused by `main`'s own frame; reading " +
      "through it may print 42, may print an unrelated value (it did, when actually run: " +
      "the slot had already been overwritten), or could in principle do worse. This is " +
      "precisely the point of `unsafe`: it does not turn Rust into 'C++ mode' for the whole " +
      "function. The borrow checker still fully applies to every safe operation around the " +
      "block: safe indexing still bounds-checks, safe references still can't alias " +
      "improperly, and ordinary shared/`&mut` data still can't race. `unsafe` only unlocks " +
      "a short, fixed list of operations the compiler cannot otherwise verify: " +
      "dereferencing a raw pointer, calling an `unsafe fn` (including FFI), mutating a " +
      "`static mut`, reading/writing a union field, and implementing an `unsafe trait`. " +
      "Once you write `*ptr`, you've personally taken on the obligation the compiler " +
      "usually enforces: that the pointer is non-null, properly aligned, and points at a " +
      "live, initialized value of the right type for the duration of the access, and " +
      "nothing checks that obligation for you at compile time or runtime.",
    references: [
      "https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html",
      "https://doc.rust-lang.org/nomicon/what-unsafe-does.html",
      "https://doc.rust-lang.org/reference/behavior-considered-undefined.html",
    ],
  },
  {
    id: "rust-closure-traits-01",
    category: "rust",
    difficulty: "medium",
    title: "Calling a closure twice when its body consumes a capture",
    tags: ["closures", "fnonce", "fnmut", "fn", "move"],
    type: "trace",
    prompt: "`greet` is called twice in a row. What happens when this program is compiled?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn main() {
    let name = String::from("Alice");

    let greet = move || {
        let owned: String = name.into();
        println!("hello, {}", owned);
    };

    greet();
    greet();
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Compiles and prints \"hello, Alice\" twice",
        "Compile error: cannot move `name` into a closure without an explicit `Clone` bound on `String`",
        "Compiles, but the second call panics at runtime with 'closure called after being consumed'",
        "Compile error at the second call: use of moved value: `greet`",
      ],
      correctIndex: 3,
    },
    explanation:
      "Which of `Fn` / `FnMut` / `FnOnce` a closure implements falls out entirely from how " +
      "its body uses the captured variables; the compiler infers it, you never write it. " +
      "A closure that only reads captures (e.g. `println!(\"{}\", name)`) implements `Fn` " +
      "(and, since every `Fn` is also `FnMut` and `FnOnce`, all three). One that mutates a " +
      "capture through `&mut` implements `FnMut` (and `FnOnce`) but not `Fn`. This " +
      "closure's body calls `name.into()`, which takes `name` *by value* and moves it out " +
      "of the closure's environment: so the closure's call operator can only be `self` " +
      "(consuming), meaning it implements `FnOnce` alone. Calling `greet()` the first time " +
      "invokes that consuming call operator, which moves `greet` itself in order to move " +
      "`name` out of it; after that call, `greet` (the closure value) no longer exists as " +
      "a usable binding, exactly like any other moved-from variable. The second `greet()` " +
      "is therefore a use of a moved value, and rustc rejects it with `error[E0382]: use of " +
      "moved value: \\`greet\\`` at the second call site, with a note that the closure " +
      "'cannot be invoked more than once because it moves the variable `name` out of its " +
      "environment.' There is no way to call an `FnOnce`-only closure twice; the type " +
      "system enforces 'consumed at most once' the same way it enforces that for any other " +
      "owned value.",
    references: [
      "https://doc.rust-lang.org/std/ops/trait.FnOnce.html",
      "https://doc.rust-lang.org/book/ch13-01-closures.html",
    ],
  },
  {
    id: "rust-integer-overflow-01",
    category: "rust",
    difficulty: "hard",
    title: "Integer overflow in a debug build vs. an optimized build",
    tags: ["integer-overflow", "debug-assertions", "wrapping", "panic"],
    type: "trace",
    prompt:
      "`get_max()` returns `i32::MAX` through `std::hint::black_box` (so the compiler " +
      "can't prove the overflow at compile time and constant-fold it away). Compare a " +
      "plain debug build (`rustc main.rs`) against an optimized release build (`rustc -O " +
      "main.rs`); same source, same `x + 1`. What does each produce?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn get_max() -> i32 {
    std::hint::black_box(i32::MAX)
}

fn main() {
    let x: i32 = get_max();
    let y = x + 1;
    println!("{}", y);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Panics in both the debug and the release build with 'attempt to add with overflow'",
        "Silently wraps to i32::MIN (-2147483648) in both the debug and the release build",
        "Debug build panics at runtime with 'attempt to add with overflow'; release build (`-O`) silently wraps to -2147483648",
        "Compile error in the debug build (`arithmetic_overflow` lint denies it); release build silently wraps",
      ],
      correctIndex: 2,
    },
    explanation:
      "Confirmed by actually building and running both: `rustc main.rs` (debug, with " +
      "`debug-assertions` on by default) panics at `y = x + 1` with `thread 'main' " +
      "panicked at main.rs:7:13: attempt to add with overflow`; `rustc -O main.rs` " +
      "(release-equivalent, with `debug-assertions` off) runs to completion and prints " +
      "`-2147483648`, i32::MIN, via ordinary two's-complement wraparound. Overflow " +
      "checking on arithmetic ops is controlled by the `overflow-checks` codegen flag, " +
      "which defaults to whatever `debug-assertions` is set to: on in an unoptimized/dev " +
      "build, off in an optimized/release build (in Cargo terms, the `dev` profile enables " +
      "it and the `release` profile doesn't, unless overridden). This surprises people in " +
      "both directions: Rust doesn't 'always check' arithmetic (release builds silently " +
      "wrap, exactly like unsigned overflow in C++; though note C++ *signed* overflow is " +
      "outright UB, whereas Rust's release-mode wrap is at least a well-defined, documented " +
      "two's-complement wrap), and it doesn't 'never check' either (debug builds panic " +
      "loudly on the exact bug that C++ would silently miscompute in either build type). " +
      "The get_max()/black_box indirection in this snippet matters for a subtle reason: " +
      "with a literal like `i32::MAX + 1` written directly, rustc's `arithmetic_overflow` " +
      "lint (deny-by-default) proves the overflow at compile time via constant folding and " +
      "hard-errors in *both* build profiles: the debug-vs-release runtime distinction only " +
      "shows up once the value is opaque to the optimizer. For overflow behavior you " +
      "control explicitly, independent of build profile, use `checked_add` (returns " +
      "`Option`), `wrapping_add` (always wraps), `saturating_add` (clamps to " +
      "MIN/MAX), or `overflowing_add` (returns the wrapped value plus a bool).",
    references: [
      "https://doc.rust-lang.org/book/ch03-02-data-types.html#integer-overflow",
      "https://doc.rust-lang.org/std/primitive.i32.html#method.wrapping_add",
      "https://doc.rust-lang.org/reference/expressions/operator-expr.html#overflow",
    ],
  },
  {
    id: "rust-result-question-mark-01",
    category: "rust",
    difficulty: "medium",
    title: "Propagating a parse error through nested ? operators",
    tags: ["error-handling", "result", "question-mark-operator", "from-trait"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `use std::num::ParseIntError;

fn parse_and_double(s: &str) -> Result<i32, ParseIntError> {
    let n: i32 = s.parse()?;
    Ok(n * 2)
}

fn process(a: &str, b: &str) -> Result<i32, ParseIntError> {
    let x = parse_and_double(a)?;
    let y = parse_and_double(b)?;
    Ok(x + y)
}

fn main() {
    match process("3", "abc") {
        Ok(v) => println!("Ok({})", v),
        Err(e) => println!("Err({})", e),
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Ok(6)",
        "Err(invalid digit found in string)",
        "Compile error: the `?` operator can only be used in a function that returns `Result`",
        "Panics: called `Result::unwrap()` on an `Err` value",
      ],
      correctIndex: 1,
    },
    explanation:
      "`process(\"3\", \"abc\")` first calls `parse_and_double(\"3\")`. `\"3\".parse::<i32>()` " +
      "succeeds with `Ok(3)`, `?` unwraps it to `3`, and the function returns `Ok(6)`; back " +
      "in `process`, `x` is bound to `6`. Next it calls `parse_and_double(\"abc\")`. " +
      "`\"abc\".parse::<i32>()` fails, producing `Err(ParseIntError)` whose `Display` text is " +
      "\"invalid digit found in string\": the `?` inside `parse_and_double` immediately " +
      "returns that `Err` from the function (the `n * 2` line never runs). That `Err` " +
      "becomes the result of `parse_and_double(b)` back in `process`, where the second `?` " +
      "sees an `Err` and immediately returns it from `process` too; `Ok(x + y)` is never " +
      "reached. `main` prints `Err({})` formatted with `ParseIntError`'s `Display` impl, " +
      'giving exactly "Err(invalid digit found in string)". On the error path, `?` calls ' +
      "`From::from(err)` to convert the error into the function's declared error type; here " +
      "both functions declare `ParseIntError`, so the trivial reflexive `From<T> for T` " +
      "applies and nothing changes. If `process`'s error type were something else (say a " +
      "custom `MyError` with no `From<ParseIntError>` impl), this would not compile: rustc " +
      "would reject the `?` with a type-mismatch error resolving the `FromStr::Err` " +
      "associated type against the declared error type (E0271), e.g. \"expected `MyError`, " +
      "found `ParseIntError`\", because `?` has no way to perform the conversion.",
    references: [
      "https://doc.rust-lang.org/std/result/index.html#the-question-mark-operator-",
      "https://doc.rust-lang.org/std/convert/trait.From.html",
    ],
  },
  {
    id: "rust-option-unwrap-panic-01",
    category: "rust",
    difficulty: "medium",
    title: "Calling unwrap() on the Option returned by Iterator::find",
    tags: ["option", "unwrap", "panic", "error-handling"],
    type: "trace",
    prompt: "What happens when this program runs?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn find_even(v: &[i32]) -> Option<i32> {
    v.iter().copied().find(|x| x % 2 == 0)
}

fn main() {
    let v = vec![1, 3, 5, 7];
    let first_even = find_even(&v);
    println!("{}", first_even.unwrap());
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Prints nothing meaningful; the program exits normally with status code 0",
        "Compile error: `.unwrap()` requires `Option<T>` to implement `Default`",
        "Prints `None`",
        "Panics at runtime: called `Option::unwrap()` on a `None` value",
      ],
      correctIndex: 3,
    },
    explanation:
      "`find_even` scans `v = [1, 3, 5, 7]` for the first element satisfying `x % 2 == 0`. " +
      "None of `1`, `3`, `5`, `7` are even, so `.find(...)` exhausts the iterator without a " +
      "match and returns `None`: `first_even` is `None`. Calling `.unwrap()` on a `None` " +
      "panics immediately at runtime with exactly the message `called \\`Option::unwrap()\\` " +
      "on a \\`None\\` value`; the panic unwinds before `println!` ever produces output, " +
      "and the process exits with status 101. Contrast this with the safer combinators on the same " +
      "`Option`: `first_even.unwrap_or(0)` would yield `0` instead of panicking; " +
      "`first_even.unwrap_or_else(|| -1)` computes a fallback lazily only when needed; " +
      "`if let Some(x) = first_even { ... } else { ... }` or a full `match` lets you handle " +
      "the `None` case explicitly without ever risking a panic; and if the surrounding " +
      "function itself returned `Option<i32>`, writing `let x = find_even(&v)?;` would " +
      "propagate the absence by returning `None` from that function instead of crashing the " +
      "whole program. `.unwrap()` is appropriate only when a `None` there would represent a " +
      "genuine, unrecoverable programming-logic bug you *want* to crash loudly on.",
    references: [
      "https://doc.rust-lang.org/std/option/enum.Option.html#method.unwrap",
      "https://doc.rust-lang.org/std/option/enum.Option.html#method.unwrap_or_else",
    ],
  },
  {
    id: "rust-panic-unwind-01",
    category: "rust",
    difficulty: "hard",
    title: "A panic inside Drop while the stack is already unwinding",
    tags: ["panic", "unwinding", "drop", "abort"],
    type: "trace",
    prompt: "What does running this program print, and how does the process end?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `struct Noisy(&'static str);

impl Drop for Noisy {
    fn drop(&mut self) {
        println!("Dropping {}", self.0);
        if self.0 == "second" {
            panic!("panic during drop!");
        }
    }
}

fn main() {
    let _a = Noisy("first");
    let _b = Noisy("second");
    panic!("initial panic");
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'Prints "Dropping second" then "Dropping first", then exits normally with status 0 once both panics are handled',
        'Prints "Dropping second", then the process aborts immediately (SIGABRT); "Dropping first" is never printed',
        "Compile error: `Drop::drop` is not allowed to call `panic!`",
        'Prints "Dropping first" then "Dropping second", then exits with status 0',
      ],
      correctIndex: 1,
    },
    explanation:
      "`main`'s `panic!(\"initial panic\")` begins unwinding the stack. By default a Rust " +
      "panic unwinds (not aborts): it walks back up through the call stack running the " +
      "`Drop` impl of every local going out of scope, in reverse declaration order, " +
      "conceptually the same shape as a C++ exception unwinding and invoking destructors. " +
      'So `_b` ("second") is dropped first, printing "Dropping second". But that `Drop` impl ' +
      "itself calls `panic!(\"panic during drop!\")`: a second panic on a thread that is " +
      "already unwinding from a first, unfinished panic. Rust cannot unwind two panics on " +
      "the same thread at once, so this is treated as an unrecoverable double panic: the " +
      "runtime immediately aborts the whole process (the real message is \"panic in a " +
      'destructor during cleanup" / "thread caused non-unwinding panic. aborting.", exit via ' +
      "SIGABRT) instead of continuing to unwind further. `_a` (\"first\") is consequently " +
      'never dropped: "Dropping first" never prints, because the abort happens before ' +
      "unwinding can reach it. This is Rust's rough equivalent of C++ calling " +
      "`std::terminate` when a second exception is thrown while the first is still " +
      'propagating: a "double panic" is unrecoverable by design, since there is no ' +
      "sensible single continuation for two simultaneous unwinds. One more wrinkle: if the " +
      'crate were built with `panic = "abort"` (instead of the default `panic = "unwind"`), ' +
      "the very *first* `panic!` would abort immediately with no unwinding and no `Drop` " +
      'impls run at all; not even "Dropping second" would print.',
    references: [
      "https://doc.rust-lang.org/std/panic/index.html",
      "https://doc.rust-lang.org/nomicon/unwinding.html",
      "https://doc.rust-lang.org/book/ch09-01-unrecoverable-errors-with-panic.html",
    ],
  },
  {
    id: "rust-unsafe-scope-01",
    category: "rust",
    difficulty: "hard",
    title: "Raw pointer dereference vs. safe indexing in one unsafe block",
    tags: ["unsafe", "raw-pointers", "bounds-checking", "undefined-behavior"],
    type: "trace",
    prompt:
      "What happens when this program runs? (Assume `std::env::args().count()` " +
      "returns 1, as it does when running the compiled binary with no extra arguments.)",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn main() {
    let arr = [10, 20, 30];
    let ptr = arr.as_ptr();
    let idx: usize = std::env::args().count() + 10;

    unsafe {
        // Raw pointer deref: requires unsafe.
        println!("first via raw ptr: {}", *ptr);
        // Safe indexing: still bounds-checked, even inside unsafe.
        println!("{}", arr[idx]);
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'Prints "first via raw ptr: 10" then "20"; unsafe disables bounds checking, so `arr[idx]` just reads out-of-bounds memory',
        "Compile error: raw pointer dereferencing and normal indexing cannot appear in the same `unsafe` block",
        'Prints "first via raw ptr: 10", then panics: index out of bounds: the len is 3 but the index is 11',
        "Undefined behavior with no output at all; entering `unsafe` invalidates the borrow checker for the rest of the block",
      ],
      correctIndex: 2,
    },
    explanation:
      "`unsafe` unlocks a specific, fixed list of extra operations: dereferencing a raw " +
      "pointer, calling an `unsafe fn` (including FFI), mutating a `static mut`, " +
      "reading/writing a `union` field, and implementing an unsafe trait; nothing else. " +
      "`*ptr` needs `unsafe` because the compiler cannot prove the raw pointer `ptr` (a " +
      "`*const i32`) still points at valid, live memory; inside the block this is allowed " +
      'and correctly prints "first via raw ptr: 10". But `arr[idx]` is ordinary safe ' +
      "indexing syntax (`Index for [T; N]`), and being lexically inside an `unsafe` block " +
      "does not change what that trait impl does: it still performs exactly the same " +
      "runtime bounds check it would outside `unsafe`. Since `idx` is `1 + 10 = 11`, well " +
      "past `arr`'s length of `3`, indexing panics with `index out of bounds: the len is 3 " +
      "but the index is 11`, identical to what would happen with no `unsafe` block at all. " +
      "To actually skip that check you would need to opt in explicitly with " +
      "`arr.get_unchecked(idx)` (itself an `unsafe fn`, and itself real undefined behavior " +
      "if out of bounds). The lesson: `unsafe` is not a blanket \"turn off the compiler\" " +
      "switch: the borrow checker, type checker, and ordinary safe-code bounds checks all " +
      "keep running unchanged inside an `unsafe` block; it only affects the small, " +
      "explicitly-gated set of operations listed above.",
    references: [
      "https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html",
      "https://doc.rust-lang.org/nomicon/",
      "https://doc.rust-lang.org/std/primitive.slice.html#method.get_unchecked",
    ],
  },
  {
    id: "rust-iterator-laziness-01",
    category: "rust",
    difficulty: "medium",
    title: "An iterator adapter chain that is never consumed",
    tags: ["iterators", "laziness", "map", "closures"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn main() {
    let v = vec![1, 2, 3];
    let iter = v.iter().map(|x| {
        println!("processing {}", x);
        x * 2
    });
    println!("iterator created, but not consumed yet");
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'processing 1\nprocessing 2\nprocessing 3\niterator created, but not consumed yet',
        "Compile error: `iter` is never used",
        'iterator created, but not consumed yet\nprocessing 1\nprocessing 2\nprocessing 3',
        "iterator created, but not consumed yet",
      ],
      correctIndex: 3,
    },
    explanation:
      "`.map()`, like nearly every `Iterator` adapter method, is lazy. Calling it just " +
      "wraps `v.iter()` in a `Map` struct holding the closure; it does not run the closure " +
      "or touch any elements at that point. Iterators only do work when something actually " +
      "pulls values out via `.next()`, whether called directly or through a consumer like " +
      "`.collect()`, `.sum()`, `.for_each()`, or a `for` loop. Here `iter` is built and then " +
      "immediately goes out of scope at the end of `main` without ever being consumed by " +
      "any of those, so `Map::next` is never called, the closure body " +
      '(`println!("processing {}", x); x * 2`) never executes, and no "processing" lines ' +
      "are printed: not even when `iter` is dropped, since dropping an iterator adapter " +
      "just drops its captured state rather than draining it. The compiler does flag `iter` " +
      "as an unused variable (a warning, not an error), a useful hint that a lazily-built " +
      "chain with no consumer is probably a bug, but the program still compiles and runs, " +
      'printing only "iterator created, but not consumed yet".',
    references: [
      "https://doc.rust-lang.org/std/iter/trait.Iterator.html",
      "https://doc.rust-lang.org/book/ch13-02-iterators.html#the-iterator-trait-and-the-next-method",
    ],
  },
  {
    id: "rust-exhaustive-match-01",
    category: "rust",
    difficulty: "medium",
    title: "A match over an enum that omits one variant",
    tags: ["match", "enum", "exhaustiveness", "pattern-matching"],
    type: "trace",
    prompt: "Does this program compile?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `enum Shape {
    Circle(f64),
    Square(f64),
    Triangle(f64, f64),
}

fn area(s: &Shape) -> f64 {
    match s {
        Shape::Circle(r) => std::f64::consts::PI * r * r,
        Shape::Square(side) => side * side,
    }
}

fn main() {
    let c = Shape::Circle(2.0);
    println!("{}", area(&c));
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes: it compiles and prints the circle's area; unmatched enum variants are allowed in `match`, same as an unhandled case in a C++ `switch`",
        "No: error[E0004]: non-exhaustive patterns: `&Shape::Triangle(_, _)` not covered",
        "Yes, but with a warning: `match` silently falls through for `Triangle`, just like a C++ `switch` without a `default:` case",
        "No; compile error because `Shape` must derive `Debug` before it can be matched on",
      ],
      correctIndex: 1,
    },
    explanation:
      "Rust's `match` must be exhaustive: the compiler statically enumerates every variant " +
      "of `Shape` (`Circle`, `Square`, `Triangle`) and requires every arm to be covered, " +
      "either by naming each variant explicitly or via a catch-all `_ => ...` arm. This " +
      "`match` only handles `Circle` and `Square`, so it fails to compile with exactly " +
      "`error[E0004]: non-exhaustive patterns: \\`&Shape::Triangle(_, _)\\` not covered`. " +
      "This is a deliberate, load-bearing difference from C++: a `switch` over an `enum " +
      "class` with an unhandled enumerator is completely legal C++; it just silently does " +
      "nothing for that case at runtime (falls through the whole switch) unless the project " +
      "has separately opted into `-Wswitch` and promoted warnings to errors. Rust needs no " +
      "equivalent opt-in step: exhaustiveness checking is a permanent, non-optional part of " +
      "the type checker, so adding a new enum variant anywhere in a codebase and forgetting " +
      "to update one of the `match` expressions over it is caught for you at compile time, " +
      "not discovered later as a silent runtime gap.",
    references: [
      "https://doc.rust-lang.org/book/ch06-02-match.html",
      "https://doc.rust-lang.org/error_codes/E0004.html",
      "https://doc.rust-lang.org/reference/expressions/match-expr.html",
    ],
  },
  {
    id: "rust-if-let-01",
    category: "rust",
    difficulty: "medium",
    title: "while let with Vec::pop as the scrutinee",
    tags: ["if-let", "while-let", "pattern-matching", "option"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn main() {
    let mut stack = vec![1, 2, 3];
    while let Some(top) = stack.pop() {
        println!("popped {}", top);
    }
    println!("stack empty: {:?}", stack);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        'popped 1\npopped 2\npopped 3\nstack empty: []',
        "Compile error: `while let` requires an `else` arm to handle the `None` case",
        'popped 3\npopped 2\npopped 1\nstack empty: [1, 2, 3]',
        'popped 3\npopped 2\npopped 1\nstack empty: []',
      ],
      correctIndex: 3,
    },
    explanation:
      "`while let Some(top) = stack.pop() { ... }` is sugar for a loop that repeatedly " +
      "evaluates `stack.pop()` and keeps running the body as long as that value matches " +
      "the pattern `Some(top)`, binding `top` to the contained value each iteration; the " +
      "loop ends the moment the scrutinee fails to match: i.e., the first time `pop()` " +
      "returns `None`. `Vec::pop` removes and returns the *last* element, so successive " +
      "calls yield `Some(3)`, `Some(2)`, `Some(1)`, then `None` once the vector is empty, " +
      'printing "popped 3", "popped 2", "popped 1" in that order before the loop exits ' +
      "naturally; no explicit `break` or `_ => {}` arm needed. By the time it exits, " +
      '`stack` has had all three elements removed, so `{:?}` prints `[]`. Without the ' +
      "sugar this would be written as `loop { match stack.pop() { Some(top) => { ... }, " +
      "None => break } }`. `while let` (and its single-pattern cousin `if let`, e.g. " +
      "`if let Some(x) = opt { ... }` in place of a full `match opt { Some(x) => { ... }, " +
      "None => {} }`) just lets you skip that ceremony when you only care about one " +
      "pattern.",
    references: [
      "https://doc.rust-lang.org/reference/expressions/loop-expr.html#predicate-pattern-loops",
      "https://doc.rust-lang.org/book/ch06-03-if-let.html",
    ],
  },
  {
    id: "rust-shadowing-01",
    category: "rust",
    difficulty: "medium",
    title: "Three successive let bindings reusing the same name",
    tags: ["shadowing", "let", "mut", "scoping"],
    type: "trace",
    prompt: "What does this program print?",
    snippet: {
      language: "rust",
      filename: "main.rs",
      code: `fn main() {
    let x = "5";
    let x: i32 = x.parse().unwrap();
    let x = x * 2;
    println!("{}", x);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "10",
        "Compile error: `x` is already defined in this scope",
        "5",
        "Compile error: cannot assign a value of type `i32` to a variable already bound to `&str`",
      ],
      correctIndex: 0,
    },
    explanation:
      "Each `let x = ...;` here introduces a brand-new binding named `x` that shadows " +
      "whatever `x` previously referred to in the same scope: it is not a mutation of the " +
      "old variable, it is a fresh variable that happens to reuse the name. The first `x` " +
      'is a `&str` holding `"5"`. The second line, `let x: i32 = x.parse().unwrap();`, ' +
      "reads that *old* `&str` `x` on the right-hand side (still fully alive up to this " +
      "point) and parses it into a completely different type, `i32`, giving `5`, then " +
      "rebinds the name `x` to that new `i32` value; the old `&str` binding still " +
      "technically exists in memory but is no longer nameable. The third line, `let x = x " +
      "* 2;`, shadows again, reading the `i32` `x` (`5`), doubling it, and binding the name " +
      "`x` to `10` one more time. `println!` prints the final shadowed binding: `10`. This " +
      "is legal specifically *because* shadowing creates a new binding rather than reusing " +
      "storage: the type is free to change between shadowed bindings (`&str` → `i32` → " +
      "`i32`), which is exactly what plain mutation cannot do: `let mut x = \"5\"; x = 5;` " +
      "is a hard compile error (mismatched types), because a `mut` binding's type is fixed " +
      "once and for all at its `let`, and reassignment can only replace the value, never " +
      "change the type.",
    references: [
      "https://doc.rust-lang.org/book/ch03-01-variables-and-mutability.html#shadowing",
    ],
  },
];
