// Jira / Azure DevOps unified proxy.
// Actions: test_connection | discover_fields | search_issues | create_issue | update_issue
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface IntegrationRow {
  id: string;
  workspace_id: string;
  provider: 'jira' | 'azure_devops';
  base_url: string;
  account_email: string | null;
  api_token: string;
  project_key: string | null;
  default_issue_type: string | null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}


function jiraBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  return trimmed.replace(/\/rest\/api\/[0-9]+.*$/i, '');
}

function authHeader(integ: IntegrationRow): string {
  if (integ.provider === 'jira') {
    const basic = btoa(`${integ.account_email ?? ''}:${integ.api_token}`);
    return `Basic ${basic}`;
  }
  // Azure DevOps PAT
  const basic = btoa(`:${integ.api_token}`);
  return `Basic ${basic}`;
}

async function logSync(
  supa: any,
  integ: IntegrationRow,
  userId: string | null,
  event: string,
  status: string,
  details: Record<string, unknown> = {},
  error?: string,
) {
  try {
    await supa.from('enterprise_agile_sync_log').insert({
      workspace_id: integ.workspace_id,
      integration_id: integ.id,
      event,
      status,
      details,
      error_message: error ?? null,
      triggered_by: userId,
    });
  } catch (_) { /* best effort */ }
}

// ───── Jira helpers ─────
async function jiraTest(integ: IntegrationRow) {
  const url = `${jiraBaseUrl(integ.base_url)}/rest/api/3/myself`;
  const r = await fetch(url, { headers: { Authorization: authHeader(integ), Accept: 'application/json' } });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Jira /myself ${r.status}: ${txt.slice(0, 250)}`);
  return JSON.parse(txt);
}

async function jiraDiscoverFields(integ: IntegrationRow) {
  const url = `${jiraBaseUrl(integ.base_url)}/rest/api/3/field`;
  const r = await fetch(url, { headers: { Authorization: authHeader(integ), Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Jira /field ${r.status}`);
  const data = await r.json();
  return (data as any[]).map((f) => ({
    field_id: f.id,
    field_name: f.name,
    field_type: f.schema?.type ?? null,
    is_custom: !!f.custom,
    schema: f.schema ?? null,
  }));
}

// Recursively flatten Atlassian Document Format → plain text
function adfToText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join('');
  let out = '';
  if (node.type === 'text' && typeof node.text === 'string') out += node.text;
  if (Array.isArray(node.content)) out += node.content.map(adfToText).join('');
  if (node.type === 'paragraph' || node.type === 'heading') out += '\n';
  return out;
}

async function jiraSearch(integ: IntegrationRow, jql: string, maxResults = 50) {
  const base = jiraBaseUrl(integ.base_url);
  const query = jql || `project = "${integ.project_key ?? ''}" ORDER BY updated DESC`;
  // Request *all* navigable fields so we receive description, team, start date, sprint, etc.
  const fields = ['*all'];
  const requestBody = {
    jql: query,
    maxResults,
    fields,
  };

  // Primary: new Jira endpoint POST /rest/api/3/search/jql
  let r = await fetch(`${base}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(integ),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  // Fallback: GET /rest/api/3/search/jql
  if (!r.ok && (r.status === 400 || r.status === 404 || r.status === 405)) {
    const qs = new URLSearchParams({
      jql: query,
      maxResults: String(maxResults),
      fields: '*all',
    });
    r = await fetch(`${base}/rest/api/3/search/jql?${qs.toString()}`, {
      method: 'GET',
      headers: { Authorization: authHeader(integ), Accept: 'application/json' },
    });
  }

  // Last resort: legacy /rest/api/3/search (still alive on some tenants)
  if (!r.ok && (r.status === 400 || r.status === 404 || r.status === 405 || r.status === 410)) {
    const qs = new URLSearchParams({
      jql: query,
      maxResults: String(maxResults),
      fields: '*all',
    });
    r = await fetch(`${base}/rest/api/3/search?${qs.toString()}`, {
      method: 'GET',
      headers: { Authorization: authHeader(integ), Accept: 'application/json' },
    });
  }

  if (!r.ok) throw new Error(`Jira search failed ${r.status}: ${(await r.text()).slice(0, 350)}`);
  const data = await r.json();
  return (data.issues ?? []).map((i: any) => {
    const f = i.fields ?? {};
    // Sprint may live on a few common custom-field IDs
    const sprintArr =
      f.sprint ? [f.sprint] :
      f.customfield_10020 ?? f.customfield_10007 ?? f.customfield_10010 ?? null;
    const sprintName = Array.isArray(sprintArr) && sprintArr.length
      ? (sprintArr[sprintArr.length - 1]?.name ?? null)
      : (sprintArr?.name ?? null);
    // Team field: customfield_10001 commonly, or "team"
    const teamRaw = f.team ?? f.customfield_10001 ?? null;
    const teamName = typeof teamRaw === 'string'
      ? teamRaw
      : teamRaw?.name ?? teamRaw?.displayName ?? teamRaw?.value ?? null;
    // Start date: customfield_10015 commonly
    const startDate = f.customfield_10015 ?? f.startdate ?? null;
    // Story points commonly customfield_10016 or 10026
    const storyPoints = f.customfield_10016 ?? f.customfield_10026 ?? null;
    // Description: ADF object → plain text
    const description = typeof f.description === 'string'
      ? f.description
      : adfToText(f.description);

    return {
      external_key: i.key,
      external_id: i.id,
      summary: f.summary ?? null,
      description: description || null,
      status: f.status?.name ?? null,
      assignee_email: f.assignee?.emailAddress ?? null,
      assignee_name: f.assignee?.displayName ?? null,
      issue_type: f.issuetype?.name ?? null,
      priority: f.priority?.name ?? null,
      labels: f.labels ?? [],
      components: (f.components ?? []).map((c: any) => c.name).filter(Boolean),
      parent_key: f.parent?.key ?? null,
      reporter_email: f.reporter?.emailAddress ?? f.reporter?.name ?? null,
      sprint_name: sprintName,
      team_name: teamName,
      start_date: startDate,
      story_points: storyPoints,
      original_estimate_hours: f.timetracking?.originalEstimateSeconds ? Number(f.timetracking.originalEstimateSeconds) / 3600 : null,
      remaining_hours: f.timetracking?.remainingEstimateSeconds ? Number(f.timetracking.remainingEstimateSeconds) / 3600 : null,
      completed_hours: f.timetracking?.timeSpentSeconds ? Number(f.timetracking.timeSpentSeconds) / 3600 : null,
      external_updated_at: f.updated ?? null,
      custom_fields: f ?? null,
      due_date: f.duedate ?? null,
      url: `${jiraBaseUrl(integ.base_url)}/browse/${i.key}`,
      raw: i,
    };
  });
}

async function jiraCreate(integ: IntegrationRow, payload: any) {
  const url = `${jiraBaseUrl(integ.base_url)}/rest/api/3/issue`;
  const body = {
    fields: {
      project: { key: payload.project_key ?? integ.project_key },
      summary: payload.summary,
      issuetype: { name: payload.issue_type ?? integ.default_issue_type ?? 'Task' },
      ...(payload.assignee_account_id ? { assignee: { accountId: payload.assignee_account_id } } : {}),
      ...(payload.labels ? { labels: payload.labels } : {}),
      ...(payload.description
        ? {
          description: {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: payload.description }] }],
          },
        }
        : {}),
    },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader(integ), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Jira create ${r.status}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt);
}

async function jiraUpdate(integ: IntegrationRow, key: string, payload: any) {
  const url = `${jiraBaseUrl(integ.base_url)}/rest/api/3/issue/${encodeURIComponent(key)}`;
  const fields: any = {};
  if (payload.summary) fields.summary = payload.summary;
  if (payload.labels) fields.labels = payload.labels;
  if (payload.assignee_account_id) fields.assignee = { accountId: payload.assignee_account_id };
  const r = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: authHeader(integ), 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok && r.status !== 204) throw new Error(`Jira update ${r.status}: ${(await r.text()).slice(0, 250)}`);
  return { ok: true };
}


async function jiraSyncProjectConfig(integ: IntegrationRow) {
  if (!integ.project_key) throw new Error('sync_project_config: project_key is required on the integration record');
  const base = jiraBaseUrl(integ.base_url);
  const projectKey = integ.project_key;
  const issueTypes = await fetch(`${base}/rest/api/3/issuetype/project?projectId=${encodeURIComponent(projectKey)}`, {
    headers: { Authorization: authHeader(integ), Accept: 'application/json' },
  }).then(async (r) => {
    if (!r.ok) throw new Error(`Jira issuetype/project ${r.status}: ${(await r.text()).slice(0, 250)}`);
    return r.json();
  });

  const fields = (issueTypes.values ?? issueTypes ?? []).map((it: any) => ({
    field_id: `jira.issuetype.${it.id}`,
    field_name: it.name,
    field_type: 'issuetype',
    is_custom: false,
    schema: { id: it.id, subtask: !!it.subtask, description: it.description ?? null },
  }));

  const labelIssues = await jiraSearch(integ, `project = ${projectKey} ORDER BY updated DESC`, 200);
  const labels = Array.from(new Set(labelIssues.flatMap((i: any) => i.labels ?? []))).filter(Boolean).slice(0, 500);
  const comps = Array.from(new Set(labelIssues.flatMap((i: any) => i.components ?? []))).filter(Boolean).slice(0, 500);

  fields.push({ field_id: 'jira.labels', field_name: 'Labels', field_type: 'labels', is_custom: false, schema: { options: labels } });
  fields.push({ field_id: 'jira.components', field_name: 'Components', field_type: 'components', is_custom: false, schema: { options: comps } });
  return fields;
}

// ───── Azure DevOps helpers ─────
function adoBase(integ: IntegrationRow) {
  // base_url like https://dev.azure.com/yourorg
  const project = integ.project_key ?? '';
  return `${integ.base_url.replace(/\/$/, '')}/${encodeURIComponent(project)}/_apis`;
}

async function adoTest(integ: IntegrationRow) {
  const url = `${integ.base_url.replace(/\/$/, '')}/_apis/projects?api-version=7.0`;
  const r = await fetch(url, { headers: { Authorization: authHeader(integ), Accept: 'application/json' } });
  if (!r.ok) throw new Error(`ADO /projects ${r.status}: ${(await r.text()).slice(0, 250)}`);
  return await r.json();
}

async function adoDiscoverFields(integ: IntegrationRow) {
  const url = `${adoBase(integ)}/wit/fields?api-version=7.0`;
  const r = await fetch(url, { headers: { Authorization: authHeader(integ), Accept: 'application/json' } });
  if (!r.ok) throw new Error(`ADO /fields ${r.status}`);
  const data = await r.json();
  return (data.value ?? []).map((f: any) => ({
    field_id: f.referenceName,
    field_name: f.name,
    field_type: f.type ?? null,
    is_custom: !!f.referenceName?.startsWith('Custom.'),
    schema: { usage: f.usage ?? null },
  }));
}

async function adoSearch(integ: IntegrationRow, wiql: string, top = 50) {
  // 1. Run WIQL to get IDs
  const wiqlUrl = `${adoBase(integ)}/wit/wiql?api-version=7.0`;
  const wiqlBody = {
    query:
      wiql ||
      `Select [System.Id], [System.Title] From WorkItems Where [System.TeamProject] = '${integ.project_key}' Order By [System.ChangedDate] Desc`,
  };
  const wr = await fetch(wiqlUrl, {
    method: 'POST',
    headers: { Authorization: authHeader(integ), 'Content-Type': 'application/json' },
    body: JSON.stringify(wiqlBody),
  });
  if (!wr.ok) throw new Error(`ADO WIQL ${wr.status}: ${(await wr.text()).slice(0, 250)}`);
  const wq = await wr.json();
  const ids = (wq.workItems ?? []).slice(0, top).map((w: any) => w.id);
  if (ids.length === 0) return [];

  const detailUrl = `${adoBase(integ)}/wit/workitems?ids=${ids.join(',')}&$expand=Fields&api-version=7.0`;
  const dr = await fetch(detailUrl, { headers: { Authorization: authHeader(integ), Accept: 'application/json' } });
  if (!dr.ok) throw new Error(`ADO workitems ${dr.status}`);
  const dd = await dr.json();
  return (dd.value ?? []).map((wi: any) => ({
    external_key: String(wi.id),
    external_id: String(wi.id),
    summary: wi.fields?.['System.Title'] ?? null,
    status: wi.fields?.['System.State'] ?? null,
    assignee_email: wi.fields?.['System.AssignedTo']?.uniqueName ?? null,
    assignee_name: wi.fields?.['System.AssignedTo']?.displayName ?? null,
    issue_type: wi.fields?.['System.WorkItemType'] ?? null,
    priority: wi.fields?.['Microsoft.VSTS.Common.Priority']?.toString() ?? null,
    iteration_path: wi.fields?.['System.IterationPath'] ?? null,
    story_points: wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] ?? null,
    original_estimate_hours: wi.fields?.['Microsoft.VSTS.Scheduling.OriginalEstimate'] ?? null,
    remaining_hours: wi.fields?.['Microsoft.VSTS.Scheduling.RemainingWork'] ?? null,
    completed_hours: wi.fields?.['Microsoft.VSTS.Scheduling.CompletedWork'] ?? null,
    url: wi._links?.html?.href ?? null,
    raw: wi,
  }));
}

async function adoCreate(integ: IntegrationRow, payload: any) {
  const type = encodeURIComponent(payload.issue_type ?? integ.default_issue_type ?? 'Task');
  const url = `${adoBase(integ)}/wit/workitems/$${type}?api-version=7.0`;
  const ops: any[] = [
    { op: 'add', path: '/fields/System.Title', value: payload.summary },
  ];
  if (payload.description) ops.push({ op: 'add', path: '/fields/System.Description', value: payload.description });
  if (payload.assignee_email) ops.push({ op: 'add', path: '/fields/System.AssignedTo', value: payload.assignee_email });
  if (payload.iteration_path) ops.push({ op: 'add', path: '/fields/System.IterationPath', value: payload.iteration_path });
  if (typeof payload.original_estimate_hours === 'number')
    ops.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.OriginalEstimate', value: payload.original_estimate_hours });

  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader(integ), 'Content-Type': 'application/json-patch+json' },
    body: JSON.stringify(ops),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`ADO create ${r.status}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt);
}

async function adoUpdate(integ: IntegrationRow, id: string, payload: any) {
  const ops: any[] = [];
  if (payload.summary) ops.push({ op: 'add', path: '/fields/System.Title', value: payload.summary });
  if (payload.assignee_email) ops.push({ op: 'add', path: '/fields/System.AssignedTo', value: payload.assignee_email });
  if (payload.iteration_path) ops.push({ op: 'add', path: '/fields/System.IterationPath', value: payload.iteration_path });
  if (payload.status) ops.push({ op: 'add', path: '/fields/System.State', value: payload.status });
  if (ops.length === 0) throw new Error('ADO update: no updatable fields provided in payload');
  const url = `${adoBase(integ)}/wit/workitems/${encodeURIComponent(id)}?api-version=7.0`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: authHeader(integ), 'Content-Type': 'application/json-patch+json' },
    body: JSON.stringify(ops),
  });
  if (!r.ok) throw new Error(`ADO update ${r.status}: ${(await r.text()).slice(0, 250)}`);
  return await r.json();
}

// ───── Main ─────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authz = req.headers.get('Authorization') ?? '';
    if (!authz) return jsonResponse({ error: 'Missing Authorization' }, 401);

    // user-scoped client to validate caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authz } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const { action, integration_id, params } = body as {
      action: string; integration_id: string; params?: any;
    };
    if (!action || !integration_id) return jsonResponse({ error: 'action és integration_id kötelező' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // load integration
    const { data: integ, error: integErr } = await admin
      .from('enterprise_workspace_integrations')
      .select('id,workspace_id,provider,base_url,account_email,api_token,project_key,default_issue_type')
      .eq('id', integration_id)
      .maybeSingle();
    if (integErr || !integ) return jsonResponse({ error: 'Integráció nem található' }, 404);

    // membership check
    const { data: member } = await admin
      .from('enterprise_memberships')
      .select('id,role,status')
      .eq('workspace_id', integ.workspace_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!member) return jsonResponse({ error: 'Nincs jogosultság ehhez a munkaterülethez' }, 403);

    const provider = integ.provider as 'jira' | 'azure_devops';
    const isJira = provider === 'jira';

    let result: any;
    switch (action) {
      case 'test_connection': {
        result = isJira ? await jiraTest(integ) : await adoTest(integ);
        await logSync(admin, integ, user.id, 'test_connection', 'success');
        return jsonResponse({ ok: true, provider, sample: result });
      }
      case 'discover_fields': {
        const fields = isJira ? await jiraDiscoverFields(integ) : await adoDiscoverFields(integ);
        // upsert into metadata table
        if (fields.length) {
          await admin.from('enterprise_agile_field_metadata').delete()
            .eq('integration_id', integ.id);
          await admin.from('enterprise_agile_field_metadata').insert(
            fields.map((f: any) => ({
              workspace_id: integ.workspace_id,
              integration_id: integ.id,
              provider,
              project_key: integ.project_key,
              ...f,
            })),
          );
        }
        await logSync(admin, integ, user.id, 'discover_fields', 'success', { count: fields.length });
        return jsonResponse({ ok: true, count: fields.length, fields });
      }
      case 'sync_project_config': {
        const fields = isJira ? await jiraSyncProjectConfig(integ) : await adoDiscoverFields(integ);
        await admin.from('enterprise_agile_field_metadata').delete().eq('integration_id', integ.id);
        if (fields.length) {
          await admin.from('enterprise_agile_field_metadata').insert(fields.map((f: any) => ({
            workspace_id: integ.workspace_id, integration_id: integ.id, provider, project_key: integ.project_key, ...f,
          })));
        }
        await logSync(admin, integ, user.id, 'sync_project_config', 'success', { count: fields.length });
        return jsonResponse({ ok: true, count: fields.length, fields });
      }
      case 'search_issues': {
        const query = params?.query ?? '';
        const max = Math.min(Number(params?.max ?? 50), 200);
        const issues = isJira ? await jiraSearch(integ, query, max) : await adoSearch(integ, query, max);
        // cache last batch
        if (issues.length) {
          await admin.from('enterprise_agile_issues').upsert(
            issues.map((i: any) => ({
              workspace_id: integ.workspace_id,
              integration_id: integ.id,
              provider,
              project_key: integ.project_key,
              last_synced_at: new Date().toISOString(),
              ...i,
            })),
            { onConflict: 'integration_id,external_key' as any },
          );
        }
        await logSync(admin, integ, user.id, 'search_issues', 'success', { count: issues.length });
        return jsonResponse({ ok: true, count: issues.length, issues });
      }
      case 'create_issue': {
        const created = isJira ? await jiraCreate(integ, params) : await adoCreate(integ, params);
        await logSync(admin, integ, user.id, 'create_issue', 'success', { key: created.key ?? created.id });
        return jsonResponse({ ok: true, created });
      }
      case 'update_issue': {
        const key = params?.key;
        if (!key) return jsonResponse({ error: 'key/id kötelező' }, 400);
        const updated = isJira ? await jiraUpdate(integ, key, params) : await adoUpdate(integ, key, params);
        await logSync(admin, integ, user.id, 'update_issue', 'success', { key });
        return jsonResponse({ ok: true, updated });
      }
      default:
        return jsonResponse({ error: `Ismeretlen action: ${action}` }, 400);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[jira-devops-proxy] error:', msg);
    // best-effort log if we have integration context
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const body = await req.clone().json().catch(() => ({}));
      if (body?.integration_id) {
        await admin.from('enterprise_agile_sync_log').insert({
          workspace_id: '00000000-0000-0000-0000-000000000000',
          integration_id: body.integration_id,
          event: body.action ?? 'unknown',
          status: 'error',
          error_message: msg,
        });
      }
    } catch (_) { /* ignore */ }
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
