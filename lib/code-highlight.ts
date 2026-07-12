import { codeToHtml, codeToTokens } from "shiki";
import { KATA_SHIKI_THEME } from "@/lib/shiki-theme";
import type { CodeSnippet } from "@/types/question";

export async function highlightCode(snippet: CodeSnippet): Promise<string> {
  return codeToHtml(snippet.code, {
    lang: snippet.language === "text" ? "text" : snippet.language,
    theme: KATA_SHIKI_THEME,
  });
}

export function markHighlightedLines(html: string, lines: number[]): string {
  const set = new Set(lines);
  let i = 0;
  return html.replace(/<span class="line">/g, () => {
    i += 1;
    return set.has(i)
      ? '<span class="line highlighted-line">'
      : '<span class="line">';
  });
}

export interface HighlightedToken {
  content: string;
  color?: string;
}

/**
 * Line-by-line colored tokens (no HTML), for callers that need to compose
 * the highlighted code as real React children — e.g. splicing in <input>
 * elements for fill-in-the-blank markers — rather than raw innerHTML.
 */
export async function tokenizeCode(
  snippet: CodeSnippet,
): Promise<HighlightedToken[][]> {
  const { tokens } = await codeToTokens(snippet.code, {
    lang: snippet.language === "text" ? "text" : snippet.language,
    theme: KATA_SHIKI_THEME,
  });
  return tokens.map((line) =>
    line.map((t) => ({ content: t.content, color: t.color })),
  );
}
