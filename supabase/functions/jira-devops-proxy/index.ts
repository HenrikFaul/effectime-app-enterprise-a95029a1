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
  const base = jiraBaseUrl(integ.base_url);
  const url = `${base}/rest/api/3/issue/${encodeURIComponent(key)}`;
  const fields: any = {};
  if (payload.summary !== undefined) fields.summary = payload.summary;
  if (payload.labels !== undefined) fields.labels = payload.labels;
  if (payload.assignee_account_id !== undefined) {
    fields.assignee = payload.assignee_account_id ? { accountId: payload.assignee_account_id } : null;
  }
  if (payload.priority !== undefined) {
    fields.priority = payload.priority ? { name: payload.priority } : null;
  }
  if (payload.due_date !== undefined) fields.duedate = payload.due_date || null;
  if (payload.story_points !== undefined) {
    // Jira Cloud commonly stores story points as customfield_10016
    fields.customfield_10016 = payload.story_points;
  }
  if (payload.description !== undefined) {
    fields.description = payload.description
      ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: payload.description }] }] }
      : null;
  }
  if (Object.keys(fields).length > 0) {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: authHeader(integ), 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    if (!r.ok && r.status !== 204) throw new Error(`Jira update ${r.status}: ${(await r.text()).slice(0, 250)}`);
  }

  // Status changes go through the transitions endpoint, not the update endpoint
  if (payload.status_transition_id) {
    const tr = await fetch(`${url}/transitions`, {
      method: 'POST',
      headers: { Authorization: authHeader(integ), 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: { id: String(payload.status_transition_id) } }),
    });
    if (!tr.ok && tr.status !== 204) throw new Error(`Jira transition ${tr.status}: ${(await tr.text()).slice(0, 250)}`);
  }
  return { ok: true };
}

async function jiraGetIssue(integ: IntegrationRow, key: string) {
  const base = jiraBaseUrl(integ.base_url);
  const url = `${base}/rest/api/3/issue/${encodeURIComponent(key)}?fields=*all&expand=names,renderedFields`;
  const r = await fetch(url, { headers: { Authorization: authHeader(integ), Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Jira /issue/${key} ${r.status}: ${(await r.text()).slice(0, 250)}`);
  const i = await r.json();
  const f = i.fields ?? {};
  const description = typeof f.description === 'string' ? f.description : adfToText(f.description);
  return {
    external_key: i.key,
    external_id: i.id,
    summary: f.summary ?? null,
    description: description || '',
    status: f.status?.name ?? null,
    status_id: f.status?.id ?? null,
    assignee_account_id: f.assignee?.accountId ?? null,
    assignee_email: f.assignee?.emailAddress ?? null,
    assignee_name: f.assignee?.displayName ?? null,
    issue_type: f.issuetype?.name ?? null,
    priority: f.priority?.name ?? null,
    labels: f.labels ?? [],
    components: (f.components ?? []).map((c: any) => c.name).filter(Boolean),
    parent_key: f.parent?.key ?? null,
    reporter_email: f.reporter?.emailAddress ?? f.reporter?.name ?? null,
    reporter_name: f.reporter?.displayName ?? null,
    sprint_name: f.customfield_10020?.[0]?.name ?? f.customfield_10007?.[0]?.name ?? null,
    story_points: f.customfield_10016 ?? f.customfield_10026 ?? null,
    due_date: f.duedate ?? null,
    created: f.created ?? null,
    updated: f.updated ?? null,
    url: `${base}/browse/${i.key}`,
  };
}

async function jiraGetTransitions(integ: IntegrationRow, key: string) {
  const base = jiraBaseUrl(integ.base_url);
  const url = `${base}/rest/api/3/issue/${encodeURIComponent(key)}/transitions`;
  const r = await fetch(url, { headers: { Authorization: authHeader(integ), Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Jira transitions ${r.status}: ${(await r.text()).slice(0, 250)}`);
  const data = await r.json();
  return (data.transitions ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    to_status: t.to?.name ?? null,
    to_status_id: t.to?.id ?? null,
  }));
}

async function jiraSearchAssignableUsers(integ: IntegrationRow, key: string, query: string) {
  const base = jiraBaseUrl(integ.base_url);
  const url = `${base}/rest/api/3/user/assignable/search?issueKey=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&maxResults=20`;
  const r = await fetch(url, { headers: { Authorization: authHeader(integ), Accept: 'application/json' } });
  if (!r.ok) return [];
  const data = await r.json();
  return (data ?? []).map((u: any) => ({
    account_id: u.accountId,
    display_name: u.displayName,
    email: u.emailAddress ?? null,
    avatar: u.avatarUrls?.['24x24'] ?? null,
  }));
}


async function jiraSyncProjectConfig(integ: IntegrationRow) {
  if (!integ.project_key) throw new Error('sync_project_config: project_key is required on the integration record');
  const base = jiraBaseUrl(integ.base_url);
  const projectKey = integ.project_key;

  // Strategy: GET /rest/api/3/project/{projectIdOrKey} returns the project with its issueTypes inline.
  // This avoids the previous bug where we passed the project KEY into the projectId query param of
  // /issuetype/project — that endpoint requires the numeric project ID and 500'd silently.
  let issueTypes: any[] = [];
  let projectName: string | null = null;
  try {
    const projRes = await fetch(`${base}/rest/api/3/project/${encodeURIComponent(projectKey)}`, {
      headers: { Authorization: authHeader(integ), Accept: 'application/json' },
    });
    if (projRes.ok) {
      const proj = await projRes.json();
      projectName = proj?.name ?? null;
      issueTypes = Array.isArray(proj?.issueTypes) ? proj.issueTypes : [];
    } else {
      // Fallback: legacy createmeta endpoint (still alive on most Jira Cloud tenants)
      const metaRes = await fetch(
        `${base}/rest/api/3/issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&expand=projects.issuetypes`,
        { headers: { Authorization: authHeader(integ), Accept: 'application/json' } },
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        const proj = (meta?.projects ?? [])[0];
        projectName = proj?.name ?? null;
        issueTypes = Array.isArray(proj?.issuetypes) ? proj.issuetypes : [];
      } else {
        const txt = await metaRes.text();
        throw new Error(`Jira project/${projectKey} ${projRes.status} and createmeta ${metaRes.status}: ${txt.slice(0, 250)}`);
      }
    }
  } catch (e) {
    throw new Error(`Jira project metadata lookup failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const fields = issueTypes.map((it: any) => ({
    field_id: `jira.issuetype.${it.id}`,
    field_name: it.name,
    field_type: 'issuetype',
    is_custom: false,
    schema: { id: it.id, subtask: !!it.subtask, description: it.description ?? null },
  }));

  // Best-effort label/component discovery — never fail the whole sync if search hits a tenant quirk.
  let labels: string[] = [];
  let comps: string[] = [];
  try {
    const labelIssues = await jiraSearch(integ, `project = ${projectKey} ORDER BY updated DESC`, 200);
    labels = Array.from(new Set(labelIssues.flatMap((i: any) => i.labels ?? []))).filter(Boolean).slice(0, 500) as string[];
    comps = Array.from(new Set(labelIssues.flatMap((i: any) => i.components ?? []))).filter(Boolean).slice(0, 500) as string[];
  } catch (e) {
    console.warn('[jira-devops-proxy] label discovery skipped:', e instanceof Error ? e.message : String(e));
  }

  fields.push({ field_id: 'jira.labels', field_name: 'Labels', field_type: 'labels', is_custom: false, schema: { options: labels } });
  fields.push({ field_id: 'jira.components', field_name: 'Components', field_type: 'components', is_custom: false, schema: { options: comps } });
  if (projectName) {
    fields.push({ field_id: 'jira.project_name', field_name: 'Project name', field_type: 'string', is_custom: false, schema: { value: projectName } });
  }
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
  if (payload.summary != null) ops.push({ op: 'add', path: '/fields/System.Title', value: payload.summary });
  if (payload.description != null) ops.push({ op: 'add', path: '/fields/System.Description', value: payload.description });
  if (payload.assignee_email != null) ops.push({ op: 'add', path: '/fields/System.AssignedTo', value: payload.assignee_email });
  if (payload.iteration_path != null) ops.push({ op: 'add', path: '/fields/System.IterationPath', value: payload.iteration_path });
  if (payload.status != null) ops.push({ op: 'add', path: '/fields/System.State', value: payload.status });
  if (payload.priority != null) ops.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: Number(payload.priority) });
  if (payload.story_points != null) ops.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints', value: payload.story_points });
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

// ───── Azure DevOps extended helpers ─────

function flattenIterationPaths(node: any, prefix: string): string[] {
  const name = prefix ? `${prefix}\\${node.name}` : node.name;
  const result: string[] = [name];
  for (const child of node.children ?? []) {
    result.push(...flattenIterationPaths(child, name));
  }
  return result;
}

async function adoSyncProjectConfig(integ: IntegrationRow) {
  const base = adoBase(integ);
  const hdr = { Authorization: authHeader(integ), Accept: 'application/json' };
  const fields: any[] = [];

  // Work item types with their valid states
  const typesRes = await fetch(`${base}/wit/workitemtypes?api-version=7.0`, { headers: hdr });
  if (!typesRes.ok) throw new Error(`ADO workitemtypes ${typesRes.status}: ${(await typesRes.text()).slice(0, 250)}`);
  const typesData = await typesRes.json();
  for (const wit of typesData.value ?? []) {
    const stateNames = (wit.states ?? []).map((s: any) => s.name).filter(Boolean);
    fields.push({
      field_id: `ado.workitemtype.${wit.name}`,
      field_name: wit.name,
      field_type: 'workitemtype',
      is_custom: false,
      schema: { reference_name: wit.referenceName ?? null, states: stateNames, description: wit.description ?? null },
    });
  }

  // Iteration paths via classification nodes
  try {
    const iterRes = await fetch(`${base}/wit/classificationnodes/Iterations?$depth=10&api-version=7.0`, { headers: hdr });
    if (iterRes.ok) {
      const iterData = await iterRes.json();
      const iterPaths = flattenIterationPaths(iterData, '');
      if (iterPaths.length > 0) {
        fields.push({
          field_id: 'ado.iterations',
          field_name: 'Iterations',
          field_type: 'iterations',
          is_custom: false,
          schema: { paths: iterPaths },
        });
      }
    }
  } catch (_) { /* best effort */ }

  // All project fields
  const fieldsRes = await fetch(`${base}/wit/fields?api-version=7.0`, { headers: hdr });
  if (fieldsRes.ok) {
    const fieldsData = await fieldsRes.json();
    for (const f of fieldsData.value ?? []) {
      fields.push({
        field_id: f.referenceName,
        field_name: f.name,
        field_type: f.type ?? null,
        is_custom: !!f.referenceName?.startsWith('Custom.'),
        schema: { usage: f.usage ?? null },
      });
    }
  }

  return fields;
}

async function adoGetIssue(integ: IntegrationRow, id: string) {
  const base = adoBase(integ);
  const url = `${base}/wit/workitems/${encodeURIComponent(id)}?$expand=All&api-version=7.0`;
  const r = await fetch(url, { headers: { Authorization: authHeader(integ), Accept: 'application/json' } });
  if (!r.ok) throw new Error(`ADO workitem/${id} ${r.status}: ${(await r.text()).slice(0, 250)}`);
  const wi = await r.json();
  const f = wi.fields ?? {};
  return {
    external_key: String(wi.id),
    external_id: String(wi.id),
    summary: f['System.Title'] ?? null,
    description: f['System.Description'] ?? '',
    status: f['System.State'] ?? null,
    assignee_email: f['System.AssignedTo']?.uniqueName ?? null,
    assignee_name: f['System.AssignedTo']?.displayName ?? null,
    issue_type: f['System.WorkItemType'] ?? null,
    priority: f['Microsoft.VSTS.Common.Priority'] != null ? String(f['Microsoft.VSTS.Common.Priority']) : null,
    iteration_path: f['System.IterationPath'] ?? null,
    area_path: f['System.AreaPath'] ?? null,
    story_points: f['Microsoft.VSTS.Scheduling.StoryPoints'] ?? null,
    original_estimate_hours: f['Microsoft.VSTS.Scheduling.OriginalEstimate'] ?? null,
    remaining_hours: f['Microsoft.VSTS.Scheduling.RemainingWork'] ?? null,
    parent_id: f['System.Parent'] != null ? String(f['System.Parent']) : null,
    created: f['System.CreatedDate'] ?? null,
    updated: f['System.ChangedDate'] ?? null,
    url: wi._links?.html?.href ?? null,
    tags: f['System.Tags'] ?? null,
  };
}

async function adoGetStates(integ: IntegrationRow, workItemType: string) {
  const base = adoBase(integ);
  const url = `${base}/wit/workitemtypes/${encodeURIComponent(workItemType)}?api-version=7.0`;
  const r = await fetch(url, { headers: { Authorization: authHeader(integ), Accept: 'application/json' } });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.states ?? []).map((s: any) => ({ name: s.name, category: s.stateCategory ?? null }));
}

async function adoSearchIdentities(integ: IntegrationRow, query: string) {
  const orgUrl = integ.base_url.replace(/\/$/, '');
  const hdr = { Authorization: authHeader(integ), Accept: 'application/json' };
  // Try vssps.dev.azure.com identity search
  const vssps = orgUrl.replace('https://dev.azure.com', 'https://vssps.dev.azure.com');
  const filterValue = query || '@';
  try {
    const identUrl = `${vssps}/_apis/identities?searchFilter=General&filterValue=${encodeURIComponent(filterValue)}&queryMembership=None&api-version=7.0`;
    const r = await fetch(identUrl, { headers: hdr });
    if (r.ok) {
      const data = await r.json();
      return (data.value ?? [])
        .filter((u: any) => u.isActive && !u.isContainer)
        .slice(0, 20)
        .map((u: any) => ({
          display_name: u.providerDisplayName ?? u.customDisplayName ?? null,
          email: u.properties?.Mail?.['$value'] ?? u.uniqueName ?? null,
          account_id: u.id ?? null,
        }));
    }
  } catch (_) { /* fall through */ }

  // Fallback: project team members
  try {
    const project = encodeURIComponent(integ.project_key ?? '');
    const tr = await fetch(`${orgUrl}/_apis/projects/${project}/teams?api-version=7.0`, { headers: hdr });
    if (tr.ok) {
      const teamsData = await tr.json();
      const users: any[] = [];
      for (const team of (teamsData.value ?? []).slice(0, 3)) {
        const mr = await fetch(`${orgUrl}/_apis/projects/${project}/teams/${encodeURIComponent(team.id)}/members?api-version=7.0`, { headers: hdr });
        if (mr.ok) {
          const md = await mr.json();
          for (const m of md.value ?? []) {
            users.push({ display_name: m.identity?.displayName ?? null, email: m.identity?.uniqueName ?? null, account_id: m.identity?.id ?? null });
          }
        }
      }
      const q = query.toLowerCase();
      return users
        .filter((u, i, a) => a.findIndex((x: any) => x.email === u.email) === i)
        .filter((u) => !q || u.display_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
        .slice(0, 20);
    }
  } catch (_) { /* ignore */ }

  return [];
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
        const fields = isJira ? await jiraSyncProjectConfig(integ) : await adoSyncProjectConfig(integ);
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
        // Refresh local cache so the UI sees updated values immediately
        if (isJira) {
          try {
            const fresh = await jiraGetIssue(integ, key);
            await admin.from('enterprise_agile_issues').upsert({
              workspace_id: integ.workspace_id,
              integration_id: integ.id,
              provider,
              project_key: integ.project_key,
              external_key: fresh.external_key,
              external_id: fresh.external_id,
              summary: fresh.summary,
              description: fresh.description,
              status: fresh.status,
              assignee_email: fresh.assignee_email,
              assignee_name: fresh.assignee_name,
              issue_type: fresh.issue_type,
              priority: fresh.priority,
              labels: fresh.labels,
              parent_key: fresh.parent_key,
              sprint_name: fresh.sprint_name,
              story_points: fresh.story_points,
              due_date: fresh.due_date,
              external_updated_at: fresh.updated,
              url: fresh.url,
              last_synced_at: new Date().toISOString(),
            } as any, { onConflict: 'integration_id,external_key' as any });
          } catch (e) {
            console.warn('[jira-devops-proxy] cache refresh after update_issue failed:', e instanceof Error ? e.message : String(e));
          }
        } else {
          try {
            const fresh = await adoGetIssue(integ, key);
            await admin.from('enterprise_agile_issues').upsert({
              workspace_id: integ.workspace_id,
              integration_id: integ.id,
              provider,
              project_key: integ.project_key,
              external_key: fresh.external_key,
              external_id: fresh.external_id,
              summary: fresh.summary,
              description: fresh.description,
              status: fresh.status,
              assignee_email: fresh.assignee_email,
              assignee_name: fresh.assignee_name,
              issue_type: fresh.issue_type,
              priority: fresh.priority,
              iteration_path: fresh.iteration_path,
              story_points: fresh.story_points,
              external_updated_at: fresh.updated,
              url: fresh.url,
              last_synced_at: new Date().toISOString(),
            } as any, { onConflict: 'integration_id,external_key' as any });
          } catch (e) {
            console.warn('[jira-devops-proxy] ADO cache refresh after update_issue failed:', e instanceof Error ? e.message : String(e));
          }
        }
        return jsonResponse({ ok: true, updated });
      }
      case 'get_issue': {
        const key = params?.key;
        if (!key) return jsonResponse({ error: 'key/id required' }, 400);
        if (isJira) {
          const [issue, transitions] = await Promise.all([
            jiraGetIssue(integ, key),
            jiraGetTransitions(integ, key).catch(() => []),
          ]);
          await logSync(admin, integ, user.id, 'get_issue', 'success', { key });
          return jsonResponse({ ok: true, issue, transitions });
        }
        const adoIssue = await adoGetIssue(integ, key);
        const adoStates = adoIssue.issue_type
          ? await adoGetStates(integ, adoIssue.issue_type).catch(() => [])
          : [];
        await logSync(admin, integ, user.id, 'get_issue', 'success', { key });
        return jsonResponse({ ok: true, issue: adoIssue, transitions: adoStates });
      }
      case 'get_transitions': {
        const key = params?.key;
        if (!key) return jsonResponse({ error: 'key/id required' }, 400);
        if (isJira) {
          const transitions = await jiraGetTransitions(integ, key);
          return jsonResponse({ ok: true, transitions });
        }
        const wi = await adoGetIssue(integ, key);
        const states = wi.issue_type
          ? await adoGetStates(integ, wi.issue_type).catch(() => [])
          : [];
        return jsonResponse({ ok: true, transitions: states });
      }
      case 'search_assignable_users': {
        const key = params?.key;
        const query = (params?.query ?? '').toString();
        if (!key) return jsonResponse({ error: 'key/id required' }, 400);
        const users = isJira
          ? await jiraSearchAssignableUsers(integ, key, query)
          : await adoSearchIdentities(integ, query);
        return jsonResponse({ ok: true, users });
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
