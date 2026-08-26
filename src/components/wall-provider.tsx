"use client";

import { DEFAULT_AMOUNT_CENTS, type MapState } from "@holdit/core";
import {
  QueryClientProvider,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { atom, createStore, Provider, useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { dilutionDrop, recallHandle, rememberHandle } from "@/components/panels/dilution";
import {
  CHASE_FIRST_MS,
  CHASE_GAP_MS,
  chaseTimedOut,
  claimedSquare,
  createWallQueryClient,
  fetchWall,
  heldHandleFromHref,
  hrefWithoutHeld,
  tryFetchWall,
  WALL_QUERY_KEY,
  writeWallCache,
} from "@/lib/wall-state";

/** Atoms for the wall state. */
export const flashAtom = atom<string | null>(null);
export const previewAtom = atom<number | null>(DEFAULT_AMOUNT_CENTS);
export const previewHandleAtom = atom<string | null>(null);
export const awaitingAtom = atom<{ handle: string; timedOut: boolean } | null>(null);
export const claimedAtom = atom<{ handle: string; share: number } | null>(null);
export const heldAtom = atom<string | null>(null);
export const dilutedAtom = atom<{ handle: string; before: number; after: number } | null>(null);

/**
 * The wall as last fetched. Seeded from the prerendered page; replaced when
 * somebody asks for a newer one. Never Jotai — that copy would drift from this.
 */
export function useWall(): MapState {
  const { data } = useQuery({
    queryKey: WALL_QUERY_KEY,
    queryFn: () => fetchWall(false),
  });
  if (data === undefined) throw new Error("The wall must be read inside <WallProvider>.");
  return data;
}

const REFRESH_KEY = ["wall", "refresh"] as const;

/**
 * Ask for the wall again, and say whether a pull is in flight.
 *
 * `fresh` bypasses the CDN copy. The Refresh control asks for that — the word
 * means the wall as it is. A purchase that just landed does too. The 10s edge
 * copy is only for `GET /api/state` without `?fresh=`.
 *
 * A 429 or a failed pull is skipped: the wall on screen stays, the control
 * stays pressable. Mutations do not retry, so pressing again is the only retry.
 */
export function useWallRefresh() {
  const queryClient = useQueryClient();
  const { mutate } = useMutation<MapState | null, Error, boolean>({
    mutationKey: REFRESH_KEY,
    mutationFn: tryFetchWall,
    onSuccess: (wall) => {
      if (wall === null) return;
      writeWallCache(queryClient, wall);
    },
  });

  return {
    refresh: useCallback((fresh = false) => mutate(fresh), [mutate]),
    refreshing: useIsMutating({ mutationKey: REFRESH_KEY }) > 0,
  };
}

/**
 * Everything this visit does on its own: reading the handle checkout sends back,
 * clearing a pulse, and chasing a paid square onto the wall. Renders nothing —
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

  /** The handle worth chasing, or null. Narrowed so the loop below can depend
      on it without re-running for every other change to `awaiting`. */
  const chasing = awaiting !== null && !awaiting.timedOut ? awaiting.handle : null;

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
   * No `timedOut` guard here on purpose: if a square turns up after the chase
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
   * Chase the square rather than wait for the buyer to press refresh. Bypassed
   * fetches every 1.5s until it appears, then stop; give up after forty seconds
   * and say so, because silence at this point reads as a lost payment.
   *
   * Keyed on the handle alone — the one thing that decides whether to chase and
   * what to chase. Depending on `awaiting` itself, or on the wall, is what
   * restarted the loop under its own answers.
   */
  useEffect(() => {
    if (chasing === null) return;
    const started = Date.now();
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!live) return;
      if (chaseTimedOut(started, Date.now())) {
        setAwaiting((current) => (current ? { ...current, timedOut: true } : null));
        return;
      }
      const wall = await tryFetchWall(true);
      if (wall) writeWallCache(queryClient, wall);
      if (live) timer = setTimeout(tick, CHASE_GAP_MS);
    };
    timer = setTimeout(tick, CHASE_FIRST_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [chasing, queryClient, setAwaiting]);

  return null;
}

interface ProviderProps {
  initialState: MapState;
  children: ReactNode;
}

/**
 * The wall the page arrived with, this visit's session, and the means to ask
 * for a newer wall.
 */
export function WallProvider({ initialState, children }: ProviderProps) {
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
