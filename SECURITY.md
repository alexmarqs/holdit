# Security policy

## Supported versions

There are no versioned releases. Security fixes land on `main`.

## Reporting a vulnerability

Email [holdit-lol@alexandremarques.io](mailto:holdit-lol@alexandremarques.io).
Do not open a public issue, pull request, or discussion for a vulnerability.

Include what you found, how to reproduce it, and what an attacker could do with
it. You will get a reply acknowledging the report. If the report is accepted, a
fix will land on `main` before any public write-up.

## What to leave alone

The local database in `docker-compose.yaml` uses the password `holdit`
on purpose. It is a development container bound to `localhost:55432`, not a
production credential.

`CLICK_HASH_SALT` in `.env.example` is a placeholder. A deployment must set its
own salt. The fallback in development (`holdit-dev-salt`) is not a secret and
must not be used in production.
