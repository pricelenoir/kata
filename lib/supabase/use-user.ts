"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

/** undefined = auth state not yet known, null = signed out. */
export function useSupabaseUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(() =>
    hasSupabaseConfig() ? undefined : null,
  );

  useEffect(() => {
    if (!hasSupabaseConfig()) return;

    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  return user;
}
