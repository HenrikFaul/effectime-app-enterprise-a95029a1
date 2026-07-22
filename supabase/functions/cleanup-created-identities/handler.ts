import {
  type AuthAdminUserResult,
  type CreatedIdentityCleanupFailureReason,
  deleteCreatedAuthIdentityVerified,
} from "../_shared/created-identity-cleanup.ts";
import {
  constantTimeEqual,
  getBearerToken,
} from "../_shared/request-security.ts";

export const SCHEDULER_SECRET_HEADER = "x-effectime-cleanup-secret";
export const MAX_BATCH_SIZE = 10;
export const MAX_AUTH_REQUEST_TIMEOUT_MS = 15_000;
export const MAX_WORKER_RUNTIME_MS = 110_000;
export const WORKER_LEASE_SECONDS = 150;

type WorkerSource = "pg_cron" | "manual";
type CleanupStatus = "provisioning" | "pending_auth";

export type CleanupCreatedIdentitiesConfig = {
  supabaseUrl: string | undefined;
  serviceRoleKey: string | undefined;
  anonKey: string | undefined;
  schedulerSecret: string | undefined;
};

export type ResolvedCleanupCreatedIdentitiesConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  anonKey: string;
  schedulerSecret: string;
};

type ClaimedCleanupJob = {
  cleanupJobId: string;
  status: CleanupStatus;
  userId: string | null;
  leaseToken: string;
};

type PreparedCleanup = {
  cleanupJobId: string;
  userId: string;
  leaseToken: string;
};

type WorkerSummary = {
  claimed: number;
  completed: number;
  pending: number;
  receiptFailures: number;
};

type FinishStatus = "succeeded" | "failed";

export type CleanupCreatedIdentitiesDependencies = {
  acquireWorker: (
    input: { runId: string; leaseSeconds: number },
  ) => Promise<unknown>;
  finishWorker: (input: {
    runId: string;
    status: FinishStatus;
    summary: WorkerSummary;
    errorCode: string | null;
  }) => Promise<unknown>;
  claimJobs: (limit: number) => Promise<unknown>;
  prepareCleanup: (job: ClaimedCleanupJob) => Promise<unknown>;
  completeCleanup: (input: {
    cleanupJobId: string;
    userId: string;
    leaseToken: string;
  }) => Promise<unknown>;
  failCleanup: (input: {
    cleanupJobId: string;
    userId: string | null;
    leaseToken: string;
    reason: CreatedIdentityCleanupFailureReason;
  }) => Promise<unknown>;
  getAuthUser: (userId: string) => Promise<AuthAdminUserResult>;
  deleteAuthUser: (userId: string) => Promise<AuthAdminUserResult>;
};

type SafeLogContext = {
  correlationId: string;
  code?: string;
  claimed?: number;
  completed?: number;
  pending?: number;
  receiptFailures?: number;
};

type SafeLogger = {
  info: (event: string, context: SafeLogContext) => void;
  error: (event: string, context: SafeLogContext) => void;
};

type HandlerOptions = {
  loadConfig: () => CleanupCreatedIdentitiesConfig;
  createDependencies: (input: {
    config: ResolvedCleanupCreatedIdentitiesConfig;
    deadlineAt: number;
  }) => CleanupCreatedIdentitiesDependencies;
  randomRunId?: () => string;
  randomCorrelationId?: () => string;
  now?: () => number;
  batchSize?: number;
  operationTimeoutMs?: number;
  totalRuntimeMs?: number;
  logger?: SafeLogger;
};

type JsonRecord = Record<string, unknown>;

class WorkerError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "WorkerError";
  }
}

const jsonHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

const defaultLogger: SafeLogger = {
  info: (event, context) => console.info(event, context),
  error: (event, context) => console.error(event, context),
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: JsonRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isCanonicalUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
  );
}

function isNullableNonEmptyString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function isLegacyAnonJwt(value: string, expectedProjectRef: string): boolean {
  if (value.length > 4_096) return false;
  const segments = value.split(".");
  if (
    segments.length !== 3 ||
    segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))
  ) {
    return false;
  }
  try {
    const payloadSegment = segments[1];
    if (payloadSegment.length % 4 === 1) return false;
    const padded = payloadSegment
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(
        payloadSegment.length + ((4 - (payloadSegment.length % 4)) % 4),
        "=",
      );
    const payload = JSON.parse(atob(padded));
    return isRecord(payload) && payload.role === "anon" &&
      payload.ref === expectedProjectRef;
  } catch {
    return false;
  }
}

function response(status: number, body: JsonRecord): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function hasValidConfiguration(
  value: CleanupCreatedIdentitiesConfig,
): value is ResolvedCleanupCreatedIdentitiesConfig {
  if (!isNonEmptyString(value.supabaseUrl)) return false;
  const origin = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/.exec(
    value.supabaseUrl,
  );
  return (
    origin !== null &&
    isNonEmptyString(value.serviceRoleKey) &&
    isNonEmptyString(value.anonKey) &&
    isLegacyAnonJwt(value.anonKey, origin[1]) &&
    isNonEmptyString(value.schedulerSecret) &&
    /^[A-Za-z0-9_-]{43,128}$/.test(value.schedulerSecret) &&
    new Set(value.schedulerSecret).size >= 16 &&
    !constantTimeEqual(value.serviceRoleKey, value.anonKey) &&
    !constantTimeEqual(value.schedulerSecret, value.serviceRoleKey) &&
    !constantTimeEqual(value.schedulerSecret, value.anonKey)
  );
}

function authorize(
  req: Request,
  config: ResolvedCleanupCreatedIdentitiesConfig,
): WorkerSource | null {
  const bearer = getBearerToken(req);
  if (bearer && constantTimeEqual(bearer, config.serviceRoleKey)) {
    return "manual";
  }

  const apiKey = req.headers.get("apikey") ?? "";
  const schedulerSecret = req.headers.get(SCHEDULER_SECRET_HEADER) ?? "";
  return bearer &&
      constantTimeEqual(bearer, config.anonKey) &&
      constantTimeEqual(apiKey, config.anonKey) &&
      constantTimeEqual(schedulerSecret, config.schedulerSecret)
    ? "pg_cron"
    : null;
}

async function parseBody(req: Request): Promise<WorkerSource | null> {
  if (
    !(req.headers.get("content-type") ?? "").toLowerCase().startsWith(
      "application/json",
    )
  ) {
    return null;
  }
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 256) return null;

  let text: string;
  try {
    if (!req.body) return null;
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 256) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  if (text.length > 256) return null;

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schema_version", "source"]) ||
    value.schema_version !== 1 ||
    (value.source !== "pg_cron" && value.source !== "manual")
  ) {
    return null;
  }
  return value.source;
}

function parseAcquireReceipt(
  value: unknown,
  expectedRunId: string,
): {
  acquired: boolean;
} | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["ok", "acquired", "run_id", "lease_expires_at"]) ||
    value.ok !== true ||
    typeof value.acquired !== "boolean" ||
    value.run_id !== expectedRunId ||
    (value.acquired
      ? !isNonEmptyString(value.lease_expires_at)
      : value.lease_expires_at !== null)
  ) {
    return null;
  }
  return { acquired: value.acquired };
}

function parseClaimedJobs(
  value: unknown,
  limit: number,
): ClaimedCleanupJob[] | null {
  if (!Array.isArray(value) || value.length > limit) return null;
  const parsed: ClaimedCleanupJob[] = [];
  const cleanupIds = new Set<string>();
  const leaseTokens = new Set<string>();
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, [
        "cleanup_job_id",
        "status",
        "user_id",
        "lease_token",
      ]) ||
      !isCanonicalUuid(candidate.cleanup_job_id) ||
      (candidate.status !== "provisioning" &&
        candidate.status !== "pending_auth") ||
      !isNullableNonEmptyString(candidate.user_id) ||
      (candidate.user_id !== null && !isCanonicalUuid(candidate.user_id)) ||
      (candidate.status === "pending_auth" && candidate.user_id === null) ||
      !isCanonicalUuid(candidate.lease_token) ||
      cleanupIds.has(candidate.cleanup_job_id) ||
      leaseTokens.has(candidate.lease_token)
    ) {
      return null;
    }
    cleanupIds.add(candidate.cleanup_job_id);
    leaseTokens.add(candidate.lease_token);
    parsed.push({
      cleanupJobId: candidate.cleanup_job_id,
      status: candidate.status,
      userId: candidate.user_id,
      leaseToken: candidate.lease_token,
    });
  }
  return parsed;
}

function parsePreparedReceipt(
  value: unknown,
  job: ClaimedCleanupJob,
): PreparedCleanup | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "ok",
      "cleanup_job_id",
      "status",
      "user_id",
      "deleted_membership_count",
      "deleted_profile_count",
      "remaining_membership_count",
      "lease_token",
    ]) ||
    value.ok !== true ||
    value.cleanup_job_id !== job.cleanupJobId ||
    value.status !== "pending_auth" ||
    !isCanonicalUuid(value.user_id) ||
    !Number.isInteger(value.deleted_membership_count) ||
    (value.deleted_membership_count as number) < 0 ||
    (value.deleted_membership_count as number) > 1 ||
    !Number.isInteger(value.deleted_profile_count) ||
    (value.deleted_profile_count as number) < 0 ||
    (value.deleted_profile_count as number) > 1 ||
    value.remaining_membership_count !== 0 ||
    value.lease_token !== job.leaseToken ||
    (job.userId !== null && value.user_id !== job.userId)
  ) {
    return null;
  }
  return {
    cleanupJobId: job.cleanupJobId,
    userId: value.user_id,
    leaseToken: job.leaseToken,
  };
}

function isCompleteReceipt(value: unknown, job: ClaimedCleanupJob): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["ok", "cleanup_job_id", "status", "lease_token"]) &&
    value.ok === true &&
    value.cleanup_job_id === job.cleanupJobId &&
    value.status === "completed" &&
    value.lease_token === job.leaseToken
  );
}

function isFailureReceipt(
  value: unknown,
  expected: {
    job: ClaimedCleanupJob;
    status: CleanupStatus;
    reason: CreatedIdentityCleanupFailureReason;
  },
): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "ok",
      "cleanup_job_id",
      "status",
      "attempt_count",
      "error_code",
      "lease_token",
    ]) &&
    value.ok === true &&
    value.cleanup_job_id === expected.job.cleanupJobId &&
    value.status === expected.status &&
    Number.isInteger(value.attempt_count) &&
    (value.attempt_count as number) >= 0 &&
    value.error_code === expected.reason &&
    value.lease_token === expected.job.leaseToken
  );
}

function isFinishReceipt(
  value: unknown,
  runId: string,
  status: FinishStatus,
): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["ok", "run_id", "status"]) &&
    value.ok === true &&
    value.run_id === runId &&
    value.status === status
  );
}

function classifyPreparationFailure(
  error: unknown,
): "identity_not_visible" | "database_cleanup_failed" {
  return isRecord(error) && error.code === "P0002"
    ? "identity_not_visible"
    : "database_cleanup_failed";
}

async function bounded<T>(
  operation: () => Promise<T>,
  now: () => number,
  deadlineAt: number,
  operationTimeoutMs: number,
): Promise<T> {
  const remaining = deadlineAt - now();
  if (remaining <= 0) throw new WorkerError("worker_deadline_exceeded");
  const timeoutMs = Math.min(operationTimeoutMs, remaining);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new WorkerError("operation_timeout")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function recordFailure(options: {
  dependencies: CleanupCreatedIdentitiesDependencies;
  job: ClaimedCleanupJob;
  status: CleanupStatus;
  reason: CreatedIdentityCleanupFailureReason;
  now: () => number;
  deadlineAt: number;
  operationTimeoutMs: number;
}): Promise<boolean> {
  try {
    const receipt = await bounded(
      () =>
        options.dependencies.failCleanup({
          cleanupJobId: options.job.cleanupJobId,
          userId: options.job.userId,
          leaseToken: options.job.leaseToken,
          reason: options.reason,
        }),
      options.now,
      options.deadlineAt,
      options.operationTimeoutMs,
    );
    return isFailureReceipt(receipt, {
      job: options.job,
      status: options.status,
      reason: options.reason,
    });
  } catch {
    return false;
  }
}

async function processJob(options: {
  dependencies: CleanupCreatedIdentitiesDependencies;
  job: ClaimedCleanupJob;
  now: () => number;
  deadlineAt: number;
  operationTimeoutMs: number;
}): Promise<{ completed: boolean; receiptFailure: boolean }> {
  const { dependencies, job, now, deadlineAt, operationTimeoutMs } = options;
  let prepared: PreparedCleanup | null = null;
  let preparationReason: CreatedIdentityCleanupFailureReason =
    "database_cleanup_failed";
  try {
    const receipt = await bounded(
      () => dependencies.prepareCleanup(job),
      now,
      deadlineAt,
      operationTimeoutMs,
    );
    prepared = parsePreparedReceipt(receipt, job);
  } catch (error) {
    preparationReason = job.status === "pending_auth"
      ? "database_cleanup_failed"
      : classifyPreparationFailure(error);
  }

  if (!prepared) {
    const recorded = await recordFailure({
      dependencies,
      job,
      status: job.status,
      reason: preparationReason,
      now,
      deadlineAt,
      operationTimeoutMs,
    });
    return { completed: false, receiptFailure: !recorded };
  }

  const pendingJob: ClaimedCleanupJob = {
    ...job,
    status: "pending_auth",
    userId: prepared.userId,
  };
  const authCleanup = await deleteCreatedAuthIdentityVerified({
    expectedUserId: prepared.userId,
    getAuthUser: () =>
      bounded(
        () => dependencies.getAuthUser(prepared.userId),
        now,
        deadlineAt,
        operationTimeoutMs,
      ),
    deleteAuthUser: () =>
      bounded(
        () => dependencies.deleteAuthUser(prepared.userId),
        now,
        deadlineAt,
        operationTimeoutMs,
      ),
    maxAttempts: 2,
  });
  if (!authCleanup.ok) {
    const recorded = await recordFailure({
      dependencies,
      job: pendingJob,
      status: "pending_auth",
      reason: authCleanup.reason,
      now,
      deadlineAt,
      operationTimeoutMs,
    });
    return { completed: false, receiptFailure: !recorded };
  }

  try {
    const receipt = await bounded(
      () =>
        dependencies.completeCleanup({
          cleanupJobId: prepared.cleanupJobId,
          userId: prepared.userId,
          leaseToken: prepared.leaseToken,
        }),
      now,
      deadlineAt,
      operationTimeoutMs,
    );
    if (isCompleteReceipt(receipt, pendingJob)) {
      return { completed: true, receiptFailure: false };
    }
  } catch {
    // The fenced lease expires and the job becomes safely claimable again.
  }
  return { completed: false, receiptFailure: true };
}

function safeErrorCode(error: unknown): string {
  return error instanceof WorkerError ? error.code : "worker_execution_failed";
}

function finishErrorCode(
  executionErrorCode: string | null,
  summary: WorkerSummary,
): string | null {
  if (executionErrorCode === null) return null;
  if (executionErrorCode === "worker_deadline_exceeded") {
    return "worker_deadline_exceeded";
  }
  if (summary.receiptFailures > 0) return "receipt_persistence_failed";
  if (
    executionErrorCode === "cleanup_incomplete" ||
    executionErrorCode === "invalid_claim_receipt"
  ) {
    return "batch_failed";
  }
  return "invocation_failed";
}

export function createCleanupCreatedIdentitiesHandler(
  options: HandlerOptions,
): (req: Request) => Promise<Response> {
  const now = options.now ?? Date.now;
  const logger = options.logger ?? defaultLogger;
  const batchSize = options.batchSize ?? MAX_BATCH_SIZE;
  const operationTimeoutMs = options.operationTimeoutMs ??
    MAX_AUTH_REQUEST_TIMEOUT_MS;
  const totalRuntimeMs = options.totalRuntimeMs ?? MAX_WORKER_RUNTIME_MS;
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > MAX_BATCH_SIZE ||
    !Number.isFinite(operationTimeoutMs) ||
    operationTimeoutMs <= 0 ||
    operationTimeoutMs > MAX_AUTH_REQUEST_TIMEOUT_MS ||
    !Number.isFinite(totalRuntimeMs) ||
    totalRuntimeMs <= 0 ||
    totalRuntimeMs > MAX_WORKER_RUNTIME_MS ||
    totalRuntimeMs <= operationTimeoutMs * 2
  ) {
    throw new Error("Invalid cleanup worker limits");
  }

  return async (req: Request): Promise<Response> => {
    const correlationId = (
      options.randomCorrelationId ??
        (() =>
          crypto
            .getRandomValues(new Uint8Array(8))
            .reduce(
              (value, byte) => value + byte.toString(16).padStart(2, "0"),
              "",
            ))
    )();

    if (req.method !== "POST") {
      return response(405, {
        ok: false,
        error: "method_not_allowed",
        correlation_id: correlationId,
      });
    }

    let config: CleanupCreatedIdentitiesConfig;
    try {
      config = options.loadConfig();
    } catch {
      config = {
        supabaseUrl: undefined,
        serviceRoleKey: undefined,
        anonKey: undefined,
        schedulerSecret: undefined,
      };
    }
    if (!hasValidConfiguration(config)) {
      logger.error("cleanup-created-identities.configuration-failed", {
        correlationId,
        code: "invalid_server_configuration",
      });
      return response(500, {
        ok: false,
        error: "server_configuration_error",
        correlation_id: correlationId,
      });
    }

    const credentialSource = authorize(req, config);
    if (!credentialSource) {
      return response(403, {
        ok: false,
        error: "forbidden",
        correlation_id: correlationId,
      });
    }

    const bodySource = await parseBody(req);
    if (!bodySource) {
      return response(400, {
        ok: false,
        error: "invalid_request_schema",
        correlation_id: correlationId,
      });
    }
    if (bodySource !== credentialSource) {
      return response(403, {
        ok: false,
        error: "credential_source_mismatch",
        correlation_id: correlationId,
      });
    }

    const startedAt = now();
    const deadlineAt = startedAt + totalRuntimeMs;
    // Reserve one bounded request window for the mandatory singleton finish
    // receipt. Work stops before this boundary, even when claimed jobs remain.
    const workDeadlineAt = deadlineAt - operationTimeoutMs;
    const runId = (options.randomRunId ?? crypto.randomUUID)();
    let dependencies: CleanupCreatedIdentitiesDependencies;
    try {
      dependencies = options.createDependencies({ config, deadlineAt });
    } catch {
      logger.error("cleanup-created-identities.client-failed", {
        correlationId,
        code: "worker_client_unavailable",
      });
      return response(500, {
        ok: false,
        error: "worker_client_unavailable",
        correlation_id: correlationId,
      });
    }

    let acquireReceipt: unknown;
    try {
      acquireReceipt = await bounded(
        () =>
          dependencies.acquireWorker({
            runId,
            leaseSeconds: WORKER_LEASE_SECONDS,
          }),
        now,
        deadlineAt,
        operationTimeoutMs,
      );
    } catch {
      return response(503, {
        ok: false,
        error: "worker_lease_unavailable",
        correlation_id: correlationId,
      });
    }
    const acquisition = parseAcquireReceipt(acquireReceipt, runId);
    if (!acquisition) {
      return response(503, {
        ok: false,
        error: "invalid_worker_lease_receipt",
        correlation_id: correlationId,
      });
    }
    if (!acquisition.acquired) {
      logger.info("cleanup-created-identities.overlap-skipped", {
        correlationId,
        code: "worker_overlap",
      });
      return response(200, {
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
    }

    const summary: WorkerSummary = {
      claimed: 0,
      completed: 0,
      pending: 0,
      receiptFailures: 0,
    };
    let executionErrorCode: string | null = null;
    let finishReceiptValid = false;
    try {
      const claimedReceipt = await bounded(
        () => dependencies.claimJobs(batchSize),
        now,
        workDeadlineAt,
        operationTimeoutMs,
      );
      const jobs = parseClaimedJobs(claimedReceipt, batchSize);
      if (!jobs) throw new WorkerError("invalid_claim_receipt");
      summary.claimed = jobs.length;

      for (let index = 0; index < jobs.length; index += 1) {
        if (now() >= workDeadlineAt) {
          summary.pending += jobs.length - index;
          executionErrorCode = "worker_deadline_exceeded";
          break;
        }
        const result = await processJob({
          dependencies,
          job: jobs[index],
          now,
          deadlineAt: workDeadlineAt,
          operationTimeoutMs,
        });
        if (result.completed) summary.completed += 1;
        else summary.pending += 1;
        if (result.receiptFailure) summary.receiptFailures += 1;
      }
      if (
        executionErrorCode === null &&
        (summary.pending > 0 || summary.receiptFailures > 0)
      ) {
        executionErrorCode = "cleanup_incomplete";
      }
    } catch (error) {
      executionErrorCode = safeErrorCode(error);
      summary.pending = Math.max(
        summary.pending,
        summary.claimed - summary.completed,
      );
    } finally {
      const finishStatus: FinishStatus = executionErrorCode === null
        ? "succeeded"
        : "failed";
      const persistedErrorCode = finishErrorCode(executionErrorCode, summary);
      try {
        const receipt = await bounded(
          () =>
            dependencies.finishWorker({
              runId,
              status: finishStatus,
              summary,
              errorCode: persistedErrorCode,
            }),
          now,
          deadlineAt,
          operationTimeoutMs,
        );
        finishReceiptValid = isFinishReceipt(receipt, runId, finishStatus);
      } catch {
        finishReceiptValid = false;
      }
    }

    if (!finishReceiptValid) {
      executionErrorCode = "worker_finish_receipt_failed";
    }
    const publicSummary = {
      claimed: summary.claimed,
      completed: summary.completed,
      pending: summary.pending,
      receipt_failures: summary.receiptFailures,
    };
    if (executionErrorCode !== null) {
      logger.error("cleanup-created-identities.run-failed", {
        correlationId,
        code: executionErrorCode,
        claimed: summary.claimed,
        completed: summary.completed,
        pending: summary.pending,
        receiptFailures: summary.receiptFailures,
      });
      return response(503, {
        ok: false,
        status: "incomplete",
        error: executionErrorCode,
        correlation_id: correlationId,
        summary: publicSummary,
      });
    }

    logger.info("cleanup-created-identities.run-succeeded", {
      correlationId,
      claimed: summary.claimed,
      completed: summary.completed,
      pending: summary.pending,
      receiptFailures: summary.receiptFailures,
    });
    return response(200, {
      ok: true,
      status: "completed",
      correlation_id: correlationId,
      summary: publicSummary,
    });
  };
}
