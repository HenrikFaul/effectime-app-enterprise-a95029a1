import {
  createImportEntityDataHandler,
  ImportDependencyError,
  type AuthorizedImportCommand,
  type ImportEntityDataDependencies,
  type ImportEntityDataLogger,
} from "./handler.ts";
import {
  CSV_IMPORT_REQUIRED_FEATURE_KEYS,
  resolveCsvImportEntitlement,
  type TenantFeatureServiceClient,
} from "./entitlement.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

type Counters = {
  factory: number;
  authentication: number;
  actor: number;
  entitlement: number;
  executor: number;
  audit: number;
  entity: number;
};

function emptyCounters(): Counters {
  return {
    factory: 0,
    authentication: 0,
    actor: 0,
    entitlement: 0,
    executor: 0,
    audit: 0,
    entity: 0,
  };
}

function request(
  body: unknown = {
    workspace_id: "workspace-1",
    entity: "offices",
    mode: "create",
    rows: [{ name: "Budapest" }],
  },
  method = "POST",
  auth = "Bearer user-token",
): Request {
  return new Request("https://example.test/functions/v1/import-entity-data", {
    method,
    headers: {
      ...(auth ? { Authorization: auth } : {}),
      "Content-Type": "application/json",
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}

function invalidJsonRequest(): Request {
  return new Request("https://example.test/functions/v1/import-entity-data", {
    method: "POST",
    headers: {
      Authorization: "Bearer user-token",
      "Content-Type": "application/json",
    },
    body: "{not-json",
  });
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return await response.json();
}

function featureClient(
  enabledFeatureKeys: readonly string[],
): TenantFeatureServiceClient {
  const tenantQuery = {
    select() {
      return tenantQuery;
    },
    eq() {
      return tenantQuery;
    },
    maybeSingle: async () => ({
      data: { tenant_id: "tenant-1" },
      error: null,
    }),
  };
  return {
    from: () => tenantQuery,
    rpc: async () => ({
      data: enabledFeatureKeys.map((feature_key) => ({
        feature_key,
        source: "tier",
      })),
      error: null,
    }),
  };
}

function successDependencies(
  counters: Counters,
  overrides: Partial<ImportEntityDataDependencies> = {},
): ImportEntityDataDependencies {
  return {
    authenticate: async () => {
      counters.authentication += 1;
      return { kind: "authenticated", userId: "user-1" };
    },
    resolveActor: async () => {
      counters.actor += 1;
      return { kind: "authorized", role: "owner" };
    },
    resolveCsvImportEntitlement: async () => {
      counters.entitlement += 1;
      return {
        enabled: true,
        tenantId: "tenant-1",
      };
    },
    executeAuthorizedImport: async (_command: AuthorizedImportCommand) => {
      counters.executor += 1;
      // These counters model the first operations behind the executor boundary.
      counters.audit += 1;
      counters.entity += 1;
      return {
        summary: {
          total: 1,
          created: 1,
          updated: 0,
          skipped: 0,
          failed: 0,
        },
        errors: [],
      };
    },
    ...overrides,
  };
}

function handlerWith(
  counters: Counters,
  dependencies: ImportEntityDataDependencies,
  logger?: ImportEntityDataLogger,
) {
  return createImportEntityDataHandler({
    createDependencies: () => {
      counters.factory += 1;
      return dependencies;
    },
    logger: logger ?? {
      warn: () => undefined,
      error: () => undefined,
    },
    requestId: () => "request-12345678",
  });
}

function assertNoAuthorizedSideEffects(counters: Counters): void {
  assertEquals(counters.executor, 0);
  assertEquals(counters.audit, 0);
  assertEquals(counters.entity, 0);
}

Deno.test("CORS, methods and malformed JSON fail before authorization side effects", async () => {
  const counters = emptyCounters();
  const handler = handlerWith(counters, successDependencies(counters));

  const options = await handler(request(undefined, "OPTIONS", ""));
  assertEquals(options.status, 200);
  assertEquals(options.headers.get("access-control-allow-origin"), "*");
  assertEquals(
    options.headers.get("access-control-expose-headers"),
    "X-Request-Id",
  );

  const method = await handler(request(undefined, "GET"));
  assertEquals(method.status, 405);
  assertEquals(method.headers.get("allow"), "POST, OPTIONS");
  assertEquals((await responseBody(method)).code, "METHOD_NOT_ALLOWED");

  const invalidJson = await handler(invalidJsonRequest());
  assertEquals(invalidJson.status, 400);
  assertEquals((await responseBody(invalidJson)).code, "INVALID_JSON");
  assertEquals(counters.factory, 1);
  assertEquals(counters.authentication, 1);
  assertEquals(counters.actor, 0);
  assertNoAuthorizedSideEffects(counters);
});

Deno.test("non-boolean dry_run is rejected instead of being coerced", async () => {
  const counters = emptyCounters();
  const handler = handlerWith(counters, successDependencies(counters));
  const response = await handler(request({
    workspace_id: "workspace-1",
    entity: "offices",
    mode: "create",
    rows: [{ name: "Budapest" }],
    dry_run: "false",
  }));

  assertEquals(response.status, 400);
  assertEquals((await responseBody(response)).code, "INVALID_DRY_RUN");
  assertEquals(counters.actor, 0);
  assertEquals(counters.entitlement, 0);
  assertNoAuthorizedSideEffects(counters);
});

Deno.test("RBAC denial and outage block dry-run, audit and entity work", async () => {
  for (
    const scenario of [
      {
        actor: { kind: "denied" as const },
        status: 403,
        code: "ADMIN_ROLE_REQUIRED",
      },
      {
        actor: {
          kind: "unavailable" as const,
          providerCode: "PGRST504",
        },
        status: 503,
        code: "AUTHORIZATION_UNAVAILABLE",
      },
    ]
  ) {
    const counters = emptyCounters();
    const dependencies = successDependencies(counters, {
      resolveActor: async () => {
        counters.actor += 1;
        return scenario.actor;
      },
    });
    const handler = handlerWith(counters, dependencies, {
      warn: () => undefined,
      error: () => undefined,
    });
    const response = await handler(request({
      workspace_id: "workspace-1",
      entity: "offices",
      mode: "create",
      rows: [{ name: "Budapest" }],
      dry_run: true,
    }));

    assertEquals(response.status, scenario.status);
    assertEquals((await responseBody(response)).code, scenario.code);
    assertEquals(counters.entitlement, 0);
    assertNoAuthorizedSideEffects(counters);
  }
});

Deno.test("exact csv_import plus members_list dependency is required before dry-run", async () => {
  assertEquals(CSV_IMPORT_REQUIRED_FEATURE_KEYS, ["csv_import", "members_list"]);

  for (
    const enabledFeatureKeys of [
      ["csv_import"],
      ["members_list"],
      ["csv_import_preview", "members_list"],
    ]
  ) {
    const counters = emptyCounters();
    const dependencies = successDependencies(counters, {
      resolveCsvImportEntitlement: async (workspaceId) => {
        counters.entitlement += 1;
        return await resolveCsvImportEntitlement(
          featureClient(enabledFeatureKeys),
          workspaceId,
        );
      },
    });
    const handler = handlerWith(counters, dependencies);
    const response = await handler(request({
      workspace_id: "workspace-1",
      entity: "offices",
      mode: "create",
      rows: [{ name: "Budapest" }],
      dry_run: true,
    }));

    assertEquals(response.status, 403);
    assertEquals((await responseBody(response)).code, "FEATURE_DISABLED");
    assertNoAuthorizedSideEffects(counters);
  }
});

Deno.test("entitlement outage returns sanitized 503 with zero authorized side effects", async () => {
  const hostile = "postgres://admin:secret@example.test private-token";
  const logs: Array<{ event: string; context: unknown }> = [];
  const counters = emptyCounters();
  const dependencies = successDependencies(counters, {
    resolveCsvImportEntitlement: async () => {
      counters.entitlement += 1;
      return {
        enabled: false,
        reason: "lookup_error",
        step: "feature_lookup",
        error: hostile,
      };
    },
  });
  const handler = handlerWith(counters, dependencies, {
    warn: (event, context) => logs.push({ event, context }),
    error: (event, context) => logs.push({ event, context }),
  });

  const response = await handler(request());
  const serializedBody = JSON.stringify(await responseBody(response));
  const serializedLogs = JSON.stringify(logs);
  assertEquals(response.status, 503);
  assert(
    serializedBody.includes("ENTITLEMENT_UNAVAILABLE"),
    serializedBody,
  );
  for (const serialized of [serializedBody, serializedLogs]) {
    assert(!serialized.includes(hostile), serialized);
    assert(!serialized.includes("private-token"), serialized);
    assert(!serialized.includes("admin:secret"), serialized);
  }
  assertNoAuthorizedSideEffects(counters);
});

Deno.test("positive canary reaches the authorized executor exactly once", async () => {
  const counters = emptyCounters();
  let received: AuthorizedImportCommand | null = null;
  const dependencies = successDependencies(counters, {
    executeAuthorizedImport: async (command) => {
      counters.executor += 1;
      counters.audit += 1;
      counters.entity += 1;
      received = command;
      return {
        summary: {
          total: 1,
          created: 1,
          updated: 0,
          skipped: 0,
          failed: 0,
        },
        errors: [],
      };
    },
  });
  const handler = handlerWith(counters, dependencies);
  const response = await handler(request());
  const body = await responseBody(response);

  assertEquals(response.status, 200);
  assertEquals(body, {
    success: true,
    summary: {
      total: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
    errors: [],
  });
  assertEquals(counters, {
    factory: 1,
    authentication: 1,
    actor: 1,
    entitlement: 1,
    executor: 1,
    audit: 1,
    entity: 1,
  });
  assertEquals(received, {
    workspace_id: "workspace-1",
    entity: "offices",
    mode: "create",
    rows: [{ name: "Budapest" }],
    actor_id: "user-1",
    actor_role: "owner",
  });
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(response.headers.get("x-request-id"), "request-12345678");
  assertEquals(
    response.headers.get("access-control-expose-headers"),
    "X-Request-Id",
  );
});

Deno.test("hostile provider and thrown details are absent from responses and logs", async () => {
  const hostile = "secret@example.test Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature";

  for (
    const scenario of [
      {
        override: {
          resolveActor: async () => ({
            kind: "unavailable" as const,
            providerCode: hostile,
          }),
        },
        expectedStatus: 503,
      },
      {
        override: {
          executeAuthorizedImport: async () => {
            throw new Error(hostile);
          },
        },
        expectedStatus: 500,
      },
      {
        override: {
          executeAuthorizedImport: async () => {
            throw new ImportDependencyError(hostile);
          },
        },
        expectedStatus: 503,
      },
    ]
  ) {
    const logs: Array<{ event: string; context: unknown }> = [];
    const counters = emptyCounters();
    const handler = handlerWith(
      counters,
      successDependencies(counters, scenario.override),
      {
        warn: (event, context) => logs.push({ event, context }),
        error: (event, context) => logs.push({ event, context }),
      },
    );
    const response = await handler(request());
    const serializedBody = JSON.stringify(await responseBody(response));
    const serializedLogs = JSON.stringify(logs);
    assertEquals(response.status, scenario.expectedStatus);
    for (const serialized of [serializedBody, serializedLogs]) {
      assert(!serialized.includes(hostile), serialized);
      assert(!serialized.includes("secret@example.test"), serialized);
      assert(!serialized.includes("eyJhbGciOiJIUzI1NiJ9"), serialized);
    }
  }
});
