import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";

/** OAuth (and email-link) redirect target — exchanges the auth code Supabase
 * appends to the URL for a real session cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` is attacker-controllable (it's just a query param on a link), so
  // it must never be able to point the post-login redirect off-site.
  const next = safeRedirectPath(searchParams.get("next"), "/questions");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
