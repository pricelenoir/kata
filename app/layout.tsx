import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteFooter } from "@/components/layout/site-footer";
import { SyncErrorNotice } from "@/components/progress/sync-error-notice";
import { ProgressProvider } from "@/lib/progress-store";
import { getQuestionIdsByCategory } from "@/lib/questions";
import "./globals.css";

const fontSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "kata", template: "%s · kata" },
  description:
    "Predict the output. Trace like the compiler would. C++, OS, concurrency, and networking drills.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <ProgressProvider questionIds={getQuestionIdsByCategory()}>
            {children}
            <SiteFooter />
            <SyncErrorNotice />
          </ProgressProvider>
        </TooltipProvider>
        <Analytics />
      </body>
    </html>
  );
}
