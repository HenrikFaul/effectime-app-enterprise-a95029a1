// Demo Workspace Seeder
// ----------------------
// Creates a fully populated demo workspace for the calling user.
// Strategy: spin up real auth.users for demo personas (so leave_requests, profiles,
// memberships all work without schema changes), then seed every workspace-scoped
// module with realistic data.
//
// All demo personas get an `app_metadata.is_demo_persona = true` flag so they
// can be cleaned up later. The owning workspace stores the seeded demo user_ids
// in `enterprise_workspaces.settings.demo_user_ids` to enable safe cleanup
// when the workspace is deleted.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function pickOne<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

const DEMO_PERSONAS = [
  { display_name: 'Anna Kovács', team: 'Frontend', city: 'Budapest', position: 'Senior Frontend Developer', seniority: 'senior' as const },
  { display_name: 'Bence Tóth', team: 'Backend', city: 'Budapest', position: 'Backend Developer', seniority: 'medior' as const },
  { display_name: 'Csilla Nagy', team: 'Operations', city: 'Debrecen', position: 'Operations Lead', seniority: 'lead' as const },
  { display_name: 'Dávid Szabó', team: 'Frontend', city: 'Budapest', position: 'Junior Frontend Developer', seniority: 'junior' as const },
  { display_name: 'Eszter Kiss', team: 'QA', city: 'Szeged', position: 'QA Engineer', seniority: 'medior' as const },
  { display_name: 'Ferenc Horváth', team: 'Backend', city: 'Budapest', position: 'Senior Backend Developer', seniority: 'senior' as const },
  { display_name: 'Gizella Varga', team: 'Operations', city: 'Debrecen', position: 'Operations Specialist', seniority: 'medior' as const },
];

const SKILL_NAMES = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'Tailwind CSS', 'Cypress', 'Jest'];
const OFFICE_DEFS = [
  { name: 'Budapest HQ', city: 'Budapest', address: 'Andrássy út 1, 1061 Budapest' },
  { name: 'Debrecen Office', city: 'Debrecen', address: 'Piac u. 20, 4024 Debrecen' },
  { name: 'Szeged Office', city: 'Szeged', address: 'Kárász u. 5, 6720 Szeged' },
];
const TEAM_DEFS = [
  { name: 'Frontend', description: 'Frontend / web app team' },
  { name: 'Backend', description: 'Backend / API team' },
  { name: 'Operations', description: 'Operations and infrastructure' },
  { name: 'QA', description: 'Quality assurance' },
];
const LEAVE_TYPE_DEFS = [
  { name: 'Éves szabadság', color: '#3b82f6', is_paid: true, requires_approval: true },
  { name: 'Betegszabadság', color: '#ef4444', is_paid: true, requires_approval: false },
  { name: 'Fizetés nélküli', color: '#a855f7', is_paid: false, requires_approval: true },
  { name: 'Otthoni munka', color: '#10b981', is_paid: true, requires_approval: false },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authz = req.headers.get('Authorization');
    if (!authz) return jsonRes({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authz } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonRes({ error: 'Unauthorized' }, 401);
    const ownerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const name: string = (body?.name ?? '').toString().trim() || `Demo munkaterület ${new Date().toLocaleDateString('hu-HU')}`;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── 1. Create workspace via the RPC. SECURITY DEFINER + auth.uid() requires the user JWT,
    // so call it through the user-scoped client. Subsequent inserts use the admin client to
    // bypass RLS during seeding.
    const { data: wsId, error: rpcErr } = await userClient.rpc('create_workspace_with_owner', {
      _name: name,
      _description: 'Demo munkaterület – minden modul azonnal tesztelhető előre kitöltött adatokkal.',
    });
    if (rpcErr) return jsonRes({ error: 'Workspace létrehozás sikertelen: ' + rpcErr.message }, 500);
    const workspaceId = wsId as string;
    if (!workspaceId) return jsonRes({ error: 'Workspace ID nem elérhető' }, 500);

    // ── 2. Create demo auth users (real users, marked as demo personas)
    const demoUserIds: { user_id: string; persona: typeof DEMO_PERSONAS[number] }[] = [];
    const seedTag = Math.random().toString(36).slice(2, 9);
    for (const persona of DEMO_PERSONAS) {
      const slug = persona.display_name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
      const email = `demo-${slug}-${seedTag}@effectime-demo.local`;
      const password = `Demo!${crypto.randomUUID().slice(0, 12)}`;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: persona.display_name },
        app_metadata: { is_demo_persona: true, demo_workspace_id: workspaceId },
      });
      if (createErr || !created?.user) {
        console.error('[seed-demo-workspace] createUser failed', createErr?.message);
        continue;
      }
      demoUserIds.push({ user_id: created.user.id, persona });
      // Ensure profile exists (handle_new_user trigger should auto-create, but force-upsert anyway)
      await admin.from('profiles').upsert({
        user_id: created.user.id,
        display_name: persona.display_name,
      } as any, { onConflict: 'user_id' });
    }

    // ── 3. Persist demo user ids on the workspace so cleanup can find them
    await admin.from('enterprise_workspaces').update({
      settings: {
        is_demo: true,
        demo_user_ids: demoUserIds.map((d) => d.user_id),
        demo_seed_tag: seedTag,
      },
    } as any).eq('id', workspaceId);

    // ── 4. Offices
    const { data: offices } = await admin.from('enterprise_offices').insert(
      OFFICE_DEFS.map((o) => ({ ...o, workspace_id: workspaceId })),
    ).select('id, name, city');
    const officeByCity = new Map<string, string>();
    (offices ?? []).forEach((o: any) => officeByCity.set(o.city, o.id));

    // ── 5. Teams
    const { data: teams } = await admin.from('enterprise_teams').insert(
      TEAM_DEFS.map((t) => ({ ...t, workspace_id: workspaceId, created_by: ownerId })),
    ).select('id, name');
    const teamByName = new Map<string, string>();
    (teams ?? []).forEach((t: any) => teamByName.set(t.name, t.id));

    // ── 6. Leave types
    const { data: leaveTypes } = await admin.from('enterprise_leave_types').insert(
      LEAVE_TYPE_DEFS.map((lt, idx) => ({
        ...lt, workspace_id: workspaceId, sort_order: idx, is_active: true,
      })),
    ).select('id, name');
    const annualLeaveTypeId = (leaveTypes ?? []).find((l: any) => l.name === 'Éves szabadság')?.id ?? null;

    // ── 7. Holidays — common HU public holidays this year and next
    const year = new Date().getUTCFullYear();
    const HU_HOLIDAYS = [
      { date: `${year}-01-01`, name: 'Újév' },
      { date: `${year}-03-15`, name: 'Nemzeti ünnep' },
      { date: `${year}-05-01`, name: 'Munka ünnepe' },
      { date: `${year}-08-20`, name: 'Államalapítás ünnepe' },
      { date: `${year}-10-23`, name: '1956-os forradalom' },
      { date: `${year}-11-01`, name: 'Mindenszentek' },
      { date: `${year}-12-25`, name: 'Karácsony' },
      { date: `${year}-12-26`, name: 'Karácsony másnapja' },
    ];
    await admin.from('enterprise_holidays').insert(
      HU_HOLIDAYS.map((h) => ({
        workspace_id: workspaceId,
        holiday_date: h.date,
        name: h.name,
        is_recurring: true,
      })),
    );

    // ── 8. Skills (catalog)
    const { data: skills } = await admin.from('enterprise_skills').insert(
      SKILL_NAMES.map((s, idx) => ({
        workspace_id: workspaceId,
        name: s,
        category: idx < 4 ? 'Engineering' : idx < 7 ? 'Infrastructure' : 'QA',
        color: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#22c55e'][idx % 7],
      })),
    ).select('id, name');
    const skillByName = new Map<string, string>();
    (skills ?? []).forEach((s: any) => skillByName.set(s.name, s.id));

    // ── 9. Memberships (for owner + demo personas)
    // Owner is already a member from create_workspace_with_owner. Update its base_working_hours.
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
      joined_at: new Date().toISOString(),
    }));
    const { data: insertedMemberships } = await admin.from('enterprise_memberships').insert(memberInserts).select('id, user_id, business_role');
    const membershipByUser = new Map<string, { id: string; business_role: string | null }>();
    (insertedMemberships ?? []).forEach((m: any) => membershipByUser.set(m.user_id, { id: m.id, business_role: m.business_role }));

    // ── 10. Member-skills (each demo member gets 2-4 random skills)
    const memberSkillRows: any[] = [];
    for (const { user_id } of demoUserIds) {
      const m = membershipByUser.get(user_id);
      if (!m) continue;
      const nSkills = 2 + Math.floor(Math.random() * 3);
      const shuffled = [...SKILL_NAMES].sort(() => Math.random() - 0.5).slice(0, nSkills);
      for (const skillName of shuffled) {
        const skillId = skillByName.get(skillName);
        if (!skillId) continue;
        memberSkillRows.push({
          workspace_id: workspaceId,
          membership_id: m.id,
          skill_id: skillId,
          level: 1 + Math.floor(Math.random() * 5),
        });
      }
    }
    if (memberSkillRows.length) {
      await admin.from('enterprise_member_skills').insert(memberSkillRows);
    }

    // ── 11. Allocations (1 row per member, 100% to their position)
    const allocationRows = demoUserIds.map((d) => {
      const m = membershipByUser.get(d.user_id);
      if (!m) return null;
      return {
        workspace_id: workspaceId,
        membership_id: m.id,
        business_role: d.persona.position,
        percentage: 100,
        is_priority: true,
      };
    }).filter(Boolean);
    if (allocationRows.length) {
      await admin.from('enterprise_member_role_allocations').insert(allocationRows);
    }

    // ── 12. Leave requests — mix of approved / pending / rejected
    const today = new Date();
    const leaveRequests: any[] = [];
    const personas = demoUserIds.slice(); // copy
    if (annualLeaveTypeId !== null && personas.length >= 3) {
      // Approved past
      leaveRequests.push({
        workspace_id: workspaceId,
        user_id: personas[0].user_id,
        leave_type: 'vacation',
        start_date: fmtDate(addDays(today, -20)),
        end_date: fmtDate(addDays(today, -16)),
        status: 'approved',
        reviewer_id: ownerId,
        reviewed_at: addDays(today, -22).toISOString(),
        comment: 'Tavaszi pihenés',
      });
      // Approved upcoming
      leaveRequests.push({
        workspace_id: workspaceId,
        user_id: personas[1].user_id,
        leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 7)),
        end_date: fmtDate(addDays(today, 11)),
        status: 'approved',
        reviewer_id: ownerId,
        reviewed_at: addDays(today, -1).toISOString(),
        comment: 'Családi nyaralás',
      });
      // Pending (this week)
      leaveRequests.push({
        workspace_id: workspaceId,
        user_id: personas[2].user_id,
        leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 14)),
        end_date: fmtDate(addDays(today, 18)),
        status: 'pending',
        comment: 'Pihenőnap',
      });
      // Pending (sick leave style)
      if (personas[3]) leaveRequests.push({
        workspace_id: workspaceId,
        user_id: personas[3].user_id,
        leave_type: 'sick_leave',
        start_date: fmtDate(addDays(today, 1)),
        end_date: fmtDate(addDays(today, 2)),
        status: 'pending',
        comment: 'Megbetegedés',
      });
      // Rejected
      if (personas[4]) leaveRequests.push({
        workspace_id: workspaceId,
        user_id: personas[4].user_id,
        leave_type: 'vacation',
        start_date: fmtDate(addDays(today, 30)),
        end_date: fmtDate(addDays(today, 35)),
        status: 'rejected',
        reviewer_id: ownerId,
        reviewed_at: addDays(today, -2).toISOString(),
        review_comment: 'Sprint záráshoz szükséges erőforrás',
      });
      // Approved (yesterday-today, currently on leave)
      if (personas[5]) leaveRequests.push({
        workspace_id: workspaceId,
        user_id: personas[5].user_id,
        leave_type: 'vacation',
        start_date: fmtDate(addDays(today, -1)),
        end_date: fmtDate(addDays(today, 1)),
        status: 'approved',
        reviewer_id: ownerId,
        reviewed_at: addDays(today, -5).toISOString(),
        comment: 'Tervezett szabadság',
      });
    }
    if (leaveRequests.length) {
      await admin.from('leave_requests').insert(leaveRequests);
    }

    // ── 13. Daily rules (1 simple max-off rule)
    await admin.from('enterprise_daily_rules').insert({
      workspace_id: workspaceId,
      day_of_week: 1, // Monday
      max_off: 2,
      is_active: true,
    } as any);

    // ── 14. Office coverage rule (Budapest needs 1 dev present)
    const budapestOfficeId = officeByCity.get('Budapest');
    if (budapestOfficeId) {
      await admin.from('enterprise_office_coverage_rules').insert({
        workspace_id: workspaceId,
        office_id: budapestOfficeId,
        days_of_week: [1, 2, 3, 4, 5],
        min_headcount: 1,
        business_roles: ['Senior Frontend Developer', 'Senior Backend Developer'],
        is_active: true,
      } as any);
    }

    // ── 15. Allowances (vacation 25 days/year for each member)
    const allowanceRows = demoUserIds.map((d) => {
      const m = membershipByUser.get(d.user_id);
      if (!m) return null;
      return {
        workspace_id: workspaceId,
        membership_id: m.id,
        leave_type: 'vacation',
        days_per_year: 25,
        carried_over_days: 0,
        year: year,
      };
    }).filter(Boolean);
    if (allowanceRows.length) {
      // Some installations use enterprise_allowances; ignore failures gracefully.
      const { error: allowErr } = await admin.from('enterprise_allowances').insert(allowanceRows);
      if (allowErr) console.warn('[seed-demo-workspace] allowance insert skipped:', allowErr.message);
    }

    // ── 16. Audit event log line
    await admin.from('enterprise_audit_events').insert({
      workspace_id: workspaceId,
      actor_user_id: ownerId,
      event_type: 'workspace.demo_seeded',
      entity_type: 'workspace',
      entity_id: workspaceId,
      metadata: {
        members: demoUserIds.length,
        offices: (offices ?? []).length,
        teams: (teams ?? []).length,
        leave_types: (leaveTypes ?? []).length,
        skills: (skills ?? []).length,
        leaves: leaveRequests.length,
      },
    } as any);

    return jsonRes({
      ok: true,
      workspace_id: workspaceId,
      summary: {
        members: demoUserIds.length + 1,
        offices: (offices ?? []).length,
        teams: (teams ?? []).length,
        leave_types: (leaveTypes ?? []).length,
        skills: (skills ?? []).length,
        leave_requests: leaveRequests.length,
        holidays: HU_HOLIDAYS.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[seed-demo-workspace] error:', msg);
    return jsonRes({ ok: false, error: msg }, 500);
  }
});
