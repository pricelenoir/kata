import Link from "next/link";
import { ArrowRightIcon, BarChart3Icon, BrainCircuitIcon, TerminalSquareIcon } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { HeroBackdrop } from "@/components/landing/hero-backdrop";
import { CodeBlock } from "@/components/question/code-block";
import { Button } from "@/components/ui/button";
import { getQuestionById, getQuestionsByCategory, getTotalQuestionCount } from "@/lib/questions";
import { CATEGORIES, CATEGORY_META } from "@/types/category";

const FEATURED_QUESTION_ID = "cpp-const-pointer-02";

const FEATURES = [
  {
    icon: BrainCircuitIcon,
    title: "Trace the code",
    body: "Read a snippet and predict what really happens: object lifetimes, memory ordering, syscalls, cache behavior. Every answer comes with a full explanation.",
    href: "/questions",
  },
  {
    icon: TerminalSquareIcon,
    title: "Write real solutions",
    body: "Implement locks, queues, and data structures in C++ or Rust, then run them against hidden tests in a sandbox.",
    href: "/coding",
  },
  {
    icon: BarChart3Icon,
    title: "Know where you stand",
    body: "Accuracy by topic, a review queue of the questions you missed, and a streak to keep you coming back.",
    href: "/progress",
  },
] as const;

export default function LandingPage() {
  const questionCount = getTotalQuestionCount();
  const featured = getQuestionById(FEATURED_QUESTION_ID);

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* ---- Hero ---- */}
        <section className="relative overflow-hidden border-b border-border/70">
          <HeroBackdrop />
          <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-24">
            <div className="space-y-7 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <span aria-hidden className="size-1.5 rounded-full bg-brand-sky" />
                {questionCount} hand-written questions across {CATEGORIES.length} topics
              </p>
              <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
                Train like it&apos;s
                <br />
                the interview.
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
                Deep C++ and systems practice for engineers who want to understand what the machine is actually
                doing, not memorize answers.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  nativeButton={false}
                  render={<Link href="/questions" />}
                  className="h-11 border-0 bg-brand-gradient px-5 text-[15px] font-semibold text-background shadow-[0_8px_30px_-8px] shadow-brand-orange/50 transition-[filter,transform] hover:brightness-110 active:translate-y-px"
                >
                  Start practicing
                  <ArrowRightIcon />
                </Button>
                <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/coding" />} className="h-11 px-5 text-[15px]">
                  Try a coding exercise
                </Button>
              </div>
            </div>

            {featured?.snippet && (
              <div className="relative animate-in fade-in-0 slide-in-from-bottom-3 duration-700 delay-150 fill-mode-both">
                <div
                  aria-hidden
                  className="absolute -inset-6 rounded-[2rem] bg-brand-gradient opacity-[0.12] blur-3xl"
                />
                <figure className="border-brand-gradient relative overflow-hidden rounded-2xl shadow-2xl shadow-black/40">
                  <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
                    <span aria-hidden className="flex gap-1.5">
                      <span className="size-2.5 rounded-full bg-foreground/15" />
                      <span className="size-2.5 rounded-full bg-foreground/15" />
                      <span className="size-2.5 rounded-full bg-foreground/15" />
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">{CATEGORY_META[featured.category].label}</span>
                  </div>
                  <div className="space-y-4 p-5">
                    <figcaption className="text-[15px] font-medium text-foreground">{featured.prompt}</figcaption>
                    <CodeBlock snippet={featured.snippet} />
                    <Link
                      href={`/questions/${featured.category}/${featured.id}`}
                      className="group inline-flex items-center gap-1.5 text-sm font-medium text-brand-sky"
                    >
                      Answer this question
                      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </figure>
              </div>
            )}
          </div>
        </section>

        {/* ---- What you do here ---- */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-foreground">
            Practice the parts of an interview that are hard to fake.
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body, href }) => (
              <Link key={title} href={href} className="group space-y-3 rounded-lg">
                <span className="grid size-10 place-items-center rounded-lg border border-border bg-card text-brand-sky transition-colors group-hover:border-brand-sky/40">
                  <Icon className="size-5" />
                </span>
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ---- Topics ---- */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">Topics</h2>
              <p className="text-muted-foreground">Pick one to focus on, or mix them all.</p>
            </div>
            <Link href="/questions" className="text-sm font-medium text-brand-sky hover:underline underline-offset-4">
              Browse all questions
            </Link>
          </div>
          <ul className="mt-8 grid overflow-hidden rounded-2xl border border-border bg-card/40 sm:grid-cols-2">
            {CATEGORIES.map((id) => {
              const meta = CATEGORY_META[id];
              return (
                <li key={id} className="border-border/70 [&:not(:last-child)]:border-b sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                  <Link
                    href={`/questions?category=${id}`}
                    className="group flex h-full items-start justify-between gap-6 px-6 py-5 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <span className="space-y-1">
                      <span className="block font-medium text-foreground">{meta.label}</span>
                      <span className="block text-sm leading-relaxed text-muted-foreground">{meta.description}</span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground transition-colors group-hover:text-foreground">
                      {getQuestionsByCategory(id).length}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ---- Closing CTA ---- */}
        <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-border px-8 py-14 text-center sm:px-16">
            <div aria-hidden className="hero-glow pointer-events-none absolute inset-0 opacity-80" />
            <div className="relative mx-auto max-w-xl space-y-5">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Your next interview won&apos;t be multiple choice.
              </h2>
              <p className="text-muted-foreground">
                But knowing why each wrong answer is wrong is how you get there. Start with one question.
              </p>
              <Button
                size="lg"
                nativeButton={false}
                render={<Link href="/questions" />}
                className="h-11 px-5 text-[15px] border-0 bg-brand-sky font-semibold text-background hover:bg-brand-sky/90"
              >
                Start practicing
                <ArrowRightIcon />
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
