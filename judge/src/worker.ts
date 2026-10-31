// The judge worker: claims queued submissions, judges them in sandboxes,
// and writes results back. Runs on dedicated runner hosts — never on the
// web tier — next to a Docker daemon configured with gVisor.
//
//   JUDGE_DATABASE_URL   postgres URL for the judge_worker role. Must be a
//                        session-mode connection (direct, or the session
//                        pooler): LISTEN doesn't work through a
//                        transaction pooler.
//   JUDGE_RUNTIME        OCI runtime for sandboxes: "runsc" (gVisor) in
//                        production, a Kata/Firecracker runtime on KVM hosts,
//                        or "runc" for local development only. Required, so
//                        the isolation level is always a deliberate choice.
//   JUDGE_CONCURRENCY    parallel sandboxes (default 2; ~1 per spare core)
//   JUDGE_POOL           runner pool to serve (default "cpu")
//   JUDGE_WORKER_ID      stable id for this host (default: hostname)
//   JUDGE_BUNDLE_DIR     read hidden-test bundles from a directory instead
//                        of the database (local development)
import { hostname } from "node:os";
import pg from "pg";
import { CODING_EXERCISES } from "@/content/coding-exercises";
import type { Language } from "@/types/coding-exercise";
import type { JudgeResult, SubmissionKind } from "@/types/submission";
import { DatabaseBundles, DirectoryBundles, type BundleSource } from "./bundles";
import { internalError, judge } from "./judge";
import { planTests } from "./plan";
import { Sandbox } from "./sandbox";

interface Job {
  id: string;
  exercise_id: string;
  language: Language;
  kind: SubmissionKind;
  source: string;
  custom_input: unknown;
  attempts: number;
}

const LEASE_SECONDS = 60;
const HEARTBEAT_MS = 20_000;
const IDLE_POLL_MS = 5_000;

function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...fields }));
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required`);
    process.exit(2);
  }
  return value;
}

const config = {
  databaseUrl: required("JUDGE_DATABASE_URL"),
  runtime: required("JUDGE_RUNTIME"),
  concurrency: Number(process.env.JUDGE_CONCURRENCY ?? 2),
  pool: process.env.JUDGE_POOL ?? "cpu",
  workerId: process.env.JUDGE_WORKER_ID ?? hostname(),
  bundleDir: process.env.JUDGE_BUNDLE_DIR,
};

const db = new pg.Pool({ connectionString: config.databaseUrl, max: config.concurrency + 2 });
const bundles: BundleSource = config.bundleDir
  ? new DirectoryBundles(config.bundleDir)
  : new DatabaseBundles(db);

let stopping = false;
const sleepers = new Set<() => void>();

/** Wakes every idle slot; they race for the job and SKIP LOCKED sorts it out. */
function wake(): void {
  for (const resolve of sleepers) resolve();
  sleepers.clear();
}

function sleepUntilWoken(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      sleepers.delete(done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    sleepers.add(done);
  });
}

async function judgeJob(job: Job): Promise<JudgeResult> {
  const exercise = CODING_EXERCISES.find((e) => e.id === job.exercise_id);
  if (!exercise) return internalError(`unknown exercise ${job.exercise_id}`);
  const plan = planTests(exercise, {
    kind: job.kind,
    bundle: job.kind === "submit" ? await bundles.get(exercise.id) : null,
    customInput: job.custom_input,
  });
  if (!plan.ok) return internalError(plan.error);
  return judge(
    {
      exercise,
      language: job.language,
      source: job.source,
      tests: plan.tests,
      stopOnFirstFailure: job.kind === "submit",
    },
    { runtime: config.runtime, owner: config.workerId },
  );
}

/** `claimant` is the id the job was claimed under; the lease and completion
 * calls only succeed for the worker that holds the job. */
async function processJob(job: Job, claimant: string): Promise<void> {
  const started = Date.now();
  const heartbeat = setInterval(() => {
    db.query("select judge.extend_lease($1, $2, $3)", [job.id, claimant, LEASE_SECONDS]).catch((err) =>
      log({ level: "warn", msg: "lease extension failed", job: job.id, err: String(err) }),
    );
  }, HEARTBEAT_MS);
  let result: JudgeResult;
  try {
    result = await judgeJob(job);
  } catch (err) {
    log({ level: "error", msg: "judge crashed", job: job.id, err: String(err) });
    result = internalError("The judge hit an unexpected error.");
  } finally {
    clearInterval(heartbeat);
  }
  const { rows } = await db.query<{ ok: boolean | null }>("select judge.complete_job($1, $2, $3::jsonb) as ok", [
    job.id,
    claimant,
    JSON.stringify(result),
  ]);
  if (!rows[0]?.ok) log({ level: "warn", msg: "lost the job's lease before finishing", job: job.id });
  log({
    level: "info",
    msg: "judged",
    job: job.id,
    exercise: job.exercise_id,
    language: job.language,
    kind: job.kind,
    verdict: result.verdict,
    passed: `${result.passed}/${result.total}`,
    ms: Date.now() - started,
  });
}

async function slot(n: number): Promise<void> {
  const claimant = `${config.workerId}/${n}`;
  while (!stopping) {
    let job: Job | undefined;
    try {
      const { rows } = await db.query<Job>("select * from judge.claim_job($1, $2, $3)", [
        claimant,
        config.pool,
        LEASE_SECONDS,
      ]);
      job = rows[0];
    } catch (err) {
      log({ level: "error", msg: "claim failed", err: String(err) });
      await sleepUntilWoken(IDLE_POLL_MS);
      continue;
    }
    if (!job) {
      await sleepUntilWoken(IDLE_POLL_MS);
      continue;
    }
    await processJob(job, claimant).catch((err) =>
      log({ level: "error", msg: "completion failed", job: job.id, err: String(err) }),
    );
  }
}

async function main() {
  if (config.runtime === "runc") {
    log({ level: "warn", msg: "JUDGE_RUNTIME=runc: containers share the host kernel; local development only" });
  }
  await Sandbox.reapOrphans(config.workerId);

  const listener = new pg.Client({ connectionString: config.databaseUrl });
  await listener.connect();
  listener.on("notification", (msg) => {
    if (msg.payload === config.pool) wake();
  });
  await listener.query("listen judge_jobs");

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    log({ level: "info", msg: "draining" });
    wake();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  log({ level: "info", msg: "worker started", ...config, databaseUrl: undefined });
  await Promise.all(Array.from({ length: config.concurrency }, (_, n) => slot(n)));
  await listener.end();
  await db.end();
  log({ level: "info", msg: "stopped" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
