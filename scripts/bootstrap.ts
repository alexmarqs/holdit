import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const LOCAL_DATABASE_URL = "postgres://holdit:holdit@localhost:55432/holdit";

function run(command: string, env: Record<string, string> = {}): void {
  execSync(command, { stdio: "inherit", env: { ...process.env, ...env } });
}

function step(message: string): void {
  console.log(`\n→ ${message}`);
}

if (existsSync(".env.local")) {
  step(".env.local already exists, leaving it alone");
} else {
  step("Creating .env.local from .env.example");
  const env = readFileSync(".env.example", "utf8").replace(
    "CLICK_HASH_SALT=change-me-in-production",
    `CLICK_HASH_SALT=${randomBytes(32).toString("hex")}`,
  );
  writeFileSync(".env.local", env);
}

try {
  execSync("docker info", { stdio: "ignore" });
} catch {
  console.error("\nDocker is not running. Start Docker Desktop (or OrbStack) and run this again.");
  process.exit(1);
}

step("Starting Postgres on :55432");
run("pnpm db:local");

step("Applying migrations to the local container");
run("pnpm db:migrate", { DATABASE_URL: LOCAL_DATABASE_URL });

step("Seeding the founding wall");
run("pnpm db:seed");

console.log("\nReady. Run `pnpm dev` and open http://localhost:3001");
