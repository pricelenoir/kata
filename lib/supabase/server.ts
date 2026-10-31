import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/** Server-side Supabase client for Server Components, Route Handlers, and
 * Server Actions — reads/writes the session via Next.js's cookie store. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Called from a Server Component sometimes throws — safe to
          // ignore there because middleware also refreshes the session
          // and rewrites cookies on every request.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // no-op, see comment above
          }
        },
      },
    },
  );
}
