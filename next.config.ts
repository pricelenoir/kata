import type { NextConfig } from "next";

// Headers for every response. There's no full Content-Security-Policy for
// scripts yet: Next's inline bootstrap scripts need per-request nonces, which
// would make every page dynamic. These directives don't depend on that.
const SECURITY_HEADERS = [
  // Nothing may frame the site (clickjacking: /account has a delete button).
  // frame-ancestors is the modern form; X-Frame-Options covers old browsers.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
