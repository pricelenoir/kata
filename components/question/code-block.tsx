import { highlightCode, markHighlightedLines } from "@/lib/code-highlight";
import type { CodeSnippet } from "@/types/question";

export async function CodeBlock({ snippet }: { snippet: CodeSnippet }) {
  const raw = await highlightCode(snippet);

  const html = snippet.highlightLines?.length
    ? markHighlightedLines(raw, snippet.highlightLines)
    : raw;

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-[#121212]">
      {snippet.filename && (
        <div className="border-b border-border/60 px-4 py-2 font-mono text-xs text-muted-foreground">
          {snippet.filename}
        </div>
      )}
      <div
        className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed [&_.highlighted-line]:-mx-4 [&_.highlighted-line]:border-l-2 [&_.highlighted-line]:border-sky-400 [&_.highlighted-line]:bg-sky-500/10 [&_.highlighted-line]:px-4 [&_pre]:m-0 [&_pre]:bg-transparent!"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
