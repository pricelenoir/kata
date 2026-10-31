"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const CONFIRM_WORD = "delete";

export function DeleteAccountDialog() {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setDeleting(false);
      setError(error.message);
      return;
    }
    // The server-side session is already gone with the user; this clears
    // the local cookie and tells the rest of the page.
    await supabase.auth.signOut({ scope: "local" });
    router.push("/");
    router.refresh();
  }

  return (
    <Dialog onOpenChange={() => setTyped("")}>
      <DialogTrigger render={<Button variant="destructive" />}>Delete account</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your account, your answer history, and every code submission. It can&apos;t be
            undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="confirm-delete" className="text-sm text-muted-foreground">
            Type <span className="font-mono text-foreground">{CONFIRM_WORD}</span> to confirm
          </label>
          <Input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" disabled={typed !== CONFIRM_WORD || deleting} onClick={handleDelete}>
            {deleting ? "Deleting…" : "Delete forever"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
