import { CheckIcon, XIcon } from "lucide-react";

export function StatusDot({ status }: { status?: "correct" | "incorrect" }) {
  if (!status) return null;

  if (status === "correct") {
    return (
      <span
        title="Answered correctly"
        className="flex size-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
      >
        <CheckIcon className="size-3" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      title="Answered incorrectly"
      className="flex size-4 items-center justify-center rounded-full bg-red-500/15 text-red-400"
    >
      <XIcon className="size-3" strokeWidth={3} />
    </span>
  );
}
