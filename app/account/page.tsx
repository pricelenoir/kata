"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { PasswordForm } from "@/components/account/password-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseUser } from "@/lib/supabase/use-user";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border/60 pt-6">
      <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function AccountPage() {
  const user = useSupabaseUser();
  const router = useRouter();
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function signOutEverywhere() {
    await createClient().auth.signOut({ scope: "global" });
    router.push("/");
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 space-y-8 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Account</h1>

        {user === undefined && <Skeleton className="h-40 w-full rounded-lg" />}

        {user === null && (
          <p className="text-sm text-muted-foreground">
            <Link href="/login?next=/account" className="text-sky-400 hover:text-sky-300">
              Log in
            </Link>{" "}
            to manage your account.
          </p>
        )}

        {user && (
          <>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-foreground">{user.email}</dd>
              <dt className="text-muted-foreground">Signs in with</dt>
              <dd className="text-foreground">
                {((user.app_metadata.providers as string[] | undefined) ?? ["email"])
                  .map((p) => (p === "email" ? "email & password" : p === "github" ? "GitHub" : p))
                  .join(", ")}
              </dd>
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="text-foreground">{new Date(user.created_at).toLocaleDateString()}</dd>
            </dl>

            <Section title="Password">
              {passwordSaved ? (
                <p className="text-sm text-emerald-400">Password updated.</p>
              ) : (
                <PasswordForm submitLabel="Update password" onDone={() => setPasswordSaved(true)} />
              )}
            </Section>

            <Section title="Sessions">
              <p className="text-sm text-muted-foreground">Signs you out on every device, including this one.</p>
              <Button variant="outline" onClick={signOutEverywhere}>
                Sign out everywhere
              </Button>
            </Section>

            <Section title="Danger zone">
              <p className="text-sm text-muted-foreground">
                Deletes your account and everything stored with it: answer history, streaks, and code submissions.
              </p>
              <DeleteAccountDialog />
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
