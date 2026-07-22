import {
  type CleanupTempUsersConfig,
  type CleanupTempUsersDependencies,
  createCleanupTempUsersHandler,
  MAX_TEMPORARY_USER_CLEANUP_BATCH_SIZE,
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

const config: Required<CleanupTempUsersConfig> = {
  supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
  serviceRoleKey: "service-role-key",
};

const userId = "1cb3129e-d07c-4b0d-aaf0-cb113bbecacb";
const leaseToken = "b8df3c79-0390-49a3-ab39-d5c02b928037";

function request(token = config.serviceRoleKey, method = "POST"): Request {
  return new Request(
    `${config.supabaseUrl}/functions/v1/cleanup-temp-users`,
    {
      method,
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

function missingAuthResult() {
  return {
    data: { user: null },
    error: { code: "user_not_found", status: 404 },
  };
}

function successDependencies(
  overrides: Partial<CleanupTempUsersDependencies> = {},
): CleanupTempUsersDependencies {
  let authDeleted = false;
  return {
    claimEligibleProfiles: async () => ({
      data: [{ user_id: userId, lease_token: leaseToken }],
      error: null,
    }),
    prepareProfileCleanup: async (expectedUserId, expectedLeaseToken) => ({
      data: {
        ok: true,
        user_id: expectedUserId,
        lease_token: expectedLeaseToken,
        mode: "eligible_profile",
      },
      error: null,
    }),
    completeProfileCleanup: async (expectedUserId, expectedLeaseToken) => ({
      data: {
        ok: true,
        user_id: expectedUserId,
        lease_token: expectedLeaseToken,
        status: "completed",
      },
      error: null,
    }),
    getAuthUser: async (expectedUserId) =>
      authDeleted
        ? missingAuthResult()
        : { data: { user: { id: expectedUserId } }, error: null },
    deleteAuthUser: async () => {
      authDeleted = true;
      return { data: { user: null }, error: null };
    },
    ...overrides,
  };
}

function handlerWith(
  dependencies: CleanupTempUsersDependencies,
  overrides: Partial<Parameters<typeof createCleanupTempUsersHandler>[0]> = {},
) {
  return createCleanupTempUsersHandler({
    loadConfig: () => config,
    createDependencies: () => dependencies,
    logger: { info: () => undefined, error: () => undefined },
    ...overrides,
  });
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return await response.json();
}

Deno.test("service-role authentication and methods are checked before client creation", async () => {
  let factoryCalls = 0;
  const handler = createCleanupTempUsersHandler({
    loadConfig: () => config,
    createDependencies: () => {
      factoryCalls += 1;
      return successDependencies();
    },
    logger: { info: () => undefined, error: () => undefined },
  });

  const options = await handler(request("", "OPTIONS"));
  assertEquals(options.status, 200);
  assertEquals(options.headers.get("access-control-allow-origin"), "*");
  assertEquals((await handler(request("wrong"))).status, 403);
  assertEquals(
    (await handler(request(config.serviceRoleKey, "GET"))).status,
    405,
  );
  assertEquals(factoryCalls, 0);
});

Deno.test("only an exact 20-character Supabase origin is accepted before client creation", async () => {
  const invalidOrigins = [
    "http://abcdefghijklmnopqrst.supabase.co",
    "https://abcdefghijklmnopqrst.supabase.co/path",
    "https://abcdefghijklmnopqrst.supabase.co?redirect=https://evil.test",
    "https://abcdefghijklmnopqrst.supabase.co.evil.test",
    "https://abcdefghijklmnopqrs.supabase.co",
    "https://abcdefghijklmnopqrstu.supabase.co",
    "https://custom.example.test",
  ];
  for (const supabaseUrl of invalidOrigins) {
    let factoryCalls = 0;
    const handler = createCleanupTempUsersHandler({
      loadConfig: () => ({ ...config, supabaseUrl }),
      createDependencies: () => {
        factoryCalls += 1;
        return successDependencies();
      },
      logger: { info: () => undefined, error: () => undefined },
    });
    const response = await handler(request());
    assertEquals(response.status, 500);
    assertEquals(factoryCalls, 0);
  }
});

Deno.test("candidate RPC errors fail closed instead of becoming an empty success", async () => {
  let authCalls = 0;
  const handler = handlerWith(successDependencies({
    claimEligibleProfiles: async () => ({
      data: null,
      error: new Error("database unavailable"),
    }),
    getAuthUser: async () => {
      authCalls += 1;
      return missingAuthResult();
    },
  }));

  const response = await handler(request());
  const result = await body(response);
  assertEquals(response.status, 503);
  assertEquals(result.deleted, 0);
  assertEquals(authCalls, 0);
  assertEquals(
    (result.cleanup_contract as Record<string, unknown>).candidate_source,
    "claim_eligible_temporary_profiles_v1",
  );
  assertEquals(
    ((result.summary as Record<string, unknown>).failure_counts as Record<
      string,
      number
    >).candidate_query_failed,
    1,
  );
});

Deno.test("malformed or duplicate fenced candidates fail before Auth", async () => {
  for (
    const data of [
      [{ user_id: userId }],
      [{ user_id: "not-a-uuid", lease_token: leaseToken }],
      [
        { user_id: userId, lease_token: leaseToken },
        {
          user_id: userId,
          lease_token: "84000000-0000-4000-8000-000000000001",
        },
      ],
    ]
  ) {
    let authCalls = 0;
    const handler = handlerWith(successDependencies({
      claimEligibleProfiles: async () => ({ data, error: null }),
      getAuthUser: async () => {
        authCalls += 1;
        return missingAuthResult();
      },
    }));
    const response = await handler(request());
    assertEquals(response.status, 503);
    assertEquals(authCalls, 0);
  }
});

Deno.test("eligibility is revalidated with the exact fence before Auth access", async () => {
  const calls: string[] = [];
  const handler = handlerWith(successDependencies({
    prepareProfileCleanup: async () => {
      calls.push("db:prepare");
      return { data: null, error: { code: "40001" } };
    },
    getAuthUser: async () => {
      calls.push("auth:get");
      return missingAuthResult();
    },
  }));

  const response = await handler(request());
  const result = await body(response);
  assertEquals(response.status, 503);
  assertEquals(calls, ["db:prepare"]);
  assertEquals(
    ((result.summary as Record<string, unknown>).failure_counts as Record<
      string,
      number
    >).eligibility_recheck_failed,
    1,
  );
});

Deno.test("Auth uncertainty preserves the fenced database state", async () => {
  let completeCalls = 0;
  const handler = handlerWith(successDependencies({
    getAuthUser: async () => ({
      data: { user: null },
      error: { code: "transport_error", status: 503 },
    }),
    completeProfileCleanup: async () => {
      completeCalls += 1;
      return { data: null, error: null };
    },
  }));

  const response = await handler(request());
  assertEquals(response.status, 503);
  assertEquals((await body(response)).deleted, 0);
  assertEquals(completeCalls, 0);
});

Deno.test("eligibility is renewed after Auth lookup and immediately before delete", async () => {
  const calls: string[] = [];
  let prepareCalls = 0;
  const handler = handlerWith(successDependencies({
    prepareProfileCleanup: async (id, token) => {
      prepareCalls += 1;
      calls.push("db:prepare");
      return prepareCalls === 1
        ? {
          data: {
            ok: true,
            user_id: id,
            lease_token: token,
            mode: "eligible_profile",
          },
          error: null,
        }
        : { data: null, error: { code: "40001" } };
    },
    getAuthUser: async (id) => {
      calls.push("auth:get");
      return { data: { user: { id } }, error: null };
    },
    deleteAuthUser: async () => {
      calls.push("auth:delete");
      return { data: { user: null }, error: null };
    },
    completeProfileCleanup: async () => {
      calls.push("db:complete");
      return { data: null, error: null };
    },
  }));

  const response = await handler(request());
  const result = await body(response);
  assertEquals(response.status, 503);
  assert(calls[0] === "db:prepare", "initial eligibility check is missing");
  assert(calls[1] === "auth:get", "Auth lookup did not precede renewal");
  assert(calls[2] === "db:prepare", "delete-adjacent renewal is missing");
  assert(
    !calls.includes("auth:delete"),
    "Auth delete crossed a rejected fence",
  );
  assert(
    !calls.includes("db:complete"),
    "database completion crossed a rejected fence",
  );
  assertEquals(
    ((result.summary as Record<string, unknown>).failure_counts as Record<
      string,
      number
    >).eligibility_recheck_failed,
    1,
  );
});

Deno.test("successful and already-absent Auth paths complete through one fenced RPC", async () => {
  const calls: string[] = [];
  let deleted = false;
  const handler = handlerWith(successDependencies({
    prepareProfileCleanup: async (id, token) => {
      calls.push(`db:prepare:${id}:${token}`);
      return {
        data: {
          ok: true,
          user_id: id,
          lease_token: token,
          mode: "eligible_profile",
        },
        error: null,
      };
    },
    getAuthUser: async (id) => {
      calls.push("auth:get");
      return deleted
        ? missingAuthResult()
        : { data: { user: { id } }, error: null };
    },
    deleteAuthUser: async () => {
      calls.push("auth:delete");
      deleted = true;
      return { data: { user: null }, error: null };
    },
    completeProfileCleanup: async (id, token) => {
      calls.push(`db:complete:${id}:${token}`);
      return {
        data: {
          ok: true,
          user_id: id,
          lease_token: token,
          status: "completed",
        },
        error: null,
      };
    },
  }));

  assertEquals((await handler(request())).status, 200);
  assertEquals(calls, [
    `db:prepare:${userId}:${leaseToken}`,
    "auth:get",
    `db:prepare:${userId}:${leaseToken}`,
    "auth:delete",
    "auth:get",
    `db:complete:${userId}:${leaseToken}`,
  ]);

  calls.length = 0;
  const retry = await handler(request());
  assertEquals(retry.status, 200);
  assertEquals((await body(retry)).deleted, 1);
  assertEquals(calls, [
    `db:prepare:${userId}:${leaseToken}`,
    "auth:get",
    `db:complete:${userId}:${leaseToken}`,
  ]);
});

Deno.test("a malformed completion receipt is fail-visible after Auth absence", async () => {
  const handler = handlerWith(successDependencies({
    getAuthUser: async () => missingAuthResult(),
    completeProfileCleanup: async () => ({
      data: { ok: true, status: "completed" },
      error: null,
    }),
  }));
  const response = await handler(request());
  const result = await body(response);
  assertEquals(response.status, 503);
  assertEquals(result.deleted, 0);
  assertEquals(
    ((result.summary as Record<string, unknown>).failure_counts as Record<
      string,
      number
    >).database_cleanup_failed,
    1,
  );
});

Deno.test("the candidate batch is bounded and exposes no direct table-delete dependency", async () => {
  const calls: string[] = [];
  let requestedLimit = 0;
  const base = successDependencies({
    claimEligibleProfiles: async (limit) => {
      requestedLimit = limit;
      return {
        data: Array.from({ length: limit }, (_, index) => ({
          user_id: `10000000-0000-4000-8000-${
            String(index + 1).padStart(12, "0")
          }`,
          lease_token: `20000000-0000-4000-8000-${
            String(index + 1).padStart(12, "0")
          }`,
        })),
        error: null,
      };
    },
    getAuthUser: async () => missingAuthResult(),
  });
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

  const response = await handlerWith(dependencies, { batchSize: 3 })(request());
  const result = await body(response);
  assertEquals(response.status, 200);
  assertEquals(requestedLimit, 3);
  assertEquals(
    (result.summary as Record<string, unknown>).batch_limit_reached,
    true,
  );
  assert(
    calls.every((call) =>
      [
        "claimEligibleProfiles",
        "prepareProfileCleanup",
        "getAuthUser",
        "completeProfileCleanup",
      ].includes(call)
    ),
    `Unexpected direct-table dependency: ${JSON.stringify(calls)}`,
  );

  let threw = false;
  try {
    handlerWith(successDependencies(), {
      batchSize: MAX_TEMPORARY_USER_CLEANUP_BATCH_SIZE + 1,
    });
  } catch {
    threw = true;
  }
  assert(threw, "Oversized cleanup batch was accepted");
});

Deno.test("a per-call timeout aborts progress before any later side effect", async () => {
  let authDeleteCalls = 0;
  let completeCalls = 0;
  const handler = handlerWith(
    successDependencies({
      getAuthUser: () => new Promise(() => undefined),
      deleteAuthUser: async () => {
        authDeleteCalls += 1;
        return missingAuthResult();
      },
      completeProfileCleanup: async () => {
        completeCalls += 1;
        return { data: null, error: null };
      },
    }),
    {
      operationTimeoutMs: 20,
      totalRuntimeMs: 200,
    },
  );

  const response = await handler(request());
  const result = await body(response);
  assertEquals(response.status, 503);
  assertEquals(authDeleteCalls, 0);
  assertEquals(completeCalls, 0);
  assertEquals(
    ((result.summary as Record<string, unknown>).failure_counts as Record<
      string,
      number
    >).deadline_exceeded,
    1,
  );
});

Deno.test("the total deadline fails all unprocessed fenced candidates visibly", async () => {
  let clockReads = 0;
  let prepareCalls = 0;
  const handler = handlerWith(
    successDependencies({
      claimEligibleProfiles: async () => ({
        data: [
          { user_id: userId, lease_token: leaseToken },
          {
            user_id: "84000000-0000-4000-8000-000000000002",
            lease_token: "85000000-0000-4000-8000-000000000002",
          },
        ],
        error: null,
      }),
      prepareProfileCleanup: async () => {
        prepareCalls += 1;
        return { data: null, error: null };
      },
    }),
    {
      now: () => {
        clockReads += 1;
        return clockReads <= 3 ? 0 : 1_000;
      },
      operationTimeoutMs: 100,
      totalRuntimeMs: 500,
    },
  );

  const response = await handler(request());
  const result = await body(response);
  assertEquals(response.status, 503);
  assertEquals(prepareCalls, 0);
  assertEquals((result.summary as Record<string, unknown>).failed, 2);
  assertEquals(
    ((result.summary as Record<string, unknown>).failure_counts as Record<
      string,
      number
    >).deadline_exceeded,
    2,
  );
});
