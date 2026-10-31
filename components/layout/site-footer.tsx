import Link from "next/link";
import { Wordmark } from "@/components/layout/site-header";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1.5">
          <Wordmark />
          <p className="text-sm text-muted-foreground">Interview prep for C++ and systems engineers.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/questions" className="transition-colors hover:text-foreground">
            Questions
          </Link>
          <Link href="/coding" className="transition-colors hover:text-foreground">
            Coding
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <a
            href="https://github.com/pricelenoir/kata/issues"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Report an issue
          </a>
        </nav>
      </div>
    </footer>
  );
}
