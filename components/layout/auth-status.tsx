"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseUser } from "@/lib/supabase/use-user";

export function AuthStatus() {
  const user = useSupabaseUser();
  const router = useRouter();

  if (user === undefined) {
    // Auth state not resolved yet: hold the space so the header doesn't jump.
    return <div className="h-8 w-16" aria-hidden />;
  }

  if (user === null) {
    return (
      <Button size="sm" nativeButton={false} render={<Link href="/login" />}>
        Log in
      </Button>
    );
  }

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/");
  }

  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href="/account"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
      >
        <span
          aria-hidden
          className="grid size-6 place-items-center rounded-full bg-brand-sky text-[11px] font-semibold text-background"
        >
          {initial}
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{user.email}</span>
        <span className="sm:hidden">Account</span>
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        Log out
      </button>
    </div>
  );
}
