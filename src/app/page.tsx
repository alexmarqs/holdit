import { db } from "@holdit/db/client";
import { getMapState } from "@holdit/db/queries/map";
import { Treemap } from "@/components/map/treemap";
import { AwaitingSquare } from "@/components/panels/awaiting-square";
import { BuyPanel } from "@/components/panels/buy-panel";
import { Listing } from "@/components/panels/listing";
import { ActivityCard, TrendingCard } from "@/components/panels/side-cards";
import { VisitBeacon } from "@/components/visit-beacon";
import { WallProvider } from "@/context/wall-provider";
import { WALL_HEADING } from "@/lib/seo/copy";
import { JsonLdStructuredData } from "@/lib/seo/structured-data";

export const revalidate = 30; // 30 seconds is the maximum time between revalidations for this page

export default async function MapPage() {
  const state = await getMapState(db);

  return (
    <WallProvider initialState={state}>
      <JsonLdStructuredData state={state} />
      <VisitBeacon />
      <h1 className="sr-only">{WALL_HEADING}</h1>

      <section className="flex flex-col">
        <AwaitingSquare />
        <div id="claim" className="flex flex-col">
          <BuyPanel />
          <div id="map" className="flex min-w-0 flex-col">
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
