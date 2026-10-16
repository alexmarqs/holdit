"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import { ShareWallButton } from "@/components/map/share-wall";
import { SiteLogo } from "@/components/site-logo";
import { awaitingAtom, claimedAtom, dilutedAtom } from "@/context/wall-atoms";
import { useForgetHeld } from "@/hooks/use-forget-held";
import { publicEnv } from "@/lib/utils/env";
import { formatShare } from "@/lib/utils/format";

function Banner({
  handle,
  children,
  onDismiss,
  dismissLabel = "Dismiss",
}: {
  handle: string;
  children: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-primary/30 bg-primary/10 px-4 py-2 text-sm md:px-5"
    >
      <SiteLogo handle={handle} size={20} />
      <div className="min-w-0 flex-1">{children}</div>
      <span className="flex items-center gap-1.5">
        <ShareWallButton />
        {onDismiss ? (
          <button
            type="button"
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={dismissLabel}
            onClick={onDismiss}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Waiting for the square, the post-buy screenshot, then "you just shrank".
 * Quiet ownership ("you hold X") lives on the square itself, not as a banner.
 */
export function AwaitingSquare() {
  const awaiting = useAtomValue(awaitingAtom);
  const claimed = useAtomValue(claimedAtom);
  const diluted = useAtomValue(dilutedAtom);
  const setClaimed = useSetAtom(claimedAtom);
  const forgetHeld = useForgetHeld();

  if (claimed) {
    return (
      <Banner handle={claimed.handle} onDismiss={() => setClaimed(null)}>
        <p>
          <b>{claimed.handle}</b> holds{" "}
          <span className="num font-bold">{formatShare(claimed.share)}</span> of the wall. Post it
          before it fades.
        </p>
      </Banner>
    );
  }

  if (awaiting) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-primary/30 bg-primary/10 px-4 py-2 text-sm md:px-5"
      >
        <SiteLogo handle={awaiting.handle} size={20} />
        {awaiting.timedOut ? (
          <p>
            <b>{awaiting.handle}</b> is paid for, but it has not appeared yet. Reload in a minute,
            or write to{" "}
            <a
              className="text-primary underline underline-offset-2"
              href={`mailto:${publicEnv.contactEmail}?subject=${encodeURIComponent(`Square not showing: ${awaiting.handle}`)}`}
            >
              {publicEnv.contactEmail}
            </a>
            . Nothing is lost.
          </p>
        ) : (
          <p className="flex items-center gap-2">
            <Loader2 aria-hidden className="size-4 animate-spin text-primary" />
            <span>
              Payment received. Putting <b>{awaiting.handle}</b> on the wall…
            </span>
          </p>
        )}
      </div>
    );
  }

  if (diluted) {
    return (
      <Banner handle={diluted.handle} onDismiss={forgetHeld} dismissLabel="Forget this square">
        <p>
          <b>{diluted.handle}</b> just shrank{" "}
          <span className="num font-bold">
            {formatShare(diluted.before)} → {formatShare(diluted.after)}
          </span>
          . Hold it again, or post it.
        </p>
      </Banner>
    );
  }

  return null;
}
