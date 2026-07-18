// Edge Function: webhook-dispatcher (v3.24.0)
// Delivers pending/retrying webhook rows with HMAC-SHA256 signatures.
// Invocation requires either a platform-admin JWT or the exact service-role
// bearer credential used by trusted scheduled workers.

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.98.0";
import type { Database } from "../../../src/integrations/supabase/types.ts";
import { checkWorkspaceFeature } from "../_shared/feature-entitlement.ts";
import { hasServiceRoleCredential } from "../_shared/request-security.ts";
import {
  createDeliveryClaim,
  isActiveDeliveryClaim,
  safeWebhookUrl,
} from "./security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_RESPONSE_BODY_BYTES = 2000;

type DatabaseClient = SupabaseClient<Database>;

type Delivery = {
  id: string;
  subscription_id: string;
  workspace_id: string;
  event_type: string;
  payload: unknown;
  attempt_count: number;
  status: string;
  last_error: string | null;
};

type DeliveryResult = {
  id: string;
  status: number;
  ok: boolean;
  recorded: boolean;
};

function jsonRes(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readLimitedResponseBody(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let body = "";
  let completed = false;

  try {
    while (received < MAX_RESPONSE_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) {
        completed = true;
        break;
      }
      const remaining = MAX_RESPONSE_BODY_BYTES - received;
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
      received += chunk.byteLength;
      body += decoder.decode(chunk, { stream: true });
      if (value.byteLength > remaining) {
        await reader.cancel();
        break;
      }
    }
  } finally {
    body += decoder.decode();
    if (!completed) {
      try {
        await reader.cancel();
      } catch {
        // The stream may already be closed; the response body is still bounded.
      }
    }
  }

  return body.slice(0, MAX_RESPONSE_BODY_BYTES);
}

async function recordDelivery(
  admin: DatabaseClient,
  deliveryId: string,
  statusCode: number,
  responseBody: string,
  errorMessage: string | null,
): Promise<boolean> {
  const args: Database["public"]["Functions"]["webhook_record_delivery"]["Args"] = {
    _delivery_id: deliveryId,
    _status_code: statusCode,
    _response_body: responseBody.slice(0, MAX_RESPONSE_BODY_BYTES),
    ...(errorMessage === null ? {} : { _error: errorMessage.slice(0, 500) }),
  };
  const { error } = await admin.rpc("webhook_record_delivery", args);
  if (error) {
    console.error("[webhook-dispatcher] delivery RPC failed", deliveryId, error.message);
    return false;
  }
  return true;
}

async function releaseDeliveryClaim(
  admin: DatabaseClient,
  delivery: Delivery,
  claimToken: string,
): Promise<void> {
  const { error } = await admin.from("enterprise_webhook_deliveries")
    .update({ last_error: delivery.last_error })
    .eq("id", delivery.id)
    .eq("last_error", claimToken);
  if (error) {
    console.error("[webhook-dispatcher] delivery claim release failed", delivery.id, error.message);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, 405, { Allow: "POST, OPTIONS" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("[webhook-dispatcher] missing Supabase server configuration");
      return jsonRes({ error: "Service unavailable" }, 503);
    }

    const admin = createClient<Database>(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const internalServiceCall = hasServiceRoleCredential(req, serviceKey);

    if (!internalServiceCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);
      if (!anonKey) {
        console.error("[webhook-dispatcher] missing anon key for platform-admin auth");
        return jsonRes({ error: "Service unavailable" }, 503);
      }

      const userClient = createClient<Database>(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

      const { data: roleRow, error: roleError } = await admin.from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (roleError) {
        console.error("[webhook-dispatcher] platform-admin lookup failed", roleError.message);
        return jsonRes({ error: "Service unavailable" }, 503);
      }
      if (!roleRow) return jsonRes({ error: "Forbidden" }, 403);
    }

    const { data: deliveryRows, error: deliveryError } = await admin
      .from("enterprise_webhook_deliveries")
      .select("id,subscription_id,workspace_id,event_type,payload,attempt_count,status,last_error")
      .in("status", ["pending", "retrying"])
      .order("created_at")
      .limit(20);
    if (deliveryError) {
      console.error("[webhook-dispatcher] delivery fetch failed", deliveryError.message);
      return jsonRes({ error: "Service unavailable" }, 503);
    }

    const deliveries = (deliveryRows ?? []) as Delivery[];
    const results: DeliveryResult[] = [];
    let skipped = 0;

    for (const delivery of deliveries) {
      // Entitlement is evaluated before claiming or mutating the delivery. A
      // disabled add-on therefore leaves both delivery and subscription intact
      // so dispatch can resume if open_api is enabled again.
      const entitlement = await checkWorkspaceFeature(admin, delivery.workspace_id, "open_api");
      if (!entitlement.enabled) {
        if (entitlement.reason === "lookup_error") {
          console.error(
            `[webhook-dispatcher] entitlement lookup failed delivery=${delivery.id} workspace=${delivery.workspace_id} feature=open_api step=${entitlement.step}: ${entitlement.error}`,
          );
        } else {
          console.warn(
            `[webhook-dispatcher] delivery skipped delivery=${delivery.id} workspace=${delivery.workspace_id} feature=open_api reason=${entitlement.reason}`,
          );
        }
        skipped += 1;
        continue;
      }

      // The live table has no processing/lease column. A short, conditional
      // marker in last_error provides an optimistic lease without changing the
      // documented retry states; stale markers are recoverable after 30s.
      if (isActiveDeliveryClaim(delivery.last_error)) {
        skipped += 1;
        continue;
      }

      const claimToken = createDeliveryClaim();
      let claimQuery = admin.from("enterprise_webhook_deliveries")
        .update({ last_error: claimToken })
        .eq("id", delivery.id)
        .eq("status", delivery.status)
        .eq("attempt_count", delivery.attempt_count);
      claimQuery = delivery.last_error === null
        ? claimQuery.is("last_error", null)
        : claimQuery.eq("last_error", delivery.last_error);
      const { data: claimedRow, error: claimError } = await claimQuery
        .select("id")
        .maybeSingle();
      if (claimError) {
        console.error("[webhook-dispatcher] delivery claim failed", delivery.id, claimError.message);
        skipped += 1;
        continue;
      }
      if (!claimedRow) {
        skipped += 1;
        continue;
      }

      const { data: subscription, error: subscriptionError } = await admin
        .from("enterprise_webhook_subscriptions")
        .select("url,secret")
        .eq("id", delivery.subscription_id)
        .eq("workspace_id", delivery.workspace_id)
        .eq("is_active", true)
        .maybeSingle();

      if (subscriptionError) {
        console.error("[webhook-dispatcher] subscription lookup failed", delivery.id, subscriptionError.message);
        await releaseDeliveryClaim(admin, delivery, claimToken);
        skipped += 1;
        continue;
      }
      if (!subscription) {
        const recorded = await recordDelivery(
          admin,
          delivery.id,
          0,
          "",
          "active subscription unavailable",
        );
        results.push({ id: delivery.id, status: 0, ok: false, recorded });
        continue;
      }

      const targetUrl = safeWebhookUrl(subscription.url);
      const secret = typeof subscription.secret === "string" ? subscription.secret : "";
      if (!targetUrl || secret.length === 0 || secret.length > 4096) {
        const recorded = await recordDelivery(
          admin,
          delivery.id,
          0,
          "",
          targetUrl ? "invalid subscription secret" : "unsafe subscription URL",
        );
        results.push({ id: delivery.id, status: 0, ok: false, recorded });
        continue;
      }

      const envelope = {
        event: delivery.event_type,
        workspace_id: delivery.workspace_id,
        delivered_at: new Date().toISOString(),
        attempt: delivery.attempt_count + 1,
        data: delivery.payload,
      };
      const body = JSON.stringify(envelope);
      const signature = await hmacSha256Hex(secret, body);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch(targetUrl, {
          method: "POST",
          redirect: "manual",
          headers: {
            "Content-Type": "application/json",
            "X-Effectime-Signature": `sha256=${signature}`,
            "X-Effectime-Event": delivery.event_type,
            "X-Effectime-Delivery-Id": delivery.id,
          },
          body,
          signal: controller.signal,
        });
        const responseBody = await readLimitedResponseBody(response);
        const recorded = await recordDelivery(
          admin,
          delivery.id,
          response.status,
          responseBody,
          null,
        );
        results.push({
          id: delivery.id,
          status: response.status,
          ok: response.ok && recorded,
          recorded,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "webhook request failed";
        const recorded = await recordDelivery(admin, delivery.id, 0, "", errorMessage);
        results.push({ id: delivery.id, status: 0, ok: false, recorded });
      } finally {
        clearTimeout(timeout);
      }
    }

    return jsonRes({
      ok: true,
      processed: results.length,
      skipped,
      results,
    });
  } catch (error) {
    console.error(
      "[webhook-dispatcher] unhandled error",
      error instanceof Error ? error.message : String(error),
    );
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
