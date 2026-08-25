import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/*
 * The database the suites run against.
 *
 * A separate database from the one `pnpm dev` uses, and set unconditionally so
 * whatever `DATABASE_URL` is in the shell cannot be reached. The suites truncate
 * between tests: pointed at the development database they delete your seeded
 * wall, and pointed at a deployed one they would delete the real thing.
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://holdit:holdit@localhost:55432/holdit_test";

// globalSetup runs in this process, before the workers exist, so it reads this
// rather than `test.env` below.
process.env.DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globalSetup: ["./vitest.global-setup.ts"],
    /*
     * The database-backed suites share one Postgres and truncate between tests,
     * so two files running at once would clear each other's rows mid-test. The
     * whole suite is small enough that running files in sequence costs little.
     */
    fileParallelism: false,
    env: { DATABASE_URL: TEST_DATABASE_URL },
  },
  resolve: {
    alias: [
      {
        find: /^@holdit\/core$/,
        replacement: fileURLToPath(new URL("./src/core/index.ts", import.meta.url)),
      },
      {
        find: /^@holdit\/utils$/,
        replacement: fileURLToPath(new URL("./src/utils/index.ts", import.meta.url)),
      },
      {
        find: /^@holdit\/(\w+)\//,
        replacement: `${fileURLToPath(new URL("./src/", import.meta.url))}$1/`,
      },
    ],
  },
});
