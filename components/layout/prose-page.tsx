import { SiteHeader } from "@/components/layout/site-header";

/** Plain long-form page (privacy, terms). */
export function ProsePage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:mb-2 [&_h2]:font-medium [&_h2]:text-foreground [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </main>
    </div>
  );
}
