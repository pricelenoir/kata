import { createBrowserClient } from "@supabase/ssr";

/** Browser-side Supabase client — safe to call repeatedly, @supabase/ssr
 * memoizes the underlying client per page load. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
