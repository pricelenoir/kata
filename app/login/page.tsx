"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setCheckEmail(false);

    const supabase = createClient();

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setSubmitting(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/progress");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data.session) {
      // Email confirmation is on (the Supabase default) — no session yet.
      setCheckEmail(true);
      return;
    }
    router.push("/progress");
  }

  async function handleGitHub() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {mode === "sign-in" ? "Log in" : "Create an account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "sign-in"
            ? "Sync your progress across devices."
            : "Your progress stays local until you have an account."}
        </p>

        <div className="mt-6 flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "sign-in" ? "secondary" : "ghost"}
            onClick={() => {
              setMode("sign-in");
              setError(null);
              setCheckEmail(false);
            }}
            className="font-mono text-xs"
          >
            sign in
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "sign-up" ? "secondary" : "ghost"}
            onClick={() => {
              setMode("sign-up");
              setError(null);
              setCheckEmail(false);
            }}
            className="font-mono text-xs"
          >
            sign up
          </Button>
        </div>

        {checkEmail ? (
          <p className="mt-6 rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
            Check <span className="text-foreground">{email}</span> for a
            confirmation link, then come back and sign in.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
              >
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting
                ? "Working…"
                : mode === "sign-in"
                  ? "Log in"
                  : "Create account"}
            </Button>
          </form>
        )}

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border/60" />
          <span className="font-mono text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full"
          onClick={handleGitHub}
        >
          Continue with GitHub
        </Button>

        <Link
          href="/"
          className="mt-8 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; back to kata
        </Link>
      </main>
    </div>
  );
}
