import { SiteHeader } from "@/components/layout/site-header";
import { CodingExerciseTable } from "@/components/coding/coding-exercise-table";
import { StatsSummary } from "@/components/progress/stats-summary";
import { getAllCodingExercises } from "@/lib/coding-exercises";

export default function CodingExercisesPage() {
  const exercises = getAllCodingExercises();

  return (
    <div className="flex flex-1 flex-col animate-in fade-in-0 duration-300">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-10 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Write it. Run it.
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Write and run real solutions, judged against test cases.
          </p>
        </div>

        <div className="mb-8">
          <StatsSummary />
        </div>

        <CodingExerciseTable exercises={exercises} />
      </main>
    </div>
  );
}
