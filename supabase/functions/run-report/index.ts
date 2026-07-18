// Edge function: run-report
// Executes saved/custom reports with two modes:
//  - Visual config (data_source + config) → builds a parameterized supabase-js query
//  - SQL mode (config.sql) → strict SELECT-only validation with workspace_id auto-filter
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { checkWorkspaceFeature } from '../_shared/feature-entitlement.ts';
import { hasServiceRoleCredential } from '../_shared/request-security.ts';
import {
  createVisualReportFieldPlan,
  createVisualReportExecutionPlan,
  DATA_SOURCE_TABLE,
  parseReportSql,
  permitsReportAccess,
  projectRequestedReportFields,
  referencedTables,
  sortAndLimitReportRows,
  validateIdentifier,
} from './contract.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TABLE_PERMISSION: Record<string, string> = {
  enterprise_audit_events: 'audit',
  approval_decisions: 'approvals',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.json();
    const { workspace_id, data_source, config } = body || {};
    if (!workspace_id) return json({ error: 'workspace_id required' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const internalServiceCall = hasServiceRoleCredential(req, serviceKey);

    if (!internalServiceCall) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

      const { data: memberCheck, error: memberError } = await admin
        .from('enterprise_memberships')
        .select('role')
        .eq('workspace_id', workspace_id)
        .eq('user_id', userData.user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (memberError) throw new Error(`Membership check failed: ${memberError.message}`);
      if (!memberCheck) return json({ error: 'Nem vagy tagja ennek a munkaterületnek.' }, 403);
      const callerRole = memberCheck.role;

      const requiredFeatures = new Set<string>(['reports']);
      if (config && typeof config.sql === 'string' && config.sql.trim()) {
        for (const table of referencedTables(config.sql)) {
          requiredFeatures.add(TABLE_PERMISSION[table] || 'reports');
        }
      } else if (data_source && DATA_SOURCE_TABLE[data_source]) {
        requiredFeatures.add(TABLE_PERMISSION[DATA_SOURCE_TABLE[data_source]] || 'reports');
      }
      if (!(await hasFeatureAccess(admin, workspace_id, callerRole, [...requiredFeatures]))) {
        return json({ error: 'Nincs jogosultságod ehhez a riporthoz.' }, 403);
      }
    }

    // Tier enforcement applies to both end-user and internal scheduler calls.
    // Service-role authentication authorizes the caller; it does not grant the
    // target workspace a product feature that its tenant has not purchased.
    const entitlement = await checkWorkspaceFeature(admin, workspace_id, 'run_report');
    if (!entitlement.enabled) {
      if (entitlement.reason === 'lookup_error') {
        console.error(
          `[run-report] entitlement lookup failed workspace=${workspace_id} feature=run_report step=${entitlement.step}: ${entitlement.error}`,
        );
        return json({ error: 'A riport jogosultság-ellenőrzése átmenetileg nem elérhető.' }, 503);
      }
      console.warn(
        `[run-report] entitlement denied workspace=${workspace_id} feature=run_report reason=${entitlement.reason}`,
      );
      return json({ error: 'A riportfuttatás nincs engedélyezve ezen a munkaterületen.' }, 403);
    }

    // SQL mode
    if (config && typeof config.sql === 'string' && config.sql.trim().length > 0) {
      const result = await runSqlMode(admin, config.sql, workspace_id);
      return json(result);
    }

    // Visual mode
    if (!data_source || !DATA_SOURCE_TABLE[data_source]) {
      return json({ error: 'Ismeretlen adatforrás.' }, 400);
    }
    const result = await runVisualMode(admin, data_source, config || {}, workspace_id);
    return json(result);
  } catch (e) {
    console.error('run-report error:', e);
    return json({ error: (e as Error).message || 'Belső hiba.' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

async function hasFeatureAccess(
  admin: any,
  workspaceId: string,
  role: string,
  featureKeys: string[],
): Promise<boolean> {
  if (role === 'owner') return true;
  const uniqueKeys = [...new Set(featureKeys)];
  const { data, error } = await admin
    .from('enterprise_role_permissions')
    .select('feature_key, access_level')
    .eq('workspace_id', workspaceId)
    .eq('role_key', role)
    .in('feature_key', uniqueKeys);
  if (error) throw new Error(`Permission check failed: ${error.message}`);
  const access = new Map<string, unknown>();
  for (const row of data || []) access.set(row.feature_key, row.access_level);
  return uniqueKeys.every((key) => permitsReportAccess(access.get(key)));
}

async function runVisualMode(admin: any, dataSource: string, config: any, workspaceId: string) {
  const table = DATA_SOURCE_TABLE[dataSource];
  const filters: any[] = Array.isArray(config.filters) ? config.filters : [];
  const plan = createVisualReportExecutionPlan(config);
  const { groupBy, aggregations, sort } = plan;
  const fieldPlan = createVisualReportFieldPlan(dataSource, config, plan);
  let q = admin.from(table).select(fieldPlan.selectFields).limit(plan.rawScanLimit);

  // Workspace filter (always applied if column exists)
  if (table !== 'profiles') {
    q = q.eq('workspace_id', workspaceId);
  }

  // Apply filters
  for (const f of filters) {
    if (!f.field) continue;
    validateIdentifier(f.field, 'szűrőmező');
    switch (f.operator) {
      case 'eq': q = q.eq(f.field, f.value); break;
      case 'neq': q = q.neq(f.field, f.value); break;
      case 'gt': q = q.gt(f.field, f.value); break;
      case 'gte': q = q.gte(f.field, f.value); break;
      case 'lt': q = q.lt(f.field, f.value); break;
      case 'lte': q = q.lte(f.field, f.value); break;
      case 'like': q = q.ilike(f.field, `%${f.value}%`); break;
      case 'in': q = q.in(f.field, Array.isArray(f.value) ? f.value : String(f.value).split(',').map((s: string) => s.trim())); break;
      case 'is_null': q = q.is(f.field, null); break;
      case 'not_null': q = q.not(f.field, 'is', null); break;
    }
  }

  // Raw reports are sorted by PostgREST. Aggregated aliases do not exist in
  // the database, so aggregate sorting is deliberately deferred until after
  // the bounded in-memory grouping step.
  if (!plan.isAggregated) {
    for (const directive of sort) {
      q = q.order(directive.field, { ascending: directive.dir !== 'desc' });
    }
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data as Record<string, unknown>[]) || [];
  const rawRowCount = rows.length;

  // Enrich memberships with display_name
  if (fieldPlan.enrichMembershipProfiles && rows.length > 0) {
    const userIds = Array.from(new Set(rows.map(r => r.user_id).filter((id): id is string => typeof id === 'string')));
    if (userIds.length > 0) {
      const { data: profiles, error: profilesErr } = await admin.from('profiles').select('user_id, display_name').in('user_id', userIds);
      if (profilesErr) throw new Error(`Profiles enrichment failed: ${profilesErr.message}`);
      const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.display_name]));
      rows = rows.map(r => ({ display_name: nameMap.get(r.user_id) || 'Unknown', ...r }));
    }
  }

  // In-memory group by + aggregations
  if (plan.isAggregated) {
    const buckets = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const key = JSON.stringify(groupBy.map(g => row[g] ?? null));
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(row);
    }
    const aggregated: Record<string, unknown>[] = [];
    for (const [key, bucket] of buckets.entries()) {
      const out: Record<string, unknown> = {};
      const keyParts = JSON.parse(key) as unknown[];
      groupBy.forEach((g, i) => { out[g] = keyParts[i]; });
      for (const a of aggregations) {
        const values = bucket.map(r => Number(r[a.field])).filter(v => !isNaN(v));
        switch (a.fn) {
          case 'count': out[a.alias] = bucket.length; break;
          case 'sum': out[a.alias] = values.reduce((s, v) => s + v, 0); break;
          case 'avg': out[a.alias] = values.length ? +(values.reduce((s, v) => s + v, 0) / values.length).toFixed(2) : 0; break;
          case 'min': out[a.alias] = values.length ? Math.min(...values) : null; break;
          case 'max': out[a.alias] = values.length ? Math.max(...values) : null; break;
        }
      }
      aggregated.push(out);
    }
    rows = sortAndLimitReportRows(aggregated, sort, plan.outputLimit);
  } else {
    rows = projectRequestedReportFields(rows, fieldPlan.requestedFields);
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return {
    rows,
    columns,
    meta: {
      source: table,
      count: rows.length,
      raw_count: rawRowCount,
      scan_limit: plan.rawScanLimit,
      scan_limit_reached: plan.isAggregated && rawRowCount === plan.rawScanLimit,
    },
  };
}

async function runSqlMode(admin: any, sqlRaw: string, workspaceId: string) {
  // NOTE: SQL mode does NOT execute arbitrary SQL. The user-supplied
  // string is parsed into the deliberately small report DSL and re-issued
  // via the supabase-js builder, which parameter-binds
  // workspace_id. A previous version assembled a `wrapped` raw-SQL
  // string concatenating workspaceId — never executed but an SQL-injection
  // trap for any future exec_sql RPC. Removed in v3.33.1 (B-21).
  const parsed = parseReportSql(sqlRaw);
  let q = admin
    .from(parsed.table)
    .select(parsed.selectFields)
    .eq('workspace_id', workspaceId)
    .limit(parsed.limit ?? 5000);
  if (parsed.orderBy) {
    q = q.order(parsed.orderBy.field, { ascending: parsed.orderBy.dir === 'asc' });
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data as Record<string, any>[]) || [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { rows, columns, meta: { source: parsed.table, count: rows.length, mode: 'sql' } };
}
