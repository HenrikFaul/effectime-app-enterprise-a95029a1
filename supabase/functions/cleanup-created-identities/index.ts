import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import {
  type CleanupCreatedIdentitiesDependencies,
  createCleanupCreatedIdentitiesHandler,
  MAX_AUTH_REQUEST_TIMEOUT_MS,
} from "./handler.ts";

function boundedFetch(deadlineAt: number): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) {
      throw new DOMException("Request deadline exceeded", "TimeoutError");
    }

    const controller = new AbortController();
    const inheritedSignal = init?.signal;
    const abortFromInheritedSignal = () =>
      controller.abort(inheritedSignal?.reason);
    if (inheritedSignal?.aborted) abortFromInheritedSignal();
    else {
      inheritedSignal?.addEventListener("abort", abortFromInheritedSignal, {
        once: true,
      });
    }
    const timeout = setTimeout(
      () =>
        controller.abort(new DOMException("Request timed out", "TimeoutError")),
      Math.min(MAX_AUTH_REQUEST_TIMEOUT_MS, remaining),
    );
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      inheritedSignal?.removeEventListener("abort", abortFromInheritedSignal);
    }
  };
}

class SafeRpcError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "SafeRpcError";
    this.code = code;
  }
}

function safeRpcError(error: { code?: string } | null): never {
  throw new SafeRpcError(error?.code === "P0002" ? "P0002" : "rpc_failed");
}

function createDependencies(input: {
  config: {
    supabaseUrl: string;
    serviceRoleKey: string;
  };
  deadlineAt: number;
}): CleanupCreatedIdentitiesDependencies {
  const admin = createClient(
    input.config.supabaseUrl,
    input.config.serviceRoleKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: boundedFetch(input.deadlineAt) },
    },
  );

  return {
    acquireWorker: async ({ runId, leaseSeconds }) => {
      const { data, error } = await admin.rpc(
        "acquire_created_identity_cleanup_worker_v1",
        { p_run_id: runId, p_lease_seconds: leaseSeconds },
      );
      if (error) safeRpcError(error);
      return data;
    },
    finishWorker: async ({ runId, status, summary, errorCode }) => {
      const { data, error } = await admin.rpc(
        "finish_created_identity_cleanup_worker_v1",
        {
          p_run_id: runId,
          p_status: status,
          p_claimed: summary.claimed,
          p_completed: summary.completed,
          p_pending: summary.pending,
          p_receipt_failures: summary.receiptFailures,
          p_error_code: errorCode,
        },
      );
      if (error) safeRpcError(error);
      return data;
    },
    claimJobs: async (limit) => {
      const { data, error } = await admin.rpc(
        "claim_created_enterprise_identity_cleanup_jobs_v2",
        { p_limit: limit },
      );
      if (error) safeRpcError(error);
      return data;
    },
    prepareCleanup: async (job) => {
      const { data, error } = await admin.rpc(
        "prepare_created_enterprise_identity_cleanup_v2",
        {
          p_cleanup_job_id: job.cleanupJobId,
          p_user_id: job.userId,
          p_membership_id: null,
          p_lease_token: job.leaseToken,
        },
      );
      if (error) safeRpcError(error);
      return data;
    },
    completeCleanup: async ({ cleanupJobId, userId, leaseToken }) => {
      const { data, error } = await admin.rpc(
        "complete_created_enterprise_identity_cleanup_v2",
        {
          p_cleanup_job_id: cleanupJobId,
          p_user_id: userId,
          p_lease_token: leaseToken,
        },
      );
      if (error) safeRpcError(error);
      return data;
    },
    failCleanup: async ({ cleanupJobId, userId, leaseToken, reason }) => {
      const { data, error } = await admin.rpc(
        "fail_created_enterprise_identity_cleanup_v2",
        {
          p_cleanup_job_id: cleanupJobId,
          p_user_id: userId,
          p_error_code: reason,
          p_lease_token: leaseToken,
        },
      );
      if (error) safeRpcError(error);
      return data;
    },
    getAuthUser: (userId) => admin.auth.admin.getUserById(userId),
    deleteAuthUser: (userId) => admin.auth.admin.deleteUser(userId),
  };
}

const handler = createCleanupCreatedIdentitiesHandler({
  loadConfig: () => ({
    supabaseUrl: Deno.env.get("SUPABASE_URL"),
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    anonKey: Deno.env.get("SUPABASE_ANON_KEY"),
    schedulerSecret: Deno.env.get(
      "CREATED_IDENTITY_CLEANUP_SCHEDULER_SECRET",
    ),
  }),
  createDependencies,
});

Deno.serve(handler);
