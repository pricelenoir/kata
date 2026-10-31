"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthStatus } from "@/components/layout/auth-status";

const NAV_ITEMS = [
  { href: "/questions", label: "Questions" },
  { href: "/coding", label: "Coding" },
  { href: "/progress", label: "Progress" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border/60">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-mono text-xl font-semibold tracking-tight text-foreground">
            kata<span className="text-sky-400">/</span>
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "text-sky-400"
                    : "transition-colors hover:text-foreground"
                }
              >
                {item.label}
              </Link>
            );
          })}
          <AuthStatus />
        </nav>
      </div>
    </header>
  );
}
