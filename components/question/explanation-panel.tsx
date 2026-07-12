import { InlineText } from "@/components/question/inline-code";

export function ExplanationPanel({
  explanation,
  references,
}: {
  explanation: string;
  references?: string[];
}) {
  return (
    <div className="space-y-3 rounded-lg border border-sky-500/20 bg-sky-500/[0.04] px-5 py-4">
      <h3 className="font-mono text-xs uppercase tracking-wide text-sky-400">
        Explanation
      </h3>
      <p className="text-sm leading-relaxed text-foreground/90">
        <InlineText text={explanation} />
      </p>
      {references && references.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          {references.map((ref) => (
            <a
              key={ref}
              href={ref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {ref.replace(/^https?:\/\//, "")}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
