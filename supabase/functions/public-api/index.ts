// Edge Function: public-api (v3.24.0)
// Read-only REST gateway authenticated by Effectime API keys. Supabase gateway
// JWT verification is intentionally disabled for this function because these
// custom credentials are authenticated here against their SHA-256 hashes.

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.98.0";
import type { Database } from "../../../src/integrations/supabase/types.ts";
import {
  evaluatePublicApiRateLimit,
  extractPublicApiKey,
  isApiKeyActive,
  resolvePublicApiRoute,
} from "./security.ts";
import { checkWorkspaceFeature } from "../_shared/feature-entitlement.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "X-Request-Id, X-RateLimit-Remaining",
};

type DatabaseClient = SupabaseClient<Database>;

function jsonRes(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function reserveUsageLog(
  admin: DatabaseClient,
  workspaceId: string,
  apiKeyId: string,
  method: string,
  path: string,
): Promise<string | null> {
  const { data, error } = await admin.from("enterprise_api_usage_logs").insert({
    workspace_id: workspaceId,
    api_key_id: apiKeyId,
    method,
    path,
    status_code: 102,
    duration_ms: 0,
  }).select("id").single();
  if (error || !data) {
    console.error("[public-api] usage reservation failed", error?.message ?? "missing row");
    return null;
  }
  return data.id as string;
}

async function finalizeUsageLog(
  admin: DatabaseClient,
  usageLogId: string,
  statusCode: number,
  startedAt: number,
): Promise<boolean> {
  const { error } = await admin.from("enterprise_api_usage_logs").update({
    status_code: statusCode,
    duration_ms: Math.max(0, Date.now() - startedAt),
  }).eq("id", usageLogId);
  if (error) {
    console.error("[public-api] usage finalization failed", error.message);
    return false;
  }
  return true;
}

async function touchApiKey(
  admin: DatabaseClient,
  apiKeyId: string,
): Promise<void> {
  const { error } = await admin.from("enterprise_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKeyId);
  if (error) console.error("[public-api] last_used_at update failed", error.message);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const route = resolvePublicApiRoute(req.url);
  const baseHeaders = { "X-Request-Id": requestId };
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("[public-api] missing Supabase server configuration");
    return jsonRes({ error: "Service unavailable", request_id: requestId }, 503, baseHeaders);
  }

  const rawApiKey = extractPublicApiKey(req);
  if (!rawApiKey) {
    return jsonRes({ error: "Unauthorized", request_id: requestId }, 401, baseHeaders);
  }

  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const keyHash = await sha256Hex(rawApiKey);
  const { data: keyRow, error: keyError } = await admin
    .from("enterprise_api_keys")
    .select("id,workspace_id,scopes,expires_at,revoked_at,name")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyError) {
    console.error("[public-api] API-key lookup failed", keyError.message);
    return jsonRes({ error: "Service unavailable", request_id: requestId }, 503, baseHeaders);
  }
  if (!keyRow || !isApiKeyActive(keyRow)) {
    return jsonRes({ error: "Unauthorized", request_id: requestId }, 401, baseHeaders);
  }

  const workspaceId = keyRow.workspace_id as string;
  const apiKeyId = keyRow.id as string;
  const entitlement = await checkWorkspaceFeature(admin, workspaceId, "open_api");
  if (!entitlement.enabled) {
    if (entitlement.reason === "lookup_error") {
      console.error(
        `[public-api] entitlement lookup failed workspace=${workspaceId} feature=open_api step=${entitlement.step}: ${entitlement.error}`,
      );
      return jsonRes({ error: "Service unavailable", request_id: requestId }, 503, baseHeaders);
    }
    console.warn(
      `[public-api] feature denied workspace=${workspaceId} feature=open_api reason=${entitlement.reason}`,
    );
    return jsonRes({ error: "Forbidden", request_id: requestId }, 403, baseHeaders);
  }

  const usageLogId = await reserveUsageLog(admin, workspaceId, apiKeyId, req.method, route);
  if (!usageLogId) {
    return jsonRes({ error: "Service unavailable", request_id: requestId }, 503, baseHeaders);
  }

  const rollingHourStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: rollingHourCount, error: rateError } = await admin
    .from("enterprise_api_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", apiKeyId)
    .gte("created_at", rollingHourStart)
    .neq("status_code", 429);

  if (rateError) {
    console.error("[public-api] persistent rate-limit check failed", rateError.message);
    await finalizeUsageLog(admin, usageLogId, 503, startedAt);
    return jsonRes({ error: "Service unavailable", request_id: requestId }, 503, {
      ...baseHeaders,
      "X-RateLimit-Remaining": "0",
    });
  }

  const rateLimit = evaluatePublicApiRateLimit(rollingHourCount ?? 0);
  if (!rateLimit.allowed) {
    await Promise.all([
      finalizeUsageLog(admin, usageLogId, 429, startedAt),
      touchApiKey(admin, apiKeyId),
    ]);
    return jsonRes({ error: "Rate limit exceeded", request_id: requestId }, 429, {
      ...baseHeaders,
      "X-RateLimit-Remaining": "0",
    });
  }

  const scopes = (keyRow.scopes ?? []) as string[];
  const hasReadScope = scopes.length === 0 || scopes.includes("read") || scopes.includes("*");
  let status = 200;
  let body: unknown;

  try {
    if (req.method !== "GET") {
      status = 405;
      body = { error: "Method not allowed", request_id: requestId };
    } else if (route === "/v1/health") {
      body = {
        data: { ok: true, workspace_id: workspaceId, key_name: keyRow.name },
        meta: { request_id: requestId },
      };
    } else if (!hasReadScope) {
      status = 403;
      body = { error: "Forbidden", request_id: requestId };
    } else if (route === "/v1/employees") {
      const { data, error } = await admin.from("enterprise_memberships")
        .select("id,user_id,role,status,team,business_role,joined_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .limit(1000);
      if (error) throw new Error(`employees query failed: ${error.message}`);
      body = { data, meta: { request_id: requestId, count: data?.length ?? 0 } };
    } else if (route === "/v1/schedules") {
      const { data, error } = await admin.from("enterprise_shift_assignments")
        .select("id,membership_id,user_id,shift_date,office_id,business_role,skill_id,is_tentative,created_at,updated_at")
        .eq("workspace_id", workspaceId)
        .order("shift_date", { ascending: false })
        .limit(1000);
      if (error) throw new Error(`schedules query failed: ${error.message}`);
      body = { data, meta: { request_id: requestId, count: data?.length ?? 0 } };
    } else if (route === "/v1/leave-requests") {
      const { data, error } = await admin.from("leave_requests")
        .select("id,user_id,leave_type,start_date,end_date,is_half_day,half_day_period,status,created_at,updated_at")
        .eq("workspace_id", workspaceId)
        .order("start_date", { ascending: false })
        .limit(1000);
      if (error) throw new Error(`leave-requests query failed: ${error.message}`);
      body = { data, meta: { request_id: requestId, count: data?.length ?? 0 } };
    } else {
      status = 404;
      body = {
        error: "Not found",
        request_id: requestId,
        available: [
          "GET /v1/health",
          "GET /v1/employees",
          "GET /v1/schedules",
          "GET /v1/leave-requests",
        ],
      };
    }
  } catch (error) {
    console.error("[public-api] route failed", error instanceof Error ? error.message : String(error));
    status = 500;
    body = { error: "Internal server error", request_id: requestId };
  }

  const [usageFinalized] = await Promise.all([
    finalizeUsageLog(admin, usageLogId, status, startedAt),
    touchApiKey(admin, apiKeyId),
  ]);
  if (!usageFinalized) {
    return jsonRes({ error: "Service unavailable", request_id: requestId }, 503, {
      ...baseHeaders,
      "X-RateLimit-Remaining": String(rateLimit.remaining),
    });
  }

  return jsonRes(body, status, {
    ...baseHeaders,
    "X-RateLimit-Remaining": String(rateLimit.remaining),
  });
});
