"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusDot } from "@/components/question/status-dot";
import { TablePagination } from "@/components/shared/table-pagination";
import { useProgress } from "@/lib/progress-store";
import { DIFFICULTIES, DIFFICULTY_CLASS } from "@/lib/difficulty";
import { CATEGORIES, CATEGORY_META } from "@/types/category";
import type { Category } from "@/types/category";
import type { Difficulty, QuestionSummary } from "@/types/question";

const PAGE_SIZE = 20;

type StatusFilter = "all" | "unanswered" | "correct" | "incorrect";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "all" },
  { value: "unanswered", label: "unanswered" },
  { value: "correct", label: "correct" },
  { value: "incorrect", label: "incorrect" },
];

export function QuestionsTable({
  questions,
  initialCategory = "all",
}: {
  questions: QuestionSummary[];
  initialCategory?: Category | "all";
}) {
  const [category, setCategory] = useState<Category | "all">(initialCategory);
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const { getAttempt, hydrated } = useProgress();

  const filtered = useMemo(() => {
    const searchQuery = search.trim().toLowerCase();
    return questions.filter((q) => {
      if (category !== "all" && q.category !== category) return false;
      if (difficulty !== "all" && q.difficulty !== difficulty) return false;
      if (status !== "all") {
        const attempt = hydrated ? getAttempt(q.id) : undefined;
        if (status === "unanswered" && attempt) return false;
        if (status === "correct" && attempt?.status !== "correct") return false;
        if (status === "incorrect" && attempt?.status !== "incorrect")
          return false;
      }
      if (searchQuery) {
        const haystack = [q.title, ...(q.tags ?? [])].join(" ").toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }
      return true;
    });
  }, [questions, category, difficulty, status, search, hydrated, getAttempt]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  function handleCategoryChange(value: Category | "all") {
    setCategory(value);
    setPage(1);
  }

  function handleDifficultyChange(value: Difficulty | "all") {
    setDifficulty(value);
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusChange(value: StatusFilter) {
    setStatus(value);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={category}
          onValueChange={(v) => handleCategoryChange(v as Category | "all")}
        >
          <SelectTrigger size="sm" className="w-32 font-mono text-xs">
            <SelectValue placeholder="Category">
              {(value: Category | "all" | null) =>
                !value || value === "all"
                  ? "All"
                  : CATEGORY_META[value].shortLabel
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((id) => (
              <SelectItem key={id} value={id}>
                {CATEGORY_META[id].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          {(["all", ...DIFFICULTIES] as const).map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={difficulty === d ? "secondary" : "ghost"}
              onClick={() => handleDifficultyChange(d)}
              className="font-mono text-xs capitalize"
            >
              {d}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s.value}
              type="button"
              size="sm"
              variant={status === s.value ? "secondary" : "ghost"}
              onClick={() => handleStatusChange(s.value)}
              className="font-mono text-xs capitalize"
            >
              {s.label}
            </Button>
          ))}
        </div>

        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search title or tag…"
          className="ml-auto h-8 w-72 font-mono text-xs"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead className="w-8 text-xs text-muted-foreground" />
              <TableHead className="text-xs text-muted-foreground">
                Title
              </TableHead>
              <TableHead className="text-xs text-muted-foreground">
                Category
              </TableHead>
              <TableHead className="text-xs text-muted-foreground">
                Difficulty
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((q) => {
              const attempt = hydrated ? getAttempt(q.id) : undefined;
              return (
                <TableRow key={q.id} className="cursor-pointer border-border/60">
                  <TableCell className="pl-3">
                    <StatusDot status={attempt?.status} />
                  </TableCell>
                  <TableCell className="p-0">
                    <Link
                      href={`/questions/${q.category}/${q.id}`}
                      className="block px-2 py-2.5 text-sm text-foreground"
                    >
                      {q.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] ${CATEGORY_META[q.category].badgeClassName}`}
                    >
                      {CATEGORY_META[q.category].shortLabel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] uppercase ${DIFFICULTY_CLASS[q.difficulty]}`}
                    >
                      {q.difficulty}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {pageItems.length === 0 && (
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No questions match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={filtered.length}
        onPageChange={setPage}
      />
    </div>
  );
}
