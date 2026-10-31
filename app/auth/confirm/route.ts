import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";

const EMAIL_LINK_TYPES = new Set<EmailOtpType>(["email", "signup", "recovery", "email_change", "invite", "magiclink"]);

/** Target of every auth email (see supabase/templates). Verifies the
 * token_hash server-side and sets the session cookie, so the link works on
 * whatever device it's opened on — the PKCE `code` flow in /auth/callback
 * only works in the browser that started it, which is fine for OAuth but
 * not for email. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const fallback = type === "recovery" ? "/account/password" : "/progress";
  const next = safeRedirectPath(searchParams.get("next"), fallback);

  if (tokenHash && type && EMAIL_LINK_TYPES.has(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}
