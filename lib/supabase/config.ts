// Read through literal `process.env.NEXT_PUBLIC_*` accesses so Next.js
// inlines them into the browser bundle at build time.

// `||`, not `??`: unused keys are often left blank (`KEY=`) in env files.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

/** The browser-safe API key. The Vercel ⇄ Supabase integration syncs it as
 * the newer PUBLISHABLE_KEY, the older ANON_KEY, or both, depending on its
 * version; either works. */
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

/** True once real Supabase credentials are in the environment. Auth-adjacent
 * code (the proxy's session refresh, the client-side user hook) checks this
 * first and no-ops instead of throwing, so the app is still fully usable
 * (as an anonymous, localStorage-only experience) before `.env.local` is
 * set up. */
export function hasSupabaseConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}
