import {
  type CleanupCreatedIdentitiesConfig,
  type CleanupCreatedIdentitiesDependencies,
  createCleanupCreatedIdentitiesHandler,
  type ResolvedCleanupCreatedIdentitiesConfig,
  SCHEDULER_SECRET_HEADER,
  WORKER_LEASE_SECONDS,
} from "./handler.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function inertJwt(
  role: string,
  ref: string | null = "abcdefghijklmnopqrst",
): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_")
      .replaceAll("=", "");
  const payload = ref === null ? { role } : { role, ref };
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.inert`;
}

const config: ResolvedCleanupCreatedIdentitiesConfig = {
  supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
  serviceRoleKey: "service-role-key-that-is-never-sent-by-the-scheduler",
  anonKey: inertJwt("anon"),
  schedulerSecret:
    "scheduler-secret-with-at-least-forty-three-characters-12345",
};

const runId = "37b92830-8ff7-41d3-8046-432b76b8a1ea";
const correlationId = "correlation01";
const cleanupJobId = "bd3980f8-4422-4518-9748-f5104e9919cc";
const userId = "1cb3129e-d07c-4b0d-aaf0-cb113bbecacb";
const leaseToken = "3b293ac6-593f-4894-a59c-b8418943be9c";

function schedulerRequest(
  body: unknown = {
    schema_version: 1,
    source: "pg_cron",
  },
): Request {
  return new Request("https://project.supabase.co/functions/v1/worker", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.anonKey}`,
      apikey: config.anonKey,
      [SCHEDULER_SECRET_HEADER]: config.schedulerSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function manualRequest(): Request {
  return new Request("https://project.supabase.co/functions/v1/worker", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ schema_version: 1, source: "manual" }),
  });
}

function acquiredReceipt(acquired = true): unknown {
  return {
    ok: true,
    acquired,
    run_id: runId,
    lease_expires_at: acquired ? "2026-07-22T10:02:00Z" : null,
  };
}

function preparedReceipt(): unknown {
  return {
    ok: true,
    cleanup_job_id: cleanupJobId,
    status: "pending_auth",
    user_id: userId,
    deleted_membership_count: 0,
    deleted_profile_count: 0,
    remaining_membership_count: 0,
    lease_token: leaseToken,
  };
}

function successDependencies(
  overrides: Partial<CleanupCreatedIdentitiesDependencies> = {},
): CleanupCreatedIdentitiesDependencies {
  let deleted = false;
  return {
    acquireWorker: async () => acquiredReceipt(),
    finishWorker: async ({ runId: expectedRunId, status }) => ({
      ok: true,
      run_id: expectedRunId,
      status,
    }),
    claimJobs: async () => [
      {
        cleanup_job_id: cleanupJobId,
        status: "pending_auth",
        user_id: userId,
        lease_token: leaseToken,
      },
    ],
    prepareCleanup: async () => preparedReceipt(),
    completeCleanup: async () => ({
      ok: true,
      cleanup_job_id: cleanupJobId,
      status: "completed",
      lease_token: leaseToken,
    }),
    failCleanup: async ({ reason }) => ({
      ok: true,
      cleanup_job_id: cleanupJobId,
      status: "pending_auth",
      attempt_count: 1,
      error_code: reason,
      lease_token: leaseToken,
    }),
    getAuthUser: async () =>
      deleted
        ? {
          data: { user: null },
          error: { code: "user_not_found", status: 404 },
        }
        : { data: { user: { id: userId } }, error: null },
    deleteAuthUser: async () => {
      deleted = true;
      return { data: { user: null }, error: null };
    },
    ...overrides,
  };
}

function handlerWith(
  dependencies: CleanupCreatedIdentitiesDependencies,
  overrides: Partial<
    Parameters<typeof createCleanupCreatedIdentitiesHandler>[0]
  > = {},
) {
  return createCleanupCreatedIdentitiesHandler({
    loadConfig: () => config,
    createDependencies: () => dependencies,
    randomRunId: () => runId,
    randomCorrelationId: () => correlationId,
    ...overrides,
  });
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return await response.json();
}

Deno.test(
  "scheduler authentication requires exact bearer, apikey, and dedicated secret before client creation",
  async () => {
    const invalidHeaders: Array<Record<string, string>> = [
      {},
      { Authorization: `Bearer ${config.anonKey}` },
      {
        Authorization: `Bearer ${config.anonKey}`,
        apikey: `${config.anonKey}-wrong`,
        [SCHEDULER_SECRET_HEADER]: config.schedulerSecret,
      },
      {
        Authorization: `Bearer ${config.anonKey}`,
        apikey: config.anonKey,
        [SCHEDULER_SECRET_HEADER]: `${config.schedulerSecret}-wrong`,
      },
    ];
    let factoryCalls = 0;
    const handler = createCleanupCreatedIdentitiesHandler({
      loadConfig: () => config,
      createDependencies: () => {
        factoryCalls += 1;
        return successDependencies();
      },
      randomRunId: () => runId,
      randomCorrelationId: () => correlationId,
    });

    for (const headers of invalidHeaders) {
      const result = await handler(
        new Request("https://worker.invalid", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ schema_version: 1, source: "pg_cron" }),
        }),
      );
      assertEquals(result.status, 403);
    }
    assertEquals(factoryCalls, 0);
  },
);

Deno.test(
  "server configuration requires an exact Supabase HTTPS origin and bounded base64url secret",
  async () => {
    const invalidConfigs: CleanupCreatedIdentitiesConfig[] = [
      { ...config, supabaseUrl: "http://abcdefghijklmnopqrst.supabase.co" },
      {
        ...config,
        supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co/functions/v1",
      },
      {
        ...config,
        supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co?redirect=evil",
      },
      { ...config, supabaseUrl: "https://custom.example.com" },
      { ...config, supabaseUrl: "https://abcdefghijklmnopqrs.supabase.co" },
      { ...config, supabaseUrl: "https://abcdefghijklmnopqrstu.supabase.co" },
      { ...config, anonKey: "sb_publishable_incompatible_with_verify_jwt" },
      {
        ...config,
        anonKey: inertJwt("service_role"),
      },
      { ...config, anonKey: inertJwt("anon", "wrongprojectref00000") },
      { ...config, anonKey: inertJwt("anon", null) },
      { ...config, schedulerSecret: "short" },
      {
        ...config,
        schedulerSecret:
          "invalid.secret.with.dots.that.is-long-enough-to-be-rejected",
      },
      { ...config, schedulerSecret: "a".repeat(43) },
      { ...config, schedulerSecret: "a".repeat(129) },
    ];

    for (const invalidConfig of invalidConfigs) {
      let factoryCalls = 0;
      const handler = createCleanupCreatedIdentitiesHandler({
        loadConfig: () => invalidConfig,
        createDependencies: () => {
          factoryCalls += 1;
          return successDependencies();
        },
        randomRunId: () => runId,
        randomCorrelationId: () => correlationId,
        logger: { info: () => undefined, error: () => undefined },
      });
      assertEquals((await handler(schedulerRequest())).status, 500);
      assertEquals(factoryCalls, 0);
    }
  },
);

Deno.test("configuration provider failures are sanitized before dependency creation", async () => {
  let factoryCalls = 0;
  const logged: Array<{ event: string; context: unknown }> = [];
  const handler = createCleanupCreatedIdentitiesHandler({
    loadConfig: () => {
      throw new Error("provider details must not escape");
    },
    createDependencies: () => {
      factoryCalls += 1;
      return successDependencies();
    },
    randomRunId: () => runId,
    randomCorrelationId: () => correlationId,
    logger: {
      info: () => undefined,
      error: (event, context) => logged.push({ event, context }),
    },
  });

  const response = await handler(schedulerRequest());
  assertEquals(response.status, 500);
  assertEquals(await body(response), {
    ok: false,
    error: "server_configuration_error",
    correlation_id: correlationId,
  });
  assertEquals(factoryCalls, 0);
  assertEquals(logged, [
    {
      event: "cleanup-created-identities.configuration-failed",
      context: {
        correlationId,
        code: "invalid_server_configuration",
      },
    },
  ]);
});

Deno.test(
  "reviewed service-role path is manual-only and scheduler credentials are pg_cron-only",
  async () => {
    const overlap = successDependencies({
      acquireWorker: async () => acquiredReceipt(false),
    });
    const handler = handlerWith(overlap);
    assertEquals((await handler(manualRequest())).status, 200);

    const manualBodyWithSchedulerCredentials = schedulerRequest({
      schema_version: 1,
      source: "manual",
    });
    assertEquals(
      (await handler(manualBodyWithSchedulerCredentials)).status,
      403,
    );

    const cronBodyWithServiceCredential = new Request(
      "https://worker.invalid",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ schema_version: 1, source: "pg_cron" }),
      },
    );
    assertEquals((await handler(cronBodyWithServiceCredential)).status, 403);
  },
);

Deno.test("method and exact versioned body schema fail closed without browser CORS", async () => {
  let factoryCalls = 0;
  const handler = createCleanupCreatedIdentitiesHandler({
    loadConfig: () => config,
    createDependencies: () => {
      factoryCalls += 1;
      return successDependencies();
    },
    randomRunId: () => runId,
    randomCorrelationId: () => correlationId,
  });
  const options = await handler(
    new Request("https://worker.invalid", {
      method: "OPTIONS",
    }),
  );
  assertEquals(options.status, 405);
  assertEquals(options.headers.get("access-control-allow-origin"), null);

  for (
    const invalid of [
      {},
      { schema_version: 2, source: "pg_cron" },
      { schema_version: 1, source: "pg_cron", extra: true },
      { schema_version: 1, source: "legacy-temp-profiles" },
    ]
  ) {
    assertEquals((await handler(schedulerRequest(invalid))).status, 400);
  }
  assertEquals(factoryCalls, 0);
});

Deno.test("overlap is an explicit successful skip without claim or finish", async () => {
  const calls: string[] = [];
  const dependencies = successDependencies({
    acquireWorker: async () => {
      calls.push("acquire");
      return acquiredReceipt(false);
    },
    claimJobs: async () => {
      calls.push("claim");
      return [];
    },
    finishWorker: async () => {
      calls.push("finish");
      return {};
    },
  });
  const result = await handlerWith(dependencies)(schedulerRequest());
  assertEquals(result.status, 200);
  assertEquals(calls, ["acquire"]);
  assertEquals(await body(result), {
    ok: true,
    status: "skipped",
    reason: "worker_overlap",
    correlation_id: correlationId,
    summary: {
      claimed: 0,
      completed: 0,
      pending: 0,
      receipt_failures: 0,
    },
  });
});

Deno.test("happy path uses only the fenced saga RPC and exact Auth identity", async () => {
  const calls: string[] = [];
  let acquiredLeaseSeconds: number | null = null;
  const base = successDependencies();
  base.acquireWorker = async ({ leaseSeconds }) => {
    acquiredLeaseSeconds = leaseSeconds;
    return acquiredReceipt();
  };
  const dependencies = new Proxy(base, {
    get(target, property, receiver) {
      assert(
        typeof property === "symbol" || property in target,
        `Unexpected dependency access: ${String(property)}`,
      );
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        calls.push(String(property));
        return value(...args);
      };
    },
  });

  const result = await handlerWith(dependencies)(schedulerRequest());
  assertEquals(result.status, 200);
  assertEquals(await body(result), {
    ok: true,
    status: "completed",
    correlation_id: correlationId,
    summary: {
      claimed: 1,
      completed: 1,
      pending: 0,
      receipt_failures: 0,
    },
  });
  assertEquals(calls, [
    "acquireWorker",
    "claimJobs",
    "prepareCleanup",
    "getAuthUser",
    "deleteAuthUser",
    "getAuthUser",
    "completeCleanup",
    "finishWorker",
  ]);
  assertEquals(acquiredLeaseSeconds, WORKER_LEASE_SECONDS);
  assert(
    !calls.some((call) => call.includes("profile") || call.includes("legacy")),
    "Legacy temporary-profile cleanup became reachable",
  );
});

Deno.test("Auth timeouts are persisted and exposed as an incomplete 5xx run", async () => {
  let finishInput: unknown;
  const dependencies = successDependencies({
    getAuthUser: () => new Promise(() => undefined),
    finishWorker: async (input) => {
      finishInput = input;
      return { ok: true, run_id: runId, status: input.status };
    },
  });
  const result = await handlerWith(dependencies, {
    operationTimeoutMs: 2,
    totalRuntimeMs: 100,
  })(schedulerRequest());
  const resultBody = await body(result);
  assertEquals(result.status, 503);
  assertEquals(resultBody.status, "incomplete");
  assertEquals(resultBody.summary, {
    claimed: 1,
    completed: 0,
    pending: 1,
    receipt_failures: 0,
  });
  assertEquals(finishInput, {
    runId,
    status: "failed",
    summary: {
      claimed: 1,
      completed: 0,
      pending: 1,
      receiptFailures: 0,
    },
    errorCode: "batch_failed",
  });
});

Deno.test(
  "invalid completion receipt is fail-visible and persisted as a receipt failure",
  async () => {
    let finishInput: unknown;
    const dependencies = successDependencies({
      completeCleanup: async () => ({ ok: true, status: "completed" }),
      finishWorker: async (input) => {
        finishInput = input;
        return { ok: true, run_id: runId, status: input.status };
      },
    });
    const result = await handlerWith(dependencies)(schedulerRequest());
    assertEquals(result.status, 503);
    assertEquals((await body(result)).summary, {
      claimed: 1,
      completed: 0,
      pending: 1,
      receipt_failures: 1,
    });
    assertEquals(
      (finishInput as { errorCode: string }).errorCode,
      "receipt_persistence_failed",
    );
  },
);

Deno.test("acquired singleton is always finished with the exact run token", async () => {
  const sensitive =
    "person@example.com 6955fd8e-f927-461f-b645-14986d4dc33e secret-value";
  let finishInput: unknown;
  const logged: unknown[] = [];
  const dependencies = successDependencies({
    claimJobs: async () => {
      throw new Error(sensitive);
    },
    finishWorker: async (input) => {
      finishInput = input;
      return { ok: true, run_id: runId, status: input.status };
    },
  });
  const result = await handlerWith(dependencies, {
    logger: {
      info: (event, context) => logged.push({ event, context }),
      error: (event, context) => logged.push({ event, context }),
    },
  })(schedulerRequest());
  const serialized = JSON.stringify({ body: await body(result), logged });
  assertEquals(result.status, 503);
  assertEquals(finishInput, {
    runId,
    status: "failed",
    summary: {
      claimed: 0,
      completed: 0,
      pending: 0,
      receiptFailures: 0,
    },
    errorCode: "invocation_failed",
  });
  assert(!serialized.includes("person@example.com"), "Email leaked");
  assert(!serialized.includes("6955fd8e"), "Raw UUID leaked");
  assert(!serialized.includes("secret-value"), "Secret leaked");
  assert(!serialized.includes(runId), "Run token leaked");
  assert(!serialized.includes(cleanupJobId), "Cleanup job ID leaked");
  assert(!serialized.includes(userId), "User ID leaked");
});

Deno.test("a missing finish receipt prevents a false-success response", async () => {
  const result = await handlerWith(
    successDependencies({
      finishWorker: async () => ({ ok: false }),
    }),
  )(schedulerRequest());
  const resultBody = await body(result);
  assertEquals(result.status, 503);
  assertEquals(resultBody.error, "worker_finish_receipt_failed");
});
