"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { PasswordForm } from "@/components/account/password-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabaseUser } from "@/lib/supabase/use-user";

/** Where a password-reset email lands: /auth/confirm has already signed the
 * user in from the link, so all that's left is choosing the new password. */
export default function NewPasswordPage() {
  const user = useSupabaseUser();
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center space-y-6 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Choose a new password</h1>
        {user === undefined && <Skeleton className="h-40 w-full rounded-lg" />}
        {user === null && (
          <p className="text-sm text-muted-foreground">
            This reset link has expired.{" "}
            <Link href="/login" className="text-brand-sky hover:underline underline-offset-4">
              Request a new one
            </Link>
            .
          </p>
        )}
        {user && <PasswordForm submitLabel="Save password" onDone={() => router.push("/progress")} />}
      </main>
    </div>
  );
}
