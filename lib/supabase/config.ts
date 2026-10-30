/** True once real Supabase credentials are in the environment. Auth-adjacent
 * code (the proxy's session refresh, the client-side user hook) checks this
 * first and no-ops instead of throwing, so the app is still fully usable
 * (as an anonymous, localStorage-only experience) before `.env.local` is
 * set up. */
export function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
