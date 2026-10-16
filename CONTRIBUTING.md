# Contributing

Thanks for looking. Issues and pull requests are welcome. By participating you
agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

Report security problems the way [SECURITY.md](./SECURITY.md) describes. Do not
file them as public issues.

## Setup

You need Node 22 (`engines` in `package.json`, and `.node-version`), pnpm, and
Docker.

The rest of a first run — database, seed, dev server, tests — is in the
[README](./README.md). Install with pnpm so CI and your machine share one
lockfile. The app listens on <http://localhost:3001>.

## What a change should keep true

- Production code under `src/core/` stays free of I/O and does not import from
  the other `src/` folders. Pricing and decay belong there so they can be
  tested without Postgres.
- Queries take the Drizzle client as their first argument. Postgres is the
  only backend.
- `scripts/seed.sql` is the local founding wall. Do not run it against a
  production database, and do not move it into the app.
- Money is integer cents at the edges (Stripe, Postgres) and `big.js` for
  shares. Do not introduce floating-point ratios for a share a buyer is shown.
- Secrets stay in `.env.local` or the host's environment. `.env.example`
  contains placeholders only.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm lint` is Biome: format and lint together. `pnpm lint:fix` writes the
fixes. Formatting stays on Biome.

If the change touches `src/db`, a route that writes, or the Stripe webhook,
also run `pnpm test:integration` with the local database up. It truncates its
own database (`holdit_test`) and will not use `DATABASE_URL`.

`pnpm build` prerenders the homepage, so it needs a migrated database too.

## Pull requests

Open a pull request against `main` with what changed and how you checked it.
A failing check on the pull request is the thing to fix before review. Small
pull requests are easier to land than a branch that also restyles the wall.
