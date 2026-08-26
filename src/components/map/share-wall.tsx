"use client";

import { useAtomValue } from "jotai";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { claimedAtom, dilutedAtom, useWall } from "@/components/wall-provider";
import {
  claimShareCopy,
  dilutionShareCopy,
  tweetIntent,
  wallShareCopy,
  wallShareUrl,
} from "./share-copy";

function useSharePayload() {
  const state = useWall();
  const claimed = useAtomValue(claimedAtom);
  const diluted = useAtomValue(dilutedAtom);

  return async () => {
    const pageUrl = wallShareUrl(
      window.location.origin,
      state.generatedAt,
      state.counters.squaresLive,
    );
    const text = diluted
      ? dilutionShareCopy(diluted.handle, diluted.before, diluted.after).text
      : claimed
        ? claimShareCopy(claimed.handle, claimed.share).text
        : wallShareCopy(state.counters).text;
    return { text, pageUrl };
  };
}

export function ShareWallButton({ compact = false }: { compact?: boolean }) {
  const payload = useSharePayload();

  async function postOnX() {
    const { text, pageUrl } = await payload();
    const href = tweetIntent(text, pageUrl);
    const popup = window.open(href, "_blank", "noopener,noreferrer");
    if (popup === null) window.location.assign(href);
  }

  return (
    <Button
      variant="outline"
      size={compact ? "icon" : "sm"}
      className={compact ? "size-8" : undefined}
      onClick={() => void postOnX()}
      aria-label="Post on X"
    >
      <XMark />
      {compact ? null : <span className="hidden sm:inline">Post on X</span>}
    </Button>
  );
}

export function CopyShareButton() {
  const payload = useSharePayload();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const { text, pageUrl } = await payload();
    const line = `${text}\n${pageUrl}`;
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
