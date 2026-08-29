import { db } from "@holdit/db/client";
import { getMapState } from "@holdit/db/queries/map";
import { Treemap } from "@/components/map/treemap";
import { AwaitingSquare } from "@/components/panels/awaiting-square";
import { BuyPanel } from "@/components/panels/buy-panel";
import { Listing } from "@/components/panels/listing";
import { ActivityCard, TrendingCard } from "@/components/panels/side-cards";
import { VisitBeacon } from "@/components/visit-beacon";
import { WallProvider } from "@/context/wall-provider";
import { JsonLdStructuredData } from "@/lib/seo/structured-data";

export const revalidate = 30; // 30 seconds is the maximum time between revalidations for this page

export default async function MapPage() {
  const state = await getMapState(db);

  return (
    <WallProvider initialState={state}>
      <JsonLdStructuredData state={state} />
      <VisitBeacon />
      <h1 className="sr-only">
        holdit.lol — a wall that forgets: new spend takes a slice sized to what they paid
      </h1>

      {/*
       * Map height is viewport-locked, not leftover flex. The buy form can
       * grow (cap copy, the phone Preview hint) without shrinking the canvas
       * and re-packing the tiles. Extra form height just scrolls the page.
       */}
      <section className="flex flex-col">
        <AwaitingSquare />
        <div id="claim" className="flex flex-col">
          <BuyPanel />
          <div
            id="map"
            className="flex h-[max(12.5rem,calc(100svh-var(--header-h)-var(--buy-stack-h)))] min-h-50 min-w-0 shrink-0 flex-col sm:min-h-70"
          >
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
