import { expect, test, type Page } from "@playwright/test";

interface MobileDiagnostics {
  csp: Array<{ blockedURI: string; directive: string }>;
  consoleErrors: string[];
  pageErrors: string[];
  failedAssets: string[];
  nativeMethods: string[];
}

async function installNativeBridge(page: Page): Promise<MobileDiagnostics> {
  const diagnostics: MobileDiagnostics = {
    csp: [],
    consoleErrors: [],
    pageErrors: [],
    failedAssets: [],
    nativeMethods: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.stack || error.message));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:4174") return;
    diagnostics.failedAssets.push(
      `${request.resourceType()} ${url.pathname}: ${request.failure()?.errorText ?? "failed"}`,
    );
  });

  await page.addInitScript(() => {
    const secureValues = new Map<string, string>();
    const nativeMethods: string[] = [];
    const listenerHandle = { remove: async () => {} };

    Object.defineProperty(globalThis, "androidBridge", {
      configurable: true,
      value: { postMessage: () => {} },
    });

    const secureMethods = [
      "setSynchronizeKeychain",
      "internalGetItem",
      "internalSetItem",
      "internalRemoveItem",
      "clearItemsWithPrefix",
      "getPrefixedKeys",
    ].map((name) => ({ name, rtype: "promise" }));

    const capacitor = {
      PluginHeaders: [{ name: "SecureStorage", methods: secureMethods }],
      Plugins: {
        App: {
          getLaunchUrl: async () => undefined,
          getState: async () => ({ isActive: true }),
          addListener: async () => listenerHandle,
        },
        Browser: {
          open: async () => {},
          close: async () => {},
        },
      },
      isNativePlatform: () => true,
      getPlatform: () => "android",
      nativePromise: async (_plugin: string, method: string, options: Record<string, unknown>) => {
        nativeMethods.push(method);
        const key = String(options?.prefixedKey ?? "");
        if (method === "internalGetItem") return { data: secureValues.get(key) ?? null };
        if (method === "internalSetItem") {
          secureValues.set(key, String(options?.data ?? ""));
          return undefined;
        }
        if (method === "internalRemoveItem") {
          const existed = secureValues.delete(key);
          return { success: existed };
        }
        if (method === "clearItemsWithPrefix") {
          const prefix = String(options?.prefix ?? "");
          for (const storedKey of secureValues.keys()) {
            if (storedKey.startsWith(prefix)) secureValues.delete(storedKey);
          }
          return undefined;
        }
        if (method === "getPrefixedKeys") {
          const prefix = String(options?.prefix ?? "");
          return { keys: [...secureValues.keys()].filter((storedKey) => storedKey.startsWith(prefix)) };
        }
        return undefined;
      },
    };
    Object.defineProperty(globalThis, "Capacitor", {
      configurable: true,
      writable: true,
      value: capacitor,
    });
    Object.defineProperty(globalThis, "__effectimeNativeMethods", {
      configurable: true,
      value: nativeMethods,
    });

    const violations: Array<{ blockedURI: string; directive: string }> = [];
    Object.defineProperty(globalThis, "__effectimeCspViolations", {
      configurable: true,
      value: violations,
    });
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push({ blockedURI: event.blockedURI, directive: event.effectiveDirective });
    });
  });

  return diagnostics;
}

async function assertHealthyNativePage(page: Page, diagnostics: MobileDiagnostics) {
  await page.waitForTimeout(750);
  diagnostics.csp = await page.evaluate(
    () =>
      (globalThis as typeof globalThis & {
        __effectimeCspViolations?: Array<{ blockedURI: string; directive: string }>;
      }).__effectimeCspViolations ?? [],
  );
  diagnostics.nativeMethods = await page.evaluate(
    () =>
      (globalThis as typeof globalThis & { __effectimeNativeMethods?: string[] })
        .__effectimeNativeMethods ?? [],
  );

  expect(diagnostics.csp, "Unexpected native CSP violations").toEqual([]);
  expect(diagnostics.consoleErrors, "Unexpected native console errors").toEqual([]);
  expect(diagnostics.pageErrors, "Unexpected native page errors").toEqual([]);
  expect(diagnostics.failedAssets, "Failed native-local assets").toEqual([]);
}

test.describe("CSP-hardened native shell", () => {
  for (const path of ["/", "/auth"]) {
    test(`${path} boots through the emulated Capacitor bridge without CSP violations`, async ({ page }) => {
      const diagnostics = await installNativeBridge(page);
      const response = await page.goto(path, { waitUntil: "commit" });
      expect(response?.ok()).toBe(true);

      if (path === "/") await expect(page.locator("main h1").first()).toBeVisible();
      else {
        await expect(
          page.locator("#email, [data-auth-storage-error-code]").first(),
        ).toBeVisible();
        const storageError = page.locator("[data-auth-storage-error-code]");
        const errorCode =
          (await storageError.count()) > 0
            ? await storageError.getAttribute("data-auth-storage-error-code")
            : null;
        expect(errorCode, "Native auth storage entered its recovery boundary").toBeNull();
        await expect(page.locator("#email")).toBeVisible();
      }

      const policy = await page
        .locator('meta[http-equiv="Content-Security-Policy"]')
        .getAttribute("content");
      expect(policy).toContain("script-src 'self'");
      expect(policy).not.toContain("unsafe-eval");
      expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
      expect(await page.locator('script[type="application/ld+json"]').count()).toBe(0);
      expect(
        await page.locator("script:not([src])").count(),
        "The native document must not contain inline scripts",
      ).toBe(0);

      await assertHealthyNativePage(page, diagnostics);
      if (path === "/auth") {
        expect(diagnostics.nativeMethods).toContain("internalGetItem");
      }
    });
  }
});
