"use client";

import { DEFAULT_AMOUNT_CENTS, type MapState } from "@holdit/core";
import {
  QueryClient,
  QueryClientProvider,
  useIsMutating,
  useMutation,
} from "@tanstack/react-query";
import { atom, createStore, Provider, useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { dilutionDrop, recallHandle, rememberHandle } from "@/components/panels/dilution";

/*
 * One atom per thing that changes, rather than one object holding all of them.
 *
 * These were a single context value, so a keystroke in the buy panel — which
 * only moves the preview — re-rendered the listing, both side cards and the
 * counter strip, none of which read it. Subscribing per value means a component
 * redraws when what it actually reads changes, and not otherwise.
 */

/**
 * Kept private so `wallAtom` can promise a wall rather than a maybe-wall. It is
 * null only in the instant between a store being created and `<MapProvider>`
 * seeding it, which no component can observe.
 */
const wallSourceAtom = atom<MapState | null>(null);

/**
 * The wall as last fetched: seeded from the prerendered page, replaced whenever
 * somebody asks for a newer one.
 */
export const wallAtom = atom(
  (get) => {
    const wall = get(wallSourceAtom);
    if (wall === null) throw new Error("The wall must be read inside <MapProvider>.");
    return wall;
  },
  (_get, set, next: MapState) => {
    set(wallSourceAtom, next);
  },
);

/** Handle to pulse, set for a moment after a purchase lands. */
export const flashAtom = atom<string | null>(null);

/**
 * Amount currently being considered in the buy panel, in cents. Drives a
 * preview tile on the map so the dilution is visible before paying.
 *
 * Seeded with the amount the panel itself opens on, so the preview is part of
 * the wall's first layout rather than something that arrives after it. Starting
 * at null meant the map drew once without the dashed square and then, once the
 * panel's effect had run, laid itself out again to make room — the appearance of
 * a tile ranked mid-wall moves about forty of forty-five squares, so the pitch
 * announced itself by shoving the whole wall aside. Both layouts happen after
 * mount, and this makes them the same layout.
 *
 * Null still means "no preview" — the buy panel sets it on unmount, and
 * fullscreen ignores it — so this is a starting value, not a new contract.
 */
export const previewAtom = atom<number | null>(DEFAULT_AMOUNT_CENTS);

/**
 * The square being topped up, when the typed target already holds one.
 *
 * Without it the map cannot tell "a new square appears" from "an existing one
 * grows", and drew a phantom new tile beside the buyer's real square — so a
 * holder at 2% topping up to 10% saw twelve percent of themselves.
 */
export const previewHandleAtom = atom<string | null>(null);

/**
 * Set while a paid square is still on its way onto the wall.
 *
 * Checkout returns the buyer the instant the payment succeeds, but the square
 * only exists once the webhook lands. Nothing asks the server on a timer any
 * more, so without this the wall would sit unchanged until the buyer thought to
 * press refresh — a person who has just paid, looking at a wall with no square
 * on it, wondering what went wrong. This is the state that says otherwise, and
 * the loop in `WallEffects` is what chases the square down.
 */
export const awaitingAtom = atom<{ handle: string; timedOut: boolean } | null>(null);

/**
 * The square that just landed for this visitor — stays until they dismiss it,
 * so the post is a beat, not a 1.2s flash.
 */
export const claimedAtom = atom<{ handle: string; share: number } | null>(null);

/** Handle this browser last paid for, so we can say when it shrinks. */
export const heldAtom = atom<string | null>(null);

/** Set when that square just lost area to somebody else. */
export const dilutedAtom = atom<{ handle: string; before: number; after: number } | null>(null);

/**
 * `fresh` skips the CDN copy. A routine look is happy to be answered from the
 * edge — that is what keeps looking cheap — but a refetch triggered by a
 * purchase must see the purchase.
 */
async function fetchState(fresh = false): Promise<MapState> {
  const url = fresh ? `/api/state?fresh=${Date.now()}` : "/api/state";
  const response = await fetch(url, fresh ? { cache: "no-store" } : undefined);
  if (!response.ok) throw new Error(`Wall unavailable (${response.status})`);
  return response.json();
}

/**
 * Names every wall refresh, whoever asked for it.
 *
 * Two `useMutation` calls are two separate pending flags, so on its own the
 * button would sit still through a refresh the buy panel triggered. The shared
 * key is what puts them back together: `useIsMutating` answers for the pull
 * itself rather than for one component's copy of it.
 */
const REFRESH_KEY = ["wall", "refresh"] as const;

/**
 * Ask for the wall again, and say whether a pull is in flight.
 *
 * `fresh` bypasses the CDN copy. A routine look does not need that — being
 * answered from the edge is what makes looking cheap — but a purchase that just
 * landed does.
 *
 * The answer is written into `wallAtom` and the query cache is never read: the
 * wall keeps one owner, and this is a fetch with a pending flag rather than a
 * second copy of the state to drift from it. `mutate` keeps its rejection to
 * itself, which is the behaviour we want — a failed pull leaves the wall as it
 * stands and the control pressable, which beats an error over the map — and
 * mutations do not retry, so pressing again is the only retry there is.
 */
export function useWallRefresh() {
  const setWall = useSetAtom(wallAtom);
  const { mutate } = useMutation<MapState, Error, boolean>({
    mutationKey: REFRESH_KEY,
    mutationFn: fetchState,
    onSuccess: setWall,
  });

  return {
    refresh: useCallback((fresh = false) => mutate(fresh), [mutate]),
    refreshing: useIsMutating({ mutationKey: REFRESH_KEY }) > 0,
  };
}

/**
 * Everything the wall does on its own: reading the handle checkout sends back,
 * clearing a pulse, and chasing a paid square onto the wall. Renders nothing —
 * it exists to hold effects inside the store.
 */
function WallEffects() {
  const wall = useAtomValue(wallAtom);
  const flash = useAtomValue(flashAtom);
  const awaiting = useAtomValue(awaitingAtom);
  const claimed = useAtomValue(claimedAtom);
  const held = useAtomValue(heldAtom);
  const setWall = useSetAtom(wallAtom);
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
    const url = new URL(window.location.href);
    const held = url.searchParams.get("held");
    if (!held) return;
    setAwaiting({ handle: held, timedOut: false });
    url.searchParams.delete("held");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
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
    const standing = wall.standings.find((s) => s.holder.handle === awaiting.handle);
    if (!standing) return;
    setClaimed({ handle: awaiting.handle, share: standing.share });
    setFlash(awaiting.handle);
    setAwaiting(null);
  }, [awaiting, wall.standings, setClaimed, setFlash, setAwaiting]);

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
      if (Date.now() - started > 40_000) {
        setAwaiting((current) => (current ? { ...current, timedOut: true } : null));
        return;
      }
      try {
        setWall(await fetchState(true));
      } catch {
        // Keep trying; the next tick is 1.5s away.
      }
      if (live) timer = setTimeout(tick, 1_500);
    };
    timer = setTimeout(tick, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [chasing, setWall, setAwaiting]);

  return null;
}

interface ProviderProps {
  initialState: MapState;
  children: ReactNode;
}

/**
 * The wall the page arrived with, and the means to ask for a newer one.
 *
 * Nothing here runs on a clock. The page is prerendered and revalidated on the
 * server — on a short interval, and immediately when a purchase lands — so the
 * HTML a visitor is handed is already current. Polling on top of that spent a
 * request per tab per interval re-learning what the page had just told them,
 * and made every idle tab a standing cost. Asking once, when somebody actually
 * wants to know, is the same information for a fraction of the traffic.
 */
export function MapProvider({ initialState, children }: ProviderProps) {
  /*
   * A store per mount, rather than jotai's module-level default one.
   *
   * The default store belongs to the module, so everything importing these
   * atoms in the same process shares it — including two requests being rendered
   * concurrently on the server, which is one visitor's wall bleeding into
   * another's HTML. Creating the store here scopes it to this render, and
   * seeding it in the same breath means no component ever sees it empty.
   */
  const [store] = useState(() => {
    const created = createStore();
    created.set(wallAtom, initialState);
    return created;
  });

  /*
   * The query client is created here for the same reason, and holds nothing
   * else. Nothing is prefetched on the server — the wall arrives as a prop —
   * so there is no cache to dehydrate across the boundary; it exists to give
   * the refresh mutation somewhere to live.
   */
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <WallEffects />
        {children}
      </Provider>
    </QueryClientProvider>
  );
}
