"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

/** Sets the signed-in user's password — also how an OAuth-only account adds
 * one, and the landing step of a password-reset link. */
export function PasswordForm({ submitLabel, onDone }: { submitLabel: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPassword("");
    setConfirm("");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="new-password" className="text-sm font-medium text-foreground">
          New password
        </label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
          Confirm new password
        </label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
