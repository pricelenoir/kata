import type { TraceQuestion } from "@/types/question";

export const dsaQuestions: TraceQuestion[] = [
  {
    id: "dsa-avl-rotation-01",
    category: "dsa",
    difficulty: "medium",
    title: "AVL insertion triggering a double (LR) rotation",
    tags: ["avl-tree", "self-balancing", "rotations"],
    type: "trace",
    prompt:
      "Starting from an empty AVL tree, keys are inserted in this order: 30, 10, 20. After " +
      "inserting 20, the tree becomes unbalanced at the root. Which rebalancing operation does " +
      "the AVL insertion algorithm perform, and what is the new root?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "A single right rotation about 30, making 10 the new root",
        "A single left rotation about 10, making 20 the new root",
        "A double rotation (left rotation about 10, then right rotation about 30 — the LR case), making 20 the new root",
        "A double rotation (right rotation about 10, then left rotation about 30 — the RL case), making 20 the new root",
      ],
      correctIndex: 2,
    },
    explanation:
      "After inserting 30 then 10, 10 is the left child of 30. Inserting 20 (10 < 20 < 30) makes " +
      "it the right child of 10, so the newly inserted node sits in a left-then-right zig-zag " +
      "position relative to the root — the classic LR case. The root's balance factor becomes " +
      "height(left) - height(right) = 1 - (-1) = 2, an imbalance. A single rotation about 30 " +
      "cannot fix a zig-zag imbalance; the standard fix first left-rotates about 10 (converting " +
      "it into a straight-line LL shape) and then right-rotates about 30. The net effect leaves " +
      "20 as the new root with 10 as its left child and 30 as its right child.",
  },
  {
    id: "dsa-redblack-fixup-01",
    category: "dsa",
    difficulty: "hard",
    title: "Red-black insertion fixup: recolor or rotate?",
    tags: ["red-black-tree", "self-balancing", "rotations", "recoloring"],
    type: "trace",
    prompt:
      "Build a red-black tree by inserting keys 10, 5, 15, 3 in order, letting the standard " +
      "insertion-fixup run after each insertion. The tree is now: 10 (black, root), 5 (black, " +
      "left child of 10), 15 (black, right child of 10), 3 (red, left child of 5, with no " +
      "children). Key 1 is now inserted as the left child of 3 (red, by ordinary BST insertion), " +
      "creating a red-red violation between 3 and 1. What does the insertion-fixup do?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Recolor 3 and 15 to black and 10 to red, since 3's uncle (15) is red — pushing the violation up to the grandparent",
        "Recolor 3 to black only, since a red node with one red child is already a valid pattern",
        "Rotate right about 5 (the LL case: 1 is a left child of a left child) and recolor, since 3's uncle — the nil right child of 5 — is black",
        "Rotate left about 3, then right about 5 (the LR case), and recolor, since 3's uncle is black but 1 is a right child of 3",
      ],
      correctIndex: 2,
    },
    explanation:
      "The fixup for a red-red violation examines the color of the *uncle* of the newly inserted " +
      "node, not the uncle of its parent. Here the new node is 1, its parent is 3, its " +
      "grandparent is 5, and its uncle is 5's other child — the nil right child of 5, which " +
      "counts as black. A black (or nil) uncle rules out the pure-recolor case and forces a " +
      "rotation; the shape determines which one. Since 1 is a left child of 3, and 3 is a left " +
      "child of 5, this is the 'same side' LL case, handled with a single right rotation about " +
      "the grandparent (5), after which the rotated-up node (3) is recolored black and the old " +
      "grandparent (5) recolored red. Recoloring alone (as in the red-uncle case) only applies " +
      "when the uncle is red, because that case can push the violation upward without changing " +
      "any subtree heights — that option isn't available here.",
    references: [
      "https://en.wikipedia.org/wiki/Red%E2%80%93black_tree#Insertion",
    ],
  },
  {
    id: "dsa-btree-io-01",
    category: "dsa",
    difficulty: "easy",
    title: "Why databases index with B+-trees instead of balanced BSTs",
    tags: ["b-tree", "b-plus-tree", "disk-io", "databases"],
    type: "trace",
    prompt:
      "A balanced binary search tree (e.g. a red-black tree) and a B+-tree both give O(log n) " +
      "search complexity measured in key comparisons. Why do virtually all disk-backed database " +
      "indexes use B+-trees instead of balanced BSTs?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "B+-trees have a better asymptotic comparison complexity than BSTs",
        "B+-trees maximize branching factor so each node fits one disk page; this minimizes the tree's height in terms of number of nodes (i.e. disk I/Os) visited per lookup, even though key-comparison count is still O(log n)",
        "B+-trees never need to rebalance, unlike BSTs",
        "B+-trees keep all data resident in RAM, avoiding disk access entirely",
      ],
      correctIndex: 1,
    },
    explanation:
      "The real bottleneck for disk-backed structures is I/O count, not comparison count — each " +
      "node visited is, in the worst case, a separate disk seek. A BST with branching factor 2 " +
      "has height Θ(log2 n); with millions of keys that is dozens of disk reads per lookup. A " +
      "B+-tree node is sized to exactly one disk page (often holding hundreds to thousands of " +
      "keys), so its branching factor b is huge and its height is Θ(log_b n) — often only 3-4 " +
      "levels even for billions of keys. Comparisons within an already-loaded page are cheap, so " +
      "the dominant real-world cost, page reads, is minimized by maximizing b, not by improving " +
      "the comparison-count asymptotics (which stay O(log n) either way). B-trees still rebalance " +
      "via node splits/merges, just far less often given their high fanout.",
  },
  {
    id: "dsa-bplustree-leaves-01",
    category: "dsa",
    difficulty: "hard",
    title: "Range scans in a B+-tree: why no repeated descents",
    tags: ["b-plus-tree", "range-query", "disk-io"],
    type: "trace",
    prompt:
      "In a B+-tree (unlike a classic B-tree), internal nodes hold only routing keys — no " +
      "records — and every actual record lives in a leaf; the leaves are additionally threaded " +
      "into a sorted linked list. Given this, what is the complexity of a range query returning " +
      "k matching records, and why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "O(log n) total — internal routing nodes cache enough data that the whole range can be read from a single node",
        "O(k log n) — every one of the k matching records requires its own O(log n) descent from the root",
        "O(log n + k) — one O(log n) descent locates the first matching leaf, then the leaf-linked-list is walked forward k times, each an O(1) hop, with no further descents",
        "O(n) — a range query must scan every leaf because B+-trees do not support ordered traversal",
      ],
      correctIndex: 2,
    },
    explanation:
      "The single descent from root to leaf costs O(log_b n) node visits (b = branching factor) " +
      "to locate the first key at or above the range's lower bound. A classic B-tree can store " +
      "data in internal nodes too, so a range scan there may need to re-descend repeatedly; a " +
      "B+-tree avoids this specifically by pushing all records to the leaf level and threading " +
      "leaves into a linked list in sorted order. After the initial descent, retrieving the " +
      "remaining k-1 matches is just k-1 O(1) pointer hops across sibling leaves, never " +
      "revisiting internal nodes. Total cost is O(log n + k), which is why B+-trees, not " +
      "B-trees, are the near-universal choice for database range queries and cursor-style " +
      "pagination.",
  },
  {
    id: "dsa-trie-space-01",
    category: "dsa",
    difficulty: "hard",
    title: "Trie node count: shared prefixes vs. disjoint strings",
    tags: ["trie", "space-complexity"],
    type: "trace",
    prompt:
      "You insert n = 100,000 strings, each of length L = 50, into an uncompressed trie (one " +
      "child pointer per character; no compression of single-child chains). Case A: all strings " +
      "share the same 49-character prefix and differ only in their last character. Case B: no " +
      "two strings share even a single character of prefix. Approximately how many trie nodes " +
      "does each case create, and how do they compare?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both cases create roughly n × L = 5,000,000 nodes, since trie size depends only on (n, L), not on shared structure",
        "Case A creates roughly L + n ≈ 100,050 nodes (one shared 49-node chain, then n branches at the final level); Case B creates roughly n × L = 5,000,000 nodes (a fully separate path per string) — about a 50x difference for identical (n, L)",
        "Case A creates more nodes than Case B, because shared prefixes force extra branching nodes at every level",
        "Both cases create roughly n nodes total, since a trie stores one node per string regardless of length",
      ],
      correctIndex: 1,
    },
    explanation:
      "A trie's node count equals the number of distinct root-to-node paths actually used, not " +
      "simply n·L — that product is only a worst-case bound. In Case A, the first 49 characters " +
      "are identical across every string, so they collapse onto a single shared chain of 49 " +
      "nodes; only the final differing character needs up to n separate leaf nodes, giving " +
      "Θ(L + n) nodes total. In Case B, no prefix is shared at all, so every character of every " +
      "string needs its own distinct node, giving the full Θ(n·L). Both are valid tries built " +
      "over strings of the same (n, L), yet their memory footprints differ by roughly a factor " +
      "of L — exactly why 'trie space is O(total characters inserted)' is a correct worst-case " +
      "bound that can be wildly pessimistic for prefix-heavy data such as URLs or file paths.",
  },
  {
    id: "dsa-skiplist-expected-01",
    category: "dsa",
    difficulty: "medium",
    title: "Expected search complexity of a randomized skip list",
    tags: ["skip-list", "randomized-algorithms", "expected-complexity"],
    type: "trace",
    prompt:
      "A skip list assigns each inserted node a random height using independent coin flips with " +
      "promotion probability p = 1/2 (a node reaches level k with probability (1/2)^k). No " +
      "rebalancing of any kind is ever performed. What is the expected time to search for a key " +
      "among n elements?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "O(n), because without explicit rebalancing there is no way to bound the structure's shape",
        "O(log n) expected — the expected number of levels is Θ(log n), and the expected work per level before dropping down is O(1), so total expected search cost is O(log n); a pathologically unlucky run of coin flips can still degrade this toward O(n)",
        "O(sqrt n), matching the classic unrolled-linked-list bound",
        "O(1) amortized, same as a hash table, since randomized levels make lookups effectively random-access",
      ],
      correctIndex: 1,
    },
    explanation:
      "Pugh's original analysis shows that with promotion probability 1/2, the expected number " +
      "of levels a skip list builds is Θ(log n), and a backward analysis of the search path " +
      "shows the expected number of leftward/downward steps taken at each level before dropping " +
      "down is O(1). Summing O(1) work across O(log n) levels gives O(log n) expected search " +
      "time — matching a balanced BST without any rotations or explicit rebalancing. This bound " +
      "holds in expectation over the random coin flips, not in the worst case: an astronomically " +
      "unlikely sequence of flips could leave every node at level 1, degenerating the structure " +
      "into a plain sorted linked list with O(n) search. Randomization trades a worst-case " +
      "guarantee for implementation simplicity while keeping the same expected asymptotics as a " +
      "red-black tree.",
  },
  {
    id: "dsa-skiplist-correctness-01",
    category: "dsa",
    difficulty: "hard",
    title: "Skip list correctness when the coin flip is biased or removed",
    tags: ["skip-list", "correctness", "randomized-algorithms"],
    type: "trace",
    prompt:
      "Suppose a skip list's level-generation coin flip is changed so that no node is ever " +
      "promoted above level 1 (equivalently, remove randomization entirely and always assign " +
      "height 1). Search, insertion, and deletion still run using the normal skip list " +
      "algorithm on this degenerate structure. What is the effect on correctness and on " +
      "performance?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The skip list becomes incorrect — searches can return wrong results — because the express-lane levels are what guarantee finding the target key",
        "The skip list remains fully correct — every search still finds the right key or correctly reports absence — because level 1 is always a complete, sorted linked list of every element; performance degrades to O(n) per operation since there are no higher express lanes, but correctness never depended on how many levels exist",
        "The skip list stays correct for search, but insertion and deletion become unsafe and can corrupt the level-1 list",
        "The skip list silently discards elements, since nodes are only kept if promoted past level 1",
      ],
      correctIndex: 1,
    },
    explanation:
      "The invariant a skip list actually relies on for correctness is that level 1 is always a " +
      "complete, sorted linked list containing every element — that invariant holds regardless " +
      "of how, or whether, higher levels get built. Higher levels are purely a performance " +
      "optimization ('express lanes') consulted opportunistically; the algorithm always falls " +
      "through to a level-1 scan to pinpoint the exact key or its correct insertion point. " +
      "Forcing every node to height 1 collapses the structure into an ordinary sorted linked " +
      "list — correctness is completely untouched, but performance regresses from expected " +
      "O(log n) to O(n) per operation, since there is no faster path anymore. The same reasoning " +
      "applies symmetrically to a heavily biased coin (say p = 0.99): still correct, just " +
      "wasting space on levels that provide little balance benefit.",
  },
  {
    id: "dsa-unionfind-01",
    category: "dsa",
    difficulty: "hard",
    title: "Union-find complexity under partial vs. full optimization",
    tags: ["union-find", "disjoint-set", "amortized-analysis"],
    type: "trace",
    prompt:
      "Consider three union-find implementations over n elements, subjected to a sequence of m " +
      "union/find operations: (1) neither path compression nor union-by-rank (union always " +
      "attaches an arbitrary root under the other; find walks parent pointers with no " +
      "compression); (2) union-by-rank only, no path compression; (3) both union-by-rank and " +
      "path compression together. Which statement correctly ranks their complexity?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "All three give O(log n) worst case per operation — the two optimizations are redundant with each other",
        "(1) can degenerate to O(n) per find (a tree can become a straight-line chain of n nodes); (2) guarantees O(log n) worst case per operation, since union-by-rank alone bounds tree height at O(log n); (3) achieves O(α(n)) amortized per operation, α being the inverse Ackermann function — effectively constant for any n that fits in the physical universe",
        "(1) and (2) are both O(log n) amortized; only (3) improves further, to O(1) worst case per operation",
        "Path compression alone is strictly worse than no optimization at all, since it performs extra pointer writes on every find",
      ],
      correctIndex: 1,
    },
    explanation:
      "Without either optimization, repeatedly unioning in the 'wrong' direction can build a " +
      "tree that is a path of length n, making a single find cost O(n). Union-by-rank alone " +
      "(always attach the shorter/lower-rank tree under the taller one) provably bounds tree " +
      "height at O(log n), giving O(log n) worst case per find even with zero path compression. " +
      "Path compression alone (flattening the path to the root on every find) can be shown via a " +
      "potential-function argument to give O(log n) amortized per operation — better than the " +
      "naive case, but a weaker worst-single-operation guarantee than rank alone. Combining both " +
      "is Tarjan's classic result: amortized cost per operation is O(α(n)), the inverse Ackermann " +
      "function, which stays at most 4 for any n up to numbers vastly larger than the number of " +
      "atoms in the observable universe — for all practical purposes O(1), which is why " +
      "union-find with both optimizations is treated as 'essentially constant time.'",
  },
  {
    id: "dsa-segtree-basic-01",
    category: "dsa",
    difficulty: "medium",
    title: "Segment tree range-sum query and point update complexity",
    tags: ["segment-tree", "range-query"],
    type: "trace",
    prompt:
      "For a segment tree of n elements built with the update/query functions below, what is " +
      "the time complexity of a single update(...) call and a single query(...) call for an " +
      "arbitrary range [l, r]?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <vector>
using namespace std;

struct SegTree {
    vector<long long> tree;
    int n;
    SegTree(int n_) : n(n_), tree(4 * n_, 0) {}

    void update(int node, int start, int end, int idx, long long val) {
        if (start == end) { tree[node] = val; return; }
        int mid = (start + end) / 2;
        if (idx <= mid) update(2 * node, start, mid, idx, val);
        else update(2 * node + 1, mid + 1, end, idx, val);
        tree[node] = tree[2 * node] + tree[2 * node + 1];
    }

    long long query(int node, int start, int end, int l, int r) {
        if (r < start || end < l) return 0;
        if (l <= start && end <= r) return tree[node];
        int mid = (start + end) / 2;
        return query(2 * node, start, mid, l, r)
             + query(2 * node + 1, mid + 1, end, l, r);
    }
};`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "O(n) for both, since query/update might visit every leaf",
        "O(log n) for update, O(n) for query, since a range can span the whole array",
        "O(log n) for both — update descends one root-to-leaf path (tree height O(log n)); query visits at most O(log n) 'canonical' nodes because any range decomposes into at most a couple of nodes per recursion level",
        "O(sqrt n) for both, matching a sqrt-decomposition structure",
      ],
      correctIndex: 2,
    },
    explanation:
      "update descends exactly one root-to-leaf path, whose length is the tree height, Θ(log n) " +
      "for a segment tree over n leaves. query looks more dangerous because it recurses into " +
      "both children, but the key structural fact is that at each depth of the recursion at " +
      "most two nodes are only 'partially' overlapping the query range — the ones straddling the " +
      "left and right boundary; every other visited node either fully matches or fully misses " +
      "the range and returns immediately. That caps the number of nodes actually explored per " +
      "level at a small constant, so total work across O(log n) levels is O(log n), not O(n). " +
      "This 'any range decomposes into O(log n) canonical segments' argument is the same idea " +
      "that gives Fenwick trees their efficiency.",
  },
  {
    id: "dsa-segtree-lazy-01",
    category: "dsa",
    difficulty: "hard",
    title: "Why lazy propagation is needed for range updates",
    tags: ["segment-tree", "lazy-propagation"],
    type: "trace",
    prompt:
      "A variant of the segment tree above needs to support 'add v to every element in range " +
      "[l, r]' (a range update), not just point updates. The naive version below applies a " +
      "range update by recursing down to every affected leaf individually. What is its " +
      "worst-case complexity, and what does adding lazy propagation change?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `void rangeUpdateNaive(int node, int start, int end, int l, int r, long long v) {
    if (r < start || end < l) return;
    if (start == end) { tree[node] += v; return; }
    int mid = (start + end) / 2;
    rangeUpdateNaive(2 * node, start, mid, l, r, v);
    rangeUpdateNaive(2 * node + 1, mid + 1, end, l, r, v);
    tree[node] = tree[2 * node] + tree[2 * node + 1];
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Naive: O(log n), same as a point update, since tree height doesn't change; lazy propagation only helps queries, not updates",
        "Naive: O(n) worst case, since a range spanning the whole array touches all n leaves individually; lazy propagation stamps a pending value on the O(log n) canonical nodes covering [l, r] instead of recursing into children, pushing the tag down only when a later operation actually needs to descend past that node — restoring O(log n) per update",
        "Naive and lazy propagation have identical complexity; lazy propagation is purely a constant-factor optimization",
        "Naive: O(log^2 n); lazy propagation reduces it to O(log n) by caching partial sums",
      ],
      correctIndex: 1,
    },
    explanation:
      "rangeUpdateNaive always recurses down to start == end before applying anything, so a " +
      "range spanning the whole array (l=0, r=n-1) touches all n leaves — O(n) worst case, no " +
      "better than a brute-force array scan and defeating the point of the tree. Lazy " +
      "propagation instead applies the update only at the O(log n) canonical nodes that exactly " +
      "cover [l, r] (the same nodes query() would visit), storing the pending delta in a 'lazy' " +
      "tag at each such node rather than recursing further; the tag is pushed down to children " +
      "only the next time the tree actually needs to descend past that node, for a later " +
      "overlapping query or update. This restores O(log n) per range update while keeping " +
      "queries correct, at the cost of a push-down step before recursing into any node — the " +
      "standard technique for range-update/range-query segment trees.",
  },
  {
    id: "dsa-fenwick-bittrick-01",
    category: "dsa",
    difficulty: "medium",
    title: "Fenwick tree index traversal via i & -i",
    tags: ["fenwick-tree", "binary-indexed-tree", "bit-manipulation"],
    type: "trace",
    prompt:
      "For n = 8, calling update(bit, 8, 5, delta) with the code below touches which 1-indexed " +
      "array positions, and why does the loop terminate in O(log n) steps?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `void update(vector<long long>& bit, int n, int i, long long delta) {
    for (; i <= n; i += i & (-i))
        bit[i] += delta;
}

long long prefixSum(vector<long long>& bit, int i) {
    long long sum = 0;
    for (; i > 0; i -= i & (-i))
        sum += bit[i];
    return sum;
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Only index 5, since i & -i isolates the value itself when an update is meant to stay local",
        "Indices 5, 6, 8 — each step adds i's lowest set bit (i & -i) to jump to the next index whose owned range also covers position 5; since an n-bit integer has at most O(log n) distinct lowest-set-bit positions as it's repeatedly cleared, at most O(log n) such jumps occur before i exceeds n",
        "Indices 5, 6, 7, 8, incrementing by 1 each time — O(n) in the worst case",
        "Indices 5, then 10, 20, 40, ..., doubling each time until exceeding n",
      ],
      correctIndex: 1,
    },
    explanation:
      "i & -i isolates the lowest set bit of i's two's-complement representation — for i=5 " +
      "(0b101), i & -i = 1, so i becomes 6 (0b110); for i=6, i & -i = 2, so i becomes 8 " +
      "(0b1000); for i=8, i & -i = 8, so i becomes 16, which exceeds n=8 and stops the loop. So " +
      "update(5, ...) touches bit[5], bit[6], bit[8] — each Fenwick index 'owns' a range whose " +
      "size equals its lowest set bit, and adding that value walks up to the next index whose " +
      "owned range also covers position 5. Because any n-bit integer has at most O(log n) bit " +
      "positions that can serve as 'the lowest set bit' as bits are cleared and higher ones set, " +
      "this ascent takes O(log n) steps — the same asymptotic bound as a segment tree but with a " +
      "smaller constant factor, since there's no recursion or pointer chasing, just array " +
      "indexing and one bitwise AND per step.",
    references: ["https://cp-algorithms.com/data_structures/fenwick.html"],
  },
  {
    id: "dsa-fibheap-dijkstra-01",
    category: "dsa",
    difficulty: "hard",
    title: "Fibonacci heap decrease-key and Dijkstra's asymptotic complexity",
    tags: ["fibonacci-heap", "dijkstra", "priority-queue", "graph-algorithms"],
    type: "trace",
    prompt:
      "Dijkstra's algorithm performs V extract-min operations and up to E decrease-key " +
      "operations (one per edge relaxation that improves a tentative distance). With a binary " +
      "heap, decrease-key costs O(log V) (a sift-up, typically requiring an auxiliary map from " +
      "vertex to heap index). With a Fibonacci heap, decrease-key costs O(1) amortized while " +
      "extract-min stays O(log V) amortized. What is Dijkstra's total complexity with each, and " +
      "why does the difference matter?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Binary heap: O(E log V); Fibonacci heap: O(E + V log V) — identical up to constants, so the Fibonacci heap has no practical benefit",
        "Binary heap: O(E log V), dominated by up to E decrease-keys at O(log V) each; Fibonacci heap: O(E + V log V), since all E decrease-keys collectively cost only O(E) amortized and only the V extract-mins pay the O(log V) factor — asymptotically better whenever E is ω(V), i.e. on dense graphs",
        "Both are O(V^2) regardless of the heap, since Dijkstra must examine every vertex pair",
        "The Fibonacci heap makes Dijkstra O(E) overall, removing the log factor entirely, since both its operations are O(1) amortized",
      ],
      correctIndex: 1,
    },
    explanation:
      "With a binary heap, every decrease-key is an O(log V) sift-up, so up to E of them cost " +
      "O(E log V) total, dominating the O(V log V) from V extract-mins — giving overall " +
      "O(E log V) (equivalently O((V+E) log V)). A Fibonacci heap's decrease-key is O(1) " +
      "amortized (via lazy consolidation and cascading cuts, whose cost is only paid off at the " +
      "next extract-min), so the E decrease-keys collapse to O(E) total, leaving only the V " +
      "extract-mins, each O(log V) amortized, as the log-factor term: O(E + V log V). For sparse " +
      "graphs (E = O(V)) the two bounds are asymptotically similar, but for dense graphs (E close " +
      "to V^2) the Fibonacci-heap bound O(V^2 + V log V) = O(V^2) beats the binary-heap bound " +
      "O(V^2 log V) by a full log V factor — the textbook reason Fibonacci heaps are paired with " +
      "Dijkstra in complexity theory, even though large constant factors usually make d-ary " +
      "heaps faster in practice.",
  },
  {
    id: "dsa-hash-collision-01",
    category: "dsa",
    difficulty: "medium",
    title: "Primary clustering under linear probing vs. separate chaining",
    tags: ["hash-table", "open-addressing", "separate-chaining", "load-factor"],
    type: "trace",
    prompt:
      "A hash table is filled to load factor α = 0.9 (90% of slots occupied). One version uses " +
      "open addressing with linear probing; another uses separate chaining. Which has the worse " +
      "expected number of probes for an unsuccessful search, and why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "They're equal — load factor alone determines expected probes, independent of collision-resolution strategy",
        "Separate chaining is worse, since following pointers has worse cache locality than open addressing",
        "Linear probing is worse: occupied slots merge into long runs ('primary clustering'), so a collision anywhere in a run forces probing through the whole run; expected probes for an unsuccessful search grow like ~(1+1/(1-α)^2)/2, blowing up as α→1, versus separate chaining's much gentler ~1+α",
        "Linear probing is worse only for successful searches; unsuccessful searches perform identically under both schemes",
      ],
      correctIndex: 2,
    },
    explanation:
      "Linear probing's defining pathology is primary clustering: once several keys collide near " +
      "each other, the run of occupied slots they form keeps growing, because any new key that " +
      "hashes into that run must probe past the entire run to find an empty slot — runs are " +
      "self-reinforcing. Knuth's classical analysis gives the expected number of probes for an " +
      "unsuccessful search under linear probing as approximately (1 + 1/(1-α)^2)/2, which " +
      "diverges sharply as α approaches 1 (at α=0.9 that's already roughly 50 probes). Separate " +
      "chaining has no clustering at all — a collision just extends one bucket's linked list " +
      "independently of neighboring buckets — so its expected unsuccessful-search cost grows " +
      "only linearly with α, roughly 1+α (about 1.9 at α=0.9). This is why open-addressing " +
      "tables are typically resized well before α approaches 1, often around 0.7, while chained " +
      "tables tolerate higher load factors far more gracefully.",
    references: ["https://en.wikipedia.org/wiki/Linear_probing#Analysis"],
  },
  {
    id: "dsa-bloomfilter-negatives-01",
    category: "dsa",
    difficulty: "easy",
    title: "Why a Bloom filter never produces false negatives",
    tags: ["bloom-filter", "probabilistic-data-structures"],
    type: "trace",
    prompt:
      "A Bloom filter with k hash functions and an m-bit array supports insert and (probabilistic) " +
      "membership query, but no deletion. Why can it produce false positives but is guaranteed " +
      "to never produce a false negative?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Because the hash functions are cryptographically secure and collision-resistant",
        "Because inserting an element deterministically sets all k of its hash-mapped bits to 1, and those bits are never cleared (no deletion), so querying a previously-inserted element always finds all k bits set; a false positive can only occur when other insertions coincidentally set all k bits an absent element hashes to",
        "Because the bit array is resized whenever it gets too full, preventing any bit from ever being overwritten",
        "Because each element is also stored in a small backup list alongside the bit array, guaranteeing exact recall",
      ],
      correctIndex: 1,
    },
    explanation:
      "Inserting an element x sets bits h1(x)...hk(x) to 1 unconditionally, and a standard Bloom " +
      "filter provides no operation that ever clears a bit back to 0. So if x was inserted, " +
      "every one of its k bits is guaranteed to still be 1 whenever it is later queried, meaning " +
      "the query — which just checks all k bits — always answers 'present.' A false positive " +
      "arises only in the opposite direction: some element y that was never inserted can still " +
      "have all k of its bits happen to be 1, purely because other elements' insertions " +
      "independently set those same positions — an unlucky coincidence, not a guaranteed " +
      "outcome. This asymmetry (no false negatives, possible false positives) is what makes " +
      "Bloom filters useful as a fast pre-filter in front of an expensive exact check: a " +
      "negative answer can always be trusted completely.",
  },
  {
    id: "dsa-bloomfilter-fprate-01",
    category: "dsa",
    difficulty: "hard",
    title: "Optimal hash count and the false-positive-rate blowup",
    tags: ["bloom-filter", "false-positive-rate", "hash-functions"],
    type: "trace",
    prompt:
      "A Bloom filter uses m = 1,000,000 bits for n = 100,000 inserted elements (m/n = 10). The " +
      "false-positive rate is approximately (1 - e^(-kn/m))^k for k hash functions, minimized " +
      "near k* = (m/n)·ln 2 ≈ 6.93, i.e. k=7. An engineer reasons 'more hash functions means more " +
      "bits checked means fewer false positives' and bumps k up to 20, without changing m or n. " +
      "What happens to the false-positive rate?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It keeps decreasing, since checking more bits per query can only make a false positive harder to achieve",
        "It stays essentially the same, since the formula is dominated by m/n, not k",
        "It increases relative to k=7, because each insertion now sets 20 bits instead of 7, saturating the bit array with 1s much faster; past the optimal k*, extra hash functions cost more in array saturation than they gain in additional independent checks",
        "It becomes exactly 0, since 20 hash functions provide enough redundancy to eliminate all collisions",
      ],
      correctIndex: 2,
    },
    explanation:
      "The formula (1 - e^(-kn/m))^k captures a genuine tradeoff: more hash functions add more " +
      "independent bit checks (good for reducing false positives), but each insertion also sets " +
      "more bits, so the array's saturation (fraction of bits that are 1) grows faster as more " +
      "elements are inserted (bad). k* = (m/n)·ln 2 is exactly the balance point between these " +
      "two effects; past it, saturation cost dominates and the false-positive rate rises again as " +
      "k grows further. At m/n=10, k*≈6.93, so k=7 is near-optimal; jumping to k=20 pushes the " +
      "array toward being almost entirely 1s well before all n elements are inserted, making " +
      "essentially every query — including for absent elements — report 'possibly present,' " +
      "driving the false-positive rate up rather than down. This non-monotonicity — more hashing " +
      "is not free redundancy — is exactly the subtlety interviewers probe for.",
  },
  {
    id: "dsa-lru-cache-01",
    category: "dsa",
    difficulty: "hard",
    title: "A supposedly O(1) LRU cache with a hidden linear scan",
    tags: ["lru-cache", "hash-map", "linked-list", "complexity-analysis"],
    type: "trace",
    prompt:
      "This LRUCache is intended to support get and put in O(1). Does it actually achieve that?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `#include <list>
#include <unordered_map>

class LRUCache {
    int capacity;
    std::list<int> order;                 // most recently used at front
    std::unordered_map<int, int> cache;   // key -> value

public:
    LRUCache(int cap) : capacity(cap) {}

    int get(int key) {
        auto it = cache.find(key);
        if (it == cache.end()) return -1;
        order.remove(key);       // move key to front
        order.push_front(key);
        return it->second;
    }

    void put(int key, int value) {
        if (cache.find(key) != cache.end()) {
            order.remove(key);
        } else if ((int)cache.size() >= capacity) {
            int lru = order.back();
            order.pop_back();
            cache.erase(lru);
        }
        order.push_front(key);
        cache[key] = value;
    }
};`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Yes — the unordered_map gives O(1) lookup and the list gives O(1) reordering, so both operations are O(1)",
        "No — order.remove(key) performs a linear scan of the doubly linked list to find the node holding key, since the map only stores key -> value, not key -> list iterator; both get and put are therefore O(n) worst case, not O(1)",
        "No — only put is O(n); get is genuinely O(1) since it never touches the list",
        "No — the unordered_map itself is O(n) per lookup regardless of the list logic, due to hash collisions",
      ],
      correctIndex: 1,
    },
    explanation:
      "std::list::remove(value) erases all elements equal to value by scanning the list from the " +
      "front — an O(n) linear pass, because a plain list node offers no way to jump directly to " +
      "the element holding a given key. The cache's unordered_map only maps key to value, giving " +
      "no shortcut to the corresponding list node. Both get (which calls order.remove(key) to " +
      "move the accessed key to the front) and put (which does the same, plus possibly evicting " +
      "the back) therefore cost O(n) worst case, defeating the entire point of using a linked " +
      "list for reordering. The standard fix is to make the map store key -> " +
      "std::list<int>::iterator (alongside or instead of the value), so the exact node can be " +
      "located in O(1) and relocated with list::splice, moving an existing node to the front in " +
      "O(1) with no scan and no reallocation — that is the real O(1)-both-operations LRU design.",
  },
  {
    id: "dsa-dijkstra-negative-01",
    category: "dsa",
    difficulty: "hard",
    title: "Why Dijkstra's algorithm is wrong with a negative edge",
    tags: ["dijkstra", "graph-algorithms", "shortest-path", "negative-weights"],
    type: "trace",
    prompt:
      "Given the directed, weighted edges A→B (weight 1), A→C (weight 4), C→B (weight -10), run " +
      "standard Dijkstra from source A: extract-min a vertex, finalize its distance, relax its " +
      "outgoing edges, never reconsider a finalized vertex. What distance does Dijkstra report " +
      "for B, and is it correct?",
    snippet: {
      language: "text",
      filename: "graph.txt",
      code: `A --1--> B
A --4--> C
C --(-10)--> B`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Dijkstra reports dist[B] = 1, which is correct — that is indeed the shortest path",
        "Dijkstra reports dist[B] = 1, but the true shortest distance is -6 via A→C→B; Dijkstra finalizes B before C is ever processed, and its greedy invariant — a finalized vertex's distance can never improve — silently assumes no later-relaxed edge can decrease it, which fails as soon as a negative edge like C→B exists",
        "Dijkstra reports dist[B] = -6 correctly, because it always relaxes every outgoing edge of every vertex before finalizing any of them",
        "Dijkstra enters an infinite loop, since C→B has negative weight",
      ],
      correctIndex: 1,
    },
    explanation:
      "Tracing it: dist[A]=0; relaxing A's edges gives dist[B]=1, dist[C]=4. The priority queue's " +
      "minimum is B (1 < 4), so Dijkstra extracts and permanently finalizes B at distance 1 — " +
      "the algorithm never revisits a finalized vertex's distance. It then extracts C (distance " +
      "4) and relaxes C→B: 4 + (-10) = -6, strictly less than B's finalized 1, but there is no " +
      "mechanism to un-finalize B, so the improvement is simply discarded. The root cause is " +
      "Dijkstra's correctness proof, which relies on the invariant that once a vertex is popped " +
      "with the current minimum tentative distance, no unexplored path can beat it — a claim " +
      "that only holds when all edge weights are non-negative, since a negative edge is exactly " +
      "the kind of thing that can make a 'longer-looking' path cheaper after the fact. This is " +
      "precisely why negative weights require Bellman-Ford or Johnson's algorithm instead.",
  },
  {
    id: "dsa-bellmanford-01",
    category: "dsa",
    difficulty: "medium",
    title: "Bellman-Ford's iteration count and negative-cycle detection",
    tags: ["bellman-ford", "graph-algorithms", "negative-cycle"],
    type: "trace",
    prompt:
      "Bellman-Ford relaxes all E edges once per round. A candidate implementation runs exactly " +
      "V-1 rounds and then stops, reporting the resulting distances as final, with no further " +
      "check. What is its time complexity, and what capability does it lack compared to the " +
      "textbook version?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `for (int round = 0; round < V - 1; round++) {
    for (auto& [u, v, w] : edges) {
        if (dist[u] != INF && dist[u] + w < dist[v])
            dist[v] = dist[u] + w;
    }
}
// stops here — no extra round, no negative-cycle check`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "O(V + E); it lacks nothing, this is the complete algorithm",
        "O(VE); it correctly computes shortest paths when no negative cycle is reachable from the source (V-1 rounds suffice, since a shortest simple path has at most V-1 edges), but it cannot detect a negative cycle — that requires one further round checking whether any edge can still be relaxed, which would be impossible if all distances had already converged",
        "O(V^2 E); it lacks the ability to handle negative edge weights at all, only negative cycles",
        "O(E log V); it lacks a priority queue, which Bellman-Ford requires to terminate correctly",
      ],
      correctIndex: 1,
    },
    explanation:
      "Each of the V-1 rounds relaxes all E edges, giving O(VE) total — the standard bound. The " +
      "V-1 count isn't arbitrary: a simple shortest path in a graph with no negative cycle " +
      "visits at most V vertices and so has at most V-1 edges, so after V-1 rounds of relaxing " +
      "every edge, all shortest-path distances are guaranteed to have converged, provided no " +
      "negative cycle is reachable from the source. What this truncated implementation loses is " +
      "negative-cycle detection: the textbook algorithm performs one extra (Vth) round and " +
      "checks whether any edge can still be relaxed; if so, some vertex lies on or downstream of " +
      "a negative cycle, since a converged, cycle-free shortest-path assignment can never be " +
      "improved further no matter how many more rounds run. Skipping that extra round doesn't " +
      "make the V-1-round distances wrong when no negative cycle exists, but it silently " +
      "produces bogus 'converged' distances when one does exist, with no way to tell the two " +
      "situations apart.",
  },
  {
    id: "dsa-floydwarshall-01",
    category: "dsa",
    difficulty: "easy",
    title: "Floyd-Warshall's all-pairs shortest path complexity",
    tags: ["floyd-warshall", "all-pairs-shortest-path", "dynamic-programming"],
    type: "trace",
    prompt:
      "What is the time and space complexity of this all-pairs shortest path computation on a " +
      "graph with V vertices, and what does the outer loop variable k represent?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `for (int k = 0; k < V; k++)
    for (int i = 0; i < V; i++)
        for (int j = 0; j < V; j++)
            if (dist[i][k] + dist[k][j] < dist[i][j])
                dist[i][j] = dist[i][k] + dist[k][j];`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Time O(V^2), space O(V^2) — k just indexes an optimization pass",
        "Time O(V^3), space O(V^2) — the triple-nested loop runs exactly V^3 iterations of O(1) work; k represents 'the highest-indexed intermediate vertex allowed on the path so far', with dist[i][j] after the k-th outer iteration holding the shortest i→j path using only vertices {0..k} as intermediates",
        "Time O(V^3 log V), space O(V^3) — a hidden logarithmic factor comes from the comparison in the if-statement",
        "Time O(E·V), space O(V) — Floyd-Warshall runs Bellman-Ford from every source",
      ],
      correctIndex: 1,
    },
    explanation:
      "The three nested loops each run V times with no early termination, giving exactly V^3 " +
      "iterations of O(1) work each, so Θ(V^3) time; the dist matrix is updated in place, so " +
      "Θ(V^2) space. The algorithm is a textbook DP over 'allowed intermediate vertex set': " +
      "dist[i][j] after outer iteration k is the shortest path from i to j using only vertices " +
      "0..k as possible waypoints, and the recurrence dist[i][j] = min(dist[i][j], dist[i][k] + " +
      "dist[k][j]) either keeps the best path found so far or improves it by routing through k. " +
      "Because it computes shortest paths between every pair simultaneously in one V^3 pass, it " +
      "beats running Bellman-Ford (O(VE)) or Dijkstra (O(E log V)) from every single source once " +
      "the graph is dense enough that E approaches V^2, with the added benefit of correctly " +
      "handling negative edges (though not negative cycles).",
  },
  {
    id: "dsa-toposort-kahns-01",
    category: "dsa",
    difficulty: "medium",
    title: "Detecting a cycle with Kahn's algorithm",
    tags: ["topological-sort", "kahns-algorithm", "cycle-detection"],
    type: "trace",
    prompt:
      "Kahn's algorithm repeatedly removes a vertex with in-degree 0, appends it to the output, " +
      "and decrements the in-degree of its neighbors, enqueuing any neighbor whose in-degree " +
      "drops to 0. Run on a graph containing the cycle A→B→C→A (plus possibly other acyclic " +
      "vertices), what does the algorithm observe, and how does that reveal the cycle?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The queue never empties — it loops forever revisiting A, B, and C",
        "It throws a runtime error the moment it tries to decrement an in-degree below 0",
        "Every vertex in the cycle starts with in-degree ≥ 1 contributed by another vertex in the same cycle, so none of them ever reaches in-degree 0 and none is ever enqueued; the algorithm terminates normally once the queue empties, but the output has fewer than V vertices — that shortfall is exactly how Kahn's algorithm detects a cycle, with no explicit coloring or recursion-stack tracking needed",
        "It silently produces an incorrect but complete ordering of all V vertices, with no indication anything is wrong",
      ],
      correctIndex: 2,
    },
    explanation:
      "Every vertex on a cycle has at least one incoming edge from another vertex on that same " +
      "cycle, so as long as no acyclic part of the graph satisfies that incoming edge, the " +
      "cycle's in-degree count can never drop to 0 purely by processing outside vertices. Since " +
      "Kahn's algorithm only enqueues a vertex once its in-degree hits exactly 0, the cycle " +
      "members mutually 'wait' on each other forever and are simply never enqueued — the " +
      "algorithm still terminates cleanly (the queue empties once every non-cycle-dependent " +
      "vertex is processed), it just produces an output shorter than V. Comparing output length " +
      "to V (equivalently, checking for any vertex left with nonzero in-degree) is the standard, " +
      "elegant way Kahn's algorithm detects cycles as a side effect of bookkeeping it needs " +
      "anyway, with no separate DFS coloring pass required.",
  },
  {
    id: "dsa-toposort-dfs-01",
    category: "dsa",
    difficulty: "hard",
    title: "DFS topological sort: back edges require three colors, not two",
    tags: ["topological-sort", "dfs", "cycle-detection"],
    type: "trace",
    prompt:
      "Run this cycle-check on the DAG A→B, A→C, B→D, C→D (a diamond: D is reachable from A via " +
      "two distinct paths, but there is no actual cycle), starting with dfs(A). Does hasCycle " +
      "end up true or false, and is that correct?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `unordered_set<int> visited;
bool hasCycle = false;

void dfs(int u, vector<vector<int>>& adj) {
    visited.insert(u);
    for (int v : adj[u]) {
        if (visited.count(v)) {
            hasCycle = true;
        } else {
            dfs(v, adj);
        }
    }
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "hasCycle = false, correctly identifying this as a DAG",
        "hasCycle = true — incorrectly, because once B's subtree finishes visiting D, D is already in visited when C also points to it; this implementation only distinguishes 'never seen' from 'seen', so it cannot tell a back edge (to an ancestor still on the current recursion stack — a real cycle) from a cross/forward edge (to an already-fully-processed, unrelated subtree — no cycle at all)",
        "The program crashes with infinite recursion since D has two incoming edges",
        "hasCycle = true, and that is actually correct, since D has in-degree 2",
      ],
      correctIndex: 1,
    },
    explanation:
      "A correct DFS-based cycle check needs three states per vertex — unvisited (white), " +
      "currently on the recursion stack (gray), and fully finished (black) — because a cycle " +
      "exists only when an edge points to a gray vertex, a 'back edge' to a genuine ancestor " +
      "still being explored. An edge to a black vertex (already fully explored and popped off " +
      "the stack, like D once B's subtree finishes) is a harmless 'cross edge', completely " +
      "normal in a DAG with shared descendants. This implementation collapses gray and black " +
      "into a single visited set, so it cannot distinguish 'D is an ancestor of the current " +
      "path' from 'D was already fully explored via an unrelated branch' — both simply look " +
      "like 'already visited.' On the diamond, once B's subtree finishes exploring D, D sits in " +
      "visited; when C later also points to D, the code flags a cycle that doesn't exist. The " +
      "fix is the classic white/gray/black scheme, or an explicit onStack set that is cleared as " +
      "recursion unwinds.",
  },
  {
    id: "dsa-scc-tarjan-01",
    category: "dsa",
    difficulty: "hard",
    title:
      "Tarjan's single-pass low-link SCC algorithm vs. Kosaraju's two-pass approach",
    tags: ["strongly-connected-components", "tarjan", "kosaraju", "graph-algorithms"],
    type: "trace",
    prompt:
      "Both Tarjan's and Kosaraju's algorithms find all strongly connected components of a " +
      "directed graph in O(V+E). Which statement correctly distinguishes their approaches?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Tarjan's requires building and traversing the transpose graph; Kosaraju's does not",
        "Kosaraju's requires two full DFS passes — one on the original graph to compute a finishing-order stack, and a second on the transpose graph processing vertices in reverse finishing order, where each resulting DFS tree is exactly one SCC; Tarjan's needs only a single DFS pass, maintaining a discovery index and a 'low-link' value per vertex (the smallest discovery index reachable from that vertex's subtree via at most one back edge) plus an explicit stack of in-progress vertices, popping off a completed SCC whenever a vertex's low-link equals its own discovery index",
        "Both algorithms require building the transpose graph and run two DFS passes each",
        "Tarjan's is O(V+E) but Kosaraju's is O(V·E) because of the transpose construction",
      ],
      correctIndex: 1,
    },
    explanation:
      "Kosaraju's approach is conceptually simple but needs the graph in two forms: a first DFS " +
      "on the original graph orders vertices by finishing time, then a second DFS on the " +
      "transpose (all edges reversed) visits vertices in decreasing finish-time order — every " +
      "tree produced by that second DFS is precisely one SCC, a consequence of how finishing " +
      "times relate to reachability across the reversal. Tarjan's algorithm never materializes a " +
      "transpose graph or runs a second pass: during a single DFS it tracks each vertex's " +
      "discovery index and low-link (the minimum discovery index reachable from its subtree " +
      "using at most one back edge), pushing vertices onto an auxiliary stack as they're " +
      "discovered; when a vertex's low-link equals its own discovery index, that vertex is the " +
      "root of a completed SCC, and everything above it on the stack down to that root is popped " +
      "off as one component. Both run in O(V+E) — the same asymptotic bound — but Tarjan's is a " +
      "single traversal with more bookkeeping per vertex, while Kosaraju's trades a second " +
      "traversal and an explicit transpose for a much simpler mental model.",
  },
  {
    id: "dsa-mst-kruskal-prim-01",
    category: "dsa",
    difficulty: "medium",
    title: "Kruskal vs. Prim on dense vs. sparse graphs",
    tags: ["minimum-spanning-tree", "kruskal", "prim", "graph-algorithms"],
    type: "trace",
    prompt:
      "Kruskal's algorithm sorts all E edges (O(E log E)) then processes them with union-find, " +
      "roughly O(E) more, giving O(E log E) = O(E log V) overall (since E ≤ V^2 implies log E = " +
      "O(log V)). Prim's algorithm with a Fibonacci-heap-backed priority queue runs in " +
      "O(E + V log V). For a dense graph with E = Θ(V^2), which is asymptotically faster, and " +
      "why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Kruskal's, since sorting is always faster than heap operations in practice",
        "They're identical, since both are 'just' O(E log V) for any graph",
        "Prim's (Fibonacci-heap version): its bound becomes O(V^2 + V log V) = O(V^2); Kruskal's becomes O(V^2 log V) — a full log V factor worse, because Kruskal's cost is tied to sorting all E edges regardless of density, while Prim's decrease-key operations only pay the log factor V times, once per vertex extraction, not once per edge",
        "Neither can be used on dense graphs; both require E = O(V) to terminate in polynomial time",
      ],
      correctIndex: 2,
    },
    explanation:
      "Substituting E = Θ(V^2) into each bound makes the difference concrete: Kruskal's " +
      "O(E log E) becomes O(V^2 log V^2) = O(V^2 log V), since sorting cost scales directly with " +
      "the number of edges, and a dense graph simply has many more of them to sort. Prim's " +
      "Fibonacci-heap bound O(E + V log V) becomes O(V^2 + V log V) = O(V^2), since — just as " +
      "with Dijkstra — the log factor there only multiplies the V extract-min operations, not " +
      "the E edge-relaxations/decrease-keys, which are O(1) amortized each. So on dense graphs " +
      "Prim's (with a Fibonacci heap) is asymptotically better by a log V factor; on sparse " +
      "graphs (E = O(V)) the two bounds converge to roughly the same O(V log V), and Kruskal's is " +
      "often preferred there anyway for its simplicity, since a Fibonacci heap's large constant " +
      "factors rarely pay off unless V is huge.",
  },
  {
    id: "dsa-dp-complexity-01",
    category: "dsa",
    difficulty: "hard",
    title: "Complexity of a memoized DP with an extra state dimension",
    tags: ["dynamic-programming", "memoization", "complexity-analysis"],
    type: "trace",
    prompt:
      "Consider 'longest increasing subsequence allowing up to k deletions': dp(i, d) is the " +
      "length of the best increasing subsequence considering only the first i elements, having " +
      "used exactly d of the allowed k deletions so far. The transition for dp(i, d) considers " +
      "every earlier index j < i as a possible predecessor (an O(i) scan), for each of O(n) " +
      "values of i and O(k) values of d. Memoized top-down (each (i,d) pair computed once), what " +
      "is the overall time complexity?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "O(n·k), since there are O(n·k) distinct (i,d) states and memoization means each is computed exactly once",
        "O(n^2), since the O(n) scan dominates and the k dimension doesn't matter",
        "O(n^2·k) — there are Θ(n·k) distinct memoized subproblems, and each one performs an O(n) scan during its single evaluation, so total work is (number of states) × (work per state) = Θ(n·k) × O(n) = O(n^2·k)",
        "O(n log n · k), by analogy with the classic O(n log n) patience-sorting LIS algorithm",
      ],
      correctIndex: 2,
    },
    explanation:
      "Memoization guarantees each distinct state is computed once, but 'computed once' still " +
      "costs whatever the transition itself costs — the number of subproblems is not the same as " +
      "the total running time unless the transition is O(1). Here there are Θ(n) choices for i " +
      "and Θ(k) choices for d, giving Θ(n·k) distinct (i,d) states; each state's transition scans " +
      "all j < i looking for a valid predecessor, costing up to O(n). The correct complexity is " +
      "(number of states) × (cost per state) = Θ(n·k) × O(n) = O(n^2·k), not simply O(n·k) " +
      "(which forgets the transition cost) and not O(n^2) (which forgets the k dimension " +
      "entirely). This is exactly the trap that separates 'I know it's DP so it's polynomial' " +
      "from a candidate who can actually multiply state-space size by per-state work — a " +
      "distinction that matters enormously if, say, k were itself Θ(n), turning what looks like " +
      "a 'small' extra dimension into a full extra factor of n.",
  },
  {
    id: "dsa-amortized-vector-01",
    category: "dsa",
    difficulty: "medium",
    title: "Amortized O(1) push_back via capacity doubling",
    tags: ["amortized-analysis", "dynamic-array", "std-vector"],
    type: "trace",
    prompt:
      "std::vector doubles its capacity (allocates 2x space and copies all existing elements) " +
      "whenever push_back would exceed current capacity. Starting from an empty vector, n " +
      "consecutive push_back calls are made. What is the total number of element copies " +
      "performed across all reallocations, and what does that imply about the amortized cost " +
      "per push_back?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Θ(n log n) total copies, so amortized O(log n) per push_back — each of the O(log n) reallocations copies O(n) elements",
        "Θ(n) total copies — reallocations happen at sizes 1, 2, 4, 8, ..., n, and copying at each reallocation costs that many elements, so total copies are 1+2+4+...+n < 2n, a geometric series bounded by O(n); dividing by n push_back calls gives O(1) amortized cost per call, even though any individual push_back that triggers a reallocation is itself O(n)",
        "Θ(n^2) total copies, since every reallocation re-copies all elements seen so far including ones already copied multiple times, and there are Θ(n) reallocations",
        "Exactly n total copies, one per element, since each element is only ever copied once in its lifetime",
      ],
      correctIndex: 1,
    },
    explanation:
      "Reallocation happens only when capacity is exhausted, at sizes roughly 1, 2, 4, 8, ..., n " +
      "— O(log n) reallocations total, but the cost of each is proportional to how many elements " +
      "exist at that point, since they all must be copied to the new buffer. Summing the " +
      "geometric series 1+2+4+...+n gives strictly less than 2n total element copies across the " +
      "entire sequence of n push_backs — not Θ(n log n), because the series is geometric " +
      "(dominated by its largest term) rather than O(log n) terms of size O(n) each. Spreading " +
      "that Θ(n) total cost evenly over the n push_back calls gives O(1) amortized per call — the " +
      "standard aggregate-method argument — even though a single push_back that happens to " +
      "trigger a reallocation is genuinely O(n) in that instant. This is the textbook " +
      "justification for treating push_back as 'O(1)' despite its occasional expensive " +
      "worst-case call.",
  },
  {
    id: "dsa-amortized-vector-02",
    category: "dsa",
    difficulty: "hard",
    title: "Fixed-increment growth breaks the amortized O(1) bound",
    tags: ["amortized-analysis", "dynamic-array"],
    type: "trace",
    prompt:
      "Suppose a dynamic array instead grows by a fixed constant C each time it's full " +
      "(capacity += C, e.g. C = 100), rather than doubling (capacity *= 2). For n push_back " +
      "calls starting from empty, what is the total number of element copies across all " +
      "reallocations, and what does that imply about the amortized cost per push_back?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Still Θ(n) total, O(1) amortized — the growth strategy doesn't matter as long as capacity keeps increasing",
        "Θ(n^2/C) total copies — reallocations happen Θ(n/C) times (at sizes C, 2C, 3C, ...), and the k-th reallocation copies Θ(kC) elements, so total copies sum to C + 2C + ... + (n/C)·C = Θ(n^2/C), an arithmetic (not geometric) series; dividing by n calls gives Θ(n/C) amortized per push_back — linear in n, not constant",
        "Θ(n log n) total copies, O(log n) amortized, matching a comparison-sort-like bound",
        "Θ(n) total copies still, but now O(1) worst-case per call instead of merely amortized, which is strictly better than doubling",
      ],
      correctIndex: 1,
    },
    explanation:
      "With fixed-increment growth, reallocations occur at sizes C, 2C, 3C, ..., about n/C of " +
      "them, and the k-th reallocation must copy the roughly kC elements that exist at that " +
      "point. Summing k=1 to n/C of kC gives C · (1+2+...+n/C) = C · Θ((n/C)^2) = Θ(n^2/C) — an " +
      "arithmetic series growing quadratically in n (scaled by 1/C), in sharp contrast to " +
      "doubling's geometric series, which stays linear in n. Dividing that Θ(n^2/C) total cost by " +
      "n push_back calls gives Θ(n/C) amortized cost per call — since C is a constant, this is " +
      "Θ(n): the amortized cost per push_back grows linearly with the size of the array, not " +
      "O(1). This is precisely why every serious dynamic-array implementation uses a " +
      "multiplicative growth factor (doubling, 1.5x, etc.) rather than a fixed increment — the " +
      "difference between geometric and arithmetic reallocation-size series is the difference " +
      "between O(1) and O(n) amortized insertion.",
  },
  {
    id: "dsa-master-theorem-01",
    category: "dsa",
    difficulty: "medium",
    title: "Master theorem on T(n) = 2T(n/2) + n log n",
    tags: ["master-theorem", "recurrence-relations", "divide-and-conquer"],
    type: "trace",
    prompt:
      "Apply the master theorem to T(n) = 2T(n/2) + n log n. Here a=2, b=2, so " +
      "n^(log_b a) = n^1 = n, and f(n) = n log n. What is T(n)?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Θ(n log n) — f(n) already matches n log n, so that's just the answer directly",
        "Θ(n) — since n^(log_b a) = n dominates any f(n) that isn't polynomially larger, this falls under case 1",
        "Θ(n log^2 n) — f(n) = n log n = Θ(n^(log_b a) · log^1 n), the boundary (case 2) extension of the master theorem, which gives Θ(n^(log_b a) · log^(k+1) n) when f(n) = Θ(n^(log_b a) log^k n); here k=1, so the extra log n from f(n) contributes one additional factor of log n, not zero",
        "The master theorem does not apply here, since f(n) = n log n is not a polynomial in n",
      ],
      correctIndex: 2,
    },
    explanation:
      "The standard master theorem has a well-known extension for the boundary case where " +
      "f(n) = Θ(n^(log_b a) · log^k n) for some k ≥ 0 (plain case 2 is the k=0 special case, " +
      "giving Θ(n^(log_b a) log n)): the general result is T(n) = Θ(n^(log_b a) · log^(k+1) n). " +
      "Here n^(log_b a) = n^(log_2 2) = n, and f(n) = n log n = n · log^1 n matches that form with " +
      "k=1, so the theorem gives Θ(n · log^2 n) — one power of log higher than f(n) itself. A " +
      "common mistake is to answer Θ(n log n) by pattern-matching f(n) directly, forgetting that " +
      "at this exact boundary — where the recursive term's total work and f(n)'s per-level " +
      "contribution are of the same asymptotic order — the O(log n) levels of recursion each " +
      "contribute comparable work, and those contributions sum to one extra factor of log n, not " +
      "a plain restatement of f(n).",
    references: [
      "https://en.wikipedia.org/wiki/Master_theorem_(analysis_of_algorithms)",
    ],
  },
  {
    id: "dsa-quickselect-01",
    category: "dsa",
    difficulty: "hard",
    title: "Quickselect's expected O(n) vs. worst-case O(n^2)",
    tags: ["quickselect", "selection-algorithm", "randomized-algorithms"],
    type: "trace",
    prompt:
      "This quickselect always pivots on a[lo], the first element of the current subrange. What " +
      "is its worst-case complexity, what input triggers it, and what change would restore " +
      "expected O(n) regardless of input?",
    snippet: {
      language: "cpp",
      filename: "main.cpp",
      code: `int partition(vector<int>& a, int lo, int hi) {
    int pivot = a[lo];   // always pivot on the first element
    int i = lo;
    for (int j = lo + 1; j <= hi; j++)
        if (a[j] < pivot) swap(a[++i], a[j]);
    swap(a[lo], a[i]);
    return i;
}

int quickselect(vector<int>& a, int lo, int hi, int k) {
    if (lo == hi) return a[lo];
    int p = partition(a, lo, hi);
    if (k == p) return a[p];
    else if (k < p) return quickselect(a, lo, p - 1, k);
    else return quickselect(a, p + 1, hi, k);
}`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Worst case O(n log n), triggered by any already-sorted input; switching to a median pivot fixes it to a worst-case O(n log n)",
        "Worst case O(n^2), triggered by an already-sorted (or reverse-sorted) array, since pivoting on a[lo] always produces the most unbalanced possible partition (0 elements on one side, n-1 on the other) on such input, giving the arithmetic sum n+(n-1)+...+1 = Θ(n^2); choosing the pivot uniformly at random (or via median-of-medians for a worst-case guarantee) restores expected O(n), since a random pivot is unlikely to repeatedly produce maximally unbalanced partitions",
        "Worst case O(n^2) regardless of input or pivot strategy, since quickselect always inspects every element at every level of recursion",
        "Worst case O(2^n), since each partition step can recurse into both halves in the worst case",
      ],
      correctIndex: 1,
    },
    explanation:
      "On an already-sorted array, pivoting on a[lo] (the smallest remaining element) makes " +
      "every partition step put 0 elements before the pivot and all n-1 remaining elements after " +
      "it, so the recursion never shrinks the problem by more than one element per call — total " +
      "work n + (n-1) + ... + 1 = Θ(n^2), the classic degenerate quicksort/quickselect " +
      "pathology. This is a deterministic worst case triggered by ordinary sorted input, not " +
      "some rare adversarial construction. Selecting the pivot uniformly at random from the " +
      "current subrange (or using a linear-time worst-case-guaranteed selection like " +
      "median-of-medians for the pivot) makes this pathology exponentially unlikely: with a " +
      "random pivot, the expected partition split is balanced enough that the expected total " +
      "work satisfies T(n) = O(n) + (average over pivot rank of T(larger side)), which resolves " +
      "via a standard recurrence to Θ(n) expected time — the reason production libraries either " +
      "randomize the pivot or use introselect rather than a fixed-position pivot.",
  },
  {
    id: "dsa-introsort-01",
    category: "dsa",
    difficulty: "hard",
    title: "Introsort's hybrid strategy and why std::sort still uses insertion sort",
    tags: ["introsort", "quicksort", "heapsort", "insertion-sort", "std-sort"],
    type: "trace",
    prompt:
      "std::sort in most standard library implementations is introsort: quicksort augmented " +
      "with a recursion-depth counter and a small-partition cutoff. If the recursion depth " +
      "exceeds roughly 2·log2(n) without the partition finishing, the algorithm switches the " +
      "remaining partition to heapsort; partitions smaller than a small constant (commonly 16) " +
      "are finished with insertion sort instead of recursing further. Given that heapsort is " +
      "Θ(n log n) worst case and insertion sort is Θ(n^2) worst case, what does each threshold " +
      "actually guarantee or improve?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Both thresholds are pure micro-optimizations with no effect on asymptotic guarantees — plain quicksort is already Θ(n log n) worst case",
        "The depth-based switch to heapsort caps the overall worst case at Θ(n log n) — it bounds how much of the sort can suffer quicksort's Θ(n^2) degenerate partitioning before bailing out to a method with a guaranteed Θ(n log n) worst case; the insertion-sort cutoff for small partitions is purely a constant-factor win, since insertion sort's low overhead and good cache/branch behavior beat continuing to recurse with quicksort for small n, even though its asymptotic complexity is worse in general",
        "The depth-based switch guarantees a stable sort, and the insertion-sort cutoff guarantees in-place sorting — neither is about complexity",
        "Both thresholds exist solely to reduce memory allocations, with no effect on time complexity at all",
      ],
      correctIndex: 1,
    },
    explanation:
      "Plain quicksort has Θ(n log n) expected time but Θ(n^2) worst case (e.g. sorted input " +
      "with a naive pivot, as in the quickselect example). Introsort's depth counter detects " +
      "when recursion is going deeper than a well-balanced quicksort ever should — 2·log2(n) is " +
      "a generous multiple of the expected Θ(log n) depth — and that is the signal that " +
      "partitioning is degenerating; switching the offending partition to heapsort caps the " +
      "damage, since heapsort is Θ(n log n) worst case unconditionally, regardless of input " +
      "order. This is what lets std::sort legally advertise Θ(n log n) worst-case complexity " +
      "despite using quicksort as its primary strategy. The insertion-sort cutoff is a " +
      "completely different kind of optimization: for small n (below roughly 16), insertion " +
      "sort's Θ(n^2) is a non-issue in absolute terms, and it wins in practice because it has far " +
      "less per-element overhead — no recursive calls, no partitioning logic, tight sequential " +
      "memory access — than continuing to recurse with quicksort down to single elements, a pure " +
      "constant-factor, not asymptotic, improvement.",
  },
  {
    id: "dsa-suffixarray-01",
    category: "dsa",
    difficulty: "medium",
    title: "Suffix arrays: capability and the space/time tradeoff vs. suffix trees",
    tags: ["suffix-array", "suffix-tree", "string-algorithms"],
    type: "trace",
    prompt:
      "A suffix array for a string of length n is the array of all n suffixes' starting " +
      "indices, sorted lexicographically by the suffix they point to. Given the suffix array " +
      "(and optionally an LCP array), what capability does it provide, and how does it compare " +
      "to a suffix tree in space and construction cost?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "It enables O(m log n) substring search for a pattern of length m via binary search over the sorted suffixes (improvable to O(m + log n) with an LCP array), using O(n) words of space with a small constant factor; a suffix tree supports O(m) pattern matching directly but typically uses several times more memory per character due to per-node child-pointer/edge-label bookkeeping, though both can be built in O(n) time with sufficiently sophisticated algorithms (e.g. SA-IS for suffix arrays, Ukkonen's for suffix trees)",
        "It enables only exact whole-string equality checks, not substring search, unlike a suffix tree",
        "It requires O(n^2) space, exactly like a naive suffix trie, which is why suffix trees are always preferred in practice",
        "It can only be constructed in O(n^2 log n) time with no known faster algorithm, making it impractical for large texts",
      ],
      correctIndex: 0,
    },
    explanation:
      "Because the suffix array is sorted, any substring is a prefix of some contiguous range of " +
      "suffixes, so checking whether a pattern of length m occurs can be done via binary search " +
      "over the n suffixes, each comparison costing up to O(m) — O(m log n) total, which an " +
      "accompanying LCP (longest common prefix) array plus a range-minimum-query structure can " +
      "sharpen to O(m + log n). A suffix tree, by contrast, lets you walk directly from the root " +
      "matching one pattern character per edge traversal, giving O(m) pattern matching " +
      "independent of n, generally faster for search-heavy workloads. The tradeoff is space and " +
      "implementation complexity: a suffix array is just a permutation of indices (O(n) words, " +
      "tiny constant), while a suffix tree needs a node per branching point plus edge-label " +
      "representations, typically several times more memory per input character in practice — " +
      "which is why suffix arrays, often paired with an LCP array to recover most of the tree's " +
      "power, are preferred in memory-constrained or large-scale text-indexing settings, even " +
      "though both admit O(n)-time construction with the right algorithm rather than the naive " +
      "O(n^2 log n) sort-all-suffixes approach.",
  },
];
