/**
 * Types only, on purpose.
 *
 * Re-exporting `database` here would put a connection pool one import away from
 * any module that only wanted a type — including a client component, where it
 * cannot run at all. Callers import `database` from `@holdit/db/client` and the
 * functions from `@holdit/db/queries/*`.
 *
 * `queries/` holds reads and writes together, one module per domain. Splitting
 * them apart put `recordPurchase` and `getHolderByHandle` in different folders
 * even though the purchase cannot be written without the read — so a change to
 * one domain meant editing two trees, and the split described the SQL verb
 * rather than the thing being changed.
 */
export type { Database } from "./client";
export type { TrackClickInput } from "./queries/clicks";
export type { MapRows } from "./queries/dataset";
export type { MapStateOptions } from "./queries/map";
export type { BuyInput, RecordPurchaseInput, RecordPurchaseResult } from "./queries/purchases";
export type { RecordVisitInput } from "./queries/visits";
