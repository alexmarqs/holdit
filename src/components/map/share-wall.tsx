"use client";

import type { MapState } from "@holdit/core";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "jotai";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { claimedAtom, dilutedAtom } from "@/context/wall-atoms";
import { useWall } from "@/hooks/use-wall";
import { WALL_QUERY_KEY } from "@/lib/utils/wall-query";
import {
  claimPostText,
  dilutionPostText,
  prefersOsShare,
  sharePageUrl,
  tweetIntent,
  wallShareCopy,
} from "./share-copy";

function useSharePayload() {
  const store = useStore();
  const queryClient = useQueryClient();

  return () => {
    const state = queryClient.getQueryData<MapState>(WALL_QUERY_KEY);
    if (state === undefined) return null;
    const claimed = store.get(claimedAtom);
    const diluted = store.get(dilutedAtom);
    const origin = window.location.origin;
    const squaresLive = state.counters.squaresLive;
    // After checkout the banner must unfurl *this* purchase. Date.now() floors
    // to a 30s OG bucket that may already be cached without the new square.
    const pageUrl = claimed?.purchaseId
      ? sharePageUrl(origin, squaresLive, { purchaseId: claimed.purchaseId })
      : sharePageUrl(origin, squaresLive, { at: Date.now() });
    // Post bodies name no domain: see `claimPostText`. The handle travels on
    // the card instead, where it cannot be turned into a competing link.
    const text = diluted
      ? dilutionPostText(diluted.before, diluted.after)
      : claimed
        ? claimPostText(claimed.share)
        : wallShareCopy(state.counters).text;
    return { text, pageUrl };
  };
}

export function ShareWallButton({ compact = false }: { compact?: boolean }) {
  const { counters } = useWall();
  const payload = useSharePayload();
  const empty = counters.squaresLive === 0;

  async function postOnX() {
    if (empty) return;
    const next = payload();
    if (!next) return;
    // On a phone the official intent is still x.com. The share sheet is how
    // other sites reach the installed app — MDN and web.dev both do this,
    // then fall back to the Web Intent. The user picks X from their apps.
    if (
      prefersOsShare({
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints,
      }) &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ text: next.text, url: next.pageUrl });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    const web = tweetIntent(next.text, next.pageUrl);
    const popup = window.open(web, "_blank", "noopener,noreferrer");
    if (popup === null) window.location.assign(web);
  }

  return (
    <Button
      variant="outline"
      size={compact ? "xs" : "sm"}
      className={compact ? "h-8 w-8 px-0 lg:h-6 lg:w-auto lg:px-2" : undefined}
      disabled={empty}
      onClick={() => void postOnX()}
      aria-label="Post on X"
      title="Post on X"
    >
      <XMark />
      <span className={compact ? "hidden lg:inline" : "hidden sm:inline"}>Post on X</span>
    </Button>
  );
}

export function CopyShareButton() {
  const payload = useSharePayload();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const next = payload();
    if (!next) return;
    const line = `${next.text}\n${next.pageUrl}`;
    try {
      await navigator.clipboard.writeText(line);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void copy()}>
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-3.5 shrink-0">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
