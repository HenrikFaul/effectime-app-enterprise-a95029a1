import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "../_shared/cors.ts";

// Pool of realistic Hungarian names for instant users.
// Different from DEMO_PERSONAS so no collision with demo workspace members.
const INSTANT_PERSONA_POOL = [
  { displayName: 'Balázs Fekete',      position: 'Software Engineer'          },
  { displayName: 'Katalin Vörös',      position: 'Business Analyst'           },
  { displayName: 'Márton Szabó',       position: 'Product Manager'            },
  { displayName: 'Réka Horváth',       position: 'UX Designer'                },
  { displayName: 'Ádám Németh',        position: 'DevOps Engineer'            },
  { displayName: 'Vivien Pál',         position: 'QA Engineer'                },
  { displayName: 'Gábor Pintér',       position: 'Backend Developer'          },
  { displayName: 'Nóra Takács',        position: 'Frontend Developer'         },
  { displayName: 'Tamás Kovács',       position: 'Full Stack Developer'       },
  { displayName: 'Erika Balogh',       position: 'Scrum Master'               },
  { displayName: 'Zoltán Simon',       position: 'Technical Lead'             },
  { displayName: 'Ágnes Mészáros',     position: 'Data Analyst'               },
  { displayName: 'Péter Lukács',       position: 'Cloud Engineer'             },
  { displayName: 'Hajnalka Orbán',     position: 'Operations Specialist'      },
  { displayName: 'Norbert Molnár',     position: 'Senior Frontend Developer'  },
  { displayName: 'Szilvia Farkas',     position: 'HR Business Partner'        },
  { displayName: 'Csaba Tóth',         position: 'Project Manager'            },
  { displayName: 'Dorottya Gál',       position: 'Junior Developer'           },
  { displayName: 'Levente Halász',     position: 'Senior Backend Developer'   },
  { displayName: 'Kinga Barna',        position: 'Security Engineer'          },
  { displayName: 'Attila Vásárhelyi',  position: 'Data Engineer'              },
  { displayName: 'Monika Fehér',       position: 'Product Designer'           },
  { displayName: 'Roland Kiss',        position: 'Platform Engineer'          },
  { displayName: 'Tünde Hajdu',        position: 'Test Automation Engineer'   },
  { displayName: 'Benedek Orosz',      position: 'Site Reliability Engineer'  },
];

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickOne<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function pickSome<T>(items: T[], max = 3): T[] {
  if (!items.length) return [];
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  const count = Math.min(items.length, 1 + Math.floor(Math.random() * max));
  return shuffled.slice(0, count);
}

function randomToken(bytes = 12) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const workspaceId = typeof body.workspace_id === "string" ? body.workspace_id : "";
    if (!workspaceId) return jsonRes({ error: "Hiányzó workspace_id." }, 400);

    const { data: adminMembership, error: adminMembershipError } = await admin
      .from("enterprise_memberships")
      .select("id, role, status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "resourceAssistant"])
      .maybeSingle();

    if (adminMembershipError) {
      console.error("Instant member admin check error:", adminMembershipError);
      return jsonRes({ error: "Nem sikerült ellenőrizni a jogosultságot." }, 500);
    }
    if (!adminMembership) return jsonRes({ error: "Nincs jogosultság instant tag létrehozásához." }, 403);

    const [membersRes, officesRes, skillsRes, allocationsRes] = await Promise.all([
      admin
        .from("enterprise_memberships")
        .select("id, team, location, business_role, city, office_id, weekly_capacity_hours, base_working_hours, working_pattern")
        .eq("workspace_id", workspaceId)
        .eq("status", "active"),
      admin
        .from("enterprise_offices")
        .select("id, name, city")
        .eq("workspace_id", workspaceId),
      admin
        .from("enterprise_skills")
        .select("id")
        .eq("workspace_id", workspaceId),
      admin
        .from("enterprise_member_role_allocations")
        .select("business_role, percentage, is_priority")
        .eq("workspace_id", workspaceId),
    ]);

    if (membersRes.error) return jsonRes({ error: "Nem sikerült betölteni a meglévő tagértékeket." }, 500);
    if (officesRes.error) return jsonRes({ error: "Nem sikerült betölteni a telephely értékkészletet." }, 500);
    if (skillsRes.error) return jsonRes({ error: "Nem sikerült betölteni a skill értékkészletet." }, 500);
    if (allocationsRes.error) return jsonRes({ error: "Nem sikerült betölteni a hozzárendelési értékkészletet." }, 500);

    const members = (membersRes.data || []).filter((m: any) => m.id !== adminMembership.id);
    const offices = officesRes.data || [];
    const skills = skillsRes.data || [];
    const existingAllocations = (allocationsRes.data || []).filter((a: any) =>
      typeof a.business_role === "string" && a.business_role.trim(),
    );

    const sourceMember = pickOne(members) as any;
    const sourceOffice = offices.length ? pickOne(offices) as any : null;
    const businessRoles = Array.from(new Set([
      ...members.map((m: any) => m.business_role).filter(Boolean),
      ...existingAllocations.map((a: any) => a.business_role).filter(Boolean),
    ]));
    const teams = Array.from(new Set(members.map((m: any) => m.team).filter(Boolean)));
    const locations = Array.from(new Set(members.map((m: any) => m.location).filter(Boolean)));
    const cities = Array.from(new Set([
      ...members.map((m: any) => m.city).filter(Boolean),
      ...offices.map((o: any) => o.city).filter(Boolean),
    ]));

    // Pick a realistic name from the pool, preferring one not already used in this workspace.
    const existingNames = new Set(members.map((m: any) => m.display_name).filter(Boolean));
    const available = INSTANT_PERSONA_POOL.filter(p => !existingNames.has(p.displayName));
    const persona = pickOne(available.length ? available : INSTANT_PERSONA_POOL) as typeof INSTANT_PERSONA_POOL[number];

    // Prefer a position from the workspace catalog; fall back to the pool persona's own position.
    const poolPosition = persona.position;
    const workspacePosition = (pickOne(businessRoles) as string | null) ?? sourceMember?.business_role ?? null;

    const displayName = persona.displayName;
    const email = `instant-${workspaceId.slice(0, 8)}-${Date.now()}-${randomToken(3)}@instant.syncfolk.local`;
    const password = `${randomToken(18)}Aa1!`;

    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        source: "enterprise_instant_user",
        workspace_id: workspaceId,
      },
    });

    if (createUserError || !createdUser.user) {
      console.error("Instant member auth user create error:", createUserError);
      return jsonRes({ error: "Nem sikerült létrehozni az instant user auth rekordját." }, 500);
    }

    const instantUserId = createdUser.user.id;
    const nowIso = new Date().toISOString();

    const membershipPayload: Record<string, unknown> = {
      workspace_id: workspaceId,
      user_id: instantUserId,
      role: "member",
      status: "active",
      joined_at: nowIso,
      business_role: workspacePosition ?? poolPosition,
      team: (pickOne(teams) as string | null) ?? sourceMember?.team ?? null,
      location: (pickOne(locations) as string | null) ?? sourceMember?.location ?? null,
      city: (sourceOffice?.city as string | null) ?? (pickOne(cities) as string | null) ?? sourceMember?.city ?? null,
      office_id: sourceOffice?.id ?? sourceMember?.office_id ?? null,
      weekly_capacity_hours: sourceMember?.weekly_capacity_hours ?? 40,
      base_working_hours: sourceMember?.base_working_hours ?? 8,
      working_pattern: sourceMember?.working_pattern ?? undefined,
    };

    const { data: insertedMembership, error: membershipError } = await admin
      .from("enterprise_memberships")
      .insert(membershipPayload)
      .select("id")
      .single();

    if (membershipError || !insertedMembership) {
      console.error("Instant member membership insert error:", membershipError);
      await admin.auth.admin.deleteUser(instantUserId).catch(() => null);
      return jsonRes({ error: "Nem sikerült létrehozni az aktív enterprise tagságot." }, 500);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert({
        user_id: instantUserId,
        display_name: displayName,
        is_temporary: false,
        preferences: {
          source: "enterprise_instant_user",
          email,
          workspace_id: workspaceId,
        },
      }, { onConflict: "user_id" });

    if (profileError) console.error("Instant member profile upsert error:", profileError);

    const membershipId = insertedMembership.id;
    const allocationRole = membershipPayload.business_role;
    if (typeof allocationRole === "string" && allocationRole.trim()) {
      const { error: allocationError } = await admin
        .from("enterprise_member_role_allocations")
        .insert({
          workspace_id: workspaceId,
          membership_id: membershipId,
          business_role: allocationRole,
          percentage: 100,
          is_priority: true,
        });
      if (allocationError) console.error("Instant member role allocation insert error:", allocationError);
    }

    const skillRows = pickSome(skills, 3).map((skill: any) => ({
      workspace_id: workspaceId,
      membership_id: membershipId,
      skill_id: skill.id,
      level: 1 + Math.floor(Math.random() * 5),
    }));

    if (skillRows.length > 0) {
      const { error: skillError } = await admin.from("enterprise_member_skills").insert(skillRows);
      if (skillError) console.error("Instant member skill insert error:", skillError);
    }

    return jsonRes({
      success: true,
      user_id: instantUserId,
      membership_id: membershipId,
      display_name: displayName,
      email,
    });
  } catch (error) {
    console.error("Create instant enterprise member error:", error);
    return jsonRes({ error: "Váratlan hiba az instant tag létrehozásakor." }, 500);
  }
});
