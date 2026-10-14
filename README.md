# holdit.lol

**A wall of everyone paying for attention, sized by live spend.**

Live site: [holdit.lol](https://holdit.lol)

Your share follows your live spend against everyone else's. New spend takes a
slice sized to what they paid. Displayed spend is half every 14 days — one rate
for every dollar. Extra spend past the cap does not fade slower; it holds the
cap as others buy.

No auction. Nobody outbid. Nobody pushed off. From $1.

The source is [MIT](./LICENSE). `package.json` stays `private` so npm will
refuse to publish the application.

## Stack

| Concern | Choice |
|---|---|
| App | [Next.js](https://nextjs.org) 16, React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Postgres 17, [Drizzle](https://orm.drizzle.team) |
| Payments | [Stripe](https://stripe.com) Checkout |
| Rate limiting | [Upstash](https://upstash.com) Redis, skipped when unset |
| Money math | [big.js](https://github.com/mikemcl/big.js) |
| Lint / format | [Biome](https://biomejs.dev) |
| Tests | [Vitest](https://vitest.dev) |

Node 22 or newer. The package manager is pnpm (`packageManager` in
`package.json`).

## Running it

```bash
pnpm install
pnpm db:local                 # Postgres on :55432
cp .env.example .env.local
pnpm db:migrate && pnpm db:seed   # first run, or after wiping the volume
pnpm dev                      # http://localhost:3001
```

Use `.env.local` for local development. It is gitignored. Next.js reads it, and
`drizzle.config.ts` loads it because drizzle-kit runs outside Next. Production
sets the same variables on the host. Do not commit them.

`db:seed` applies [`scripts/seed.sql`](./scripts/seed.sql) to the running
container: the founding wall is development data, so it is SQL mounted by
[`docker-compose.yaml`](./docker-compose.yaml) rather than TypeScript the app
could import. It puts the founding squares up, and the buy → map-resize loop
works end to end from there. The database is required: there is no in-memory
fallback, because a deployment
that lost its `DATABASE_URL` would otherwise present a demo wall as a real one
— a failure that looks exactly like success.

Postgres data lives in a Docker volume, so `pnpm db:local` followed by `pnpm
dev` is enough on later sessions. `pnpm db:migrate && pnpm db:seed` is only
needed on a fresh volume (first checkout, or after `docker compose down -v`).

```bash
pnpm test              # unit tests; no database
pnpm test:integration  # needs the container: five suites against real Postgres
pnpm typecheck
pnpm lint              # biome; `pnpm lint:fix` writes fixes
pnpm build             # prerenders the wall, so it needs the database too
```

`pnpm test:integration` points itself at the database from
`docker-compose.yaml` and truncates between tests, ignoring `DATABASE_URL` so
a real one can never be emptied. Override with `TEST_DATABASE_URL` if you need
somewhere else.

## Testing payments

With a test key set, pay on the Stripe-hosted page with card `4242 4242 4242
4242`. Only the number is a value Stripe reserves; the expiry needs any future
date (`12/34`), the CVC any three digits, and the rest of the form takes
anything. Other cards — declines, 3DS challenges — are in [Stripe's testing
docs](https://docs.stripe.com/testing).

Run `pnpm stripe:listen` alongside `pnpm dev`, or nothing appears on the wall:
the square is created by the `checkout.session.completed` webhook, not by the
redirect back. Put the secret it prints in `STRIPE_WEBHOOK_SECRET` — not the
one on the Dashboard's endpoints page, which signs a different endpoint and
fails every check here.

A database failure returns `500` so Stripe retries the same Checkout Session.
Purchase writes are idempotent on that session ID, so replay the failed webhook
before intervening. If a paid order still cannot be fulfilled after recovery,
reconcile it from the logged session ID and refund it manually.

## Configuration

Every integration except the database degrades rather than failing.

| Set this | To get |
|---|---|
| `DATABASE_URL` | **Required.** Then `pnpm db:migrate`. `pnpm db:seed` is the local founding wall — not production. |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Hosted checkout and signed `checkout.session.completed` webhooks. Without a key, development purchases are recorded directly. |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Rate limiting on checkout, state, clicks, visits, and a few other routes. |
| `NEXT_PUBLIC_APP_URL` | Canonical production origin and checkout return URL. |
| `CLICK_HASH_SALT` | Secret salt for privacy-preserving click fingerprints. Generate one with `openssl rand -hex 32`. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Takedown and privacy contact shown on the site. |

## Layout

No monorepo. Domain, persistence, helpers, routes, and components live under
`src/`. The shared layers use namespaced `@holdit/*` aliases; application code
uses `@/*`.

```
src/app/          pages and route handlers
src/components/   wall, panels, shared UI
src/context/      Jotai session atoms and the wall provider
src/hooks/        React Query and session hooks
src/core/         @holdit/core   pure domain: decay, share, squarify, thresholds
src/db/           @holdit/db     Drizzle schema and per-domain queries
src/lib/          API and site clients; SEO copy and JSON-LD; helpers under utils/
drizzle/          generated SQL migrations and schema snapshots
docker-compose.yaml   local Postgres
scripts/          founding wall and the test database, mounted by Compose
```

Production code under `src/core/` imports nothing from the other folders and
does no I/O. That is what makes the pricing behaviour — how a new buy takes a
slice, and how live spend fades — testable without a database. How that math
meets the page is written up in [docs/architecture.md](./docs/architecture.md).

Postgres is the only backend. Queries live in `src/db/queries/` and take the
Drizzle client as their first argument. Import the client from
`@holdit/db/client`; `src/db/index.ts` is types only, so a client component
cannot pull a connection pool in by accident.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). By participating you agree to the
[Code of Conduct](./CODE_OF_CONDUCT.md). Security reports go to the address in
[SECURITY.md](./SECURITY.md), not to a public issue.

## License

[MIT](./LICENSE) © [Alexandre Marques](https://twitter.com/alexlmarques)
