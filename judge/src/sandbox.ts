import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";

// One sandbox = one short-lived container per submission. Untrusted code
// runs inside it only through kata-run (judge/images/kata-run.c), which
// drops to an unprivileged uid and enforces per-test limits; the container
// adds the outer walls: gVisor (or another OCI runtime), no network, a
// read-only root, a dropped capability set, and memory/pid/CPU cgroups.

const DOCKER = process.env.DOCKER_BIN ?? "docker";

export interface SandboxConfig {
  image: string;
  /** OCI runtime: "runsc" (gVisor) in production. Firecracker microVMs
   * plug in the same way via Kata Containers ("io.containerd.kata-fc.v2"). */
  runtime?: string;
  /** Container-wide memory cap. Covers the compiler too, so it's larger
   * than any per-test limit; tmpfs contents count against it. */
  memoryMb: number;
  cpus: number;
  /** Labels the container so a restarted worker can reap its own leftovers. */
  owner: string;
}

export interface RunLimits {
  cpuMs: number;
  wallMs?: number;
  memoryMb?: number;
  fsizeMb?: number;
  stdoutMax?: number;
  stderrMax?: number;
  env?: Record<string, string>;
}

/** One program execution, as measured by kata-run. */
export interface RunRecord {
  exit: number | null;
  signal: number | null;
  timedOut: boolean;
  outputLimit: boolean;
  cpuMs: number;
  wallMs: number;
  rssKb: number;
  stdout: Buffer;
  stderr: Buffer;
  stdoutBytes: number;
  stderrBytes: number;
}

export class SandboxError extends Error {}

function docker(args: string[], input?: Buffer): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(DOCKER, args, { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => err.push(d));
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
      }),
    );
    child.stdin.end(input);
  });
}

function limitArgs(l: RunLimits): string[] {
  const args = ["--cpu-ms", String(l.cpuMs)];
  if (l.wallMs !== undefined) args.push("--wall-ms", String(l.wallMs));
  if (l.memoryMb !== undefined) args.push("--mem-mb", String(l.memoryMb));
  if (l.fsizeMb !== undefined) args.push("--fsize-mb", String(l.fsizeMb));
  if (l.stdoutMax !== undefined) args.push("--stdout-max", String(l.stdoutMax));
  if (l.stderrMax !== undefined) args.push("--stderr-max", String(l.stderrMax));
  for (const [k, v] of Object.entries(l.env ?? {})) args.push("--env", `${k}=${v}`);
  return args;
}

function parseRecord(line: string): RunRecord {
  const r = JSON.parse(line);
  return {
    exit: r.exit,
    signal: r.signal,
    timedOut: r.timed_out,
    outputLimit: r.output_limit,
    cpuMs: r.cpu_ms,
    wallMs: r.wall_ms,
    rssKb: r.rss_kb,
    stdout: Buffer.from(r.stdout, "base64"),
    stderr: Buffer.from(r.stderr, "base64"),
    stdoutBytes: r.stdout_bytes,
    stderrBytes: r.stderr_bytes,
  };
}

function frame(input: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`${input.length}\n`), input]);
}

/** A running `kata-run batch` session: send one test, get its record,
 * decide whether to send the next. */
export class BatchSession {
  private readonly lines: AsyncIterator<string>;
  private stderr = "";

  constructor(private readonly proc: ChildProcessWithoutNullStreams) {
    proc.stderr.on("data", (d: Buffer) => {
      this.stderr = (this.stderr + d.toString("utf8")).slice(-4096);
    });
    this.lines = createInterface({ input: proc.stdout, crlfDelay: Infinity })[Symbol.asyncIterator]();
  }

  async run(input: Buffer): Promise<RunRecord> {
    this.proc.stdin.write(frame(input));
    const next = await this.lines.next();
    if (next.done) {
      throw new SandboxError(`kata-run exited unexpectedly: ${this.stderr.trim() || "no output"}`);
    }
    return parseRecord(next.value);
  }

  close(): void {
    this.proc.stdin.end();
  }
}

export class Sandbox {
  private constructor(readonly name: string) {}

  static async create(config: SandboxConfig): Promise<Sandbox> {
    const name = `kata-judge-${randomUUID()}`;
    const args = [
      "run",
      "--detach",
      "--rm",
      "--name",
      name,
      "--label",
      "kata.judge=1",
      "--label",
      `kata.owner=${config.owner}`,
      ...(config.runtime ? ["--runtime", config.runtime] : []),
      "--init",
      "--network",
      "none",
      "--read-only",
      "--tmpfs",
      "/work:rw,exec,nosuid,nodev,size=64m,mode=1777",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777",
      // Staged test inputs; root-only, so tests can't read ahead.
      "--tmpfs",
      "/run/kata:rw,noexec,nosuid,nodev,size=32m,mode=0700",
      "--user",
      "0:0",
      "--cap-drop",
      "ALL",
      "--cap-add",
      "SETUID",
      "--cap-add",
      "SETGID",
      "--cap-add",
      "KILL",
      "--security-opt",
      "no-new-privileges",
      "--pids-limit",
      "128",
      "--memory",
      `${config.memoryMb}m`,
      "--memory-swap",
      `${config.memoryMb}m`,
      "--cpus",
      String(config.cpus),
      "--ulimit",
      "core=0",
      "--log-driver",
      "none",
      config.image,
      "sleep",
      "infinity",
    ];
    const res = await docker(args);
    if (res.code !== 0) throw new SandboxError(`docker run failed: ${res.stderr.trim()}`);
    return new Sandbox(name);
  }

  async putFile(path: string, contents: Buffer, maxBytes: number): Promise<void> {
    const res = await docker(["exec", "-i", this.name, "kata-run", "put", path, String(maxBytes)], contents);
    if (res.code !== 0) throw new SandboxError(`writing ${path} failed: ${res.stderr.trim()}`);
  }

  batch(command: string[], limits: RunLimits): BatchSession {
    const proc = spawn(
      DOCKER,
      ["exec", "-i", this.name, "kata-run", "batch", ...limitArgs(limits), "--", ...command],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    return new BatchSession(proc);
  }

  /** Runs `command` once with empty stdin (compilation). */
  async runOnce(command: string[], limits: RunLimits): Promise<RunRecord> {
    const session = this.batch(command, limits);
    try {
      return await session.run(Buffer.alloc(0));
    } finally {
      session.close();
    }
  }

  async destroy(): Promise<void> {
    await docker(["rm", "--force", this.name]);
  }

  /** Removes containers a previous run of this worker left behind. */
  static async reapOrphans(owner: string): Promise<void> {
    const res = await docker(["ps", "--all", "--quiet", "--filter", `label=kata.owner=${owner}`]);
    const ids = res.stdout.split("\n").filter(Boolean);
    if (ids.length > 0) await docker(["rm", "--force", ...ids]);
  }
}
