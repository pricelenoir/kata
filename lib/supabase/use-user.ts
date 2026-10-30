"use client";

import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

// One module-level auth subscription shared by every caller, instead of a
// getUser() round trip + onAuthStateChange listener per mounted component.
// Started lazily by the first subscriber and kept for the page's lifetime.

/** undefined = auth state not yet known, null = signed out. */
type AuthSnapshot = User | null | undefined;

const INITIAL: AuthSnapshot = hasSupabaseConfig() ? undefined : null;

let currentUser: AuthSnapshot = INITIAL;
let started = false;
const listeners = new Set<() => void>();

function setUser(user: User | null): void {
  currentUser = user;
  listeners.forEach((l) => l());
}

function start(): void {
  if (started || !hasSupabaseConfig()) return;
  started = true;
  const supabase = createClient();
  // getUser() revalidates against Supabase rather than trusting the local
  // session, so it's the authoritative answer once it resolves.
  supabase.auth.getUser().then(({ data }) => setUser(data.user));
  supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
  });
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  start();
  return () => listeners.delete(onChange);
}

function getSnapshot(): AuthSnapshot {
  return currentUser;
}

function getServerSnapshot(): AuthSnapshot {
  return INITIAL;
}

export function useSupabaseUser(): AuthSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
