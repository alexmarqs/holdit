"use client";

import type { Holder } from "@holdit/core";
import type { ComponentProps } from "react";

/**
 * Fire and forget, in parallel with the hop: the browser is already opening the
 * destination when this leaves, and `keepalive` lets it finish on its own. The
 * click is never awaited and never blocks — losing one is better than making
 * somebody wait on our counter.
 */
function logClick(holderId: string) {
  void fetch("/api/clicks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ holderId }),
    keepalive: true,
    // A number we failed to record must not surface as an error in a console.
  }).catch(() => {});
}

/**
 * The tile is a normal outbound link — hover shows linear.app, not a holdit
 * URL, and the click opens with no redirect of ours in the way.
 *
 * The destination is sent exactly as the buyer submitted it, with no utm or ref
 * appended. Their analytics is theirs to read; we should not be renaming
 * ourselves inside it.
 */
export function SquareLink({
  holder,
  onClick,
  onAuxClick,
  ...props
}: { holder: Pick<Holder, "id" | "url"> } & Omit<ComponentProps<"a">, "href">) {
  return (
    <a
      {...props}
      href={holder.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={(event) => {
        logClick(holder.id);
        onClick?.(event);
      }}
      // Middle-click opens the tab without ever firing onClick, so those hops
      // would otherwise go uncounted.
      onAuxClick={(event) => {
        if (event.button === 1) logClick(holder.id);
        onAuxClick?.(event);
      }}
    />
  );
}
