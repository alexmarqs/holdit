import { StatsPill } from "@/components/panels/counter-strip";
import { FormBuyPanel } from "@/components/panels/form-buy-panel";
import { GhostHint } from "@/components/panels/ghost-hint";

export function BuyPanel() {
  return (
    <section className="border-b border-foreground/8 px-4 pt-7 pb-2 md:pt-6 md:pb-2 lg:py-6">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <StatsPill />

        <h2 className="mt-4 text-[22px] leading-tight font-bold tracking-[-0.04em] sm:text-[26px]">
          <span className="relative inline-block">
            <GhostHint placement="hold" />
            <span className="rounded-md bg-primary/15 px-1.5 text-primary">Hold</span>
          </span>{" "}
          a square for{" "}
          <span className="hold-who">
            <svg viewBox="0 0 180 8" preserveAspectRatio="none" aria-hidden>
              <path
                className="hold-who-stroke"
                d="M2 5.4 C 32 2.6, 58 6.8, 90 4.4 S 138 7, 178 3.6"
              />
            </svg>
            you, or your product.
          </span>
        </h2>
        <p className="mt-1.5 max-w-md text-[13px] leading-snug text-muted-foreground">
          From $1. No auction. Old spend gets cheaper to challenge. New money takes a slice from
          everyone.
        </p>

        <FormBuyPanel />
        <GhostHint placement="map" />
      </div>
    </section>
  );
}
