"use client";

import { TriangleAlertIcon, XIcon } from "lucide-react";
import { useProgress } from "@/lib/progress-store";

export function SyncErrorNotice() {
  const { syncError, dismissSyncError } = useProgress();
  if (!syncError) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-lg border border-amber-500/40 bg-background px-4 py-3 text-sm shadow-lg"
    >
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-400" />
      <p className="flex-1 text-foreground">{syncError}</p>
      <button
        type="button"
        onClick={dismissSyncError}
        aria-label="Dismiss"
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
