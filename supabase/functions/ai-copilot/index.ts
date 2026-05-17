// Edge Function: ai-copilot
// AI scheduling copilot - Google Generative AI (Gemini) backend.
// Model: gemini-2.5-flash
// Full workspace context: members, roles, sites, skills, leaves, shifts,
//   availability, coverage rules, holidays, blocked dates, quota balances.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_API_KEY") ?? "";

const DEFAULT_MODEL = "gemini-2.5-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Full workspace context - all scheduling-relevant data, workspace-scoped.
// ---------------------------------------------------------------------------
async function buildWorkspaceContext(
  admin: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const year  = new Date().getFullYear();
  const in30d = new Date(Date.now() + 30  * 86400_000).toISOString().slice(0, 10);
  const in90d = new Date(Date.now() + 90  * 86400_000).toISOString().slice(0, 10);
  const in14d = new Date(Date.now() + 14  * 86400_000).toISOString().slice(0, 10);

  // Fire all DB queries in parallel (all scoped to workspaceId)
  const [
    membRes, leaveRes, shiftRes, availRes,
    officeRes, skillRes, memberSkillRes,
    violRes, openShiftRes,
    roleAllocRes, sitePrioRes,
    coverageRuleRes, holidayRes, blockedRes,
    quotaRes,
  ] = await Promise.all([
    // Members
    admin.from("enterprise_memberships")
      .select("id,user_id,business_role,office_id,weekly_capacity_hours,base_working_hours")
      .eq("workspace_id", workspaceId).eq("status", "active"),
    // Leaves (approved + pending, next 90 days)
    admin.from("leave_requests")
      .select("user_id,start_date,end_date,status,leave_type_id")
      .eq("workspace_id", workspaceId)
      .in("status", ["approved","pending"])
      .gte("end_date", today).lte("start_date", in90d),
    // Shifts (next 30 days)
    admin.from("enterprise_shift_assignments")
      .select("user_id,shift_date,office_id,business_role")
      .eq("workspace_id", workspaceId)
      .gte("shift_date", today).lte("shift_date", in30d),
    // Self-marked availability (next 14 days)
    admin.from("enterprise_staff_availability")
      .select("user_id,availability_date,status")
      .eq("workspace_id", workspaceId)
      .gte("availability_date", today).lte("availability_date", in14d)
      .in("status", ["available","preferred"]),
    // Offices
    admin.from("enterprise_offices")
      .select("id,name,city").eq("workspace_id", workspaceId).order("name"),
    // Skills catalog
    admin.from("enterprise_skills")
      .select("id,name").eq("workspace_id", workspaceId),
    // Member skills
    admin.from("enterprise_member_skills")
      .select("membership_id,skill_id,level").eq("workspace_id", workspaceId),
    // Open compliance violations (count)
    admin.from("compliance_violations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId).eq("status", "open"),
    // Open shift broadcasts (next 30 days)
    admin.from("enterprise_open_shift_requests")
      .select("office_id,shift_date,business_role,status")
      .eq("workspace_id", workspaceId)
      .gte("shift_date", today).lte("shift_date", in30d)
      .eq("status", "open"),
    // Role allocations - which roles each member can fill (substitutes!)
    admin.from("enterprise_member_role_allocations")
      .select("membership_id,business_role,percentage,is_priority")
      .eq("workspace_id", workspaceId),
    // Site priorities - which offices each member is authorized for
    admin.from("enterprise_member_site_priorities")
      .select("membership_id,office_id,priority")
      .eq("workspace_id", workspaceId),
    // Capacity/coverage rules
    admin.from("enterprise_office_coverage_rules")
      .select("office_id,name,business_role,business_roles,skill_id,skill_ids,min_headcount,days_of_week,rule_date,valid_from,valid_until")
      .eq("workspace_id", workspaceId).eq("status","active"),
    // Holidays (next 90 days)
    admin.from("enterprise_holidays")
      .select("holiday_date,name")
      .eq("workspace_id", workspaceId)
      .gte("holiday_date", today).lte("holiday_date", in90d)
      .order("holiday_date"),
    // Blocked dates (next 30 days)
    admin.from("enterprise_blocked_dates")
      .select("blocked_date,reason")
      .eq("workspace_id", workspaceId)
      .gte("blocked_date", today).lte("blocked_date", in30d)
      .order("blocked_date"),
    // Leave quota balances (current year)
    admin.from("enterprise_leave_quota_balances")
      .select("membership_id,leave_type,available_days,consumed_days")
      .eq("workspace_id", workspaceId).eq("year", year),
  ]);

  // Resolve names from profiles
  const userIds = ((membRes.data || []) as any[]).map((m: any) => m.user_id);
  const nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profs } = await admin.from("profiles")
      .select("user_id,display_name").in("user_id", userIds);
    ((profs || []) as any[]).forEach((p: any) => {
      nameMap[p.user_id] = p.display_name || p.user_id;
    });
  }

  // Build lookup maps
  const officeMap: Record<string, string> = {};
  ((officeRes.data || []) as any[]).forEach((o: any) => {
    officeMap[o.id] = o.city ? o.name + " (" + o.city + ")" : o.name;
  });

  const skillMap: Record<string, string> = {};
  ((skillRes.data || []) as any[]).forEach((s: any) => { skillMap[s.id] = s.name; });

  // membership_id -> user_id mapping
  const memberRows = (membRes.data || []) as any[];
  const midToUserId: Record<string, string> = {};
  memberRows.forEach((m: any) => { midToUserId[m.id] = m.user_id; });

  // Skills per membership
  const skillsByMid: Record<string, string[]> = {};
  ((memberSkillRes.data || []) as any[]).forEach((ms: any) => {
    const arr = skillsByMid[ms.membership_id] || [];
    arr.push((skillMap[ms.skill_id] || ms.skill_id) + "(L" + ms.level + ")");
    skillsByMid[ms.membership_id] = arr;
  });

  // Role allocations per membership: primary role + substitutable roles
  const rolesByMid: Record<string, { role: string; pct: number; isPrimary: boolean }[]> = {};
  ((roleAllocRes.data || []) as any[]).forEach((ra: any) => {
    const arr = rolesByMid[ra.membership_id] || [];
    arr.push({ role: ra.business_role, pct: ra.percentage || 100, isPrimary: !!ra.is_priority });
    rolesByMid[ra.membership_id] = arr;
  });

  // Site priorities per membership
  const sitesByMid: Record<string, { officeId: string; priority: number }[]> = {};
  ((sitePrioRes.data || []) as any[]).forEach((sp: any) => {
    const arr = sitesByMid[sp.membership_id] || [];
    arr.push({ officeId: sp.office_id, priority: sp.priority });
    sitesByMid[sp.membership_id] = arr;
  });

  // Quota balances per membership_id
  const quotaByMid: Record<string, { leaveType: string; avail: number; used: number }[]> = {};
  ((quotaRes.data || []) as any[]).forEach((q: any) => {
    const arr = quotaByMid[q.membership_id] || [];
    arr.push({ leaveType: q.leave_type || "annual", avail: Number(q.available_days || 0), used: Number(q.consumed_days || 0) });
    quotaByMid[q.membership_id] = arr;
  });

  // ---- Format sections ----

  // 1. Offices + coverage rules
  const coverageLines: string[] = [];
  const ruleRows = (coverageRuleRes.data || []) as any[];
  const officeIds = Object.keys(officeMap);
  officeIds.forEach((oid) => {
    const oRules = ruleRows.filter((r: any) => r.office_id === oid);
    if (oRules.length === 0) return;
    coverageLines.push("  " + officeMap[oid] + ":");
    oRules.forEach((r: any) => {
      const roles: string[] = (r.business_roles && r.business_roles.length > 0)
        ? r.business_roles
        : (r.business_role ? [r.business_role] : []);
      const skills: string[] = (r.skill_ids && r.skill_ids.length > 0)
        ? r.skill_ids.map((sid: string) => skillMap[sid] || sid)
        : (r.skill_id ? [skillMap[r.skill_id] || r.skill_id] : []);
      const need = [...roles, ...skills].join("+") || "any";
      const days = r.days_of_week
        ? ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].filter((_,i) => r.days_of_week.includes(i)).join("/")
        : (r.rule_date || "always");
      const label = r.name ? r.name + ": " : "";
      coverageLines.push("    - " + label + need + " x" + r.min_headcount + " on " + days +
        (r.valid_from ? " from " + r.valid_from : "") +
        (r.valid_until ? " until " + r.valid_until : ""));
    });
  });

  // 2. Members section (rich: role, sites, substitute roles, skills, capacity, quota)
  const membersSection = memberRows.map((m: any) => {
    const name = nameMap[m.user_id] || m.user_id;
    const primaryRole = m.business_role || "-";
    const skills = (skillsByMid[m.id] || []).join(", ");
    // Sites ordered by priority
    const sites = (sitesByMid[m.id] || [])
      .sort((a: any, b: any) => a.priority - b.priority)
      .map((s: any) => officeMap[s.officeId] || s.officeId)
      .join(", ");
    // Other roles (substitute capability)
    const otherRoles = (rolesByMid[m.id] || [])
      .filter((ra: any) => !ra.isPrimary || ra.role !== primaryRole)
      .map((ra: any) => ra.role + (ra.pct < 100 ? "(" + ra.pct + "%)" : ""))
      .join(", ");
    // Leave quota
    const quotas = (quotaByMid[m.id] || [])
      .map((q: any) => q.leaveType + ": " + q.avail + "d left")
      .join(", ");
    // Weekly capacity
    const cap = m.weekly_capacity_hours ? m.weekly_capacity_hours + "h/wk" : "";

    let line = "  - " + name + " | role: " + primaryRole;
    if (sites) line += " | sites: " + sites;
    if (otherRoles) line += " | can_also: " + otherRoles;
    if (skills) line += " | skills: " + skills;
    if (cap) line += " | capacity: " + cap;
    if (quotas) line += " | quota: " + quotas;
    return line;
  }).join("\n");

  // 3. Leaves
  const leavesLines = ((leaveRes.data || []) as any[]).map((l: any) =>
    "  - " + (nameMap[l.user_id] || l.user_id) + ": " + l.start_date + " to " + l.end_date +
    " [" + (l.status === "approved" ? "approved" : "pending") + "]"
  ).join("\n");

  // 4. Shifts (grouped by date)
  const shiftsByDate: Record<string, string[]> = {};
  ((shiftRes.data || []) as any[]).forEach((s: any) => {
    const entry = (nameMap[s.user_id] || s.user_id) + "@" +
      (officeMap[s.office_id] || s.office_id) +
      (s.business_role ? "(" + s.business_role + ")" : "");
    (shiftsByDate[s.shift_date] = shiftsByDate[s.shift_date] || []).push(entry);
  });
  const shiftsLines = Object.entries(shiftsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => "  " + date + ": " + entries.join(", ")).join("\n");

  // 5. Availability (grouped by date)
  const availByDate: Record<string, string[]> = {};
  ((availRes.data || []) as any[]).forEach((a: any) => {
    const entry = (nameMap[a.user_id] || a.user_id) +
      "(" + (a.status === "preferred" ? "preferred" : "available") + ")";
    (availByDate[a.availability_date] = availByDate[a.availability_date] || []).push(entry);
  });
  const availLines = Object.entries(availByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => "  " + date + ": " + entries.join(", ")).join("\n");

  // 6. Open shifts
  const openShiftLines = ((openShiftRes.data || []) as any[])
    .map((r: any) => "  - " + r.shift_date + " @ " + (officeMap[r.office_id] || r.office_id) +
      (r.business_role ? " (" + r.business_role + ")" : ""))
    .join("\n");

  // 7. Holidays
  const holidayLines = ((holidayRes.data || []) as any[])
    .map((h: any) => "  - " + h.holiday_date + ": " + h.name)
    .join("\n");

  // 8. Blocked dates
  const blockedLines = ((blockedRes.data || []) as any[])
    .map((b: any) => "  - " + b.blocked_date + (b.reason ? " (" + b.reason + ")" : ""))
    .join("\n");

  return [
    "TODAY: " + today + "  |  YEAR: " + year,
    "OPEN COMPLIANCE ISSUES: " + (violRes.count ?? 0),
    "",
    "CAPACITY RULES (what is needed, where, when):",
    coverageLines.length > 0 ? coverageLines.join("\n") : "  (none defined)",
    "",
    "ACTIVE MEMBERS (" + memberRows.length + ") — role | authorized sites | substitute roles (can_also) | skills | weekly capacity | leave quota:",
    membersSection || "  (none)",
    "",
    "LEAVES / ABSENCES (next 90 days):",
    leavesLines || "  (none)",
    "",
    "UPCOMING HOLIDAYS:",
    holidayLines || "  (none)",
    "",
    "BLOCKED SCHEDULING DATES (next 30 days):",
    blockedLines || "  (none)",
    "",
    "SCHEDULED SHIFTS (next 30 days):",
    shiftsLines || "  (none scheduled)",
    "",
    "SELF-MARKED AVAILABLE (next 14 days):",
    availLines || "  (nobody marked available)",
    "",
    "OPEN SHIFT BROADCASTS (next 30 days):",
    openShiftLines || "  (none posted)",
  ].join("\n");
}

async function getConversationHistory(
  admin: ReturnType<typeof createClient>,
  conversationId: string,
  limit = 12
) {
  const { data } = await admin.from("ai_copilot_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as { role: string; content: string }[]).reverse();
}

async function storeMessage(
  admin: ReturnType<typeof createClient>,
  conversationId: string,
  role: string,
  content: string,
  structuredPlan: unknown,
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null
) {
  const { error } = await admin.from("ai_copilot_messages").insert({
    conversation_id: conversationId, role, content,
    structured_plan: structuredPlan ?? null,
    model, input_tokens: inputTokens, output_tokens: outputTokens,
  });
  if (error) console.warn("[ai-copilot] message insert failed:", error.message);
}

const SYSTEM_PROMPT_BASE = [
  "You are an expert workforce planning and scheduling assistant for Effectime.",
  "You help managers with: leave planning, capacity analysis, shift scheduling,",
  "substitute finding, skill matching, and compliance.",
  "",
  "IMPORTANT: The LIVE WORKSPACE DATA section below contains REAL data fetched from the",
  "database right now, scoped strictly to this workspace. Use it to give concrete,",
  "actionable answers with real member names, dates, offices, and roles.",
  "",
  "Key rules for answering:",
  "- Who to schedule on a date: find members NOT in shifts for that date AND NOT on leave,",
  "  preferring those with matching role/skill AND authorized for the office (sites list).",
  "- Who can substitute: use the can_also field (role allocations) and skills.",
  "- Respect site authorization: only suggest members whose sites list includes the office.",
  "- Flag holidays and blocked dates when scheduling.",
  "- Show remaining leave quota when asked about leave balance.",
  "- Always reply in the same language the manager uses (Hungarian or English).",
  "",
  "Respond ONLY in this exact JSON shape:",
  '{ "analysis": "...", "recommendations": ["..."], "warnings": ["..."], "requires_human_review": false, "confidence": 0.9 }',
].join("\n");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

    const { workspace_id, conversation_id, instruction, model: requestedModel } =
      await req.json().catch(() => ({}));
    if (!workspace_id)    return jsonRes({ error: "workspace_id is required" }, 400);
    if (!conversation_id) return jsonRes({ error: "conversation_id is required" }, 400);
    if (!instruction)     return jsonRes({ error: "instruction is required" }, 400);

    // Verify user is a member of this workspace
    const { data: membership } = await admin.from("enterprise_memberships")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) return jsonRes({ error: "Forbidden" }, 403);

    // Load full context and history in parallel
    const [workspaceContext, history] = await Promise.all([
      buildWorkspaceContext(admin, workspace_id),
      getConversationHistory(admin, conversation_id),
    ]);

    await storeMessage(admin, conversation_id, "user", instruction, null, null, null, null);

    if (!GOOGLE_AI_KEY) {
      const fallbackContent = "AI analysis is not configured. Add GOOGLE_AI_API_KEY to Supabase secrets.";
      const fallbackPlan = { ai_available: false, analysis: fallbackContent, recommendations: [], warnings: [], confidence: 0 };
      await storeMessage(admin, conversation_id, "assistant", fallbackContent, fallbackPlan, null, null, null);
      return jsonRes({ ok: true, ai_available: false, content: fallbackContent, structured_plan: fallbackPlan, hint: "Set GOOGLE_AI_API_KEY in Supabase secrets." });
    }

    const model = requestedModel ?? DEFAULT_MODEL;
    const systemPrompt = SYSTEM_PROMPT_BASE +
      "\n\n=== LIVE WORKSPACE DATA ===\n" + workspaceContext + "\n=== END DATA ===";

    const contents = [
      ...history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      { role: "user", parts: [{ text: instruction }] },
    ];

    const aiResp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + GOOGLE_AI_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
        }),
      }
    );

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[ai-copilot] Google AI error:", errText);
      let errDetail = "";
      try { errDetail = JSON.parse(errText)?.error?.message ?? ""; } catch { /* ignore */ }
      const errContent = errDetail
        ? "AI request failed: " + errDetail
        : "AI request failed. Please try again.";
      const errPlan = { ai_available: true, error: errContent, analysis: errContent };
      await storeMessage(admin, conversation_id, "assistant", errContent, errPlan, model, null, null);
      return jsonRes({ ok: false, ai_available: true, content: errContent, structured_plan: errPlan });
    }

    const aiResult = await aiResp.json();
    const rawContent   = (aiResult.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined) ?? "";
    const inputTokens  = (aiResult.usageMetadata?.promptTokenCount     as number | undefined) ?? null;
    const outputTokens = (aiResult.usageMetadata?.candidatesTokenCount as number | undefined) ?? null;

    let structuredPlan: Record<string, unknown> | null = null;
    try {
      const jsonMatch =
        rawContent.match(/```json\s*([\s\S]*?)```/) ??
        rawContent.match(/^\s*(\{[\s\S]*\})\s*$/);
      structuredPlan = JSON.parse(jsonMatch ? jsonMatch[1] : rawContent);
    } catch {
      structuredPlan = { raw: rawContent, parse_failed: true, ai_available: true };
    }

    const content = (structuredPlan?.analysis as string | undefined) ?? rawContent;
    await storeMessage(admin, conversation_id, "assistant", content, structuredPlan, model, inputTokens, outputTokens);

    return jsonRes({
      ok: true, ai_available: true, model, content,
      structured_plan: structuredPlan,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai-copilot] unhandled error:", msg);
    return jsonRes({ error: msg }, 500);
  }
});
