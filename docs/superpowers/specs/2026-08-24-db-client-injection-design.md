# Passing the database client into queries

Date: 2026-08-24

The data layer currently reaches for a hidden singleton. `repository()` picks one of two
backends from the environment, and every query and mutation calls it internally, so no
call site declares what it talks to. This document replaces that with an explicit
parameter — the Drizzle client passed in as the first argument, the shape used by
`midday-ai` — and retires the second backend in favour of a real Postgres running in
Docker for development and tests.

## 1. Why

Two problems, one cause.

The `Repository` interface exists to make the in-memory store substitutable. Everything
downstream pays for that: two implementations of every operation that must not drift — a
worry both files state out loud, in `repository.ts:8` and `postgres-repository.ts:211` —
and a hidden dependency that no signature mentions.

The in-memory store also makes the tests weaker than they read. `concurrency.test.ts`
asserts that twenty simultaneous buyers of one domain produce one square — the exact
behaviour of `ON CONFLICT DO UPDATE` in `recordPurchase`. Against `MemoryRepository` it
tests a hand-written JavaScript imitation of that clause. The bug class it was written
to catch lives in Postgres, where the test never goes.

The `globalThis` cache in `database()` is a third, though a smaller one — it is a
workaround kept in app code for a development-time behaviour. See §3.

## 2. Decisions

| Question | Decision |
|---|---|
| Query signature | `fn(db, ...args)` — Drizzle client first, always |
| Client shape | Module-level `export const db`; no accessor, no `globalThis` |
| Second backend | Removed. Postgres is the only backend. |
| Database | A plain `postgres:17`, in Docker locally. No Supabase, no pooler. |
| Tests touching the database | Real Postgres in the same container, `TRUNCATE` between tests |
| Tests not touching the database | Given an in-test fixture builder instead |
| `DATABASE_URL` | Required. Absent is a startup error, not a fallback. |

## 3. The client

A module-level singleton, the shape `@midday/db` uses:

```ts
// src/db/client.ts
if (!serverEnv.databaseUrl) {
  throw new Error("DATABASE_URL is not set. Start the database with `docker compose up -d`.")
}

const sql = postgres(serverEnv.databaseUrl, {
  ...(isProduction ? {} : { idle_timeout: 30 }),
})

export const db = drizzle(sql, { schema, casing: "snake_case" })
export type Database = typeof db
```

**`max: 10` is dropped.** It is already the postgres-js default
(`node_modules/postgres/src/index.js:449`), so the line communicated a decision that was
never made. The ceiling itself matters — `loadMapDataset` fans out eight concurrent
queries — so it is worth knowing the default covers it, but not worth restating. The one
runtime where the default differs is Cloudflare Workers, which drops to `3`; this app runs
on Vercel.

**The check moves to module scope.** `DATABASE_URL` is now required, so failing at import
is better than failing at the first query: the build stops with this message instead of a
driver error several frames deep.

**`globalThis` is gone, and `idle_timeout` is what replaces it.** These two are one
decision, not two.

The problem is real either way: `src/db` reaches the app through the `@holdit/db/*` path
alias, so Next compiles it as app code and re-evaluates it on edit, and each re-evaluation
builds a new pool while the old one keeps its sockets. postgres-js leaves `idle_timeout`
unset by default (`index.js:452`), so nothing ever closes them — roughly ten reloads is
enough to exhaust a default `max_connections` of 100. `serverExternalPackages` cannot help:
it takes package names, not path aliases, so the module-level state `@midday/db` enjoys
would require promoting `src/db` to a real workspace package.

Caching on `globalThis` prevents the second pool from ever existing. Reaping idle
connections lets the orphan clean up after itself. The first is more precise; the second
keeps a workaround out of the application's own module and is a normal thing to configure
on a connection pool.

Scoping the reaper to development answers the objection that would otherwise apply — that
this is production configuration changed to fix a development problem. There are no hot
reloads in production, and a timer inside a suspended serverless instance is not something
worth reasoning about, so it is simply not set there.

Thirty seconds is chosen rather than inherited: longer than an edit-and-reload cycle, so
the live pool stays warm while you work, and short enough that an orphan is gone before the
next few reloads stack up.

### `prepare: false` is dropped

It was carried for Supabase's transaction pooler, which reassigns server connections per
transaction and so cannot keep a named prepared statement between them. The deployment
target is now a plain Postgres with no pooler in front of it, which makes the flag a pure
pessimization: it turns off prepared statements and the plan caching they buy, in exchange
for nothing.

postgres-js defaults it to `true` (`node_modules/postgres/src/index.js:458`), so removing
the line restores the default rather than choosing something new.

## 4. Query and mutation surface

`PostgresRepository`'s methods become free functions. Bodies are unchanged apart from
taking `db` as a parameter and calling siblings directly instead of through `this`.

```ts
// queries/holders.ts
export function getHolderById(db: Database, id: string): Promise<Holder | null>
export function getHolderByHandle(db: Database, handle: string): Promise<Holder | null>

// queries/map.ts
export function loadMapDataset(db: Database, now: number): Promise<MapDataset>
export function getMapState(db: Database, options?: MapStateOptions): Promise<MapState>

// mutations/purchases.ts
export function buy(db: Database, input: BuyInput): Promise<RecordPurchaseResult>

// mutations/clicks.ts
export function trackClick(db: Database, input: TrackClickInput): Promise<{ counted: boolean }>

// mutations/visits.ts
export function recordVisit(db: Database, input: RecordVisitInput): Promise<{ counted: boolean }>
```

Types move to the module that owns them: `MapDataset` to `queries/dataset.ts`,
`RecordPurchaseInput` and `RecordPurchaseResult` to `mutations/purchases.ts`,
`RecordClickInput` inlined into `mutations/clicks.ts`. `loadMapDataset` lives in
`queries/dataset.ts` rather than `queries/map.ts` so that `cache.ts` can import it
without a cycle: `getMapState` needs `cache.ts`, and `cache.ts` needs the dataset
query. The dependency runs one way — `dataset` ← `cache` ← `map`.

Row-to-domain mapping (`toHolder`, `toPurchase`) moves to `db/rows.ts`, shared by the
queries and by `recordPurchase`.

Eight call sites gain one import and one argument:

```ts
import { database } from "@holdit/db/client"
const state = await getMapState(database())
```

They are `app/page.tsx`, `api/state`, `api/og`, `api/visit`, `api/checkout`,
`api/webhooks/stripe`, `api/replay`, and `api/clicks`.

`index.ts` stays a barrel and stays **type-only**. Re-exporting `database` from it would
put a connection one import away from any module that only wanted a type, including a
client component. Type-only re-exports keep the barrel free of runtime cost.

`cache.ts` keeps its inflight-collapsing — it is a per-instance concurrency optimisation,
not a cache, and the reasoning in its comment is unaffected. It takes `db` and gains an
exported reset, because a module-level promise would otherwise leak across test files.

## 5. What is removed

| File | Fate | Lines |
|---|---|---|
| `db/repository.ts` | Deleted; types redistributed | 75 |
| `db/postgres-repository.ts` | Bodies become the free functions | 291 |
| `db/mock/repository.ts` | Deleted | 315 |
| `db/index.ts` | `repository()` deleted; type barrel remains | ~28 of 32 |
| `db/mock/seed-data.ts` | Moved to `db/seed-data.ts` | kept |

`Repository.kind` — "which backend answered, so the app never misrepresents its own
data" — is deleted. Nothing reads it, and with one backend the question it answers no
longer exists.

## 6. Environment contract

`utils/env.ts` opens by promising that "nothing here throws on a missing value" and that
"no DATABASE_URL means the in-memory store". Both stop being true. The docstring is
rewritten to say that the database is required and that Stripe and Upstash still degrade.

`hasDatabase` is deleted — the answer is now always yes.

`isLiveDeployment` is deleted. Its docstring records exactly why it exists: keying the
demo-store refusal on `NODE_ENV` broke laptop builds once the homepage became prerendered.
With no demo store there is no refusal to key, and the distinction it draws has no other
reader.

## 7. Local Postgres

`compose.yaml` at the repository root:

- `postgres:17`, published on **55432** rather than 5432, so it cannot collide with a
  Postgres already running on the machine.
- `tmpfs` for `/var/lib/postgresql/data`. The database is disposable — migrations and
  `pnpm db:seed` reconstruct it — and a memory-backed data directory is markedly faster
  for the test suite.
- A `pg_isready` healthcheck, so `docker compose up --wait` is a usable prerequisite.

`.env.example` gains the matching `DATABASE_URL`, and the README gains `docker compose up -d`
followed by `pnpm db:migrate && pnpm db:seed` as first-run steps.

`drizzle/0001_rls.sql` enables row-level security. The container connects as `postgres`,
a superuser, which bypasses RLS exactly as Supabase's service role does — so local
behaviour matches deployed behaviour and the policies are exercised by neither.

## 8. Test strategy

Six files, 926 lines, currently construct `MemoryRepository` directly. They split by
whether the database is actually the subject.

**Onto real Postgres** — these test database behaviour and belong there:

- `db/money.test.ts` (373) — buy, top up, redeliver, decay, take down
- `db/concurrency.test.ts` (86) — simultaneous buyers, the upsert
- `db/takedown.test.ts` (115) — `status` transitions and what the wall reads
- `app/api/webhooks/stripe/route.test.ts` (171) — drives the real route, which imports
  the real client

The Stripe suite needs care. Its comment states that it never leaves the machine; that
stays true — a local container is not the network, and the tagline it passes still avoids
the outbound description fetch. But it does gain a Docker prerequisite, and its
`resetStore("empty")` becomes a truncation.

`takedown.test.ts` improves along the way. It currently reaches into
`globalThis.holditStore` to flip a holder's `status`; against Postgres that becomes an
`UPDATE`, and the test stops depending on the mock's internals.

**Given a fixture builder** — these use the repository only as a convenient way to build
a wall, and their subject is arithmetic:

- `core/money-audit.test.ts` (106)
- `components/panels/zeros.test.ts` (75)

Both will construct a `MapDataset` literal through a small local helper and call
`buildMapState` directly. Neither gains a Docker dependency, which keeps `core/` and
`components/` tests I/O-free.

**Harness.** A vitest `globalSetup` runs the Drizzle migrations once against the container
using `drizzle-orm/postgres-js/migrator`, not by shelling out to `drizzle-kit`. Database
suites truncate the four tables in `beforeEach`, at precisely the points that call
`resetStore("empty")` today, and reset `cache.ts`'s inflight promise alongside.

Suites sharing one database run serially within a file; vitest's default file-level
parallelism is left alone unless truncation proves to race, in which case the database
suites get `sequential`.

There is no CI configuration in the repository today, so nothing to repair. When one is
added it needs a Postgres service and the same two commands.

## 9. Consequences accepted

**Every build needs a reachable database.** `app/page.tsx` sets `revalidate = 30`, so the
wall is prerendered during `next build`. Today a laptop build with an empty `.env` quietly
succeeds against the in-memory store. Afterwards, `pnpm dev` and `pnpm build` both require
the container to be up, and Vercel must expose `DATABASE_URL` to the build step and not
only to the runtime.

**Clone-and-run costs one command.** The project can no longer boot from an empty `.env`
and show a full map. `docker compose up -d` plus migrate and seed replaces that, and
Docker becomes a hard prerequisite for contributing.

**The seeded demo wall is gone as a runtime mode.** `SEED_LISTINGS` survives and remains
reachable through `pnpm db:seed`, so the founding wall is still one command away — it is
now data you load rather than a backend you fall into. This also removes the failure mode
that motivated `isLiveDeployment`: a deployment that lost its `DATABASE_URL` can no longer
present forty-five fictional customers as paying ones, because it will refuse to boot.

## 10. Verification

The 926 lines are the regression suite for this refactor. Assertions do not change; only
what runs underneath them does. Specifically:

1. `pnpm typecheck` — the compiler finds every call site that still omits `db`.
2. `pnpm test` — all 25 test files pass, the four database suites against Postgres.
3. `pnpm build` with the container up — the prerender reaches the database.
4. `pnpm build` with `DATABASE_URL` unset — fails with the message from `client.ts`, not
   a stack trace from Drizzle.
5. `pnpm dev`, edit a server file twenty times, then check
   `select count(*) from pg_stat_activity where datname = current_database()`. It should
   climb and then fall back as the reaper closes orphaned pools, rather than climbing
   without limit.

## 11. Out of scope

Splitting `money.test.ts`, revisiting the eight-query fan-out in `loadMapDataset`,
introducing a replica or read/write split, and changing anything in `core/`. The queries
keep their current SQL; only where they get their client changes.

## 12. As built

Implemented 2026-08-24. Seven things differ from the design above, all found while
building it.

**`queries/dataset.ts` exists.** Putting `MapDataset` and `loadMapDataset` in
`queries/map.ts` as planned created a cycle with `cache.ts`. Splitting the dataset query
into its own module makes the dependency one-way. §4 is updated.

**`docker/init-roles.sql`.** `drizzle/0001_rls.sql` revokes privileges from `anon`, a role
Supabase provides and `postgres:17` does not, so the migrations failed against a plain
container. The container now creates `anon`, `authenticated` and `service_role` as NOLOGIN
roles at init. The alternative — editing an already-applied migration to suit local
development — would have made the local schema a variant of the deployed one.

**`fileParallelism: false`.** The design said to leave vitest's parallelism alone unless
truncation proved to race. It does race by construction: four files sharing one database,
each truncating in `beforeEach`. Serial files cost about eight seconds across the whole
suite, which is cheaper than a flake.

**The test database is forced, not inherited.** `vitest.config.mts` overwrites
`DATABASE_URL` for the run rather than reading it. The suites truncate, so inheriting a
shell's connection string could empty a real wall. `TEST_DATABASE_URL` is the override.

**`resetDatabase()` takes no arguments.** `beforeEach(resetDatabase)` passes vitest's test
context as the first argument, which silently shadowed a defaulted `db` parameter and
failed with `db.execute is not a function`.

**`src/test/wall.ts`.** The fixture builder for the two suites that left the database, as
planned in §8. It produces the rows `buildMapState` reads. `money-audit.test.ts` prints
the same figures through it as it did through `MemoryRepository`, which is the evidence
that it models the same wall.

**`trackClick` and `recordVisit` hash internally.** The old `Repository` took a
pre-hashed `ipHash` and a classified `uaClass`; the mutations now take the raw `ip` and
user agent and do both, so no caller can forget to. Both also take an optional `now`.

### Verified

- `pnpm typecheck` — clean.
- `pnpm test` — 25 files, 218 tests, with `money.test.ts`, `concurrency.test.ts`,
  `takedown.test.ts` and `webhooks/stripe/route.test.ts` against real Postgres.
- `pnpm build` with the container up — succeeds, homepage prerendered.
- `pnpm build` with `DATABASE_URL` unset — fails at the prerender with
  "DATABASE_URL is not set. Start the database with `docker compose up -d`.", which is
  the message from `client.ts` rather than a driver stack trace.
- `biome check` — clean.

Not verified: §10 step 5, the hot-reload connection count. It needs a `pnpm dev` session
and manual observation. It now checks the `idle_timeout` reaper rather than `globalThis`,
and it is the one claim in §3 still resting on reasoning rather than measurement — with
the container up it is finally cheap to run.

### Revision, same day

`globalThis` was kept in the first pass and then dropped. §3 above records the reasoning as
it now stands; the client is a module-level `db`, and `idle_timeout` in development is what
makes that safe. Every call site imports the value rather than calling an accessor:
`import { db } from "@holdit/db/client"`.
