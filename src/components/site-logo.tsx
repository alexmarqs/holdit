"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { monogram } from "@/lib/utils/domain";
import { toFaviconUrl } from "@/lib/utils/favicon";

/**
 * Favicon with a monogram fallback. Roughly one site in six has no usable
 * favicon, and a broken image on a paid square is not acceptable.
 *
 * Google often answers a globe at 16px instead of an error, so `onError` is
 * not enough on its own. A 1px spacer still loads as success; natural width
 * is the signal, checked on load and again by ref if the cache finished
 * before React attached the handler.
 */
export function SiteLogo({
  handle,
  size = 20,
  className,
}: {
  handle: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const shared = "shrink-0 rounded-[6px] object-contain";

  if (failed) {
    return (
      <span
        aria-hidden
        className={cn(
          shared,
          "grid place-items-center bg-primary font-bold text-primary-foreground",
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(7, size * 0.4) }}
      >
        {monogram(handle)}
      </span>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: third-party favicons, no loader benefit
    <img
      alt=""
      aria-hidden
      /*
       * One size for every mark on the page, whatever box it is drawn in.
       * Asking for 32 in lists and 64 in tiles made the same logo two
       * separate URLs, so a domain in both places was fetched twice — a
       * dozen of them on a full wall. 64 is also the honest size for a
       * 20px box on a retina screen, where 32 is already upscaled.
       */
      src={toFaviconUrl(handle, 64)}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      onLoad={(event) => {
        if (event.currentTarget.naturalWidth <= 1) setFailed(true);
      }}
      ref={(node) => {
        if (node?.complete && node.naturalWidth <= 1) setFailed(true);
      }}
      className={cn(shared, className)}
      style={{ width: size, height: size }}
    />
  );
}
