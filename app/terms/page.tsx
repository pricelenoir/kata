import type { Metadata } from "next";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <ProsePage title="Terms" updated="October 31, 2026">
      <section>
        <h2>Using kata</h2>
        <p>
          kata is a free study tool, provided as is, without warranties of any kind. Explanations and judge
          results aim to be correct but can contain mistakes. Please report them.
        </p>
      </section>
      <section>
        <h2>Running code</h2>
        <p>The code runner is shared, so please don&apos;t use it to:</p>
        <ul>
          <li>try to escape the sandbox or reach other systems,</li>
          <li>mine cryptocurrency or run anything unrelated to the exercises,</li>
          <li>flood the service, or get around rate limits with extra accounts.</li>
        </ul>
        <p>Accounts that do may be limited or removed, along with their submissions.</p>
      </section>
      <section>
        <h2>Your code</h2>
        <p>
          Code you write is yours. Submitting it lets kata store and run it to judge it and to show you your
          history.
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <p>You can delete it at any time from the Account page.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>If these terms change, the date above will too.</p>
      </section>
    </ProsePage>
  );
}
