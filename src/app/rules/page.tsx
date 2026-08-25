import {
  CEILING_BUDGET,
  HALF_LIFE_DAYS,
  MAX_SHARE,
  MIN_SPEND_CENTS,
  YOUNG_WALL_MAX_SHARE,
} from "@holdit/core";
import { publicEnv } from "@holdit/utils/env";
import { formatMoney } from "@holdit/utils/format";
import type { ReactNode } from "react";
import { PageHead, Section } from "@/components/prose";
import { leafPage } from "../seo";

const CAP_YOUNG = Math.round(YOUNG_WALL_MAX_SHARE * 100);
const CAP_GROWN = Math.round(MAX_SHARE * 100);
const GROWN_AT = Math.round(CEILING_BUDGET / MAX_SHARE);
const TEN_K = formatMoney(1_000_000);

export const metadata = leafPage({
  title: "Rules",
  description:
    "How a square works: spend from $1, your area is your share of live spend, a cap stops anyone owning the wall, and live spend halves every 14 days so the wall stays contestable. What is not allowed, and when spend is refunded.",
  path: "/rules",
});

const CONTACT = (
  <a className="text-primary hover:text-primary/80" href={`mailto:${publicEnv.contactEmail}`}>
    {publicEnv.contactEmail}
  </a>
);

function Example({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="rounded-lg bg-card px-3.5 py-3 ring-1 ring-border">
      <p className="font-bold text-foreground">{title}</p>
      <p className="mt-1">{children}</p>
    </li>
  );
}

export default function RulesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-5 pb-16">
      <PageHead
        title="Rules"
        lede="No auction. No countdown. You pay, you hold a square, it fades."
      />

      <Section title="How a square works">
        <p>
          Spend from {formatMoney(MIN_SPEND_CENTS)}. Your <b>share</b> is your spend over
          everyone&rsquo;s live spend. When somebody else buys, you shrink. You are not buying a
          fixed size, a duration, or a deposit you can withdraw.
        </p>
        <p>Clicks never change area. History never fades — you lose prominence, not the record.</p>
      </Section>

      <Section title="The cap">
        <p>
          Nobody can erase the wall. With two squares the largest is {CAP_YOUNG}%. That tightens as
          more squares arrive, and from {GROWN_AT} squares on it is {CAP_GROWN}%.
        </p>
        <p>
          Spend past the cap does not grow the tile. The first square is the whole wall at any
          price, so {formatMoney(MIN_SPEND_CENTS)} is enough until somebody else shows up.
        </p>
      </Section>

      <Section title="What actually fades">
        <p>
          Live spend halves every {HALF_LIFE_DAYS} days. That is how hard you are to knock down, not
          how big you are. If nobody else buys, everyone fades together — the ratios stay put, so{" "}
          <b>the map does not move</b>. You only lose space when new money arrives. Old money is
          then easier to beat.
        </p>
        <ul className="space-y-2.5 pt-1">
          <Example title="You are alone.">
            You pay {TEN_K}. A month later you still hold 100%. The dollars listed as live have
            dropped. The square has not.
          </Example>
          <Example title="The wall stays quiet.">
            You and somebody else both pay {TEN_K} the same day. Two weeks later you still split the
            wall 50 / 50.
          </Example>
          <Example title="Someone matches you later.">
            You pay {TEN_K}. Two weeks later they pay {TEN_K}. Their money is fresh; yours is half
            as strong. They would take two-thirds — the cap stops them at {CAP_YOUNG}%.
          </Example>
          <Example title="A cheaper attack after you age.">
            You pay {TEN_K}. Two weeks later they pay {formatMoney(500_000)}. Same live strength, so
            you split the wall. On day one that {formatMoney(500_000)} would have left them the
            smaller square.
          </Example>
        </ul>
        <p>
          That is also why the quoted price of a share can drop by a cent while you wait: the pool
          got slightly cheaper. A new purchase raises it.
        </p>
      </Section>

      <Section title="What is not allowed">
        <p>
          Squares go up as soon as you pay. These come down: <b>sexual content</b>,{" "}
          <b>chat and invite links</b>, <b>malware and scams</b>, and <b>link shorteners</b>. Report
          them to {CONTACT}.
        </p>
      </Section>

      <Section title="Refunds">
        <p>
          Spend already displayed is not refundable. If a square is taken down for breaking the
          rules, whatever it had left is refunded; the days it was already up are not.
        </p>
      </Section>
    </div>
  );
}
