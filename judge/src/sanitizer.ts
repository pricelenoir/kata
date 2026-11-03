// Turns a sanitizer's raw stderr into something a person reads: the report
// itself (not the program's own output around it), with the frames that
// point into the standard library, the sanitizer runtime, or libc dropped,
// and build ids / module offsets stripped.

export interface SanitizerReport {
  /** One line, e.g. "ThreadSanitizer: data race solution.cpp:14 in SpinLock::unlock()". */
  summary: string;
  report: string;
  /** stderr with the report cut out: what the program printed itself. */
  rest: string;
}

const REPORT_LIMIT = 12 * 1024;

/** Where a report begins: TSan's "WARNING: ThreadSanitizer: …", ASan/LSan's
 * "==12==ERROR: AddressSanitizer: …", or UBSan's "file:line:col: runtime error: …". */
const START = /^(?:==\d+==)?(?:WARNING|ERROR): (?:ThreadSanitizer|AddressSanitizer|LeakSanitizer|UndefinedBehaviorSanitizer)\b|^\S+:\d+(?::\d+)?: runtime error: /;
const SUMMARY = /^SUMMARY: (.*)$/;
const UB_LINE = /^(\S+:\d+(?::\d+)?): runtime error: (.*)$/;
const RULE = /^=+$/;

/** A stack frame line: "    #3 0xaaaa… in foo() file:line (module+0x12)" or TSan's
 * "    #3 foo() file:line (module+0x12)". */
const FRAME = /^\s*#\d+ /;

/** Frames that only ever point at plumbing: libstdc++'s headers (std::thread,
 * std::function, invoke), the sanitizer runtime, libc, and unsymbolized code. */
const NOISE = [
  /\/usr\/include\//,
  /\/src\/libsanitizer\//,
  /\blib(?:c|stdc\+\+|tsan|asan|ubsan|lsan|gcc_s|m)\.so/,
  /<null> <null>/,
  /#\d+ (?:in )?_start\b|\(\/work\/main[^)]*\)$/,
  /__libc_start/,
];

function cleanLine(line: string): string {
  return line
    .replace(/ \(BuildId: [0-9a-f]+\)/g, "")
    .replace(/ \((?:\/work\/)?main(?:-\w+)?\+0x[0-9a-f]+\)/g, "")
    .replace(/ \(pid=\d+\)/g, "")
    .replace(/^==\d+==/, "")
    .replace(/ 0x[0-9a-f]+ in /, " ")
    .replace(/\/work\//g, "");
}

/** Lines that carry nothing for a reader (TSan's placeholder for a stack
 * location it couldn't name). */
const JUNK = [/^\s*Location is global '<null>'/];

/** Drops plumbing frames from each stack. A stack that's all plumbing
 * (typically "Thread T1 created by main thread at: pthread_create …") goes
 * entirely, and its heading stops promising a trace. */
function pruneFrames(lines: string[]): string[] {
  const out: string[] = [];
  let stack: string[] = [];
  const flush = () => {
    if (stack.length === 0) return;
    const kept = stack.filter((f) => !NOISE.some((re) => re.test(f)));
    if (kept.length > 0) out.push(...kept);
    else if (out.length > 0) out[out.length - 1] = out[out.length - 1].replace(/ at:$/, ".");
    stack = [];
  };
  for (const line of lines) {
    if (FRAME.test(line)) {
      stack.push(line);
    } else {
      flush();
      out.push(line);
    }
  }
  flush();
  return out;
}

export function parseSanitizerReport(stderr: string): SanitizerReport | null {
  const lines = stderr.split("\n");
  let start = lines.findIndex((l) => START.test(l));
  if (start < 0) return null;
  // TSan opens with a rule of "=" above the WARNING line.
  if (start > 0 && RULE.test(lines[start - 1])) start--;

  let end = lines.findIndex((l, i) => i > start && SUMMARY.test(l));
  if (end < 0) end = lines.length - 1;
  // TSan closes with another rule.
  const close = end + 1 < lines.length && RULE.test(lines[end + 1]) ? end + 1 : end;

  const summaryMatch = SUMMARY.exec(lines[end]);
  const firstLine = cleanLine(lines[start + (RULE.test(lines[start]) ? 1 : 0)]);
  // UBSan's own first line says more than its SUMMARY ("undefined-behavior
  // file:line"), and halting UBSan often prints no SUMMARY at all.
  const ub = UB_LINE.exec(firstLine);
  const summary = ub
    ? `UndefinedBehaviorSanitizer: ${ub[2]} (${ub[1]})`
    : cleanLine(summaryMatch ? summaryMatch[1] : firstLine.replace(/^(?:WARNING|ERROR): /, "")).trim();

  const body = pruneFrames(lines.slice(start, close + 1).map(cleanLine))
    .filter((l) => !RULE.test(l) && !JUNK.some((re) => re.test(l)))
    .join("\n")
    // Blank runs left behind by dropped frames.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const report = body.length > REPORT_LIMIT ? `${body.slice(0, REPORT_LIMIT)}\n… (report truncated)` : body;

  const rest = [...lines.slice(0, start), ...lines.slice(close + 1)]
    .filter((l) => !/^ThreadSanitizer: reported \d+ warnings?$/.test(l) && !/^==\d+==ABORTING$/.test(l))
    .join("\n")
    .trim();
  return { summary, report, rest };
}
