"use client";

import type { MapState } from "@holdit/core";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createStore, Provider, useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { dilutionDrop, recallHandle, rememberHandle } from "@/components/panels/dilution";
import { awaitingAtom, claimedAtom, dilutedAtom, flashAtom, heldAtom } from "@/context/wall-atoms";
import { useWall } from "@/hooks/use-wall";
import { apiClient } from "@/lib/api-client";
import { createWallQueryClient, writeWallCache } from "@/lib/utils/wall-query";
import {
  AWAITING_FIRST_MS,
  AWAITING_GAP_MS,
  awaitingTimedOut,
  claimedSquare,
  heldHandleFromHref,
  hrefWithoutHeld,
} from "@/lib/utils/wall-state";

/**
 * Everything this visit does on its own: reading the handle checkout sends back,
 * clearing a pulse, and waiting for a paid square to appear. Renders nothing —
 * it exists to hold effects inside the stores.
 */
function WallEffects() {
  const wall = useWall();
  const queryClient = useQueryClient();
  const flash = useAtomValue(flashAtom);
  const awaiting = useAtomValue(awaitingAtom);
  const claimed = useAtomValue(claimedAtom);
  const held = useAtomValue(heldAtom);
  const setFlash = useSetAtom(flashAtom);
  const setAwaiting = useSetAtom(awaitingAtom);
  const setClaimed = useSetAtom(claimedAtom);
  const setHeld = useSetAtom(heldAtom);
  const setDiluted = useSetAtom(dilutedAtom);
  const lastShare = useRef<number | null>(null);

  /** The handle still being waited for, or null. Narrowed so the loop below can depend
      on it without re-running for every other change to `awaiting`. */
  const awaitingHandle = awaiting !== null && !awaiting.timedOut ? awaiting.handle : null;

  /*
   * Checkout sends a paid buyer back to `/?held=<handle>`, which is how the
   * page knows to start watching for their square. The parameter is cleared
   * once it is read, so a reload or a shared link does not set somebody else
   * watching for a square that is not coming.
   */
  useEffect(() => {
    const held = heldHandleFromHref(window.location.href);
    if (!held) return;
    setAwaiting({ handle: held, timedOut: false });
    window.history.replaceState(null, "", hrefWithoutHeld(window.location.href));
  }, [setAwaiting]);

  /* A pulse is a moment, not a state. Clearing it here rather than on a stored
     timer means an unmount mid-pulse cancels the timer with it. */
  useEffect(() => {
    if (flash === null) return;
    const timer = setTimeout(() => setFlash(null), 1_200);
    return () => clearTimeout(timer);
  }, [flash, setFlash]);

  /*
   * The square arriving is a fact about the wall, so it is watched apart from
   * the loop that keeps asking for one. Sharing an effect, neither could be
   * right: every answer the loop fetched replaced the wall, which re-ran the
   * effect, which restarted both the gap between asks and the clock behind the
   * forty-second cap. Measured, that was a bypassed fetch about every 780ms and
   * a cap that never arrived — still going at 103 requests after 80 seconds.
   *
   * No `timedOut` guard here on purpose: if a square turns up after the wait
   * gave up, saying so beats leaving the buyer with the apology.
   */
  useEffect(() => {
    if (awaiting === null) return;
    const claimed = claimedSquare(wall, awaiting.handle);
    if (!claimed) return;
    setClaimed(claimed);
    setFlash(claimed.handle);
    setAwaiting(null);
  }, [awaiting, wall, setClaimed, setFlash, setAwaiting]);

  useEffect(() => {
    setHeld(recallHandle(window.localStorage));
  }, [setHeld]);

  useEffect(() => {
    if (claimed === null) return;
    rememberHandle(window.localStorage, claimed.handle);
    setHeld(claimed.handle);
    lastShare.current = claimed.share;
    setDiluted(null);
  }, [claimed, setHeld, setDiluted]);

  useEffect(() => {
    if (held === null || claimed !== null) return;
    const standing = wall.standings.find((s) => s.holder.handle === held);
    if (!standing) return;
    const prev = lastShare.current;
    lastShare.current = standing.share;
    if (prev === null) return;
    if (dilutionDrop(prev, standing.share) === null) return;
    setDiluted({ handle: held, before: prev, after: standing.share });
  }, [wall.standings, held, claimed, setDiluted]);

  /*
   * Stripe sends the buyer back before the webhook has written the square.
   * This loop asks `/api/state?fresh=` (the live wall, not the 10s CDN copy)
   * until that handle appears. First ask at AWAITING_FIRST_MS, then every
   * AWAITING_GAP_MS. At AWAITING_GIVE_UP_MS it stops and the banner says the square
   * is paid for but not on the wall yet — silence here reads as a lost payment.
   *
   * The effect depends on `awaitingHandle` alone. Depending on `awaiting`
   * or the wall restarted the loop every time a fetch landed, which burned
   * the rate limit and never reached the forty-second cap.
   */
  useEffect(() => {
    if (awaitingHandle === null) return;
    const started = Date.now();
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!live) return;
      if (awaitingTimedOut(started, Date.now())) {
        setAwaiting((current) => (current ? { ...current, timedOut: true } : null));
        return;
      }
      const wall = await apiClient.tryFetchWall(true);
      if (wall) writeWallCache(queryClient, wall);
      if (live) timer = setTimeout(tick, AWAITING_GAP_MS);
    };
    timer = setTimeout(tick, AWAITING_FIRST_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [awaitingHandle, queryClient, setAwaiting]);

  return null;
}

/**
 * The wall the page arrived with, this visit's session, and the means to ask
 * for a newer wall.
 */
export function WallProvider({
  initialState,
  children,
}: {
  initialState: MapState;
  children: ReactNode;
}) {
  /*
   * A store and a query client per mount, rather than module-level defaults.
   *
   * Those defaults belong to the module, so two requests being rendered
   * concurrently on the server would share them — one visitor's wall bleeding
   * into another's HTML. Creating them here scopes both to this render.
   *
   * The query client is seeded with the page's wall. Nothing is prefetched on
   * the server, so there is no cache to dehydrate; the prop is the first copy.
   */
  const [store] = useState(() => createStore());
  const [queryClient] = useState(() => createWallQueryClient(initialState));

  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <WallEffects />
        {children}
      </Provider>
    </QueryClientProvider>
  );
}
