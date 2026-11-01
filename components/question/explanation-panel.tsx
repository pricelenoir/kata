import { InlineText } from "@/components/question/inline-code";

export function ExplanationPanel({
  explanation,
  references,
}: {
  explanation: string;
  references?: string[];
}) {
  return (
    <div className="relative space-y-3 overflow-hidden rounded-xl surface py-5 pl-6 pr-5 animate-in fade-in-0 slide-in-from-top-1 duration-300">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand-sky" />
      <h3 className="text-sm font-semibold text-foreground">Why</h3>
      <p className="text-[15px] leading-relaxed text-foreground/85">
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
