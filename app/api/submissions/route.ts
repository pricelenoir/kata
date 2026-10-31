import { NextResponse } from "next/server";
import { getCodingExerciseById } from "@/lib/coding-exercises";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { validateTest } from "@/judge/src/wire";
import { LANGUAGES, type Language, type TestCase } from "@/types/coding-exercise";
import { MAX_SOURCE_BYTES } from "@/types/submission";

// Queues a run or submit. Everything here is a courtesy check for good
// error messages — the real gatekeeping (auth, rate limits, sizes) happens
// in public.enqueue_submission, which is also reachable directly through
// the Supabase API, and the worker re-validates the job before judging.

function error(status: number, message: string, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) return error(503, "Running code needs accounts, which aren't set up here.");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return error(400, "Expected a JSON body.");
  }
  const { exerciseId, language, kind, source, customInput } = body;

  const exercise = typeof exerciseId === "string" ? getCodingExerciseById(exerciseId) : undefined;
  if (!exercise) return error(404, "No such exercise.");
  if (!LANGUAGES.includes(language as Language)) return error(400, "Unsupported language.");
  if (kind !== "run" && kind !== "submit") return error(400, "kind must be run or submit.");
  if (typeof source !== "string" || source.trim() === "") return error(400, "Write some code first.");
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) return error(413, "Source is over 64 KB.");
  if (customInput !== undefined && customInput !== null) {
    if (kind !== "run") return error(400, "Custom input is only for runs.");
    const problems = validateTest(exercise, customInput as TestCase, { requireExpected: false });
    if (problems.length > 0) return error(400, `Custom input: ${problems.join("; ")}`);
  }

  const supabase = await createClient();
  const { data, error: rpcError } = await supabase.rpc("enqueue_submission", {
    p_exercise_id: exercise.id,
    p_language: language,
    p_kind: kind,
    p_source: source,
    p_custom_input: customInput ?? null,
  });

  if (rpcError) {
    const retryAfter = /retry_after=(\d+)/.exec(rpcError.hint ?? "")?.[1];
    const headers = retryAfter ? { "Retry-After": retryAfter } : undefined;
    switch (rpcError.code) {
      case "28000":
        return error(401, "Sign in to run code.");
      case "KT429":
        return error(429, `${capitalize(rpcError.message)}.`, headers);
      case "KT503":
        return error(503, `${capitalize(rpcError.message)}.`, headers);
      case "KT400":
      case "23514":
        return error(400, rpcError.message);
      default:
        console.error("enqueue_submission failed:", rpcError);
        return error(500, "Couldn't queue that run. Try again.");
    }
  }

  return NextResponse.json({ id: data as string }, { status: 202 });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
