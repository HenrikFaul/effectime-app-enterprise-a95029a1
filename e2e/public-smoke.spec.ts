import { expect, test, type Page } from "@playwright/test";

const LOCAL_BASE_URL = "http://127.0.0.1:4173";
const APP_BASE_URL = process.env.PLAYWRIGHT_BASE_URL?.trim() || LOCAL_BASE_URL;
const APP_ORIGIN = new URL(APP_BASE_URL).origin;

const ASSET_RESOURCE_TYPES = new Set([
  "document",
  "font",
  "image",
  "manifest",
  "media",
  "script",
  "stylesheet",
]);

function isApplicationUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function observeRuntime(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedAssets: Array<{
    method: string;
    url: string;
    resourceType: string;
    errorText: string;
    sequence: number;
  }> = [];
  const completedAssets = new Map<string, number>();
  let requestSequence = 0;
  const badAssetResponses: string[] = [];
  const applicationResponses: Array<{
    url: string;
    status: number;
    resourceType: string;
    contentType: string;
  }> = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    consoleErrors.push(`${message.text()}${location.url ? ` @ ${location.url}` : ""}`);
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.stack || error.message);
  });

  page.on("requestfailed", (request) => {
    if (!isApplicationUrl(request.url())) return;
    if (!ASSET_RESOURCE_TYPES.has(request.resourceType())) return;
    failedAssets.push({
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      errorText: request.failure()?.errorText || "unknown failure",
      sequence: ++requestSequence,
    });
  });

  page.on("requestfinished", (request) => {
    if (!isApplicationUrl(request.url())) return;
    if (!ASSET_RESOURCE_TYPES.has(request.resourceType())) return;
    completedAssets.set(
      `${request.method()}\u0000${request.url()}\u0000${request.resourceType()}`,
      ++requestSequence,
    );
  });

  page.on("response", (response) => {
    const request = response.request();
    if (!isApplicationUrl(response.url())) return;

    applicationResponses.push({
      url: response.url(),
      status: response.status(),
      resourceType: request.resourceType(),
      contentType: response.headers()["content-type"] ?? "",
    });
    if (!ASSET_RESOURCE_TYPES.has(request.resourceType())) return;
    if (
      request.resourceType() === "script" &&
      response.status() < 400 &&
      !/(?:javascript|ecmascript)/i.test(response.headers()["content-type"] ?? "")
    ) {
      badAssetResponses.push(
        `Invalid script MIME ${response.headers()["content-type"] || "(missing)"}: ${response.url()}`,
      );
    }
    if (
      request.resourceType() === "stylesheet" &&
      response.status() < 400 &&
      !/text\/css/i.test(response.headers()["content-type"] ?? "")
    ) {
      badAssetResponses.push(
        `Invalid stylesheet MIME ${response.headers()["content-type"] || "(missing)"}: ${response.url()}`,
      );
    }
    if (response.status() < 400) return;

    badAssetResponses.push(`${response.status()} ${request.method()} ${response.url()}`);
  });

  return {
    consoleErrors,
    applicationResponses,
    assertHealthy(allowedConsoleErrors: readonly RegExp[] = []) {
      // A newly activated service worker can claim the page while an image is
      // in flight. Chromium reports the superseded request as ERR_ABORTED and
      // immediately repeats it through the worker. Ignore only that exact,
      // browser-directed cancellation when an identical asset request later
      // completed; every unrecovered abort and every other failure still fails.
      const unrecoveredFailedAssets = failedAssets
        .filter(
          (failure) =>
            failure.errorText !== "net::ERR_ABORTED" ||
            failure.resourceType !== "image" ||
            (completedAssets.get(
              `${failure.method}\u0000${failure.url}\u0000${failure.resourceType}`,
            ) ?? -1) <= failure.sequence,
        )
        .map(
          (failure) =>
            `${failure.method} ${failure.url} (${failure.errorText})`,
        );
      const unexpectedConsoleErrors = consoleErrors.filter(
        (message) => !allowedConsoleErrors.some((allowed) => allowed.test(message)),
      );

      expect(pageErrors, `Uncaught page errors:\n${pageErrors.join("\n\n")}`).toEqual([]);
      expect(
        unrecoveredFailedAssets,
        `Failed same-origin document/assets:\n${unrecoveredFailedAssets.join("\n")}`,
      ).toEqual([]);
      expect(
        badAssetResponses,
        `Same-origin document/assets returned HTTP errors:\n${badAssetResponses.join("\n")}`,
      ).toEqual([]);
      expect(
        unexpectedConsoleErrors,
        `Unexpected console errors:\n${unexpectedConsoleErrors.join("\n")}`,
      ).toEqual([]);
    },
  };
}

async function waitForLateRuntimeFailures(page: Page) {
  // Lazy chunks and service-worker registration can fail after the first paint.
  await page.waitForTimeout(750);
}

async function assertVisibleButtonsHaveAccessibleNames(page: Page) {
  const buttons = page.locator('button, [role="button"]');
  const buttonCount = await buttons.count();
  let visibleButtonCount = 0;

  for (let index = 0; index < buttonCount; index += 1) {
    const button = buttons.nth(index);
    if (!(await button.isVisible())) continue;

    visibleButtonCount += 1;
    const diagnostic = await button.evaluate((element) =>
      element.outerHTML.replace(/\s+/g, " ").slice(0, 220),
    );
    await expect
      .soft(button, `Visible button has no accessible name: ${diagnostic}`)
      .toHaveAccessibleName(/\S+/, { timeout: 250 });
  }

  expect(
    visibleButtonCount,
    "The rendered page should expose at least one visible button",
  ).toBeGreaterThan(0);
}

async function assertEffectimeLogoLoaded(page: Page) {
  for (const selector of [".effectime-logo-mark", ".effectime-logo-wordmark"]) {
    const logo = page.locator(selector).first();
    await expect(logo).toBeVisible();
    await expect
      .poll(() =>
        logo.evaluate(
          (element) =>
            element instanceof HTMLImageElement &&
            element.complete &&
            element.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
}

async function assertSuccessfulNavigation(page: Page, path: string) {
  // External fonts and analytics must not decide whether the SPA is ready.
  // Route-specific assertions below are the deterministic readiness signal.
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `Navigation to ${path} did not produce a document response`).not.toBeNull();
  expect(response?.ok(), `Navigation to ${path} returned HTTP ${response?.status()}`).toBe(true);
}

test.describe("public application smoke", () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.PLAYWRIGHT_BASE_URL) return;

    // External font availability is intentionally outside this application
    // smoke contract. Fulfil only the third-party stylesheet locally so it
    // cannot block DOMContentLoaded or turn a deterministic app check flaky.
    await page.route("https://fonts.googleapis.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/css", body: "" }),
    );
  });

  test("landing loads its runtime assets without browser errors", async ({ page }) => {
    const runtime = observeRuntime(page);

    await assertSuccessfulNavigation(page, "/");
    await expect(page).toHaveTitle(/Effectime/i);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main h1").first()).toBeVisible();
    expect(
      await page.evaluate(() => Object.prototype.hasOwnProperty.call(globalThis, "Capacitor")),
      "The public web runtime must not load Capacitor or secure-storage browser fallbacks",
    ).toBe(false);

    const loadedResponses = runtime.applicationResponses.map((response) => ({
      ...response,
      path: new URL(response.url).pathname,
    }));
    const scriptAssets = loadedResponses.filter(
      (response) =>
        response.resourceType === "script" && /^\/assets\/[^/]+\.js$/.test(response.path),
    );
    const stylesheetAssets = loadedResponses.filter(
      (response) =>
        response.resourceType === "stylesheet" && /^\/assets\/[^/]+\.css$/.test(response.path),
    );
    expect(
      scriptAssets,
      `No production application script was observed. Responses:\n${JSON.stringify(loadedResponses, null, 2)}`,
    ).not.toHaveLength(0);
    expect(
      stylesheetAssets,
      `No production application stylesheet was observed. Responses:\n${JSON.stringify(loadedResponses, null, 2)}`,
    ).not.toHaveLength(0);
    for (const asset of scriptAssets) {
      expect(asset.contentType, `${asset.path} has an invalid JavaScript MIME type`).toMatch(
        /(?:javascript|ecmascript)/i,
      );
    }
    for (const asset of stylesheetAssets) {
      expect(asset.contentType, `${asset.path} has an invalid CSS MIME type`).toMatch(/text\/css/i);
    }

    const manifestResponse = await page.request.get(
      new URL("/manifest.webmanifest", APP_BASE_URL).href,
    );
    expect(manifestResponse.ok(), `manifest returned HTTP ${manifestResponse.status()}`).toBe(true);
    expect(manifestResponse.headers()["content-type"]).toMatch(
      /(?:manifest\+json|application\/json)/i,
    );
    const manifest = await manifestResponse.json();
    expect(manifest).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        start_url: expect.any(String),
        icons: expect.any(Array),
      }),
    );

    const releaseIdentityResponse = await page.request.get(
      new URL("/.well-known/effectime-release.json", APP_BASE_URL).href,
      { headers: { "Cache-Control": "no-cache" } },
    );
    expect(
      releaseIdentityResponse.ok(),
      `release identity returned HTTP ${releaseIdentityResponse.status()}`,
    ).toBe(true);
    expect(releaseIdentityResponse.headers()["content-type"]).toMatch(/application\/json/i);
    const releaseIdentity = await releaseIdentityResponse.json();
    expect(releaseIdentity).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        application: expect.any(String),
        version: expect.stringMatching(/^\d+\.\d+\.\d+(?:[-+].+)?$/),
        source: expect.objectContaining({
          sha: expect.stringMatching(/^[0-9a-f]{40}$/),
          shortSha: expect.stringMatching(/^[0-9a-f]{12}$/),
          dirty: expect.any(Boolean),
          attestable: expect.any(Boolean),
        }),
        artifact: expect.objectContaining({
          algorithm: "sha256",
          inventoryFormat: "relative-path-nul-file-sha256-nul-v1",
          excluded: [".well-known/effectime-release.json"],
          inventory: expect.any(Array),
          files: expect.any(Number),
          bytes: expect.any(Number),
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        }),
      }),
    );
    const expectedReleaseSha = process.env.EFFECTIME_RELEASE_SHA?.toLowerCase();
    if (expectedReleaseSha) {
      expect(releaseIdentity.source.sha).toBe(expectedReleaseSha);
      expect(releaseIdentity.source.dirty).toBe(false);
      expect(releaseIdentity.source.attestable).toBe(true);
    }
    const expectedWebArtifactSha256 = process.env.EFFECTIME_WEB_ARTIFACT_SHA256?.toLowerCase();
    if (expectedWebArtifactSha256) {
      expect(releaseIdentity.artifact.sha256).toBe(expectedWebArtifactSha256);
    }
    expect(releaseIdentity.application.length).toBeGreaterThan(0);
    expect(releaseIdentity.artifact.files).toBeGreaterThan(0);
    expect(releaseIdentity.artifact.bytes).toBeGreaterThanOrEqual(0);
    expect(releaseIdentity.artifact.inventory).toHaveLength(releaseIdentity.artifact.files);
    expect(releaseIdentity.source.shortSha).toBe(releaseIdentity.source.sha.slice(0, 12));
    expect(releaseIdentity.source.attestable).toBe(!releaseIdentity.source.dirty);

    const faviconResponse = await page.request.get(
      new URL("/effectime-favicon.svg", APP_BASE_URL).href,
    );
    expect(faviconResponse.ok(), `favicon returned HTTP ${faviconResponse.status()}`).toBe(true);
    expect(faviconResponse.headers()["content-type"]).toMatch(/image\/svg\+xml/i);
    expect(await faviconResponse.text()).toMatch(/<svg\b/i);

    await assertVisibleButtonsHaveAccessibleNames(page);
    await waitForLateRuntimeFailures(page);
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.getRegistration("/").then(Boolean)))
      .toBe(true);
    runtime.assertHealthy();
  });

  test("auth route renders a non-mutating login surface", async ({ page }) => {
    const runtime = observeRuntime(page);

    await assertSuccessfulNavigation(page, "/auth");
    await expect(page).toHaveURL(/\/auth(?:[?#]|$)/);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await assertEffectimeLogoLoaded(page);
    await assertVisibleButtonsHaveAccessibleNames(page);

    await waitForLateRuntimeFailures(page);
    runtime.assertHealthy();
  });

  test("legacy protected enterprise route redirects an anonymous browser to auth", async ({
    page,
  }) => {
    const runtime = observeRuntime(page);

    await assertSuccessfulNavigation(page, "/enterprise");
    await expect(page).toHaveURL(/\/auth(?:[?#]|$)/);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await assertEffectimeLogoLoaded(page);

    await waitForLateRuntimeFailures(page);
    runtime.assertHealthy();
  });

  test("unknown route renders the application 404 without unexpected runtime failures", async ({
    page,
  }) => {
    const runtime = observeRuntime(page);
    const unknownPath = "/__public-smoke_unknown_route__";

    await assertSuccessfulNavigation(page, unknownPath);
    await expect(page).toHaveURL(new RegExp(`${unknownPath}$`));
    await expect(page.getByRole("heading", { level: 1, name: "404" })).toBeVisible();
    await expect(page.getByText(unknownPath, { exact: true })).toBeVisible();
    await assertVisibleButtonsHaveAccessibleNames(page);

    const expectedDiagnostics = runtime.consoleErrors.filter((message) =>
      /^\[404\] Route not found\b/.test(message),
    );
    expect(
      expectedDiagnostics,
      "NotFound must emit exactly one intentional route diagnostic",
    ).toHaveLength(1);
    await waitForLateRuntimeFailures(page);
    runtime.assertHealthy([/^\[404\] Route not found\b/]);
  });

  for (const viewportWidth of [320, 390, 768]) {
    test(`landing does not clip meaningful content at ${viewportWidth}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewportWidth, height: 844 });
      const runtime = observeRuntime(page);

      await assertSuccessfulNavigation(page, "/");
      await expect(page.locator("main h1").first()).toBeVisible();

      const overflowReport = await page.evaluate(() => {
        const root = document.documentElement;
        const viewportWidth = root.clientWidth;
        const tolerance = 1;
        const meaningfulContent = document.querySelectorAll<HTMLElement>(
          [
            "header a[href]",
            "header button",
            "main h1",
            "main h2",
            "main h3",
            "main p",
            "main span",
            "main a[href]",
            "main button",
            "main input",
            "main select",
            "main textarea",
            'main [role="button"]',
            "footer a[href]",
            "footer button",
          ].join(","),
        );

        const clippedContent: Array<{
          element: string;
          left: number;
          right: number;
          viewportWidth: number;
        }> = [];

        for (const element of meaningfulContent) {
          if (element.closest('[aria-hidden="true"], .marquee')) continue;

          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          if (style.display === "none" || style.visibility === "hidden") continue;
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.left >= -tolerance && rect.right <= viewportWidth + tolerance) continue;

          clippedContent.push({
            element: `${element.tagName.toLowerCase()} ${element.textContent?.trim().replace(/\s+/g, " ").slice(0, 100) || "(no text)"}`,
            left: Math.round(rect.left * 10) / 10,
            right: Math.round(rect.right * 10) / 10,
            viewportWidth,
          });
        }

        return {
          clientWidth: viewportWidth,
          scrollWidth: root.scrollWidth,
          clippedContent: clippedContent.slice(0, 20),
        };
      });

      expect(
        overflowReport.scrollWidth,
        `The document overflows horizontally at ${viewportWidth}px: ${JSON.stringify(overflowReport, null, 2)}`,
      ).toBeLessThanOrEqual(overflowReport.clientWidth + 1);
      expect(
        overflowReport.clippedContent,
        `Meaningful content is clipped at ${viewportWidth}px: ${JSON.stringify(overflowReport, null, 2)}`,
      ).toEqual([]);

      await waitForLateRuntimeFailures(page);
      runtime.assertHealthy();
    });
  }
});
