"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProgress } from "@/lib/progress-store";

export function ResetProgressDialog() {
  const { resetProgress } = useProgress();

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Reset progress
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset all progress?</DialogTitle>
          <DialogDescription>
            This clears every recorded answer, your accuracy, and your streak.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <DialogClose
            render={<Button variant="destructive" onClick={resetProgress} />}
          >
            Reset
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
