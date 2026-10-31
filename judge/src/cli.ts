// Judge a solution locally, without the database:
//
//   npm run judge -- <exercise-id | path/to/exercise.ts> <solution-file> \
//       [--bundle bundle.json] [--submit] [--custom input.txt]
//
// Without --bundle only the public examples run. Language comes from the
// file extension. Prints the JudgeResult as JSON; exits 1 unless accepted.
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CODING_EXERCISES } from "@/content/coding-exercises";
import type { CodingExercise, Language, TestBundle } from "@/types/coding-exercise";
import { judge } from "./judge";
import { planTests } from "./plan";

const EXTENSIONS: Record<string, Language> = { ".cpp": "cpp", ".cc": "cpp", ".rs": "rust" };

async function loadExercise(ref: string): Promise<CodingExercise> {
  const known = CODING_EXERCISES.find((e) => e.id === ref);
  if (known) return known;
  const mod = await import(pathToFileURL(resolve(ref)).href);
  const exercise = (mod.default ?? Object.values(mod)[0]) as CodingExercise | undefined;
  if (!exercise?.mode) throw new Error(`no exercise ${ref}`);
  return exercise;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    if (i === -1) return undefined;
    const [, value] = args.splice(i, 2);
    return value;
  };
  const submit = args.includes("--submit");
  if (submit) args.splice(args.indexOf("--submit"), 1);
  const bundlePath = flag("--bundle");
  const customPath = flag("--custom");
  const [exerciseRef, sourcePath] = args;
  if (!exerciseRef || !sourcePath) {
    console.error("usage: judge <exercise> <solution> [--bundle file] [--submit] [--custom file]");
    process.exit(2);
  }

  const exercise = await loadExercise(exerciseRef);
  const language = EXTENSIONS[extname(sourcePath)];
  if (!language) throw new Error(`unknown language for ${sourcePath}`);
  const bundle = bundlePath ? (JSON.parse(await readFile(bundlePath, "utf8")) as TestBundle) : null;
  const custom = customPath ? await readFile(customPath, "utf8") : undefined;

  const plan = planTests(exercise, {
    kind: submit ? "submit" : "run",
    bundle,
    customInput: custom === undefined ? undefined : JSON.parse(custom),
  });
  if (!plan.ok) throw new Error(plan.error);

  const started = Date.now();
  const result = await judge(
    {
      exercise,
      language,
      source: await readFile(sourcePath, "utf8"),
      tests: plan.tests,
      stopOnFirstFailure: submit,
    },
    { runtime: process.env.JUDGE_RUNTIME || undefined, owner: "cli" },
  );
  console.log(JSON.stringify(result, null, 2));
  console.error(`${result.verdict} (${result.passed}/${result.total}) in ${Date.now() - started} ms`);
  process.exit(result.verdict === "accepted" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
