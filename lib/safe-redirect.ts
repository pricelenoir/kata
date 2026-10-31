const PLACEHOLDER_ORIGIN = "http://placeholder.invalid";

/** Turns an untrusted `next`-style redirect target into a same-origin path.
 * Anything that would resolve to a different host — protocol-relative
 * (`//evil.com`), backslash tricks (`/\evil.com`, which URL parsers treat as
 * `//`), userinfo (`@evil.com`), or absolute URLs — falls back instead.
 * Resolving against a throwaway origin and comparing origins, rather than
 * pattern-matching the string, is what makes this robust to parser quirks. */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback: string,
): string {
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const url = new URL(next, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
