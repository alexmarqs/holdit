-- A second database, so `pnpm test` cannot empty the wall you are looking at.
--
-- The suites truncate every table between tests. Pointed at the same database
-- as `pnpm dev`, one test run deletes your seeded squares and leaves fixtures
-- behind — which looks exactly like the app losing your data.
CREATE DATABASE holdit_test;
