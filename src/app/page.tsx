import { db } from "@holdit/db/client";
import { getMapState } from "@holdit/db/queries/map";
import { Treemap } from "@/components/map/treemap";
import { AwaitingSquare } from "@/components/panels/awaiting-square";
import { BuyPanel } from "@/components/panels/buy-panel";
import { Listing } from "@/components/panels/listing";
import { ActivityCard, TrendingCard } from "@/components/panels/side-cards";
import { StructuredData } from "@/components/structured-data";
import { VisitBeacon } from "@/components/visit-beacon";
import { WallProvider } from "@/components/wall-provider";

/*
 * Prerendered and refreshed on a short interval, not rendered per visit.
 *
 * `force-dynamic` was here on the grounds that the wall is live. It is — but
 * liveness comes from the client asking `/api/state` when there is a reason to:
 * the refresh control, and the loop that chases a paid square onto the wall.
 * That route is edge-cached and therefore flat in audience, while rendering
 * this page per visit cost a full pass over the wall's queries every time
 * anybody looked, and the HTML being a few seconds old is invisible.
 *
 * Two things had to move before this was possible: counting a visitor (now a
 * beacon, since a prerendered page would only have counted on revalidation) and
 * the `?at=` share unfurl (now `/print/[at]`, since reading `searchParams` here
 * opted the whole route out of static rendering anyway).
 */
export const revalidate = 30;

export default async function MapPage() {
  const state = await getMapState(db);

  return (
    <WallProvider initialState={state}>
      <StructuredData state={state} />
      <VisitBeacon />
      {/*
        The visible headline is an h2 so the claim line can stay short. This
        keeps one stable h1 for crawlers and screen readers.
      */}
      <h1 className="sr-only">
        holdit.lol — a wall that forgets: new spend takes a slice sized to what they paid
      </h1>

      <section className="flex h-[calc(100svh-var(--header-h))] min-h-[540px] flex-col">
        <AwaitingSquare />
        <div id="claim" className="flex min-h-0 flex-1 flex-col">
          <BuyPanel />
          <div id="map" className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Treemap />
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-6 pb-8">
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <ActivityCard />
          <TrendingCard />
        </div>
        <Listing />
      </div>
    </WallProvider>
  );
}
