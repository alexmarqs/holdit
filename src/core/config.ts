/**
 * Every number that shapes the map. These are settings, not constants — they
 * are meant to be tuned once the map has real traffic.
 */

import { Big } from "./big";

export const MS_PER_DAY = 86_400_000;

/**
 * Spend loses half its map value every 14 days. Area is rented, not owned.
 *
 * Read as "how fast a square decays" this looks harsh, and lengthening it to a
 * month has been considered and turned down. It is the wrong reading: decay is
 * uniform, so if nobody buys, every square fades together and the map is
 * unchanged — a share only falls when somebody *else* buys. What this number
 * actually sets is how quickly new money can displace old, which makes it the
 * wall's contestability rather than its generosity. Doubling it would entrench
 * whoever is already here, soften the one claim a ranked pay-to-be-seen board
 * cannot make, and roughly halve what holding a position costs over a year.
 *
 * `HEAT_WINDOW_DAYS` below is a separate constant that happens to match; move
 * both together or squares will render cold while still holding half their
 * value.
 */
export const HALF_LIFE_DAYS = 14;

/** No square renders larger than this share — once there are enough squares for it to mean anything. */
export const MAX_SHARE = 0.1;

/**
 * How much ceiling the wall hands out in total, as a multiple of itself.
 *
 * A ceiling of exactly `1/n` does not merely bind the biggest square — it fixes
 * every square, because equal shares are the only way n squares can each stay
 * at or below `1/n` and still add up to the wall. Ten squares under a 10% cap
 * was precisely that case: the wall rendered a $19 square and a $354 square at
 * identical size, and no amount of spending changed anything.
 *
 * So the ceiling is never tighter than this multiple of `1/n`. At 1.6 no more
 * than `1/1.6` of the squares can sit at the ceiling at once, which leaves at
 * least a third of the wall sized by what people actually paid. Raising it
 * loosens the cap and lets the top squares dominate; lowering it towards 1
 * flattens the wall again.
 */
export const CEILING_BUDGET = 1.6;

/**
 * The loosest the ceiling ever gets on a wall that has more than one square.
 *
 * `CEILING_BUDGET / n` alone reaches 80% at two squares, which hands a whale
 * four fifths of the youngest, most fragile wall. This is the other half of the
 * promise: a big spender is clearly dominant from their first purchase, and
 * cannot erase the wall they are buying into.
 */
export const YOUNG_WALL_MAX_SHARE = 0.6;

/** Nobody becomes a pixel. CSS px², converted to a share at layout time. */
export const MIN_TILE_AREA = 460;

/** Areas are compressed so the tail stays clickable. Stated under the map. */
export const AREA_EXPONENT = 0.75;

/** Warmth runs from cool to lime over this window. */
export const HEAT_WINDOW_DAYS = 14;

/**
 * How recently somebody must have been seen to count as online.
 *
 * Requests, not held connections — so this is "seen in the last few minutes"
 * rather than "connected right now". Slightly less precise, and it costs no
 * sockets, has no connection ceiling and survives any amount of traffic.
 *
 * Fifteen minutes, not five, because of what actually gets measured. A visitor
 * announces themselves when the page loads and again if they press refresh, and
 * nothing else speaks for them — so at five minutes somebody reading the wall
 * quietly dropped out of the count while still sitting in front of it. Widening
 * the window makes the figure mean what the beacon can honestly support: who
 * has been here lately.
 */
export const ONLINE_WINDOW_MS = 15 * 60 * 1000;

/**
 * How long before the same address clicking the same square counts again.
 *
 * An hour was too blunt. Clicks buy no area, so the window is not defending the
 * map — it is only deciding whether "clicks" means *people who were interested*
 * or *times a link was opened*. At an hour, somebody who opened a square in the
 * morning and again after lunch counted once, which undercounts real interest
 * for no gain.
 *
 * Fifteen minutes, to match `ONLINE_WINDOW_MS`, so the app has one idea of how
 * long somebody counts as present rather than two arbitrary ones. The beacon's
 * own 60-per-minute limit is what stops a loop; this is not a rate limit.
 *
 * Not retroactive: `trackClick` freezes the decision on the row at insert, and
 * counting reads that, so past rows keep whatever they were. The published
 * totals rise faster from here rather than jumping.
 */
export const CLICK_DEDUPE_WINDOW_MS = 15 * 60 * 1000;

/**
 * The largest share any one square may hold on a wall of `n` squares.
 *
 * One rule, tightening as the wall grows: loose enough on a young wall that a
 * big spender is clearly dominant, settling onto `MAX_SHARE` once there are
 * enough squares for a tenth each to mean something. It reaches 10% at sixteen
 * squares and stays there.
 *
 * This replaced a two-regime version — 60% below ten squares, 10% from ten up —
 * which had a cliff and a dead zone either side of it. The cliff: the tenth
 * square to arrive dropped the biggest holder from 20.8% to 10% in one step,
 * for a dollar. The dead zone: at ten squares the cap was exactly `1/n`, which
 * forces every square to the same size no matter what anyone paid. Neither is
 * reachable from a ceiling that never falls below `CEILING_BUDGET / n`.
 */
export function ceilingFor(n: number): number {
  // A lone square holds the whole wall. Any ceiling below 1 here would leave
  // part of the wall belonging to nobody, and the founding square rendering
  // "60.0%" of a wall it wholly occupied.
  if (n <= 1) return 1;
  const budget = new Big(String(CEILING_BUDGET)).div(n);
  const floor = budget.gt(MAX_SHARE) ? budget : new Big(String(MAX_SHARE));
  const young = new Big(String(YOUNG_WALL_MAX_SHARE));
  return (floor.gt(young) ? young : floor).toNumber();
}

/*
 * Floors for publishing a number at all.
 *
 * A counter reading "3 visitors" is worse than no counter: it invites a verdict
 * on the wall's size before anyone has looked at the wall. Absence claims
 * nothing, so each figure stays hidden until it carries its own weight. These
 * are presentation floors only — nothing is ever rounded up or invented, and
 * the number shown is always the true one.
 *
 * There is no floor on "online". It is the one figure a visitor makes true by
 * arriving, so a small one is not a verdict on the wall — and a floor only made
 * the row appear and vanish as the count crossed it. Zero is still hidden,
 * because "0 online" is a claim nobody is here while somebody plainly is.
 */
export const MIN_SHOWN_CLICKS = 100;
export const MIN_SHOWN_VISITORS = 250;
/** Per square, where the bar is lower because the wall supplies the context. */
export const MIN_SHOWN_TILE_CLICKS = 10;

/**
 * The window "trending" measures over.
 *
 * One hour is the right unit for a busy wall and useless for a new one: a site
 * with a few hundred clicks a day is empty in most hours, so the card blinked
 * in and out at random and was usually missing entirely. A day is long enough
 * to always have something to say and short enough that it still moves.
 */
export const TRENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * How much of a site's own line we store.
 *
 * Ninety characters was one line under the name on a large square, so the
 * listing and a wide tile both clipped in empty space. Three wrapped lines
 * is what those surfaces actually hold; CSS clamps from there.
 */
export const TAGLINE_MAX_CHARS = 220;

const TAGLINE_MIN_CHARS = 12;

/**
 * A site's description, cut at a word so a stored ellipsis is a sentence
 * ending rather than a mid-word glitch.
 */
export function clipTagline(text: string): string | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length < TAGLINE_MIN_CHARS) return null;
  if (trimmed.length <= TAGLINE_MAX_CHARS) return trimmed;
  const clipped = trimmed.slice(0, TAGLINE_MAX_CHARS - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).replace(/[,;:.\s]+$/, "")}…`;
}
