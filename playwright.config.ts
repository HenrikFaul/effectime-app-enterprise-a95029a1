import { defineConfig, devices } from "@playwright/test";

const localBaseUrl = "http://127.0.0.1:4173";
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseUrl || localBaseUrl;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  // One public page at a time keeps local browser startup deterministic on
  // constrained Windows runners and avoids cross-test pressure on Vite.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: "playwright-report",
      },
    ],
  ],
  use: {
    baseURL,
    locale: "hu-HU",
    timezoneId: "Europe/Budapest",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  // Supplying PLAYWRIGHT_BASE_URL opts into a read-only smoke run against an
  // already running environment. The default serves the production build, so
  // minification, chunking and asset paths are part of the smoke contract.
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
