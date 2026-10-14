# How the wall is built

The product rules live in `src/core/`. This note is what the running app does
with them. Where an older design note disagrees with the code, the code is the
authority.

## Decay

Live spend is half every 14 days if nobody buys. One rate for every dollar, so
shares stay still until someone else pays. Extra spend past the cap does not
fade slower; it holds the cap as others buy.

`HALF_LIFE_DAYS` and `HEAT_WINDOW_DAYS` in `src/core/config.ts` happen to match.
Move both together or squares will render cold while still holding half their
value.

## Share

Raw share, then the cap water-filled with its overflow redistributed across
everyone still under it. The ceiling is `ceilingFor(n)` in `src/core/config.ts`:
the whole wall at one square, never above 60% on a young wall, 10% from 16
squares. Extra spend past the cap does not grow the tile; it holds the cap as
others buy. The minimum-tile floor is applied to *area* at layout time
(`placeWall`), not to the numeric share.

## Reads

No sockets, no in-process wall cache. The page is ISR (`revalidate = 30`) and
`revalidatePath("/")` on a paid purchase. Refresh and the post-checkout wait
hit `/api/state` (`s-maxage=10`; `?fresh=` is `no-store`). “Online” is an
approximate 15-minute visit window from the wall snapshot; the hydrated client
shows at least the person viewing it. `getMapState` only collapses in-flight
loads on one instance — live requests share one query; a print stamp is keyed
by `now` so it cannot steal that query. Nothing is kept after it settles, so
two instances cannot disagree about the same wall. TTLs live in
`src/lib/http-cache.ts`.

## Money

Shares are Big.js. Stripe and Postgres store integer cents. Decay is
`0.5^(age/half-life)` — Big.pow is integer-only, so that factor stays IEEE.
Every ratio after that (`1.6/n`, live/total, water-fill) is
[big.js](https://github.com/mikemcl/big.js). Tile labels never round a measured
share up; they may sum to 99.99% the way other treemaps and dashboards do.

## Prints

Prints are immutable. `/print/{at}` tags and `/api/og?at=` images are one URL,
one body, `immutable` for a year. A post-pay share from the checkout banner
uses `/print/p/{purchaseId}` and `/api/og?p=` so the card is that buy — named
and ringed on the wall — not a 30-second time bucket that may already be
cached. A future or junk stamp is `no-store` so the CDN cannot freeze a 302 or
the marketing poster under a URL that later becomes a real print. Every dataset
query is capped at the print timestamp; current moderation still applies so a
rejected square cannot reappear in a newly rendered old print. Bare `/api/og`
is the marketing poster (`s-maxage=1d`, SWR).

## Logos

The live wall hotlinks Google. A PNG cannot (no CORS), so Download points each
mark at `GET /api/favicons/{domain}` — image bytes with `s-maxage=30d`. One
path per domain, so the CDN key is the square. A POST of the whole wall could
never sit on the edge: every set of handles was a unique body. After the first
miss the function does not run. OG still fetches Google in-process
(`ImageResponse` needs bytes, not a URL) into the Next Data Cache, so two
prints of the same square do not pay Google twice.

## Writes

Same-square purchases are serialized, wall reads are not. A short PostgreSQL
transaction and holder-scoped advisory lock protect the first destination,
Stripe idempotency, and same-square top-ups. Different squares can still be
purchased concurrently because position is a share of a sum. Their activity
percentages are a best-effort snapshot; the money and resulting wall remain
exact.

## Database

Postgres is the only backend. The app reaches it through `DATABASE_URL` and the
`postgres` driver. Queries in `src/db/queries/` take the Drizzle client as
their first argument. Import the client from `@holdit/db/client`.
`src/db/index.ts` exports types only, so a client component cannot pull a
connection pool in by accident.

Local development is the Postgres 17 container in
`scripts/docker-compose.yaml`. In production the client disables prepared
statements, which is what a transaction-mode pooler requires. The purchase
transaction still runs as one unit, so the advisory lock holds.

`DATABASE_URL` is required at startup. A missing URL throws. It does not fall
back to the founding wall.

## Boundaries

Production code under `src/core/` imports nothing from `src/app`, `src/db`,
`src/lib`, or `src/components`, and it does no I/O. One test,
`src/core/spend/promise.test.ts`, imports `formatShare` so the label a buyer
is shown stays tied to the quote the wall will deliver.
