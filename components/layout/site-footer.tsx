import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-5 text-xs text-muted-foreground">
        <span className="font-mono">kata/</span>
        <nav className="flex items-center gap-4">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <a
            href="https://github.com/pricelenoir/kata/issues"
            className="transition-colors hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            Report an issue
          </a>
        </nav>
      </div>
    </footer>
  );
}
