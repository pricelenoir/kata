"use client";

import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DifficultyLabel } from "@/components/ui/difficulty";
import { cn } from "@/lib/utils";
import { CATEGORIES, CATEGORY_META, type Category } from "@/types/category";
import type { Difficulty } from "@/types/question";

// Building blocks shared by the Questions and Coding lists, so both pages
// filter, look, and behave the same way.

export const DIFFICULTY_LABEL: Record<Difficulty | "all", string> = {
  all: "All levels",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function TopicSelect({
  value,
  onChange,
}: {
  value: Category | "all";
  onChange: (value: Category | "all") => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Category | "all")}>
      <SelectTrigger size="sm" className="w-44 text-sm">
        <SelectValue>
          {(v: Category | "all" | null) => (!v || v === "all" ? "All topics" : CATEGORY_META[v].label)}
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
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="surface flex items-center gap-0.5 rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-md px-2.5 text-sm transition-colors",
            value === o.value ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative ml-auto w-full sm:w-72">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 pl-8 text-sm" />
    </div>
  );
}

/** Topic as a colored dot and name, for list rows. */
export function TopicCell({ category, className }: { category: Category; className?: string }) {
  const meta = CATEGORY_META[category];
  return (
    <span className={cn("items-center gap-2 text-sm text-muted-foreground", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", meta.dotClassName)} />
      <span className="truncate">{meta.label.length > 20 ? meta.shortLabel : meta.label}</span>
    </span>
  );
}

export function DifficultyCell({ difficulty }: { difficulty: Difficulty }) {
  return <DifficultyLabel difficulty={difficulty} />;
}
