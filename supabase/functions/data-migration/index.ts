// Data migration: Lovable Cloud (source) -> External Supabase (target)
// Preserves auth.user IDs. Disables FK/triggers (session_replication_role=replica) on target.
// POST { mode?: "dry_run" | "execute", truncate?: boolean }
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// schema mapping: target_schema => list of tables (same name in source.public)
const TABLE_MAP: Record<string, string[]> = {
  syncfolk_shared: [
    "profiles", "user_roles", "account_deletions",
    "email_send_log", "email_send_state", "email_unsubscribe_tokens", "suppressed_emails",
  ],
  syncfolk: [
    "events", "event_participants", "event_share_tokens",
    "votes", "personal_availability", "favorites", "friendships",
  ],
  syncfolk_enterprise: [
    "enterprise_workspaces", "enterprise_memberships",
    "enterprise_offices", "enterprise_teams", "enterprise_team_roles",
    "enterprise_role_definitions", "enterprise_role_permissions", "enterprise_feature_catalog",
    "enterprise_skills", "enterprise_member_skills", "enterprise_member_templates",
    "enterprise_member_rates", "enterprise_member_role_allocations", "enterprise_member_site_priorities",
    "enterprise_leave_types", "enterprise_leave_quotas", "enterprise_quota_transactions",
    "enterprise_allowances",
    "enterprise_holidays", "enterprise_company_leave_days", "enterprise_blocked_dates",
    "enterprise_daily_rules", "enterprise_office_coverage_rules", "enterprise_rule_templates",
    "enterprise_approval_chains", "enterprise_escalation_rules",
    "enterprise_invitations", "enterprise_notifications", "enterprise_notification_preferences",
    "enterprise_audit_events",
    "enterprise_projects", "enterprise_project_assignments", "enterprise_project_rates",
    "enterprise_project_resource_requirements", "enterprise_project_skill_requirements",
    "enterprise_scenarios", "enterprise_scenario_assignments", "enterprise_shift_assignments",
    "enterprise_reports", "enterprise_report_schedules", "enterprise_export_jobs",
    "enterprise_ical_tokens",
    "enterprise_workspace_integrations", "enterprise_integration_sync_log",
    "enterprise_agile_field_metadata", "enterprise_agile_issues", "enterprise_agile_sync_log",
    "enterprise_ui_section_states", "tenant_calendar_settings",
    "leave_requests", "leave_request_attachments", "leave_request_substitutes", "approval_decisions",
  ],
};

const AUTH_USER_COLS = [
  "id","instance_id","aud","role","email","encrypted_password",
  "email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at",
  "recovery_token","recovery_sent_at","email_change_token_new","email_change",
  "email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data",
  "is_super_admin","created_at","updated_at","phone","phone_confirmed_at",
  "phone_change","phone_change_token","phone_change_sent_at",
  "email_change_token_current","email_change_confirm_status","banned_until",
  "reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous",
];

const AUTH_IDENT_COLS = [
  "provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id",
];

function quoteIdent(s: string) { return '"' + s.replace(/"/g, '""') + '"'; }

async function getColumns(client: Client, schema: string, table: string): Promise<string[]> {
  const res = await client.queryObject<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema=$1 AND table_name=$2
       AND is_generated='NEVER'
       AND (is_identity='NO' OR identity_generation IS NULL OR identity_generation='BY DEFAULT')
     ORDER BY ordinal_position`,
    [schema, table],
  );
  return res.rows.map(r => r.column_name);
}

async function copyTable(
  src: Client, tgt: Client, srcSchema: string, srcTable: string,
  tgtSchema: string, tgtTable: string,
): Promise<{ table: string; source: number; copied: number; skipped: number; error?: string }> {
  const out = { table: `${tgtSchema}.${tgtTable}`, source: 0, copied: 0, skipped: 0 } as any;
  try {
    const srcCols = await getColumns(src, srcSchema, srcTable);
    const tgtCols = await getColumns(tgt, tgtSchema, tgtTable);
    const cols = srcCols.filter(c => tgtCols.includes(c));
    if (cols.length === 0) { out.error = "no overlapping columns"; return out; }
    const colList = cols.map(quoteIdent).join(",");
    const rows = (await src.queryObject<Record<string, unknown>>(
      `SELECT ${colList} FROM ${quoteIdent(srcSchema)}.${quoteIdent(srcTable)}`,
    )).rows;
    out.source = rows.length;
    if (rows.length === 0) return out;
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const params: unknown[] = [];
      const placeholders = batch.map(row => {
        const ph = cols.map(c => { params.push(row[c] ?? null); return `$${params.length}`; });
        return `(${ph.join(",")})`;
      }).join(",");
      const sql = `INSERT INTO ${quoteIdent(tgtSchema)}.${quoteIdent(tgtTable)} (${colList})
                   VALUES ${placeholders} ON CONFLICT DO NOTHING`;
      const r = await tgt.queryObject(sql, params);
      out.copied += r.rowCount ?? 0;
    }
    out.skipped = out.source - out.copied;
    return out;
  } catch (e) {
    out.error = (e as Error).message;
    return out;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = Date.now();
  const body = await req.json().catch(() => ({}));
  const dryRun = body.mode === "dry_run";

  const srcUrl = Deno.env.get("SUPABASE_DB_URL")!;
  const tgtUrl = Deno.env.get("EXTERNAL_SUPABASE_DB_URL")!;
  if (!srcUrl || !tgtUrl || !srcUrl.startsWith("postgres") || !tgtUrl.startsWith("postgres")) {
    return new Response(JSON.stringify({
      error: "DB URL secrets missing or not postgres://",
      src_proto: srcUrl?.split(":")[0], tgt_proto: tgtUrl?.split(":")[0],
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const src = new Client(srcUrl);
  const tgt = new Client(tgtUrl);
  const result: any = { dryRun, auth: {}, tables: [], elapsed_ms: 0 };

  try {
    await src.connect();
    await tgt.connect();

    if (!dryRun) {
      // Disable FK & triggers on target for the duration
      await tgt.queryArray("SET session_replication_role = 'replica'");
    }

    // 1) auth.users
    const usersRows = (await src.queryObject<Record<string, unknown>>(
      `SELECT ${AUTH_USER_COLS.map(quoteIdent).join(",")} FROM auth.users`,
    )).rows;
    result.auth.users_source = usersRows.length;

    if (!dryRun && usersRows.length) {
      const params: unknown[] = [];
      const placeholders = usersRows.map(r => {
        const ph = AUTH_USER_COLS.map(c => { params.push(r[c] ?? null); return `$${params.length}`; });
        return `(${ph.join(",")})`;
      }).join(",");
      const sql = `INSERT INTO auth.users (${AUTH_USER_COLS.map(quoteIdent).join(",")})
                   VALUES ${placeholders} ON CONFLICT (id) DO NOTHING`;
      const r = await tgt.queryObject(sql, params);
      result.auth.users_inserted = r.rowCount ?? 0;
    }

    // 2) auth.identities
    const identsRows = (await src.queryObject<Record<string, unknown>>(
      `SELECT ${AUTH_IDENT_COLS.map(quoteIdent).join(",")} FROM auth.identities`,
    )).rows;
    result.auth.identities_source = identsRows.length;
    if (!dryRun && identsRows.length) {
      const params: unknown[] = [];
      const placeholders = identsRows.map(r => {
        const ph = AUTH_IDENT_COLS.map(c => { params.push(r[c] ?? null); return `$${params.length}`; });
        return `(${ph.join(",")})`;
      }).join(",");
      const sql = `INSERT INTO auth.identities (${AUTH_IDENT_COLS.map(quoteIdent).join(",")})
                   VALUES ${placeholders} ON CONFLICT (id) DO NOTHING`;
      const r = await tgt.queryObject(sql, params);
      result.auth.identities_inserted = r.rowCount ?? 0;
    }

    // 3) Public tables -> target schemas
    for (const [tgtSchema, tables] of Object.entries(TABLE_MAP)) {
      for (const tbl of tables) {
        if (dryRun) {
          const c = (await src.queryObject<{c: bigint}>(`SELECT COUNT(*)::bigint c FROM public.${quoteIdent(tbl)}`)).rows[0];
          result.tables.push({ table: `${tgtSchema}.${tbl}`, source: Number(c.c), copied: 0, skipped: 0 });
        } else {
          result.tables.push(await copyTable(src, tgt, "public", tbl, tgtSchema, tbl));
        }
      }
    }

    if (!dryRun) {
      await tgt.queryArray("SET session_replication_role = 'origin'");
    }
  } catch (e) {
    result.fatal_error = (e as Error).message;
  } finally {
    try { await src.end(); } catch (_) {}
    try { await tgt.end(); } catch (_) {}
  }

  result.elapsed_ms = Date.now() - startedAt;
  result.summary = {
    total_tables: result.tables.length,
    total_source_rows: result.tables.reduce((s: number, t: any) => s + (t.source || 0), 0),
    total_copied_rows: result.tables.reduce((s: number, t: any) => s + (t.copied || 0), 0),
    tables_with_errors: result.tables.filter((t: any) => t.error).length,
  };

  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
