import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * End-to-end UI tests against a running API (backend/) and this web app.
 * Credentials: E2E_USERNAME / E2E_PASSWORD, or the local dev owner from backend/.env
 * (LIFEOS_DEV_OWNER_*; see backend/scripts/dev_owner.py). Never commit real credentials.
 */
const envFile = path.resolve(__dirname, "../../backend/.env");
if (!process.env.E2E_PASSWORD && fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^LIFEOS_DEV_OWNER_(USERNAME|PASSWORD)=(.*)$/);
    if (m) process.env[`E2E_${m[1]}`] ??= m[2];
  }
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev -- --port 3100", url: "http://localhost:3100/login", reuseExistingServer: true, timeout: 120_000 },
});
