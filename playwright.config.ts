import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// tests/e2e/chaos seeds/reads Supabase directly from the Playwright Node
// process (same pattern as tests/setup/load-env.ts for the vitest suites).
config({ path: ".env.test" });
config({ path: ".env.local" });

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
