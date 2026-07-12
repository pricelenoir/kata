const TOKEN_RE = /(`[^`]+`|\*[^*]+\*)/g;

/** Renders `code` spans and *emphasis* spans found in plain explanation/prompt text. */
export function InlineText({ text }: { text: string }) {
  const parts = text.split(TOKEN_RE).filter(Boolean);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 1) {
          return (
            <em key={i} className="text-foreground not-italic font-medium">
              {part.slice(1, -1)}
            </em>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
