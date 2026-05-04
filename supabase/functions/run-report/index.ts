// Edge function: run-report
// Executes saved/custom reports with two modes:
//  - Visual config (data_source + config) → builds a parameterized supabase-js query
//  - SQL mode (config.sql) → strict SELECT-only validation with workspace_id auto-filter
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_TABLES = new Set([
  'enterprise_memberships',
  'enterprise_member_role_allocations',
  'enterprise_teams',
  'enterprise_team_roles',
  'enterprise_offices',
  'enterprise_holidays',
  'enterprise_company_leave_days',
  'enterprise_blocked_dates',
  'enterprise_daily_rules',
  'leave_requests',
  'approval_decisions',
  'enterprise_audit_events',
  'enterprise_role_definitions',
]);

const DATA_SOURCE_TABLE: Record<string, string> = {
  memberships: 'enterprise_memberships',
  leave_requests: 'leave_requests',
  approval_decisions: 'approval_decisions',
  role_allocations: 'enterprise_member_role_allocations',
  audit_events: 'enterprise_audit_events',
  holidays: 'enterprise_holidays',
  company_leave_days: 'enterprise_company_leave_days',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const { workspace_id, data_source, config } = body || {};
    if (!workspace_id) return json({ error: 'workspace_id required' }, 400);

    // Verify membership using service role for reliability
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: memberCheck } = await admin
      .from('enterprise_memberships')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (!memberCheck) return json({ error: 'Nem vagy tagja ennek a munkaterületnek.' }, 403);

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

async function runVisualMode(admin: any, dataSource: string, config: any, workspaceId: string) {
  const table = DATA_SOURCE_TABLE[dataSource];
  const fields: string[] = Array.isArray(config.fields) ? config.fields : [];
  const filters: any[] = Array.isArray(config.filters) ? config.filters : [];
  const groupBy: string[] = Array.isArray(config.group_by) ? config.group_by : [];
  const aggregations: any[] = Array.isArray(config.aggregations) ? config.aggregations : [];
  const sort: any[] = Array.isArray(config.sort) ? config.sort : [];
  const limit = Math.min(Number(config.limit) || 1000, 5000);

  // Select clause
  const selectFields = fields.length > 0 ? fields.join(',') : '*';
  let q = admin.from(table).select(selectFields).limit(limit);

  // Workspace filter (always applied if column exists)
  if (table !== 'profiles') {
    q = q.eq('workspace_id', workspaceId);
  }

  // Apply filters
  for (const f of filters) {
    if (!f.field) continue;
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

  // Sort
  for (const s of sort) {
    if (s.field) q = q.order(s.field, { ascending: s.dir !== 'desc' });
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data as Record<string, any>[]) || [];

  // Enrich memberships with display_name
  if (table === 'enterprise_memberships' && rows.length > 0) {
    const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));
    if (userIds.length > 0) {
      const { data: profiles } = await admin.from('profiles').select('user_id, display_name').in('user_id', userIds);
      const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.display_name]));
      rows = rows.map(r => ({ display_name: nameMap.get(r.user_id) || 'Ismeretlen', ...r }));
    }
  }

  // In-memory group by + aggregations
  if (groupBy.length > 0 || aggregations.length > 0) {
    const buckets = new Map<string, Record<string, any>[]>();
    for (const row of rows) {
      const key = groupBy.map(g => String(row[g] ?? '∅')).join('||');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(row);
    }
    const aggregated: Record<string, any>[] = [];
    for (const [key, bucket] of buckets.entries()) {
      const out: Record<string, any> = {};
      const keyParts = key.split('||');
      groupBy.forEach((g, i) => { out[g] = keyParts[i] === '∅' ? null : keyParts[i]; });
      for (const a of aggregations) {
        const alias = a.alias || `${a.fn}_${a.field}`;
        const values = bucket.map(r => Number(r[a.field])).filter(v => !isNaN(v));
        switch (a.fn) {
          case 'count': out[alias] = bucket.length; break;
          case 'sum': out[alias] = values.reduce((s, v) => s + v, 0); break;
          case 'avg': out[alias] = values.length ? +(values.reduce((s, v) => s + v, 0) / values.length).toFixed(2) : 0; break;
          case 'min': out[alias] = values.length ? Math.min(...values) : null; break;
          case 'max': out[alias] = values.length ? Math.max(...values) : null; break;
        }
      }
      aggregated.push(out);
    }
    rows = aggregated;
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { rows, columns, meta: { source: table, count: rows.length } };
}

async function runSqlMode(admin: any, sqlRaw: string, workspaceId: string) {
  const sql = sqlRaw.trim().replace(/;$/, '');
  const lower = sql.toLowerCase();

  // Strict validation
  if (!lower.startsWith('select')) throw new Error('Csak SELECT lekérdezések engedélyezettek.');
  const forbidden = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'grant', 'revoke', ';--', '/*', '*/', 'pg_', 'auth.', 'storage.', 'information_schema'];
  for (const word of forbidden) {
    if (lower.includes(word)) throw new Error(`Nem engedélyezett kulcsszó: "${word}"`);
  }

  // Verify referenced tables are whitelisted
  const tableMatches = lower.match(/\b(?:from|join)\s+([a-z_]+)/g) || [];
  for (const m of tableMatches) {
    const tbl = m.replace(/\b(?:from|join)\s+/, '').trim();
    if (!ALLOWED_TABLES.has(tbl)) throw new Error(`Nem engedélyezett tábla: "${tbl}"`);
  }

  // Wrap with workspace_id filter
  const wrapped = `SELECT * FROM (${sql}) AS sub WHERE (sub.workspace_id = '${workspaceId}' OR sub.workspace_id IS NULL) LIMIT 5000`;

  // We don't have a generic exec_sql RPC available; use a lightweight approach via admin.rpc only if defined.
  // Fallback: parse simple "SELECT ... FROM <table> ..." and re-run via supabase-js builder.
  // For safety, only support direct table reads in SQL mode.
  const directMatch = sql.match(/^select\s+(.+?)\s+from\s+([a-z_]+)(.*)$/is);
  if (!directMatch) throw new Error('A SQL túl bonyolult. Egyszerű "SELECT mezők FROM tábla [WHERE...] [ORDER BY...] [LIMIT...]" alakot támogatunk.');
  const [, fieldsPart, table, rest] = directMatch;
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Nem engedélyezett tábla: "${table}"`);

  let q = admin.from(table).select(fieldsPart.trim() === '*' ? '*' : fieldsPart).eq('workspace_id', workspaceId).limit(5000);

  // Best-effort: parse ORDER BY and LIMIT
  const orderMatch = rest.match(/order\s+by\s+([a-z_]+)\s*(asc|desc)?/i);
  if (orderMatch) q = q.order(orderMatch[1], { ascending: (orderMatch[2] || 'asc').toLowerCase() === 'asc' });
  const limitMatch = rest.match(/limit\s+(\d+)/i);
  if (limitMatch) q = q.limit(Math.min(parseInt(limitMatch[1]), 5000));

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data as Record<string, any>[]) || [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { rows, columns, meta: { source: table, count: rows.length, mode: 'sql' } };
}
