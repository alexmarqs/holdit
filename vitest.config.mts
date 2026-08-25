import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/*
 * The database the integration suites run against.
 *
 * A separate database from the one `pnpm dev` uses, and set unconditionally so
 * whatever `DATABASE_URL` is in the shell cannot be reached. Those suites
 * truncate between tests: pointed at the development database they delete your
 * seeded wall, and pointed at a deployed one they would delete the real thing.
 *
 * Unit tests never see this. They do not import the client, and this URL is
 * only applied to the `integration` project.
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://holdit:holdit@localhost:55432/holdit_test";

export default defineConfig({
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
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
          globalSetup: ["./vitest.global-setup.ts"],
          /*
           * These suites share one Postgres and truncate between tests, so two
           * files running at once would clear each other's rows mid-test.
           */
          fileParallelism: false,
          env: { DATABASE_URL: TEST_DATABASE_URL },
        },
      },
    ],
  },
});
