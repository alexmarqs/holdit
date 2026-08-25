import { HALF_LIFE_DAYS, MIN_SPEND_CENTS } from "@holdit/core";
import { publicEnv } from "@holdit/utils/env";
import { formatMoney } from "@holdit/utils/format";
import { PageHead, Section } from "@/components/prose";
import { leafPage } from "../seo";

export const metadata = leafPage({
  title: "Terms",
  description:
    "What you get when you buy a square on holdit.lol, what it costs, when it fades, what is not allowed, and how refunds work.",
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
          Space on one shared page, for as long as your spend keeps it there. Your square&rsquo;s
          area is your spend as a share of everyone&rsquo;s, drawn beside every other square.{" "}
          <b>Live spend halves every {HALF_LIFE_DAYS} days</b> — that is how hard you are to knock
          down, not how big you are. Your share of the page only changes when somebody else buys.
          You are not buying a fixed position, a guaranteed size, a duration, or any amount of
          traffic.
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

      <Section title="Refunds">
        <p>
          Spend that has already been displayed is not refundable, because the space was delivered.
          Spend that has not been displayed yet is. So a square taken down for breaking these terms
          is refunded whatever it had left; the days it was already up are not.
        </p>
        <p>Ask at {CONTACT}.</p>
      </Section>

      <Section title="The unglamorous part">
        <p>
          The site is provided as it is, without warranty. It may change, break, or stop; if it
          stops for good, undisplayed spend is refunded. Nothing here is worth more than what you
          spent on it, and that is the limit of what can be claimed.
        </p>
        <p>These terms may change. The version on this page is the one that applies.</p>
      </Section>
    </div>
  );
}
