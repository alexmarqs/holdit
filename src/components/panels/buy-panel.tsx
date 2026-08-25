"use client";

import {
  ceilingFor,
  ceilToDollar,
  centsForShareOf,
  clampSpend,
  MIN_SPEND_CENTS,
  maxTargetShare,
  openingAmountCents,
  SHARE_TARGETS,
  shareAfterSpend,
  stepAmount,
} from "@holdit/core";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { Globe, Minus, Pencil, Plus, Target } from "lucide-react";
import { useEffect, useState } from "react";
import {
  previewAtom,
  previewHandleAtom,
  useWallRefresh,
  wallAtom,
} from "@/components/map-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidTarget, normalizeTarget } from "@/lib/utils/domain";
import { formatMoney, formatShare, moneyDraft } from "@/lib/utils/format";

/** Pause after a keystroke before the typed amount lands on the map. */
const SETTLE_MS = 320;

function readAmount(draft: string | null, current: number, maxUseful: number): number {
  const dollars = Number(String(draft ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(dollars) || dollars <= 0) return Math.min(current, maxUseful);
  return Math.min(maxUseful, clampSpend(Math.round(dollars * 100)));
}

export function BuyPanel() {
  const state = useAtomValue(wallAtom);
  const empty = state.counters.squaresLive === 0;
  const { refresh } = useWallRefresh();
  const setPreview = useSetAtom(previewAtom);
  const setPreviewHandle = useSetAtom(previewHandleAtom);
  const [amount, setAmount] = useState(() => openingAmountCents(state.counters.squaresLive));
  const [draft, setDraft] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeTarget(target);
  const existing = normalized
    ? state.standings.find((s) => s.holder.handle === normalized.handle)
    : undefined;

  const rows = state.standings.map((s) => ({ id: s.holder.id, liveCents: s.liveCents }));
  const ceilingAfter = ceilingFor(state.counters.squaresLive + (existing ? 0 : 1));
  const ceilingCents = centsForShareOf(rows, ceilingAfter, existing?.holder.id);
  const atCeiling = existing !== undefined && ceilingCents === null;
  const maxUseful = Math.max(
    MIN_SPEND_CENTS,
    ceilingCents === null ? MIN_SPEND_CENTS : ceilToDollar(ceilingCents),
  );
  const quotedAmount = draft === null ? amount : readAmount(draft, amount, maxUseful);
  const share = shareAfterSpend(rows, quotedAmount, existing?.holder.id);
  const heldShare = existing?.share ?? 0;
  const aimCeiling = maxTargetShare(state.counters.squaresLive);
  const targets = SHARE_TARGETS.map((value) => {
    const exact = centsForShareOf(rows, value, existing?.holder.id);
    return {
      value,
      cost: exact === null ? null : ceilToDollar(exact),
    };
  }).filter(
    (entry): entry is { value: number; cost: number } =>
      entry.value <= aimCeiling + 1e-9 && entry.value > heldShare + 1e-9 && entry.cost !== null,
  );

  useEffect(() => {
    setAmount((value) => Math.min(value, maxUseful));
  }, [maxUseful]);

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
    const next = readAmount(draft, amount, maxUseful);
    if (next === amount) return;
    const timer = setTimeout(() => setAmount(next), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [amount, draft, maxUseful]);

  useEffect(() => {
    const handle = existing?.holder.handle ?? null;
    const timer = setTimeout(() => setPreviewHandle(handle), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [existing, setPreviewHandle]);

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
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, amountCents: quotedAmount }),
      });
      const body = (await response.json()) as
        | { checkoutUrl: string }
        | { recorded: true; handle: string }
        | { error: string };

      if (!response.ok || "error" in body) {
        setError("error" in body ? body.error : "Something went wrong. Nothing was charged.");
        return;
      }

      if ("checkoutUrl" in body) {
        window.location.href = body.checkoutUrl;
        return;
      }

      setTarget("");
      refresh(true);
      document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setError("Could not reach the server. Nothing was charged.");
    } finally {
      setPending(false);
    }
  }

  const delta = existing && !atCeiling ? Math.max(0, share - existing.share) : share;

  return (
    <section className="border-b border-border px-4 py-2.5 md:px-5 md:py-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-5">
        <div className="min-w-0 shrink-0 text-center lg:text-left">
          <h2 className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-[20px] leading-none font-bold tracking-[-0.03em] lg:justify-start">
            <span>
              {existing && !atCeiling ? "Add" : "Hold"}{" "}
              <span className="num text-[30px] leading-none text-primary">
                {existing && !atCeiling ? `+${formatShare(delta)}` : formatShare(share)}
              </span>{" "}
              of the wall for
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                aria-label="Spend less"
                className="size-7"
                disabled={quotedAmount <= MIN_SPEND_CENTS}
                onClick={() => {
                  setDraft(null);
                  setAmount(stepAmount(quotedAmount, -1));
                }}
              >
                <Minus />
              </Button>
              <label className="group inline-flex cursor-text items-center gap-1 rounded-xl border border-dashed border-primary/45 px-2 py-0.5 transition-colors hover:border-primary hover:bg-primary/5 focus-within:border-solid focus-within:border-primary">
                <input
                  value={draft ?? formatMoney(amount)}
                  onChange={(event) => setDraft(event.target.value)}
                  onFocus={() => setDraft(moneyDraft(amount))}
                  onBlur={() => {
                    setAmount(readAmount(draft, amount, maxUseful));
                    setDraft(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                      event.preventDefault();
                      const base = readAmount(draft, amount, maxUseful);
                      const next = Math.min(
                        maxUseful,
                        clampSpend(base + (event.key === "ArrowUp" ? 100 : -100)),
                      );
                      setAmount(next);
                      setDraft(moneyDraft(next));
                      return;
                    }
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    setAmount(readAmount(draft, amount, maxUseful));
                    setDraft(null);
                    event.currentTarget.blur();
                  }}
                  inputMode="decimal"
                  aria-label="Amount to spend, in dollars"
                  size={1}
                  style={{ width: `${Math.max(3, (draft ?? formatMoney(amount)).length) + 0.5}ch` }}
                  className="num bg-transparent text-center text-[34px] leading-none text-primary tabular-nums outline-none"
                />
                <Pencil
                  aria-hidden
                  className="size-3 shrink-0 text-primary/45 transition-colors group-hover:text-primary"
                />
              </label>
              <Button
                variant="outline"
                size="icon"
                aria-label="Spend more"
                className="size-7"
                disabled={quotedAmount >= maxUseful}
                onClick={() => {
                  setDraft(null);
                  setAmount(Math.min(maxUseful, stepAmount(quotedAmount, 1)));
                }}
              >
                <Plus />
              </Button>
            </span>
          </h2>
          <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
            <span className="text-primary/80">From {formatMoney(MIN_SPEND_CENTS)}.</span>{" "}
            {empty
              ? "The whole wall until the next square."
              : "New spend takes a slice sized to what they paid. The price of a slice climbs as the wall fills."}
          </p>
        </div>

        <form
          className="min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Globe className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
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
                className="h-11 pl-10"
              />
            </div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Holding…" : "Hold it"}
            </Button>
          </div>
          <p
            className={`mt-1.5 text-center text-xs leading-relaxed font-bold lg:text-left ${
              error ? "text-destructive" : "text-primary"
            }`}
            role={error ? "alert" : undefined}
          >
            {error ??
              (existing
                ? `Topping up ${existing.holder.handle}: ${formatShare(existing.share)} → ${formatShare(share)}`
                : "Already on the wall? Same URL to top up.")}
          </p>
        </form>
      </div>

      {targets.length > 0 && state.counters.liveCents > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 lg:justify-start lg:gap-2">
          <span className="inline-flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground lg:w-auto lg:justify-start">
            <Target className="size-3.5" aria-hidden />
            Or aim for
          </span>
          {targets.map(({ value, cost }) => {
            const active = quotedAmount === cost;
            return (
              <Button
                key={value}
                type="button"
                size="sm"
                className="px-2.5 text-[13px]"
                variant={active ? "default" : "outline"}
                onClick={() => {
                  setDraft(null);
                  setAmount(cost);
                }}
              >
                <span className="num font-bold">
                  {formatShare(value, (value * 1000) % 10 === 0 ? 0 : 1)}
                </span>
                <span className={active ? "num opacity-80" : "num text-muted-foreground"}>
                  {formatMoney(cost)}
                </span>
              </Button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
