import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for FitMind client E2E.
 *
 * The backend is mocked via route interception in each spec, so these tests
 * need no running API, database, or secrets.
 *
 * The Vite dev server is started and stopped by `e2e/global-server.ts` rather
 * than by Playwright's built-in `webServer` (fitmind-yi7). Stopping the server
 * was where the time went: the last test result printed at 12.9s and the
 * summary at 161.1s, with the process exiting immediately after. The expensive
 * step is Windows `taskkill /T`, measured between 3.8s and 96s on the same
 * machine. Owning the lifecycle lets teardown terminate the server directly,
 * bound every external command it runs, and verify the process and the port
 * separately. See that file for the measurements.
 */
const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  globalSetup: "./e2e/global-server.ts",
});
