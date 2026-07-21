import {
  type AuthAdminUpdateResult,
  cleanupTemporaryUserAuthFirst,
  verifyAuthAdminUpdate,
} from "./auth-profile-sync.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

const successfulAuthResult = (userId: string): AuthAdminUpdateResult => ({
  data: { user: { id: userId } },
  error: null,
});

const missingAuthResult = (): AuthAdminUpdateResult => ({
  data: { user: null },
  error: { code: "user_not_found", status: 404 },
});

Deno.test("auth admin update succeeds only for the expected returned user", async () => {
  assertEquals(
    await verifyAuthAdminUpdate(
      "user-1",
      async () => successfulAuthResult("user-1"),
    ),
    true,
  );
  assertEquals(
    await verifyAuthAdminUpdate(
      "user-1",
      async () => successfulAuthResult("user-2"),
    ),
    false,
  );
  assertEquals(
    await verifyAuthAdminUpdate(
      "user-1",
      async () => ({ data: null, error: null }),
    ),
    false,
  );
  assertEquals(
    await verifyAuthAdminUpdate("user-1", async () => ({
      data: { user: { id: "user-1" } },
      error: new Error("auth unavailable"),
    })),
    false,
  );
});

Deno.test("auth admin exceptions fail closed", async () => {
  assertEquals(
    await verifyAuthAdminUpdate("user-1", async () => {
      throw new Error("transport failure");
    }),
    false,
  );
});

Deno.test("temporary cleanup preserves every database row when auth deletion fails", async () => {
  let databaseCleanupCalls = 0;
  const result = await cleanupTemporaryUserAuthFirst({
    expectedUserId: "temp-user",
    getAuthUser: async () => successfulAuthResult("temp-user"),
    deleteAuthUser: async () => ({
      data: null,
      error: new Error("auth unavailable"),
    }),
    deleteDatabaseRows: [async () => {
      databaseCleanupCalls += 1;
      return true;
    }],
  });

  assertEquals(result, { ok: false, reason: "auth_delete_failed" });
  assertEquals(databaseCleanupCalls, 0);
});

Deno.test("temporary cleanup runs database cleanup only after verified auth deletion", async () => {
  const calls: string[] = [];
  const result = await cleanupTemporaryUserAuthFirst({
    expectedUserId: "temp-user",
    getAuthUser: async () => successfulAuthResult("temp-user"),
    deleteAuthUser: async () => {
      calls.push("auth");
      return successfulAuthResult("temp-user");
    },
    deleteDatabaseRows: [
      async () => {
        calls.push("votes");
        return true;
      },
      async () => {
        calls.push("participants");
        return true;
      },
      async () => {
        calls.push("profile");
        return true;
      },
    ],
  });

  assertEquals(result, { ok: true });
  assertEquals(calls, ["auth", "votes", "participants", "profile"]);
});

Deno.test("temporary cleanup fails visibly and stops after a database cleanup failure", async () => {
  const calls: string[] = [];
  const result = await cleanupTemporaryUserAuthFirst({
    expectedUserId: "temp-user",
    getAuthUser: async () => successfulAuthResult("temp-user"),
    deleteAuthUser: async () => successfulAuthResult("temp-user"),
    deleteDatabaseRows: [
      async () => {
        calls.push("votes");
        return false;
      },
      async () => {
        calls.push("profile");
        return true;
      },
    ],
  });

  assertEquals(result, { ok: false, reason: "database_cleanup_failed" });
  assertEquals(calls, ["votes"]);
});

Deno.test("temporary cleanup retries remaining database rows when auth user is already absent", async () => {
  let authDeleteCalls = 0;
  let databaseCleanupCalls = 0;
  const result = await cleanupTemporaryUserAuthFirst({
    expectedUserId: "temp-user",
    getAuthUser: async () => missingAuthResult(),
    deleteAuthUser: async () => {
      authDeleteCalls += 1;
      return missingAuthResult();
    },
    deleteDatabaseRows: [async () => {
      databaseCleanupCalls += 1;
      return true;
    }],
  });

  assertEquals(result, { ok: true });
  assertEquals(authDeleteCalls, 0);
  assertEquals(databaseCleanupCalls, 1);
});

Deno.test("temporary cleanup rechecks a concurrent auth deletion before database cleanup", async () => {
  let authLookupCalls = 0;
  let databaseCleanupCalls = 0;
  const result = await cleanupTemporaryUserAuthFirst({
    expectedUserId: "temp-user",
    getAuthUser: async () => {
      authLookupCalls += 1;
      return authLookupCalls === 1
        ? successfulAuthResult("temp-user")
        : missingAuthResult();
    },
    deleteAuthUser: async () => missingAuthResult(),
    deleteDatabaseRows: [async () => {
      databaseCleanupCalls += 1;
      return true;
    }],
  });

  assertEquals(result, { ok: true });
  assertEquals(authLookupCalls, 2);
  assertEquals(databaseCleanupCalls, 1);
});

Deno.test("temporary cleanup preserves database state when auth absence is uncertain", async () => {
  let databaseCleanupCalls = 0;
  const result = await cleanupTemporaryUserAuthFirst({
    expectedUserId: "temp-user",
    getAuthUser: async () => ({
      data: { user: null },
      error: { code: "network_error", status: 503 },
    }),
    deleteAuthUser: async () => successfulAuthResult("temp-user"),
    deleteDatabaseRows: [async () => {
      databaseCleanupCalls += 1;
      return true;
    }],
  });

  assertEquals(result, { ok: false, reason: "auth_lookup_failed" });
  assertEquals(databaseCleanupCalls, 0);
});
