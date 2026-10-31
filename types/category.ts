export const CATEGORIES = [
  "cpp",
  "os",
  "concurrency",
  "networking",
  "computer-architecture",
  "design-patterns",
  "compilers",
  "gpu-cuda",
  "dsa",
  "rust",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CategoryMeta {
  id: Category;
  label: string;
  /** Compact form for badges/tags where the full label wraps awkwardly. */
  shortLabel: string;
  description: string;
  /** Solid swatch for small dots and bars. Spelled out in full because
   * Tailwind can't see dynamically interpolated class names. */
  dotClassName: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  cpp: {
    id: "cpp",
    label: "C++",
    shortLabel: "C++",
    description:
      "Language semantics, memory model, RAII, move semantics, STL, and modern C++ gotchas.",
    dotClassName: "bg-sky-400",
  },
  os: {
    id: "os",
    label: "Operating Systems",
    shortLabel: "OS",
    description: "Processes, virtual memory, scheduling, syscalls, and I/O.",
    dotClassName: "bg-amber-400",
  },
  concurrency: {
    id: "concurrency",
    label: "Concurrency",
    shortLabel: "Concurrency",
    description:
      "Memory ordering, data races, lock-free structures, and cache effects.",
    dotClassName: "bg-violet-400",
  },
  networking: {
    id: "networking",
    label: "Networking",
    shortLabel: "Networking",
    description:
      "TCP/IP fundamentals, socket semantics, and latency-sensitive I/O patterns.",
    dotClassName: "bg-emerald-400",
  },
  "computer-architecture": {
    id: "computer-architecture",
    label: "Computer Architecture",
    shortLabel: "Comp Arch",
    description:
      "Pipelining, branch prediction, cache hierarchies, and memory consistency at the hardware level.",
    dotClassName: "bg-rose-400",
  },
  "design-patterns": {
    id: "design-patterns",
    label: "Design Patterns",
    shortLabel: "Patterns",
    description:
      "Classic GoF patterns, modern C++ idioms, and the tradeoffs behind each one.",
    dotClassName: "bg-indigo-400",
  },
  compilers: {
    id: "compilers",
    label: "Compilers",
    shortLabel: "Compilers",
    description:
      "Parsing, optimization passes, code generation, and how the compiler transforms your code.",
    dotClassName: "bg-teal-400",
  },
  "gpu-cuda": {
    id: "gpu-cuda",
    label: "GPU / CUDA",
    shortLabel: "GPU/CUDA",
    description:
      "Warp scheduling, memory coalescing, occupancy, and parallel kernel design.",
    dotClassName: "bg-orange-400",
  },
  dsa: {
    id: "dsa",
    label: "Data Structures & Algorithms",
    shortLabel: "DSA",
    description:
      "Advanced data structures, algorithmic complexity, and problem-solving under constraints.",
    dotClassName: "bg-fuchsia-400",
  },
  rust: {
    id: "rust",
    label: "Rust",
    shortLabel: "Rust",
    description:
      "Ownership, borrowing, lifetimes, and the same systems-level gotchas as C++ resolved a different way.",
    dotClassName: "bg-red-400",
  },
};
