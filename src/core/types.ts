export interface Purchase {
  id: string;
  holderId: string;
  amountCents: number;
  createdAt: number;
  refundedAt: number | null;
}

export interface Holder {
  id: string;
  handle: string;
  url: string;
  tagline: string | null;
  createdAt: number;
}

/** A square plus everything derived from its purchases and clicks. */
export interface HolderStanding {
  holder: Holder;
  /** Spend still counting towards area, after fading. */
  liveCents: number;
  /** Every dollar ever spent. Never fades — you lose prominence, not history. */
  allTimeCents: number;
  clicksAllTime: number;
  lastPurchaseAt: number | null;
  /** Latest live purchase on this square — the print the buyer should share. */
  lastPurchaseId: string | null;
  /** Share of the map, after the cap and the floor. */
  share: number;
  /** Share of live spend before anything was clamped. */
  rawShare: number;
  capped: boolean;
  floored: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ActivityEvent {
  id: string;
  handle: string;
  kind: "bought_in" | "topped_up";
  amountCents: number;
  shareBefore: number | null;
  shareAfter: number;
  at: number;
}

export interface MapCounters {
  /** Distinct visitors seen inside the online window; null when unavailable. */
  onlineNow: number | null;
  /**
   * Every counted click ever. A young wall's "today" resets to nothing each
   * morning, so this is the figure worth publishing early on.
   */
  clicksAllTime: number;
  visitorsSinceLaunch: number;
  /** Sum of live, faded spend. Real money, not a list price. */
  liveCents: number;
  squaresLive: number;
}

export interface TrendingRow {
  handle: string;
  /** Counted clicks inside `TRENDING_WINDOW_MS`, not a per-hour rate. */
  clicksInWindow: number;
  share: number;
}

/** The single payload every surface of the map renders from. */
export interface MapState {
  standings: HolderStanding[];
  counters: MapCounters;
  activity: ActivityEvent[];
  trending: TrendingRow[];
  generatedAt: number;
}
