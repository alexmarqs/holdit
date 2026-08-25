# holdit.lol

**A map of everyone paying for attention, sized by how much they're paying right now.**

You buy points. Your square's area is your share of all live points. Points decay on a
14-day half-life, so area is rented, not owned. The map resizes the instant anyone buys.

No auction. No countdown. No bidding. Display space at a published rate.

The map renders as a **bundle analyzer**: squares nest inside category groups the way a
build report groups modules into chunks, a *weigh by* control switches the sizing metric,
and tooltips read as an analyzer readout. Product requirements are in
[`holdit-spec.md`](./holdit-spec.md); the implementation design is in
[`docs/superpowers/specs/2026-08-21-holdit-app-design.md`](./docs/superpowers/specs/2026-08-21-holdit-app-design.md).

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
pnpm test          # needs the container up: four suites run against real Postgres
pnpm typecheck
pnpm lint          # biome; `pnpm format` writes fixes
pnpm build         # prerenders the wall, so it needs the database too
```

`pnpm test` points itself at `scripts/docker-compose.yaml`'s database and truncates between tests,
ignoring `DATABASE_URL` so a real one can never be emptied. Override with
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
| `DATABASE_URL` | **Required.** Then `pnpm db:migrate && pnpm db:seed`. |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Hosted checkout and signed `checkout.session.completed` webhooks. Without a key, development purchases are recorded directly. |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Rate limiting on `/api/state`, `/api/checkout` and `/c/*`. |
| `NEXT_PUBLIC_APP_URL` | Canonical production origin and checkout return URL. |
| `CLICK_HASH_SALT` | Secret salt for privacy-preserving click fingerprints. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Takedown and refund contact shown on the site. |

## Layout

No monorepo. Domain, persistence, utilities, routes, and components live under `src/`.
The shared layers use namespaced `@holdit/*` aliases; application code uses `@/*`.

```
src/app/          pages and route handlers
src/components/   wall, panels, shared UI, and metadata
src/core/         @holdit/core   pure domain: decay, share, squarify, thresholds
src/db/           @holdit/db     Drizzle schema and per-domain queries
src/utils/        @holdit/utils  formatting, domains, hashing, environment, rate limiting
drizzle/                       generated SQL migrations and schema snapshots
scripts/                       local Postgres: the compose file, and the founding wall as SQL
```

`src/core/` imports nothing from the other folders and does no I/O. That is what makes
the pricing behaviour — who shrinks when someone buys — testable without a database.

`src/db/repository.ts` declares one interface with two implementations behind it
(`drizzle/`, `mock/`). `src/db/index.ts` picks one from the environment, so switching
between them is a config change and nothing else.

## The parts worth knowing

**Decay with overflow persistence.** Points above the 10% display cap decay at half rate,
implemented statelessly in two passes: sum live points at the normal half-life to get the
map total, then re-price each purchase as
`min(p, cap)·0.5^(dt/H) + max(0, p−cap)·0.5^(dt/2H)`. The portion that could never have
been displayed persists twice as long — big money buys persistence, not dominance.

**Share.** Raw share, then the cap water-filled with its overflow redistributed across
everyone still under it, then the minimum-size floor funded by those with headroom. The
cap raises itself when the holder count makes 10% unreachable, so the map never has a gap.

**No materialised points table.** The rows are cached for 60s (`src/db/cache.ts`,
invalidated on purchase); the arithmetic is recomputed per request because it depends on
the caller's canvas size and the current instant. One code path, microseconds of CPU.

**Purchases are not a race.** No locks, no queue, no version counter, no boundary policy.
Position is a share of a sum, so two simultaneous buyers cannot conflict.

## Not built yet

Holder profile/dashboard pages and email delivery.
