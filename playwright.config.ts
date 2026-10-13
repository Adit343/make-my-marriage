import { defineConfig, devices } from "@playwright/test";

// Repeatable browser and accessibility tests (Phase 7, step 7.3). `npm run test:e2e` starts a
// production build of the app against a throwaway in-memory database (e2e/server.ts); run
// `npm run build` first. Your own `npm run dev` on port 3000 and your real database are not used.

const port = process.env.E2E_PORT ?? "3135";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: "**/phone.spec.ts" },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: "**/phone.spec.ts" },
  ],
  webServer: {
    command: "tsx --conditions=react-server e2e/server.ts",
    url: `http://localhost:${port}/api/v1/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
