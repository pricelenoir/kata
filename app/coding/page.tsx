import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SiteHeader } from "@/components/layout/site-header";
import { CodingExerciseTable } from "@/components/coding/coding-exercise-table";
import { getAllCodingExerciseSummaries } from "@/lib/coding-exercises";
import { CATEGORIES, type Category } from "@/types/category";

export const metadata: Metadata = {
  title: "Coding",
};

export default async function CodingExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const exercises = getAllCodingExerciseSummaries();
  const { category } = await searchParams;
  const initialCategory = CATEGORIES.includes(category as Category) ? (category as Category) : "all";

  return (
    <div className="flex flex-1 flex-col animate-in fade-in-0 duration-300">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <PageHeader
          title="Coding"
          description="Implement real systems primitives in C++ or Rust and run them against hidden tests in a sandbox."
        />

        <CodingExerciseTable exercises={exercises} initialCategory={initialCategory} />
      </main>
    </div>
  );
}
