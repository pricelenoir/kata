import type { Metadata } from "next";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy" updated="October 31, 2026">
      <section>
        <h2>Without an account</h2>
        <p>
          Your answers, streaks, and code drafts are kept in your browser&apos;s local storage. They never leave
          your device.
        </p>
      </section>
      <section>
        <h2>With an account</h2>
        <p>kata stores:</p>
        <ul>
          <li>Your email address, and your GitHub profile basics if you sign in with GitHub.</li>
          <li>Your answer history: which questions you answered, whether you got them right, and when.</li>
          <li>Code you run or submit, with its results.</li>
        </ul>
        <p>None of it is sold or shared, and nothing is used for advertising.</p>
      </section>
      <section>
        <h2>Running code</h2>
        <p>
          Code you submit is compiled and run in an isolated sandbox with no network access, then discarded. The
          source and results are kept with your account so you can see your history.
        </p>
      </section>
      <section>
        <h2>Services kata uses</h2>
        <ul>
          <li>Supabase, for accounts and the database.</li>
          <li>Vercel, for hosting, plus Vercel Web Analytics for aggregate page-view counts (no cookies).</li>
        </ul>
        <p>The only cookie kata sets is the one that keeps you signed in.</p>
      </section>
      <section>
        <h2>Deleting your data</h2>
        <p>
          Delete your account from the Account page. That permanently removes your account, answer history, and
          submissions.
        </p>
      </section>
      <section>
        <h2>Questions</h2>
        <p>
          Open an issue on{" "}
          <a href="https://github.com/pricelenoir/kata/issues" className="text-brand-sky hover:underline underline-offset-4">
            GitHub
          </a>
          .
        </p>
      </section>
    </ProsePage>
  );
}
