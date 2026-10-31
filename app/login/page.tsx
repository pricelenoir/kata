"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Captcha, CAPTCHA_SITE_KEY, type CaptchaHandle } from "@/components/auth/captcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/safe-redirect";

type Mode = "sign-in" | "sign-up" | "reset";

const MIN_PASSWORD_LENGTH = 8;

const TITLES: Record<Mode, { title: string; blurb: string }> = {
  "sign-in": { title: "Log in", blurb: "Sync your progress across devices." },
  "sign-up": { title: "Create an account", blurb: "Your progress stays local until you have an account." },
  reset: { title: "Reset your password", blurb: "We'll email you a link to choose a new one." },
};

/** Where to land after logging in — read at submit time (not with
 * useSearchParams) so the page can stay statically rendered. */
function nextPath(): string {
  return safeRedirectPath(new URLSearchParams(window.location.search).get("next"), "/progress");
}

function callbackUrl(): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}`;
}

const LINK_ERRORS: Record<string, string> = {
  link: "That link is invalid or has expired. Request a new one below.",
  auth: "Sign-in didn't complete. Please try again.",
};

/** Errors handed back by /auth/callback and /auth/confirm. Isolated behind
 * Suspense because useSearchParams would otherwise opt the whole page out
 * of static rendering. */
function LinkError() {
  const code = useSearchParams().get("error");
  const message = code ? LINK_ERRORS[code] : undefined;
  if (!message) return null;
  return (
    <p role="alert" className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </p>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<{ email: string; kind: "confirm" | "reset" } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSentTo(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (CAPTCHA_SITE_KEY && !captchaToken) {
      setError("Complete the check above first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSentTo(null);

    const supabase = createClient();
    const captchaOptions = captchaToken ? { captchaToken } : {};
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, captchaOptions);
        if (error) setError(error.message);
        // Same message whether or not the account exists, so this form
        // can't be used to find out who has one.
        else setSentTo({ email, kind: "reset" });
        return;
      }

      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password, options: captchaOptions });
        if (error) setError(error.message);
        else router.push(nextPath());
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl(), ...captchaOptions },
      });
      if (error) setError(error.message);
      // Email confirmation on (the default for hosted projects): no session yet.
      else if (!data.session) setSentTo({ email, kind: "confirm" });
      else router.push(nextPath());
    } finally {
      setSubmitting(false);
      captcha.current?.reset();
    }
  }

  async function handleGitHub() {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: callbackUrl() },
    });
    if (error) setError(error.message);
  }

  const { title, blurb } = TITLES[mode];

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <SiteHeader />
      <div aria-hidden className="hero-glow pointer-events-none absolute inset-x-0 top-14 h-[28rem] opacity-70" />
      <main className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
        <h1 className="relative text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{blurb}</p>

        <Suspense fallback={null}>
          <LinkError />
        </Suspense>

        {mode !== "reset" && (
          <div className="mt-6 flex items-center gap-1">
            {(["sign-in", "sign-up"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={mode === m ? "secondary" : "ghost"}
                onClick={() => switchMode(m)}
                className="text-sm"
              >
                {m === "sign-in" ? "sign in" : "sign up"}
              </Button>
            ))}
          </div>
        )}

        {sentTo ? (
          <p className="mt-6 rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
            {sentTo.kind === "confirm" ? (
              <>
                Check <span className="text-foreground">{sentTo.email}</span> for a confirmation link. It works on
                any device.
              </>
            ) : (
              <>
                If <span className="text-foreground">{sentTo.email}</span> has an account, a reset link is on its
                way.
              </>
            )}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
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
            {mode !== "reset" && (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-foreground"
                  >
                    Password
                  </label>
                  {mode === "sign-in" && (
                    <button
                      type="button"
                      onClick={() => switchMode("reset")}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  required
                  // Existing accounts may predate the 8-character minimum.
                  minLength={mode === "sign-up" ? MIN_PASSWORD_LENGTH : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === "sign-up" && (
                  <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
                )}
              </div>
            )}

            <Captcha ref={captcha} onToken={setCaptchaToken} />

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting} className="h-10 w-full border-0 bg-brand-sky font-semibold text-background hover:bg-brand-sky/90">
              {submitting
                ? "Working…"
                : mode === "sign-in"
                  ? "Log in"
                  : mode === "sign-up"
                    ? "Create account"
                    : "Send reset link"}
            </Button>
          </form>
        )}

        {mode === "reset" ? (
          <button
            type="button"
            onClick={() => switchMode("sign-in")}
            className="mt-6 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr; Back to log in
          </button>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <Button type="button" variant="outline" className="mt-6 w-full" onClick={handleGitHub}>
              Continue with GitHub
            </Button>
          </>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          By continuing you agree to the{" "}
          <Link href="/terms" className="underline-offset-2 hover:text-foreground hover:underline">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
