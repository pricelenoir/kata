import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseConfig, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/** Refreshes the Supabase session cookie on every request. Server
 * Components can't write cookies themselves (see server.ts), so this is
 * the only place an expired access token actually gets renewed. */
export async function updateSession(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() (not getSession()) — it verifies the JWT signature instead
  // of trusting whatever's in the cookie, and refreshes an expired session.
  // With asymmetric signing keys it verifies locally against the cached
  // JWKS, so unlike getUser() it isn't an Auth server round trip on every
  // page request (projects still on a legacy shared secret fall back to one).
  await supabase.auth.getClaims();

  return response;
}
