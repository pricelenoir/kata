"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseUser } from "@/lib/supabase/use-user";

export function AuthStatus() {
  const user = useSupabaseUser();
  const router = useRouter();

  if (user === undefined) {
    // Auth state not resolved yet — reserve no space, avoids a flash.
    return null;
  }

  if (user === null) {
    return (
      <Link href="/login" className="transition-colors hover:text-foreground">
        Log in
      </Link>
    );
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/account" className="transition-colors hover:text-foreground">
        <span className="hidden font-mono text-xs sm:inline">{user.email}</span>
        <span className="sm:hidden">Account</span>
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        className="transition-colors hover:text-foreground"
      >
        Log out
      </button>
    </div>
  );
}
