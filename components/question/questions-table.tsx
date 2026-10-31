"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, CheckIcon, SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "@/components/shared/table-pagination";
import { useProgress } from "@/lib/progress-store";
import { DIFFICULTIES, DIFFICULTY_TEXT } from "@/lib/difficulty";
import { cn } from "@/lib/utils";
import { CATEGORIES, CATEGORY_META, type Category } from "@/types/category";
import type { Difficulty, QuestionSummary } from "@/types/question";

const PAGE_SIZE = 20;

export type StatusFilter = "all" | "unanswered" | "correct" | "incorrect";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unanswered", label: "Unanswered" },
  { value: "incorrect", label: "Missed" },
  { value: "correct", label: "Correct" },
];

const DIFFICULTY_LABEL: Record<Difficulty | "all", string> = {
  all: "Any",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function QuestionsTable({
  questions,
  initialCategory = "all",
  initialStatus = "all",
}: {
  questions: QuestionSummary[];
  initialCategory?: Category | "all";
  initialStatus?: StatusFilter;
}) {
  const [category, setCategory] = useState<Category | "all">(initialCategory);
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [page, setPage] = useState(1);
  const { getAttempt, hydrated } = useProgress();

  const statusOf = (id: string): StatusFilter => {
    const attempt = hydrated ? getAttempt(id) : undefined;
    return attempt ? attempt.status : "unanswered";
  };

  // Everything except the status filter, so each tab can show its count.
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (difficulty !== "all" && item.difficulty !== difficulty) return false;
      if (q && ![item.title, ...(item.tags ?? [])].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [questions, category, difficulty, search]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: scoped.length, unanswered: 0, correct: 0, incorrect: 0 };
    for (const item of scoped) c[statusOf(item.id)] += 1;
    return c;
    // statusOf only depends on these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, hydrated, getAttempt]);

  const filtered = status === "all" ? scoped : scoped.filter((item) => statusOf(item.id) === status);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={(v) => reset(setCategory)(v as Category | "all")}>
          <SelectTrigger size="sm" className="w-44 text-sm">
            <SelectValue>
              {(value: Category | "all" | null) =>
                !value || value === "all" ? "All topics" : CATEGORY_META[value].label
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All topics</SelectItem>
            {CATEGORIES.map((id) => (
              <SelectItem key={id} value={id}>
                <span className={cn("size-2 rounded-full", CATEGORY_META[id].dotClassName)} />
                {CATEGORY_META[id].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div role="group" aria-label="Difficulty" className="surface flex items-center gap-0.5 rounded-lg p-0.5">
          {(["all", ...DIFFICULTIES] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={difficulty === d}
              onClick={() => reset(setDifficulty)(d)}
              className={cn(
                "h-7 rounded-md px-2.5 text-sm transition-colors",
                difficulty === d ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => reset(setSearch)(e.target.value)}
            placeholder="Search questions"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="surface overflow-hidden rounded-xl">
        <div role="tablist" aria-label="Status" className="flex gap-1 overflow-x-auto border-b border-border px-2">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={status === t.value}
              onClick={() => reset(setStatus)(t.value)}
              className={cn(
                "relative flex items-center gap-2 whitespace-nowrap px-3 py-3 text-sm transition-colors",
                status === t.value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="rounded-full bg-foreground/[0.07] px-1.5 text-xs tabular-nums text-muted-foreground">
                {hydrated || t.value === "all" ? counts[t.value] : "–"}
              </span>
              {status === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-sky" />}
            </button>
          ))}
        </div>

        <ul className="divide-y divide-border/70">
          {pageItems.map((q) => {
            const s = statusOf(q.id);
            const meta = CATEGORY_META[q.category];
            return (
              <li key={q.id}>
                <Link
                  href={`/questions/${q.category}/${q.id}`}
                  className="group grid grid-cols-[1.25rem_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03] sm:grid-cols-[1.25rem_1fr_11rem_5rem_1rem]"
                >
                  <StatusIcon status={s} />
                  <span className="min-w-0 truncate text-sm text-foreground">{q.title}</span>
                  <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
                    <span className={cn("size-2 shrink-0 rounded-full", meta.dotClassName)} />
                    <span className="truncate">{meta.label.length > 20 ? meta.shortLabel : meta.label}</span>
                  </span>
                  <span className={cn("text-sm", DIFFICULTY_TEXT[q.difficulty])}>{DIFFICULTY_LABEL[q.difficulty]}</span>
                  <ChevronRightIcon className="hidden size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                </Link>
              </li>
            );
          })}
          {pageItems.length === 0 && (
            <li className="px-4 py-14 text-center text-sm text-muted-foreground">No questions match these filters.</li>
          )}
        </ul>
      </div>

      <TablePagination page={page} pageSize={PAGE_SIZE} totalCount={filtered.length} onPageChange={setPage} />
    </div>
  );
}

function StatusIcon({ status }: { status: StatusFilter }) {
  if (status === "correct") {
    return (
      <span title="Answered correctly" className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
        <CheckIcon className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "incorrect") {
    return (
      <span title="Missed" className="grid size-5 place-items-center rounded-full bg-red-500/15 text-red-400">
        <XIcon className="size-3" strokeWidth={3} />
      </span>
    );
  }
  return <span title="Not answered yet" className="mx-auto size-1.5 rounded-full bg-foreground/20" />;
}
