import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/** Browser-side Supabase client — safe to call repeatedly, @supabase/ssr
 * memoizes the underlying client per page load. */
export function createClient() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_KEY,
  );
}
