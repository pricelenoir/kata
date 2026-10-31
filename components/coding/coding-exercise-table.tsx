"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import {
  DIFFICULTY_LABEL,
  DifficultyCell,
  SearchField,
  Segmented,
  TopicCell,
  TopicSelect,
} from "@/components/shared/list-controls";
import { TablePagination } from "@/components/shared/table-pagination";
import { DIFFICULTIES } from "@/lib/difficulty";
import type { Category } from "@/types/category";
import type { CodingExerciseSummary } from "@/types/coding-exercise";
import type { Difficulty } from "@/types/question";

const PAGE_SIZE = 20;

export function CodingExerciseTable({
  exercises,
  initialCategory = "all",
}: {
  exercises: CodingExerciseSummary[];
  initialCategory?: Category | "all";
}) {
  const [category, setCategory] = useState<Category | "all">(initialCategory);
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (difficulty !== "all" && e.difficulty !== difficulty) return false;
      if (q && ![e.title, ...(e.tags ?? [])].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, category, difficulty, search]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TopicSelect value={category} onChange={reset(setCategory)} />
        <Segmented
          label="Difficulty"
          value={difficulty}
          onChange={reset(setDifficulty)}
          options={(["all", ...DIFFICULTIES] as const).map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))}
        />
        <SearchField value={search} onChange={reset(setSearch)} placeholder="Search exercises" />
      </div>

      <div className="surface overflow-hidden rounded-xl">
        <div className="border-b border-border px-4 py-3 text-sm text-foreground">
          Exercises
          <span className="ml-2 rounded-full bg-foreground/[0.07] px-1.5 text-xs tabular-nums text-muted-foreground">
            {filtered.length}
          </span>
        </div>
        <ul className="divide-y divide-border/70">
          {pageItems.map((e) => (
            <li key={e.id}>
              <Link
                href={`/coding/${e.id}`}
                className="group grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03] sm:grid-cols-[1fr_11rem_6rem_1rem]"
              >
                <span className="min-w-0 truncate text-sm text-foreground">{e.title}</span>
                <TopicCell category={e.category} className="hidden sm:flex" />
                <DifficultyCell difficulty={e.difficulty} />
                <ChevronRightIcon className="hidden size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
              </Link>
            </li>
          ))}
          {pageItems.length === 0 && (
            <li className="px-4 py-14 text-center text-sm text-muted-foreground">No exercises match these filters.</li>
          )}
        </ul>
      </div>

      <TablePagination page={page} pageSize={PAGE_SIZE} totalCount={filtered.length} onPageChange={setPage} />
    </div>
  );
}
