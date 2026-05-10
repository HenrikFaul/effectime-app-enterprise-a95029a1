// Demo Workspace Seeder — Comprehensive Edition
// ------------------------------------------------
// Creates a fully populated demo workspace for the calling user.
// Seeds EVERY entity type the application supports so every tab/section
// has real data on first visit.
//
// Cleanup: `cleanup-demo-workspace` deletes the workspace (all workspace-scoped
// data cascades via FK) and then removes the demo auth.users stored in
// enterprise_workspaces.settings.demo_user_ids.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import {
  DEMO_PERSONAS, SKILL_NAMES, SKILL_COLORS, OFFICE_DEFS, TEAM_DEFS,
  LEAVE_TYPE_DEFS, HU_HOLIDAYS_TEMPLATE, PROJECT_DEFS, NOTIFICATION_EVENT_TYPES,
  ROLE_DEFINITION_DEFS, ROLE_PERMISSION_DEFS, MEMBER_TEMPLATE_DEFS,
  TRANSLATION_OVERRIDE_DEFS, INTEGRATION_DEF, AGILE_ISSUE_DEFS, AGILE_FIELD_METADATA_DEFS,
  DAILY_RULE_DEFS, OFFICE_COVERAGE_RULE_DEFS, RULE_TEMPLATE_DEFS,
  APPROVAL_CHAIN_DEFS, DEFAULT_SEED_QUANTITIES,
  JOB_FAMILY_DEFS, LEADERSHIP_LEVEL_DEFS, CONTRACT_TYPE_DEFS,
  INDUSTRY_DEFS, WORK_CATEGORY_DEFS, PERSONA_ORG_ASSIGNMENTS,
} from './seed-data.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fmtDate(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(d: Date, days: number): Date {
  const r = new Date(d); r.setUTCDate(r.getUTCDate() + days); return r;
}
function pickN<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}
function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Creates an auth user via the Supabase Admin REST API directly (bypasses
// SDK auth-session issues). Retries up to 3 times with 1s/2s backoff.
async function createAuthUser(
  supabaseUrl: string,
  serviceKey: string,
  opts: { email: string; password: string; user_metadata?: object; app_metadata?: object },
): Promise<{ id: string; error?: undefined } | { id?: undefined; error: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({ ...opts, email_confirm: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.id) return { id: json.id };
      const errMsg = json?.msg || json?.message || json?.error_description || JSON.stringify(json);
      console.error(`[seed] createUser attempt ${attempt + 1} failed (HTTP ${res.status}):`, errMsg);
      if (attempt < 2) continue;
      return { error: `HTTP ${res.status}: ${errMsg}` };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[seed] createUser attempt ${attempt + 1} exception:`, errMsg);
      if (attempt < 2) continue;
      return { error: errMsg };
    }
  }
  return { error: 'max retries exceeded' };
}

// ── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authz = req.headers.get('Authorization');
    if (!authz) return jsonRes({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authz } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonRes({ error: 'Unauthorized' }, 401);
    const ownerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const name: string = (body?.name ?? '').toString().trim() ||
      `Demo munkaterület ${new Date().toLocaleDateString('hu-HU')}`;

    if (!SERVICE_KEY) return jsonRes({ error: 'SUPABASE_SERVICE_ROLE_KEY not available in edge function environment' }, 500);

    // ── Read seed config (quantities) for this owner ────────────────────────
    // Loaded BEFORE workspace creation; falls back to DEFAULT_SEED_QUANTITIES.
    const adminPre = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data: seedConfigRow } = await adminPre
      .from('enterprise_seed_config')
      .select('config')
      .eq('owner_id', ownerId)
      .maybeSingle();
    const seedQty: typeof DEFAULT_SEED_QUANTITIES = {
      ...DEFAULT_SEED_QUANTITIES,
      ...(seedConfigRow?.config ?? {}),
    };

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    // ── A1. Create workspace ────────────────────────────────────────────────
    const { data: wsId, error: rpcErr } = await userClient.rpc('create_workspace_with_owner', {
      _name: name,
      _description: body?.description?.toString().trim() ||
        'Demo munkaterület – minden modul azonnal tesztelhető előre kitöltött adatokkal.',
    });
    if (rpcErr) return jsonRes({ error: 'Workspace létrehozás sikertelen: ' + rpcErr.message }, 500);
    const workspaceId = wsId as string;
    if (!workspaceId) return jsonRes({ error: 'Workspace ID nem elérhető' }, 500);

    // Quick admin client sanity check — if this fails we know the service role key is not working
    const { error: adminTestErr } = await admin.from('enterprise_workspaces').select('id').eq('id', workspaceId).limit(1);
    if (adminTestErr) return jsonRes({ error: 'Admin client not working: ' + adminTestErr.message + ' (SERVICE_KEY length: ' + SERVICE_KEY.length + ')' }, 500);

    const today = new Date();
    const year  = today.getUTCFullYear();

    // ── A2. Demo auth users ─────────────────────────────────────────────────
    const demoUserIds: { user_id: string; persona: typeof DEMO_PERSONAS[number] }[] = [];
    const createUserErrors: string[] = [];
    const seedTag = Math.random().toString(36).slice(2, 9);
    const personasToCreate = DEMO_PERSONAS.slice(0, Math.max(1, seedQty.members));
    console.log(`[seed] Creating ${personasToCreate.length} demo auth users (seedTag=${seedTag})`);
    for (const persona of personasToCreate) {
      const slug  = slugify(persona.display_name);
      const email = `demo-${slug}-${seedTag}@effectime-demo.test`;
      const result = await createAuthUser(SUPABASE_URL, SERVICE_KEY, {
        email,
        password: `Demo!${crypto.randomUUID().slice(0, 12)}`,
        user_metadata: { display_name: persona.display_name },
        app_metadata: { is_demo_persona: true, demo_workspace_id: workspaceId },
      });
      if (!result.id) {
        createUserErrors.push(`${persona.display_name}: ${result.error}`);
        console.error('[seed] createUser failed for', persona.display_name, result.error);
        continue;
      }
      demoUserIds.push({ user_id: result.id, persona });
      await admin.from('profiles').upsert({ user_id: result.id, display_name: persona.display_name } as any, { onConflict: 'user_id' });
    }
    console.log(`[seed] Auth users done: ${demoUserIds.length} created, ${createUserErrors.length} failed`);

    // ── A3. Persist demo user ids on workspace ──────────────────────────────
    await admin.from('enterprise_workspaces').update({
      settings: { is_demo: true, demo_user_ids: demoUserIds.map(d => d.user_id), demo_seed_tag: seedTag },
    } as any).eq('id', workspaceId);

    // ── A4. Offices ─────────────────────────────────────────────────────────
    const { data: offices, error: officesErr } = await admin.from('enterprise_offices')
      .insert(OFFICE_DEFS.map(o => ({ ...o, workspace_id: workspaceId }))).select('id,name,city');
    if (officesErr) console.error('[seed] offices insert failed:', officesErr.message);
    const officeByCity = new Map<string, string>();
    (offices ?? []).forEach((o: any) => officeByCity.set(o.city, o.id));
    const budapestOfficeId = officeByCity.get('Budapest');

    // ── A5. Teams ───────────────────────────────────────────────────────────
    const { data: teams, error: teamsErr } = await admin.from('enterprise_teams')
      .insert(TEAM_DEFS.map(t => ({ ...t, workspace_id: workspaceId, created_by: ownerId }))).select('id,name');
    if (teamsErr) console.error('[seed] teams insert failed:', teamsErr.message);
    const teamByName = new Map<string, string>();
    (teams ?? []).forEach((t: any) => teamByName.set(t.name, t.id));

    // ── A6. Leave types ─────────────────────────────────────────────────────
    const { data: leaveTypes, error: leaveTypesErr } = await admin.from('enterprise_leave_types')
      .insert(LEAVE_TYPE_DEFS.map((lt, idx) => ({ ...lt, workspace_id: workspaceId, sort_order: idx, is_active: true })))
      .select('id,name');
    if (leaveTypesErr) console.error('[seed] leave_types insert failed:', leaveTypesErr.message);
    const hasSupportedLeaveTypes = (leaveTypes ?? []).length > 0;
    const activeLeaveTypeKeys = new Set(['vacation', 'sick_leave', 'unpaid_leave', 'other']);

    // ── A7. Public holidays ─────────────────────────────────────────────────
    const { error: holidaysErr } = await admin.from('enterprise_holidays').insert(
      HU_HOLIDAYS_TEMPLATE.map(h => ({
        workspace_id: workspaceId,
        holiday_date: `${year}-${h.month}`,
        name: h.name,
        is_recurring: true,
      }))
    );
    if (holidaysErr) console.error('[seed] holidays insert failed:', holidaysErr.message);

    // ── A8. Skills ──────────────────────────────────────────────────────────
    const { data: skills, error: skillsErr } = await admin.from('enterprise_skills')
      .insert(SKILL_NAMES.map((s, idx) => ({
        workspace_id: workspaceId, name: s,
        category: idx < 4 ? 'Engineering' : idx < 7 ? 'Infrastructure' : 'QA',
        color: SKILL_COLORS[idx % SKILL_COLORS.length],
      }))).select('id,name');
    if (skillsErr) console.error('[seed] skills insert failed:', skillsErr.message);
    const skillByName = new Map<string, string>();
    (skills ?? []).forEach((s: any) => skillByName.set(s.name, s.id));

    // ── A9. Memberships ─────────────────────────────────────────────────────
    await admin.from('enterprise_memberships').update({
      base_working_hours: 8, weekly_capacity_hours: 40,
    } as any).eq('workspace_id', workspaceId).eq('user_id', ownerId);

    const memberInserts = demoUserIds.map((d, idx) => ({
      workspace_id: workspaceId,
      user_id: d.user_id,
      role: idx === 0 ? 'resourceAssistant' : 'member',
      status: 'active',
      team: d.persona.team,
      location: d.persona.city,
      city: d.persona.city,
      office_id: officeByCity.get(d.persona.city) ?? null,
      business_role: d.persona.position,
      base_working_hours: 8,
      weekly_capacity_hours: 40,
      joined_at: addDays(today, -(30 + idx * 20)).toISOString(),
    }));
    const { data: insertedMemberships, error: membershipsErr } = memberInserts.length > 0
      ? await admin.from('enterprise_memberships').insert(memberInserts).select('id,user_id,business_role')
      : { data: [] as any[], error: null };
    if (membershipsErr) {
      console.error('[seed] memberships insert FAILED:', membershipsErr.message, JSON.stringify(membershipsErr));
    } else {
      console.log(`[seed] Memberships inserted: ${(insertedMemberships ?? []).length}`);
    }
    const membershipByUser = new Map<string, { id: string; business_role: string | null }>();
    (insertedMemberships ?? []).forEach((m: any) => membershipByUser.set(m.user_id, { id: m.id, business_role: m.business_role }));

    // ── A10. Member skills ──────────────────────────────────────────────────
    const memberSkillRows: any[] = [];
    for (const { user_id } of demoUserIds) {
      const m = membershipByUser.get(user_id);
      if (!m) continue;
      const shuffled = pickN(SKILL_NAMES, 3 + Math.floor(Math.random() * 3));
      for (const skillName of shuffled) {
        const skillId = skillByName.get(skillName);
        if (skillId) memberSkillRows.push({
          workspace_id: workspaceId, membership_id: m.id, skill_id: skillId,
          level: 1 + Math.floor(Math.random() * 5),
        });
      }
    }
    if (memberSkillRows.length) await admin.from('enterprise_member_skills').insert(memberSkillRows);

    // ── A11. Role allocations ───────────────────────────────────────────────
    const allocationRows = demoUserIds.map(d => {
      const m = membershipByUser.get(d.user_id);
      return m ? { workspace_id: workspaceId, membership_id: m.id, business_role: d.persona.position, percentage: 100, is_priority: true } : null;
    }).filter(Boolean);
    if (allocationRows.length) await admin.from('enterprise_member_role_allocations').insert(allocationRows);

    // ════════════════════════════════════════════════════════════════════════
    // B. ORGANIZATION STRUCTURE
    // ════════════════════════════════════════════════════════════════════════

    // ── B1. Job families ────────────────────────────────────────────────────
    const jfToInsert = JOB_FAMILY_DEFS.slice(0, Math.max(1, seedQty.job_families));
    const { error: jfErr } = await admin.from('enterprise_job_families')
      .insert(jfToInsert.map(({ code, label }) => ({ code, label, workspace_id: workspaceId })));
    if (jfErr) console.warn('[seed] job_families insert skipped:', jfErr.message);

    // ── B2. Leadership levels ────────────────────────────────────────────────
    // Minimum 5 required: strategic/operational/technical/execution/specialist are used in B8.
    const llToInsert = LEADERSHIP_LEVEL_DEFS.slice(0, Math.max(5, seedQty.leadership_levels));
    const { data: leadershipLevels, error: llErr } = await admin.from('enterprise_leadership_levels')
      .insert(llToInsert.map(d => ({ ...d, workspace_id: workspaceId }))).select('id,code');
    if (llErr) console.warn('[seed] leadership_levels insert skipped:', llErr.message);
    const llByCode = new Map<string, string>();
    (leadershipLevels ?? []).forEach((l: any) => llByCode.set(l.code, l.id));

    // ── B3. Contract types ────────────────────────────────────────────────────
    // Minimum 2 required: employee + contractor are used in B8.
    const ctToInsert = CONTRACT_TYPE_DEFS.slice(0, Math.max(2, seedQty.contract_types));
    const { data: contractTypes, error: ctErr } = await admin.from('enterprise_contract_types')
      .insert(ctToInsert.map(d => ({ ...d, workspace_id: workspaceId }))).select('id,code');
    if (ctErr) console.warn('[seed] contract_types insert skipped:', ctErr.message);
    const ctByCode = new Map<string, string>();
    (contractTypes ?? []).forEach((c: any) => ctByCode.set(c.code, c.id));

    // ── B4. Industries ────────────────────────────────────────────────────────
    const indToInsert = INDUSTRY_DEFS.slice(0, Math.max(1, seedQty.industries));
    const { error: indErr } = await admin.from('enterprise_industries')
      .insert(indToInsert.map(d => ({ ...d, workspace_id: workspaceId })));
    if (indErr) console.warn('[seed] industries insert skipped:', indErr.message);

    // ── B5. Work categories ───────────────────────────────────────────────────
    const wcToInsert = WORK_CATEGORY_DEFS.slice(0, Math.max(1, seedQty.work_categories));
    const { data: workCats, error: wcErr } = await admin.from('enterprise_work_categories')
      .insert(wcToInsert.map(d => ({ ...d, workspace_id: workspaceId }))).select('id,code');
    if (wcErr) console.warn('[seed] work_categories insert skipped:', wcErr.message);
    const wcById = ((workCats ?? []) as any[]).reduce((m: any, c: any) => { m[c.code] = c.id; return m; }, {});
    // Sub-categories under 'development'
    if (wcById['development']) {
      await admin.from('enterprise_work_categories').insert([
        { workspace_id: workspaceId, code: 'frontend_dev', label: 'Frontend fejlesztés', parent_id: wcById['development'] },
        { workspace_id: workspaceId, code: 'backend_dev',  label: 'Backend fejlesztés',  parent_id: wcById['development'] },
      ]).then(() => {});
    }

    // ── B6. Org units (hierarchical) ──────────────────────────────────────────
    const { data: topOrgUnits } = await admin.from('enterprise_org_units').insert([
      { workspace_id: workspaceId, name: 'Mérnöki részleg',     unit_type: 'division',    sort_order: 1 },
      { workspace_id: workspaceId, name: 'Üzemeltetés',         unit_type: 'division',    sort_order: 2 },
    ]).select('id,name');
    const ouByName = new Map<string, string>();
    (topOrgUnits ?? []).forEach((o: any) => ouByName.set(o.name, o.id));
    const engDivId = ouByName.get('Mérnöki részleg');
    if (engDivId) {
      const { data: subUnits } = await admin.from('enterprise_org_units').insert([
        { workspace_id: workspaceId, parent_id: engDivId, name: 'Frontend csapat',  unit_type: 'team', sort_order: 1 },
        { workspace_id: workspaceId, parent_id: engDivId, name: 'Backend csapat',   unit_type: 'team', sort_order: 2 },
        { workspace_id: workspaceId, parent_id: engDivId, name: 'QA csapat',        unit_type: 'team', sort_order: 3 },
      ]).select('id,name');
      (subUnits ?? []).forEach((o: any) => ouByName.set(o.name, o.id));
    }

    // ── B7. Team roles ────────────────────────────────────────────────────────
    const teamRoleRows: any[] = [
      { team: 'Frontend',   roles: ['Senior Frontend Developer', 'Junior Frontend Developer'] },
      { team: 'Backend',    roles: ['Senior Backend Developer', 'Backend Developer'] },
      { team: 'Operations', roles: ['Operations Lead', 'Operations Specialist'] },
      { team: 'QA',         roles: ['QA Engineer'] },
    ];
    const allTeamRoleInserts: any[] = [];
    for (const { team, roles } of teamRoleRows) {
      const teamId = teamByName.get(team);
      if (!teamId) continue;
      for (const role of roles) {
        allTeamRoleInserts.push({ team_id: teamId, workspace_id: workspaceId, business_role: role });
      }
    }
    if (allTeamRoleInserts.length) await admin.from('enterprise_team_roles').insert(allTeamRoleInserts);

    // ── B8. Org structure for ALL demo members (data-driven via PERSONA_ORG_ASSIGNMENTS) ─
    const mIdByUserId = new Map<string, string>();
    (insertedMemberships ?? []).forEach((m: any) => mIdByUserId.set(m.user_id, m.id));

    // Build display_name → user_id map for manager lookups
    const userIdByPersonaName = new Map<string, string>();
    demoUserIds.forEach(d => userIdByPersonaName.set(d.persona.display_name, d.user_id));

    for (const d of demoUserIds) {
      const mId = mIdByUserId.get(d.user_id);
      if (!mId) continue;
      const asgn = PERSONA_ORG_ASSIGNMENTS[d.persona.display_name];
      if (!asgn) continue;
      const managerUserId = asgn.managerName ? userIdByPersonaName.get(asgn.managerName) : undefined;
      const managerId = managerUserId ? (mIdByUserId.get(managerUserId) ?? null) : null;
      const updates: any = {
        org_unit_id:         ouByName.get(asgn.orgUnit) ?? null,
        leadership_level_id: llByCode.get(asgn.llCode) ?? null,
        contract_type_id:    ctByCode.get(asgn.contractCode) ?? null,
        leadership_category: asgn.leadershipCategory,
        seniority:           d.persona.seniority,
      };
      if (managerId) updates.manager_id = managerId;
      await admin.from('enterprise_memberships').update(updates as any).eq('id', mId);
    }

    // ════════════════════════════════════════════════════════════════════════
    // C. LEAVE MANAGEMENT EXTENSIONS
    // ════════════════════════════════════════════════════════════════════════

    // ── C1. Allowance type definitions ───────────────────────────────────────
    await admin.from('enterprise_allowances').insert([
      { workspace_id: workspaceId, name: 'Éves alapszabadság',  unit: 'days', ignore_limit: false, sort_order: 0, is_archived: false },
      { workspace_id: workspaceId, name: 'Betegszabadság keret', unit: 'days', ignore_limit: true,  sort_order: 1, is_archived: false },
      { workspace_id: workspaceId, name: 'Extra szabadnapok',    unit: 'days', ignore_limit: false, sort_order: 2, is_archived: false },
    ]).then(() => {});

    // ── C2. Leave quotas (per-member, proper schema) ─────────────────────────
    const quotaRows: any[] = [];
    for (const { user_id } of demoUserIds) {
      const m = membershipByUser.get(user_id);
      if (!m) continue;
      quotaRows.push(
        { workspace_id: workspaceId, membership_id: m.id, leave_type: 'vacation',    year, initial_days: 25, carryover_days: 2, manual_adjustment_days: 0 },
        { workspace_id: workspaceId, membership_id: m.id, leave_type: 'sick_leave',  year, initial_days: 15, carryover_days: 0, manual_adjustment_days: 0 },
        { workspace_id: workspaceId, membership_id: m.id, leave_type: 'unpaid_leave',year, initial_days: 10, carryover_days: 0, manual_adjustment_days: 0 },
        { workspace_id: workspaceId, membership_id: m.id, leave_type: 'other',       year, initial_days: 52, carryover_days: 0, manual_adjustment_days: 0 },
      );
    }
    if (quotaRows.length) {
      const { error: qErr } = await admin.from('enterprise_leave_quotas').insert(quotaRows);
      if (qErr) console.warn('[seed] leave_quotas insert skipped:', qErr.message);
    }

    // ── C3. Company leave days (collective days off) ──────────────────────────
    await admin.from('enterprise_company_leave_days').insert([
      { workspace_id: workspaceId, leave_date: `${year}-12-24`, name: 'Karácsony előestéje', is_recurring: true,  created_by: ownerId },
      { workspace_id: workspaceId, leave_date: `${year}-12-27`, name: 'Karácsonyi szünet',   is_recurring: false, created_by: ownerId },
    ]).then(() => {});

    // ── C4. Blocked dates ────────────────────────────────────────────────────
    await admin.from('enterprise_blocked_dates').insert([
      { workspace_id: workspaceId, blocked_date: fmtDate(addDays(today, 21)), reason: 'Éves csapat-összejövetel – minden kolléga jelenlétére szükség van', created_by: ownerId },
      { workspace_id: workspaceId, blocked_date: fmtDate(addDays(today, 22)), reason: 'Éves csapat-összejövetel – második nap', created_by: ownerId },
    ]).then(() => {});

    // ── C5. Daily rules ────────────────────────────────────────────────────────
    const dailyRulesToInsert = DAILY_RULE_DEFS.slice(0, Math.max(1, seedQty.daily_rules));
    if (dailyRulesToInsert.length) {
      const { error: dailyRulesErr } = await admin.from('enterprise_daily_rules').insert(
        dailyRulesToInsert.map(({ is_active: _isActive, ...rule }) => ({
          ...rule,
          workspace_id: workspaceId,
          created_by: ownerId,
        } as any))
      );
      if (dailyRulesErr) console.warn('[seed] daily_rules insert skipped:', dailyRulesErr.message);
    }

    // ── C6. Office coverage rules ────────────────────────────────────────────
    const coverageRulesToInsert = OFFICE_COVERAGE_RULE_DEFS.slice(0, Math.max(1, seedQty.office_coverage_rules));
    const coverageRows: any[] = [];
    for (const rule of coverageRulesToInsert) {
      const offId = officeByCity.get(rule.officeName === 'Budapest HQ' ? 'Budapest' : rule.officeName === 'Debrecen Office' ? 'Debrecen' : 'Szeged');
      if (!offId) continue;
      const { officeName: _o, ...rest } = rule;
      coverageRows.push({ ...rest, workspace_id: workspaceId, office_id: offId, created_by: ownerId });
    }
    if (coverageRows.length) {
      const { error: ocrErr } = await admin.from('enterprise_office_coverage_rules').insert(coverageRows as any);
      if (ocrErr) console.warn('[seed] office_coverage_rules insert skipped:', ocrErr.message);
    }

    // ── C7. Leave requests ────────────────────────────────────────────────────
    const personas = demoUserIds.slice();
    const leaveRequests: any[] = [];
    if (hasSupportedLeaveTypes && personas.length >= 3) {
      leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[0].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, -20)), end_date: fmtDate(addDays(today, -16)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -22).toISOString(), comment: 'Tavaszi pihenés',
      });
      leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[1].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 7)), end_date: fmtDate(addDays(today, 11)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -1).toISOString(), comment: 'Családi nyaralás',
      });
      leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[2].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 14)), end_date: fmtDate(addDays(today, 18)),
        status: 'pending', comment: 'Pihenőnap',
      });
      if (personas[3]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[3].user_id, leave_type: 'sick_leave',
        start_date: fmtDate(addDays(today, 1)), end_date: fmtDate(addDays(today, 2)),
        status: 'pending', comment: 'Megbetegedés',
      });
      if (personas[4]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[4].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 30)), end_date: fmtDate(addDays(today, 35)),
        status: 'rejected', reviewer_id: ownerId, reviewed_at: addDays(today, -2).toISOString(),
        review_comment: 'Sprint záráshoz szükséges erőforrás',
      });
      if (personas[5]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[5].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, -1)), end_date: fmtDate(addDays(today, 1)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -5).toISOString(), comment: 'Tervezett szabadság',
      });
      if (personas[6]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[6].user_id, leave_type: 'other',
        start_date: fmtDate(today), end_date: fmtDate(today), status: 'approved',
        reviewer_id: ownerId, reviewed_at: addDays(today, -1).toISOString(), comment: 'Otthoni munkanap',
        is_half_day: false,
      });

      // ── Bővített seed: 3 hónap múlt + jelen + 3 hónap jövő, minden típus + státusz ──

      // --- 3 hónappal ezelőtt (-90 … -61) ---
      if (personas[0]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[0].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, -90)), end_date: fmtDate(addDays(today, -84)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -95).toISOString(), comment: 'Téli szabadság',
      });
      if (personas[1]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[1].user_id, leave_type: 'sick_leave',
        start_date: fmtDate(addDays(today, -86)), end_date: fmtDate(addDays(today, -84)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -87).toISOString(), comment: 'Influenza',
      });
      if (personas[2]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[2].user_id, leave_type: 'unpaid_leave',
        start_date: fmtDate(addDays(today, -80)), end_date: fmtDate(addDays(today, -76)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -85).toISOString(), comment: 'Személyes ügyek',
      });
      if (personas[7]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[7].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, -75)), end_date: fmtDate(addDays(today, -71)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -80).toISOString(), comment: 'Karácsonyi pihenő',
      });
      if (personas[8]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[8].user_id, leave_type: 'other',
        start_date: fmtDate(addDays(today, -70)), end_date: fmtDate(addDays(today, -70)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -72).toISOString(), comment: 'Home office',
      });
      if (personas[9]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[9].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, -68)), end_date: fmtDate(addDays(today, -64)),
        status: 'cancelled', comment: 'Lemondva betegség miatt',
      });

      // --- 2 hónappal ezelőtt (-60 … -31) ---
      if (personas[3]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[3].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, -58)), end_date: fmtDate(addDays(today, -54)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -62).toISOString(), comment: 'Őszi kirándulás',
      });
      if (personas[10]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[10].user_id, leave_type: 'sick_leave',
        start_date: fmtDate(addDays(today, -52)), end_date: fmtDate(addDays(today, -50)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -53).toISOString(), comment: 'Betegség',
      });
      if (personas[11]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[11].user_id, leave_type: 'unpaid_leave',
        start_date: fmtDate(addDays(today, -47)), end_date: fmtDate(addDays(today, -43)),
        status: 'rejected', reviewer_id: ownerId, reviewed_at: addDays(today, -50).toISOString(), review_comment: 'Projekt kritikus fázis',
      });
      if (personas[12]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[12].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, -42)), end_date: fmtDate(addDays(today, -38)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -45).toISOString(), comment: 'Tervezett szabadság',
      });
      if (personas[13]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[13].user_id, leave_type: 'other',
        start_date: fmtDate(addDays(today, -36)), end_date: fmtDate(addDays(today, -35)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -38).toISOString(), comment: 'Gyerek beteg',
      });
      if (personas[14]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[14].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, -33)), end_date: fmtDate(addDays(today, -31)),
        status: 'cancelled', comment: 'Projekt sürgős',
      });

      // --- Előző hónap (-30 … -2) — az első 7 mellé ---
      if (personas[15]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[15].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, -28)), end_date: fmtDate(addDays(today, -24)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -30).toISOString(), comment: 'Tavaszi pihenés',
      });
      if (personas[16]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[16].user_id, leave_type: 'sick_leave',
        start_date: fmtDate(addDays(today, -22)), end_date: fmtDate(addDays(today, -20)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -23).toISOString(), comment: 'Betegség',
      });
      if (personas[17]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[17].user_id, leave_type: 'unpaid_leave',
        start_date: fmtDate(addDays(today, -18)), end_date: fmtDate(addDays(today, -15)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -22).toISOString(), comment: 'Személyes távolmaradás',
      });
      if (personas[18]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[18].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, -12)), end_date: fmtDate(addDays(today, -8)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -15).toISOString(), comment: 'Nyaralás',
      });
      if (personas[19]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[19].user_id, leave_type: 'other',
        start_date: fmtDate(addDays(today, -7)), end_date: fmtDate(addDays(today, -6)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -9).toISOString(), comment: 'Home office napok',
      });

      // --- Aktuális hónap (0 … +30) — az első 7 mellé ---
      if (personas[20]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[20].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 3)), end_date: fmtDate(addDays(today, 7)),
        status: 'pending', comment: 'Nyári szabadság kérelem',
      });
      if (personas[21]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[21].user_id, leave_type: 'unpaid_leave',
        start_date: fmtDate(addDays(today, 5)), end_date: fmtDate(addDays(today, 7)),
        status: 'pending', comment: 'Fizetés nélküli távolmaradás',
      });
      // Néhány persona aktuális hónapban is szerepel más típussal
      if (personas[8]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[8].user_id, leave_type: 'sick_leave',
        start_date: fmtDate(addDays(today, 10)), end_date: fmtDate(addDays(today, 11)),
        status: 'pending', comment: 'Betegszabadság kérelem',
      });
      if (personas[9]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[9].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 15)), end_date: fmtDate(addDays(today, 19)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -3).toISOString(), comment: 'Jóváhagyott nyaralás',
      });

      // --- 1 hónappal előre (+31 … +60) ---
      if (personas[0]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[0].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 35)), end_date: fmtDate(addDays(today, 39)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -1).toISOString(), comment: 'Nyári szabadság',
      });
      if (personas[1]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[1].user_id, leave_type: 'unpaid_leave',
        start_date: fmtDate(addDays(today, 38)), end_date: fmtDate(addDays(today, 40)),
        status: 'pending', comment: 'Személyes ügy',
      });
      if (personas[10]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[10].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 42)), end_date: fmtDate(addDays(today, 46)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -2).toISOString(), comment: 'Nyári pihenő',
      });
      if (personas[11]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[11].user_id, leave_type: 'sick_leave',
        start_date: fmtDate(addDays(today, 48)), end_date: fmtDate(addDays(today, 49)),
        status: 'pending', comment: 'Tervezett műtét utókezelés',
      });
      if (personas[12]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[12].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 52)), end_date: fmtDate(addDays(today, 56)),
        status: 'rejected', reviewer_id: ownerId, reviewed_at: addDays(today, -4).toISOString(), review_comment: 'Nem megfelelő kapacitás',
      });
      if (personas[13]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[13].user_id, leave_type: 'other',
        start_date: fmtDate(addDays(today, 58)), end_date: fmtDate(addDays(today, 59)),
        status: 'pending', comment: 'Home office kérelem',
      });

      // --- 2 hónappal előre (+61 … +90) ---
      if (personas[14]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[14].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 63)), end_date: fmtDate(addDays(today, 69)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -3).toISOString(), comment: 'Nyári nyaralás',
      });
      if (personas[15]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[15].user_id, leave_type: 'unpaid_leave',
        start_date: fmtDate(addDays(today, 72)), end_date: fmtDate(addDays(today, 74)),
        status: 'pending', comment: 'Konferencia – fizetés nélkül',
      });
      if (personas[16]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[16].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 77)), end_date: fmtDate(addDays(today, 81)),
        status: 'pending', comment: 'Tervezett nyaralás',
      });
      if (personas[17]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[17].user_id, leave_type: 'sick_leave',
        start_date: fmtDate(addDays(today, 83)), end_date: fmtDate(addDays(today, 84)),
        status: 'pending', comment: 'Tervezett beavatkozás',
      });

      // --- 3 hónappal előre (+91 … +120) ---
      if (personas[18]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[18].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 93)), end_date: fmtDate(addDays(today, 99)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -2).toISOString(), comment: 'Őszi nyaralás',
      });
      if (personas[19]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[19].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 105)), end_date: fmtDate(addDays(today, 109)),
        status: 'pending', comment: 'Tervezett szabadság',
      });
      if (personas[20]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[20].user_id, leave_type: 'unpaid_leave',
        start_date: fmtDate(addDays(today, 112)), end_date: fmtDate(addDays(today, 114)),
        status: 'pending', comment: 'Fizetés nélküli távolmaradás',
      });
      if (personas[21]) leaveRequests.push({
        workspace_id: workspaceId, user_id: personas[21].user_id, leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 116)), end_date: fmtDate(addDays(today, 120)),
        status: 'approved', reviewer_id: ownerId, reviewed_at: addDays(today, -1).toISOString(), comment: 'Hosszú hétvége',
      });
    }
    const normalizedLeaveRequests = leaveRequests
      .filter((request) => activeLeaveTypeKeys.has(request.leave_type))
      .map((request) => ({
        ...request,
        is_half_day: typeof request.is_half_day === 'boolean' ? request.is_half_day : false,
        half_day_period: request.is_half_day ? (request.half_day_period ?? 'morning') : null,
        is_private: typeof request.is_private === 'boolean' ? request.is_private : false,
        cancellation_reason: request.status === 'cancelled'
          ? (request.cancellation_reason ?? request.comment ?? 'Demo seed: visszavont kérelem')
          : null,
      }));

    const { data: insertedLeaves, error: insertedLeavesErr } = normalizedLeaveRequests.length
      ? await admin.from('leave_requests').insert(normalizedLeaveRequests).select('id,status,user_id,leave_type')
      : { data: [], error: null };
    if (insertedLeavesErr) {
      console.error('[seed] leave_requests insert FAILED:', insertedLeavesErr.message, JSON.stringify(insertedLeavesErr));
      throw new Error(`Demo szabadságadatok seedelése sikertelen: ${insertedLeavesErr.message}`);
    }

    const quotaIdByMembershipAndType = new Map<string, string>();
    if (quotaRows.length) {
      const { data: insertedQuotas, error: insertedQuotasErr } = await admin
        .from('enterprise_leave_quotas')
        .select('id,membership_id,leave_type')
        .eq('workspace_id', workspaceId)
        .eq('year', year);
      if (insertedQuotasErr) {
        console.warn('[seed] leave_quotas readback skipped:', insertedQuotasErr.message);
      } else {
        (insertedQuotas ?? []).forEach((quota: any) => {
          quotaIdByMembershipAndType.set(`${quota.membership_id}:${quota.leave_type}`, quota.id);
        });
      }
    }

    const leaveByUserAndRange = new Map<string, any>();
    (insertedLeaves ?? []).forEach((leave: any, index: number) => {
      const original = normalizedLeaveRequests[index];
      if (!original) return;
      leaveByUserAndRange.set(`${leave.user_id}:${original.start_date}:${original.end_date}:${leave.leave_type}`, leave);
    });

    const quotaTransactionRows: any[] = [];
    for (const request of normalizedLeaveRequests) {
      if (request.status !== 'approved') continue;
      if (request.leave_type !== 'vacation') continue;
      const membership = membershipByUser.get(request.user_id);
      if (!membership) continue;
      const quotaId = quotaIdByMembershipAndType.get(`${membership.id}:${request.leave_type}`);
      if (!quotaId) continue;
      const insertedLeave = leaveByUserAndRange.get(`${request.user_id}:${request.start_date}:${request.end_date}:${request.leave_type}`);
      if (!insertedLeave?.id) continue;
      const start = new Date(`${request.start_date}T00:00:00Z`);
      const end = new Date(`${request.end_date}T00:00:00Z`);
      let approvedDays = 0;
      for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
        const weekday = cursor.getUTCDay();
        if (weekday === 0 || weekday === 6) continue;
        const iso = fmtDate(cursor);
        const isHoliday = HU_HOLIDAYS_TEMPLATE.some((holiday) => `${year}-${holiday.month}` === iso);
        if (isHoliday) continue;
        approvedDays += 1;
      }
      if (approvedDays <= 0) continue;
      quotaTransactionRows.push({
        workspace_id: workspaceId,
        quota_id: quotaId,
        membership_id: membership.id,
        leave_request_id: insertedLeave.id,
        transaction_type: 'consume',
        amount_days: -approvedDays,
        reason: `Demo seed: ${request.comment ?? 'jóváhagyott szabadság'}`,
        created_by: ownerId,
      });
    }
    if (quotaTransactionRows.length) {
      const { error: quotaTxnErr } = await admin.from('enterprise_quota_transactions').insert(quotaTransactionRows);
      if (quotaTxnErr) console.warn('[seed] quota_transactions insert skipped:', quotaTxnErr.message);
    }

    // ── C8. Approval decisions (for decided requests) ─────────────────────────
    const approvalDecisionRows: any[] = [];
    for (const lr of (insertedLeaves ?? []) as any[]) {
      if (lr.status === 'approved') {
        approvalDecisionRows.push({
          leave_request_id: lr.id, workspace_id: workspaceId,
          decided_by: ownerId, decision: 'approved', comment: 'Jóváhagyva.',
        });
      } else if (lr.status === 'rejected') {
        approvalDecisionRows.push({
          leave_request_id: lr.id, workspace_id: workspaceId,
          decided_by: ownerId, decision: 'rejected', comment: 'Erőforrás szükséges a sprint záráshoz.',
        });
      }
    }
    if (approvalDecisionRows.length) {
      const { error: adErr } = await admin.from('approval_decisions').insert(approvalDecisionRows);
      if (adErr) console.warn('[seed] approval_decisions insert skipped:', adErr.message);
    }

    // ── C9. Leave substitutes (for pending requests) ──────────────────────────
    const pendingLeaves = ((insertedLeaves ?? []) as any[]).filter(lr => lr.status === 'pending');
    const substituteRows: any[] = [];
    for (const lr of pendingLeaves) {
      const otherPersona = demoUserIds.find(d => d.user_id !== lr.user_id);
      if (otherPersona) {
        substituteRows.push({
          workspace_id: workspaceId, leave_request_id: lr.id,
          substitute_user_id: otherPersona.user_id, order_index: 0, status: 'pending',
        });
      }
    }
    if (substituteRows.length) {
      const { error: sErr } = await admin.from('leave_request_substitutes').insert(substituteRows);
      if (sErr) console.warn('[seed] leave_request_substitutes insert skipped:', sErr.message);
    }

    // ════════════════════════════════════════════════════════════════════════
    // D. RESOURCE MANAGEMENT
    // ════════════════════════════════════════════════════════════════════════

    // ── D1. Projects ─────────────────────────────────────────────────────────
    const projectInserts = PROJECT_DEFS.map(p => ({
      workspace_id: workspaceId, name: p.name, description: p.description, status: p.status,
      color: p.color, created_by: ownerId,
      start_date: fmtDate(addDays(today, p.offsetStart)),
      end_date:   fmtDate(addDays(today, p.offsetEnd)),
      is_open_ended: false,
    }));
    const { data: projects } = await admin.from('enterprise_projects').insert(projectInserts).select('id,name');
    const projectByName = new Map<string, string>();
    (projects ?? []).forEach((p: any) => projectByName.set(p.name, p.id));

    // ── D2. Project assignments (members → projects) ──────────────────────────
    const projectAssignmentRows: any[] = [];
    const roleMemberMap: Record<string, string | undefined> = {};
    for (const d of demoUserIds) {
      const m = membershipByUser.get(d.user_id);
      if (m) roleMemberMap[d.persona.position] = m.id;
    }
    for (const pDef of PROJECT_DEFS) {
      const projectId = projectByName.get(pDef.name);
      if (!projectId) continue;
      for (const role of pDef.roles) {
        const membershipId = roleMemberMap[role];
        if (!membershipId) continue;
        projectAssignmentRows.push({
          workspace_id: workspaceId, project_id: projectId, membership_id: membershipId,
          business_role: role, allocated_percentage: 50,
          start_date: fmtDate(addDays(today, pDef.offsetStart)),
          end_date:   fmtDate(addDays(today, pDef.offsetEnd)),
          notes: 'Demo hozzárendelés',
        });
      }
    }
    if (projectAssignmentRows.length) {
      const { error: paErr } = await admin.from('enterprise_project_assignments').insert(projectAssignmentRows);
      if (paErr) console.warn('[seed] project_assignments insert skipped:', paErr.message);
    }

    // ── D3. Project resource requirements ─────────────────────────────────────
    const reqRows: any[] = [];
    for (const pDef of PROJECT_DEFS) {
      const projectId = projectByName.get(pDef.name);
      if (!projectId) continue;
      for (const role of pDef.roles) {
        reqRows.push({ workspace_id: workspaceId, project_id: projectId, business_role: role, required_percentage: 50 });
      }
    }
    if (reqRows.length) {
      const { error: rrErr } = await admin.from('enterprise_project_resource_requirements').insert(reqRows);
      if (rrErr) console.warn('[seed] project_resource_requirements insert skipped:', rrErr.message);
    }

    // ── D4. Project skill requirements ────────────────────────────────────────
    const skillReqRows: any[] = [];
    for (const pDef of PROJECT_DEFS) {
      const projectId = projectByName.get(pDef.name);
      if (!projectId) continue;
      for (const skillName of pDef.skillNames) {
        const skillId = skillByName.get(skillName);
        if (skillId) skillReqRows.push({ workspace_id: workspaceId, project_id: projectId, skill_id: skillId, min_level: 3 });
      }
    }
    if (skillReqRows.length) {
      const { error: srErr } = await admin.from('enterprise_project_skill_requirements').insert(skillReqRows);
      if (srErr) console.warn('[seed] project_skill_requirements insert skipped:', srErr.message);
    }

    // ── D5. Member rates (cost rates) ─────────────────────────────────────────
    const costRateByPosition: Record<string, number> = {
      'Senior Frontend Developer': 85, 'Junior Frontend Developer': 45,
      'Backend Developer': 75, 'Senior Backend Developer': 95,
      'Operations Lead': 90, 'Operations Specialist': 65, 'QA Engineer': 60,
    };
    const memberRateRows: any[] = [];
    for (const d of demoUserIds) {
      const m = membershipByUser.get(d.user_id);
      if (!m) continue;
      memberRateRows.push({
        workspace_id: workspaceId, membership_id: m.id,
        cost_rate: costRateByPosition[d.persona.position] ?? 70,
        currency: 'EUR', effective_from: fmtDate(addDays(today, -90)),
      });
    }
    if (memberRateRows.length) {
      const { error: mrErr } = await admin.from('enterprise_member_rates').insert(memberRateRows);
      if (mrErr) console.warn('[seed] member_rates insert skipped:', mrErr.message);
    }

    // ── D6. Project rates (billing rates) ─────────────────────────────────────
    const projectRateRows: any[] = [];
    for (const pDef of PROJECT_DEFS) {
      const projectId = projectByName.get(pDef.name);
      if (!projectId) continue;
      for (const [role, rate] of Object.entries(pDef.billRates)) {
        projectRateRows.push({ workspace_id: workspaceId, project_id: projectId, business_role: role, bill_rate: rate, currency: 'EUR' });
      }
    }
    if (projectRateRows.length) {
      const { error: prErr } = await admin.from('enterprise_project_rates').insert(projectRateRows);
      if (prErr) console.warn('[seed] project_rates insert skipped:', prErr.message);
    }

    // ════════════════════════════════════════════════════════════════════════
    // E. SCENARIO PLANNING
    // ════════════════════════════════════════════════════════════════════════

    const { data: scenarios } = await admin.from('enterprise_scenarios').insert([
      { workspace_id: workspaceId, name: 'Alaptervez (Baseline)', description: 'Jelenlegi kapacitástervez.', is_baseline: true, created_by: ownerId },
      { workspace_id: workspaceId, name: 'Bővítési forgatókönyv', description: 'Mi lenne, ha új fejlesztőt vennénk fel Q3-ban?', is_baseline: false, created_by: ownerId },
    ]).select('id,name');
    const scenarioByName = new Map<string, string>();
    (scenarios ?? []).forEach((s: any) => scenarioByName.set(s.name, s.id));

    const scenarioAssRows: any[] = [];
    const baselineId = scenarioByName.get('Alaptervez (Baseline)');
    const expansionId = scenarioByName.get('Bővítési forgatókönyv');
    const cpProjectId = projectByName.get('Customer Portal 2.0');
    if (baselineId && cpProjectId && demoUserIds[0]) {
      const m0 = membershipByUser.get(demoUserIds[0].user_id);
      if (m0) {
        scenarioAssRows.push({ workspace_id: workspaceId, scenario_id: baselineId, project_id: cpProjectId, membership_id: m0.id, business_role: demoUserIds[0].persona.position, allocated_percentage: 50, start_date: fmtDate(today), end_date: fmtDate(addDays(today, 90)) });
      }
    }
    if (expansionId && cpProjectId && demoUserIds[3]) {
      const m3 = membershipByUser.get(demoUserIds[3].user_id);
      if (m3) {
        scenarioAssRows.push({ workspace_id: workspaceId, scenario_id: expansionId, project_id: cpProjectId, membership_id: m3.id, business_role: demoUserIds[3].persona.position, allocated_percentage: 100, start_date: fmtDate(addDays(today, 30)), end_date: fmtDate(addDays(today, 90)) });
      }
    }
    if (scenarioAssRows.length) {
      const { error: saErr } = await admin.from('enterprise_scenario_assignments').insert(scenarioAssRows);
      if (saErr) console.warn('[seed] scenario_assignments insert skipped:', saErr.message);
    }

    // ════════════════════════════════════════════════════════════════════════
    // F. WORKFLOW & RULES
    // ════════════════════════════════════════════════════════════════════════

    // ── F1. Approval chains ───────────────────────────────────────────────────
    const approvalChainsToInsert = APPROVAL_CHAIN_DEFS.slice(0, Math.max(1, seedQty.approval_chains));
    await admin.from('enterprise_approval_chains').insert(
      approvalChainsToInsert.map(c => ({ ...c, workspace_id: workspaceId }))
    ).then(() => {});

    // ── F2. Escalation rules ──────────────────────────────────────────────────
    await admin.from('enterprise_escalation_rules').insert({
      workspace_id: workspaceId, escalate_after_hours: 48, escalate_to_role: 'owner', notify_owner: true, is_active: true,
    } as any);

    // ── F3. Rule templates ────────────────────────────────────────────────────
    const ruleTemplatesToInsert = RULE_TEMPLATE_DEFS.slice(0, Math.max(1, seedQty.rule_templates));
    await admin.from('enterprise_rule_templates').insert(
      ruleTemplatesToInsert.map(t => ({
        ...t, workspace_id: workspaceId, created_by: ownerId, version: 1, is_archived: false,
      }))
    ).then(() => {});

    // ════════════════════════════════════════════════════════════════════════
    // G. REPORTING
    // ════════════════════════════════════════════════════════════════════════

    const { data: reports } = await admin.from('enterprise_reports').insert([
      {
        workspace_id: workspaceId, created_by: ownerId, name: 'Szabadság egyenlegek – ' + year,
        description: 'Minden kolléga fennmaradó szabadság egyenlege az aktuális évben.',
        data_source: 'leave_balance', chart_type: 'table', is_template: false, is_shared: true, is_pinned: true,
        config: { year, group_by: 'team', show_remaining: true },
      },
      {
        workspace_id: workspaceId, created_by: ownerId, name: 'Kapacitás terhelés – projekt szinten',
        description: 'Projekt-alapú kapacitás kihasználtság az összes aktív projekten.',
        data_source: 'capacity_utilization', chart_type: 'bar', is_template: false, is_shared: true, is_pinned: true,
        config: { period: '3m', group_by: 'project', include_tentative: false },
      },
      {
        workspace_id: workspaceId, created_by: ownerId, name: 'Jóváhagyási napló',
        description: 'Az utóbbi 90 nap összes jóváhagyási döntése.',
        data_source: 'approval_log', chart_type: 'table', is_template: false, is_shared: true, is_pinned: false,
        config: { days: 90, include_comments: true },
      },
      {
        workspace_id: workspaceId, created_by: ownerId, name: 'Csapat havi jelenléti összesítő',
        description: 'Csapatonkénti havi jelenlét és hiányzás statisztika.',
        data_source: 'attendance_summary', chart_type: 'heatmap', is_template: true, is_shared: true, is_pinned: false,
        config: { group_by: 'team', period: '1m' },
      },
    ]).select('id,name');
    const reportByName = new Map<string, string>();
    (reports ?? []).forEach((r: any) => reportByName.set(r.name, r.id));

    // ── G2. Report schedules ──────────────────────────────────────────────────
    const scheduleReportId = reportByName.get('Szabadság egyenlegek – ' + year);
    if (scheduleReportId) {
      await admin.from('enterprise_report_schedules').insert({
        workspace_id: workspaceId, report_id: scheduleReportId, created_by: ownerId,
        frequency: 'weekly', day_of_week: 1, hour_of_day: 8,
        recipients: demoUserIds.slice(0, 3).map(d => `demo-${d.user_id.slice(0, 8)}@effectime-demo.local`),
        is_active: true,
      } as any);
    }

    // ════════════════════════════════════════════════════════════════════════
    // H. ONBOARDING & ACCESS
    // ════════════════════════════════════════════════════════════════════════

    // ── H1. Access systems ────────────────────────────────────────────────────
    const { data: accessSystems } = await admin.from('enterprise_access_systems').insert([
      { workspace_id: workspaceId, name: 'Jira',          kind: 'external', description: 'Projektkövetési rendszer' },
      { workspace_id: workspaceId, name: 'Confluence',    kind: 'external', description: 'Tudásbázis és dokumentáció' },
      { workspace_id: workspaceId, name: 'GitHub',        kind: 'external', description: 'Forráskód-kezelés' },
      { workspace_id: workspaceId, name: 'AWS Console',   kind: 'external', description: 'Felhő infrastruktúra' },
      { workspace_id: workspaceId, name: 'Belépőrendszer',kind: 'internal', description: 'Irodai beléptető kártyarendszer' },
    ]).select('id,name');
    const sysByName = new Map<string, string>();
    (accessSystems ?? []).forEach((s: any) => sysByName.set(s.name, s.id));

    // ── H2. Access template (standard developer onboarding kit) ───────────────
    const { data: accTemplates } = await admin.from('enterprise_access_templates').insert([
      { workspace_id: workspaceId, name: 'Fejlesztői alap-hozzáférés' },
      { workspace_id: workspaceId, name: 'Ops teljes hozzáférés' },
    ]).select('id,name');
    const atByName = new Map<string, string>();
    (accTemplates ?? []).forEach((t: any) => atByName.set(t.name, t.id));

    const devTemplateId = atByName.get('Fejlesztői alap-hozzáférés');
    if (devTemplateId) {
      const atsRows: any[] = [];
      for (const sysName of ['Jira', 'Confluence', 'GitHub']) {
        const sysId = sysByName.get(sysName);
        if (sysId) atsRows.push({ template_id: devTemplateId, system_id: sysId, mandatory: true, optional: false, sort_order: atsRows.length });
      }
      if (atsRows.length) {
        const { error: atsErr } = await admin.from('enterprise_access_template_systems').insert(atsRows);
        if (atsErr) console.warn('[seed] access_template_systems insert skipped:', atsErr.message);
      }
    }

    // ── H3. Access requests (for the newest member) ───────────────────────────
    const newestMember = demoUserIds[demoUserIds.length - 1];
    const newestMembership = newestMember ? membershipByUser.get(newestMember.user_id) : null;
    if (newestMembership) {
      const accessReqRows: any[] = [];
      for (const [sysName, status] of [['Jira', 'granted'], ['Confluence', 'pending'], ['AWS Console', 'pending']] as [string, string][]) {
        const sysId = sysByName.get(sysName);
        if (sysId) accessReqRows.push({
          workspace_id: workspaceId, member_id: newestMembership.id, system_id: sysId,
          status, reason: 'Projekthez szükséges hozzáférés', requested_by: newestMember.user_id,
          template_id: devTemplateId ?? null,
        });
      }
      if (accessReqRows.length) {
        const { error: arErr } = await admin.from('enterprise_access_requests').insert(accessReqRows);
        if (arErr) console.warn('[seed] access_requests insert skipped:', arErr.message);
      }
    }

    // ── H4. Onboarding templates ───────────────────────────────────────────────
    const { data: onboardTemplates } = await admin.from('enterprise_onboarding_templates').insert([
      { workspace_id: workspaceId, name: 'Fejlesztői beilleszkedési terv', description: 'Standard fejlesztői onboarding – 4 hetes program.', status: 'published', version: 1 },
      { workspace_id: workspaceId, name: 'Ops beilleszkedési terv',        description: 'Ops/infrastruktúra csapat onboarding.', status: 'draft', version: 1 },
    ]).select('id,name');
    const otByName = new Map<string, string>();
    (onboardTemplates ?? []).forEach((t: any) => otByName.set(t.name, t.id));

    // ── H5. Onboarding template steps ─────────────────────────────────────────
    const devTplId = otByName.get('Fejlesztői beilleszkedési terv');
    let stepIds: string[] = [];
    if (devTplId) {
      const { data: steps } = await admin.from('enterprise_onboarding_template_steps').insert([
        { template_id: devTplId, sort_order: 1, title: 'Eszközök átvétele',              step_type: 'task',        due_offset_days: 1,  mandatory: true,  owner_role: 'owner' },
        { template_id: devTplId, sort_order: 2, title: 'HR papírok aláírása',             step_type: 'acknowledge', due_offset_days: 2,  mandatory: true,  owner_role: 'owner' },
        { template_id: devTplId, sort_order: 3, title: 'Dev környezet felállítása',       step_type: 'task',        due_offset_days: 3,  mandatory: true,  owner_role: 'resourceAssistant' },
        { template_id: devTplId, sort_order: 4, title: 'Első code review',                step_type: 'task',        due_offset_days: 7,  mandatory: true,  owner_role: 'member' },
        { template_id: devTplId, sort_order: 5, title: 'Architektúra bemutató megtekintése', step_type: 'read',     due_offset_days: 5,  mandatory: false, owner_role: 'member' },
        { template_id: devTplId, sort_order: 6, title: 'Biztonsági tréning',              step_type: 'training',   due_offset_days: 14, mandatory: true,  owner_role: 'owner' },
      ]).select('id');
      stepIds = (steps ?? []).map((s: any) => s.id);
    }

    // ── H6. Onboarding instances (newest member goes through the dev template) ──
    if (devTplId && newestMembership) {
      const { data: instances } = await admin.from('enterprise_onboarding_instances').insert([
        {
          workspace_id: workspaceId, member_id: newestMembership.id, template_id: devTplId,
          template_version: 1, status: 'in_progress',
          started_at: addDays(today, -7).toISOString(),
          due_at: addDays(today, 21).toISOString(),
        },
      ]).select('id');
      const instanceId = (instances ?? [])[0]?.id;

      // ── H7. Step completions ────────────────────────────────────────────────
      if (instanceId && stepIds.length) {
        const completionRows: any[] = stepIds.map((stepId, idx) => ({
          instance_id: instanceId,
          step_id: stepId,
          status: idx < 3 ? 'completed' : idx === 3 ? 'in_progress' : 'pending',
          completed_by: idx < 3 ? ownerId : null,
          completed_at: idx < 3 ? addDays(today, -(5 - idx)).toISOString() : null,
        }));
        const { error: scErr } = await admin.from('enterprise_onboarding_step_completions').insert(completionRows);
        if (scErr) console.warn('[seed] onboarding_step_completions insert skipped:', scErr.message);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // I. STRATEGIC / ANALYTICS
    // ════════════════════════════════════════════════════════════════════════

    // ── I1. Decision memory ────────────────────────────────────────────────────
    // Attach decisions to actual leave request IDs where possible
    const approvedLeave = ((insertedLeaves ?? []) as any[]).find(lr => lr.status === 'approved');
    const rejectedLeave = ((insertedLeaves ?? []) as any[]).find(lr => lr.status === 'rejected');
    const decisionMemoryRows: any[] = [
      {
        workspace_id: workspaceId, subject_type: 'workspace_policy', subject_id: workspaceId,
        rationale: 'Max 2 kolléga hiányozhat egyidejűleg hétfőnként, hogy biztosítsuk a stand-up meeting hatékonyságát.',
        expected_outcome: 'Minden hétfői állásjelentés megtartható legalább 60%-os részvételi aránnyal.',
        authored_by: ownerId,
      },
    ];
    if (approvedLeave) {
      decisionMemoryRows.push({
        workspace_id: workspaceId, subject_type: 'leave_request', subject_id: approvedLeave.id,
        rationale: 'A kérelem a csapat kapacitásának 30%-át sem érinti, jóváhagyható.',
        expected_outcome: 'A kolléga pihen, visszatérve motiváltan folytatja a projektet.',
        authored_by: ownerId,
      });
    }
    if (rejectedLeave) {
      decisionMemoryRows.push({
        workspace_id: workspaceId, subject_type: 'leave_request', subject_id: rejectedLeave.id,
        rationale: 'A kért időszak egybeesik a sprint zárásával; a fejlesztői jelenlét kötelező.',
        expected_outcome: 'A sprint időben lezárul, a kolléga a következő ciklusban újra kérheti.',
        authored_by: ownerId,
      });
    }
    const dmErr = await admin.from('enterprise_decision_memory').insert(decisionMemoryRows).then(r => r.error);
    if (dmErr) console.warn('[seed] decision_memory insert skipped:', dmErr.message);

    // ── I2. Capacity snapshot ─────────────────────────────────────────────────
    const totalMembers = demoUserIds.length + 1;
    await admin.from('enterprise_capacity_snapshots').insert({
      workspace_id: workspaceId, snapshot_date: fmtDate(today),
      baseline_fte: totalMembers, effective_fte: totalMembers - 0.5,
      committed_fte: 5.5, available_fte: totalMembers - 5.5 - 0.5,
      shortage_score: 0.12, overload_score: 0.05,
      payload: {
        generated_by: 'seed-demo-workspace',
        projects_count: PROJECT_DEFS.length,
        on_leave_today: 1,
      },
    } as any);

    // ════════════════════════════════════════════════════════════════════════
    // J. NOTIFICATIONS
    // ════════════════════════════════════════════════════════════════════════
    const notifPrefRows: any[] = [];
    const allDemoAndOwner = [{ user_id: ownerId }, ...demoUserIds];
    for (const { user_id } of allDemoAndOwner) {
      for (const eventType of NOTIFICATION_EVENT_TYPES) {
        notifPrefRows.push({
          workspace_id: workspaceId, user_id, event_type: eventType,
          channel_email: true, channel_push: false,
        });
      }
    }
    if (notifPrefRows.length) {
      const { error: npErr } = await admin.from('enterprise_notification_preferences').insert(notifPrefRows);
      if (npErr) console.warn('[seed] notification_preferences insert skipped:', npErr.message);
    }

    // ════════════════════════════════════════════════════════════════════════
    // L. JOGOSULTSÁG DEFINÍCIÓK
    // Szervezet → Jogosultság-menedzsment
    // ════════════════════════════════════════════════════════════════════════

    // ── L1. Role definitions ──────────────────────────────────────────────────
    const { data: roleDefs, error: roleDefsErr } = await admin.from('enterprise_role_definitions').insert(
      ROLE_DEFINITION_DEFS.map(r => ({ ...r, workspace_id: workspaceId }))
    ).select('id,role_key');
    if (roleDefsErr) console.warn('[seed] role_definitions insert skipped:', roleDefsErr.message);

    // ── L2. Role permissions ──────────────────────────────────────────────────
    if ((roleDefs ?? []).length > 0) {
      const { error: rolePermsErr } = await admin.from('enterprise_role_permissions').insert(
        ROLE_PERMISSION_DEFS.map(p => ({ ...p, workspace_id: workspaceId }))
      );
      if (rolePermsErr) console.warn('[seed] role_permissions insert skipped:', rolePermsErr.message);
    }

    // ════════════════════════════════════════════════════════════════════════
    // M. TAGOK: MEGHÍVÓ SABLONOK
    // Tagok → Meghívás → Sablonok
    // ════════════════════════════════════════════════════════════════════════
    const { error: memberTplErr } = await admin.from('enterprise_member_templates').insert(
      MEMBER_TEMPLATE_DEFS.map(t => ({
        ...t,
        workspace_id: workspaceId,
        created_by: ownerId,
        default_office_id: officeByCity.get(t.default_city) ?? null,
      }))
    );
    if (memberTplErr) console.warn('[seed] member_templates insert skipped:', memberTplErr.message);

    // ════════════════════════════════════════════════════════════════════════
    // N. LOKALIZÁCIÓ: SZÖVEG FELÜLÍRÁSOK
    // Beállítások → Lokalizáció
    // ════════════════════════════════════════════════════════════════════════
    const { error: transErr } = await admin.from('enterprise_translation_overrides').insert(
      TRANSLATION_OVERRIDE_DEFS.map(o => ({ ...o, workspace_id: workspaceId, authored_by: ownerId }))
    );
    if (transErr) console.warn('[seed] translation_overrides insert skipped:', transErr.message);

    // ════════════════════════════════════════════════════════════════════════
    // O. INTEGRÁCIÓ + AGILE
    // Beállítások → Integrációk  |  Erőforrások → Agile panel
    // ════════════════════════════════════════════════════════════════════════

    // ── O1. Workspace integration (Jira demo) ─────────────────────────────────
    const { data: integrations, error: intErr } = await admin.from('enterprise_workspace_integrations').insert({
      ...INTEGRATION_DEF,
      workspace_id: workspaceId,
      created_by: ownerId,
    }).select('id');
    if (intErr) console.warn('[seed] workspace_integrations insert skipped:', intErr.message);
    const integrationId: string | null = (integrations ?? [])[0]?.id ?? null;

    // ── O2. Agile issues ──────────────────────────────────────────────────────
    if (integrationId) {
      // Compute start_date / due_date from offset fields; strip the helper fields before insert.
      const issueRows = AGILE_ISSUE_DEFS.map(({ startOff, dueOff, ...rest }) => ({
        ...rest,
        workspace_id: workspaceId,
        integration_id: integrationId,
        start_date: fmtDate(addDays(today, startOff)),
        due_date:   fmtDate(addDays(today, dueOff)),
      }));
      const { error: issuesErr } = await admin.from('enterprise_agile_issues').insert(issueRows);
      if (issuesErr) console.warn('[seed] agile_issues insert skipped:', issuesErr.message);

      // ── O3. Agile field metadata ──────────────────────────────────────────
      const { error: fmErr } = await admin.from('enterprise_agile_field_metadata').insert(
        AGILE_FIELD_METADATA_DEFS.map(f => ({ ...f, workspace_id: workspaceId, integration_id: integrationId }))
      );
      if (fmErr) console.warn('[seed] agile_field_metadata insert skipped:', fmErr.message);
    }

    // ════════════════════════════════════════════════════════════════════════
    // P. ICAL TOKENEK
    // Beállítások → iCal előfizetés
    // ════════════════════════════════════════════════════════════════════════
    const icalUsers = [{ user_id: ownerId }, ...demoUserIds.slice(0, 3)];
    const { error: icalErr } = await admin.from('enterprise_ical_tokens').insert(
      icalUsers.map(u => ({ workspace_id: workspaceId, user_id: u.user_id, scope: 'own' }))
    );
    if (icalErr) console.warn('[seed] ical_tokens insert skipped:', icalErr.message);

    // ════════════════════════════════════════════════════════════════════════
    // Q. SHIFT HOZZÁRENDELÉSEK (KAPACITÁSTERVEZŐ)
    // Naptár → Kapacitástervező
    // ════════════════════════════════════════════════════════════════════════
    if (budapestOfficeId && demoUserIds.length >= 2) {
      const shiftRows: any[] = [];
      for (let dayOffset = 1; dayOffset <= 5; dayOffset++) {
        const shiftDate = fmtDate(addDays(today, dayOffset));
        for (const d of demoUserIds.slice(0, 3)) {
          const m = membershipByUser.get(d.user_id);
          const offId = officeByCity.get(d.persona.city) ?? budapestOfficeId;
          if (m) shiftRows.push({
            workspace_id: workspaceId, membership_id: m.id, user_id: d.user_id,
            office_id: offId, shift_date: shiftDate,
            business_role: d.persona.position, created_by: ownerId, is_tentative: dayOffset > 3,
          });
        }
      }
      if (shiftRows.length) {
        const { error: shiftErr } = await admin.from('enterprise_shift_assignments').insert(shiftRows);
        if (shiftErr) console.warn('[seed] shift_assignments insert skipped:', shiftErr.message);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // R. TAG TELEPHELY-PRIORITÁSOK
    // Tagok → Telephely prioritás
    // ════════════════════════════════════════════════════════════════════════
    const sitePriorityRows: any[] = [];
    for (const d of demoUserIds) {
      const m = membershipByUser.get(d.user_id);
      const primaryId = officeByCity.get(d.persona.city);
      if (!m || !primaryId) continue;
      sitePriorityRows.push({ workspace_id: workspaceId, membership_id: m.id, office_id: primaryId, priority: 1, created_by: ownerId });
      if (d.persona.city !== 'Budapest' && budapestOfficeId) {
        sitePriorityRows.push({ workspace_id: workspaceId, membership_id: m.id, office_id: budapestOfficeId, priority: 2, created_by: ownerId });
      }
    }
    if (sitePriorityRows.length) {
      const { error: spErr } = await admin.from('enterprise_member_site_priorities').insert(sitePriorityRows);
      if (spErr) console.warn('[seed] member_site_priorities insert skipped:', spErr.message);
    }

    // ════════════════════════════════════════════════════════════════════════
    // S. HOZZÁFÉRÉS DÖNTÉSEK
    // Folyamatok → Hozzáférés-menedzsment → Döntések
    // ════════════════════════════════════════════════════════════════════════
    if (newestMembership) {
      const { data: grantedReqs } = await admin.from('enterprise_access_requests')
        .select('id').eq('member_id', newestMembership.id).eq('status', 'granted');
      const accessDecisionRows = (grantedReqs ?? []).map((req: any) => ({
        request_id: req.id,
        action: 'granted',
        actor_id: ownerId,
        rationale: 'Projekthez szükséges alapszintű hozzáférés jóváhagyva.',
        expected_outcome: 'A kolléga be tud jelentkezni a szükséges rendszerekbe.',
      }));
      if (accessDecisionRows.length) {
        const { error: adErr } = await admin.from('enterprise_access_decisions').insert(accessDecisionRows);
        if (adErr) console.warn('[seed] access_decisions insert skipped:', adErr.message);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // K. AUDIT EVENT (summary)
    // ════════════════════════════════════════════════════════════════════════
    await admin.from('enterprise_audit_events').insert({
      workspace_id: workspaceId,
      actor_id: ownerId,
      action: 'workspace.demo_seeded',
      target_type: 'workspace',
      target_id: workspaceId,
      metadata: {
        members:          demoUserIds.length,
        offices:          (offices ?? []).length,
        teams:            (teams ?? []).length,
        leave_types:      (leaveTypes ?? []).length,
        skills:           (skills ?? []).length,
        projects:         (projects ?? []).length,
        leave_requests:   leaveRequests.length,
        scenarios:        (scenarios ?? []).length,
        reports:          (reports ?? []).length,
        onboarding_tpls:  (onboardTemplates ?? []).length,
        access_systems:   (accessSystems ?? []).length,
        integrations:     integrationId ? 1 : 0,
        agile_issues:     integrationId ? AGILE_ISSUE_DEFS.length : 0,
      },
    } as any);

    // ── Return summary ────────────────────────────────────────────────────────
    return jsonRes({
      ok: true,
      workspace_id: workspaceId,
      create_user_errors: createUserErrors.length > 0 ? createUserErrors : undefined,
      summary: {
        members:              demoUserIds.length + 1,
        offices:              (offices ?? []).length,
        teams:                (teams ?? []).length,
        leave_types:          (leaveTypes ?? []).length,
        skills:               (skills ?? []).length,
        projects:             (projects ?? []).length,
        scenarios:            (scenarios ?? []).length,
        reports:              (reports ?? []).length,
        leave_requests:       leaveRequests.length,
        holidays:             HU_HOLIDAYS_TEMPLATE.length,
        access_systems:       (accessSystems ?? []).length,
        onboarding_tpls:      (onboardTemplates ?? []).length,
        org_units:            (topOrgUnits ?? []).length + 3,
        notification_prefs:   notifPrefRows.length,
        role_definitions:     (roleDefs ?? []).length,
        member_templates:     MEMBER_TEMPLATE_DEFS.length,
        translation_overrides: TRANSLATION_OVERRIDE_DEFS.length,
        integrations:         integrationId ? 1 : 0,
        agile_issues:         integrationId ? AGILE_ISSUE_DEFS.length : 0,
        ical_tokens:          icalUsers.length,
        shift_assignments:    budapestOfficeId && demoUserIds.length >= 2 ? demoUserIds.slice(0, 3).length * 5 : 0,
        site_priorities:      sitePriorityRows.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[seed-demo-workspace] error:', msg);
    return jsonRes({ ok: false, error: msg }, 500);
  }
});
