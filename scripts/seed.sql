-- The founding wall, for local development only.
--
-- An empty treemap looks broken, so a development wall ships pre-filled. These
-- squares are recorded as `provider = 'founding'` and fade on exactly the same
-- curve as a paid one — nothing here is permanent either.
--
-- Data, not app code: production never runs this file, so it does not belong in
-- `src/`. It lives beside the compose file that serves it and is applied with
-- `pnpm db:seed`.
--
-- Not an initdb script, though it is mounted from the same compose file. The
-- tables do not exist when initdb runs — `pnpm db:migrate` creates them — so
-- this has to be applied after migration rather than at first start.
--
-- Re-running is safe and adds nothing: the handles conflict, so no holder is
-- inserted, and the purchases hang off the holders that were.
--
-- Spend follows a power law and the purchase ages are spread across three weeks,
-- so the size channel and the warmth channel both have something to show. Past
-- ten squares the 10% display cap is live, which is what stops the top few
-- swallowing the wall.

begin;

with listing (ord, handle, url, tagline, spend_cents, last_bought_days) as (values
  ( 0, 'linear.app',      'https://linear.app',      'Plan and build products with a tool that keeps up.',        42000,  0.3),
  ( 1, 'supabase.com',    'https://supabase.com',    'Postgres with auth, storage and realtime attached.',        26000,  2.4),
  ( 2, 'resend.com',      'https://resend.com',      'Transactional email built for developers.',                  9500,  6.1),
  ( 3, 'cal.com',         'https://cal.com',         'Scheduling infrastructure you can self-host.',               4000, 11.5),
  ( 4, 'vercel.com',      'https://vercel.com',      'Ship web apps without touching infrastructure.',            38000,  0.6),
  ( 5, 'stripe.com',      'https://stripe.com',      'Financial infrastructure for the internet.',                35000,  1.2),
  ( 6, 'figma.com',       'https://figma.com',       'Design, prototype and hand off in one file.',               30000,  3.1),
  ( 7, 'notion.so',       'https://notion.so',       'Docs, wikis and projects in one workspace.',                24000,  4.8),
  ( 8, 'cursor.com',      'https://cursor.com',      'The editor that writes alongside you.',                     22000,  0.4),
  ( 9, 'raycast.com',     'https://raycast.com',     'A launcher that replaces half your menu bar.',              19000,  5.2),
  (10, 'neon.tech',       'https://neon.tech',       'Serverless Postgres that branches like Git.',               16500,  2.9),
  (11, 'clerk.com',       'https://clerk.com',       'Auth and user management you can drop into any app.',       15000,  7.4),
  (12, 'sentry.io',       'https://sentry.io',       'See every error your users hit before they email you.',     14000,  9.1),
  (13, 'railway.app',     'https://railway.app',     'Deploy anything without writing YAML.',                     12500,  1.8),
  (14, 'posthog.com',     'https://posthog.com',     'Product analytics, session replay and flags in one tool.',  11500,  3.6),
  (15, 'polar.sh',        'https://polar.sh',        'Billing and licensing for developer tools.',                10000,  0.9),
  (16, 'drizzle.team',    'https://drizzle.team',    'A SQL ORM that stays out of the way.',                       9200, 12.2),
  (17, 'bun.sh',          'https://bun.sh',          'A runtime that is also the toolchain.',                      8500,  4.4),
  (18, 'tailwindcss.com', 'https://tailwindcss.com', 'Utility classes instead of a stylesheet.',                   7800,  8.8),
  (19, 'upstash.com',     'https://upstash.com',     'Redis and queues priced per request.',                       7000,  6.7),
  (20, 'astro.build',     'https://astro.build',     'Sites that ship almost no JavaScript.',                      6400, 10.3),
  (21, 'biomejs.dev',     'https://biomejs.dev',     'Format and lint in one fast binary.',                        5800, 14.1),
  (22, 'trigger.dev',     'https://trigger.dev',     'Background jobs that survive deploys.',                      5200,  5.9),
  (23, 'inngest.com',     'https://inngest.com',     'Durable workflows without the state machine.',               4700,  7.8),
  (24, 'zed.dev',         'https://zed.dev',         'A collaborative editor written for speed.',                  4300,  2.2),
  (25, 'warp.dev',        'https://warp.dev',        'The terminal, rethought.',                                   3900, 11.9),
  (26, 'playwright.dev',  'https://playwright.dev',  'Reliable end-to-end tests across browsers.',                 3500, 16.4),
  (27, 'vitest.dev',      'https://vitest.dev',      'Testing that keeps up with Vite.',                           3100, 13.7),
  (28, 'turso.tech',      'https://turso.tech',      'SQLite at the edge, one database per user.',                 2800,  9.6),
  (29, 'convex.dev',      'https://convex.dev',      'A backend that syncs itself to your UI.',                    2500,  4.1),
  (30, 'modal.com',       'https://modal.com',       'Serverless GPUs without the cluster.',                       2200,  1.4),
  (31, 'replicate.com',   'https://replicate.com',   'Run open models with one API call.',                         1900,  6.3),
  (32, 'firecrawl.dev',   'https://firecrawl.dev',   'Turn any site into clean markdown for your model.',          1700,  3.3),
  (33, 'e2b.dev',         'https://e2b.dev',         'Sandboxes where AI runs untrusted code.',                    1500,  8.1),
  (34, 'langfuse.com',    'https://langfuse.com',    'Trace, evaluate and debug LLM apps.',                        1300, 12.8),
  (35, 'dub.co',          'https://dub.co',          'Short links with analytics you actually own.',               1100,  5.5),
  (36, 'loops.so',        'https://loops.so',        'Email for software companies.',                               900, 17.2),
  (37, 'tella.tv',        'https://tella.tv',        'Record and edit videos in the browser.',                      800,  7.1),
  (38, 'screen.studio',   'https://screen.studio',   'Screen recordings that look designed.',                       700, 10.9),
  (39, 'cleanshot.com',   'https://cleanshot.com',   'Capture and annotate anything on screen.',                    600, 15.3),
  (40, 'val.town',        'https://val.town',        'Write and host tiny scripts instantly.',                      500, 19.6),
  (41, 'hono.dev',        'https://hono.dev',        'A tiny web framework that runs anywhere.',                    400,  2.7),
  (42, 'attio.com',       'https://attio.com',       'A CRM that shapes itself around your data.',                  300, 21.4),
  (43, 'plain.com',       'https://plain.com',       'Support built for product teams.',                            200, 13.1),
  (44, 'folk.app',        'https://folk.app',        'A CRM that feels like a contact list.',                       100, 24.8)
),

-- `on conflict do nothing` returns only the rows this run actually inserted, so
-- a second run joins to nothing and writes no duplicate purchases.
placed as (
  insert into holders (handle, url, tagline, status, created_at)
  select handle, url, tagline, 'live', now() - interval '45 days' from listing
  on conflict (handle) do nothing
  returning id, handle
),

fresh as (select l.*, p.id as holder_id from listing l join placed p on p.handle = l.handle)

-- Two purchases each: the most recent one carries 60% of the spend and sets the
-- square's warmth, the older one is spread further back so the wall does not
-- look like it was all bought in one afternoon. `share_after` is 0 because no
-- share was ever quoted to a founding square — the activity feed shows a share
-- only for a real purchase.
insert into purchases (holder_id, amount_cents, share_after, provider, created_at)
select holder_id,
       round(spend_cents * 0.6)::int,
       0,
       'founding',
       now() - (last_bought_days::double precision) * interval '1 day'
from fresh
union all
select holder_id,
       spend_cents - round(spend_cents * 0.6)::int,
       0,
       'founding',
       now() - ((last_bought_days + 9 + ord)::double precision) * interval '1 day'
from fresh;

commit;
