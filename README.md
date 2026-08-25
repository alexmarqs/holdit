# holdit.lol

**A wall of everyone paying for attention, sized by live spend.**

Your area is your spend as a share of everyone else's. New spend takes a slice
sized to what they paid. Live spend is half every 14 days if nobody buys — until
then, the wall does not change.

No auction. Nobody outbid. Nobody pushed off. From $1.

---

## Running it

```bash
pnpm install
pnpm db:local                 # Postgres on :55432
cp .env.example .env.local
pnpm db:migrate && pnpm db:seed
pnpm dev
```

`db:seed` applies [`scripts/seed.sql`](./scripts/seed.sql) to the running container: the
founding wall is development data, so it is SQL mounted beside the compose file rather
than TypeScript the app could import. It puts the founding squares up, and the buy →
map-resize loop works end to end from there. The database is required: there is no in-memory fallback, because a
deployment that lost its `DATABASE_URL` would otherwise present a demo wall as a real
one — a failure that looks exactly like success.

```bash
pnpm test              # unit tests; no database
pnpm test:integration  # needs the container: four suites against real Postgres
pnpm typecheck
pnpm lint              # biome; `pnpm lint:fix` writes fixes
pnpm build             # prerenders the wall, so it needs the database too
```

`pnpm test:integration` points itself at `scripts/docker-compose.yaml`'s database and truncates
between tests, ignoring `DATABASE_URL` so a real one can never be emptied. Override with
`TEST_DATABASE_URL` if you need somewhere else.

## Testing payments

With a test key set, pay on the Stripe-hosted page with card `4242 4242 4242 4242`. Only
the number is a value Stripe reserves; the expiry needs any future date (`12/34`), the
CVC any three digits, and the rest of the form takes anything. Other cards — declines,
3DS challenges — are in [Stripe's testing docs](https://docs.stripe.com/testing).

Run `pnpm stripe:listen` alongside `pnpm dev`, or nothing appears on the wall: the square
is created by the `checkout.session.completed` webhook, not by the redirect back. Put the
secret it prints in `STRIPE_WEBHOOK_SECRET` — not the one on the Dashboard's endpoints
page, which signs a different endpoint and fails every check here.

## Going live

Copy `.env.example` to `.env` and fill in only what you need. Every integration except
the database degrades rather than failing.

| Set this | To get |
|---|---|
| `DATABASE_URL` | **Required.** Then `pnpm db:migrate`. `pnpm db:seed` is the local founding wall — not production. |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Hosted checkout and signed `checkout.session.completed` webhooks. Without a key, development purchases are recorded directly. |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Rate limiting on checkout, state, clicks, visits, and a few other routes. |
| `NEXT_PUBLIC_APP_URL` | Canonical production origin and checkout return URL. |
| `CLICK_HASH_SALT` | Secret salt for privacy-preserving click fingerprints. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Takedown and refund contact shown on the site. |

## Layout

No monorepo. Domain, persistence, helpers, routes, and components live under `src/`.
The shared layers use namespaced `@holdit/*` aliases; application code uses `@/*`.

```
src/app/          pages and route handlers
src/components/   wall, panels, shared UI, and metadata
src/core/         @holdit/core   pure domain: decay, share, squarify, thresholds
src/db/           @holdit/db     Drizzle schema and per-domain queries
src/lib/          Stripe and site clients; helpers under utils/
drizzle/                       generated SQL migrations and schema snapshots
scripts/                       local Postgres: the compose file, and the founding wall as SQL
```

`src/core/` imports nothing from the other folders and does no I/O. That is what makes
the pricing behaviour — how a new buy takes a slice, and how live spend fades —
testable without a database.

Postgres is the only backend. Queries live in `src/db/queries/` and take the Drizzle
client as their first argument. Import the client from `@holdit/db/client`;
`src/db/index.ts` is types only, so a client component cannot pull a connection pool
in by accident.

## The parts worth knowing

**Decay with overflow persistence.** Live spend is half every 14 days if nobody buys,
so shares stay put until new money arrives. Spend above the display cap fades at half
rate, implemented statelessly in two passes: sum live spend at the normal half-life to
get the wall total, then re-price each purchase as
`min(p, cap)·0.5^(dt/H) + max(0, p−cap)·0.5^(dt/2H)`. The portion that could never have
been displayed persists twice as long — big money buys persistence, not dominance.

**Share.** Raw share, then the cap water-filled with its overflow redistributed across
everyone still under it, then the minimum-size floor funded by those with headroom.
The ceiling is `ceilingFor(n)` in `src/core/config.ts`: the whole wall at one square,
never above 60% on a young wall, 10% from 16 squares. Extra spend past the cap does
not grow the tile.

**No sockets, no in-process cache.** The page is prerendered (`revalidate = 30`) and
`revalidatePath("/")` on purchase. Visitors ask `/api/state` when they refresh or chase
a paid square onto the wall; that route is the CDN cache (`s-maxage=10`). Online is
visit beacons into the `visits` table, not presence. `src/db/cache.ts` only collapses
in-flight loads — it holds nothing between requests, so two instances cannot disagree
about the same wall.

**Purchases are not a race.** No locks, no queue, no version counter, no boundary policy.
Position is a share of a sum, so two simultaneous buyers cannot conflict.

## Not built yet

Holder profile/dashboard pages and email delivery.

If mail is needed: Resend or Cloudflare Email for transactional send. Loops for
marketing and workflows.

If monitoring is needed: Sentry for errors. PostHog for product analytics.
