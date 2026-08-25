# holdit.lol — implementation design

Date: 2026-08-21

Product requirements live in `holdit-spec.md`. This document covers *how* the app is
built: structure, stack, the domain math, and the decisions taken where the product
spec left room.

> **Partly superseded, 2026-08-24.** Three things here were designed and then not
> built, and the code is the authority where they disagree:
>
> - **Supabase Realtime, `src/supabase/`, presence** (§2, §3, and the "online count"
>   in the realtime section) — none of it exists. There is no `@supabase/supabase-js`
>   dependency. Supabase hosts Postgres and nothing else. The online count comes from
>   the `visits` table: distinct visitors seen inside `ONLINE_WINDOW_MS`, written by a
>   `sendBeacon` on page load. Requests, not sockets — see `core/config.ts`.
> - **Polar checkout and `/api/webhooks/polar`** (§2 and the payments section) — the
>   payment provider is Stripe.
> - **The `Repository` interface and the in-memory backend** — removed on 2026-08-24;
>   see `2026-08-24-db-client-injection-design.md`. Queries take the Drizzle client as
>   their first argument and Postgres is the only backend.

## 1. Visual concept

The map is presented as a **bundle analyzer**, not a generic treemap. Squares are
packages; the map is a build output. Concretely:

- Tiles nest inside **category groups** (AI, Dev tools, Fintech, Marketing, Consumer)
  with group chrome and labels, the way webpack-bundle-analyzer groups chunks by folder.
- A **"weigh by"** control switches the sizing metric — `share %` / `live points` /
  `all-time $` — mirroring the analyzer's Stat / Parsed / Gzipped toggle.
- Tooltips are laid out as an analyzer readout (live points, all-time spend, share,
  last purchase) and end with the next detail-threshold upsell.
- Numerics are monospace and tabular throughout.

Palette: acid lime on graphite. `--primary #B4F03C`, `--ink #0E1210`, `--paper #F4F5F0`,
`--card #171B18`, `--live #4ADE80`. Radius `0.875rem`. Type: DM Sans + Geist Mono.
Recency heat ramp: `#3B4A44 → #6E8452 → #97C43F → #B4F03C`.

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16.3 App Router, React 19.2 |
| Package manager | pnpm |
| Styling | Tailwind CSS v4, CSS-first `@theme` in `app/globals.css` |
| Database | Supabase Postgres, accessed through Drizzle ORM 0.45 + postgres-js |
| Accounts | None. A square is identified by its domain; topping up means entering the same domain again. The payment provider holds the contact email. |
| Realtime | Supabase Realtime — Broadcast for purchase events, Presence for the online count |
| Client state | TanStack Query 5 — map state, counters, feeds; mutations invalidate |
| Payments | Polar hosted checkout + signature-verified webhook |
| Rate limiting | Upstash Redis, no-op when unconfigured |
| Lint / format | Biome |
| Tests | Vitest, over `core/` |

## 3. Structure

No monorepo. Package-shaped top-level folders, each with an `index.ts` barrel and a
`@holdit/*` path alias. Aliases are namespaced so `@holdit/supabase` cannot collide
with the real `@supabase/*` npm scope.

```
src/app/        Next.js routes only — pages and route handlers
src/core/       @holdit/core     pure domain: decay, share, squarify, grouping, thresholds
src/db/         @holdit/db       drizzle schema, queries, mutations, migrations, seed, mock store
src/supabase/   @holdit/supabase browser + server clients, realtime channels
src/ui/         @holdit/ui       primitives + map/hero/feed/buy components
src/utils/      @holdit/utils    formatting, favicons, ip hashing
src/email/      @holdit/email    notification templates (typed, not yet sent)
src/jobs/       @holdit/jobs     daily snapshot — driven by a cron route
```

`core/` has no imports from any other folder and no I/O. That is what makes the
pricing and layout math testable in isolation.

## 4. Data access

`db/repository.ts` declares a `Repository` interface. Two implementations satisfy it:

- `db/postgres-repository.ts` — real Postgres, used when `DATABASE_URL` is set.
- `db/mock/` — an in-memory store seeded with ~120 founding listings, used otherwise.

`db/index.ts` picks one at module load. Consequence: `pnpm dev` renders a full map with
zero credentials, and pointing `DATABASE_URL` at Supabase switches to live data with no
call-site changes.

Schema follows the product spec — `holders`, `purchases`, `clicks`, `snapshots` — plus
`visits`, so the launch counter is a plain `count(*)` over distinct visitors. There is no
accounts table and no `user_id`: a holder is its domain, and the contact email arrives
with the Polar order.

There is deliberately **no** `holder_points_live` table. The spec's concern is not
recomputing decay across every purchase on each page load, and that is solved by caching
the *dataset* — the rows — for 60s in `db/cache.ts`, invalidated on purchase. The derived
numbers depend on the caller's canvas size and on the current instant, and computing them
is microseconds of pure CPU. One code path instead of two.

## 5. Domain math

**Decay with overflow persistence.** The product spec says points above the 10% cap
decay at half rate. Implemented as a two-pass, stateless function so nothing extra is
stored:

1. Pass one sums live points per holder at the normal 14-day half-life to get the map total.
2. `capPoints = CAP × total`. Pass two recomputes each purchase as

```
live(p, dt) = min(p, capPoints) · 0.5^(dt/H) + max(0, p − capPoints) · 0.5^(dt/2H)
```

So the portion of a purchase that could never have been displayed anyway persists twice
as long. Big money buys persistence, not dominance, and the rule is a pure function of
the purchase row.

**Share.** Raw share, then the 10% cap with proportional redistribution of the overflow
across uncapped holders (three passes, converges), then the minimum-area floor.

**Area.** `share^0.75`, disclosed in the legend, so the tail stays clickable.

**Layout.** Squarified treemap (Bruls et al.) applied twice — once to lay out category
groups by summed weight, then once inside each group rect for its members.

**Detail thresholds.** `420px²` logo, `1,700px² & w>74` + domain, `5,200px² & w>108`
+ clicks and share, `15,000px² & w>175` + tagline. `nextRung()` computes the additional
share needed to reach the next rung and drives the tooltip upsell.

## 6. Live updates

A purchase writes a `purchases` row, refreshes `holder_points_live`, and broadcasts on
the `map` channel. Clients subscribed to that channel invalidate the React Query map
key; presence on the same channel produces the online count. Every client also relayouts
on a 60s interval so decay drift is visible without any event. Polling is the fallback
when Realtime is unconfigured.

Tiles are keyed by holder id and never rebuilt — only `transform`, `width` and `height`
change, under a 0.55s transition.

## 7. Payments

`POST /api/checkout` validates the URL and pack, then creates a Polar checkout session
and returns its URL. `POST /api/webhooks/polar` verifies the signature and appends the
purchase. When `POLAR_ACCESS_TOKEN` is absent the checkout route records the purchase
directly and returns a local redirect, so the buy → map-resize loop is demoable offline.
This bypass is refused when `NODE_ENV === "production"`.

## 8. Out of scope for this pass

Holder profile pages, `@vercel/og` share cards, the public analytics page, and email
delivery. `email/` carries the templates and their prop types so the sending job is a
small follow-up.
