import { MIN_SPEND_CENTS } from "@holdit/core";
import { PageHead, Section } from "@/components/prose";
import { leafPage } from "@/lib/seo/metadata";
import { publicEnv } from "@/lib/utils/env";
import { formatMoney } from "@/lib/utils/format";

export const metadata = leafPage({
  title: "Terms",
  description:
    "What you get when you buy a square on holdit.lol, what it costs, how live spend fades, and what is not allowed.",
  path: "/terms",
});

const CONTACT = (
  <a className="text-primary hover:text-primary/80" href={`mailto:${publicEnv.contactEmail}`}>
    {publicEnv.contactEmail}
  </a>
);

/**
 * The commercial half of /rules, said in the register a payment processor and a
 * buyer both need. /rules explains how the wall works; this says what is being
 * sold, by whom, and on what conditions. Deliberately consistent with it — two
 * documents that contradict each other are worse than one.
 */
export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-5 pb-16">
      <PageHead
        title="Terms"
        lede="What you are buying, what it costs, and what will get it taken down. The mechanics are on the rules page; this is the agreement."
      />

      <Section title="What you are buying">
        <p>
          Space on one shared page. A square&rsquo;s share depends on its live spend compared with
          everyone else&rsquo;s, and live spend loses weight over time. New purchases and other
          changes to the wall can change a square&rsquo;s share, position, and appearance. Visual
          area is illustrative and may not exactly match the numeric share.
        </p>
        <p>
          You are not buying a fixed position, guaranteed size, duration, or amount of traffic. The
          share shown before payment is an estimate based on the wall at that moment. The rules page
          explains the mechanics in more detail.
        </p>
        <p>
          The smallest purchase is {formatMoney(MIN_SPEND_CENTS)}. Prices are in US dollars and
          payment is handled by Stripe; this site never receives your card details.
        </p>
      </Section>

      <Section title="What you promise about your square">
        <p>
          That you may lawfully advertise the thing you are linking to, and that the destination is
          the thing it appears to be. A destination is fixed when you buy it and cannot be repointed
          by topping up.
        </p>
      </Section>

      <Section title="What gets taken down">
        <p>
          Sexual content, anything NSFW or an adult platform; chat and invite links; malware and
          scams; and link shorteners, since the destination has to be the thing we can see. Squares
          come down when we find them or when somebody reports one to {CONTACT}.
        </p>
        <p>
          We may remove a square for any of these reasons without notice. We do not review squares
          before they appear — waiting a day to go up would defeat the point.
        </p>
      </Section>

      <Section title="The unglamorous part">
        <p>
          The site is provided as it is, without warranty. It may change, break, or stop. Nothing
          here is worth more than what you spent on it, and that is the limit of what can be
          claimed.
        </p>
        <p>These terms may change. The version on this page is the one that applies.</p>
      </Section>
    </div>
  );
}
