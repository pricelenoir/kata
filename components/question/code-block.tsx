import { highlightCode, markHighlightedLines } from "@/lib/code-highlight";
import type { CodeSnippet } from "@/types/question";

export async function CodeBlock({ snippet }: { snippet: CodeSnippet }) {
  const raw = await highlightCode(snippet);

  const html = snippet.highlightLines?.length
    ? markHighlightedLines(raw, snippet.highlightLines)
    : raw;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[oklch(0.13_0.006_250)]">
      {snippet.filename && (
        <div className="border-b border-border px-4 py-2 font-mono text-xs text-muted-foreground">
          {snippet.filename}
        </div>
      )}
      <div
        className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed [&_code]:block [&_code]:min-w-max [&_.highlighted-line]:-mx-4 [&_.highlighted-line]:inline-block [&_.highlighted-line]:w-[calc(100%+2rem)] [&_.highlighted-line]:border-l-2 [&_.highlighted-line]:border-brand-sky [&_.highlighted-line]:bg-brand-sky/[0.08] [&_.highlighted-line]:px-4 [&_pre]:m-0 [&_pre]:bg-transparent!"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
