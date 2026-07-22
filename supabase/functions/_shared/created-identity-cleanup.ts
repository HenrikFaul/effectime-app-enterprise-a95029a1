export type AuthAdminUserResult = {
  data: {
    user: {
      id: string;
    } | null;
  } | null;
  error: unknown;
};

export type RegisteredCreatedIdentityProvisioning = {
  cleanupJobId: string;
};

export type PreparedCreatedIdentityCleanup = {
  cleanupJobId: string;
  userId: string;
};

export type CreatedIdentityCleanupPreparationResult =
  | { ok: true; prepared: PreparedCreatedIdentityCleanup }
  | {
    ok: false;
    reason: "identity_not_visible" | "database_cleanup_failed";
  };

export type CreatedIdentityCleanupFailureReason =
  | "identity_not_visible"
  | "database_cleanup_failed"
  | "auth_lookup_failed"
  | "auth_delete_failed";

export type CreatedIdentityCleanupResult =
  | { ok: true; cleanupJobId: string }
  | {
    ok: false;
    cleanupJobId: string;
    reason: CreatedIdentityCleanupFailureReason | "cleanup_receipt_failed";
  };

export type AuthIdentityCleanupResult =
  | { ok: true }
  | { ok: false; reason: "auth_lookup_failed" | "auth_delete_failed" };

export type ClaimedCreatedIdentityCleanup =
  | {
    cleanupJobId: string;
    status: "provisioning";
    userId: string | null;
  }
  | {
    cleanupJobId: string;
    status: "pending_auth";
    userId: string;
  };

export type CreatedIdentityReconciliationSummary = {
  claimed: number;
  completed: number;
  pending: number;
  receiptFailures: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableNonEmptyString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

export function classifyCreatedIdentityPreparationError(
  error: unknown,
): "identity_not_visible" | "database_cleanup_failed" {
  return isRecord(error) && error.code === "P0002"
    ? "identity_not_visible"
    : "database_cleanup_failed";
}

export function parseRegisteredCreatedIdentityProvisioningReceipt(
  value: unknown,
  expected: { workspaceId: string; cleanupIntentId: string },
): RegisteredCreatedIdentityProvisioning | null {
  if (
    !isRecord(value) || !hasExactKeys(value, [
      "ok",
      "cleanup_job_id",
      "cleanup_intent_id",
      "workspace_id",
      "status",
    ]) ||
    value.ok !== true ||
    !isNonEmptyString(value.cleanup_job_id) ||
    value.cleanup_intent_id !== expected.cleanupIntentId ||
    value.workspace_id !== expected.workspaceId ||
    value.status !== "provisioning"
  ) return null;

  return { cleanupJobId: value.cleanup_job_id };
}

export function parsePreparedCreatedIdentityCleanupReceipt(
  value: unknown,
  expectedCleanupJobId: string,
): PreparedCreatedIdentityCleanup | null {
  if (
    !isRecord(value) || !hasExactKeys(value, [
      "ok",
      "cleanup_job_id",
      "status",
      "user_id",
      "deleted_membership_count",
      "deleted_profile_count",
      "remaining_membership_count",
    ]) ||
    value.ok !== true ||
    value.cleanup_job_id !== expectedCleanupJobId ||
    value.status !== "pending_auth" ||
    !isNonEmptyString(value.user_id) ||
    !Number.isInteger(value.deleted_membership_count) ||
    (value.deleted_membership_count as number) < 0 ||
    (value.deleted_membership_count as number) > 1 ||
    !Number.isInteger(value.deleted_profile_count) ||
    (value.deleted_profile_count as number) < 0 ||
    (value.deleted_profile_count as number) > 1 ||
    value.remaining_membership_count !== 0
  ) return null;

  return {
    cleanupJobId: expectedCleanupJobId,
    userId: value.user_id,
  };
}

export function parseCreatedIdentityCleanupPreparationResult(
  value: unknown,
  expectedCleanupJobId: string,
): CreatedIdentityCleanupPreparationResult {
  if (value === null || value === undefined) {
    return { ok: false, reason: "identity_not_visible" };
  }
  const prepared = parsePreparedCreatedIdentityCleanupReceipt(
    value,
    expectedCleanupJobId,
  );
  return prepared
    ? { ok: true, prepared }
    : { ok: false, reason: "database_cleanup_failed" };
}

export function isCompletedCreatedIdentityProvisioningReceipt(
  value: unknown,
  expected: { cleanupJobId: string; userId: string; membershipId: string },
): boolean {
  return isRecord(value) &&
    hasExactKeys(value, [
      "ok",
      "cleanup_job_id",
      "status",
      "user_id",
      "membership_id",
    ]) &&
    value.ok === true &&
    value.cleanup_job_id === expected.cleanupJobId &&
    value.status === "provisioned" &&
    value.user_id === expected.userId &&
    value.membership_id === expected.membershipId;
}

/** Retries one idempotent completion call, accepting only its exact receipt. */
export async function completeCreatedIdentityProvisioningVerified(options: {
  expected: { cleanupJobId: string; userId: string; membershipId: string };
  completeProvisioning: () => PromiseLike<{ data: unknown; error: unknown }>;
  maxAttempts?: number;
}): Promise<boolean> {
  const maxAttempts = options.maxAttempts ?? 2;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 2) {
    return false;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await options.completeProvisioning();
      if (
        !result.error &&
        isCompletedCreatedIdentityProvisioningReceipt(
          result.data,
          options.expected,
        )
      ) return true;
    } catch {
      // A lost response may still have committed; the RPC is idempotent.
    }
  }
  return false;
}

export function isCompletedCreatedIdentityCleanupReceipt(
  value: unknown,
  cleanupJobId: string,
): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["ok", "cleanup_job_id", "status"]) &&
    value.ok === true &&
    value.cleanup_job_id === cleanupJobId &&
    value.status === "completed";
}

export function isFailedCreatedIdentityCleanupReceipt(
  value: unknown,
  expected: {
    cleanupJobId: string;
    status: "provisioning" | "pending_auth";
    reason: CreatedIdentityCleanupFailureReason;
  },
): boolean {
  return isRecord(value) &&
    hasExactKeys(value, [
      "ok",
      "cleanup_job_id",
      "status",
      "attempt_count",
      "error_code",
    ]) &&
    value.ok === true &&
    value.cleanup_job_id === expected.cleanupJobId &&
    value.status === expected.status &&
    Number.isInteger(value.attempt_count) &&
    (value.attempt_count as number) >= 0 &&
    value.error_code === expected.reason;
}

export function parseClaimedCreatedIdentityCleanups(
  value: unknown,
): ClaimedCreatedIdentityCleanup[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const jobs: ClaimedCreatedIdentityCleanup[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ["cleanup_job_id", "status", "user_id"]) ||
      !isNonEmptyString(candidate.cleanup_job_id) ||
      (candidate.status !== "provisioning" &&
        candidate.status !== "pending_auth") ||
      !isNullableNonEmptyString(candidate.user_id) ||
      (candidate.status === "pending_auth" && candidate.user_id === null) ||
      seen.has(candidate.cleanup_job_id)
    ) return null;
    seen.add(candidate.cleanup_job_id);
    jobs.push(
      candidate.status === "provisioning"
        ? {
          cleanupJobId: candidate.cleanup_job_id,
          status: "provisioning",
          userId: candidate.user_id,
        }
        : {
          cleanupJobId: candidate.cleanup_job_id,
          status: "pending_auth",
          userId: candidate.user_id as string,
        },
    );
  }
  return jobs;
}

function isAuthoritativeMissingUser(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; status?: unknown };
  return candidate.code === "user_not_found" && candidate.status === 404;
}

function authUserState(
  result: AuthAdminUserResult,
  expectedUserId: string,
): "present" | "missing" | "unknown" {
  if (!result.error && result.data?.user?.id === expectedUserId) {
    return "present";
  }
  if (!result.data?.user && isAuthoritativeMissingUser(result.error)) {
    return "missing";
  }
  return "unknown";
}

async function readAuthUserState(
  expectedUserId: string,
  getAuthUser: () => Promise<AuthAdminUserResult>,
): Promise<"present" | "missing" | "unknown"> {
  try {
    return authUserState(await getAuthUser(), expectedUserId);
  } catch {
    return "unknown";
  }
}

/**
 * Deletes one exact Auth identity and proves the postcondition with an
 * authoritative lookup. A successful delete response is never accepted as
 * proof on its own. Repeating deleteUser is safe because absence is success.
 */
export async function deleteCreatedAuthIdentityVerified(options: {
  expectedUserId: string;
  getAuthUser: () => Promise<AuthAdminUserResult>;
  deleteAuthUser: () => Promise<AuthAdminUserResult>;
  maxAttempts?: number;
}): Promise<AuthIdentityCleanupResult> {
  const maxAttempts = options.maxAttempts ?? 2;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    return { ok: false, reason: "auth_delete_failed" };
  }

  let sawUnknownLookup = false;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const beforeState = await readAuthUserState(
      options.expectedUserId,
      options.getAuthUser,
    );
    if (beforeState === "missing") return { ok: true };
    if (beforeState === "unknown") sawUnknownLookup = true;

    try {
      await options.deleteAuthUser();
    } catch {
      // An interrupted request may still have committed remotely.
    }

    const afterState = await readAuthUserState(
      options.expectedUserId,
      options.getAuthUser,
    );
    if (afterState === "missing") return { ok: true };
    if (afterState === "unknown") sawUnknownLookup = true;
  }

  return {
    ok: false,
    reason: sawUnknownLookup ? "auth_lookup_failed" : "auth_delete_failed",
  };
}

/**
 * Compensates an identity through its already-durable provisioning job.
 * Database preparation must bind the registered intent to an exact Auth user
 * before deletion. A null expected ID is safe for an ambiguous create response;
 * it never authorizes deletion until the database returns the bound user ID.
 */
export async function cleanupRegisteredCreatedIdentity(options: {
  cleanupJobId: string;
  expectedUserId: string | null;
  prepareDatabaseCleanup: () => Promise<
    CreatedIdentityCleanupPreparationResult
  >;
  getAuthUser: (userId: string) => Promise<AuthAdminUserResult>;
  deleteAuthUser: (userId: string) => Promise<AuthAdminUserResult>;
  completeDatabaseCleanup: (
    cleanupJobId: string,
    userId: string,
  ) => Promise<boolean>;
}): Promise<CreatedIdentityCleanupResult> {
  let preparation: CreatedIdentityCleanupPreparationResult;
  try {
    preparation = await options.prepareDatabaseCleanup();
  } catch {
    preparation = { ok: false, reason: "database_cleanup_failed" };
  }

  if (!preparation.ok) {
    return {
      ok: false,
      cleanupJobId: options.cleanupJobId,
      reason: preparation.reason,
    };
  }
  const prepared = preparation.prepared;
  if (prepared.cleanupJobId !== options.cleanupJobId) {
    return {
      ok: false,
      cleanupJobId: options.cleanupJobId,
      reason: "database_cleanup_failed",
    };
  }
  if (
    options.expectedUserId !== null &&
    prepared.userId !== options.expectedUserId
  ) {
    return {
      ok: false,
      cleanupJobId: options.cleanupJobId,
      reason: "identity_not_visible",
    };
  }

  const preparedUserId = prepared.userId;
  const authCleanup = await deleteCreatedAuthIdentityVerified({
    expectedUserId: preparedUserId,
    getAuthUser: () => options.getAuthUser(preparedUserId),
    deleteAuthUser: () => options.deleteAuthUser(preparedUserId),
  });
  if (!authCleanup.ok) {
    return {
      ok: false,
      cleanupJobId: options.cleanupJobId,
      reason: authCleanup.reason,
    };
  }

  try {
    if (
      await options.completeDatabaseCleanup(
        options.cleanupJobId,
        preparedUserId,
      )
    ) {
      return { ok: true, cleanupJobId: options.cleanupJobId };
    }
  } catch {
    // The durable pending job is intentionally retained for reconciliation.
  }

  return {
    ok: false,
    cleanupJobId: options.cleanupJobId,
    reason: "cleanup_receipt_failed",
  };
}

/** Reconciles already-durable provisioning and pending Auth jobs in a batch. */
export async function reconcileCreatedIdentityCleanupJobs(options: {
  jobs: readonly ClaimedCreatedIdentityCleanup[];
  prepareDatabaseCleanup: (
    job: ClaimedCreatedIdentityCleanup,
  ) => Promise<CreatedIdentityCleanupPreparationResult>;
  getAuthUser: (userId: string) => Promise<AuthAdminUserResult>;
  deleteAuthUser: (userId: string) => Promise<AuthAdminUserResult>;
  completeDatabaseCleanup: (
    job: ClaimedCreatedIdentityCleanup,
  ) => Promise<boolean>;
  failDatabaseCleanup: (
    job: ClaimedCreatedIdentityCleanup,
    reason: CreatedIdentityCleanupFailureReason,
  ) => Promise<boolean>;
}): Promise<CreatedIdentityReconciliationSummary> {
  const summary: CreatedIdentityReconciliationSummary = {
    claimed: options.jobs.length,
    completed: 0,
    pending: 0,
    receiptFailures: 0,
  };

  for (const claimedJob of options.jobs) {
    let preparation: CreatedIdentityCleanupPreparationResult;
    try {
      preparation = await options.prepareDatabaseCleanup(claimedJob);
    } catch {
      preparation = { ok: false, reason: "database_cleanup_failed" };
    }

    if (!preparation.ok) {
      await recordCleanupFailure(
        options,
        summary,
        claimedJob,
        boundedPreparationFailureReason(claimedJob, preparation.reason),
      );
      continue;
    }
    const prepared = preparation.prepared;
    if (prepared.cleanupJobId !== claimedJob.cleanupJobId) {
      await recordCleanupFailure(
        options,
        summary,
        claimedJob,
        boundedPreparationFailureReason(
          claimedJob,
          "database_cleanup_failed",
        ),
      );
      continue;
    }
    if (claimedJob.userId !== null && prepared.userId !== claimedJob.userId) {
      await recordCleanupFailure(
        options,
        summary,
        claimedJob,
        boundedPreparationFailureReason(claimedJob, "identity_not_visible"),
      );
      continue;
    }
    const pendingJob: Extract<
      ClaimedCreatedIdentityCleanup,
      { status: "pending_auth" }
    > = {
      cleanupJobId: prepared.cleanupJobId,
      status: "pending_auth",
      userId: prepared.userId,
    };

    const pendingUserId = pendingJob.userId;
    const authCleanup = await deleteCreatedAuthIdentityVerified({
      expectedUserId: pendingUserId,
      getAuthUser: () => options.getAuthUser(pendingUserId),
      deleteAuthUser: () => options.deleteAuthUser(pendingUserId),
    });
    if (!authCleanup.ok) {
      await recordCleanupFailure(
        options,
        summary,
        pendingJob,
        authCleanup.reason,
      );
      continue;
    }

    try {
      if (await options.completeDatabaseCleanup(pendingJob)) {
        summary.completed += 1;
        continue;
      }
    } catch {
      // The lease expires and the pending job becomes claimable again.
    }
    summary.receiptFailures += 1;
    summary.pending += 1;
  }

  return summary;
}

function boundedPreparationFailureReason(
  job: ClaimedCreatedIdentityCleanup,
  reason: "identity_not_visible" | "database_cleanup_failed",
): CreatedIdentityCleanupFailureReason {
  // A bound pending job has already proved its Auth identity. Any idempotent
  // re-prepare failure is therefore database cleanup uncertainty, not an Auth
  // lookup/delete result.
  return job.status === "pending_auth" ? "database_cleanup_failed" : reason;
}

async function recordCleanupFailure(
  options: {
    failDatabaseCleanup: (
      job: ClaimedCreatedIdentityCleanup,
      reason: CreatedIdentityCleanupFailureReason,
    ) => Promise<boolean>;
  },
  summary: CreatedIdentityReconciliationSummary,
  job: ClaimedCreatedIdentityCleanup,
  reason: CreatedIdentityCleanupFailureReason,
): Promise<void> {
  try {
    if (!(await options.failDatabaseCleanup(job, reason))) {
      summary.receiptFailures += 1;
    }
  } catch {
    summary.receiptFailures += 1;
  }
  summary.pending += 1;
}
