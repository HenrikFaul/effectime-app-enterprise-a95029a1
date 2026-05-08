// Demo workspace seeder. Creates a fully-featured workspace for the calling user
// with realistic, relationally-coherent demo data across all major modules.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DemoUser {
  user_id: string;
  email: string;
  display_name: string;
  business_role: string;
  team: string;
  city: string;
}

const FIRST = ["Anna", "Bence", "Csenge", "Dávid", "Eszter", "Ferenc", "Gabi", "Hanna", "István", "Júlia"];
const LAST = ["Kovács", "Nagy", "Tóth", "Szabó", "Horváth", "Varga", "Kiss", "Molnár", "Németh", "Farkas"];
const TEAMS = ["Engineering", "Product", "Design", "Operations"];
const ROLES = ["Software Engineer", "Product Manager", "UX Designer", "Engineering Manager", "QA Engineer"];
const CITIES = ["Budapest", "Debrecen", "Szeged"];
const SKILLS_NAMES = ["TypeScript", "React", "Node.js", "PostgreSQL", "Figma", "Project Management", "Scrum"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function dateAddDays(d: Date, days: number): string {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const ownerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const wsName: string = body.name || `Demo munkaterület ${new Date().toLocaleDateString("hu-HU")}`;
    const wsDesc: string =
      body.description ||
      "Automatikusan generált demo munkaterület, valós adatok teszteléséhez.";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Workspace + owner membership (uses existing RPC for correct ownership).
    const { data: wsId, error: wsErr } = await userClient.rpc(
      "create_workspace_with_owner",
      { _name: wsName, _description: wsDesc },
    );
    if (wsErr) throw wsErr;
    const workspaceId = wsId as string;

    // 2) Tag workspace as demo so deletion/UX can detect it.
    await admin
      .from("enterprise_workspaces")
      .update({ description: `[DEMO] ${wsDesc}` })
      .eq("id", workspaceId);

    // 3) Create demo auth users + memberships (3 members).
    const demoUsers: DemoUser[] = [];
    for (let i = 0; i < 3; i++) {
      const first = pick(FIRST, i + ownerId.charCodeAt(0));
      const last = pick(LAST, i + ownerId.charCodeAt(1));
      const display = `${last} ${first}`;
      const email = `demo-${workspaceId.slice(0, 8)}-${i}@demo.effectime.local`;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { display_name: display, demo_workspace: workspaceId },
      });
      if (createErr || !created?.user) {
        console.error("createUser failed", createErr);
        continue;
      }
      // Profile may be auto-created via trigger; ensure display_name exists.
      await admin
        .from("profiles")
        .upsert({ user_id: created.user.id, display_name: display }, { onConflict: "user_id" });

      demoUsers.push({
        user_id: created.user.id,
        email,
        display_name: display,
        business_role: pick(ROLES, i),
        team: pick(TEAMS, i),
        city: pick(CITIES, i),
      });
    }

    // 4) Memberships
    if (demoUsers.length > 0) {
      const memberRows = demoUsers.map((u, i) => ({
        workspace_id: workspaceId,
        user_id: u.user_id,
        role: i === 0 ? "resourceAssistant" : "member",
        status: "active",
        team: u.team,
        city: u.city,
        business_role: u.business_role,
        joined_at: new Date().toISOString(),
        base_working_hours: 8,
        weekly_capacity_hours: 40,
      }));
      const { error: memErr } = await admin.from("enterprise_memberships").insert(memberRows);
      if (memErr) console.error("memberships insert", memErr);
    }

    // 5) Offices
    const officeRows = CITIES.map((c) => ({
      workspace_id: workspaceId,
      name: `${c} iroda`,
      city: c,
    }));
    const { data: offices } = await admin
      .from("enterprise_offices")
      .insert(officeRows)
      .select("id, city");

    // Link members → office
    if (offices && demoUsers.length > 0) {
      for (const u of demoUsers) {
        const office = offices.find((o: any) => o.city === u.city);
        if (office) {
          await admin
            .from("enterprise_memberships")
            .update({ office_id: office.id })
            .eq("workspace_id", workspaceId)
            .eq("user_id", u.user_id);
        }
      }
    }

    // 6) Teams
    const teamRows = TEAMS.map((t) => ({
      workspace_id: workspaceId,
      name: t,
    }));
    await admin.from("enterprise_teams").insert(teamRows).select("id");

    // 7) Leave types
    const leaveTypeRows = [
      { workspace_id: workspaceId, name: "Éves szabadság", color: "#10b981", is_paid: true, requires_approval: true, sort_order: 1 },
      { workspace_id: workspaceId, name: "Betegszabadság", color: "#ef4444", is_paid: true, requires_approval: false, sort_order: 2 },
      { workspace_id: workspaceId, name: "Otthoni munka", color: "#6366f1", is_paid: true, requires_approval: false, sort_order: 3 },
      { workspace_id: workspaceId, name: "Fizetés nélküli", color: "#94a3b8", is_paid: false, requires_approval: true, sort_order: 4 },
    ];
    await admin.from("enterprise_leave_types").insert(leaveTypeRows);

    // 8) Holidays (current + next month sample)
    const today = new Date();
    const year = today.getFullYear();
    await admin.from("enterprise_holidays").insert([
      { workspace_id: workspaceId, holiday_date: `${year}-08-20`, name: "Államalapítás ünnepe", is_recurring: true },
      { workspace_id: workspaceId, holiday_date: `${year}-10-23`, name: "1956-os forradalom", is_recurring: true },
      { workspace_id: workspaceId, holiday_date: `${year}-12-25`, name: "Karácsony", is_recurring: true },
    ]);

    // 9) Skills + member skills
    const skillRows = SKILLS_NAMES.map((s) => ({
      workspace_id: workspaceId,
      name: s,
    }));
    const { data: skills } = await admin
      .from("enterprise_skills")
      .insert(skillRows)
      .select("id, name");

    if (skills && demoUsers.length > 0) {
      const memberSkillRows: any[] = [];
      demoUsers.forEach((u, i) => {
        // each member gets 3 skills
        for (let j = 0; j < 3; j++) {
          const skill = skills[(i + j) % skills.length];
          memberSkillRows.push({
            workspace_id: workspaceId,
            user_id: u.user_id,
            skill_id: skill.id,
            proficiency_level: (j + 1) * 2,
          });
        }
      });
      await admin.from("enterprise_member_skills").insert(memberSkillRows);
    }

    // 10) Leave quotas
    if (demoUsers.length > 0) {
      const { data: memberships } = await admin
        .from("enterprise_memberships")
        .select("id, user_id")
        .eq("workspace_id", workspaceId);

      if (memberships) {
        const quotaRows = memberships.map((m: any) => ({
          workspace_id: workspaceId,
          membership_id: m.id,
          leave_type: "vacation",
          year,
          initial_days: 25,
          carryover_days: 5,
          manual_adjustment_days: 0,
        }));
        await admin.from("enterprise_leave_quotas").insert(quotaRows);
      }
    }

    // 11) Leave requests — varied statuses
    if (demoUsers.length > 0) {
      const requests: any[] = [];
      const statuses: Array<{ status: string; offset: number }> = [
        { status: "approved", offset: -30 },
        { status: "approved", offset: -14 },
        { status: "rejected", offset: -7 },
        { status: "pending", offset: 7 },
        { status: "pending", offset: 14 },
        { status: "approved", offset: 21 },
      ];
      demoUsers.forEach((u, i) => {
        statuses.forEach((s, j) => {
          const start = dateAddDays(today, s.offset + i * 2);
          const end = dateAddDays(today, s.offset + i * 2 + 2);
          const isReviewed = s.status !== "pending";
          requests.push({
            workspace_id: workspaceId,
            user_id: u.user_id,
            leave_type: j % 3 === 0 ? "vacation" : j % 3 === 1 ? "sick" : "personal",
            start_date: start,
            end_date: end,
            status: s.status,
            comment: `Demo kérelem #${j + 1}`,
            reviewer_id: isReviewed ? ownerId : null,
            reviewed_at: isReviewed ? new Date().toISOString() : null,
            review_comment: s.status === "rejected" ? "Ütközés a csapat tervezésével" : isReviewed ? "Jóváhagyva" : null,
          });
        });
      });
      const { error: lrErr } = await admin.from("leave_requests").insert(requests);
      if (lrErr) console.error("leave_requests insert", lrErr);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        workspace_id: workspaceId,
        members_created: demoUsers.length,
      }),
      {
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (e) {
    console.error("seed-demo-workspace error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }
});
