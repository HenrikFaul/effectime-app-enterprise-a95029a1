// @ts-nocheck
// Supabase Edge Function: import-entity-data
// Handles bulk import for the Import/Export Center across multiple entities.
// Validates workspace membership + admin role, resolves references, and writes
// data with row-level error reporting and audit logging.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ImportRequest {
  workspace_id: string;
  entity: string;
  mode: 'create' | 'upsert';
  rows: Record<string, any>[];
  dry_run?: boolean;
}

interface RowError {
  row_index: number;
  field: string;
  value: string;
  code: string;
  message: string;
}

interface Summary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

const SUPPORTED_ENTITIES = ['members', 'leave', 'offices', 'work_categories', 'job_roles', 'skills'];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // User-context client (for auth check + RLS)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    // Service client for writes that need elevated privilege (e.g. profile lookups)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body: ImportRequest = await req.json();
    const { workspace_id, entity, mode, rows, dry_run } = body;

    if (!workspace_id || !entity || !Array.isArray(rows)) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }
    if (!SUPPORTED_ENTITIES.includes(entity)) {
      return jsonResponse({ error: `Unsupported entity: ${entity}` }, 400);
    }

    // Authorization check: owner or resourceAssistant
    const { data: hasRole } = await serviceClient.rpc('has_enterprise_role', {
      p_workspace_id: workspace_id,
      p_user_id: user.id,
      p_roles: ['owner', 'resourceAssistant'],
    });
    if (!hasRole) return jsonResponse({ error: 'Forbidden: admin role required' }, 403);

    // Audit: import.started
    if (!dry_run) {
      await serviceClient.from('enterprise_audit_events').insert({
        workspace_id,
        actor_id: user.id,
        action: 'import.started',
        metadata: { entity, mode, row_count: rows.length },
      });
    }

    let summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
    let errors: RowError[] = [];

    switch (entity) {
      case 'members':
        ({ summary, errors } = await importMembers(serviceClient, workspace_id, mode, rows, dry_run, user.id));
        break;
      case 'leave':
        ({ summary, errors } = await importLeave(serviceClient, workspace_id, mode, rows, dry_run));
        break;
      case 'offices':
        ({ summary, errors } = await importOffices(serviceClient, workspace_id, mode, rows, dry_run));
        break;
      case 'work_categories':
        ({ summary, errors } = await importWorkCategories(serviceClient, workspace_id, mode, rows, dry_run));
        break;
      case 'job_roles':
        ({ summary, errors } = await importJobRoles(serviceClient, workspace_id, mode, rows, dry_run));
        break;
      case 'skills':
        ({ summary, errors } = await importSkills(serviceClient, workspace_id, mode, rows, dry_run));
        break;
    }

    if (!dry_run) {
      await serviceClient.from('enterprise_audit_events').insert({
        workspace_id,
        actor_id: user.id,
        action: errors.length > 0 ? 'import.completed_with_errors' : 'import.completed',
        metadata: { entity, mode, ...summary, error_count: errors.length },
      });
    }

    return jsonResponse({ success: true, summary, errors });
  } catch (e: any) {
    console.error('import-entity-data fatal:', e);
    return jsonResponse({ error: e?.message || 'Internal error' }, 500);
  }
});

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ===== Members =====

async function importMembers(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined, actorId: string) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  // Pre-fetch existing data for resolution
  const { data: offices } = await client.from('enterprise_offices').select('id, name').eq('workspace_id', workspaceId);
  const officeByName = new Map((offices || []).map((o: any) => [o.name.toLowerCase(), o.id]));

  const { data: existingMemberships } = await client.from('enterprise_memberships').select('id, user_id').eq('workspace_id', workspaceId);
  const existingUserIds = new Set((existingMemberships || []).map((m: any) => m.user_id));
  const membershipByUser = new Map((existingMemberships || []).map((m: any) => [m.user_id, m.id]));

  // Map emails → user_ids
  const emails = rows.map(r => r.email).filter(Boolean);
  const { data: profiles } = await client.from('profiles').select('user_id, email').in('email', emails);
  const userIdByEmail = new Map((profiles || []).map((p: any) => [p.email.toLowerCase(), p.user_id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const email = String(r.email || '').toLowerCase();
    if (!email) {
      errors.push({ row_index: i, field: 'email', value: '', code: 'REQUIRED_EMPTY', message: 'Email kötelező' });
      summary.failed++;
      continue;
    }

    const userId = userIdByEmail.get(email);
    const officeId = r.office_name ? officeByName.get(String(r.office_name).toLowerCase()) : null;

    // Resolve office_name
    if (r.office_name && !officeId) {
      // Warning, set to null but proceed
    }

    if (!userId) {
      // Create invitation (existing pattern)
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_invitations').insert({
        workspace_id: workspaceId,
        email,
        role: r.role || 'member',
        invited_by: actorId,
      });
      if (error) {
        if (error.code === '23505') { summary.skipped++; }
        else {
          errors.push({ row_index: i, field: 'email', value: email, code: 'DB_ERROR', message: error.message });
          summary.failed++;
        }
      } else summary.created++;
      continue;
    }

    // User exists. Check if they have a membership in this workspace.
    if (existingUserIds.has(userId)) {
      // Member exists. In create mode, skip. In upsert, update.
      if (mode === 'create') {
        summary.skipped++;
        continue;
      }
      if (dryRun) { summary.updated++; continue; }
      const updateFields: any = {};
      if (r.role) updateFields.role = r.role;
      if (r.team !== undefined) updateFields.team = r.team || null;
      if (r.business_role !== undefined) updateFields.business_role = r.business_role || null;
      if (r.location !== undefined) updateFields.location = r.location || null;
      if (officeId !== undefined) updateFields.office_id = officeId || null;
      if (r.city !== undefined) updateFields.city = r.city || null;
      if (r.base_working_hours != null && r.base_working_hours !== '') updateFields.base_working_hours = Number(r.base_working_hours);
      if (r.joined_at) updateFields.joined_at = r.joined_at;
      if (r.status) updateFields.status = r.status;

      const { error } = await client.from('enterprise_memberships').update(updateFields).eq('id', membershipByUser.get(userId));
      if (error) {
        errors.push({ row_index: i, field: 'general', value: email, code: 'DB_ERROR', message: error.message });
        summary.failed++;
      } else summary.updated++;
    } else {
      // User exists in profiles but no membership in this workspace — create membership directly
      if (dryRun) { summary.created++; continue; }
      const insertFields: any = {
        workspace_id: workspaceId,
        user_id: userId,
        role: r.role || 'member',
        status: r.status || 'active',
        team: r.team || null,
        business_role: r.business_role || null,
        location: r.location || null,
        office_id: officeId || null,
        city: r.city || null,
        joined_at: r.joined_at || null,
      };
      if (r.base_working_hours != null && r.base_working_hours !== '') insertFields.base_working_hours = Number(r.base_working_hours);
      const { error } = await client.from('enterprise_memberships').insert(insertFields);
      if (error) {
        errors.push({ row_index: i, field: 'general', value: email, code: 'DB_ERROR', message: error.message });
        summary.failed++;
      } else summary.created++;
    }
  }

  return { summary, errors };
}

// ===== Leave =====

async function importLeave(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const emails = rows.map(r => r.email).filter(Boolean);
  const { data: profiles } = await client.from('profiles').select('user_id, email').in('email', emails);
  const userIdByEmail = new Map((profiles || []).map((p: any) => [p.email.toLowerCase(), p.user_id]));

  // Pre-fetch existing for duplicate detection
  const { data: existing } = await client.from('leave_requests').select('user_id, start_date, end_date, leave_type').eq('workspace_id', workspaceId);
  const existingKeys = new Set((existing || []).map((e: any) => `${e.user_id}||${e.start_date}||${e.end_date}||${e.leave_type}`));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const email = String(r.email || '').toLowerCase();
    const userId = userIdByEmail.get(email);
    if (!userId) {
      errors.push({ row_index: i, field: 'email', value: email, code: 'REFERENCE_NOT_FOUND', message: `Tag nem található: ${email}` });
      summary.failed++;
      continue;
    }
    const key = `${userId}||${r.start_date}||${r.end_date}||${r.leave_type}`;
    if (existingKeys.has(key)) {
      summary.skipped++;
      continue;
    }
    if (dryRun) { summary.created++; continue; }

    const { error } = await client.from('leave_requests').insert({
      workspace_id: workspaceId,
      user_id: userId,
      leave_type: r.leave_type,
      start_date: r.start_date,
      end_date: r.end_date,
      status: r.status || 'approved',
      comment: r.comment || null,
      is_half_day: r.is_half_day === true || r.is_half_day === 'true',
      half_day_period: r.half_day_period || null,
    });
    if (error) {
      errors.push({ row_index: i, field: 'general', value: email, code: 'DB_ERROR', message: error.message });
      summary.failed++;
    } else summary.created++;
  }

  return { summary, errors };
}

// ===== Offices =====

async function importOffices(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: existing } = await client.from('enterprise_offices').select('id, name').eq('workspace_id', workspaceId);
  const idByName = new Map((existing || []).map((o: any) => [o.name.toLowerCase(), o.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name || '').trim();
    if (!name) { errors.push({ row_index: i, field: 'name', value: '', code: 'REQUIRED_EMPTY', message: 'Név kötelező' }); summary.failed++; continue; }
    const existingId = idByName.get(name.toLowerCase());
    if (existingId) {
      if (mode === 'create') { summary.skipped++; continue; }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client.from('enterprise_offices').update({ city: r.city || null, address: r.address || null }).eq('id', existingId);
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.updated++;
    } else {
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_offices').insert({ workspace_id: workspaceId, name, city: r.city || null, address: r.address || null });
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.created++;
    }
  }
  return { summary, errors };
}

// ===== Work Categories =====

async function importWorkCategories(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: existing } = await client.from('enterprise_workspace_role_categories').select('id, name').eq('workspace_id', workspaceId);
  const idByName = new Map((existing || []).map((c: any) => [c.name.toLowerCase(), c.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name || '').trim();
    if (!name) { errors.push({ row_index: i, field: 'name', value: '', code: 'REQUIRED_EMPTY', message: 'Név kötelező' }); summary.failed++; continue; }
    const existingId = idByName.get(name.toLowerCase());
    const isActive = r.is_active === true || r.is_active === 'true' || r.is_active === undefined;
    if (existingId) {
      if (mode === 'create') { summary.skipped++; continue; }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client.from('enterprise_workspace_role_categories').update({ is_active: isActive }).eq('id', existingId);
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.updated++;
    } else {
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_workspace_role_categories').insert({ workspace_id: workspaceId, name, is_active: isActive });
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.created++;
    }
  }
  return { summary, errors };
}

// ===== Job Roles =====

async function importJobRoles(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: cats } = await client.from('enterprise_workspace_role_categories').select('id, name').eq('workspace_id', workspaceId);
  const catIdByName = new Map((cats || []).map((c: any) => [c.name.toLowerCase(), c.id]));

  const { data: existing } = await client.from('enterprise_workspace_roles').select('id, name, category_id').eq('workspace_id', workspaceId);
  const existingByKey = new Map((existing || []).map((r: any) => [`${r.category_id}||${r.name.toLowerCase()}`, r.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name || '').trim();
    const catName = String(r.category_name || '').trim();
    if (!name || !catName) { errors.push({ row_index: i, field: 'name', value: name, code: 'REQUIRED_EMPTY', message: 'Név és kategória kötelező' }); summary.failed++; continue; }
    const catId = catIdByName.get(catName.toLowerCase());
    if (!catId) { errors.push({ row_index: i, field: 'category_name', value: catName, code: 'REFERENCE_NOT_FOUND', message: `Kategória nem található: ${catName}` }); summary.failed++; continue; }

    const key = `${catId}||${name.toLowerCase()}`;
    const existingId = existingByKey.get(key);
    const isActive = r.is_active === true || r.is_active === 'true' || r.is_active === undefined;
    if (existingId) {
      if (mode === 'create') { summary.skipped++; continue; }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client.from('enterprise_workspace_roles').update({ is_active: isActive }).eq('id', existingId);
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.updated++;
    } else {
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_workspace_roles').insert({ workspace_id: workspaceId, name, category_id: catId, is_active: isActive });
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.created++;
    }
  }
  return { summary, errors };
}

// ===== Skills =====

async function importSkills(client: any, workspaceId: string, mode: string, rows: any[], dryRun: boolean | undefined) {
  const summary: Summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 };
  const errors: RowError[] = [];

  const { data: existing } = await client.from('enterprise_skills').select('id, name').eq('workspace_id', workspaceId);
  const idByName = new Map((existing || []).map((s: any) => [s.name.toLowerCase(), s.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r.name || '').trim();
    if (!name) { errors.push({ row_index: i, field: 'name', value: '', code: 'REQUIRED_EMPTY', message: 'Név kötelező' }); summary.failed++; continue; }
    const existingId = idByName.get(name.toLowerCase());
    if (existingId) {
      if (mode === 'create') { summary.skipped++; continue; }
      if (dryRun) { summary.updated++; continue; }
      const { error } = await client.from('enterprise_skills').update({ category: r.category || null, color: r.color || '#6366f1' }).eq('id', existingId);
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.updated++;
    } else {
      if (dryRun) { summary.created++; continue; }
      const { error } = await client.from('enterprise_skills').insert({ workspace_id: workspaceId, name, category: r.category || null, color: r.color || '#6366f1' });
      if (error) { errors.push({ row_index: i, field: 'general', value: name, code: 'DB_ERROR', message: error.message }); summary.failed++; }
      else summary.created++;
    }
  }
  return { summary, errors };
}
