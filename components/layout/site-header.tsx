"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthStatus } from "@/components/layout/auth-status";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/questions", label: "Questions" },
  { href: "/coding", label: "Coding" },
  { href: "/progress", label: "Progress" },
] as const;

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-mono font-semibold tracking-tight text-foreground", className)}>
      kata<span className="text-brand-gradient">/</span>
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Link href="/" aria-label="kata home" className="rounded-md">
            <Wordmark className="text-lg" />
          </Link>
          <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-2 py-1.5 transition-colors sm:px-2.5",
                    active
                      ? "bg-foreground/[0.07] text-foreground"
                      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <AuthStatus />
      </div>
    </header>
  );
}
