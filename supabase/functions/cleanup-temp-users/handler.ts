import { corsHeaders } from "../_shared/cors.ts";
import { hasServiceRoleCredential } from "../_shared/request-security.ts";
import {
  type AuthAdminUserResult,
  cleanupTemporaryUserAuthFirst,
} from "../_shared/temporary-user-cleanup.ts";

export const TEMPORARY_USER_CLEANUP_SCHEMA_VERSION = 2;
export const DEFAULT_TEMPORARY_USER_CLEANUP_BATCH_SIZE = 10;
export const MAX_TEMPORARY_USER_CLEANUP_BATCH_SIZE = 100;
export const MAX_TEMPORARY_USER_CLEANUP_REQUEST_MS = 10_000;
export const MAX_TEMPORARY_USER_CLEANUP_RUNTIME_MS = 90_000;

export type CleanupTempUsersConfig = {
  supabaseUrl: string | undefined;
  serviceRoleKey: string | undefined;
};

export type ResolvedCleanupTempUsersConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
};

type QueryResult = {
  data: unknown;
  error: unknown;
};

export type CleanupTempUsersDependencies = {
  claimEligibleProfiles: (limit: number) => Promise<QueryResult>;
  prepareProfileCleanup: (
    userId: string,
    leaseToken: string,
  ) => Promise<QueryResult>;
  completeProfileCleanup: (
    userId: string,
    leaseToken: string,
  ) => Promise<QueryResult>;
  getAuthUser: (userId: string) => Promise<AuthAdminUserResult>;
  deleteAuthUser: (userId: string) => Promise<AuthAdminUserResult>;
};

type SafeLogContext = {
  code: string;
  scanned?: number;
  eligible?: number;
  retained?: number;
  deleted?: number;
  failed?: number;
};

type SafeLogger = {
  info: (event: string, context: SafeLogContext) => void;
  error: (event: string, context: SafeLogContext) => void;
};

type HandlerOptions = {
  loadConfig: () => CleanupTempUsersConfig;
  createDependencies: (input: {
    config: ResolvedCleanupTempUsersConfig;
    deadlineAt: number;
    operationTimeoutMs: number;
  }) => CleanupTempUsersDependencies;
  now?: () => number;
  batchSize?: number;
  operationTimeoutMs?: number;
  totalRuntimeMs?: number;
  logger?: SafeLogger;
};

type ClaimedTemporaryProfile = {
  userId: string;
  leaseToken: string;
};

type FailureCode =
  | "candidate_query_failed"
  | "candidate_result_invalid"
  | "eligibility_recheck_failed"
  | "eligibility_result_invalid"
  | "deadline_exceeded"
  | "auth_lookup_failed"
  | "auth_delete_failed"
  | "database_cleanup_failed";

type FailureCounts = Record<FailureCode, number>;

const jsonHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

const defaultLogger: SafeLogger = {
  info: (event, context) => console.info(event, context),
  error: (event, context) => console.error(event, context),
};

class CleanupDeadlineError extends Error {
  constructor() {
    super("cleanup_deadline_exceeded");
    this.name = "CleanupDeadlineError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      value,
    );
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function validConfig(
  config: CleanupTempUsersConfig,
): config is ResolvedCleanupTempUsersConfig {
  return typeof config.supabaseUrl === "string" &&
    /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.supabaseUrl) &&
    isNonEmptyString(config.serviceRoleKey);
}

function emptyFailureCounts(): FailureCounts {
  return {
    candidate_query_failed: 0,
    candidate_result_invalid: 0,
    eligibility_recheck_failed: 0,
    eligibility_result_invalid: 0,
    deadline_exceeded: 0,
    auth_lookup_failed: 0,
    auth_delete_failed: 0,
    database_cleanup_failed: 0,
  };
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function cleanupContract(input: {
  batchSize: number;
  operationTimeoutMs: number;
  totalRuntimeMs: number;
}): Record<string, unknown> {
  return {
    schema_version: TEMPORARY_USER_CLEANUP_SCHEMA_VERSION,
    worker: "legacy_temporary_profiles",
    created_identity_cleanup: "delegated_to_cleanup-created-identities",
    candidate_source: "claim_eligible_temporary_profiles_v1",
    batch_size_limit: input.batchSize,
    operation_timeout_ms: input.operationTimeoutMs,
    total_runtime_ms: input.totalRuntimeMs,
  };
}

function parseClaimedProfiles(
  value: unknown,
  limit: number,
): ClaimedTemporaryProfile[] | null {
  if (!Array.isArray(value) || value.length > limit) return null;

  const parsed: ClaimedTemporaryProfile[] = [];
  const seenUserIds = new Set<string>();
  const seenLeaseTokens = new Set<string>();
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ["lease_token", "user_id"]) ||
      !isCanonicalUuid(candidate.user_id) ||
      !isCanonicalUuid(candidate.lease_token) ||
      seenUserIds.has(candidate.user_id) ||
      seenLeaseTokens.has(candidate.lease_token)
    ) return null;

    seenUserIds.add(candidate.user_id);
    seenLeaseTokens.add(candidate.lease_token);
    parsed.push({
      userId: candidate.user_id,
      leaseToken: candidate.lease_token,
    });
  }
  return parsed;
}

function validPrepareReceipt(
  value: unknown,
  profile: ClaimedTemporaryProfile,
): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["lease_token", "mode", "ok", "user_id"]) &&
    value.ok === true &&
    value.user_id === profile.userId &&
    value.lease_token === profile.leaseToken &&
    (value.mode === "eligible_profile" || value.mode === "orphan_recovery");
}

function validCompleteReceipt(
  value: unknown,
  profile: ClaimedTemporaryProfile,
): boolean {
  return isRecord(value) &&
    hasExactKeys(value, ["lease_token", "ok", "status", "user_id"]) &&
    value.ok === true &&
    value.user_id === profile.userId &&
    value.lease_token === profile.leaseToken &&
    value.status === "completed";
}

async function runBounded<T>(input: {
  operation: () => Promise<T>;
  deadlineAt: number;
  operationTimeoutMs: number;
  now: () => number;
}): Promise<T> {
  const remaining = input.deadlineAt - input.now();
  if (remaining <= 0) throw new CleanupDeadlineError();

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      input.operation(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new CleanupDeadlineError()),
          Math.min(remaining, input.operationTimeoutMs),
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function publicSummary(input: {
  scanned: number;
  eligible: number;
  retained: number;
  deleted: number;
  failed: number;
  batchLimitReached: boolean;
  failures: FailureCounts;
}): Record<string, unknown> {
  return {
    scanned: input.scanned,
    eligible: input.eligible,
    retained: input.retained,
    deleted: input.deleted,
    failed: input.failed,
    batch_limit_reached: input.batchLimitReached,
    failure_counts: input.failures,
  };
}

export function createCleanupTempUsersHandler(options: HandlerOptions) {
  const now = options.now ?? Date.now;
  const batchSize = options.batchSize ??
    DEFAULT_TEMPORARY_USER_CLEANUP_BATCH_SIZE;
  const operationTimeoutMs = options.operationTimeoutMs ??
    MAX_TEMPORARY_USER_CLEANUP_REQUEST_MS;
  const totalRuntimeMs = options.totalRuntimeMs ??
    MAX_TEMPORARY_USER_CLEANUP_RUNTIME_MS;
  const logger = options.logger ?? defaultLogger;

  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > MAX_TEMPORARY_USER_CLEANUP_BATCH_SIZE ||
    !Number.isInteger(operationTimeoutMs) ||
    operationTimeoutMs < 1 ||
    operationTimeoutMs > MAX_TEMPORARY_USER_CLEANUP_REQUEST_MS ||
    !Number.isInteger(totalRuntimeMs) ||
    totalRuntimeMs <= operationTimeoutMs ||
    totalRuntimeMs > MAX_TEMPORARY_USER_CLEANUP_RUNTIME_MS
  ) {
    throw new Error("Invalid temporary-user cleanup execution limits");
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed" });
    }

    let config: CleanupTempUsersConfig;
    try {
      config = options.loadConfig();
    } catch {
      config = { supabaseUrl: undefined, serviceRoleKey: undefined };
    }
    if (!validConfig(config)) {
      logger.error("cleanup-temp-users.configuration-failed", {
        code: "server_configuration_error",
      });
      return jsonResponse(500, { error: "Server configuration error" });
    }
    if (!hasServiceRoleCredential(req, config.serviceRoleKey)) {
      return jsonResponse(403, { error: "Forbidden" });
    }

    const startedAt = now();
    const deadlineAt = startedAt + totalRuntimeMs;
    let dependencies: CleanupTempUsersDependencies;
    try {
      dependencies = options.createDependencies({
        config,
        deadlineAt,
        operationTimeoutMs,
      });
    } catch {
      logger.error("cleanup-temp-users.client-failed", {
        code: "dependency_initialization_failed",
      });
      return jsonResponse(500, { error: "Server configuration error" });
    }

    const contract = cleanupContract({
      batchSize,
      operationTimeoutMs,
      totalRuntimeMs,
    });
    const failures = emptyFailureCounts();
    let candidateResult: QueryResult;
    try {
      candidateResult = await runBounded({
        operation: () => dependencies.claimEligibleProfiles(batchSize),
        deadlineAt,
        operationTimeoutMs,
        now,
      });
    } catch (error) {
      const deadlineFailure = error instanceof CleanupDeadlineError;
      failures[
        deadlineFailure ? "deadline_exceeded" : "candidate_query_failed"
      ] = 1;
      const summary = publicSummary({
        scanned: 0,
        eligible: 0,
        retained: 0,
        deleted: 0,
        failed: 1,
        batchLimitReached: false,
        failures,
      });
      logger.error("cleanup-temp-users.run-incomplete", {
        code: deadlineFailure ? "deadline_exceeded" : "candidate_query_failed",
        failed: 1,
      });
      return jsonResponse(503, {
        ok: false,
        error: "cleanup_incomplete",
        message: "Temporary user cleanup could not claim its bounded batch.",
        deleted: 0,
        cleanup_contract: contract,
        summary,
      });
    }
    if (candidateResult.error) {
      failures.candidate_query_failed = 1;
      const summary = publicSummary({
        scanned: 0,
        eligible: 0,
        retained: 0,
        deleted: 0,
        failed: 1,
        batchLimitReached: false,
        failures,
      });
      logger.error("cleanup-temp-users.run-incomplete", {
        code: "candidate_query_failed",
        failed: 1,
      });
      return jsonResponse(503, {
        ok: false,
        error: "cleanup_incomplete",
        message: "Temporary user cleanup could not claim its bounded batch.",
        deleted: 0,
        cleanup_contract: contract,
        summary,
      });
    }

    const profiles = parseClaimedProfiles(candidateResult.data, batchSize);
    if (!profiles) {
      failures.candidate_result_invalid = 1;
      const summary = publicSummary({
        scanned: 0,
        eligible: 0,
        retained: 0,
        deleted: 0,
        failed: 1,
        batchLimitReached: false,
        failures,
      });
      logger.error("cleanup-temp-users.run-incomplete", {
        code: "candidate_result_invalid",
        failed: 1,
      });
      return jsonResponse(503, {
        ok: false,
        error: "cleanup_incomplete",
        message: "Temporary user cleanup received an invalid fenced batch.",
        deleted: 0,
        cleanup_contract: contract,
        summary,
      });
    }

    let eligible = 0;
    let deleted = 0;
    let failed = 0;

    for (let index = 0; index < profiles.length; index += 1) {
      const profile = profiles[index];
      if (now() >= deadlineAt) {
        const unprocessed = profiles.length - index;
        failures.deadline_exceeded += unprocessed;
        failed += unprocessed;
        break;
      }

      let prepareResult: QueryResult;
      try {
        prepareResult = await runBounded({
          operation: () =>
            dependencies.prepareProfileCleanup(
              profile.userId,
              profile.leaseToken,
            ),
          deadlineAt,
          operationTimeoutMs,
          now,
        });
      } catch (error) {
        failures[
          error instanceof CleanupDeadlineError
            ? "deadline_exceeded"
            : "eligibility_recheck_failed"
        ] += 1;
        failed += 1;
        continue;
      }
      if (prepareResult.error) {
        failures.eligibility_recheck_failed += 1;
        failed += 1;
        continue;
      }
      if (!validPrepareReceipt(prepareResult.data, profile)) {
        failures.eligibility_result_invalid += 1;
        failed += 1;
        continue;
      }
      eligible += 1;

      let deadlineFailure = false;
      const bounded = async <T>(operation: () => Promise<T>): Promise<T> => {
        try {
          return await runBounded({
            operation,
            deadlineAt,
            operationTimeoutMs,
            now,
          });
        } catch (error) {
          if (error instanceof CleanupDeadlineError) deadlineFailure = true;
          throw error;
        }
      };

      let immediatePrepareFailure = false;
      const cleanup = await cleanupTemporaryUserAuthFirst({
        expectedUserId: profile.userId,
        getAuthUser: () =>
          bounded(() => dependencies.getAuthUser(profile.userId)),
        deleteAuthUser: async () => {
          let immediatePrepare: QueryResult;
          try {
            immediatePrepare = await bounded(() =>
              dependencies.prepareProfileCleanup(
                profile.userId,
                profile.leaseToken,
              )
            );
          } catch (error) {
            immediatePrepareFailure = true;
            throw error;
          }
          if (
            immediatePrepare.error ||
            !validPrepareReceipt(immediatePrepare.data, profile)
          ) {
            immediatePrepareFailure = true;
            throw new Error("Temporary profile cleanup fence was not renewed");
          }
          return await bounded(() =>
            dependencies.deleteAuthUser(profile.userId)
          );
        },
        deleteDatabaseRows: [
          async () => {
            const completion = await bounded(() =>
              dependencies.completeProfileCleanup(
                profile.userId,
                profile.leaseToken,
              )
            );
            return !completion.error &&
              validCompleteReceipt(completion.data, profile);
          },
        ],
      });
      if (!cleanup.ok) {
        failures[
          deadlineFailure
            ? "deadline_exceeded"
            : immediatePrepareFailure
            ? "eligibility_recheck_failed"
            : cleanup.reason
        ] += 1;
        failed += 1;
        continue;
      }
      deleted += 1;
    }

    const summary = publicSummary({
      scanned: profiles.length,
      eligible,
      retained: 0,
      deleted,
      failed,
      batchLimitReached: profiles.length === batchSize,
      failures,
    });
    if (failed > 0) {
      logger.error("cleanup-temp-users.run-incomplete", {
        code: "cleanup_incomplete",
        scanned: profiles.length,
        eligible,
        retained: 0,
        deleted,
        failed,
      });
      return jsonResponse(503, {
        ok: false,
        error: "cleanup_incomplete",
        message: `Cleaned up ${deleted} temp users; ${failed} require retry.`,
        deleted,
        cleanup_contract: contract,
        summary,
      });
    }

    logger.info("cleanup-temp-users.run-completed", {
      code: "completed",
      scanned: profiles.length,
      eligible,
      retained: 0,
      deleted,
      failed,
    });
    return jsonResponse(200, {
      ok: true,
      message: deleted === 0
        ? "No eligible temp users to clean up."
        : `Cleaned up ${deleted} temp users.`,
      deleted,
      cleanup_contract: contract,
      summary,
    });
  };
}
