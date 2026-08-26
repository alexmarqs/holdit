import type { MapState } from "@holdit/core";
import { jsonLd, wallGraph } from "./json-ld";

/** JSON-LD for the wall. */
export function JsonLdStructuredData({ state }: { state: MapState }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD has no other injection point
      dangerouslySetInnerHTML={{
        __html: jsonLd({ "@context": "https://schema.org", "@graph": wallGraph(state) }),
      }}
    />
  );
}
