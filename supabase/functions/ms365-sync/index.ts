// Microsoft 365 (Outlook Calendar) per-user OAuth + two-way calendar sync.
// Phase 1: OAuth code flow (multitenant), token refresh, basic two-way sync of
// approved leave requests <-> Outlook calendar events.
//
// Routes:
//   POST  /functions/v1/ms365-sync                   { action, ... }
//   GET   /functions/v1/ms365-sync/callback?code&state
//
// Actions (POST, JWT required):
//   - get_auth_url     { workspace_id, return_to }
//   - sync_now         { integration_id }
//   - disconnect       { integration_id }
//   - status           { workspace_id }
//   - cron_sync_all    (called by pg_cron with apikey/anon header)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MS_CLIENT_ID = Deno.env.get("MS_GRAPH_CLIENT_ID") ?? "";
const MS_CLIENT_SECRET = Deno.env.get("MS_GRAPH_CLIENT_SECRET") ?? "";
const MS_REDIRECT_URI = `${SUPABASE_URL}/functions/v1/ms365-sync/callback`;
const MS_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
  "Presence.Read",
].join(" ");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

async function getCallerUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

// ---------- OAuth helpers ----------

function buildAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: MS_REDIRECT_URI,
    response_mode: "query",
    scope: MS_SCOPES,
    state,
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    code,
    redirect_uri: MS_REDIRECT_URI,
    grant_type: "authorization_code",
    scope: MS_SCOPES,
  });
  const r = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
  );
  const j = await r.json();
  if (!r.ok) throw new Error(`Token exchange failed: ${JSON.stringify(j)}`);
  return j as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };
}

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: MS_SCOPES,
  });
  const r = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
  );
  const j = await r.json();
  if (!r.ok) throw new Error(`Token refresh failed: ${JSON.stringify(j)}`);
  return j as { access_token: string; refresh_token?: string; expires_in: number };
}

async function ensureFreshToken(integration: any) {
  const exp = integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : 0;
  if (exp - 60_000 > Date.now()) return integration.access_token as string;
  const refreshed = await refreshAccessToken(integration.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await admin
    .from("enterprise_user_calendar_integrations")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? integration.refresh_token,
      token_expires_at: newExpiry,
    })
    .eq("id", integration.id);
  return refreshed.access_token;
}

async function fetchMsUser(accessToken: string) {
  const r = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Graph /me failed: ${r.status}`);
  return await r.json() as { id: string; mail?: string; userPrincipalName?: string };
}

// ---------- Calendar sync ----------

interface LeaveRequest {
  id: string;
  workspace_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
  external_event_id?: string | null;
}

async function syncOutboundLeaves(integration: any, accessToken: string) {
  // Push approved leave requests of this user as Outlook calendar events.
  const { data: leaves } = await admin
    .from("leave_requests")
    .select("id, workspace_id, user_id, start_date, end_date, leave_type, status, external_event_id")
    .eq("workspace_id", integration.workspace_id)
    .eq("user_id", integration.user_id)
    .eq("status", "approved")
    .gte("end_date", new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));

  let pushed = 0;
  for (const lv of (leaves as LeaveRequest[]) ?? []) {
    if (lv.external_event_id) continue; // already synced
    const event = {
      subject: `[Effectime] ${lv.leave_type}`,
      body: { contentType: "text", content: `Approved leave (${lv.leave_type}) from Effectime.` },
      start: { dateTime: `${lv.start_date}T00:00:00`, timeZone: "UTC" },
      end: {
        dateTime: `${new Date(new Date(lv.end_date).getTime() + 86400_000).toISOString().slice(0, 10)}T00:00:00`,
        timeZone: "UTC",
      },
      isAllDay: true,
      showAs: "oof",
      categories: ["Effectime"],
    };
    const r = await fetch("https://graph.microsoft.com/v1.0/me/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (r.ok) {
      const created = await r.json();
      await admin
        .from("leave_requests")
        .update({ external_event_id: created.id })
        .eq("id", lv.id);
      pushed++;
    } else {
      const errBody = await r.text();
      console.error("Outbound push failed", r.status, errBody);
    }
  }
  return pushed;
}

async function syncInboundOOO(integration: any, accessToken: string) {
  // Pull next 60 days of OOF events from Outlook → conflict signals (logged for now).
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 60 * 86400_000).toISOString();
  const url =
    `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${start}&endDateTime=${end}&$top=100&$select=id,subject,start,end,showAs,categories`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
  });
  if (!r.ok) throw new Error(`calendarView failed: ${r.status}`);
  const j = await r.json();
  const ooo = (j.value ?? []).filter((e: any) => e.showAs === "oof");
  return ooo.length;
}

async function logSync(
  integration: any,
  status: "success" | "error" | "partial",
  events: number,
  error: string | null,
  details: Record<string, unknown> = {},
) {
  await admin.from("enterprise_calendar_sync_log").insert({
    workspace_id: integration.workspace_id,
    integration_id: integration.id,
    user_id: integration.user_id,
    provider: integration.provider,
    direction: "both",
    action: "scheduled_sync",
    status,
    events_processed: events,
    error_message: error,
    details,
  });
  await admin
    .from("enterprise_user_calendar_integrations")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_error: error,
    })
    .eq("id", integration.id);
}

async function syncIntegration(integration: any) {
  try {
    const token = await ensureFreshToken(integration);
    const pushed = await syncOutboundLeaves(integration, token);
    const ooo = await syncInboundOOO(integration, token);
    await logSync(integration, "success", pushed + ooo, null, { pushed, ooo });
    return { ok: true, pushed, ooo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logSync(integration, "error", 0, msg);
    return { ok: false, error: msg };
  }
}

// ---------- Action handlers ----------

async function handleGetAuthUrl(req: Request) {
  const user = await getCallerUser(req);
  if (!user) return jsonResponse({ error: "unauthorized" }, 401);
  if (!MS_CLIENT_ID) return jsonResponse({ error: "MS_GRAPH_CLIENT_ID not configured" }, 500);
  const { workspace_id, return_to } = await req.json().catch(() => ({}));
  if (!workspace_id) return jsonResponse({ error: "workspace_id required" }, 400);

  const state = crypto.randomUUID();
  // Store state for 10 min in a tiny table-less way: encode state→user/workspace in DB.
  await admin.from("enterprise_calendar_sync_log").insert({
    workspace_id,
    user_id: user.id,
    provider: "ms365",
    direction: "outbound",
    action: `oauth_state:${state}`,
    status: "success",
    details: { return_to: return_to ?? null },
  });
  return jsonResponse({ auth_url: buildAuthUrl(state) });
}

async function handleCallback(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");
  if (errParam) {
    return htmlResponse(`<h1>Microsoft 365 connection cancelled</h1><p>${errParam}</p>`, 400);
  }
  if (!code || !state) return htmlResponse("<h1>Invalid callback</h1>", 400);

  // Look up state
  const { data: stateRow } = await admin
    .from("enterprise_calendar_sync_log")
    .select("workspace_id, user_id, details")
    .eq("action", `oauth_state:${state}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!stateRow) return htmlResponse("<h1>Expired or unknown state</h1>", 400);

  try {
    const tokens = await exchangeCode(code);
    const me = await fetchMsUser(tokens.access_token);
    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const { error: upsertErr } = await admin
      .from("enterprise_user_calendar_integrations")
      .upsert({
        workspace_id: stateRow.workspace_id,
        user_id: stateRow.user_id,
        provider: "ms365",
        provider_user_id: me.id,
        provider_user_email: me.mail ?? me.userPrincipalName ?? null,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiry,
        scopes: tokens.scope,
        is_active: true,
        last_sync_status: "connected",
        last_sync_error: null,
      }, { onConflict: "workspace_id,user_id,provider" });

    if (upsertErr) throw new Error(`Integration upsert failed: ${upsertErr.message}`);

    const returnTo = (stateRow.details as any)?.return_to ?? "/";
    return htmlResponse(
      `<!doctype html><html><head><meta charset="utf-8"><title>Connected</title></head>
       <body style="font-family:system-ui;text-align:center;padding:48px">
         <h1>✓ Microsoft 365 connected</h1>
         <p>${me.userPrincipalName ?? me.mail ?? ""}</p>
         <p>Redirecting in 2 seconds…</p>
         <script>setTimeout(function(){window.location.href=${JSON.stringify(returnTo)};},2000);</script>
       </body></html>`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Callback error", msg);
    return htmlResponse(`<h1>Connection error</h1><pre>${msg}</pre>`, 500);
  }
}

async function handleSyncNow(req: Request) {
  const user = await getCallerUser(req);
  if (!user) return jsonResponse({ error: "unauthorized" }, 401);
  const { integration_id } = await req.json();
  const { data: integration } = await admin
    .from("enterprise_user_calendar_integrations")
    .select("*")
    .eq("id", integration_id)
    .eq("user_id", user.id)
    .single();
  if (!integration) return jsonResponse({ error: "not_found" }, 404);
  const result = await syncIntegration(integration);
  return jsonResponse(result);
}

async function handleDisconnect(req: Request) {
  const user = await getCallerUser(req);
  if (!user) return jsonResponse({ error: "unauthorized" }, 401);
  const { integration_id } = await req.json();
  await admin
    .from("enterprise_user_calendar_integrations")
    .delete()
    .eq("id", integration_id)
    .eq("user_id", user.id);
  return jsonResponse({ ok: true });
}

async function handleStatus(req: Request) {
  const user = await getCallerUser(req);
  if (!user) return jsonResponse({ error: "unauthorized" }, 401);
  const { workspace_id } = await req.json();
  const { data } = await admin
    .from("enterprise_user_calendar_integrations")
    .select("id, provider, provider_user_email, is_active, last_sync_at, last_sync_status, last_sync_error, created_at, sync_events_in, sync_events_out")
    .eq("user_id", user.id)
    .eq("workspace_id", workspace_id);
  return jsonResponse({ integrations: data ?? [] });
}

async function handleCronSyncAll() {
  const { data: integrations } = await admin
    .from("enterprise_user_calendar_integrations")
    .select("*")
    .eq("is_active", true);
  let success = 0, failed = 0;
  for (const i of integrations ?? []) {
    const r = await syncIntegration(i);
    if (r.ok) success++; else failed++;
  }
  return jsonResponse({ processed: (integrations ?? []).length, success, failed });
}

// ---------- Router ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);

  if (url.pathname.endsWith("/callback")) return handleCallback(req);

  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let body: any = {};
  try { body = await req.clone().json(); } catch (_) { /* may be empty for cron */ }
  const action = body?.action;

  try {
    switch (action) {
      case "get_auth_url": return await handleGetAuthUrl(req);
      case "sync_now":     return await handleSyncNow(req);
      case "disconnect":   return await handleDisconnect(req);
      case "status":       return await handleStatus(req);
      case "cron_sync_all":return await handleCronSyncAll();
      default:             return jsonResponse({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ms365-sync error", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
