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
import { TablePagination } from "@/components/shared/table-pagination";
import { DIFFICULTIES, DIFFICULTY_CLASS } from "@/lib/difficulty";
import { CATEGORIES, CATEGORY_META } from "@/types/category";
import { LANGUAGES, LANGUAGE_META } from "@/types/coding-exercise";
import type { CodingExerciseSummary } from "@/types/coding-exercise";
import type { Difficulty } from "@/types/question";
import type { Category } from "@/types/category";
import type { Language } from "@/types/coding-exercise";

const PAGE_SIZE = 20;

export function CodingExerciseTable({
  exercises,
}: {
  exercises: CodingExerciseSummary[];
}) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [language, setLanguage] = useState<Language | "all">("all");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const searchQuery = search.trim().toLowerCase();
    return exercises.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (language !== "all" && !e.languages.includes(language)) return false;
      if (difficulty !== "all" && e.difficulty !== difficulty) return false;
      if (searchQuery) {
        const haystack = [e.title, ...(e.tags ?? [])].join(" ").toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }
      return true;
    });
  }, [exercises, category, language, difficulty, search]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  function handleCategoryChange(value: Category | "all") {
    setCategory(value);
    setPage(1);
  }

  function handleLanguageChange(value: Language | "all") {
    setLanguage(value);
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

        <Select
          value={language}
          onValueChange={(v) => handleLanguageChange(v as Language | "all")}
        >
          <SelectTrigger size="sm" className="w-32 font-mono text-xs">
            <SelectValue placeholder="Language">
              {(value: Language | "all" | null) =>
                !value || value === "all"
                  ? "All languages"
                  : LANGUAGE_META[value].label
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            {LANGUAGES.map((id) => (
              <SelectItem key={id} value={id}>
                {LANGUAGE_META[id].label}
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

        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search…"
          className="ml-auto h-8 w-72 font-mono text-xs"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead className="text-xs text-muted-foreground">
                Title
              </TableHead>
              <TableHead className="text-xs text-muted-foreground">
                Category
              </TableHead>
              <TableHead className="text-xs text-muted-foreground">
                Difficulty
              </TableHead>
              <TableHead className="text-xs text-muted-foreground">
                Language
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((exercise) => (
              <TableRow
                key={exercise.id}
                className="cursor-pointer border-border/60"
              >
                <TableCell className="max-w-56 min-w-28 p-0">
                  <Link
                    href={`/coding/${exercise.id}`}
                    title={exercise.title}
                    className="block truncate px-2 py-2.5 text-sm text-foreground"
                  >
                    {exercise.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`font-mono text-[10px] ${CATEGORY_META[exercise.category].badgeClassName}`}
                  >
                    {CATEGORY_META[exercise.category].shortLabel}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`font-mono text-[10px] uppercase ${DIFFICULTY_CLASS[exercise.difficulty]}`}
                  >
                    {exercise.difficulty}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {exercise.languages.map((id) => (
                      <Badge
                        key={id}
                        variant="outline"
                        className={`font-mono text-[10px] ${LANGUAGE_META[id].badgeClassName}`}
                      >
                        {LANGUAGE_META[id].label}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {pageItems.length === 0 && (
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {exercises.length === 0
                    ? "No coding exercises yet — check back soon."
                    : "No exercises match these filters."}
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
