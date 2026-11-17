import {
  mkdirSync,
  existsSync,
  copyFileSync,
  closeSync,
  openSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
mkdirSync("data", { recursive: true });
if (!existsSync(".env")) copyFileSync(".env.example", ".env");
if (!existsSync("data/analysis.db"))
  closeSync(openSync("data/analysis.db", "a"));
for (const args of [["generate"], ["db", "push"]]) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", ...args],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || "file:../data/analysis.db",
      },
    },
  );
  if (result.status) process.exit(result.status);
}
