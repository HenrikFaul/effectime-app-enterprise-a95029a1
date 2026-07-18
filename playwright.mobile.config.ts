import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4174";

export default defineConfig({
  testDir: "./e2e-mobile",
  outputDir: "test-results/mobile",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/mobile" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    locale: "hu-HU",
    timezoneId: "Europe/Budapest",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview:mobile -- --host 127.0.0.1 --port 4174 --strictPort",
    url: baseURL,
    // Never attach to an unknown preview process: a stale dist-mobile server
    // could otherwise make a local run report evidence for the wrong build.
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
