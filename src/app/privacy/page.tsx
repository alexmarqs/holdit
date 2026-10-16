import type { Metadata } from "next";
import { PageHead, Section } from "@/components/prose";
import { leafPage } from "@/lib/seo/metadata";
import { publicEnv } from "@/lib/utils/env";

export const metadata: Metadata = leafPage({
  title: "Privacy",
  description:
    "What holdit.lol stores and what it does not. No accounts, no cookies for tracking, no card details, and IP addresses only as salted hashes.",
  path: "/privacy",
});

const CONTACT = (
  <a className="text-primary hover:text-primary/80" href={`mailto:${publicEnv.contactEmail}`}>
    {publicEnv.contactEmail}
  </a>
);

/**
 * Written from the schema rather than from a template. Every claim here is one
 * somebody could check by reading the code, which is the only kind worth
 * making — a generic notice that overstates what is collected is as misleading
 * as one that understates it.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-5 pb-16">
      <PageHead
        title="Privacy"
        lede="Short, because there is not much collected. No accounts, no tracking cookies, and no card details ever reach this site."
      />

      <Section title="What is public">
        <p>
          A square is an advertisement, so everything about it is on the page: the domain, the
          destination, the line under the name, what has been spent, and how many clicks it has had.
          Buying a square is a public act.
        </p>
      </Section>

      <Section title="What is stored about visitors">
        <p>
          Visits and clicks are counted using a salted, one-way hash derived from the
          visitor&rsquo;s address. This lets the site count recent visitors and avoid counting
          repeated clicks without storing the address itself. Basic request details, such as the
          time and referring page, may also be stored. The hash cannot be reversed and is not
          shared.
        </p>
      </Section>

      <Section title="What is not collected">
        <p>
          No accounts, so no passwords. No cookies for advertising or tracking — the only browser
          storage is a note of which square you bought, kept on your own device so it can be marked
          on the wall. No card numbers, no billing addresses: payment happens on Stripe&rsquo;s own
          checkout and this site never sees those details.
        </p>
      </Section>

      <Section title="Who else is involved">
        <p>
          <b>Stripe</b> processes payments. <b>Supabase</b> stores site data, <b>Vercel</b> hosts
          the site, and <b>Upstash</b> helps prevent abuse. These providers handle data under their
          own privacy policies.
        </p>
        <p>
          Square logos may be retrieved through Google&rsquo;s public favicon service for display
          and sharing.
        </p>
      </Section>

      <Section title="Asking for changes">
        <p>
          Write to {CONTACT} to request a change or deletion where possible. Some hashed records
          cannot be connected back to a person. Purchase records are kept for as long as required.
        </p>
      </Section>
    </div>
  );
}
