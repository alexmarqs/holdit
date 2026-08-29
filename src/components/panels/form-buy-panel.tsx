"use client";

import {
  ceilingFor,
  ceilToDollar,
  centsForShareOf,
  clampSpend,
  MAX_SPEND_CENTS,
  MIN_SPEND_CENTS,
  openingQuotedCents,
  shareAfterSpend,
  stepAmount,
} from "@holdit/core";
import { useSetAtom, useStore } from "jotai";
import { Globe, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { holdButtonLabel, holdCapCopy, topUpCopy } from "@/components/panels/buy-copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { previewAtom, previewHandleAtom } from "@/context/wall-atoms";
import { useWall } from "@/hooks/use-wall";
import { useWallRefresh } from "@/hooks/use-wall-refresh";
import { apiClient } from "@/lib/api-client";
import { isValidTarget, normalizeTarget } from "@/lib/utils/domain";
import { moneyDraft } from "@/lib/utils/format";

/** Pause after a keystroke before the typed amount lands on the map. */
const SETTLE_MS = 320;

/** Official Stripe wordmark. Blurple on paper, white in the dark. */
function StripeWordmark() {
  return (
    <svg
      viewBox="54 36 360 150"
      className="h-[18px] w-[43px] fill-[#635BFF] dark:fill-white"
      aria-hidden
    >
      <path d="M414 113.4c0-25.6-12.4-45.8-36.1-45.8-23.8 0-38.2 20.2-38.2 45.6 0 30.1 17 45.3 41.4 45.3 11.9 0 20.9-2.7 27.7-6.5v-20c-6.8 3.4-14.6 5.5-24.5 5.5-9.7 0-18.3-3.4-19.4-15.2h48.9c.2-1.4.4-6.6.4-9zm-49.4-9.5c0-11.3 6.9-16 13.2-16 6.1 0 12.6 4.7 12.6 16h-25.8zM301.1 67.6c-9.8 0-16.1 4.6-19.6 7.8l-1.3-6.2h-22v116.6l25-5.3.1-28.3c3.6 2.6 8.9 6.3 17.7 6.3 17.9 0 34.2-14.4 34.2-46.1-.1-28.4-16.6-44.2-34.1-44.8zm-6 68.9c-5.9 0-9.4-2.1-11.8-4.7l-.1-37.1c2.6-2.9 6.2-4.9 11.9-4.9 9.1 0 15.4 10.2 15.4 23.3.1 13.4-6.1 23.4-15.4 23.4zM223.8 61.7l25.1-5.4V36l-25.1 5.3v20.4zM223.8 69.3h25.1v87.5h-25.1zM196.9 76.7l-1.6-7.4h-21.6v87.5h25V97.5c5.9-7.7 15.9-6.3 19-5.2v-23c-3.2-1.2-15-3.4-20.8 7.4zM146.9 47.6l-24.4 5.2-.1 80.1c0 14.8 11.1 25.7 25.9 25.7 8.2 0 14.2-1.5 17.5-3.3V135c-3.2 1.3-19 5.9-19-8.9V90.6h19V69.3h-19l.1-21.7zM79.3 94.7c0-3.9 3.2-5.4 8.5-5.4 7.6 0 17.2 2.3 24.8 6.4V72.2c-8.3-3.3-16.5-4.6-24.8-4.6C67.5 67.6 54 78.2 54 95.9c0 27.6 38 23.2 38 35.1 0 4.6-4 6.1-9.6 6.1-8.3 0-18.9-3.4-27.3-8v23.8c9.3 4 18.7 5.7 27.3 5.7 20.8 0 35.1-10.3 35.1-28.2.1-24.8-37.9-19.5-37.9-35.7z" />
    </svg>
  );
}

function readAmount(draft: string | null, current: number, maxSpend: number): number {
  const dollars = Number(String(draft ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(dollars) || dollars <= 0) return Math.min(current, maxSpend);
  return Math.min(maxSpend, clampSpend(Math.round(dollars * 100)));
}

export function FormBuyPanel() {
  const state = useWall();
  const empty = state.counters.squaresLive === 0;
  const { refresh } = useWallRefresh();
  const setPreview = useSetAtom(previewAtom);
  const setPreviewHandle = useSetAtom(previewHandleAtom);
  const [target, setTarget] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeTarget(target);
  const existing = normalized
    ? state.standings.find((s) => s.holder.handle === normalized.handle)
    : undefined;

  const rows = useMemo(
    () => state.standings.map((s) => ({ id: s.holder.id, liveCents: s.liveCents })),
    [state.standings],
  );

  const ceilingAfter = ceilingFor(state.counters.squaresLive + (existing ? 0 : 1));

  /*
   * The bisection behind the ceiling price is the most expensive thing on this
   * panel — forty passes of the whole share model, ~6ms on this wall and ~19ms
   * on twenty-five squares — and it does not depend on the amount being typed.
   * Unmemoised it ran on every keystroke, which is where the field's input lag
   * came from. What a keystroke actually needs is one `shareAfterSpend`.
   */
  const capSpend = useMemo(() => {
    const ceilingCents = centsForShareOf(rows, ceilingAfter, existing?.holder.id);
    return Math.max(
      MIN_SPEND_CENTS,
      ceilingCents === null ? MIN_SPEND_CENTS : ceilToDollar(ceilingCents),
    );
  }, [rows, ceilingAfter, existing?.holder.id]);
  const [amount, setAmount] = useState(() =>
    openingQuotedCents(state.counters.squaresLive, capSpend, state.counters.liveCents),
  );
  const quotedAmount = draft === null ? amount : readAmount(draft, amount, MAX_SPEND_CENTS);
  const share = shareAfterSpend(rows, quotedAmount, existing?.holder.id);
  const atDisplayCap = ceilingAfter < 1 && share >= ceilingAfter - 1e-9;

  const store = useStore();

  useEffect(() => {
    if (empty || store.get(previewAtom) === null) {
      setPreview(quotedAmount);
      return;
    }
    const timer = setTimeout(() => setPreview(quotedAmount), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [empty, quotedAmount, setPreview, store]);

  useEffect(() => {
    if (draft === null) return;
    const next = readAmount(draft, amount, MAX_SPEND_CENTS);
    if (next === amount) return;
    const timer = setTimeout(() => setAmount(next), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [amount, draft]);

  const previewName = normalized?.handle ?? null;
  useEffect(() => {
    const timer = setTimeout(() => setPreviewHandle(previewName), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [previewName, setPreviewHandle]);

  useEffect(
    () => () => {
      setPreview(null);
      setPreviewHandle(null);
    },
    [setPreview, setPreviewHandle],
  );

  async function submit() {
    if (target.trim().length === 0) {
      setError("Enter the URL you want the square to point at.");
      return;
    }
    if (!isValidTarget(target)) {
      setError(`"${target.trim()}" is not a domain or an @handle.`);
      return;
    }

    setPending(true);
    setError(null);
    let leaving = false;
    try {
      const result = await apiClient.startCheckout({ target, amountCents: quotedAmount });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if ("checkoutUrl" in result) {
        // location.href is async — finally would paint Hold again before Stripe.
        leaving = true;
        window.location.href = result.checkoutUrl;
        return;
      }

      setTarget("");
      refresh(true);
      document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setError("Could not reach the server. Nothing was charged.");
    } finally {
      if (!leaving) setPending(false);
    }
  }

  const buttonLabel = holdButtonLabel(share, existing?.share ?? null, atDisplayCap);
  const amountDigits = draft ?? moneyDraft(amount);

  return (
    <>
      <form
        className="mt-4 flex w-full flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <span className="inline-flex shrink-0 items-center justify-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Spend less"
            className="size-11"
            disabled={quotedAmount <= MIN_SPEND_CENTS}
            onClick={() => {
              setDraft(null);
              setAmount(stepAmount(quotedAmount, -1));
            }}
          >
            <Minus />
          </Button>
          <label className="inline-flex h-11 min-w-19 cursor-text items-center justify-center gap-0.5 rounded-lg border border-input bg-background px-2.5">
            <span aria-hidden className="text-[15px] font-medium text-muted-foreground">
              $
            </span>
            <input
              value={amountDigits}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={() => setDraft(moneyDraft(amount))}
              onBlur={() => {
                setAmount(readAmount(draft, amount, MAX_SPEND_CENTS));
                setDraft(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  const base = readAmount(draft, amount, MAX_SPEND_CENTS);
                  const next = Math.min(
                    MAX_SPEND_CENTS,
                    clampSpend(base + (event.key === "ArrowUp" ? 100 : -100)),
                  );
                  setAmount(next);
                  setDraft(moneyDraft(next));
                  return;
                }
                if (event.key !== "Enter") return;
                event.preventDefault();
                setAmount(readAmount(draft, amount, MAX_SPEND_CENTS));
                setDraft(null);
                event.currentTarget.blur();
              }}
              inputMode="decimal"
              aria-label="Amount to spend, in dollars"
              size={1}
              style={{ width: `${Math.max(2, amountDigits.length) + 0.4}ch` }}
              className="num bg-transparent text-center text-[20px] leading-none font-bold tabular-nums outline-none"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Spend more"
            className="size-11"
            disabled={quotedAmount >= MAX_SPEND_CENTS}
            onClick={() => {
              setDraft(null);
              setAmount(Math.min(MAX_SPEND_CENTS, stepAmount(quotedAmount, 1)));
            }}
          >
            <Plus />
          </Button>
        </span>

        <div className="relative w-full min-w-0 sm:min-w-[19.5rem] sm:flex-1 sm:basis-[19.5rem]">
          <Globe className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
              setError(null);
            }}
            placeholder="Your product URL or @handle"
            spellCheck={false}
            autoComplete="url"
            aria-invalid={error !== null}
            aria-label="Your product URL or handle"
            className="h-11 pl-9"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="hold-cta w-full shrink-0 rounded-full px-3.5 tracking-[-0.02em] sm:w-auto"
          disabled={pending}
        >
          {pending ? "Holding…" : buttonLabel}
        </Button>
      </form>

      {/*
       * Same height whether this line is empty, the cap, or a top-up. The map
       * shares a viewport with this form; growing the form used to shrink the
       * canvas and re-pack the *live* wall — Preview off, $1 vs $2, three
       * equal squares flipping from an L to three columns. The copy still
       * appears; it just does not steal rows from the treemap.
       */}
      <div className="mt-2.5 flex min-h-[3lh] w-full max-w-md items-start justify-center text-[13px] leading-snug">
        {error ? (
          <p className="text-[12px] font-bold text-destructive" role="alert">
            {error}
          </p>
        ) : atDisplayCap ? (
          <p className="text-muted-foreground">
            {holdCapCopy(quotedAmount, share)}.{" "}
            <a href="/rules#the-cap" className="text-primary hover:text-primary/80">
              Rules
            </a>
          </p>
        ) : existing ? (
          <p className="text-[12px] text-muted-foreground">
            {topUpCopy(existing.holder.handle, existing.share, share)}
          </p>
        ) : null}
      </div>

      <a
        href="https://stripe.com"
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-4 inline-flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground`}
        aria-label="Payments protected by Stripe"
      >
        Payments protected by
        <StripeWordmark />
      </a>
    </>
  );
}
