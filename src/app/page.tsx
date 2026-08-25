import { db } from "@holdit/db/client";
import { getMapState } from "@holdit/db/queries/map";
import { Treemap } from "@/components/map/treemap";
import { MapProvider } from "@/components/map-provider";
import { AwaitingSquare } from "@/components/panels/awaiting-square";
import { BuyPanel } from "@/components/panels/buy-panel";
import { CounterStrip } from "@/components/panels/counter-strip";
import { Listing } from "@/components/panels/listing";
import { ActivityCard, TrendingCard } from "@/components/panels/side-cards";
import { StructuredData } from "@/components/structured-data";
import { VisitBeacon } from "@/components/visit-beacon";

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
    <MapProvider initialState={state}>
      <StructuredData state={state} />
      <VisitBeacon />
      {/*
        The visible headline is an h2 because it changes with the amount, which
        makes a poor document title. This gives the page one stable h1 for
        crawlers and screen readers without putting a moving number in it.
      */}
      <h1 className="sr-only">
        holdit.lol — a wall that forgets: new spend takes a slice sized to what they paid
      </h1>

      <section className="flex min-h-[calc(100svh-var(--header-h))] flex-col lg:h-[calc(100svh-var(--header-h))] lg:min-h-[640px]">
        <CounterStrip />
        <AwaitingSquare />

        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 pt-3 pb-5">
          <div
            id="claim"
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border"
          >
            <BuyPanel />
            <div id="map" className="flex min-h-[330px] min-w-0 flex-1 flex-col lg:min-h-0">
              <Treemap />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-8">
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <ActivityCard />
          <TrendingCard />
        </div>
        <Listing />
      </div>
    </MapProvider>
  );
}
