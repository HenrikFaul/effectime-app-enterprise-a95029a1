import {
  type AuthAdminUserResult,
  classifyCreatedIdentityPreparationError,
  cleanupRegisteredCreatedIdentity,
  completeCreatedIdentityProvisioningVerified,
  deleteCreatedAuthIdentityVerified,
  isCompletedCreatedIdentityProvisioningReceipt,
  isFailedCreatedIdentityCleanupReceipt,
  parseClaimedCreatedIdentityCleanups,
  parseCreatedIdentityCleanupPreparationResult,
  parsePreparedCreatedIdentityCleanupReceipt,
  parseRegisteredCreatedIdentityProvisioningReceipt,
  reconcileCreatedIdentityCleanupJobs,
} from "./created-identity-cleanup.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

const present = (id: string): AuthAdminUserResult => ({
  data: { user: { id } },
  error: null,
});

const missing = (): AuthAdminUserResult => ({
  data: { user: null },
  error: { code: "user_not_found", status: 404 },
});

Deno.test("prepare errors distinguish delayed Auth visibility from database failure", () => {
  assertEquals(
    classifyCreatedIdentityPreparationError({ code: "P0002" }),
    "identity_not_visible",
  );
  assertEquals(
    classifyCreatedIdentityPreparationError({ code: "55000" }),
    "database_cleanup_failed",
  );
  assertEquals(
    classifyCreatedIdentityPreparationError(new Error("network")),
    "database_cleanup_failed",
  );
});

Deno.test("provisioning registration receipts are strict pre-Auth contracts", () => {
  const expected = { workspaceId: "workspace", cleanupIntentId: "intent" };
  const receipt = {
    ok: true,
    cleanup_job_id: "job",
    cleanup_intent_id: "intent",
    workspace_id: "workspace",
    status: "provisioning",
  };

  assertEquals(
    parseRegisteredCreatedIdentityProvisioningReceipt(receipt, expected),
    { cleanupJobId: "job" },
  );
  assertEquals(
    parseRegisteredCreatedIdentityProvisioningReceipt(
      { ...receipt, extra: true },
      expected,
    ),
    null,
  );
  assertEquals(
    parseRegisteredCreatedIdentityProvisioningReceipt(
      { ...receipt, cleanup_intent_id: "other" },
      expected,
    ),
    null,
  );
});

Deno.test("cleanup preparation receipts require an exact bound Auth identity", () => {
  const receipt = {
    ok: true,
    cleanup_job_id: "job",
    status: "pending_auth",
    user_id: "created-user",
    deleted_membership_count: 0,
    deleted_profile_count: 0,
    remaining_membership_count: 0,
  };

  assertEquals(parsePreparedCreatedIdentityCleanupReceipt(receipt, "job"), {
    cleanupJobId: "job",
    userId: "created-user",
  });
  assertEquals(
    parsePreparedCreatedIdentityCleanupReceipt(
      { ...receipt, user_id: null },
      "job",
    ),
    null,
  );
  assertEquals(
    parsePreparedCreatedIdentityCleanupReceipt(
      { ...receipt, workspace_id: "forbidden" },
      "job",
    ),
    null,
  );
  assertEquals(
    parseCreatedIdentityCleanupPreparationResult(null, "job"),
    { ok: false, reason: "identity_not_visible" },
  );
  assertEquals(
    parseCreatedIdentityCleanupPreparationResult(
      { ...receipt, extra: true },
      "job",
    ),
    { ok: false, reason: "database_cleanup_failed" },
  );
});

Deno.test("provisioning completion receipts bind the exact Auth user and membership", () => {
  const receipt = {
    ok: true,
    cleanup_job_id: "job",
    status: "provisioned",
    user_id: "created-user",
    membership_id: "membership",
  };
  const expected = {
    cleanupJobId: "job",
    userId: "created-user",
    membershipId: "membership",
  };

  assertEquals(
    isCompletedCreatedIdentityProvisioningReceipt(receipt, expected),
    true,
  );
  assertEquals(
    isCompletedCreatedIdentityProvisioningReceipt(
      { ...receipt, membership_id: "other" },
      expected,
    ),
    false,
  );
  assertEquals(
    isCompletedCreatedIdentityProvisioningReceipt(
      { ...receipt, extra: true },
      expected,
    ),
    false,
  );
});

Deno.test("provisioning completion retries one lost idempotent response", async () => {
  let attempts = 0;
  const expected = {
    cleanupJobId: "job",
    userId: "created-user",
    membershipId: "membership",
  };
  const completed = await completeCreatedIdentityProvisioningVerified({
    expected,
    completeProvisioning: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("response lost");
      return {
        data: {
          ok: true,
          cleanup_job_id: "job",
          status: "provisioned",
          user_id: "created-user",
          membership_id: "membership",
        },
        error: null,
      };
    },
  });

  assertEquals(completed, true);
  assertEquals(attempts, 2);
});

Deno.test("cleanup claims preserve provisioning state and nullable identities", () => {
  assertEquals(
    parseClaimedCreatedIdentityCleanups([
      { cleanup_job_id: "job-a", status: "provisioning", user_id: null },
      {
        cleanup_job_id: "job-b",
        status: "pending_auth",
        user_id: "user-b",
      },
    ]),
    [
      { cleanupJobId: "job-a", status: "provisioning", userId: null },
      { cleanupJobId: "job-b", status: "pending_auth", userId: "user-b" },
    ],
  );
  assertEquals(
    parseClaimedCreatedIdentityCleanups([
      { cleanup_job_id: "job", status: "provisioned", user_id: "user" },
    ]),
    null,
  );
  assertEquals(
    parseClaimedCreatedIdentityCleanups([
      { cleanup_job_id: "job", status: "pending_auth", user_id: null },
    ]),
    null,
  );
  assertEquals(
    parseClaimedCreatedIdentityCleanups([
      {
        cleanup_job_id: "job",
        status: "pending_auth",
        user_id: "user",
        email: "forbidden",
      },
    ]),
    null,
  );
});

Deno.test("registered identity compensation is database-first and verified", async () => {
  const calls: string[] = [];
  let lookups = 0;
  const result = await cleanupRegisteredCreatedIdentity({
    cleanupJobId: "cleanup-job",
    expectedUserId: "created-user",
    prepareDatabaseCleanup: async () => {
      calls.push("prepare");
      return {
        ok: true,
        prepared: { cleanupJobId: "cleanup-job", userId: "created-user" },
      };
    },
    getAuthUser: async (userId) => {
      calls.push(`lookup:${userId}`);
      lookups += 1;
      return lookups === 1 ? present(userId) : missing();
    },
    deleteAuthUser: async (userId) => {
      calls.push(`auth:${userId}`);
      return present(userId);
    },
    completeDatabaseCleanup: async (cleanupJobId, userId) => {
      calls.push(`complete:${cleanupJobId}:${userId}`);
      return true;
    },
  });

  assertEquals(result, { ok: true, cleanupJobId: "cleanup-job" });
  assertEquals(calls, [
    "prepare",
    "lookup:created-user",
    "auth:created-user",
    "lookup:created-user",
    "complete:cleanup-job:created-user",
  ]);
});

Deno.test("an invisible Auth identity leaves its pre-registered saga retryable", async () => {
  let authCalls = 0;
  let completionCalls = 0;
  const result = await cleanupRegisteredCreatedIdentity({
    cleanupJobId: "cleanup-job",
    expectedUserId: null,
    prepareDatabaseCleanup: async () => ({
      ok: false,
      reason: "identity_not_visible",
    }),
    getAuthUser: async () => {
      authCalls += 1;
      return missing();
    },
    deleteAuthUser: async () => {
      authCalls += 1;
      return missing();
    },
    completeDatabaseCleanup: async () => {
      completionCalls += 1;
      return true;
    },
  });

  assertEquals(result, {
    ok: false,
    cleanupJobId: "cleanup-job",
    reason: "identity_not_visible",
  });
  assertEquals(authCalls, 0);
  assertEquals(completionCalls, 0);
});

Deno.test("a known Auth identity mismatch never deletes an unproven user", async () => {
  let authCalls = 0;
  const result = await cleanupRegisteredCreatedIdentity({
    cleanupJobId: "cleanup-job",
    expectedUserId: "expected-user",
    prepareDatabaseCleanup: async () => ({
      ok: true,
      prepared: { cleanupJobId: "cleanup-job", userId: "other-user" },
    }),
    getAuthUser: async () => {
      authCalls += 1;
      return present("expected-user");
    },
    deleteAuthUser: async () => {
      authCalls += 1;
      return present("expected-user");
    },
    completeDatabaseCleanup: async () => true,
  });

  assertEquals(result, {
    ok: false,
    cleanupJobId: "cleanup-job",
    reason: "identity_not_visible",
  });
  assertEquals(authCalls, 0);
});

Deno.test("delete timeout followed by authoritative absence is success", async () => {
  let lookups = 0;
  const result = await deleteCreatedAuthIdentityVerified({
    expectedUserId: "created-user",
    getAuthUser: async () => {
      lookups += 1;
      return lookups === 1 ? present("created-user") : missing();
    },
    deleteAuthUser: async () => {
      throw new Error("timeout");
    },
  });

  assertEquals(result, { ok: true });
  assertEquals(lookups, 2);
});

Deno.test("provisioning reconciliation prepares before touching Auth", async () => {
  const calls: string[] = [];
  let lookups = 0;
  const summary = await reconcileCreatedIdentityCleanupJobs({
    jobs: [
      {
        cleanupJobId: "job",
        status: "provisioning",
        userId: "created-user",
      },
    ],
    prepareDatabaseCleanup: async (job) => {
      calls.push(`prepare:${job.status}`);
      return {
        ok: true,
        prepared: { cleanupJobId: job.cleanupJobId, userId: job.userId! },
      };
    },
    getAuthUser: async (userId) => {
      calls.push(`lookup:${userId}`);
      lookups += 1;
      return lookups === 1 ? present(userId) : missing();
    },
    deleteAuthUser: async (userId) => {
      calls.push(`delete:${userId}`);
      return present(userId);
    },
    completeDatabaseCleanup: async (job) => {
      calls.push(`complete:${job.status}`);
      return true;
    },
    failDatabaseCleanup: async () => true,
  });

  assertEquals(summary, {
    claimed: 1,
    completed: 1,
    pending: 0,
    receiptFailures: 0,
  });
  assertEquals(calls, [
    "prepare:provisioning",
    "lookup:created-user",
    "delete:created-user",
    "lookup:created-user",
    "complete:pending_auth",
  ]);
});

Deno.test("pending Auth retry re-prepares before verified deletion and completion", async () => {
  const calls: string[] = [];
  let lookups = 0;
  const summary = await reconcileCreatedIdentityCleanupJobs({
    jobs: [{
      cleanupJobId: "job",
      status: "pending_auth",
      userId: "created-user",
    }],
    prepareDatabaseCleanup: async (job) => {
      calls.push(`prepare:${job.status}:${job.userId}`);
      return {
        ok: true,
        prepared: { cleanupJobId: job.cleanupJobId, userId: "created-user" },
      };
    },
    getAuthUser: async (userId) => {
      calls.push(`lookup:${userId}`);
      lookups += 1;
      return lookups === 1 ? present(userId) : missing();
    },
    deleteAuthUser: async (userId) => {
      calls.push(`delete:${userId}`);
      return present(userId);
    },
    completeDatabaseCleanup: async (job) => {
      calls.push(`complete:${job.status}:${job.userId}`);
      return true;
    },
    failDatabaseCleanup: async () => true,
  });

  assertEquals(summary, {
    claimed: 1,
    completed: 1,
    pending: 0,
    receiptFailures: 0,
  });
  assertEquals(calls, [
    "prepare:pending_auth:created-user",
    "lookup:created-user",
    "delete:created-user",
    "lookup:created-user",
    "complete:pending_auth:created-user",
  ]);
});

Deno.test("pending Auth prepare mismatch fails closed with a SQL-accepted reason", async () => {
  let authCalls = 0;
  const failures: string[] = [];
  const summary = await reconcileCreatedIdentityCleanupJobs({
    jobs: [{
      cleanupJobId: "job",
      status: "pending_auth",
      userId: "created-user",
    }],
    prepareDatabaseCleanup: async () => ({
      ok: true,
      prepared: { cleanupJobId: "job", userId: "different-user" },
    }),
    getAuthUser: async () => {
      authCalls += 1;
      return present("created-user");
    },
    deleteAuthUser: async () => {
      authCalls += 1;
      return present("created-user");
    },
    completeDatabaseCleanup: async () => true,
    failDatabaseCleanup: async (job, reason) => {
      failures.push(`${job.status}:${reason}`);
      return true;
    },
  });

  assertEquals(summary, {
    claimed: 1,
    completed: 0,
    pending: 1,
    receiptFailures: 0,
  });
  assertEquals(authCalls, 0);
  assertEquals(failures, ["pending_auth:database_cleanup_failed"]);
});

Deno.test("pending Auth prepare errors remain retryable as database cleanup failures", async () => {
  const failures: string[] = [];
  const summary = await reconcileCreatedIdentityCleanupJobs({
    jobs: [{
      cleanupJobId: "job",
      status: "pending_auth",
      userId: "created-user",
    }],
    prepareDatabaseCleanup: async () => ({
      ok: false,
      reason: "database_cleanup_failed",
    }),
    getAuthUser: async () => present("created-user"),
    deleteAuthUser: async () => present("created-user"),
    completeDatabaseCleanup: async () => true,
    failDatabaseCleanup: async (job, reason) => {
      failures.push(`${job.status}:${reason}`);
      return true;
    },
  });

  assertEquals(summary.pending, 1);
  assertEquals(failures, ["pending_auth:database_cleanup_failed"]);
});

Deno.test("provisioning preparation failure is durably rescheduled", async () => {
  const failures: string[] = [];
  const summary = await reconcileCreatedIdentityCleanupJobs({
    jobs: [{ cleanupJobId: "job", status: "provisioning", userId: null }],
    prepareDatabaseCleanup: async () => ({
      ok: false,
      reason: "database_cleanup_failed",
    }),
    getAuthUser: async () => missing(),
    deleteAuthUser: async () => missing(),
    completeDatabaseCleanup: async () => true,
    failDatabaseCleanup: async (job, reason) => {
      failures.push(`${job.cleanupJobId}:${reason}`);
      return true;
    },
  });

  assertEquals(summary, {
    claimed: 1,
    completed: 0,
    pending: 1,
    receiptFailures: 0,
  });
  assertEquals(failures, ["job:database_cleanup_failed"]);
});

Deno.test("failure receipts reject missing or additional audit data", () => {
  const receipt = {
    ok: true,
    cleanup_job_id: "job",
    status: "provisioning",
    attempt_count: 1,
    error_code: "database_cleanup_failed",
  };
  const expected = {
    cleanupJobId: "job",
    status: "provisioning" as const,
    reason: "database_cleanup_failed" as const,
  };

  assertEquals(isFailedCreatedIdentityCleanupReceipt(receipt, expected), true);
  assertEquals(
    isFailedCreatedIdentityCleanupReceipt(
      { ...receipt, email: "forbidden" },
      expected,
    ),
    false,
  );
});
