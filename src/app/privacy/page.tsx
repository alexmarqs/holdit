import { CLICK_DEDUPE_WINDOW_MS } from "@holdit/core";
import { PageHead, Section } from "@/components/prose";
import { leafPage } from "@/lib/seo/metadata";
import { publicEnv } from "@/lib/utils/env";

export const metadata = leafPage({
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
          Two things, both one-way hashed with a secret salt before they are written: a <b>visit</b>
          , so the site can say how many people are here, and a <b>click</b>, so a square can be
          told how much traffic it received. Each row holds the hash, a timestamp, the referring
          page, and whether the request looked like a browser or a bot.
        </p>
        <p>
          The hash is what makes one click per address per{" "}
          {Math.round(CLICK_DEDUPE_WINDOW_MS / 60_000)} minutes countable without keeping the
          address. There is no way to read an IP back out of it, and it is never shared.
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
          <b>Stripe</b> processes payments and holds whatever you give their checkout, under their
          own privacy policy. <b>Supabase</b> hosts the database and <b>Vercel</b> serves the site.
          <b>Upstash</b> holds rate-limit counters keyed by a hash of your address, for a few
          minutes at a time.
        </p>
        <p>
          Square logos on the wall are loaded from Google&rsquo;s public favicon service in the
          browser. A downloaded PNG and a share card fetch the same files on the server (`GET
          /api/favicons/…`, and OG in-process) so those images can be painted without Google&rsquo;s
          CORS headers.
        </p>
      </Section>

      <Section title="Asking for changes">
        <p>
          Write to {CONTACT}. A square can be taken down, and a click or visit record can be
          deleted, though a hashed record cannot be looked up by an address — you would need to say
          which square. Purchase records are kept as long as the payment record has to be.
        </p>
      </Section>
    </div>
  );
}
