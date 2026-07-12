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
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CategoryMeta {
  id: Category;
  label: string;
  /** Compact form for badges/tags where the full label wraps awkwardly. */
  shortLabel: string;
  description: string;
  // Tailwind needs statically-analyzable class strings — dynamic
  // `bg-${color}-500` interpolation doesn't survive production purging —
  // so each category's classes are spelled out in full here.
  badgeClassName: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  cpp: {
    id: "cpp",
    label: "C++",
    shortLabel: "C++",
    description:
      "Language semantics, memory model, RAII, move semantics, STL, and modern C++ gotchas.",
    badgeClassName: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  },
  os: {
    id: "os",
    label: "Operating Systems",
    shortLabel: "OS",
    description: "Processes, virtual memory, scheduling, syscalls, and I/O.",
    badgeClassName: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  concurrency: {
    id: "concurrency",
    label: "Concurrency",
    shortLabel: "Concurrency",
    description:
      "Memory ordering, data races, lock-free structures, and cache effects.",
    badgeClassName: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  },
  networking: {
    id: "networking",
    label: "Networking",
    shortLabel: "Networking",
    description:
      "TCP/IP fundamentals, socket semantics, and latency-sensitive I/O patterns.",
    badgeClassName: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  "computer-architecture": {
    id: "computer-architecture",
    label: "Computer Architecture",
    shortLabel: "Comp Arch",
    description:
      "Pipelining, branch prediction, cache hierarchies, and memory consistency at the hardware level.",
    badgeClassName: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  },
  "design-patterns": {
    id: "design-patterns",
    label: "Design Patterns",
    shortLabel: "Patterns",
    description:
      "Classic GoF patterns, modern C++ idioms, and the tradeoffs behind each one.",
    badgeClassName: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  },
  compilers: {
    id: "compilers",
    label: "Compilers",
    shortLabel: "Compilers",
    description:
      "Parsing, optimization passes, code generation, and how the compiler transforms your code.",
    badgeClassName: "bg-teal-500/10 text-teal-400 border-teal-500/30",
  },
  "gpu-cuda": {
    id: "gpu-cuda",
    label: "GPU / CUDA",
    shortLabel: "GPU/CUDA",
    description:
      "Warp scheduling, memory coalescing, occupancy, and parallel kernel design.",
    badgeClassName: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  },
  dsa: {
    id: "dsa",
    label: "Data Structures & Algorithms",
    shortLabel: "DSA",
    description:
      "Advanced data structures, algorithmic complexity, and problem-solving under constraints.",
    badgeClassName: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30",
  },
};
