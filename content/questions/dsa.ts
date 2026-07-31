import type { TraceQuestion } from "@/types/question";

export const dsaQuestions: TraceQuestion[] = [
  {
    id: "dsa-avl-rotation-01",
    category: "dsa",
    difficulty: "medium",
    title: "Three insertions into an empty AVL tree",
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
        "A right rotation about 10 followed by a left rotation about 30, making 20 the new root",
        "A left rotation about 10 followed by a right rotation about 30, making 20 the new root",
      ],
      correctIndex: 3,
    },
    explanation:
      "After inserting 30 then 10, 10 is the left child of 30. Inserting 20 (10 < 20 < 30) makes " +
      "it the right child of 10, so the new node sits in a left-then-right zig-zag position " +
      "relative to the root: the classic LR case. The root's balance factor becomes " +
      "height(left) - height(right) = 1 - (-1) = 2, an imbalance. A single right rotation about " +
      "30 does not fix a zig-zag shape, it only moves the imbalance to the other side (10 would " +
      "become the root with balance factor -2). The standard fix first left-rotates about 10, " +
      "converting the subtree into a straight-line LL shape, and then right-rotates about 30. " +
      "The net effect leaves 20 as the new root with 10 as its left child and 30 as its right " +
      "child.",
  },
  {
    id: "dsa-redblack-fixup-01",
    category: "dsa",
    difficulty: "hard",
    title: "Red-black tree insertion fixup after a red-red violation",
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
        "Rotate right about 5, then recolor 3 black and 5 red",
        "Rotate left about 3, then right about 5, then recolor 1 black and 5 red",
        "Recolor 3 and 15 black and 10 red, pushing the violation up to the grandparent",
        "Recolor 3 black only, leaving every other node's color untouched",
      ],
      correctIndex: 0,
    },
    explanation:
      "The fixup for a red-red violation examines the color of the uncle of the newly inserted " +
      "node, not the uncle of its parent. Here the new node is 1, its parent is 3, its " +
      "grandparent is 5, and its uncle is 5's other child: the nil right child of 5, which " +
      "counts as black. A black (or nil) uncle rules out the pure-recolor case and forces a " +
      "rotation, and the shape decides which one. Since 1 is a left child of 3 and 3 is a left " +
      "child of 5, this is the 'same side' LL case, handled with a single right rotation about " +
      "the grandparent (5), after which the rotated-up node (3) is recolored black and the old " +
      "grandparent (5) recolored red. Recoloring alone applies only when the uncle is red, since " +
      "that is the case where flipping colors preserves every root-to-leaf black count without " +
      "restructuring anything; with a black uncle, recoloring would change the black height of " +
      "one side only, so a rotation is unavoidable.",
    references: [
      "https://en.wikipedia.org/wiki/Red%E2%80%93black_tree#Insertion",
    ],
  },
  {
    id: "dsa-btree-io-01",
    category: "dsa",
    difficulty: "easy",
    title: "B+-trees vs. balanced BSTs for a disk-backed index",
    tags: ["b-tree", "b-plus-tree", "disk-io", "databases"],
    type: "trace",
    prompt:
      "A balanced binary search tree (e.g. a red-black tree) and a B+-tree both give O(log n) " +
      "search complexity measured in key comparisons. Why do virtually all disk-backed database " +
      "indexes use B+-trees instead of balanced BSTs?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Their comparison complexity is asymptotically better, O(log_b n) rather than O(log n)",
        "They never rebalance, avoiding the rotation cost a BST pays on every insertion",
        "Their high fanout sizes each node to one disk page, minimizing page reads per lookup",
        "They keep the whole index resident in RAM, so a lookup never touches the disk at all",
      ],
      correctIndex: 2,
    },
    explanation:
      "The real bottleneck for a disk-backed structure is I/O count, not comparison count: each " +
      "node visited is, in the worst case, a separate disk seek. A BST with branching factor 2 " +
      "has height Θ(log2 n), so with millions of keys that is dozens of disk reads per lookup. A " +
      "B+-tree node is sized to exactly one disk page (often holding hundreds to thousands of " +
      "keys), so its branching factor b is huge and its height is Θ(log_b n), commonly only 3 or " +
      "4 levels even for billions of keys. Comparisons within an already-loaded page are cheap, " +
      "so the dominant real-world cost, page reads, is minimized by maximizing b rather than by " +
      "improving the comparison-count asymptotics, which stay O(log n) either way (changing the " +
      "logarithm's base is only a constant factor). B-trees do still rebalance, via node splits " +
      "and merges, just far less often given their high fanout.",
  },
  {
    id: "dsa-bplustree-leaves-01",
    category: "dsa",
    difficulty: "medium",
    title: "Range query complexity in a B+-tree",
    tags: ["b-plus-tree", "range-query", "disk-io"],
    type: "trace",
    prompt:
      "In a B+-tree (unlike a classic B-tree), internal nodes hold only routing keys, never " +
      "records: every record lives in a leaf, and the leaves are additionally threaded into a " +
      "sorted linked list. Given this, what is the complexity of a range query returning k " +
      "matching records?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "O(k log n), one root-to-leaf descent per matching record",
        "O(log n + k), one descent plus k-1 hops along the leaf list",
        "O(log n), with the routing keys alone summarizing the range",
        "O(n), since ordered retrieval has to sweep the whole leaf level",
      ],
      correctIndex: 1,
    },
    explanation:
      "The single descent from root to leaf costs O(log_b n) node visits (b = branching factor) " +
      "to locate the first key at or above the range's lower bound. A classic B-tree stores data " +
      "in internal nodes too, so a range scan there has to keep re-descending to reach the next " +
      "key in order. A B+-tree avoids that by pushing all records down to the leaf level and " +
      "threading the leaves into a sorted linked list. After the initial descent, retrieving the " +
      "remaining k-1 matches is just k-1 O(1) pointer hops across sibling leaves, with no " +
      "internal node revisited. Total cost is O(log n + k), the output-sensitive bound that makes " +
      "B+-trees, rather than B-trees, the near-universal choice for database range queries and " +
      "cursor-style pagination.",
  },
  {
    id: "dsa-trie-space-01",
    category: "dsa",
    difficulty: "medium",
    title: "Trie node count: shared prefixes vs. disjoint strings",
    tags: ["trie", "space-complexity"],
    type: "trace",
    prompt:
      "You insert n = 100,000 strings, each of length L = 50, into an uncompressed trie (one " +
      "child pointer per character; no compression of single-child chains). The alphabet is large " +
      "enough that 100,000 distinct characters are available at any position. Case A: all strings " +
      "share the same 49-character prefix and differ only in their last character. Case B: no " +
      "two strings share even a single character of prefix. Approximately how many trie nodes " +
      "does each case create?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Case A about L + n ≈ 100,050 nodes; Case B about n × L = 5,000,000 nodes",
        "Case A about n × L = 5,000,000 nodes; Case B about L + n ≈ 100,050 nodes",
        "Both about n × L = 5,000,000 nodes, since node count is fixed by n and L alone",
        "Both about n = 100,000 nodes, since a trie stores one node per inserted string",
      ],
      correctIndex: 0,
    },
    explanation:
      "A trie's node count equals the number of distinct prefixes actually inserted, not simply " +
      "n·L, which is only a worst-case bound. In Case A the first 49 characters are identical " +
      "across every string, so they collapse onto a single shared chain of 49 nodes, and only " +
      "the final differing character needs up to n separate leaves: Θ(L + n) nodes total. In " +
      "Case B no prefix is shared at all, so every character of every string gets its own node, " +
      "giving the full Θ(n·L). Both tries are built over strings with the same n and the same L, " +
      "yet their memory footprints differ by roughly a factor of L. That gap is why 'trie space " +
      "is O(total characters inserted)' is a correct worst-case bound that can be wildly " +
      "pessimistic for prefix-heavy data such as URLs or file paths.",
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
        "O(sqrt n) expected, matching the classic unrolled-linked-list bound",
        "O(1) amortized, the same bound a hash table gives on lookup",
        "O(n) expected and O(n) worst case, since nothing bounds the structure's shape",
        "O(log n) expected, with an O(n) worst case",
      ],
      correctIndex: 3,
    },
    explanation:
      "With promotion probability 1/2, the probability that any given node reaches level k is " +
      "2^-k, so the expected number of nodes at level k is n/2^k and the highest occupied level " +
      "is Θ(log n) with high probability. Pugh's backward analysis of the search path walks it " +
      "from the target back to the head: at each step the path either moves left (probability " +
      "1/2, the node was not promoted) or up a level (probability 1/2), so the expected number " +
      "of leftward steps taken per level is O(1). Summing O(1) work across Θ(log n) levels gives " +
      "O(log n) expected search time, matching a balanced BST with no rotations and no explicit " +
      "rebalancing at all. The bound holds in expectation over the coin flips, not in the worst " +
      "case: an astronomically unlikely run of flips could leave every node at level 1, " +
      "degenerating the structure into a plain sorted linked list with O(n) search. " +
      "Randomization buys implementation simplicity at the price of a worst-case guarantee.",
  },
  {
    id: "dsa-skiplist-correctness-01",
    category: "dsa",
    difficulty: "medium",
    title: "A skip list with level promotion disabled",
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
        "Searches can now return wrong results, since the express lanes are what locate a key",
        "Every operation stays correct, with performance degrading to O(n) per operation",
        "Search stays correct, but insertion and deletion can now corrupt the level-1 list",
        "Elements are silently dropped, since a node is only linked in once it is promoted",
      ],
      correctIndex: 1,
    },
    explanation:
      "The invariant a skip list relies on for correctness is that level 1 is always a complete, " +
      "sorted linked list containing every element, and that invariant holds regardless of how, " +
      "or whether, higher levels get built. Higher levels are purely a performance optimization " +
      "(the 'express lanes'), consulted opportunistically: the search always drops down through " +
      "them and finishes with a level-1 scan that pinpoints the exact key or its insertion " +
      "point. Forcing every node to height 1 collapses the structure into an ordinary sorted " +
      "linked list, leaving correctness untouched while performance regresses from expected " +
      "O(log n) to O(n) per operation. The same reasoning runs in the other direction for a " +
      "heavily biased coin such as p = 0.99: still correct, just wasting space on towers of " +
      "levels that buy almost nothing.",
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
        "(1) O(log n) amortized per find; (2) O(log n) worst case; (3) O(1) worst case per operation",
        "(1) O(n) per find; (2) O(n) per find as well; (3) O(log n) amortized per operation",
        "(1) O(n) per find; (2) O(log n) worst case; (3) O(α(n)) amortized per operation",
        "All three are O(log n) worst case per operation, since the two optimizations overlap",
      ],
      correctIndex: 2,
    },
    explanation:
      "Without either optimization, repeatedly unioning in the 'wrong' direction builds a tree " +
      "that is a path of n nodes, so a single find costs O(n). Union-by-rank alone (always " +
      "attach the lower-rank root under the higher-rank one) bounds tree height at O(log n): a " +
      "root of rank r is the root of a tree with at least 2^r nodes, by induction on the fact " +
      "that rank only increases when two equal-rank trees merge, so r ≤ log2 n and every find " +
      "walks at most that many parent pointers. Path compression alone, with no rank rule, gives " +
      "O(log n) amortized per operation, better than the naive case but a weaker guarantee on " +
      "any single find than rank alone provides. Combining both is Tarjan's result: the " +
      "amortized cost per operation is O(α(n)), where α is the inverse Ackermann function, which " +
      "stays at or below 4 for any n that could ever be stored, so the combination is treated in " +
      "practice as essentially constant time.",
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
        "O(log n) for update, O(log n) for query",
        "O(log n) for update, O(log^2 n) for query",
        "O(log n) for update, O(n) for query",
        "O(n) for update, O(n) for query",
      ],
      correctIndex: 0,
    },
    explanation:
      "update descends exactly one root-to-leaf path, whose length is the tree height, Θ(log n) " +
      "for a segment tree over n leaves. query looks more dangerous because it recurses into " +
      "both children, but the key structural fact is that at each depth of the recursion at most " +
      "two nodes only partially overlap the query range: the two straddling the left and right " +
      "boundary. Every other visited node either fully matches (returns its stored value) or " +
      "fully misses (returns the identity) and stops immediately. That caps the nodes actually " +
      "explored per level at a small constant, so total work across O(log n) levels is O(log n), " +
      "not O(n) and not O(log^2 n). The same decomposition of an arbitrary range into O(log n) " +
      "canonical segments is what gives Fenwick trees their efficiency.",
  },
  {
    id: "dsa-segtree-lazy-01",
    category: "dsa",
    difficulty: "hard",
    title: "Segment tree range updates with and without lazy propagation",
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
        "Naive: O(log n) per range update; lazy propagation speeds up queries only",
        "Naive: O(log^2 n) per range update; lazy propagation reduces that to O(log n)",
        "Naive: O(n) per range update; lazy propagation is a constant-factor win, still O(n)",
        "Naive: O(n) per range update; lazy propagation brings it back to O(log n)",
      ],
      correctIndex: 3,
    },
    explanation:
      "rangeUpdateNaive always recurses down to start == end before applying anything, so a range " +
      "spanning the whole array (l=0, r=n-1) touches all n leaves. That is O(n) worst case, no " +
      "better than a brute-force array scan, which defeats the point of building the tree. Lazy " +
      "propagation instead applies the update only at the O(log n) canonical nodes that exactly " +
      "cover [l, r] (the same nodes query() would visit), storing the pending delta in a 'lazy' " +
      "tag at each such node rather than recursing further. The tag is pushed down to children " +
      "only the next time the tree actually needs to descend past that node, for a later " +
      "overlapping query or update. Each range update therefore touches O(log n) nodes again, at " +
      "the cost of one push-down step before recursing into any node, which is the standard " +
      "technique for range-update/range-query segment trees.",
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
        "Indices 5, 6, 7, 8; i rises by one per step, so the loop is O(n)",
        "Indices 5, 6, 8; i gains its own lowest set bit per step, so the loop is O(log n)",
        "Indices 5, 10, 20, 40; i doubles per step, so the loop is O(log n)",
        "Index 5 alone; the body runs once, so a Fenwick update is O(1)",
      ],
      correctIndex: 1,
    },
    explanation:
      "i & -i isolates the lowest set bit of i's two's-complement representation. For i=5 " +
      "(0b101), i & -i = 1, so i becomes 6 (0b110); for i=6, i & -i = 2, so i becomes 8 " +
      "(0b1000); for i=8, i & -i = 8, so i becomes 16, which exceeds n=8 and stops the loop. So " +
      "update(5, ...) touches bit[5], bit[6], bit[8]. Each Fenwick index owns a range whose size " +
      "equals its lowest set bit, and adding that value walks up to the next index whose owned " +
      "range also covers position 5. Every such step clears the current lowest set bit and " +
      "carries into a strictly higher bit position, so i's lowest set bit strictly increases in " +
      "significance each iteration; with only O(log n) bit positions available below n, the " +
      "ascent takes O(log n) steps. That matches a segment tree asymptotically with a much " +
      "smaller constant, since there is no recursion or pointer chasing, just array indexing and " +
      "one bitwise AND per step.",
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
        "Both come out O(V^2) whatever the heap, since Dijkstra inspects every vertex pair",
        "Binary heap O(E log V); Fibonacci heap O(E), with the log factor gone entirely",
        "Binary heap O(E log V); Fibonacci heap O(E + V log V), the better bound once E is ω(V)",
        "Binary heap O(E log V); Fibonacci heap O(E + V log V), the same bound rewritten",
      ],
      correctIndex: 2,
    },
    explanation:
      "With a binary heap, every decrease-key is an O(log V) sift-up, so up to E of them cost " +
      "O(E log V) total, dominating the O(V log V) from V extract-mins and giving O(E log V) " +
      "overall (equivalently O((V+E) log V)). A Fibonacci heap's decrease-key is O(1) amortized, " +
      "via lazy consolidation and cascading cuts whose cost is only paid off at the next " +
      "extract-min, so the E decrease-keys collapse to O(E) total and only the V extract-mins " +
      "carry a log factor: O(E + V log V). For sparse graphs (E = O(V)) the two bounds coincide " +
      "at O(V log V). For dense graphs (E close to V^2) the Fibonacci-heap bound " +
      "O(V^2 + V log V) = O(V^2) beats the binary-heap bound O(V^2 log V) by a full log V " +
      "factor, which is why Fibonacci heaps are paired with Dijkstra in complexity theory even " +
      "though their large constant factors usually make d-ary heaps faster in practice.",
  },
  {
    id: "dsa-hash-collision-01",
    category: "dsa",
    difficulty: "medium",
    title: "Linear probing vs. separate chaining at 90% load",
    tags: ["hash-table", "open-addressing", "separate-chaining", "load-factor"],
    type: "trace",
    prompt:
      "A hash table is filled to load factor α = 0.9 (90% of slots occupied). One version uses " +
      "open addressing with linear probing; another uses separate chaining. Which has the worse " +
      "expected number of probes for an unsuccessful search, and why?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "They tie at about 1/(1-α) probes, the uniform-hashing bound, which ignores the strategy",
        "Separate chaining is worse, since pointer chasing has worse cache locality than probing does",
        "Linear probing is worse: its expected probes grow like ~(1+1/(1-α)^2)/2 against chaining's ~1+α",
        "Linear probing is worse for successful searches only; on unsuccessful ones the two schemes tie",
      ],
      correctIndex: 2,
    },
    explanation:
      "Linear probing's defining pathology is primary clustering. Once several keys collide near " +
      "each other, the run of occupied slots they form keeps growing, because any new key that " +
      "hashes anywhere into that run must probe past the whole run to find an empty slot, which " +
      "extends the run and makes it an even larger target for the next key. Runs are " +
      "self-reinforcing. Knuth's classical analysis gives the expected number of probes for an " +
      "unsuccessful search under linear probing as approximately (1 + 1/(1-α)^2)/2, which " +
      "diverges sharply as α approaches 1: at α=0.9 that is already roughly 50 probes. Separate " +
      "chaining has no clustering at all, since a collision just extends one bucket's linked " +
      "list independently of every neighboring bucket, so its expected unsuccessful-search cost " +
      "grows only linearly with α, roughly 1+α (about 1.9 at α=0.9). Open-addressing tables are " +
      "therefore typically resized well before α approaches 1, often around 0.7, while chained " +
      "tables tolerate higher load factors far more gracefully.",
    references: ["https://en.wikipedia.org/wiki/Linear_probing#Analysis"],
  },
  {
    id: "dsa-bloomfilter-negatives-01",
    category: "dsa",
    difficulty: "easy",
    title: "False positives and false negatives in a Bloom filter",
    tags: ["bloom-filter", "probabilistic-data-structures"],
    type: "trace",
    prompt:
      "A Bloom filter with k hash functions and an m-bit array supports insert and (probabilistic) " +
      "membership query, but no deletion. Why can it produce false positives but is guaranteed " +
      "to never produce a false negative?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "The hash functions are cryptographically secure, so two elements never share a bit position",
        "Insertion sets all k of an element's bits to 1 and nothing ever clears them back to 0",
        "The bit array is resized whenever it fills up, so no earlier element's bits are overwritten",
        "Each element is also kept in a small backup list, which the query consults before answering",
      ],
      correctIndex: 1,
    },
    explanation:
      "Inserting an element x sets bits h1(x)...hk(x) to 1 unconditionally, and a standard Bloom " +
      "filter provides no operation that ever clears a bit back to 0. So if x was inserted, " +
      "every one of its k bits is guaranteed to still be 1 whenever it is later queried, and the " +
      "query does nothing but check those k bits, so it always answers 'present.' A false " +
      "positive arises only in the opposite direction: some element y that was never inserted " +
      "can still have all k of its bits happen to be 1, purely because other elements' " +
      "insertions independently set those same positions. That is an unlucky coincidence rather " +
      "than a guaranteed outcome, and its probability is what the false-positive rate measures. " +
      "The asymmetry (no false negatives, possible false positives) is what makes Bloom filters " +
      "useful as a cheap pre-filter in front of an expensive exact check: a negative answer can " +
      "be trusted completely, so only positives need to be verified against the real store.",
  },
  {
    id: "dsa-bloomfilter-fprate-01",
    category: "dsa",
    difficulty: "hard",
    title: "An engineer raises a Bloom filter's hash count to 20",
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
        "It keeps falling, since checking more bits per query makes an accidental all-ones hit rarer",
        "It stays essentially unchanged, since the rate is dominated by the m/n ratio rather than k",
        "It rises above the k=7 rate, since each insertion now sets 20 bits and saturates the array",
        "It drops to zero, since 20 independent hash functions leave no shared bit pattern possible",
      ],
      correctIndex: 2,
    },
    explanation:
      "The formula (1 - e^(-kn/m))^k captures a genuine tradeoff. More hash functions add more " +
      "independent bit checks, which pushes the rate down, but each insertion also sets more " +
      "bits, so the array's saturation (the fraction of bits equal to 1) climbs faster as " +
      "elements are inserted, which pushes the rate back up. k* = (m/n)·ln 2 is the balance " +
      "point between the two effects, the value of k that leaves the array almost exactly half " +
      "full after all n insertions; past k*, the saturation term dominates and the rate rises " +
      "again. Plugging in m/n = 10: at k=7 the rate is about 0.0082, while at k=20 the exponent " +
      "kn/m = 2 gives (1 - e^-2)^20 ≈ 0.055, nearly seven times worse. With 20 bits set per " +
      "element the array is roughly 86% ones, so most absent elements find all their bits " +
      "already lit. Extra hashing is not free redundancy: it buys checks at the cost of the very " +
      "sparsity those checks depend on.",
  },
  {
    id: "dsa-lru-cache-01",
    category: "dsa",
    difficulty: "hard",
    title: "An LRU cache built from a hash map and a linked list",
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
        "No: order.remove(key) scans the list linearly, so get and put are both O(n) worst case",
        "Yes: the map gives O(1) lookup and the list O(1) reordering, so both operations are O(1)",
        "No: only put is O(n); get is genuinely O(1), since it never has to search the list at all",
        "No: the unordered_map lookup is itself O(n) under collisions, whatever the list logic does",
      ],
      correctIndex: 0,
    },
    explanation:
      "std::list::remove(value) erases every element equal to value by scanning the list from the " +
      "front, an O(n) linear pass, because a plain list node offers no way to jump directly to " +
      "the element holding a given key. The cache's unordered_map only maps key to value, so it " +
      "provides no shortcut to the corresponding list node. Both get (which calls " +
      "order.remove(key) to move the accessed key to the front) and put (which does the same, " +
      "plus possibly evicting the back) therefore cost O(n) worst case, defeating the entire " +
      "point of using a linked list for reordering. The structural insight is that a linked " +
      "list's O(1) splice is only reachable if you already hold a handle to the node; searching " +
      "for that handle costs the linear scan the list was supposed to avoid. The standard fix is " +
      "to store key -> std::list<int>::iterator in the map alongside the value, so the exact " +
      "node is located in O(1) and relocated with list::splice, which moves an existing node to " +
      "the front with no scan and no reallocation.",
  },
  {
    id: "dsa-dijkstra-negative-01",
    category: "dsa",
    difficulty: "medium",
    title: "Dijkstra's algorithm on a graph with one negative edge",
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
        "dist[B] = 1, which is correct: no path to B in this graph is shorter than that",
        "dist[B] = -6, since Dijkstra relaxes all outgoing edges before finalizing any vertex",
        "It never terminates, since relaxing C→B keeps re-inserting B into the priority queue",
        "dist[B] = 1, though the true shortest distance is -6 along the path A→C→B",
      ],
      correctIndex: 3,
    },
    explanation:
      "Tracing it: dist[A]=0, and relaxing A's edges gives dist[B]=1, dist[C]=4. The priority " +
      "queue's minimum is B (1 < 4), so Dijkstra extracts and permanently finalizes B at " +
      "distance 1, and the algorithm never revisits a finalized vertex's distance. It then " +
      "extracts C (distance 4) and relaxes C→B: 4 + (-10) = -6, strictly less than B's finalized " +
      "1, but there is no mechanism to un-finalize B, so the improvement is discarded. The root " +
      "cause is Dijkstra's correctness proof, which rests on the invariant that once a vertex is " +
      "popped with the current minimum tentative distance, no path still under construction can " +
      "beat it. Every other path out of the frontier already costs at least as much and can only " +
      "get more expensive as it grows, which holds precisely because edge weights are " +
      "non-negative. A negative edge breaks that monotonicity: it lets a path that looks longer " +
      "at the frontier turn out cheaper later. Termination is never at risk here (each vertex is " +
      "still popped once), only correctness. Graphs with negative weights need Bellman-Ford, or " +
      "Johnson's algorithm if all-pairs distances are wanted.",
  },
  {
    id: "dsa-bellmanford-01",
    category: "dsa",
    difficulty: "medium",
    title: "A Bellman-Ford that stops after V-1 rounds",
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
// stops here: no extra round, no negative-cycle check`,
    },
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "O(V + E); nothing is missing, this is the complete textbook algorithm as written",
        "O(VE); distances are right absent a reachable negative cycle, but it cannot detect one",
        "O(V^2 E); it cannot handle negative edge weights at all, only strictly positive ones",
        "O(E log V); it is missing the priority queue Bellman-Ford needs to terminate correctly",
      ],
      correctIndex: 1,
    },
    explanation:
      "Each of the V-1 rounds relaxes all E edges, giving the standard O(VE) bound. The " +
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
        "Time O(V^2), space O(V^2); k just indexes an extra optimization pass over the matrix",
        "Time O(V^3 log V), space O(V^3); the comparison inside the loop adds a logarithmic factor",
        "Time O(E·V), space O(V); the loops amount to running Bellman-Ford from every source",
        "Time O(V^3), space O(V^2); k is the highest-indexed vertex allowed as an intermediate",
      ],
      correctIndex: 3,
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
    title: "Kahn's algorithm on a graph containing a cycle",
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
        "The queue never empties, so the algorithm loops forever revisiting A, B, and C in turn",
        "It faults the moment it tries to decrement an in-degree that has already reached 0",
        "It terminates normally, but the output holds fewer than V vertices, omitting the cycle",
        "It emits an ordering of all V vertices that silently violates some of the edge constraints",
      ],
      correctIndex: 2,
    },
    explanation:
      "Every vertex on a cycle has at least one incoming edge from another vertex on that same " +
      "cycle, so once the acyclic part of the graph has been drained, each cycle member still " +
      "carries an in-degree of at least 1 contributed from inside the cycle. Kahn's algorithm " +
      "only enqueues a vertex whose in-degree has hit exactly 0, so the cycle members wait on " +
      "each other indefinitely and none is ever enqueued. Nothing spins, though: the queue " +
      "empties as soon as every reachable in-degree-0 vertex has been processed, and the loop " +
      "exits cleanly, having emitted fewer than V vertices. Comparing the output length against " +
      "V (equivalently, checking whether any vertex still has nonzero in-degree) is how Kahn's " +
      "algorithm reports a cycle, and it costs nothing extra, since the in-degree counters are " +
      "bookkeeping the algorithm already maintains. No coloring scheme or recursion-stack " +
      "tracking is needed, unlike the DFS formulation of topological sort.",
  },
  {
    id: "dsa-toposort-dfs-01",
    category: "dsa",
    difficulty: "hard",
    title: "DFS cycle detection on a diamond-shaped graph",
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
        "hasCycle = true, incorrectly: D is already in visited when C reaches it by the second path",
        "hasCycle = false, correctly identifying the diamond as a DAG with no back edge anywhere",
        "The program recurses infinitely, since D is reachable along two distinct paths from A",
        "hasCycle = true, and correctly so, since D genuinely has in-degree 2 in this graph",
      ],
      correctIndex: 0,
    },
    explanation:
      "A correct DFS-based cycle check needs three states per vertex: unvisited (white), " +
      "currently on the recursion stack (gray), and fully finished (black). A cycle exists only " +
      "when an edge points to a gray vertex, a back edge to a genuine ancestor still being " +
      "explored. An edge to a black vertex (already fully explored and popped off the stack, " +
      "like D once B's subtree finishes) is a harmless cross edge, completely normal in a DAG " +
      "with shared descendants. This implementation collapses gray and black into a single " +
      "visited set, so 'D is an ancestor on the current path' and 'D was fully explored via an " +
      "unrelated branch' both look identical to it. Tracing the diamond: dfs(A) visits B, B " +
      "visits D, both return, and then A visits C, which points at a D that is already sitting " +
      "in visited, so the code flags a cycle that does not exist. The fix is the three-color " +
      "scheme, or an explicit onStack set that a vertex is removed from as the recursion " +
      "unwinds past it.",
  },
  {
    id: "dsa-scc-tarjan-01",
    category: "dsa",
    difficulty: "hard",
    title: "Tarjan's vs. Kosaraju's for strongly connected components",
    tags: ["strongly-connected-components", "tarjan", "kosaraju", "graph-algorithms"],
    type: "trace",
    prompt:
      "Both Tarjan's and Kosaraju's algorithms find all strongly connected components of a " +
      "directed graph in O(V+E). Which statement correctly distinguishes their approaches?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Tarjan's builds and traverses the transpose graph; Kosaraju's works on the original only",
        "Both build the transpose and run two DFS passes, differing only in per-vertex bookkeeping",
        "Tarjan's is O(V+E), while Kosaraju's is O(V·E) because of the transpose construction",
        "Kosaraju's runs two DFS passes and needs the transpose; Tarjan's needs one pass and a stack",
      ],
      correctIndex: 3,
    },
    explanation:
      "Kosaraju's approach is conceptually simple but needs the graph in two forms. A first DFS " +
      "on the original graph orders vertices by finishing time; a second DFS on the transpose " +
      "(all edges reversed) then visits vertices in decreasing finish-time order, and every tree " +
      "produced by that second pass is precisely one SCC, a consequence of how finishing times " +
      "relate to reachability once the edges are reversed. Tarjan's algorithm never materializes " +
      "a transpose or runs a second pass. During a single DFS it tracks each vertex's discovery " +
      "index and its low-link, the minimum discovery index reachable from that vertex's subtree " +
      "using at most one back edge, pushing vertices onto an auxiliary stack as they are " +
      "discovered. When a vertex's low-link equals its own discovery index, no edge out of its " +
      "subtree escapes to anything discovered earlier, so that vertex is the root of a completed " +
      "SCC, and everything sitting above it on the stack is popped off as one component. Both " +
      "run in O(V+E). The tradeoff is that Tarjan's is a single traversal with more state per " +
      "vertex, while Kosaraju's pays for a second traversal and an explicit transpose in " +
      "exchange for a much simpler correctness argument.",
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
        "Kruskal's, since sorting E edges once beats repeated heap operations at any density",
        "Prim's with a Fibonacci heap: O(V^2 + V log V) = O(V^2) against Kruskal's O(V^2 log V)",
        "They tie, since both reduce to O(E log V) whatever the graph's density turns out to be",
        "Neither is usable at that density; both need E = O(V) for their stated bounds to hold",
      ],
      correctIndex: 1,
    },
    explanation:
      "Substituting E = Θ(V^2) into each bound makes the difference concrete: Kruskal's " +
      "O(E log E) becomes O(V^2 log V^2) = O(V^2 log V), since sorting cost scales directly with " +
      "the number of edges, and a dense graph simply has many more of them to sort. Prim's " +
      "Fibonacci-heap bound O(E + V log V) becomes O(V^2 + V log V) = O(V^2). The reason is the " +
      "same one that shows up in Dijkstra: the log factor multiplies only the V extract-min " +
      "operations, never the E edge relaxations and decrease-keys, which are O(1) amortized " +
      "each. So on dense graphs Prim's with a Fibonacci heap is asymptotically better by a full " +
      "log V factor; on sparse " +
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
        "O(n·k), since there are Θ(n·k) distinct states and memoization computes each exactly once",
        "O(n^2), since the inner scan dominates and the deletion dimension adds no asymptotic cost",
        "O(n^2·k), the Θ(n·k) states each paying an O(n) scan during their single evaluation",
        "O(n log n · k), by analogy with the patience-sorting O(n log n) algorithm for plain LIS",
      ],
      correctIndex: 2,
    },
    explanation:
      "Memoization guarantees each distinct state is computed once, but 'computed once' still " +
      "costs whatever the transition itself costs. The number of subproblems equals the total " +
      "running time only when the transition is O(1). Here there are Θ(n) choices for i and Θ(k) " +
      "choices for d, giving Θ(n·k) distinct (i,d) states, and each state's transition scans " +
      "every j < i looking for a valid predecessor, costing up to O(n). The complexity is " +
      "therefore (number of states) × (cost per state) = Θ(n·k) × O(n) = O(n^2·k). Answering " +
      "O(n·k) forgets the transition cost; answering O(n^2) forgets the k dimension. The " +
      "distinction is not academic: if k is itself Θ(n), the seemingly small extra dimension " +
      "turns an O(n^2) algorithm into an O(n^3) one, which is the difference between a solution " +
      "that runs and one that times out.",
  },
  {
    id: "dsa-amortized-vector-01",
    category: "dsa",
    difficulty: "medium",
    title: "Counting element copies across n push_backs",
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
        "Θ(n log n) copies, so O(log n) amortized: O(log n) reallocations each copying O(n) elements",
        "Θ(n) copies, so O(1) amortized: the geometric series 1+2+4+...+n sums to less than 2n",
        "Θ(n^2) copies, so O(n) amortized: each of the Θ(n) reallocations recopies everything so far",
        "Exactly n copies, so O(1) worst case: each element is moved into a buffer only once ever",
      ],
      correctIndex: 1,
    },
    explanation:
      "Reallocation happens only when capacity is exhausted, at sizes roughly 1, 2, 4, 8, ..., " +
      "n, so there are O(log n) reallocations, and the cost of each is proportional to how many " +
      "elements exist at that moment, since all of them must be copied into the new buffer. The " +
      "tempting move is to multiply O(log n) reallocations by O(n) elements each, but that " +
      "overcounts badly: only the final reallocation copies close to n elements, and every " +
      "earlier one copies half as much as the one after it. Summing the geometric series " +
      "1+2+4+...+n gives strictly less than 2n total copies across the whole sequence, because a " +
      "geometric series is dominated by its largest term. Spreading that Θ(n) total cost over " +
      "the n push_back calls gives O(1) amortized per call by the aggregate method, even though " +
      "a single push_back that happens to trigger a reallocation is genuinely O(n) at that " +
      "instant. That gap between the amortized and worst-case bound is why push_back is " +
      "documented as amortized constant rather than constant.",
  },
  {
    id: "dsa-amortized-vector-02",
    category: "dsa",
    difficulty: "hard",
    title: "A dynamic array that grows by a fixed 100 slots",
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
        "Still Θ(n) total and O(1) amortized; only the constant changes when growth stays additive",
        "Θ(n log n) total copies and O(log n) amortized, matching a comparison-sort-style bound",
        "Θ(n) total copies, but now O(1) worst case per call rather than merely amortized",
        "Θ(n^2/C) total copies, so Θ(n/C) amortized: the reallocation sizes form an arithmetic series",
      ],
      correctIndex: 3,
    },
    explanation:
      "With fixed-increment growth, reallocations occur at sizes C, 2C, 3C, and so on, about n/C " +
      "of them, and the k-th reallocation must copy the roughly kC elements that exist at that " +
      "point. Summing kC for k = 1 to n/C gives C · (1+2+...+n/C) = C · Θ((n/C)^2) = Θ(n^2/C), " +
      "an arithmetic series that grows quadratically in n. That is the crucial contrast with " +
      "doubling, whose reallocation sizes form a geometric series and therefore stay linear in " +
      "total. Dividing Θ(n^2/C) by n push_back calls gives Θ(n/C) amortized per call, and since " +
      "C is a constant this is Θ(n): the amortized cost per push_back grows with the array " +
      "rather than staying flat. Raising C to 1000 or 10000 shrinks the constant but leaves the " +
      "growth rate untouched, which is why every serious dynamic-array implementation multiplies " +
      "its capacity (by 2, or 1.5 to make freed blocks reusable) instead of adding to it.",
  },
  {
    id: "dsa-master-theorem-01",
    category: "dsa",
    difficulty: "hard",
    title: "Master theorem on T(n) = 2T(n/2) + n log n",
    tags: ["master-theorem", "recurrence-relations", "divide-and-conquer"],
    type: "trace",
    prompt:
      "Apply the master theorem to T(n) = 2T(n/2) + n log n. Here a=2, b=2, so " +
      "n^(log_b a) = n^1 = n, and f(n) = n log n. What is T(n)?",
    answerFormat: {
      kind: "multiple-choice",
      choices: [
        "Θ(n log^2 n), by the case-2 extension for f(n) = Θ(n^(log_b a) log^k n) with k = 1",
        "Θ(n log n), since f(n) is already n log n and dominates the recursive term outright",
        "Θ(n), since n^(log_b a) = n and no f(n) that is not polynomially larger can beat it",
        "The master theorem does not apply, since f(n) = n log n is not a polynomial in n",
      ],
      correctIndex: 0,
    },
    explanation:
      "The standard master theorem has a well-known extension covering the boundary case where " +
      "f(n) = Θ(n^(log_b a) · log^k n) for some k ≥ 0, with plain case 2 being the k=0 instance " +
      "that yields Θ(n^(log_b a) log n). The general result is T(n) = Θ(n^(log_b a) · log^(k+1) " +
      "n). Here n^(log_b a) = n^(log_2 2) = n and f(n) = n log n = n · log^1 n, matching the form " +
      "with k=1, so the theorem gives Θ(n · log^2 n), one power of log higher than f(n) itself. " +
      "The recursion tree makes the extra factor concrete. Level i holds 2^i subproblems of size " +
      "n/2^i, each doing (n/2^i)·log(n/2^i) work, so the whole level costs n·(log n - i). " +
      "Summing that over i = 0 to log n gives n·(log n + (log n - 1) + ... + 1) = Θ(n log^2 n). " +
      "Answering Θ(n log n) means pattern-matching f(n) and ignoring that every one of the log n " +
      "levels contributes work of nearly the same order as the top one, so the levels do not " +
      "collapse into a single dominant term the way they do in cases 1 and 3.",
    references: [
      "https://en.wikipedia.org/wiki/Master_theorem_(analysis_of_algorithms)",
    ],
  },
  {
    id: "dsa-quickselect-01",
    category: "dsa",
    difficulty: "hard",
    title: "Quickselect pivoting on the first element",
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
        "O(n log n) worst case, on sorted input; a median-of-three pivot brings it down to O(n)",
        "O(n^2) worst case, on sorted input; a uniformly random pivot restores expected O(n)",
        "O(n^2) worst case on any input whatever the pivot, since every level scans all n elements",
        "O(2^n) worst case, since a bad partition forces recursion into both sides of the pivot",
      ],
      correctIndex: 1,
    },
    explanation:
      "On an already-sorted array, pivoting on a[lo] picks the smallest remaining element every " +
      "time, so each partition step puts 0 elements before the pivot and all n-1 remaining " +
      "elements after it. The recursion then shrinks the problem by exactly one element per " +
      "call, and the partition scans cost n + (n-1) + ... + 1 = Θ(n^2). Reverse-sorted input is " +
      "just as bad in the mirror direction. This is a deterministic worst case triggered by " +
      "ordinary sorted data, not a rare adversarial construction, which is what makes a " +
      "fixed-position pivot dangerous in production. Choosing the pivot uniformly at random from " +
      "the current subrange fixes this. With probability at least 1/2 a random pivot lands in " +
      "the middle half of the range, leaving a subproblem of at most 3n/4, so the expected work " +
      "satisfies T(n) ≤ T(3n/4) + O(n). That unrolls into the geometric series " +
      "n + 3n/4 + 9n/16 + ... < 4n, giving Θ(n) expected time: subproblem sizes decay " +
      "geometrically instead of arithmetically. Median-of-medians turns the same O(n) into a " +
      "worst-case rather than expected guarantee, at a noticeably larger constant, which is why " +
      "library implementations reach for introselect: a randomized or median-of-three pivot with " +
      "a guaranteed fallback once the recursion runs too deep.",
  },
  {
    id: "dsa-introsort-01",
    category: "dsa",
    difficulty: "hard",
    title: "Introsort's depth counter and its small-partition cutoff",
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
        "Both are constant-factor tuning; plain quicksort already has a Θ(n log n) worst case",
        "The depth switch makes the sort stable; the cutoff makes it in-place, neither affects time",
        "Both exist to cut allocation counts and have no effect on time complexity whatsoever",
        "The depth switch caps the worst case at Θ(n log n); the cutoff is a constant-factor win",
      ],
      correctIndex: 3,
    },
    explanation:
      "Plain quicksort has Θ(n log n) expected time but a Θ(n^2) worst case, reachable on sorted " +
      "input with a naive pivot exactly as in the quickselect example. Introsort's depth counter " +
      "watches for recursion going deeper than a well-balanced quicksort ever would: 2·log2(n) " +
      "is a generous multiple of the Θ(log n) depth a balanced split produces, so exceeding it " +
      "is a reliable signal that partitioning has degenerated. Switching that partition to " +
      "heapsort caps the damage, since heapsort is Θ(n log n) worst case unconditionally " +
      "whatever the input order, and this is what lets std::sort advertise a Θ(n log n) " +
      "worst-case guarantee while still using quicksort as its primary strategy. The " +
      "insertion-sort cutoff is a different kind of optimization entirely. For n below roughly " +
      "16, insertion sort's Θ(n^2) is at most a couple of hundred operations, and it wins on " +
      "constants: no recursive calls, no partitioning logic, no pivot selection, and a tight " +
      "sequential scan that the prefetcher and branch predictor both handle well. The asymptotic " +
      "guarantee comes from the first threshold; most of the observed speed comes from the " +
      "second.",
  },
  {
    id: "dsa-suffixarray-01",
    category: "dsa",
    difficulty: "medium",
    title: "Suffix arrays vs. suffix trees for substring search",
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
        "O(m log n) substring search by binary search, in O(n) words with a small constant factor",
        "Only exact whole-string equality checks, not substring search, unlike what a suffix tree gives",
        "O(n^2) space, exactly like a naive suffix trie, so suffix trees dominate it in practice",
        "O(m) search, but construction is stuck at O(n^2 log n) with no known faster algorithm",
      ],
      correctIndex: 0,
    },
    explanation:
      "Because the suffix array is sorted, every occurrence of a pattern appears as a prefix of " +
      "some contiguous range of suffixes, so testing whether a pattern of length m occurs is a " +
      "binary search over the n suffixes with each comparison costing up to O(m), giving " +
      "O(m log n). An accompanying LCP (longest common prefix) array plus a range-minimum-query " +
      "structure sharpens that to O(m + log n) by skipping the characters already known to " +
      "match. A suffix tree instead lets you walk down from the root matching one pattern " +
      "character per edge traversal, giving O(m) matching independent of n, which is faster for " +
      "search-heavy workloads. The tradeoff is space and implementation complexity: a suffix " +
      "array is nothing but a permutation of indices, O(n) words with a tiny constant, while a " +
      "suffix tree needs a node per branching point plus edge-label representation, in practice " +
      "several times more memory per input character. Suffix arrays paired with an LCP array " +
      "recover most of the tree's power at a fraction of the footprint, which is why they " +
      "dominate large-scale text indexing. Construction cost is not the deciding factor: both " +
      "admit O(n)-time algorithms (SA-IS for suffix arrays, Ukkonen's for suffix trees), well " +
      "under the naive O(n^2 log n) of sorting all suffixes directly.",
  },
];
